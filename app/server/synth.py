"""Procedural fake fluorescence-microscopy image generator for PC12 neural cells.

Produces images that mimic real PC12 neurite-outgrowth micrographs (almost-black
background with a faint green haze, bright round somas, thin dim branching
neurites, tiny debris, vignetting and sensor noise) without touching any real
data. Used as committed test fixtures / a demo dataset when the private
microscopy dataset is not available.

Only depends on numpy, scipy (scipy.ndimage), scikit-image (skimage.draw) and
Pillow. Deterministic given a seed via ``np.random.default_rng``.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage
from skimage.draw import line_aa


def _stamp_gaussian_blob(layer: np.ndarray, cx: float, cy: float, radius: float, brightness: float) -> None:
    """Add a soft round gaussian blob (a soma or a debris speck) into ``layer``."""
    h, w = layer.shape
    pad = max(2, int(radius * 4))
    x0, x1 = int(cx - pad), int(cx + pad)
    y0, y1 = int(cy - pad), int(cy + pad)
    cx0, cx1 = max(0, x0), min(w, x1)
    cy0, cy1 = max(0, y0), min(h, y1)
    if cx0 >= cx1 or cy0 >= cy1:
        return
    ys, xs = np.mgrid[cy0:cy1, cx0:cx1]
    dist2 = (xs - cx) ** 2 + (ys - cy) ** 2
    sigma2 = max(radius, 0.5) ** 2
    blob = brightness * np.exp(-dist2 / (2.0 * sigma2))
    layer[cy0:cy1, cx0:cx1] = np.maximum(layer[cy0:cy1, cx0:cx1], blob)


def _draw_thick_line(layer: np.ndarray, x0: float, y0: float, x1: float, y1: float,
                      width_px: float, brightness: float) -> None:
    """Rasterize a dim anti-aliased line, optionally thickened with parallel offsets."""
    h, w = layer.shape

    def _one(ax0, ay0, ax1, ay1):
        ax0i, ay0i = int(round(ax0)), int(round(ay0))
        ax1i, ay1i = int(round(ax1)), int(round(ay1))
        if ax0i == ax1i and ay0i == ay1i:
            return
        try:
            rr, cc, val = line_aa(ay0i, ax0i, ay1i, ax1i)
        except Exception:
            return
        mask = (rr >= 0) & (rr < h) & (cc >= 0) & (cc < w)
        rr, cc, val = rr[mask], cc[mask], val[mask]
        if rr.size == 0:
            return
        contrib = val * brightness
        layer[rr, cc] = np.maximum(layer[rr, cc], contrib)

    _one(x0, y0, x1, y1)
    extra = int(round(width_px)) - 1
    if extra > 0:
        dx, dy = x1 - x0, y1 - y0
        seg_len = (dx * dx + dy * dy) ** 0.5
        if seg_len > 1e-6:
            nx, ny = -dy / seg_len, dx / seg_len
            for k in range(1, extra + 1):
                off = (k + 1) // 2 * (1 if k % 2 == 1 else -1) * 0.7
                _one(x0 + nx * off, y0 + ny * off, x1 + nx * off, y1 + ny * off)


def _grow_neurite(layer: np.ndarray, rng: np.random.Generator, x: float, y: float, angle: float,
                   length: float, levels_left: int, width_px: float, brightness: float,
                   canvas_w: int, canvas_h: int) -> None:
    """Draw one neurite branch as a curving random walk, then optionally bifurcate."""
    step_len = rng.uniform(4.0, 8.0)
    n_steps = max(1, int(length / step_len))
    cur_x, cur_y, cur_angle = x, y, angle
    branch_point = None
    branch_step = int(n_steps * rng.uniform(0.4, 0.75))
    for i in range(n_steps):
        cur_angle += rng.normal(0.0, 0.18)
        nx = cur_x + np.cos(cur_angle) * step_len
        ny = cur_y + np.sin(cur_angle) * step_len
        if not (-20 <= nx <= canvas_w + 20 and -20 <= ny <= canvas_h + 20):
            break
        seg_bright = brightness * rng.uniform(0.85, 1.0)
        _draw_thick_line(layer, cur_x, cur_y, nx, ny, width_px, seg_bright)
        cur_x, cur_y = nx, ny
        if i == branch_step:
            branch_point = (cur_x, cur_y, cur_angle)

    if levels_left > 1 and branch_point is not None and rng.random() < 0.85:
        bx, by, bangle = branch_point
        n_children = 2 if rng.random() < 0.8 else 3
        remaining_len = length * rng.uniform(0.45, 0.7)
        for _ in range(n_children):
            child_angle = bangle + rng.normal(0.0, 0.55)
            child_width = max(1.0, width_px * rng.uniform(0.6, 0.9))
            _grow_neurite(layer, rng, bx, by, child_angle, remaining_len, levels_left - 1,
                          child_width, brightness * rng.uniform(0.8, 1.0), canvas_w, canvas_h)


def make_synthetic(seed: int, width: int = 1920, height: int = 1080,
                    n_cells: int | None = None, toxicity: float = 0.0) -> np.ndarray:
    """Return HxWx3 uint8 RGB.

    toxicity in [0,1]: 0 = healthy (long, branched neurites), 1 = toxic
    (short, few branches, rounder/smaller somas, more debris).
    """
    rng = np.random.default_rng(seed)
    toxicity = float(np.clip(toxicity, 0.0, 1.0))

    if n_cells is None:
        area_factor = (width * height) / (1920 * 1080)
        n_cells = max(3, int(rng.integers(18, 32) * max(area_factor, 0.05)))

    canvas = np.zeros((height, width, 3), dtype=np.float32)
    bg_level = rng.uniform(5.0, 12.0)
    canvas[..., 0] = bg_level * rng.uniform(0.85, 1.0)
    canvas[..., 1] = bg_level * rng.uniform(1.0, 1.3)
    canvas[..., 2] = bg_level * rng.uniform(0.85, 1.0)

    # low-frequency faint green haze
    small_h = max(4, height // 40)
    small_w = max(4, width // 40)
    haze_small = rng.uniform(0.0, 1.0, size=(small_h, small_w)).astype(np.float32)
    haze = ndimage.zoom(haze_small, (height / small_h, width / small_w), order=1)
    haze = haze[:height, :width]
    haze = ndimage.gaussian_filter(haze, sigma=15.0)
    haze_ptp = float(np.ptp(haze)) or 1.0
    haze = (haze - haze.min()) / haze_ptp
    canvas[..., 1] += haze * rng.uniform(4.0, 9.0)

    green_layer = np.zeros((height, width), dtype=np.float32)

    for _ in range(n_cells):
        cx = rng.uniform(0.03, 0.97) * width
        cy = rng.uniform(0.03, 0.97) * height

        soma_radius = rng.uniform(4.0, 9.0) * (1.0 - 0.35 * toxicity)
        soma_radius = max(2.5, soma_radius)
        soma_brightness = rng.uniform(180.0, 240.0)
        _stamp_gaussian_blob(green_layer, cx, cy, soma_radius, soma_brightness)

        n_primary = max(1, int(round(rng.integers(3, 7) * (1.0 - 0.6 * toxicity))))
        max_levels = max(1, int(round(rng.integers(2, 5) * (1.0 - 0.5 * toxicity))))
        base_length = rng.uniform(100.0, 700.0) * (1.0 - 0.65 * toxicity)
        base_length = max(25.0, base_length)

        for _ in range(n_primary):
            heading = rng.uniform(0.0, 2.0 * np.pi)
            length = base_length * rng.uniform(0.6, 1.15)
            width_px = rng.uniform(1.0, 3.0)
            neurite_brightness = rng.uniform(40.0, 90.0)
            _grow_neurite(green_layer, rng, cx, cy, heading, length, max_levels,
                          width_px, neurite_brightness, width, height)

    # debris: tiny faint dots, more numerous when toxic
    n_debris = int(rng.integers(5, 15) + toxicity * 30)
    for _ in range(n_debris):
        dx = rng.uniform(0.0, width)
        dy = rng.uniform(0.0, height)
        d_radius = rng.uniform(0.5, 1.5)
        d_brightness = rng.uniform(30.0, 80.0)
        _stamp_gaussian_blob(green_layer, dx, dy, d_radius, d_brightness)

    green_layer = np.clip(green_layer, 0.0, 255.0)

    r_frac = rng.uniform(0.10, 0.25)
    b_frac = rng.uniform(0.10, 0.25)
    canvas[..., 0] += green_layer * r_frac
    canvas[..., 1] += green_layer
    canvas[..., 2] += green_layer * b_frac

    # slight optical blur so lines/blobs look like real fluorescence, not vector art
    for c in range(3):
        canvas[..., c] = ndimage.gaussian_filter(canvas[..., c], sigma=0.8)

    # vignetting
    ys, xs = np.mgrid[0:height, 0:width].astype(np.float32)
    cx0, cy0 = width / 2.0, height / 2.0
    max_r2 = cx0 ** 2 + cy0 ** 2
    dist2 = (xs - cx0) ** 2 + (ys - cy0) ** 2
    vignette_strength = rng.uniform(0.15, 0.3)
    vignette = 1.0 - vignette_strength * (dist2 / max_r2)
    canvas *= vignette[..., None]

    # sensor noise
    noise_sigma = rng.uniform(2.0, 4.0)
    canvas += rng.normal(0.0, noise_sigma, size=canvas.shape).astype(np.float32)

    canvas = np.clip(canvas, 0.0, 255.0)
    return canvas.astype(np.uint8)


def write_fixture_set(out_dir: str | Path, n: int = 12, width: int = 1920, height: int = 1080) -> list[Path]:
    """Write n PNGs named synth-000.png ...; alternate toxicity 0.1/0.7 for two
    "conditions"; also write out_dir/manifest.json. Return the written paths."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    paths: list[Path] = []
    manifest = []
    for i in range(n):
        seed = 1000 + i
        toxicity = 0.1 if i % 2 == 0 else 0.7
        img = make_synthetic(seed=seed, width=width, height=height, toxicity=toxicity)
        fname = f"synth-{i:03d}.png"
        fpath = out_dir / fname
        Image.fromarray(img, mode="RGB").save(fpath)
        paths.append(fpath)
        manifest.append({"file": fname, "seed": seed, "toxicity": toxicity})

    with open(out_dir / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    return paths


if __name__ == "__main__":
    out_arg = sys.argv[1] if len(sys.argv) > 1 else "synth_out"
    n_arg = int(sys.argv[2]) if len(sys.argv) > 2 else 12
    written = write_fixture_set(out_arg, n=n_arg)
    for p in written:
        print(p)
