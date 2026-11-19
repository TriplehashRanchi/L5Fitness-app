"""Lifts the bust a little for a fitter look: a smooth upward nudge centred on the chest, fading out around it."""
import cv2, numpy as np, sys
im = cv2.imread(sys.argv[1], cv2.IMREAD_UNCHANGED)[..., :3]
H, W = im.shape[:2]
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
CX, CY, UP = 397.0, 528.0, float(sys.argv[3]) if len(sys.argv) > 3 else 20.0
g = np.exp(-((xx - CX) / 125) ** 2 - ((yy - CY) / 62) ** 2)
my = yy + UP * g                      # each point takes what was a little below it
for _ in range(3):                    # refine so the lift is exactly UP at the centre
    my = yy + UP * np.exp(-((xx - CX) / 125) ** 2 - ((my - CY) / 62) ** 2)
out = cv2.remap(im, xx, my, cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
cv2.imwrite(sys.argv[2], out)
cv2.imwrite('lift_vis.png', np.hstack([im[330:760, 150:650], out[330:760, 150:650]]))
