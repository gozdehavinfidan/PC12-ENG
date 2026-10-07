"""User-configurable preprocessing + thresholding for the classical pipeline.

One config (a dict of sections) drives S1/S2 of pipeline.py. The defaults
reproduce the original hard-coded pipeline exactly, so changing nothing in the
Preprocess screen changes no result.

Every operator is a documented scikit-image call (filter gallery:
https://scikit-image.org/docs/0.25.x/auto_examples/filters/); SCHEMA carries the
gallery/API link of each one so the UI can show where a filter comes from.

Order (llm-wiki/24-ONISLEME-PLANI.md s9): polarity -> background -> denoise ->
band-pass -> intensity -> enhancement, then soma + neurite thresholds.
"""
from __future__ import annotations

import copy
import hashlib
import json
import os
from pathlib import Path

import numpy as np
from scipy import ndimage as ndi
from skimage import exposure, filters, morphology, restoration

DOC = "https://scikit-image.org/docs/0.25.x/"
GAL = DOC + "auto_examples/filters/"
API = DOC + "api/"

GLOBAL_METHODS = ["otsu", "li", "yen", "isodata", "triangle", "mean", "minimum"]
LOCAL_METHODS = ["local", "niblack", "sauvola"]

# ------------------------------------------------------------------ schema
# kind: select | number | bool | sigmas ; show: {field: [values]} = visible only then
SCHEMA = [
    {"id": "polarity", "title": "Polarity", "doc": None,
     "help": "Which pixels are cells. Fluorescence: bright cells on dark. Phase contrast: dark cells, "
             "so the image is inverted. 'auto' decides from the image modality.",
     "fields": [
         {"key": "mode", "label": "Cells are", "kind": "select", "default": "auto",
          "options": [["auto", "Auto (from modality)"], ["bright", "Bright"], ["dark", "Dark (invert)"]]},
     ]},
    {"id": "background", "title": "Background", "doc": GAL + "plot_rolling_ball.html",
     "help": "Uneven illumination removal; the estimated background is subtracted.",
     "fields": [
         {"key": "method", "label": "Method", "kind": "select", "default": "gaussian",
          "options": [["none", "None"], ["gaussian", "Gaussian background"],
                      ["rolling_ball", "Rolling ball"], ["tophat", "White top-hat"]],
          "docs": {"gaussian": API + "skimage.filters.html#skimage.filters.gaussian",
                   "rolling_ball": GAL + "plot_rolling_ball.html",
                   "tophat": API + "skimage.morphology.html#skimage.morphology.white_tophat"}},
         {"key": "sigma", "label": "Sigma (px)", "kind": "number", "default": 12, "min": 2, "max": 80, "step": 1,
          "show": {"method": ["gaussian"]}, "help": "Estimated on a 4x downscaled copy (x4 in full-res px)."},
         {"key": "radius", "label": "Ball radius (px)", "kind": "number", "default": 30, "min": 5, "max": 200, "step": 1,
          "show": {"method": ["rolling_ball"]}, "help": "Larger than the biggest soma. Estimated on a 4x downscale."},
         {"key": "tophat_radius", "label": "Disk radius (px)", "kind": "number", "default": 15, "min": 2, "max": 60, "step": 1,
          "show": {"method": ["tophat"]}, "help": "Keeps bright structures smaller than the disk."},
     ]},
    {"id": "denoise", "title": "Denoise", "doc": GAL + "plot_nonlocal_means.html",
     "help": "Noise reduction before thresholding. NL-means / TV / wavelet are slow on full 4K frames.",
     "fields": [
         {"key": "method", "label": "Method", "kind": "select", "default": "none",
          "options": [["none", "None"], ["gaussian", "Gaussian"], ["median", "Median"],
                      ["nl_means", "Non-local means"], ["bilateral", "Bilateral"],
                      ["tv", "Total variation"], ["wavelet", "Wavelet"]],
          "docs": {"gaussian": API + "skimage.filters.html#skimage.filters.gaussian",
                   "median": API + "skimage.filters.html#skimage.filters.median",
                   "nl_means": GAL + "plot_nonlocal_means.html",
                   "bilateral": DOC + "auto_examples/filters/plot_denoise.html",
                   "tv": DOC + "auto_examples/filters/plot_denoise.html",
                   "wavelet": DOC + "auto_examples/filters/plot_denoise_wavelet.html"}},
         {"key": "sigma", "label": "Sigma (px)", "kind": "number", "default": 1.0, "min": 0.3, "max": 6, "step": 0.1,
          "show": {"method": ["gaussian"]}},
         {"key": "size", "label": "Disk radius (px)", "kind": "number", "default": 2, "min": 1, "max": 8, "step": 1,
          "show": {"method": ["median"]}},
         {"key": "h", "label": "Strength (x noise sigma)", "kind": "number", "default": 0.8, "min": 0.2, "max": 3, "step": 0.05,
          "show": {"method": ["nl_means"]}, "help": "h = factor x estimate_sigma(image)."},
         {"key": "sigma_spatial", "label": "Spatial sigma (px)", "kind": "number", "default": 2, "min": 0.5, "max": 10, "step": 0.5,
          "show": {"method": ["bilateral"]}},
         {"key": "weight", "label": "Weight", "kind": "number", "default": 0.05, "min": 0.005, "max": 0.5, "step": 0.005,
          "show": {"method": ["tv"]}},
     ]},
    {"id": "bandpass", "title": "Band-pass", "doc": GAL + "plot_dog.html",
     "help": "Keeps structures between two scales (removes both noise and slow background).",
     "fields": [
         {"key": "method", "label": "Method", "kind": "select", "default": "none",
          "options": [["none", "None"], ["dog", "Difference of Gaussians"], ["butterworth", "Butterworth"]],
          "docs": {"dog": GAL + "plot_dog.html", "butterworth": GAL + "plot_butterworth.html"}},
         {"key": "low_sigma", "label": "Low sigma (px)", "kind": "number", "default": 1, "min": 0.3, "max": 10, "step": 0.1,
          "show": {"method": ["dog"]}},
         {"key": "high_sigma", "label": "High sigma (px)", "kind": "number", "default": 20, "min": 2, "max": 100, "step": 1,
          "show": {"method": ["dog"]}},
         {"key": "cutoff", "label": "Cutoff (fraction)", "kind": "number", "default": 0.01, "min": 0.001, "max": 0.5, "step": 0.001,
          "show": {"method": ["butterworth"]}},
         {"key": "high_pass", "label": "High-pass", "kind": "bool", "default": True, "show": {"method": ["butterworth"]}},
     ]},
    {"id": "intensity", "title": "Intensity", "doc": API + "skimage.exposure.html",
     "help": "Per-image normalisation (exposure differs 18-1000 ms across the cohort).",
     "fields": [
         {"key": "percentile", "label": "Percentile stretch", "kind": "bool", "default": False,
          "doc": API + "skimage.exposure.html#skimage.exposure.rescale_intensity"},
         {"key": "lo", "label": "Low percentile", "kind": "number", "default": 1, "min": 0, "max": 20, "step": 0.1,
          "show": {"percentile": [True]}},
         {"key": "hi", "label": "High percentile", "kind": "number", "default": 99.8, "min": 80, "max": 100, "step": 0.1,
          "show": {"percentile": [True]}},
         {"key": "asinh", "label": "asinh k (0 = off)", "kind": "number", "default": 0, "min": 0, "max": 30, "step": 0.5,
          "help": "Lifts faint neurite tips: asinh(k x) / asinh(k)."},
         {"key": "gamma", "label": "Gamma", "kind": "number", "default": 1.0, "min": 0.3, "max": 3, "step": 0.05,
          "doc": API + "skimage.exposure.html#skimage.exposure.adjust_gamma"},
     ]},
    {"id": "enhance", "title": "Enhancement", "doc": DOC + "auto_examples/color_exposure/plot_equalize.html",
     "help": "Contrast aids. The preprocessing plan defers CLAHE as segmentation input (labelling view only).",
     "fields": [
         {"key": "clahe", "label": "CLAHE", "kind": "bool", "default": False,
          "doc": API + "skimage.exposure.html#skimage.exposure.equalize_adapthist"},
         {"key": "clip", "label": "CLAHE clip limit", "kind": "number", "default": 0.01, "min": 0.001, "max": 0.1, "step": 0.001,
          "show": {"clahe": [True]}},
         {"key": "unsharp", "label": "Unsharp mask", "kind": "bool", "default": False,
          "doc": GAL + "plot_unsharp_mask.html"},
         {"key": "radius", "label": "Unsharp radius (px)", "kind": "number", "default": 2, "min": 0.5, "max": 20, "step": 0.5,
          "show": {"unsharp": [True]}},
         {"key": "amount", "label": "Unsharp amount", "kind": "number", "default": 1, "min": 0.1, "max": 5, "step": 0.1,
          "show": {"unsharp": [True]}},
     ]},
    {"id": "soma", "title": "Soma threshold", "doc": DOC + "auto_examples/segmentation/plot_thresholding_guide.html",
     "help": "Cell bodies = smoothed image above the threshold, then opened and size-filtered.",
     "fields": [
         {"key": "smooth", "label": "Pre-smooth sigma (px)", "kind": "number", "default": 1.5, "min": 0, "max": 6, "step": 0.1},
         {"key": "method", "label": "Method", "kind": "select", "default": "robust",
          "options": [["robust", "Robust (median + k MAD)"], ["otsu", "Otsu"], ["li", "Li"], ["yen", "Yen"],
                      ["isodata", "Isodata"], ["triangle", "Triangle"], ["mean", "Mean"], ["minimum", "Minimum"],
                      ["local", "Local (adaptive)"], ["niblack", "Niblack"], ["sauvola", "Sauvola"],
                      ["manual", "Manual value"]]},
         {"key": "k", "label": "k (x MAD)", "kind": "number", "default": 18, "min": 1, "max": 60, "step": 0.5,
          "show": {"method": ["robust"]}},
         {"key": "floor", "label": "Minimum offset", "kind": "number", "default": 0.18, "min": 0, "max": 0.6, "step": 0.005,
          "show": {"method": ["robust"]}, "help": "Threshold is at least median + this value."},
         {"key": "value", "label": "Threshold", "kind": "number", "default": 0.2, "min": 0, "max": 1, "step": 0.001,
          "show": {"method": ["manual"]}},
         {"key": "block", "label": "Block / window (px, odd)", "kind": "number", "default": 51, "min": 3, "max": 301, "step": 2,
          "show": {"method": LOCAL_METHODS}},
         {"key": "offset", "label": "Offset", "kind": "number", "default": 0.0, "min": -0.3, "max": 0.3, "step": 0.005,
          "show": {"method": ["local"]}, "help": "Subtracted from the local weighted mean."},
         {"key": "lk", "label": "k", "kind": "number", "default": 0.2, "min": -1, "max": 1, "step": 0.01,
          "show": {"method": ["niblack", "sauvola"]}},
         {"key": "open_radius", "label": "Opening disk (px)", "kind": "number", "default": 2, "min": 0, "max": 10, "step": 1},
         {"key": "min_area", "label": "Min soma area (px)", "kind": "number", "default": 12, "min": 0, "max": 5000, "step": 1},
     ]},
    {"id": "neurite", "title": "Neurite ridge + threshold", "doc": GAL + "plot_ridge_filter.html",
     "help": "Neurites = thin bright ridges: ridge filter response above the threshold, outside somata.",
     "fields": [
         {"key": "filter", "label": "Ridge filter", "kind": "select", "default": "sato",
          "options": [["sato", "Sato"], ["frangi", "Frangi"], ["meijering", "Meijering"], ["hessian", "Hessian"]],
          "docs": {"sato": GAL + "plot_ridge_filter.html", "frangi": GAL + "plot_ridge_filter.html",
                   "meijering": GAL + "plot_ridge_filter.html", "hessian": GAL + "plot_ridge_filter.html"}},
         {"key": "sigma_min", "label": "Sigma min (px)", "kind": "number", "default": 1, "min": 0.5, "max": 6, "step": 0.5},
         {"key": "sigma_max", "label": "Sigma max (px)", "kind": "number", "default": 2, "min": 0.5, "max": 10, "step": 0.5},
         {"key": "method", "label": "Method", "kind": "select", "default": "robust",
          "options": [["robust", "Robust (median + k MAD)"], ["hysteresis", "Hysteresis"], ["otsu", "Otsu"],
                      ["li", "Li"], ["yen", "Yen"], ["triangle", "Triangle"], ["manual", "Manual value"]],
          "docs": {"hysteresis": GAL + "plot_hysteresis.html"}},
         {"key": "k", "label": "k (x MAD)", "kind": "number", "default": 12, "min": 1, "max": 60, "step": 0.5,
          "show": {"method": ["robust", "hysteresis"]}, "help": "Hysteresis: this is the HIGH threshold."},
         {"key": "low_frac", "label": "Low / high ratio", "kind": "number", "default": 0.5, "min": 0.1, "max": 0.95, "step": 0.05,
          "show": {"method": ["hysteresis"]}, "help": "Weak ridge pixels survive only if connected to strong ones."},
         {"key": "value", "label": "Threshold", "kind": "number", "default": 0.05, "min": 0, "max": 1, "step": 0.0005,
          "show": {"method": ["manual"]}},
         {"key": "min_area", "label": "Min neurite area (px)", "kind": "number", "default": 70, "min": 0, "max": 2000, "step": 1},
         {"key": "min_extent", "label": "Min neurite extent (px)", "kind": "number", "default": 32, "min": 0, "max": 400, "step": 1,
          "help": "Components whose bounding-box diagonal is shorter are debris, not neurites."},
     ]},
]


