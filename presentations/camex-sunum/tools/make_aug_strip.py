"""Slide 7 images: the two augmentations used in the pipeline and the ones kept for a retest.

All images come from assets/figures/pc12_preprocessed.png (the slide-5 image after preprocessing).
The augmented crops are made with the project's own ops (ml/experiments/arms.py, ml/augment/ops),
forced on at a visible setting; no label outlines are drawn.
Writes: aug_card_crops.png, aug_card_dihedral.png, aug_retest_strip.png (assets/figures).
"""
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

FIG = Path(__file__).resolve().parents[1] / "assets" / "figures"

# 1. random crops: crop windows on the preprocessed image (2 on bright structures, 1 anywhere)
g = np.asarray(Image.open(FIG / "pc12_preprocessed.png").convert("L")).astype(np.float32) / 255
H, W = g.shape
S = 150                                           # drawn window size (illustration only)
sm = ndi.uniform_filter(g, 25)
img = Image.fromarray((g * 255).astype(np.uint8)).convert("RGB")
d = ImageDraw.Draw(img)
taken = []
for _ in range(2):
    m = sm.copy()
    for (y, x) in taken:
        m[max(0, y - S):y + S, max(0, x - S):x + S] = 0
    y, x = np.unravel_index(np.argmax(m), m.shape)
    taken.append((y, x))
    x0, y0 = int(np.clip(x - S // 2, 0, W - S)), int(np.clip(y - S // 2, 0, H - S))
    d.rectangle([x0, y0, x0 + S, y0 + S], outline=(74, 222, 128), width=4)
d.rectangle([W - S - 20, 15, W - 20, 15 + S], outline=(250, 204, 21), width=4)   # "anywhere" window
img.save(FIG / "aug_card_crops.png")

# clean training crop (no label outlines) from the preprocessed image, centred on bright structures
T = 256
cy, cx = np.unravel_index(np.argmax(ndi.uniform_filter(g, 60)), g.shape)
y0, x0 = int(np.clip(cy - T // 2, 0, H - T)), int(np.clip(cx - T // 2, 0, W - T))
crop = g[y0:y0 + T, x0:x0 + T]
to_rgb = lambda c: np.repeat((np.clip(c, 0, 1) * 255).astype(np.uint8)[..., None], 3, axis=2)

# 2. 8 rotations & flips of the crop
o = to_rgb(crop)
views = [np.rot90(o, k) if f == 0 else np.fliplr(np.rot90(o, k)) for f in (0, 1) for k in range(4)]
pad = 8
cell = o.shape[0]
canvas = np.full((2 * cell + pad, 4 * cell + 3 * pad, 3), 255, np.uint8)
for i, v in enumerate(views):
    r, c = divmod(i, 4)
    canvas[r * (cell + pad):r * (cell + pad) + cell, c * (cell + pad):c * (cell + pad) + cell] = v
Image.fromarray(canvas).save(FIG / "aug_card_dihedral.png")

# 3. augmentations kept for a retest: the real ops of ml/experiments/arms.py and ml/augment/ops,
#    forced on (p = 1) at a clearly visible setting from their tested range
import sys
sys.path.insert(0, r"N:/gozde/academic/year 4/ENG/pc12-arch-github")
from ml.experiments import arms as A
from ml.augment.ops.noise import noise

z = np.zeros_like(crop, bool)
rng = lambda: np.random.default_rng(0)
out = [
    ("Original", crop),
    ("Exposure", A._aug_exposure_quant(crop, z, z, z, rng(), gain=(0.5, 0.5), p=1)[0]),
    ("JPEG", A._aug_jpeg(crop, z, z, z, rng(), quality=(60, 61), p=1)[0]),
    ("Defocus", ndi.gaussian_filter(crop, 1.5)),                       # = _aug_defocus at sigma_max
    ("Mild noise", noise(crop, z, z, z, rng(), photons=(150, 150), read_sigma=(0.015, 0.015), p=1)[0]),
    ("Strong noise", noise(crop, z, z, z, rng(), photons=(30, 30), read_sigma=(0.03, 0.03), p=1)[0]),
    ("Scale jitter", A._resize_crop(crop, 1.2, 1, T)),                 # = _aug_scale_jitter at +20 %
]
plt.rcParams.update({"font.family": "DejaVu Sans", "savefig.facecolor": "white", "figure.facecolor": "white"})
fig, axes = plt.subplots(1, len(out), figsize=(16, 2.6))
for ax, (title, im) in zip(axes, out):
    ax.imshow(np.clip(im, 0, 1), cmap="gray", vmin=0, vmax=1); ax.axis("off"); ax.set_title(title, fontsize=16, pad=6)
fig.subplots_adjust(left=0.003, right=0.997, top=0.86, bottom=0.01, wspace=0.05)
fig.savefig(FIG / "aug_retest_strip.png", dpi=150, bbox_inches="tight", pad_inches=0.03)
for n in ("aug_card_crops.png", "aug_card_dihedral.png", "aug_retest_strip.png"):
    print(n, Image.open(FIG / n).size)
