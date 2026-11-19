import cv2, numpy as np, sys, json
from scipy import ndimage as ndi
src, out = sys.argv[1], sys.argv[2]
FEMALE = len(sys.argv) > 3
DY = 6 if FEMALE else 0     # the shorter figure's old waterline sits a little lower
I = cv2.imread(src, cv2.IMREAD_UNCHANGED)[...,:3].astype(np.float32)
H, W = I.shape[:2]
body = np.load('body.npy')
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
WATER_Y = 776
ss = lambda v, a, b: np.clip((v - a) / (b - a), 0, 1)

# ---- background estimate: fill everything near the figure, the floor and the UI icons from around
hide = ndi.binary_dilation(body, iterations=60)
hide |= yy > 880
hide[:95, 245:] = True
valid = (~hide).astype(np.float32)
num = cv2.GaussianBlur(I * valid[..., None], (0, 0), 45)
den = cv2.GaussianBlur(valid, (0, 0), 45)[..., None]
fill = num / np.maximum(den, 1e-4)
weak = den[..., 0] < 0.03
fill[weak] = np.broadcast_to(np.median(fill[860:875], axis=(0, 1))[None, None], fill.shape)[weak]
fill = cv2.GaussianBlur(fill, (0, 0), 12)
soft = cv2.GaussianBlur(valid, (0, 0), 8)[..., None]
bg = I * soft + fill * (1 - soft)

# ---- smooth signed distance to the silhouette edge (inside positive), measured at 4x
K = 4
big = cv2.resize(cv2.GaussianBlur(body.astype(np.float32), (0, 0), 2.2), None, fx=K, fy=K, interpolation=cv2.INTER_CUBIC) > 0.5
din = cv2.distanceTransform(big.astype(np.uint8), cv2.DIST_L2, 5)
dout = cv2.distanceTransform((~big).astype(np.uint8), cv2.DIST_L2, 5)
sd = cv2.resize(np.where(big, din, -dout), (W, H), interpolation=cv2.INTER_AREA) / K
LO = -30
def profile(rows, cols, hi):
    reg = np.zeros((H, W), bool); reg[rows[0]:rows[1], cols[0]:cols[1]] = True
    ds = np.arange(LO, hi + 0.01, 0.5)
    prof = np.zeros((len(ds), 3), np.float32)
    for i, d in enumerate(ds):
        m = reg & (sd >= d - 0.4) & (sd < d + 0.4) if d < hi else reg & (sd >= d - 0.4)
        prof[i] = np.median(I[m], axis=0) if m.sum() > 6 else prof[i - 1]
    return ndi.gaussian_filter1d(prof, 2.0, axis=0), hi
def apply(pf):
    prof, hi = pf
    t = (np.clip(sd, LO, hi) - LO) * 2
    i0 = np.floor(t).astype(int); i1 = np.minimum(i0 + 1, len(prof) - 1); w = (t - i0)[..., None]
    return prof[i0] * (1 - w) + prof[i1] * w
