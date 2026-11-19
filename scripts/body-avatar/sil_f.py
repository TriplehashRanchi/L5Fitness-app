import cv2, numpy as np, sys
from scipy import ndimage as ndi
im = cv2.imread(sys.argv[1], cv2.IMREAD_UNCHANGED)[..., :3]
H, W = im.shape[:2]
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV).astype(np.int32)
V, Sat = hsv[..., 2], hsv[..., 1]
yy, xx = np.mgrid[0:H, 0:W]
FLOOR = 1640                                   # the disc starts here; below it the feet are told apart by being paler
body = (yy < FLOOR) & (V > 226)        # the bright rim, not the glow just outside it
feet = (yy >= FLOOR - 6) & (V > 205) & (Sat < 236) & (xx > 180) & (xx < 615) & (yy < 1790)
feet = ndi.binary_opening(feet, iterations=2)
feet = ndi.binary_closing(feet, iterations=7)
feet = ndi.binary_fill_holes(feet)
body = ndi.binary_fill_holes(ndi.binary_closing(body | feet, iterations=4))
body = ndi.binary_opening(body, iterations=3)
body = np.where(yy > FLOOR + 60, ndi.binary_opening(body, iterations=8), body)      # drops the thin reflections under the toes
lab, n = ndi.label(body)
sizes = ndi.sum(body, lab, range(1, n + 1))
print('components', sorted(sizes.astype(int))[::-1][:5])
body = lab == (np.argmax(sizes) + 1)
body[1766:] = False        # below the toes there is only their reflection on the disc
np.save('body_native.npy', body)
rows = np.where(body.any(1))[0]; cols = np.where(body.any(0))[0]
print('rows', rows[0], rows[-1], 'cols', cols[0], cols[-1])
vis = im.copy(); vis[~body] = (vis[~body] * 0.3).astype(np.uint8)
vis[body ^ ndi.binary_erosion(body, iterations=2)] = (0, 0, 255)
cv2.imwrite('sil_all.png', cv2.resize(vis, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA))
cv2.imwrite('sil_feet.png', vis[1500:1850]); cv2.imwrite('sil_neck.png', vis[40:520, 150:650])
