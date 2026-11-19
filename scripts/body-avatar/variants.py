"""Thin / overweight / obese versions of a body: the waist, belly, hips, thighs, arms and neck get wider or
narrower by different amounts; the head and the floor plate stay as they are."""
import cv2, numpy as np, sys, json
from scipy import ndimage as ndi
src, prefix, out = sys.argv[1], sys.argv[2], sys.argv[3]
meta = json.load(open(f'{src}/meta.json'))
body0 = np.load(f'{src}/body_out.npy')
imgs0 = {n: cv2.imread(f'{src}/{prefix}-{n}.png', cv2.IMREAD_UNCHANGED) for n in ('empty', 'water')}
H, W = body0.shape
TOPY, FEET = meta['top'], meta['feet']
U = (FEET - TOPY) / 926.0                    # pixels per pixel of the male artwork
PAD = int(round(70 * U))                     # room for wider arms
ss = lambda v, a, b: np.clip((v - a) / (b - a), 0, 1)

# how wide each part becomes, at heights given as a share of head-to-sole
#           head  chin  neck  shldr chest ribs  waist belly hips  crotch thigh knee  calf  ankle
FR =      [0.0,  0.13, 0.16, 0.21, 0.27, 0.34, 0.41, 0.46, 0.52, 0.575, 0.65, 0.78, 0.85, 0.93, 1.0]
BUILDS = {
    'thin':  dict(t=[1.0, 1.0, 0.90, 0.95, 0.90, 0.88, 0.87, 0.86, 0.88, 0.88, 0.86, 0.90, 0.88, 0.95, 1.0], arm=0.84, soft=0.0),
    'heavy': dict(t=[1.0, 1.0, 1.12, 1.05, 1.10, 1.18, 1.27, 1.30, 1.20, 1.18, 1.20, 1.10, 1.10, 1.03, 1.0], arm=1.20, soft=0.45),
    'obese': dict(t=[1.0, 1.0, 1.26, 1.10, 1.22, 1.38, 1.52, 1.56, 1.44, 1.40, 1.40, 1.20, 1.16, 1.05, 1.0], arm=1.34, soft=1.0),
}
if 'female' in prefix:      # her hips are already wide in the artwork: they grow less, the waist and belly more
    # her landmarks sit higher than his: waist at 0.37, widest hip at 0.48, crotch at 0.51 of head-to-sole
    FR = [0.0, 0.12, 0.15, 0.19, 0.25, 0.31, 0.37, 0.42, 0.48, 0.515, 0.60, 0.76, 0.84, 0.93, 1.0]
    #                      head  chin  neck  shldr chest ribs  waist belly hips  crotch thigh knee  calf  ankle
    BUILDS['heavy']['t'] = [1.0, 1.0, 1.10, 1.04, 1.12, 1.24, 1.34, 1.30, 1.14, 1.12, 1.13, 1.08, 1.08, 1.03, 1.0]
    BUILDS['obese']['t'] = [1.0, 1.0, 1.22, 1.08, 1.24, 1.48, 1.62, 1.52, 1.30, 1.27, 1.27, 1.16, 1.13, 1.05, 1.0]
# how far from the centre line a separate run must be to count as an arm, and how long the hand is, as shares of head-to-sole
ARM_FROM, HAND = 0.11, 0.10
cx = W / 2.0

