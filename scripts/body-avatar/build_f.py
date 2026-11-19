import cv2, numpy as np, sys, json
from scipy import ndimage as ndi
src, out = sys.argv[1], sys.argv[2]
N = cv2.imread(src, cv2.IMREAD_UNCHANGED)[..., :3]
nb = np.load('body_native.npy')
ss = lambda v, a, b: np.clip((v - a) / (b - a), 0, 1)
MALE = 0.539          # the scale at which this figure is as tall as the male one, in the male picture's pixels
SC = 0.8              # the scale it is kept at, so it stays sharp on a phone
k = SC / MALE         # this picture's pixels per male-picture pixel

# ---- take the bubbles out of the water: small specks and rings are painted over from their surroundings.
#      Nothing else is smoothed, so the body's own lines stay crisp.
inner = ndi.binary_erosion(nb, iterations=5)
yn = np.mgrid[0:N.shape[0], 0:N.shape[1]][0]
total = 0
keep = np.zeros_like(nb); keep[690:775, 372:424] = True      # the navel is not a bubble
inner = ndi.binary_erosion(nb, iterations=4) & ~keep
for size, hi, lo, big in ((7, 13, 255, 24), (13, 6, 9, 30), (23, 7, 11, 46), (33, 9, 13, 64)):
    el = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (size, size))
    Vn = cv2.cvtColor(N, cv2.COLOR_BGR2HSV)[..., 2]
    spot = ((cv2.morphologyEx(Vn, cv2.MORPH_TOPHAT, el) > hi) | (cv2.morphologyEx(Vn, cv2.MORPH_BLACKHAT, el) > lo)) & inner
    spot = ndi.binary_dilation(spot, iterations=2)
    lab, n = ndi.label(spot)
    bub = np.zeros_like(spot)
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        legs = sl[0].start > 1180                         # below the knees the bubbles run together into strings
        if max(h, w) <= (big * 1.6 if legs else big) and (legs or min(h, w) >= max(h, w) * 0.3):
            bub[sl] |= lab[sl] == i
    bub = ndi.binary_dilation(bub, iterations=3) & inner
    total += int(ndi.label(bub)[1])
    N = cv2.inpaint(N, bub.astype(np.uint8) * 255, 5, cv2.INPAINT_TELEA)
print('bubbles removed:', total)

# ---- onto the canvas: head at the same place as on the male figure, just with more pixels
rows = np.where(nb.any(1))[0]; cols = np.where(nb.any(0))[0]
W, H = 620, int(round(1090 * k))
small = cv2.resize(N, None, fx=SC, fy=SC, interpolation=cv2.INTER_AREA)
smask = cv2.resize(nb.astype(np.float32), None, fx=SC, fy=SC, interpolation=cv2.INTER_AREA)
ox = int(round(W / 2 - (cols[0] + cols[-1]) / 2 * SC)); oy = int(round(58 * k - rows[0] * SC))
def place(a, border):
    pad = 400
    a = cv2.copyMakeBorder(a, pad, pad, pad, pad, border)
    return a[pad - oy:pad - oy + H, pad - ox:pad - ox + W]
I = place(small, cv2.BORDER_REPLICATE).astype(np.float32)
body = place(smask, cv2.BORDER_CONSTANT) > 0.5
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
FLOOR = oy + 1640 * SC                                   # where the disc begins

# ---- background estimate (worked out small: it is smooth)
q = 0.25
Iq = cv2.resize(I, None, fx=q, fy=q, interpolation=cv2.INTER_AREA); bq = cv2.resize(body.astype(np.uint8), (Iq.shape[1], Iq.shape[0])) > 0
yq = np.mgrid[0:Iq.shape[0], 0:Iq.shape[1]][0] / q
hide = ndi.binary_dilation(bq, iterations=int(60 * k * q)) | (yq > FLOOR - 30 * k)
valid = (~hide).astype(np.float32)
sg = 45 * k * q
num = cv2.GaussianBlur(Iq * valid[..., None], (0, 0), sg); den = cv2.GaussianBlur(valid, (0, 0), sg)[..., None]
fill = num / np.maximum(den, 1e-4)
weak = den[..., 0] < 0.03
ref = int((FLOOR - 45 * k) * q)
fill[weak] = np.broadcast_to(np.median(fill[ref - 6:ref], axis=(0, 1))[None, None], fill.shape)[weak]
fill = cv2.GaussianBlur(fill, (0, 0), 12 * k * q)
soft = cv2.GaussianBlur(valid, (0, 0), 8 * k * q)[..., None]
bg = cv2.resize(Iq * soft + fill * (1 - soft), (W, H), interpolation=cv2.INTER_CUBIC)

# ---- signed distance to the silhouette edge (inside positive), in this picture's pixels
K = 3
big = cv2.resize(cv2.GaussianBlur(body.astype(np.float32), (0, 0), 1.6), None, fx=K, fy=K, interpolation=cv2.INTER_CUBIC) > 0.5
din = cv2.distanceTransform(big.astype(np.uint8), cv2.DIST_L2, 5); dout = cv2.distanceTransform((~big).astype(np.uint8), cv2.DIST_L2, 5)
sd = cv2.resize(np.where(big, din, -dout), (W, H), interpolation=cv2.INTER_AREA) / K