def defaults() -> dict:
    return {s["id"]: {f["key"]: f["default"] for f in s["fields"]} for s in SCHEMA}


def normalize(cfg: dict | None) -> dict:
    """Fill missing keys with defaults, coerce types, clamp numbers to range."""
    out = defaults()
    cfg = cfg or {}
    for s in SCHEMA:
        src = cfg.get(s["id"]) or {}
        for f in s["fields"]:
            if f["key"] not in src:
                continue
            v = src[f["key"]]
            if f["kind"] == "select":
                if v in [o[0] for o in f["options"]]:
                    out[s["id"]][f["key"]] = v
            elif f["kind"] == "bool":
                out[s["id"]][f["key"]] = bool(v)
            else:
                try:
                    out[s["id"]][f["key"]] = float(min(max(float(v), f["min"]), f["max"]))
                except (TypeError, ValueError):
                    pass
    for s in out.values():          # integers stay integers so the hash is stable
        for k, v in s.items():
            if isinstance(v, float) and v.is_integer():
                s[k] = int(v)
    return out


def cfg_hash(cfg: dict) -> str:
    return hashlib.sha1(json.dumps(normalize(cfg), sort_keys=True).encode()).hexdigest()[:10]


# ------------------------------------------------------------- persistence
def _root() -> Path:
    import registry

    return registry.CACHE / "preproc"


