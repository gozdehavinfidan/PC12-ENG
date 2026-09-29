"""Mock S0-S5 pipeline: classical computer vision that speaks the real contract.

There is no trained model yet (CLAUDE.md s1). So that the UI is built against the
real behaviour, this module does what the ONNX pipeline will do, with classical
operators instead of a network:

  S0 load      decode the image (CZI / PNG / TIFF / JPG), read the um/px scale
  S1 prepare   background subtraction + robust noise estimate (global thresholds)
  S2 segment   256x256 tiles with a 16 px halo: soma = bright blobs, neurite =
               ridge filter; uncertainty = closeness to the decision threshold.
               Every tile is emitted as soon as it is done (this *is* the
               "watch it think" stream, CLAUDE.md s4.4)
  S3 skeleton  clean-up + skeleton of the neurite mask
  S4 measure   branches, junctions, angles, soma morphology, QC
  S5 score     NTI (mock formula) and per-parameter summaries

Every number produced here carries ``mock: true``. The NTI formula below is a
placeholder that has the right *shape* (score + per-parameter contributions);
it is not the TUSEB NTI definition.
"""
from __future__ import annotations

import base64
import io
import math
import re
import time
from pathlib import Path
from typing import Callable

import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage import feature, filters, measure, morphology

TILE = 256
HALO = 16
MODEL_VERSION = "mock-classical-v1"

Emit = Callable[[dict], None]
Cancelled = Callable[[], bool]


class JobCancelled(Exception):
    pass


# --------------------------------------------------------------------- S0 load
def read_image(path: str | Path) -> tuple[np.ndarray, float | None, str | None]:
    """Return (rgb uint8 HxWx3, um_per_px or None, acquisition datetime or None)."""
    path = Path(path)
    if path.suffix.lower() == ".czi":
        import czifile

        with czifile.CziFile(str(path)) as czi:
            arr = czi.asarray()
            meta = czi.metadata()
        arr = np.squeeze(arr)
        if arr.ndim == 3 and arr.shape[-1] == 3:
            if "Bgr" in meta:              # Zeiss colour cameras store BGR
                arr = arr[..., ::-1]
        elif arr.ndim == 2:
            arr = np.stack([arr] * 3, axis=-1)
        else:                              # multi-channel: take the first plane
            arr = arr.reshape(-1, *arr.shape[-3:])[0]
            if arr.shape[-1] != 3:
                arr = np.stack([arr[..., 0]] * 3, axis=-1)
        if arr.dtype != np.uint8:
            hi = np.percentile(arr, 99.9) or 1
            arr = np.clip(arr.astype(np.float32) / hi * 255, 0, 255).astype(np.uint8)
        um = None
        m = re.search(r'<Distance Id="X">\s*<Value>([0-9.eE+-]+)</Value>', meta)
        if m:
            um = float(m.group(1)) * 1e6
        date = None
        d = re.search(r"<AcquisitionDateAndTime>([^<]+)<", meta)
        if d:
            date = d.group(1)[:19]
        return np.ascontiguousarray(arr), um, date
    img = Image.open(path).convert("RGB")
    return np.asarray(img), None, None


def intensity(rgb: np.ndarray) -> np.ndarray:
    """Fluorescence: the brightest channel carries the signal (green for PC12
    GFP/calcein); phase contrast is grey so max == any channel."""
    return rgb.max(axis=2).astype(np.float32) / 255.0