teal = profile((615, 765), (60, 336), 26)
water = profile((808, 900), (100, 300), 16)
T, Wt = apply(teal), apply(water)
if not FEMALE: np.save('teal.npy', teal[0]); np.save('bgT.npy', np.median(bg[615:765, 60:336], axis=(0, 1)))
bgT = np.median(bg[615:765, 60:336], axis=(0, 1)); bgW = np.median(bg[808:900, 100:300], axis=(0, 1))
inside = ss(sd, -0.6, 0.6)[..., None]
if FEMALE:
    cx = 198.0
    v = lambda y: 984 - (984 - y) * 0.97                      # a row of the male figure, on the shorter one
    rim = teal[0][int((0.5 - LO) * 2)]
    # the middle of the torso is redrawn smooth, without the chest and stomach muscles
    centre = np.zeros((H, W), np.float32)
    for y in range(H):
        xs = np.where(body[y])[0]
        if len(xs) == 0: continue
        for r in np.split(xs, np.where(np.diff(xs) > 1)[0] + 1):
            if r[0] <= cx <= r[-1]: centre[y, r[0]:r[-1] + 1] = 1
    hw = np.interp(yy[:, 0], [v(205), v(240), v(350), v(366)], [30, 64, 64, 200])[:, None]
    tm = centre * (np.abs(xx - cx) < hw) * ss(yy, v(200), v(226)) * (1 - ss(yy, v(452), v(492)))
    tm = cv2.GaussianBlur(tm.astype(np.float32), (0, 0), 6)
    # shoulders and arms keep a little of their shading, but lose most of the muscle definition
    upper = body.astype(np.float32) * ss(yy, v(186), v(206)) * (1 - ss(yy, v(480), v(515)))
    tm = np.maximum(tm, 0.72 * cv2.GaussianBlur(upper, (0, 0), 2))[..., None]
    # light lines, drawn at 2x and softened
    L = np.zeros((H * 2, W * 2), np.float32)
    def line(pts, a0, a1=None, t=2):
        pts = np.array(pts, np.float32) * 2
        n = len(pts) - 1
        for i in range(n):
            a = a0 if a1 is None else a0 + (a1 - a0) * i / max(n - 1, 1)
            cv2.line(L, tuple(int(q) for q in pts[i]), tuple(int(q) for q in pts[i + 1]), float(a), t, cv2.LINE_AA)
    yb, r, off = v(297), 29.0, 34.0
    for sgn in (-1, 1):
        c = np.array([cx + sgn * off, yb])
        th = np.radians(np.linspace(8, 172, 40))
        arc = [c + r * np.array([sgn * np.cos(t), np.sin(t)]) for t in th]      # the lower curve of the breast, outer side first
        for i in range(len(arc) - 1):
            w = np.sin(th[i]) ** 0.8
            cv2.line(L, tuple(int(q * 2) for q in arc[i]), tuple(int(q * 2) for q in arc[i + 1]), float(0.7 * w + 0.1), 3, cv2.LINE_AA)
        line([arc[0], (cx + sgn * (off + r + 3), yb - 16), (cx + sgn * 70, v(262))], 0.3, 0.05)     # outer contour up to the armpit
        line([(cx + sgn * 9, v(214)), (cx + sgn * 36, v(218)), (cx + sgn * 60, v(226))], 0.32, 0.12)  # collarbone
    line([(cx, v(356)), (cx, v(436))], 0.16)
    cv2.ellipse(L, (int(cx * 2), int(v(452) * 2)), (3, 8), 0, 0, 360, 0.42, -1, cv2.LINE_AA)       # navel
    L = cv2.resize(cv2.GaussianBlur(L, (0, 0), 3.0), (W, H), interpolation=cv2.INTER_AREA)[..., None]
    vol = sum(np.exp(-(((xx - (cx + sg * off)) / 20) ** 2 + ((yy - (yb - 2)) / 19) ** 2)) for sg in (-1, 1))[..., None] * 0.24
    torso = T * (1.06 + vol) + (rim - T) * np.clip(L * 1.5, 0, 1)
    I = I * (1 - tm) + np.clip(torso, 0, 255) * tm
    # the hair bun is new: drawn the way the rest of the body is lit
    bun = cv2.GaussianBlur(np.load('bun.npy').astype(np.float32), (0, 0), 1.2)[..., None]
    zone = (cv2.GaussianBlur(np.load('bun.npy').astype(np.float32), (0, 0), 14) > 0.01)[..., None] & ~body[..., None]
    I = I * (1 - bun) + T * 1.08 * bun
    I = np.where(zone, bg + np.clip(T - bgT, 0, 255), I)
lum = I.max(axis=2, keepdims=True)

