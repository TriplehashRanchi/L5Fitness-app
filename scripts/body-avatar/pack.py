"""Turns the generated pictures into the app's assets: body-{sex}-{build}-{empty|water}.webp in assets/images,
and their measurements and outlines in src/components/body-avatar-outline.ts.
Run from the male working folder (the one with out/, f2/out/ and var/), with the app folder as the argument."""
import cv2, numpy as np, json, sys
A = sys.argv[1]
def mask_from_path(meta):
    m = np.zeros((meta['height'], meta['width']), np.uint8)
    for part in meta['path'].split('Z'):
        if not part: continue
        pts = np.array([[float(v) for v in p.split(',')] for p in part.lstrip('M').split('L')], np.int32)
        cv2.fillPoly(m, [pts], 1)
    return m > 0
def span(mask):
    xs = np.where(mask.any(0))[0]; return int(xs[-1] - xs[0] + 1)
out = {}
for sex, src, prefix in (('male', 'out', 'body'), ('female', 'f2/out', 'body-female')):
    base = json.load(open(f'{src}/meta.json'))
    var = json.load(open(f'var/{prefix}-variants.json'))
    builds = {'thin': var['thin'], 'normal': base, 'heavy': var['heavy'], 'obese': var['obese']}
    out[sex] = {}
    for b, meta in builds.items():
        for n in ('empty', 'water'):
            p = f'{src}/{prefix}-{n}.png' if b == 'normal' else f'var/{prefix}-{b}-{n}.png'
            cv2.imwrite(f'{A}/assets/images/body-{sex}-{b}-{n}.webp', cv2.imread(p, cv2.IMREAD_UNCHANGED), [cv2.IMWRITE_WEBP_QUALITY, 95])
        out[sex][b] = dict(meta, span=span(mask_from_path(meta)))
def block(x, ind):
    i = ' ' * ind
    return (f"{{\n{i}  width: {x['width']},\n{i}  height: {x['height']},\n{i}  top: {x['top']},\n{i}  feet: {x['feet']},\n"
            f"{i}  span: {x['span']},\n{i}  outline:\n{i}    '{x['path']}',\n{i}}}")
body = ''.join(f"  {sex}: {{\n" + ''.join(f"    {b}: {block(out[sex][b], 4)},\n" for b in ('thin', 'normal', 'heavy', 'obese')) + "  },\n" for sex in ('male', 'female'))
open(f'{A}/src/components/body-avatar-outline.ts', 'w').write(
"""/**
 * The bodies in assets/images/body-{sex}-{build}-{empty|water}.webp, measured in each picture's own pixels:
 * width and height of the picture, top of the head, soles of the feet, how wide the body itself is (span),
 * and its outline (used to keep the water surface inside the body).
 * Generated from the artwork by scripts/body-avatar: if the pictures are replaced, these must be too.
 */
export const BODY_ART = {
""" + body + "} as const;\n")