# ------------------------------------------------------------------ S1 prepare
def prepare(gray: np.ndarray) -> tuple[np.ndarray, dict]:
    # background on a 4x downscaled copy: 16x cheaper, and the background is smooth
    small = gray[::4, ::4]
    bg_small = ndi.gaussian_filter(small, 12)
    bg = ndi.zoom(bg_small, (gray.shape[0] / small.shape[0], gray.shape[1] / small.shape[1]), order=1)
    bg = bg[: gray.shape[0], : gray.shape[1]]
    pre = np.clip(gray - bg, 0, None)
    med = float(np.median(pre))
    mad = float(np.median(np.abs(pre - med))) * 1.4826 + 1e-4
    # neurite threshold is estimated on the ridge response of a downscaled copy
    ridge_small = filters.sato(pre[::3, ::3], sigmas=[1], black_ridges=False)
    r_med = float(np.median(ridge_small))
    r_mad = float(np.median(np.abs(ridge_small - r_med))) * 1.4826 + 1e-5
    stats = {
        "noise": mad,
        "soma_thr": med + max(18 * mad, 0.18),
        "ridge_thr": r_med + 12 * r_mad,
        "ridge_scale": 3 * r_mad,
    }
    return pre, stats


# ------------------------------------------------------------------ S2 segment
def segment_tile(pre: np.ndarray, stats: dict, x0: int, y0: int, x1: int, y1: int):
    h, w = pre.shape
    ax0, ay0 = max(0, x0 - HALO), max(0, y0 - HALO)
    ax1, ay1 = min(w, x1 + HALO), min(h, y1 + HALO)
    sub = pre[ay0:ay1, ax0:ax1]
    smooth = ndi.gaussian_filter(sub, 1.5)
    soma = smooth > stats["soma_thr"]
    soma = ndi.binary_opening(soma, structure=morphology.disk(2))
    ridge = filters.sato(sub, sigmas=[1, 2], black_ridges=False)
    neur = (ridge > stats["ridge_thr"]) & ~soma
    # uncertainty: 1 at the decision boundary, fading with distance to it
    z = (ridge - stats["ridge_thr"]) / stats["ridge_scale"]
    unc = np.exp(-0.5 * z * z) * (ridge > 0.35 * stats["ridge_thr"])
    zs = (smooth - stats["soma_thr"]) / (6 * stats["noise"] + 1e-6)
    unc = np.maximum(unc, np.exp(-0.5 * zs * zs) * (smooth > 0.5 * stats["soma_thr"]))
    sl = (slice(y0 - ay0, y0 - ay0 + (y1 - y0)), slice(x0 - ax0, x0 - ax0 + (x1 - x0)))
    return soma[sl], neur[sl], unc[sl].astype(np.float32)


def encode_rgba(soma: np.ndarray, neur: np.ndarray, unc: np.ndarray) -> bytes:
    """Mask wire format shared by tiles and full layers:
    R = soma, G = neurite, B = uncertainty (0-255), A = 255."""
    rgba = np.empty((*soma.shape, 4), np.uint8)
    rgba[..., 0] = soma * 255
    rgba[..., 1] = neur * 255
    rgba[..., 2] = np.clip(unc * 255, 0, 255)
    rgba[..., 3] = 255
    buf = io.BytesIO()
    Image.fromarray(rgba, "RGBA").save(buf, "PNG", compress_level=1)
    return buf.getvalue()


# ----------------------------------------------------------- S3/S4 morphometry
_NB = np.array([[1, 1, 1], [1, 0, 1], [1, 1, 1]])
_OFFS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def _trace(coords: np.ndarray) -> np.ndarray:
    """Order the pixels of one skeleton branch (a simple path) end to end."""
    pts = {(int(r), int(c)) for r, c in coords}
    if len(pts) <= 2:
        return coords

    def nbrs(p):
        return [(p[0] + dr, p[1] + dc) for dr, dc in _OFFS if (p[0] + dr, p[1] + dc) in pts]

    start = next((p for p in pts if len(nbrs(p)) == 1), next(iter(pts)))
    order, seen, cur = [start], {start}, start
    while True:
        nxt = [q for q in nbrs(cur) if q not in seen]
        if not nxt:
            break
        # prefer 4-neighbours so diagonal shortcuts do not skip pixels
        nxt.sort(key=lambda q: abs(q[0] - cur[0]) + abs(q[1] - cur[1]))
        cur = nxt[0]
        order.append(cur)
        seen.add(cur)
    return np.array(order)