def field(b):
    rows = np.arange(H, dtype=np.float32)
    f = (rows - TOPY) / (FEET - TOPY)
    span = FEET - TOPY
    s = ndi.gaussian_filter1d(np.interp(f, FR, b['t']), 0.022 * span).astype(np.float32)

    # pass 1: what is torso and what is arm on each row, and how far the torso's sides move
    parts = []                                     # (y, a, c, kind, side)
    edge = {1: np.zeros(H, np.float32), -1: np.zeros(H, np.float32)}
    last = {1: 0.0, -1: 0.0}
    arm_end = {1: 0, -1: 0}
    torso_w = {1: np.zeros(H, np.float32), -1: np.zeros(H, np.float32)}      # torso half-width on each side
    arm_in = {1: np.full(H, np.nan, np.float32), -1: np.full(H, np.nan, np.float32)}   # arm's inner edge, from the centre
    arm_hw = {1: np.zeros(H, np.float32), -1: np.zeros(H, np.float32)}
    tw = {1: 0.0, -1: 0.0}
    for y in range(H):
        xs = np.where(body0[y])[0]
        if len(xs):
            for r in np.split(xs, np.where(np.diff(xs) > 1)[0] + 1):
                a, c = int(r[0]), int(r[-1]); mid = (a + c) / 2; side = 1 if mid > cx else -1
                if a <= cx <= c:
                    parts.append((y, a, c, 'torso', 0))
                    tw[1] = c - cx; tw[-1] = cx - a
                    last[1] = (s[y] - 1) * (c - cx); last[-1] = (s[y] - 1) * (a - cx)
                elif f[y] < 0.64 and abs(mid - cx) > ARM_FROM * span:
                    parts.append((y, a, c, 'arm', side)); arm_end[side] = y
                    inner = (a - cx) if side > 0 else (cx - c)
                    if np.isnan(arm_in[side][y]) or inner < arm_in[side][y]: arm_in[side][y] = inner; arm_hw[side][y] = (c - a) / 2
                else:
                    parts.append((y, a, c, 'leg', side))
        edge[1][y] = last[1]; edge[-1][y] = last[-1]
        torso_w[1][y] = tw[1]; torso_w[-1][y] = tw[-1]

    # the arm moves out as one smooth limb: by the most the torso beside it widens, never following its bumps
    arm_shift = {}
    arm_start = {1: 0, -1: 0}
    for side in (1, -1):
        if b['arm'] >= 1:
            # only as far as needed to stay clear of the wider body, keeping a small gap
            gap0 = arm_in[side] - torso_w[side]
            need = torso_w[side] * s + np.minimum(gap0, 0.012 * span) + (b['arm'] - 1) * arm_hw[side] - arm_in[side]
            need = np.where(np.isnan(need), np.abs(edge[side]), np.maximum(need, 0))
            first = np.where(~np.isnan(arm_in[side]))[0]
            if len(first): need[:first[0]] = np.abs(edge[side][:first[0]])     # above the armpit the arm is part of the torso
            # the arm swings out from the shoulder as one straight limb: the shift grows evenly down its length,
            # by just enough to clear the body everywhere. No bends, so the elbow and forearm keep their shape.
            sh = np.abs(edge[side]).copy()
            if len(first):
                y0 = int(first[0])
                top = float((s[y0] - 1) * (arm_in[side][y0] + arm_hw[side][y0]))      # at the armpit the arm moves as the shoulder does
                L = arm_end[side] - y0
                ys = np.arange(y0 + int(0.3 * L), arm_end[side] + 1)                   # near the armpit arm and body join anyway
                slope = max(0.0, float(np.max((need[ys] - top) / (ys - y0)))) if len(ys) else 0.0
                yr = np.arange(y0, H)
                sh[y0:] = top + slope * (yr - y0)
                arm_start[side] = y0
            arm_shift[side] = side * ndi.gaussian_filter1d(sh, 6 * U)
        else:
            m = ndi.maximum_filter1d(np.abs(edge[side]), size=int(150 * U))
            arm_shift[side] = -side * ndi.gaussian_filter1d(m, 26 * U)
    hand_len = HAND * span
    wrist = {sd_: arm_end[sd_] - hand_len for sd_ in (1, -1)}

    D = np.zeros((H, W), np.float32); known = np.zeros((H, W), np.float32)
    for y, a, c, kind, side in parts:
        x = np.arange(a, c + 1, dtype=np.float32); mid = (a + c) / 2
        if kind == 'torso':                                    # head, neck, torso, hips: widened about the centre
            d = (s[y] - 1) * (x - cx)
        elif kind == 'arm':
            w = wrist[side]
            if y >= w:                                         # the hand: moved as one piece, fingers untouched
                d = np.full_like(x, arm_shift[side][y])
            else:                                              # the arm: thickest at the top, tapering evenly to its own width at the wrist
                thick = 1 + ((s[arm_start[side]] - 1) * (1 - ss(y, arm_start[side], arm_start[side] + 0.06 * span)) + (b['arm'] - 1) * ss(y, arm_start[side], arm_start[side] + 0.06 * span)) * (1 - ss(y, arm_start[side] + 0.08 * span, w)) if b['arm'] >= 1 else 1 + (b['arm'] - 1) * (1 - ss(y, w - 0.10 * span, w))
                d = arm_shift[side][y] + (thick - 1) * (x - mid)
        else:                                                  # a leg: thicker about its own middle, following the hips
            kk = 1 - 0.45 * ss(f[y], FR[9], FR[9] + 0.12)        # at the crotch the legs move exactly as the hips do
            d = (s[y] - 1) * (x - mid) + (s[y] - 1) * (mid - cx) * kk
        D[y, a:c + 1] = d; known[y, a:c + 1] = 1
    sg = 9 * U
    num = cv2.GaussianBlur(D * known, (0, 0), sg); den = cv2.GaussianBlur(known, (0, 0), sg)
    near = num / np.maximum(den, 1e-3)
    num2 = cv2.GaussianBlur(D * known, (0, 0), 40 * U); den2 = cv2.GaussianBlur(known, (0, 0), 40 * U)
    far = num2 / np.maximum(den2, 1e-4)
    w = np.clip(den * 8, 0, 1)
    # each part keeps its own movement; only the background between parts is blended,
    # so the arms moving out does not drag the hips next to them
    lab = np.zeros((H, W), np.int32)
    Draw = D.copy()
    D = np.where(known > 0, D, near * w + far * (1 - w))
    smooth = cv2.GaussianBlur(D, (0, 0), 3.5 * U)
    own = cv2.GaussianBlur(Draw * known, (0, 0), 1.6 * U) / np.maximum(cv2.GaussianBlur(known, (0, 0), 1.6 * U), 1e-3)
    inner = cv2.GaussianBlur(ndi.binary_erosion(known > 0, iterations=max(1, int(2 * U))).astype(np.float32), (0, 0), 1.2 * U)
    D = own * inner + smooth * (1 - inner)
    yy = np.mgrid[0:H, 0:W][0].astype(np.float32)
    D *= (1 - ss(yy, FEET - 34 * U, FEET - 6 * U))             # the feet and the plate stay where they are
    return D