def load_active() -> dict:
    f = _root() / "active.json"
    try:
        d = json.loads(f.read_text(encoding="utf-8"))
        return {"preset": d.get("preset") or "default", "params": normalize(d.get("params"))}
    except (OSError, ValueError):
        return {"preset": "default", "params": defaults()}


def save_active(preset: str, params: dict) -> dict:
    root = _root()
    root.mkdir(parents=True, exist_ok=True)
    rec = {"preset": preset or "custom", "params": normalize(params)}
    tmp = root / "active.json.tmp"
    tmp.write_text(json.dumps(rec, indent=1), encoding="utf-8")
    os.replace(tmp, root / "active.json")
    return rec


def _preset_file(name: str) -> Path:
    import registry

    return _root() / "presets" / f"{registry.slug(name)}.json"


def list_presets() -> list[dict]:
    out = [{"name": "default", "builtin": True, "params": defaults()}]
    d = _root() / "presets"
    for f in sorted(d.glob("*.json")) if d.is_dir() else []:
        try:
            rec = json.loads(f.read_text(encoding="utf-8"))
            out.append({"name": rec["name"], "builtin": False, "params": normalize(rec.get("params"))})
        except (OSError, ValueError, KeyError):
            continue
    return out


def save_preset(name: str, params: dict) -> dict:
    name = name.strip()[:40]
    if not name or name.lower() == "default":
        raise ValueError("choose a preset name other than 'default'")
    f = _preset_file(name)
    f.parent.mkdir(parents=True, exist_ok=True)
    rec = {"name": name, "params": normalize(params)}
    f.write_text(json.dumps(rec, indent=1), encoding="utf-8")
    return rec