def _path_length(path: np.ndarray) -> float:
    if len(path) < 2:
        return float(len(path))
    d = np.diff(path, axis=0)
    return float(np.sqrt((d ** 2).sum(axis=1)).sum())


def _circ_std_deg(angles: list[float]) -> float:
    if not angles:
        return 0.0
    a = np.deg2rad(np.asarray(angles))
    r = np.hypot(np.cos(a).mean(), np.sin(a).mean())
    return float(np.rad2deg(np.sqrt(max(0.0, -2 * math.log(max(r, 1e-9))))))


def _summary(values) -> dict:
    v = np.asarray(values, dtype=float)
    if v.size == 0:
        return {"n": 0, "mean": 0, "median": 0, "std": 0, "cv": 0, "min": 0, "max": 0, "total": 0}
    mean = float(v.mean())
    std = float(v.std(ddof=1)) if v.size > 1 else 0.0
    return {"n": int(v.size), "mean": mean, "median": float(np.median(v)), "std": std,
            "cv": float(std / mean) if mean else 0.0, "min": float(v.min()),
            "max": float(v.max()), "total": float(v.sum())}


def _drop_small(mask: np.ndarray, min_area: int, min_extent: int = 0) -> np.ndarray:
    """Remove connected components smaller than min_area pixels or whose
    bounding box diagonal is below min_extent (round debris is not a neurite)."""
    lab, n = ndi.label(mask, structure=np.ones((3, 3)))
    if not n:
        return mask
    area = np.bincount(lab.ravel())
    keep = area >= min_area
    if min_extent:
        for i, sl in enumerate(ndi.find_objects(lab), start=1):
            if sl is not None and math.hypot(sl[0].stop - sl[0].start, sl[1].stop - sl[1].start) < min_extent:
                keep[i] = False
    keep[0] = False
    return keep[lab]


