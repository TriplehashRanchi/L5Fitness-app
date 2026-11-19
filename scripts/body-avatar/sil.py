import cv2, numpy as np, sys
from scipy import ndimage as ndi
src = sys.argv[1]
im = cv2.imread(src, cv2.IMREAD_UNCHANGED)[...,:3]
H, W = im.shape[:2]
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV).astype(np.int32)
V, Sat = hsv[...,2], hsv[...,1]
yy, xx = np.mgrid[0:H, 0:W]
WATER_Y = 776
bright = np.zeros((H, W), bool)
a = yy < WATER_Y
bright |= a & (V > 150)
b = (yy >= WATER_Y) & (yy < 930)
bright |= b & (V > 165) & (Sat < 235)
c = yy >= 930
bright |= c & (V > 200) & (Sat < 200)
bright[:80, 262:] = False           # bell and profile photo
bright = ndi.binary_closing(bright, iterations=2)
body = ndi.binary_fill_holes(bright)
body = ndi.binary_opening(body, iterations=2)
lab, n = ndi.label(body)
sizes = ndi.sum(body, lab, range(1, n + 1))
keep = np.argsort(sizes)[::-1][:3]   # body and two hands if separate
print('components', sorted(sizes.astype(int))[::-1][:6])
body = np.isin(lab, [k + 1 for k in keep if sizes[k] > 600])
if len(sys.argv) > 2:      # hair bun: centre x, centre y, radius
    bx, by, br = map(float, sys.argv[2:5])
    head = body.copy()
    body = body | ((xx - bx) ** 2 + ((yy - by) * 1.08) ** 2 < br ** 2)
    np.save('bun.npy', body & ~head)
np.save('body.npy', body)
vis = im.copy(); vis[~body] = (vis[~body] * 0.35).astype(np.uint8)
edge = body ^ ndi.binary_erosion(body)
vis[edge] = (0, 0, 255)
cv2.imwrite('sil_vis.png', cv2.resize(vis, None, fx=1.3, fy=1.3))
cv2.imwrite('sil_top.png', cv2.resize(vis[30:540], None, fx=2, fy=2))
cv2.imwrite('sil_bot.png', cv2.resize(vis[520:1036], None, fx=2, fy=2))