def delete_preset(name: str) -> bool:
    f = _preset_file(name)
    if f.exists():
        f.unlink()
        return True
    return False


# ------------------------------------------------------------- operators
def _zoom_to(small: np.ndarray, shape) -> np.ndarray:
    big = ndi.zoom(small, (shape[0] / small.shape[0], shape[1] / small.shape[1]), order=1)
    return big[: shape[0], : shape[1]]


def apply_polarity(gray: np.ndarray, cfg: dict, modality: str | None) -> np.ndarray:
    mode = cfg["polarity"]["mode"]
    if mode == "auto":
        mode = "dark" if modality == "phase-contrast" else "bright"
    return (1.0 - gray) if mode == "dark" else gray


def apply_stack(gray: np.ndarray, cfg: dict) -> np.ndarray:
    """Background -> denoise -> band-pass -> intensity -> enhancement on a float
    image (cells bright). Returns float32 >= 0."""
    img = gray.astype(np.float32)

    b = cfg["background"]
    if b["method"] == "gaussian":
        # 4x downscaled copy: 16x cheaper, and the background is smooth
        small = img[::4, ::4]
        bg = _zoom_to(ndi.gaussian_filter(small, b["sigma"]), img.shape)
        img = np.clip(img - bg, 0, None)
    elif b["method"] == "rolling_ball":
        small = img[::4, ::4]
        bg = _zoom_to(restoration.rolling_ball(small, radius=max(1.0, b["radius"] / 4)), img.shape)
        img = np.clip(img - bg, 0, None)
    elif b["method"] == "tophat":
        img = morphology.white_tophat(img, morphology.disk(int(b["tophat_radius"])))

    d = cfg["denoise"]
    if d["method"] == "gaussian":
        img = filters.gaussian(img, sigma=d["sigma"], preserve_range=True)
    elif d["method"] == "median":
        img = filters.median(img, morphology.disk(int(d["size"])))
    elif d["method"] == "nl_means":
        sig = float(np.mean(restoration.estimate_sigma(img)))
        img = restoration.denoise_nl_means(img, h=d["h"] * sig, sigma=sig, fast_mode=True,
                                           patch_size=5, patch_distance=6)
    elif d["method"] == "bilateral":
        lo, hi = float(img.min()), float(img.max())
        span = (hi - lo) or 1.0
        img = restoration.denoise_bilateral((img - lo) / span, sigma_spatial=d["sigma_spatial"]) * span + lo
    elif d["method"] == "tv":
        img = restoration.denoise_tv_chambolle(img, weight=d["weight"])
    elif d["method"] == "wavelet":
        img = restoration.denoise_wavelet(img, rescale_sigma=True)

    p = cfg["bandpass"]
    if p["method"] == "dog":
        img = filters.difference_of_gaussians(img, p["low_sigma"], max(p["high_sigma"], p["low_sigma"] + 0.5))
        img = np.clip(img, 0, None)
    elif p["method"] == "butterworth":
        img = filters.butterworth(img, cutoff_frequency_ratio=p["cutoff"], high_pass=bool(p["high_pass"]))
        img = np.clip(img, 0, None)

    it = cfg["intensity"]
    if it["percentile"]:
        lo, hi = np.percentile(img, [it["lo"], max(it["hi"], it["lo"] + 0.1)])
        img = exposure.rescale_intensity(img, in_range=(float(lo), float(hi) if hi > lo else float(lo) + 1e-6),
                                         out_range=(0.0, 1.0))
    if it["asinh"] > 0:
        k = it["asinh"]
        img = np.arcsinh(k * np.clip(img, 0, None)) / np.arcsinh(k)
    if it["gamma"] != 1:
        img = exposure.adjust_gamma(np.clip(img, 0, None), it["gamma"])

    e = cfg["enhance"]
    if e["clahe"]:
        img = exposure.equalize_adapthist(np.clip(img / (img.max() or 1.0), 0, 1), clip_limit=e["clip"])
    if e["unsharp"]:
        img = filters.unsharp_mask(img, radius=e["radius"], amount=e["amount"], preserve_range=True)
        img = np.clip(img, 0, None)
    return np.ascontiguousarray(img, dtype=np.float32)