def measure_all(pre, soma, neur, unc, um_per_px) -> dict:
    h, w = soma.shape
    soma = _drop_small(soma, 12)
    neur = _drop_small(neur & ~soma, 70, min_extent=32)
    soma_zone = ndi.binary_dilation(soma, iterations=2)
    skel = morphology.skeletonize(neur & ~soma_zone)
    nb = ndi.convolve(skel.astype(np.uint8), _NB, mode="constant") * skel
    endpoints_m = skel & (nb == 1)
    junction_m = skel & (nb >= 3)

    # junction clusters -> centroids
    jlab, nj = ndi.label(ndi.binary_dilation(junction_m, iterations=1), structure=np.ones((3, 3)))
    jcent = ndi.center_of_mass(junction_m, jlab, range(1, nj + 1)) if nj else []

    # branches = skeleton minus junction neighbourhoods
    seg = skel & ~(jlab > 0)
    blab, nbr = ndi.label(seg, structure=np.ones((3, 3)))
    objs = ndi.find_objects(blab)
    # network components (soma + neurite) to attach branches to cells
    net_lab, _ = ndi.label(soma | neur | skel, structure=np.ones((3, 3)))
    soma_lab, nsoma = ndi.label(soma)

    branches, junc_dirs, kept_ends = [], {j: [] for j in range(1, nj + 1)}, []
    for i, sl in enumerate(objs, start=1):
        if sl is None:
            continue
        rr, cc = np.nonzero(blab[sl] == i)
        coords = np.stack([rr + sl[0].start, cc + sl[1].start], axis=1)
        path = _trace(coords)
        length = _path_length(path)
        if length < 8:
            continue
        a, b = path[0], path[-1]
        is_loop = bool(len(path) > 8 and np.hypot(*(b - a)) <= 1.5
                       and not endpoints_m[coords[:, 0], coords[:, 1]].any())
        chord = float(np.hypot(*(b - a))) or 1.0
        if is_loop:
            chord = max(chord, length / math.pi)   # closed loop: compare with its diameter
        ends_j, ends_e, pending = [], 0, []
        for end, inner in ((a, path[min(8, len(path) - 1)]), (b, path[max(-9, -len(path))])):
            r0, c0 = int(end[0]), int(end[1])
            win = jlab[max(0, r0 - 2): r0 + 3, max(0, c0 - 2): c0 + 3]
            js = np.unique(win[win > 0])
            if js.size:
                j = int(js[0])
                ends_j.append(j)
                d = inner - end
                pending.append((j, math.degrees(math.atan2(-d[0], d[1]))))
            elif endpoints_m[max(0, r0 - 1): r0 + 2, max(0, c0 - 1): c0 + 2].any():
                ends_e += 1
        if (ends_e and not ends_j and length < 16) or (ends_e == 1 and length < 12):
            # isolated fragment / spur: drop the record AND its skeleton pixels
            skel[coords[:, 0], coords[:, 1]] = False
            continue
        for end in (a, b):
            r0, c0 = int(end[0]), int(end[1])
            if endpoints_m[max(0, r0 - 1): r0 + 2, max(0, c0 - 1): c0 + 2].any():
                kept_ends.append([c0, r0])
        for j, ang in pending:
            junc_dirs[j].append((len(branches), ang))
        mid = path[len(path) // 2]
        orient = math.degrees(math.atan2(-(b[0] - a[0]), b[1] - a[1])) % 180
        step = max(1, len(path) // 48)
        poly = path[::step]
        if (poly[-1] != path[-1]).any():
            poly = np.vstack([poly, path[-1]])
        branches.append({
            "id": f"B{len(branches) + 1}",
            "length_px": round(length, 1),
            "tortuosity": round(min(length / chord, 9.99), 3),
            "junctions": len(set(ends_j)),
            "endpoints": ends_e,
            "orientation_deg": round(orient, 1),
            "network": int(net_lab[int(mid[0]), int(mid[1])]),
            "polyline": [[int(p[1]), int(p[0])] for p in poly],
            "mean_intensity": round(float(pre[path[:, 0], path[:, 1]].mean()), 4),
            "loop": is_loop,
        })

    junctions, all_angles = [], []
    for j in range(1, nj + 1):
        dirs = sorted(junc_dirs[j], key=lambda t: t[1] % 360)
        if len(dirs) < 2:
            continue
        angs = []
        for k in range(len(dirs)):
            a1, a2 = dirs[k][1] % 360, dirs[(k + 1) % len(dirs)][1] % 360
            angs.append(round((a2 - a1) % 360 or 360.0, 1))
        if len(dirs) == 2:
            angs = [round(min(angs), 1)]
        cy, cx = jcent[j - 1]
        junctions.append({"id": f"J{len(junctions) + 1}", "x": round(cx, 1), "y": round(cy, 1),
                          "branch_ids": [branches[b]["id"] for b, _ in dirs],
                          "directions_deg": [round(d % 360, 1) for _, d in dirs],
                          "angles_deg": angs})
        all_angles.extend(angs)

    endpoints = kept_ends

    # ---- cells (soma morphology)
    cells = []
    props = measure.regionprops(soma_lab, intensity_image=unc)
    areas = np.array([p.area for p in props], float)
    q1, q2 = (np.percentile(areas, [33.3, 66.7]) if areas.size >= 3 else (areas.min(initial=0), areas.max(initial=0)))
    for p in props:
        per = p.perimeter or 1.0
        circ = min(1.0, 4 * math.pi * p.area / (per * per))
        cy, cx = p.centroid
        net = int(net_lab[int(cy), int(cx)])
        crop = np.pad(p.image, 1)
        cont = measure.find_contours(crop.astype(float), 0.5)
        contour = []
        if cont:
            c = measure.approximate_polygon(max(cont, key=len), 0.8)
            contour = [[round(float(pt[1]) - 1 + p.bbox[1], 1), round(float(pt[0]) - 1 + p.bbox[0], 1)] for pt in c]
        cells.append({
            "id": len(cells) + 1,
            "area_px": int(p.area),
            "circularity": round(circ, 3),
            "eccentricity": round(float(p.eccentricity), 3),
            "centroid": [round(cx, 1), round(cy, 1)],
            "bbox": [int(p.bbox[1]), int(p.bbox[0]), int(p.bbox[3]), int(p.bbox[2])],
            "confidence": round(float(1 - p.intensity_mean * 0.6), 3),
            "category": "small" if p.area < q1 else ("large" if p.area > q2 else "medium"),
            "network": net,
            "contour": contour,
        })

    # attach neurites to cells: branches of a network are shared by its somas
    by_net: dict[int, list] = {}
    for b in branches:
        by_net.setdefault(b["network"], []).append(b)
    somas_per_net: dict[int, int] = {}
    for c in cells:
        somas_per_net[c["network"]] = somas_per_net.get(c["network"], 0) + 1
    for c in cells:
        bs = by_net.get(c["network"], []) if c["network"] else []
        k = somas_per_net.get(c["network"], 1)
        c["neurite_length_px"] = round(sum(b["length_px"] for b in bs) / k, 1)
        c["branches"] = round(len(bs) / k, 2)
    owner = {c["network"]: c["id"] for c in cells if c["network"]}
    for b in branches:
        b["cell_id"] = owner.get(b["network"])

    # outliers: robust (median + MAD) on area and circularity -> QC flag, not "toxic"
    # log-area (areas are right-skewed); a MAD floor keeps tight distributions
    # from flagging ordinary cells
    for key, floor in (("area_px", 0.25), ("circularity", 0.06)):
        v = np.array([c[key] for c in cells], float)
        if key == "area_px":
            v = np.log(v)
        if v.size >= 5:
            med = np.median(v)
            mad = max(np.median(np.abs(v - med)) * 1.4826, floor)
            for c, x in zip(cells, v):
                if abs(x - med) / mad > 3.5:
                    c.setdefault("outlier_reasons", []).append(key)
    for c in cells:
        c["outlier"] = bool(c.get("outlier_reasons"))

    fg = soma | neur
    lap = filters.laplace(ndi.gaussian_filter(pre, 0.8))
    blur_var = float(lap.var())
    edges = feature.canny(pre, sigma=2)
    fg_unc = unc[fg] if fg.any() else np.array([0.0])
    comp_lab, ncomp = ndi.label(fg, structure=np.ones((3, 3)))
    sizes = np.bincount(comp_lab.ravel())[1:] if ncomp else np.array([])
    qc = {
        "blur": round(float(min(1.0, blur_var / 2e-5)), 3),          # 1 = sharp
        "laplacian_var": blur_var,
        "edge_density": round(float(edges.mean()), 4),
        "fg_ratio": round(float(fg.mean()), 4),
        "mean_conf": round(float(1 - fg_unc.mean() * 0.6), 3),
        "low_conf_ratio": round(float((fg_unc > 0.5).mean()), 3),
        "components": int(ncomp),
        "small_component_ratio": round(float((sizes < 40).mean()) if sizes.size else 0.0, 3),
        "warnings": [],
    }
    if qc["blur"] < 0.35:
        qc["warnings"].append({"code": "low_focus", "severity": "warning", "text": "Low focus: Laplacian variance below threshold"})
    if qc["low_conf_ratio"] > 0.25:
        qc["warnings"].append({"code": "high_uncertainty", "severity": "warning", "text": "High uncertainty in more than 25% of foreground"})
    if qc["fg_ratio"] < 0.002:
        qc["warnings"].append({"code": "low_fg", "severity": "serious", "text": "Very low foreground coverage: few or no cells"})
    if qc["small_component_ratio"] > 0.6:
        qc["warnings"].append({"code": "small_components", "severity": "warning", "text": "Excessive small components: debris or noise"})

    return {"cells": cells, "neurites": branches, "junctions": junctions,
            "endpoints": endpoints, "angles_deg": all_angles, "qc": qc,
            "skeleton": skel, "soma": soma, "neur": neur, "soma_lab": soma_lab}


# ------------------------------------------------------------------- S5 score
# Reference values for the mock NTI: typical per-cell values of a healthy field.
REF = {"neurite_length": 220.0, "branching": 3.0, "angle_disp": 45.0, "circularity": 0.75}


def nti_score(cells, branches, angles) -> dict:
    """Mock NTI in [0, 1], higher = more neurotoxic-looking. Each contribution is a
    bounded (tanh) deviation from the reference, so the score is an additive,
    explainable sum. Placeholder until the real definition is fitted."""
    n = max(len(cells), 1)
    L = sum(b["length_px"] for b in branches) / n
    B = len(branches) / n
    A = _circ_std_deg(angles)
    C = float(np.mean([c["circularity"] for c in cells])) if cells else REF["circularity"]
    contrib = {
        "neurite_length": -0.22 * math.tanh((L - REF["neurite_length"]) / REF["neurite_length"]),
        "branching": -0.12 * math.tanh((B - REF["branching"]) / REF["branching"]),
        "angle": 0.06 * math.tanh((REF["angle_disp"] - A) / REF["angle_disp"]),
        "soma": 0.20 * math.tanh((C - REF["circularity"]) / 0.15),
    }
    score = min(1.0, max(0.0, 0.5 + sum(contrib.values())))
    if not cells:   # no somata: the index is undefined, not "toxic"
        return {"score": None, "contrib": {k: 0.0 for k in contrib}, "inputs": {
            "neurite_length_per_cell_px": 0, "branches_per_cell": 0,
            "angle_dispersion_deg": 0, "mean_circularity": 0}, "mock": True}
    return {"score": round(score, 3), "contrib": {k: round(v, 3) for k, v in contrib.items()},
            "inputs": {"neurite_length_per_cell_px": round(L, 1), "branches_per_cell": round(B, 2),
                       "angle_dispersion_deg": round(A, 1), "mean_circularity": round(C, 3)},
            "mock": True}


def cell_nti(c) -> float:
    L, B, C = c.get("neurite_length_px", 0), c.get("branches", 0), c["circularity"]
    s = 0.5 - 0.22 * math.tanh((L - REF["neurite_length"]) / REF["neurite_length"]) \
        - 0.12 * math.tanh((B - REF["branching"]) / REF["branching"]) \
        + 0.20 * math.tanh((C - REF["circularity"]) / 0.15)
    return round(min(1.0, max(0.0, s)), 3)


# ---------------------------------------------------------------------- run
def run(image_id: str, path: str | Path, out_dir: str | Path, emit: Emit,
        cancelled: Cancelled = lambda: False, stream_tiles: bool = True,
        tile_delay: float = 0.0) -> dict:
    """Run S0-S5 on one image, emitting contract events; writes layer PNGs and
    result.json into out_dir. Raises JobCancelled when cancelled() turns True."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    timings: dict[str, float] = {}

    def stage(code, label, fn):
        if cancelled():
            raise JobCancelled()
        emit({"type": "stage", "stage": code, "label": label, "state": "running"})
        t = time.perf_counter()
        r = fn()
        ms = round((time.perf_counter() - t) * 1000)
        timings[code] = ms
        emit({"type": "stage", "stage": code, "label": label, "state": "done", "ms": ms})
        return r

    rgb, um, _ = stage("S0", "Decode image", lambda: read_image(path))
    h, w = rgb.shape[:2]
    emit({"type": "meta", "width": w, "height": h, "um_per_px": um, "tile": TILE})
    gray = intensity(rgb)
    pre, stats = stage("S1", "Background + noise model", lambda: prepare(gray))

    soma = np.zeros((h, w), bool)
    neur = np.zeros((h, w), bool)
    unc = np.zeros((h, w), np.float32)
    tiles = [(x, y) for y in range(0, h, TILE) for x in range(0, w, TILE)]

    def seg_all():
        run_cells = run_len = 0.0
        for i, (x0, y0) in enumerate(tiles):
            if cancelled():
                raise JobCancelled()
            x1, y1 = min(w, x0 + TILE), min(h, y0 + TILE)
            s, n, u = segment_tile(pre, stats, x0, y0, x1, y1)
            soma[y0:y1, x0:x1], neur[y0:y1, x0:x1], unc[y0:y1, x0:x1] = s, n, u
            if stream_tiles:
                run_cells += ndi.label(s)[1]
                run_len += float(n.sum()) * 0.5
                emit({"type": "tile", "i": i, "n": len(tiles), "x": x0, "y": y0,
                      "w": x1 - x0, "h": y1 - y0,
                      "png": base64.b64encode(encode_rgba(s, n, u)).decode("ascii"),
                      "running": {"cells": int(run_cells), "neurite_px": round(run_len)}})
                if tile_delay:
                    time.sleep(tile_delay)
            elif i % 4 == 3 or i == len(tiles) - 1:
                emit({"type": "progress", "i": i, "n": len(tiles)})   # light: no pixels

    stage("S2", "Tiled segmentation", seg_all)
    m = stage("S3", "Skeleton + clean-up", lambda: measure_all(pre, soma, neur, unc, um))
    # (measure_all does S3 and S4 together; S4 is reported separately for the UI)
    emit({"type": "stage", "stage": "S4", "label": "Morphometry", "state": "running"})
    for c in m["cells"]:
        c["nti"] = cell_nti(c)
    timings["S4"] = 0
    emit({"type": "stage", "stage": "S4", "label": "Morphometry", "state": "done", "ms": 0})
    nti = stage("S5", "NTI score", lambda: nti_score(m["cells"], m["neurites"], m["angles_deg"]))

    # layers on disk (same RGBA wire format as tiles)
    (out / "masks.png").write_bytes(encode_rgba(m["soma"], m["neur"], unc))
    Image.fromarray((m["skeleton"] * 255).astype(np.uint8)).save(out / "skeleton.png", compress_level=1)
    lab = m["soma_lab"].astype(np.uint32)
    lab_rgb = np.stack([lab & 255, (lab >> 8) & 255, np.zeros_like(lab)], axis=-1).astype(np.uint8)
    Image.fromarray(lab_rgb).save(out / "labels.png", compress_level=1)

    cells, neurites = m["cells"], m["neurites"]
    result = {
        "image_id": image_id,
        "model_version": MODEL_VERSION,
        "mock": True,
        "width": w, "height": h, "um_per_px": um,
        "cells": cells,
        "neurites": neurites,
        "junctions": m["junctions"],
        "endpoints": m["endpoints"],
        "angles_deg": m["angles_deg"],
        "nti": nti,
        "qc": m["qc"],
        "summary": {
            "cell_count": len(cells),
            "neurite_length_px": _summary([b["length_px"] for b in neurites]),
            "branches_per_cell": _summary([c["branches"] for c in cells]),
            "angle_deg": _summary(m["angles_deg"]),
            "soma_area_px": _summary([c["area_px"] for c in cells]),
            "soma_circularity": _summary([c["circularity"] for c in cells]),
            "tortuosity": _summary([b["tortuosity"] for b in neurites]),
            "junction_count": len(m["junctions"]),
            "endpoint_count": len(m["endpoints"]),
            "mean_uncertainty": round(float(unc[(m["soma"] | m["neur"])].mean()) if (m["soma"] | m["neur"]).any() else 0.0, 4),
        },
        "timings_ms": timings,
    }
    return result