def apply(img, D):
    img = cv2.copyMakeBorder(img, 0, 0, PAD, PAD, cv2.BORDER_CONSTANT, value=0)
    Dp = cv2.copyMakeBorder(D, 0, 0, PAD, PAD, cv2.BORDER_REPLICATE)
    Wp = W + 2 * PAD
    yy, xx = np.mgrid[0:H, 0:Wp].astype(np.float32)
    xs = np.arange(Wp, dtype=np.float32)
    mx = np.empty((H, Wp), np.float32)
    for y in range(H):
        fwd = np.maximum.accumulate(xs + Dp[y])        # where each source column lands; kept in order
        mx[y] = np.interp(xs, fwd, xs)
    interp = cv2.INTER_LINEAR if img.dtype == np.float32 else cv2.INTER_CUBIC
    return cv2.remap(img, mx, yy, interp, borderMode=cv2.BORDER_CONSTANT, borderValue=0)

summary = {}
for name, b in BUILDS.items():
    D = field(b)
    bodyw = apply(body0.astype(np.float32), D) > 0.5
    soft = None
    if b['soft'] > 0:                                          # less muscle definition across the torso
        yy = np.mgrid[0:H, 0:W + 2 * PAD][0].astype(np.float32)
        f = (yy - TOPY) / (FEET - TOPY)
        Hh, Ww = bodyw.shape
        torso = np.zeros_like(bodyw); half = np.zeros(Hh, np.float32)
        wmap = np.zeros((Hh, Ww), np.float32)                      # how much each part is smoothed
        cxp = Ww / 2.0
        span_ = FEET - TOPY
        col_c = body0[:, int(cx)]; below = np.where(~col_c & (np.arange(H) > TOPY + 0.4 * span_))[0]
        crotch = (below[0] - TOPY) / span_ if len(below) else FR[9]      # where the legs part
        full = b['soft'] >= 0.9
        for y in range(Hh):
            fy = f[y, 0]
            if not (FR[3] < fy < 0.78): continue
            xs = np.where(bodyw[y])[0]
            if len(xs) == 0: continue
            for r in np.split(xs, np.where(np.diff(xs) > 1)[0] + 1):
                mid = (r[0] + r[-1]) / 2
                if r[0] <= cxp <= r[-1]:                                   # torso
                    torso[y, r[0]:r[-1] + 1] = True; half[y] = max(half[y], r[-1] - cxp, cxp - r[0])
                    wmap[y, r[0]:r[-1] + 1] = 0.55 + 0.45 * ss(fy, FR[4], FR[5])   # the chest keeps some of its shape
                elif fy > crotch - 0.01 and abs(mid - cxp) < 0.115 * span_:   # thighs, fading out towards the knees
                    if fy < crotch + 0.03: half[y] = max(half[y], r[-1] - cxp, cxp - r[0])
                    if full: wmap[y, r[0]:r[-1] + 1] = 0.8 * (1 - ss(fy, 0.66, 0.78))
                elif full and fy < crotch - 0.04:                          # arms, not the hands
                    wmap[y, r[0]:r[-1] + 1] = 0.65 * (1 - ss(fy, crotch - 0.10, crotch - 0.04))
        inner = ndi.binary_erosion(bodyw, iterations=int(6 * U)).astype(np.float32)
        zone = cv2.GaussianBlur(wmap * inner, (0, 0), 4 * U)
        soft = (zone * b['soft'])[..., None]
        # a soft fold under the belly and a navel, in place of the muscle lines
        marks = np.zeros((Hh, Ww), np.float32)
        if b['soft'] >= 0.9:
            y0 = TOPY + (crotch - 0.055) * span_; hw = half[int(y0)] * 0.66
            u = np.linspace(-1, 1, 80)
            pts = np.stack([cxp + u * hw, y0 + 0.016 * span_ * (1 - u * u)], 1)
            for i in range(len(u) - 1):
                cv2.line(marks, tuple(int(q) for q in pts[i]), tuple(int(q) for q in pts[i + 1]), float(0.55 * (1 - abs(u[i]) ** 2.5)), max(1, int(1.6 * U)), cv2.LINE_AA)
            cv2.ellipse(marks, (int(cxp), int(TOPY + (crotch - 0.12) * span_)), (int(2.2 * U), int(5 * U)), 0, 0, 360, 0.6, -1, cv2.LINE_AA)
            marks = cv2.GaussianBlur(marks, (0, 0), 1.3 * U)
    for n, im in imgs0.items():
        o = apply(im, D)
        if soft is not None:
            # smoothed using only the body's own pixels, so nothing from outside the edge bleeds in
            am = (o[..., 3:4].astype(np.float32) / 255) * ndi.binary_erosion(bodyw, iterations=max(1, int(2 * U)))[..., None]
            sg = (2.2 + 9 * b['soft']) * U
            sm = cv2.GaussianBlur(o[..., :3].astype(np.float32) * am, (0, 0), sg) / np.maximum(cv2.GaussianBlur(am, (0, 0), sg)[..., None] if am.ndim == 2 else cv2.GaussianBlur(am[..., 0], (0, 0), sg)[..., None], 1e-3)
            col = o[..., :3] * (1 - soft) + sm * soft
            if n == 'water': col = col * (1 - marks[..., None] * 0.30)                      # a shadow line in the water
            else: col = col + (np.array([214, 255, 150], np.float32) - col) * marks[..., None] * 0.55   # a light line on the empty body
            o[..., :3] = np.clip(col, 0, 255).astype(np.uint8)
        cv2.imwrite(f'{out}/{prefix}-{name}-{n}.png', o, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    cs, _ = cv2.findContours(bodyw.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    d = ''
    for c in cs:
        if cv2.contourArea(c) < 250 * U * U: continue
        d += 'M' + 'L'.join(f'{x},{y}' for x, y in cv2.approxPolyDP(c, 0.9 * U, True)[:, 0]) + 'Z'
    summary[name] = dict(width=W + 2 * PAD, height=H, top=TOPY, feet=FEET, path=d)
json.dump(summary, open(f'{out}/{prefix}-variants.json', 'w'))
print({k: (v['width'], v['height']) for k, v in summary.items()})