# ---- EMPTY: the same body lit the way the male hologram is. The light across the body (bright rim, dark
#      middle) is the one measured on his legs; the body's own lines are kept by how much brighter or
#      darker each point is than its surroundings.
teal = np.load('../teal.npy'); bgT = np.load('../bgT.npy'); LO = -30
t = (np.clip(sd / k, LO, LO + (len(teal) - 1) / 2) - LO) * 2
i0 = np.floor(t).astype(int); i1 = np.minimum(i0 + 1, len(teal) - 1); w = (t - i0)[..., None]
T = teal[i0] * (1 - w) + teal[i1] * w
# The body's own picture, recoloured: its deep blue becomes the dark teal of the male hologram, and its
# pale highlights and rim become the bright teal-white light. Nothing is redrawn, so every line stays clean.
hsv = cv2.cvtColor(np.clip(I, 0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
pale = ss(250 - hsv[..., 1], 0, 115)                        # how washed out towards white: rims and highlights
lit = ss(hsv[..., 2], 185, 255) ** 2
light = np.clip(pale * 0.95 + lit * 0.22, 0, 1)
face = 0.35 + 0.65 * ss(yy, 176 * k, 200 * k)             # the face stays plain, as on the male figure
light = light * np.where(sd > 4 * k, face, 1)
out_hsv = np.dstack([np.full_like(light, 84), 255 - 150 * pale ** 1.4, 30 + 225 * light])
recol = cv2.cvtColor(np.clip(out_hsv, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)
inside = ss(sd, -0.6, 0.6)[..., None]
e_in = np.clip(recol * 0.9 + T * 0.5, 0, 255)             # plus the soft glow in from the edges
# the feet are almost white in the artwork, which recolours into blotches: draw them as a dark teal foot
# with only the lines between the toes bright
foot = (ss(yy, FLOOR - 40 * k, FLOOR + 6 * k) * ss(sd, 1.5, 4))[..., None]
dim = np.dstack([np.full_like(pale, 84), hsv[..., 1], hsv[..., 2] * (0.30 + 0.5 * pale)])
footcol = cv2.cvtColor(np.clip(dim, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)
e_in = e_in * (1 - foot) + footcol * foot
floor = ss(yy, FLOOR - 4 * k, FLOOR + 12 * k)[..., None]
e_out = (bg + np.clip(T - bgT, 0, 255)) * (1 - floor) + I * floor
Ie = e_in * inside + e_out * (1 - inside)

# ---- to RGBA cut-outs
m = ss(sd, -0.9, 0.5)[..., None]
# no glow around the body at all: outside it only the floor disc is kept, cut along its own outline
def disc(dy):
    r = np.sqrt(((xx - (ox + 397 * SC)) / (362 * SC)) ** 2 + ((yy - (oy + (1757 + dy) * SC)) / (104 * SC)) ** 2)
    return 1 - ss(r, 0.985, 1.015)
zone = np.maximum(disc(0), disc(20))                      # the top of the disc and its front edge
near_e = zone[..., None]
near_w = zone[..., None]
TOP = int(round(24 * k))
edge = np.minimum.reduce([ss(xx, 0, 3), ss(W - 1 - xx, 0, 3), ss(H - 1 - yy, 0, 6), ss(yy, TOP, TOP + 6)])[..., None]
def cut(X, near):
    d = np.clip(X - bg, 0, 255)
    a = np.clip((d / (256 - bg)).max(axis=2, keepdims=True) * 1.2, 0, 1)
    a = np.where(a < 0.02, 0, a)
    C = np.clip(bg + d / np.maximum(a, 1e-3), 0, 255)
    a = a * near * ss(a, 0.06, 0.2)       # and of the floor, only the bright disc and rings, not the haze around them
    A = m + (1 - m) * a
    col = (X * m + C * (1 - m) * a) / np.maximum(A, 1e-3)
    return np.dstack([np.clip(col, 0, 255), A * edge * 255]).astype(np.uint8)
empty, full = cut(Ie, near_e)[TOP:], cut(I, near_w)[TOP:]
np.save(f'{out}/body_out.npy', body[TOP:])
cv2.imwrite(f'{out}/body-female-empty.png', empty, [cv2.IMWRITE_PNG_COMPRESSION, 9]); cv2.imwrite(f'{out}/body-female-water.png', full, [cv2.IMWRITE_PNG_COMPRESSION, 9])

cs, _ = cv2.findContours(body[TOP:].astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
d = ''
for c in cs:
    if cv2.contourArea(c) < 250: continue
    d += 'M' + 'L'.join(f'{x},{y}' for x, y in cv2.approxPolyDP(c, 0.9 * k, True)[:, 0]) + 'Z'
r = np.where(body.any(axis=1))[0]
meta = dict(width=W, height=H - TOP, top=int(r[0] - TOP), feet=int(r[-1] - TOP), path=d)
json.dump(meta, open(f'{out}/meta.json', 'w')); print({a: b for a, b in meta.items() if a != 'path'}, len(d))

def over(rgba, base):
    a = rgba[..., 3:4].astype(np.float32) / 255
    return rgba[..., :3] * a + base * (1 - a)
card = np.zeros((H - TOP, W, 3), np.float32)
tiles = []
for share in (0, 0.3, 0.65, 1):
    base = over(empty, card); f = over(full, card)
    level = int(meta['feet'] - (meta['feet'] - meta['top']) * share)
    if share > 0: base[level:] = f[level:]
    tiles.append(base)
p = np.hstack(tiles).astype(np.uint8)
cv2.imwrite(f'{out}/pv.png', cv2.resize(p, None, fx=0.62, fy=0.62, interpolation=cv2.INTER_AREA))
cv2.imwrite(f'{out}/pv_top.png', np.hstack([tiles[0][60:780], tiles[3][60:780]]).astype(np.uint8))
cv2.imwrite(f'{out}/pv_leg.png', np.hstack([tiles[0][880:1560], tiles[3][880:1560]]).astype(np.uint8))