def ridge(img: np.ndarray, cfg: dict, sigmas=None) -> np.ndarray:
    n = cfg["neurite"]
    if sigmas is None:
        lo, hi = float(n["sigma_min"]), float(max(n["sigma_max"], n["sigma_min"]))
        sigmas = [lo] if hi == lo else list(np.arange(lo, hi + 1e-6, 1.0)) if hi - lo >= 1 else [lo, hi]
    fn = {"sato": filters.sato, "frangi": filters.frangi,
          "meijering": filters.meijering, "hessian": filters.hessian}[n["filter"]]
    kw = {"sigmas": sigmas, "black_ridges": False}
    if n["filter"] == "hessian":
        # hessian() marks ridges with 1 and needs mode; invert to "response" so higher = ridge
        r = 1.0 - fn(img, mode="reflect", **kw)
    else:
        r = fn(img, **kw)
    return r.astype(np.float32)


def _global(method: str, x: np.ndarray) -> float:
    fn = getattr(filters, f"threshold_{method}")
    return float(fn(x))


def soma_threshold(smooth: np.ndarray, pre: np.ndarray, cfg: dict) -> tuple[float | np.ndarray, list[str]]:
    """Scalar threshold, or a per-pixel map for local methods. `pre` is the
    unsmoothed filtered image (the robust rule is defined on it)."""
    s, warn = cfg["soma"], []
    m = s["method"]
    if m == "robust":
        med = float(np.median(pre))
        mad = float(np.median(np.abs(pre - med))) * 1.4826 + 1e-4
        return med + max(s["k"] * mad, s["floor"]), warn
    if m == "manual":
        return float(s["value"]), warn
    if m in LOCAL_METHODS:
        blk = int(s["block"]) | 1
        if m == "local":
            return filters.threshold_local(smooth, block_size=blk, offset=s["offset"]).astype(np.float32), warn
        fn = filters.threshold_niblack if m == "niblack" else filters.threshold_sauvola
        return fn(smooth, window_size=blk, k=s["lk"]).astype(np.float32), warn
    try:
        return _global(m, smooth[::2, ::2]), warn
    except (RuntimeError, ValueError) as e:     # e.g. threshold_minimum on a unimodal histogram
        warn.append(f"soma {m} failed ({e}); fell back to Otsu")
        return _global("otsu", smooth[::2, ::2]), warn


