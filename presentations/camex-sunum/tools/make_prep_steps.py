"""Slide 5 data: the three preprocessing steps of ml/final_pipeline.py on the slide-3 image.

Writes three equally sized thumbnails of one region (one per step) and prep_hist.json with the
intensity histograms after each step, so the deck can animate what each step does.
The steps are copied from final_pipeline.py (load_gray, preprocess) and must stay identical:
  1. g = max(R, G, B) / 255                      (native grid)
  2. g = ndi.zoom(g, 0.33, order=1)              (bilinear sampling)
  3. a, b = percentile(g, [1, 99.8]); g = clip((g - a) / (b - a), 0, 1)
"""
from pathlib import Path
import json

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parents[1]
FIG = ROOT / "assets" / "figures"
SCALE, LO, HI = 0.33, 1.0, 99.8
BINS = 64
CROP = 210          # native pixels; ≈ 69 px after × 0.33 (coarser pixels visible)
THUMB = 220         # display size of every thumbnail

rgb = np.asarray(Image.open(FIG / "pc12.png").convert("RGB"))
s1 = rgb.max(axis=2).astype(np.float32) / 255.0
s2 = ndi.zoom(s1, SCALE, order=1)
a, b = np.percentile(s2, [LO, HI])
s3 = np.clip((s2 - a) / max(b - a, 1e-6), 0, 1).astype(np.float32)

# region: the CROP × CROP native window with the most bright pixels (neurites + somata)
fg = (s1 > np.percentile(s1, 99)).astype(np.float32)
ii = fg.cumsum(0).cumsum(1)
best, by, bx = -1, 0, 0
for y in range(0, s1.shape[0] - CROP, 30):
    for x in range(0, s1.shape[1] - CROP, 30):
        v = ii[y + CROP - 1, x + CROP - 1] - (ii[y - 1, x + CROP - 1] if y else 0) \
            - (ii[y + CROP - 1, x - 1] if x else 0) + (ii[y - 1, x - 1] if x and y else 0)
        if v > best:
            best, by, bx = v, y, x


def save(arr, name, nearest):
    im = Image.fromarray((np.clip(arr, 0, 1) * 255).round().astype(np.uint8))
    im.resize((THUMB, THUMB), Image.NEAREST if nearest else Image.BILINEAR).save(FIG / name)


save(s1[by:by + CROP, bx:bx + CROP], "prep_s1_gray.png", nearest=False)
ys, xs = int(round(by * SCALE)), int(round(bx * SCALE))
cs = int(round(CROP * SCALE))
save(s2[ys:ys + cs, xs:xs + cs], "prep_s2_down.png", nearest=True)
save(s3[ys:ys + cs, xs:xs + cs], "prep_s3_norm.png", nearest=True)

edges = np.linspace(0, 1, BINS + 1)
hist = lambda g: np.histogram(g, bins=edges)[0].astype(int).tolist()
out = {
    "bins": BINS,
    "s1": hist(s1), "s2": hist(s2), "s3": hist(s3),
    "n1": int(s1.size), "n2": int(s2.size),
    "p_lo": round(float(a), 4), "p_hi": round(float(b), 4),
    "max1": round(float(s1.max()), 4),
    "max2": round(float(s2.max()), 4),
    "clipped_hi_pct": round(float((s2 > b).mean() * 100), 2),
    "crop_native": [int(bx), int(by), CROP],
}
(FIG / "prep_hist.json").write_text(json.dumps(out), encoding="utf-8")
print({k: v for k, v in out.items() if not isinstance(v, list) or k == "crop_native"})