# ---- EMPTY: the reference with the water taken out of the legs
halo_T = bg + np.clip(T - bgT, 0, 255)
toes = np.clip(lum - Wt.max(axis=2, keepdims=True), -40, 60) * ss(sd, 1.5, 3)[..., None] * 0.3 * (teal[0][-1] / teal[0][-1].max())
shade = (1.12 + 0.10 * np.cos((xx - 198) / 9.0) * ss(sd, 3, 10))[..., None]
L1 = I.max(axis=2)
fine = np.clip(L1 - cv2.GaussianBlur(L1, (0, 0), 2.2), -25, 90)[..., None]      # toe lines, ankle and foot edges
tint_T = teal[0][int((0.5 - LO) * 2)] / teal[0][int((0.5 - LO) * 2)].max()
foot = ss(yy, 918, 934)[..., None] * ss(sd, 1.0, 2.5)[..., None]               # feet only: the shins' detail is bubbles
# match the rebuilt lower leg to the real leg just above it, so no line shows where they meet
deep = (sd > 5)
gain = float(np.clip(np.median(I[660:700][deep[660:700]].max(axis=1)) / max(np.median((T * shade)[660:700][deep[660:700]].max(axis=1)), 1), 0.8, 1.6))
print('leg gain', round(gain, 2))
# the feet: a dark teal foot with the toe lines of the water-filled original, drawn bright
hsvI = cv2.cvtColor(np.clip(I, 0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
paleI = ss(250 - hsvI[..., 1], 0, 140)
# same picture, teal hue, dimmed; the pale toe lines stay bright
dimI = np.dstack([np.full_like(paleI, 84), hsvI[..., 1], hsvI[..., 2] * (0.34 + 0.66 * paleI)])
footcol = cv2.cvtColor(np.clip(dimI, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)
legs_plain = T * shade * (1 + (gain - 1) * ss(sd, 3, 8)[..., None])
foot = ss(yy, 922, 944)[..., None] * ss(sd, 1.0, 3.0)[..., None]
legs_in = np.clip(legs_plain * (1 - foot) + footcol * foot, 0, 255)
floor = ss(yy, 922, 936)[..., None]
legs_out = halo_T * (1 - floor) + I * floor
legs = legs_in * inside + legs_out * (1 - inside)
blend = ss(yy, WATER_Y - 96, WATER_Y - 38)[..., None]     # done before the water's own glow begins
Ie = I * (1 - blend) + legs * blend

# ---- FULL: the whole body filled with the reference's water
rng = np.random.default_rng(11)
bub = np.zeros((H * 2, W * 2), np.float32)
ys, xs = np.where((sd > 5) & (yy < 800))
for k in rng.choice(len(ys), 70, replace=False):
    c = (int(xs[k] * 2), int(ys[k] * 2))
    cv2.circle(bub, c, int(rng.integers(1, 3)), float(rng.uniform(0.25, 0.6)), -1, cv2.LINE_AA)   # tiny specks only
bub = cv2.resize(cv2.GaussianBlur(bub, (0, 0), 1.4), (W, H), interpolation=cv2.INTER_AREA)[..., None]
musc = np.clip(lum - T.max(axis=2, keepdims=True), -25, 255) * ss(sd, 2.5, 5)[..., None] * (1 - ss(yy, 736, 756))[..., None]     # the body's own shading
depth = (1.0 + 0.05 * np.cos(yy / 37.0) * np.cos(xx / 29.0))[..., None]                          # slow variation, like liquid
glow_in = (np.exp(-np.clip(sd, 0, 99) / 12.0) * 34)[..., None] * np.array([1.0, 1.0, 0.75], np.float32)
fill_in = np.clip(Wt * depth + glow_in + musc * 0.85 * np.array([1.0, 0.97, 0.8], np.float32) + bub * np.array([255, 255, 215], np.float32) * 0.5, 0, 255)
near_w = (1 - ss(-sd, 3, 11))[..., None]
fill_out = bg + np.clip(Wt - bgW, 0, 255) * 0.55 * near_w
synth = fill_in * inside + fill_out * (1 - inside)
b2 = ss(yy, 800 + DY, 812 + DY)[..., None]                   # below the old meniscus the reference is used as is
If = synth * (1 - b2) + I * b2

# ---- to RGBA cut-outs: the body itself is the reference's own pixels, the glow around it is un-mixed from the background
m = ss(sd, -0.9, 0.5)[..., None]
# no glow around the body at all: outside it only the floor is kept, cut along the outer ring
ring_zone = 1 - ss(np.sqrt(((xx - 198) / 200.0) ** 2 + ((yy - 968) / 56.0) ** 2), 0.97, 1.03)
# of the floor keep only the thin bright ring lines: a point counts when it is clearly brighter than its surroundings
L0 = I.max(axis=2)
ridge = ss(L0 - cv2.GaussianBlur(L0, (0, 0), 4), 6, 26)
ridge = cv2.GaussianBlur(ridge, (0, 0), 0.6)
# find the outer ring line itself and cut right on its outside edge
guess = np.sqrt(((xx - 198) / 196.0) ** 2 + ((yy - 968) / 55.0) ** 2)
pts = np.argwhere((ridge > 0.5) & (guess > 0.8) & (guess < 1.15) & (sd < -6) & (yy > 925))[:, ::-1].astype(np.float32)
(ecx, ecy), (ew, eh), eang = cv2.fitEllipse(pts)
print('outer ring', round(ecx), round(ecy), round(ew / 2), round(eh / 2), round(eang))
th = np.radians(eang); dx, dy = xx - ecx, yy - ecy
u = (dx * np.cos(th) + dy * np.sin(th)) / (ew / 2); v = (-dx * np.sin(th) + dy * np.cos(th)) / (eh / 2)
plate_r = np.sqrt(u * u + v * v)
edge_px = 2.0 / (eh / 2)                                   # about two pixels past the line, then off
plate_in = 1 - ss(plate_r, 1 + edge_px, 1 + edge_px * 2)
plate_in = plate_in * ss(yy, 912, 922)                     # and nothing above the plate: no haze around the ankles
near = plate_in[..., None]
edge = np.minimum.reduce([ss(xx, 0, 3), ss(W - 1 - xx, 0, 3), ss(H - 1 - yy, 0, 6), ss(yy, 24, 30)])[..., None]
ui = np.clip(1 - np.minimum((xx - 246) / 14, (84 - yy) / 14), 0, 1)[..., None]
near_f = near
def cut(X, near=near):
    d = np.clip(X - bg, 0, 255)
    a = np.clip((d / (256 - bg)).max(axis=2, keepdims=True) * 1.2, 0, 1)
    a = np.where(a < 0.02, 0, a)
    C = np.clip(bg + d / np.maximum(a, 1e-3), 0, 255)
    a = np.where(near > 0, np.clip(a * 1.12, 0, 1) ** 0.9, 0) * near   # the plate's light stays solid, not washed out
    A = m + (1 - m) * a
    col = (X * m + C * (1 - m) * a) / np.maximum(A, 1e-3)
    return np.dstack([np.clip(col, 0, 255), A * edge * ui * 255]).astype(np.uint8)
TOP = 24
empty, full = cut(Ie)[TOP:], cut(If, near_f)[TOP:]

np.save(f'{out}/body_out.npy', body[TOP:])
cv2.imwrite(f'{out}/body-empty.png', empty)
cv2.imwrite(f'{out}/body-water.png', full)

# ---- outline for clipping, and the numbers the app needs
cs, _ = cv2.findContours(body[TOP:].astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
d = ''
for c in cs:
    if cv2.contourArea(c) < 250: continue
    p = cv2.approxPolyDP(c, 0.75, True)[:, 0]
    d += 'M' + 'L'.join(f'{x},{y}' for x, y in p) + 'Z'
rows = np.where(body.any(axis=1))[0]
meta = dict(width=W, height=H - TOP, top=int(rows[0] - TOP), feet=int(rows[-1] - TOP), path=d)
json.dump(meta, open(f'{out}/meta.json', 'w'))
print({k: v for k, v in meta.items() if k != 'path'}, 'path chars', len(d))

# ---- preview on a card-like background, next to the reference
def over(rgba, base):
    a = rgba[..., 3:4].astype(np.float32) / 255
    return rgba[..., :3] * a + base * (1 - a)
hh = H - TOP
g = np.linspace(0, 1, W)[None, :, None] * 0.5 + np.linspace(0, 1, hh)[:, None, None] * 0.5
card = (np.array([43, 61, 15], np.float32) * (1 - g) + np.array([11, 18, 4], np.float32) * g)
tiles = [I[TOP:]]
for share in (0, 0.25, 0.6, 1):
    base = over(empty, card)
    level = int(meta['feet'] - (meta['feet'] - meta['top']) * share)
    f = over(full, card)
    if share > 0: base[level:] = f[level:]
    tiles.append(base)
p = np.hstack(tiles).astype(np.uint8)
cv2.imwrite(f'{out}/pv_a.png', p[:, :W * 3]); cv2.imwrite(f'{out}/pv_b.png', p[:, W * 2:])
cv2.imwrite(f'{out}/pv_legs.png', cv2.resize(p[640:, :W * 3], None, fx=1.5, fy=1.5, interpolation=cv2.INTER_CUBIC))


# ---- sharper on a phone: the reference is a small screenshot, so the pictures are enlarged 1.5x with a
#      high-quality filter and their edges crisped a little. Done on colour-times-alpha so no fringes appear.
UPX = 1.5
def enlarge(img):
    f = img.astype(np.float32); a = f[..., 3:4] / 255
    pm = np.dstack([f[..., :3] * a, f[..., 3:4]])
    big = cv2.resize(pm, None, fx=UPX, fy=UPX, interpolation=cv2.INTER_LANCZOS4)
    soft = cv2.GaussianBlur(big, (0, 0), 1.3)
    big = np.clip(big + (big - soft) * 0.6, 0, 255)
    ab = big[..., 3:4] / 255
    col = np.clip(big[..., :3] / np.maximum(ab, 1e-3), 0, 255)
    return np.dstack([col, big[..., 3:4]]).astype(np.uint8)
cv2.imwrite(f'{out}/body-empty.png', enlarge(empty))
cv2.imwrite(f'{out}/body-water.png', enlarge(full))
bo = cv2.resize(cv2.GaussianBlur(body[TOP:].astype(np.float32), (0, 0), 0.6), None, fx=UPX, fy=UPX, interpolation=cv2.INTER_CUBIC) > 0.5
np.save(f'{out}/body_out.npy', bo)
cs, _ = cv2.findContours(bo.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
d = ''
for c in cs:
    if cv2.contourArea(c) < 250 * UPX * UPX: continue
    d += 'M' + 'L'.join(f'{x},{y}' for x, y in cv2.approxPolyDP(c, 0.9 * UPX, True)[:, 0]) + 'Z'
r2 = np.where(bo.any(axis=1))[0]
meta = dict(width=bo.shape[1], height=bo.shape[0], top=int(r2[0]), feet=int(r2[-1]), path=d)
json.dump(meta, open(f'{out}/meta.json', 'w'))
print('enlarged', {k: v for k, v in meta.items() if k != 'path'})