def neurite_stats(pre: np.ndarray, cfg: dict) -> tuple[dict, list[str]]:
    """Ridge threshold(s). The robust rule keeps the original estimate (ridge of a
    3x downscaled copy at the smallest sigma); data-driven methods use the
    full-resolution response of a central crop (same scale as the tiles)."""
    n, warn = cfg["neurite"], []
    ridge_small = ridge(pre[::3, ::3], cfg, sigmas=[float(n["sigma_min"])])
    r_med = float(np.median(ridge_small))
    r_mad = float(np.median(np.abs(ridge_small - r_med))) * 1.4826 + 1e-5
    st = {"ridge_scale": 3 * r_mad, "ridge_low": None}
    m = n["method"]
    if m in ("robust", "hysteresis"):
        st["ridge_thr"] = r_med + n["k"] * r_mad
        if m == "hysteresis":
            st["ridge_low"] = r_med + n["low_frac"] * (st["ridge_thr"] - r_med)
    elif m == "manual":
        st["ridge_thr"] = float(n["value"])
    else:
        h, w = pre.shape
        c = 512
        crop = pre[max(0, h // 2 - c): h // 2 + c, max(0, w // 2 - c): w // 2 + c]
        resp = ridge(crop, cfg)
        try:
            st["ridge_thr"] = _global(m, resp)
        except (RuntimeError, ValueError) as e:
            warn.append(f"neurite {m} failed ({e}); fell back to robust")
            st["ridge_thr"] = r_med + n["k"] * r_mad
    return st, warn


def try_all(smooth: np.ndarray) -> list[dict]:
    """filters.try_all_threshold, but returning data instead of a figure."""
    out = []
    for m in GLOBAL_METHODS:
        try:
            t = _global(m, smooth)
            out.append({"method": m, "threshold": round(t, 5), "mask": smooth > t})
        except (RuntimeError, ValueError) as e:
            out.append({"method": m, "threshold": None, "error": str(e)})
    return out
