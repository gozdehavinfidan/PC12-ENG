"""CAMEX FastAPI server (localhost only).
CAMEX = Cellular Analysis of Morphology with XAI for PC12.

Contract (CLAUDE.md s4): heavy work is a job -> POST returns 202 {job_id} and
progress streams over SSE. Handlers only read cached files or hand work to
jobs.py / asyncio.to_thread, so the event loop always stays responsive.

  GET    /api/health                   model/worker state (badge in the top bar)
  GET    /api/images                   cohort list (+ NTI when cached)
  PATCH  /api/images/{id}              {condition}
  GET    /api/images/{id}/raw.png|thumb.png|clahe.png
  POST   /api/upload                   multipart file -> image meta
  POST   /api/infer                    {image_id} -> 202 {job_id}
  GET    /api/jobs, /api/jobs/{id}     DELETE /api/jobs/{id} = cancel
  GET    /api/events[?job_id=]         SSE: one job's stream, or global job/image feed
  GET    /api/results/{id}             s8 result JSON
  GET    /api/layers/{id}/{name}.png   masks | skeleton | labels
  POST   /api/roi                      ROI metrics
  GET    /api/export/{id}/{kind}       cells.csv | neurites.csv | report.txt
  GET    /api/similarity               per-cell feature atlas (PCA), k-NN, group distances
  GET    /api/review/queue             images by uncertainty + review status
  POST   /api/label/{id}               annotation (versioned _seg files)
  GET    /api/preproc                  active preprocessing config + schema + presets
  PUT    /api/preproc                  {preset, params} -> becomes the pipeline config
  POST   /api/preproc/presets          {name, params}   DELETE /api/preproc/presets/{name}
  POST   /api/preproc/preview          {image_id, params, roi?, mode} -> 202 {job_id}; SSE "preview"
"""
from __future__ import annotations

import asyncio
import csv
import io
import json
import multiprocessing as mp
import os
import sys
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pipeline  # noqa: E402
import preproc  # noqa: E402
import registry  # noqa: E402
from jobs import JobManager  # noqa: E402

STATIC = registry.APP_DIR / "static"
jobs = JobManager(tile_delay=float(os.environ.get("CAMEX_TILE_DELAY") or os.environ.get("INTELLICELL_TILE_DELAY", "0.04")))
SRC: dict[str, Path] = {}
ACTIVE: dict = {"preset": "default", "params": preproc.defaults()}   # loaded in lifespan


def _version() -> str:
    return pipeline.model_version(ACTIVE["params"])


def _ctx(image_id: str) -> dict:
    """What the pipeline needs to know about an image beyond its pixels."""
    m = registry.meta(image_id) or {}
    ctx = {"modality": m.get("modality"), "preset": ACTIVE["preset"]}
    if "um_per_px" in m:
        ctx["um_per_px"] = m["um_per_px"]
    return ctx


def _submit(image_id: str, priority: str):
    return jobs.submit(image_id, str(SRC[image_id]), str(registry.folder(image_id)), priority=priority,
                       cfg=ACTIVE["params"], ctx=_ctx(image_id))


# ---------------------------------------------------------------- bootstrap
def _bootstrap_scan() -> None:
    """Thread: directory scan and cache freshness checks touch the disk and
    must not freeze the event loop."""
    src = registry.sources()
    plan = []
    for image_id, path in src.items():
        if registry.meta(image_id) is None:
            plan.append((image_id, "prepare"))
        elif not registry.is_fresh(image_id, path, _version()):
            plan.append((image_id, "infer"))
    jobs.loop.call_soon_threadsafe(_bootstrap_apply, src, plan)


def _bootstrap_apply(src: dict, plan: list) -> None:
    SRC.update(src)
    for image_id, action in plan:
        if action == "prepare":
            jobs.prepare(image_id, str(SRC[image_id]), lambda f, i=image_id: _prepared(i, f))
        else:
            _queue_background(image_id)


def _prepared(image_id: str, fut) -> None:
    if fut.exception():
        jobs._broadcast({"type": "image_error", "image_id": image_id, "message": str(fut.exception())})
        return
    jobs._broadcast({"type": "image", "image": registry.meta(image_id)})
    if not registry.is_fresh(image_id, SRC[image_id], _version()):
        _queue_background(image_id)


def _queue_background(image_id: str) -> None:
    _submit(image_id, "background")


def _finished(job) -> None:
    m = registry.meta(job.image_id)
    if m:
        jobs._broadcast({"type": "image", "image": m})


@asynccontextmanager
async def lifespan(app: FastAPI):
    registry.purge_legacy()
    registry.IMAGES.mkdir(parents=True, exist_ok=True)
    registry.UPLOADS.mkdir(parents=True, exist_ok=True)
    ACTIVE.update(preproc.load_active())
    jobs.on_finish = _finished
    jobs.start(asyncio.get_running_loop())
    threading.Thread(target=_bootstrap_scan, daemon=True, name="bootstrap").start()
    yield
    jobs.shutdown()


# Swagger/ReDoc load from a CDN -> disabled: the app must work fully offline.
app = FastAPI(title="CAMEX", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


def _need(image_id: str) -> Path:
    d = registry.folder(image_id)
    if image_id not in SRC and not d.exists():
        raise HTTPException(404, f"unknown image {image_id}")
    return d


def _result(image_id: str) -> dict:
    f = _need(image_id) / "result.json"
    if not f.exists():
        raise HTTPException(404, "no result yet")
    return json.loads(f.read_text(encoding="utf-8"))


# ------------------------------------------------------------------- health
@app.get("/api/health")
def health():
    active = [j.summary() for j in jobs.jobs.values() if j.state in ("queued", "running") and j.kind == "infer"]
    return {"status": "ok",
            "model": {"state": "ready" if jobs.ready else "warming", "version": _version(),
                      "provider": "classical pipeline", "preset": ACTIVE["preset"],
                      "runtime": "CPU", "warm_ms": jobs.warm_ms,
                      "workers": {"interactive": jobs.n_workers[0], "background": jobs.n_workers[1]}},
            "data_dir": str(registry.DATA_DIR), "images": len(SRC), "active_jobs": active}


# ------------------------------------------------------------------- images
@app.get("/api/images")
def images():
    out = []
    for image_id in SRC:
        m = registry.meta(image_id)
        out.append(m or {"id": image_id, "name": SRC[image_id].name, "pending": True})
    return out


@app.get("/api/images/{image_id}")
def image_meta(image_id: str):
    m = registry.meta(image_id)
    if not m:
        raise HTTPException(404, "not prepared yet")
    return m


@app.patch("/api/images/{image_id}")
async def image_patch(image_id: str, request: Request):
    body = await request.json()
    cond = str(body.get("condition", "")).strip().lower()[:40]
    if not cond:
        raise HTTPException(400, "condition required")
    registry.set_condition(image_id, cond)
    m = registry.meta(image_id)
    jobs._broadcast({"type": "image", "image": m})
    return m


async def _ensure_prepared(image_id: str) -> Path:
    d = _need(image_id)
    if not (d / "raw.png").exists():
        await asyncio.to_thread(registry.prepare, image_id, SRC[image_id])
    return d


@app.get("/api/images/{image_id}/raw.png")
async def image_raw(image_id: str):
    d = await _ensure_prepared(image_id)
    return FileResponse(d / "raw.png", media_type="image/png", headers={"Cache-Control": "max-age=3600"})


@app.get("/api/images/{image_id}/thumb.png")
async def image_thumb(image_id: str):
    d = await _ensure_prepared(image_id)
    return FileResponse(d / "thumb.png", media_type="image/png", headers={"Cache-Control": "max-age=3600"})


def _clahe(d: Path) -> None:
    from skimage import exposure

    rgb = np.asarray(Image.open(d / "raw.png").convert("RGB")).astype(np.float32) / 255
    v = rgb.max(axis=2)
    eq = exposure.equalize_adapthist(v, clip_limit=0.012)
    gain = np.where(v > 1e-4, eq / np.maximum(v, 1e-4), 0)[..., None]
    out = np.clip(rgb * gain, 0, 1)
    Image.fromarray((out * 255).astype(np.uint8)).save(d / "clahe.png", compress_level=1)


@app.get("/api/images/{image_id}/clahe.png")
async def image_clahe(image_id: str):
    d = await _ensure_prepared(image_id)
    if not (d / "clahe.png").exists():
        await asyncio.to_thread(_clahe, d)
    return FileResponse(d / "clahe.png", media_type="image/png")


@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    name = Path(file.filename or "upload.png")
    ext = name.suffix.lower()
    if ext not in registry.EXTS:
        raise HTTPException(415, f"unsupported file type {ext}")
    image_id = registry.slug(name.stem)
    if image_id in SRC and SRC[image_id].parent != registry.UPLOADS:
        image_id = f"{image_id}-u{int(time.time()) % 100000}"
    dest = registry.UPLOADS / f"{image_id}{ext}"

    def _save():
        import shutil

        with open(dest, "wb") as out:
            shutil.copyfileobj(file.file, out, 1024 * 1024)

    await asyncio.to_thread(_save)   # streamed to disk, off the event loop
    SRC[image_id] = dest
    m = await asyncio.to_thread(registry.prepare, image_id, dest)
    m = registry.meta(image_id) or m
    jobs._broadcast({"type": "image", "image": m})
    return m


# --------------------------------------------------------------------- jobs
@app.post("/api/infer", status_code=202)
async def infer(request: Request):
    body = await request.json()
    image_id = body.get("image_id")
    if image_id not in SRC:
        raise HTTPException(404, f"unknown image {image_id}")
    job = _submit(image_id, "interactive")
    return {"job_id": job.id, "image_id": image_id}


@app.get("/api/jobs")
def job_list():
    return [j.summary() for j in sorted(jobs.jobs.values(), key=lambda j: -j.created)[:200] if j.kind == "infer"]


@app.get("/api/jobs/{job_id}")
def job_get(job_id: str):
    j = jobs.jobs.get(job_id)
    if not j:
        raise HTTPException(404)
    return {**j.summary(), "outputs": {"result": f"/api/results/{j.image_id}",
                                       "masks": f"/api/layers/{j.image_id}/masks.png"} if j.state == "done" else None}


@app.delete("/api/jobs/{job_id}")
def job_cancel(job_id: str):
    return {"cancelled": jobs.cancel(job_id)}


@app.get("/api/events")
async def events(request: Request, job_id: str | None = None):
    if job_id:
        job = jobs.jobs.get(job_id)
        if not job:
            raise HTTPException(404)
        try:
            last = int(request.headers.get("last-event-id", "0"))
        except ValueError:
            last = 0
        q = jobs.subscribe(job, last)
        subs = job.subscribers
    else:
        q = asyncio.Queue()
        q.put_nowait((None, {"type": "model", "state": "ready" if jobs.ready else "warming", "warm_ms": jobs.warm_ms}))
        jobs.global_subs.add(q)
        subs = jobs.global_subs

    async def stream():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    idx, ev = await asyncio.wait_for(q.get(), 15)
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
                    continue
                head = f"id: {idx}\n" if idx is not None else ""
                yield f"{head}data: {json.dumps(ev, separators=(',', ':'))}\n\n"
                if job_id and ev.get("type") in ("done", "error", "cancelled"):
                    break
        finally:
            subs.discard(q)

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ------------------------------------------------------------------ results
@app.get("/api/results/{image_id}")
def result(image_id: str):
    return JSONResponse(_result(image_id))


@app.get("/api/layers/{image_id}/{name}.png")
def layer(image_id: str, name: str):
    if name not in ("masks", "skeleton", "labels"):
        raise HTTPException(404)
    f = _need(image_id) / f"{name}.png"
    if not f.exists():
        raise HTTPException(404, "no result yet")
    return FileResponse(f, media_type="image/png")


def _roi_metrics(image_id: str, poly: list) -> dict:
    from skimage.draw import polygon as draw_polygon

    d = registry.folder(image_id)
    m = np.asarray(Image.open(d / "masks.png"))
    r = json.loads((d / "result.json").read_text(encoding="utf-8"))
    h, w = m.shape[:2]
    xs = np.array([p[0] for p in poly], float)
    ys = np.array([p[1] for p in poly], float)
    rr, cc = draw_polygon(ys, xs, (h, w))
    roi = np.zeros((h, w), bool)
    roi[rr, cc] = True
    area = int(roi.sum()) or 1
    soma, neur, unc = m[..., 0] > 0, m[..., 1] > 0, m[..., 2] / 255.0
    fg = (soma | neur) & roi

    def inside(x, y):
        xi, yi = int(round(x)), int(round(y))
        return 0 <= xi < w and 0 <= yi < h and roi[yi, xi]

    cells = [c for c in r["cells"] if inside(*c["centroid"])]
    brs = [b for b in r["neurites"] if inside(*b["polyline"][len(b["polyline"]) // 2])]
    juncs = [j for j in r["junctions"] if inside(j["x"], j["y"])]
    from scipy import ndimage as ndi

    ncomp = ndi.label(fg, structure=np.ones((3, 3)))[1]
    return {
        "area_px": area,
        "fg_ratio": round(float(fg.sum()) / area, 4),
        "soma_px": int((soma & roi).sum()), "neurite_px": int((neur & roi).sum()),
        "mean_conf": round(float(1 - unc[fg].mean() * 0.6), 3) if fg.any() else None,
        "components": int(ncomp),
        "cells": len(cells),
        "mean_soma_area_px": round(float(np.mean([c["area_px"] for c in cells])), 1) if cells else None,
        "mean_circularity": round(float(np.mean([c["circularity"] for c in cells])), 3) if cells else None,
        "neurites": len(brs),
        "neurite_length_px": round(sum(b["length_px"] for b in brs), 1),
        "junctions": len(juncs),
        "angles_deg": [a for j in juncs for a in j["angles_deg"]],
    }


@app.post("/api/roi")
async def roi(request: Request):
    body = await request.json()
    image_id, poly = body.get("image_id"), body.get("polygon") or []
    if len(poly) < 3:
        raise HTTPException(400, "polygon needs >= 3 points")
    _result(image_id)
    return await asyncio.to_thread(_roi_metrics, image_id, poly)


# ------------------------------------------------------------------- export
@app.get("/api/export/{image_id}/{kind}")
def export(image_id: str, kind: str):
    r = _result(image_id)
    um = r.get("um_per_px")
    if kind == "cells.csv":
        buf = io.StringIO()
        wr = csv.writer(buf)
        wr.writerow(["cell_id", "x", "y", "area_px", "area_um2", "circularity", "eccentricity", "category",
                     "neurite_length_px", "branches", "confidence", "cell_nti", "outlier", "preproc_hash"])
        for c in r["cells"]:
            wr.writerow([c["id"], c["centroid"][0], c["centroid"][1], c["area_px"],
                         round(c["area_px"] * um * um, 2) if um else "", c["circularity"], c["eccentricity"],
                         c["category"], c["neurite_length_px"], c["branches"], c["confidence"], c["nti"],
                         int(c["outlier"]), (r.get("preproc") or {}).get("hash", "")])
        return Response(buf.getvalue(), media_type="text/csv",
                        headers={"Content-Disposition": f'attachment; filename="{image_id}_cells.csv"'})
    if kind == "neurites.csv":
        buf = io.StringIO()
        wr = csv.writer(buf)
        wr.writerow(["branch_id", "cell_id", "length_px", "length_um", "tortuosity", "orientation_deg",
                     "junctions", "endpoints", "preproc_hash"])
        for b in r["neurites"]:
            wr.writerow([b["id"], b.get("cell_id") or "", b["length_px"],
                         round(b["length_px"] * um, 2) if um else "", b["tortuosity"],
                         b["orientation_deg"], b["junctions"], b["endpoints"], (r.get("preproc") or {}).get("hash", "")])
        return Response(buf.getvalue(), media_type="text/csv",
                        headers={"Content-Disposition": f'attachment; filename="{image_id}_neurites.csv"'})
    if kind == "report.txt":
        s = r["summary"]
        pp = r.get("preproc") or {}
        lines = [f"CAMEX report - {image_id}", "Cellular Analysis of Morphology with XAI for PC12", "",
                 f"pipeline: {r['model_version']}  (classical segmentation, preset '{pp.get('preset', 'default')}')",
                 f"image: {r['width']}x{r['height']} px, scale: {um:.4f} um/px" if um else f"image: {r['width']}x{r['height']} px, scale: uncalibrated (px units)", "",
                 f"NTI score: {r['nti']['score']:.3f}  (uncalibrated formula: weights not yet fitted to the TUSEB reference)" if r['nti']['score'] is not None else "NTI score: n/a (no somata detected)"]
        lines += [f"  contribution {k:<15} {v:+.3f}" for k, v in r["nti"]["contrib"].items()]
        lines += ["", f"cells: {s['cell_count']}   junctions: {s['junction_count']}   endpoints: {s['endpoint_count']}"]
        for key, label in (("neurite_length_px", "neurite length (px)"), ("branches_per_cell", "branches / cell"),
                           ("angle_deg", "branching angle (deg)"), ("soma_area_px", "soma area (px)"),
                           ("soma_circularity", "soma circularity")):
            v = s[key]
            lines.append(f"{label:<24} mean {v['mean']:.2f}  median {v['median']:.2f}  std {v['std']:.2f}  CV {v['cv']:.2f}  n {v['n']}")
        lines += ["", "QC:"] + [f"  {k}: {v}" for k, v in r["qc"].items() if k != "warnings"]
        lines += [f"  WARNING {w['code']}: {w['text']}" for w in r["qc"]["warnings"]] or ["  no warnings"]
        if pp.get("params"):
            lines += ["", "Preprocessing parameters:"]
            lines += [f"  {sec}.{k} = {v}" for sec, kv in pp["params"].items() for k, v in kv.items()]
        return PlainTextResponse("\n".join(lines) + "\n",
                                 headers={"Content-Disposition": f'attachment; filename="{image_id}_report.txt"'})
    raise HTTPException(404)


# --------------------------------------------------------------- similarity
FEATURES = ["area_px", "circularity", "eccentricity", "neurite_length_px", "branches", "nti"]
_sim_cache: dict = {}


GROUP_KEYS = ("condition", "group", "modality", "batch")


def _similarity(group: str | None = None) -> dict:
    stamp = tuple(sorted((i, (registry.folder(i) / "result.json").stat().st_mtime)
                         for i in SRC if (registry.folder(i) / "result.json").exists()))
    cond = registry.conditions()
    key = (stamp, json.dumps(cond, sort_keys=True), group)
    if _sim_cache.get("key") == key:
        return _sim_cache["value"]
    rows, X = [], []
    for image_id, _ in stamp:
        r = json.loads((registry.folder(image_id) / "result.json").read_text(encoding="utf-8"))
        m = registry.meta(image_id) or {}
        for c in r["cells"]:
            rows.append({"image_id": image_id, "cell_id": c["id"], "bbox": c["bbox"],
                         "centroid": c["centroid"], "batch": m.get("batch", "unknown"),
                         "condition": m.get("condition", "unassigned"), "outlier": c["outlier"],
                         "group": m.get("group") or "unknown", "modality": m.get("modality") or "unknown",
                         **{f: c.get(f, 0) for f in FEATURES}})
            X.append([float(c.get(f, 0) or 0) for f in FEATURES])
    if len(X) < 3:
        return {"cells": [], "features": FEATURES, "groups": [], "method": "pca", "group_key": group or "condition"}
    X = np.asarray(X)
    X[:, 0] = np.log1p(X[:, 0])
    X[:, 3] = np.log1p(X[:, 3])
    med = np.median(X, axis=0)
    mad = np.median(np.abs(X - med), axis=0) * 1.4826
    mad[mad < 1e-9] = X.std(axis=0)[mad < 1e-9] + 1e-9
    # robust z, clipped: one pathological cell must not define the atlas axes
    Z = np.clip((X - med) / mad, -5, 5)
    Zc = Z - Z.mean(axis=0)
    _, S, Vt = np.linalg.svd(Zc, full_matrices=False)
    P = Zc @ Vt[:2].T
    var = (S ** 2) / (S ** 2).sum()
    # k-NN (k=5) in standardized feature space, chunked to bound memory
    k = min(5, len(Z) - 1)
    nn_idx = np.zeros((len(Z), k), int)
    nn_d = np.zeros((len(Z), k))
    for s in range(0, len(Z), 512):
        D = np.sqrt(((Z[s:s + 512, None, :] - Z[None, :, :]) ** 2).sum(-1))
        for i in range(D.shape[0]):
            D[i, s + i] = np.inf
        idx = np.argpartition(D, k, axis=1)[:, :k]
        dd = np.take_along_axis(D, idx, 1)
        o = np.argsort(dd, axis=1)
        nn_idx[s:s + 512] = np.take_along_axis(idx, o, 1)
        nn_d[s:s + 512] = np.take_along_axis(dd, o, 1)
    robust_r = np.sqrt((Z ** 2).mean(axis=1))
    # group distances: by condition when >= 2 real conditions exist, else by batch
    conds = sorted({r["condition"] for r in rows if r["condition"] != "unassigned"})
    group_key = group if group in GROUP_KEYS else ("condition" if len(conds) >= 2 else "batch")
    labels = np.array([r[group_key] for r in rows])
    names = [g for g in sorted(set(labels)) if (labels == g).sum() >= 3]
    groups = []
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            A, B = Z[labels == a], Z[labels == b]
            delta = A.mean(axis=0) - B.mean(axis=0)
            spread = np.sqrt((A.var(axis=0) + B.var(axis=0)) / 2) + 1e-9
            groups.append({"a": a, "b": b, "n_a": int(len(A)), "n_b": int(len(B)),
                           "distance": round(float(np.linalg.norm(delta / spread) / np.sqrt(len(FEATURES))), 3),
                           "per_feature": {f: round(float(d / s), 3) for f, d, s in zip(FEATURES, delta, spread)}})
    groups.sort(key=lambda g: -g["distance"])
    for i, r in enumerate(rows):
        r["xy"] = [round(float(P[i, 0]), 4), round(float(P[i, 1]), 4)]
        r["nn"] = [[int(j), round(float(d), 3)] for j, d in zip(nn_idx[i], nn_d[i])]
        r["robust_dist"] = round(float(robust_r[i]), 3)
        r["outlier"] = bool(r["outlier"] or robust_r[i] > 4.0)
    value = {"cells": rows, "features": FEATURES, "method": "pca",
             "explained_variance": [round(float(v), 3) for v in var[:2]], "group_key": group_key,
             "groups": groups, "batches": sorted({r["batch"] for r in rows}),
             "conditions": sorted({r["condition"] for r in rows})}
    _sim_cache.update(key=key, value=value)
    return value


@app.get("/api/similarity")
async def similarity(group: str | None = None):
    return await asyncio.to_thread(_similarity, group)


# ------------------------------------------------------------------- review
@app.get("/api/review/queue")
def review_queue():
    items = []
    for image_id in SRC:
        m = registry.meta(image_id)
        if m and m.get("has_result"):
            items.append({"id": image_id, "name": m["name"], "mean_uncertainty": m.get("mean_uncertainty", 0),
                          "cell_count": m.get("cell_count", 0), "status": m.get("review", "pending"),
                          "model_version": m.get("model_version")})
    items.sort(key=lambda x: (x["status"] != "pending", -x["mean_uncertainty"]))
    return items


@app.get("/api/label/{image_id}")
def label_get(image_id: str):
    f = registry.LABELS / f"{image_id}_seg.json"
    if not f.exists():
        return {"status": "pending", "has_annotation": False}
    return {**json.loads(f.read_text(encoding="utf-8")), "has_annotation": (registry.LABELS / f"{image_id}_seg.png").exists()}


@app.get("/api/label/{image_id}/annotation.png")
def label_png(image_id: str):
    f = registry.LABELS / f"{image_id}_seg.png"
    if not f.exists():
        raise HTTPException(404)
    return FileResponse(f, media_type="image/png", headers={"Cache-Control": "no-store"})


@app.post("/api/label/{image_id}")
async def label_post(image_id: str, status: str = Form(...), issues: str = Form("[]"),
                     note: str = Form(""), annotation: UploadFile | None = File(None)):
    """prediction (immutable, carries model_version) vs annotation (edited by a
    human) are stored separately; every save is also kept in history/."""
    _result(image_id)
    if status not in ("approved", "corrected", "issue", "pending"):
        raise HTTPException(400, "bad status")
    registry.LABELS.mkdir(parents=True, exist_ok=True)
    hist = registry.LABELS / "history"
    hist.mkdir(exist_ok=True)
    ts = time.strftime("%Y%m%d-%H%M%S")
    if annotation is not None:
        data = await annotation.read()
        (registry.LABELS / f"{image_id}_seg.png").write_bytes(data)
        (hist / f"{image_id}_{ts}.png").write_bytes(data)
    rec = {"image_id": image_id, "status": status, "issues": json.loads(issues or "[]"), "note": note[:2000],
           "prediction_model_version": _result(image_id)["model_version"], "saved": ts}
    (registry.LABELS / f"{image_id}_seg.json").write_text(json.dumps(rec, indent=1), encoding="utf-8")
    (hist / f"{image_id}_{ts}.json").write_text(json.dumps(rec, indent=1), encoding="utf-8")
    registry._summary_cache.pop(image_id, None)
    jobs._broadcast({"type": "image", "image": registry.meta(image_id)})
    return rec


# ------------------------------------------------------------ preprocessing
def _stale_ids() -> list[str]:
    v = _version()
    out = []
    for image_id in SRC:
        m = registry.meta(image_id)
        if m and m.get("has_result") and m.get("model_version") != v:
            out.append(image_id)
    return out


@app.get("/api/preproc")
def preproc_get():
    return {"preset": ACTIVE["preset"], "params": ACTIVE["params"], "hash": preproc.cfg_hash(ACTIVE["params"]),
            "version": _version(), "schema": preproc.SCHEMA, "defaults": preproc.defaults(),
            "presets": preproc.list_presets(), "stale": len(_stale_ids())}


@app.put("/api/preproc")
async def preproc_put(request: Request):
    """The posted config becomes the pipeline config for every later analysis.
    Existing results are kept but reported stale (their model_version differs)."""
    body = await request.json()
    rec = await asyncio.to_thread(preproc.save_active, str(body.get("preset") or "custom")[:40], body.get("params") or {})
    ACTIVE.update(rec)
    # jobs that have not started yet would run with the old settings: resubmit
    # them (submit() supersedes the queued job of the same image)
    for j in list(jobs.jobs.values()):
        if j.kind == "infer" and j.state == "queued" and j.image_id in SRC:
            _submit(j.image_id, j.priority)
    stale = await asyncio.to_thread(_stale_ids)
    jobs._broadcast({"type": "preproc", "preset": ACTIVE["preset"], "version": _version(), "stale": len(stale)})
    return {**rec, "hash": preproc.cfg_hash(rec["params"]), "version": _version(), "stale": len(stale)}


@app.post("/api/preproc/presets")
async def preset_save(request: Request):
    body = await request.json()
    try:
        return await asyncio.to_thread(preproc.save_preset, str(body.get("name") or ""), body.get("params") or {})
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.delete("/api/preproc/presets/{name}")
def preset_delete(name: str):
    return {"deleted": preproc.delete_preset(name)}


@app.post("/api/preproc/preview", status_code=202)
async def preproc_preview(request: Request):
    body = await request.json()
    image_id = body.get("image_id")
    if image_id not in SRC:
        raise HTTPException(404, f"unknown image {image_id}")
    mode = body.get("mode") if body.get("mode") in ("preview", "try_all") else "preview"
    d = await _ensure_prepared(image_id)
    ctx = _ctx(image_id)
    job = jobs.submit_preview(image_id, str(d / "raw.png"), preproc.normalize(body.get("params")),
                              body.get("roi"), mode, ctx)
    return {"job_id": job.id, "image_id": image_id}


@app.post("/api/reanalyse", status_code=202)
async def reanalyse(request: Request):
    """Queue background re-analysis. scope: stale (results from an older config),
    pending (never analysed) or all."""
    body = await request.json()
    scope = body.get("scope", "stale")
    if scope == "stale":
        ids = await asyncio.to_thread(_stale_ids)
    else:
        def pick():
            return [i for i in SRC if scope == "all" or not (registry.meta(i) or {}).get("has_result")]
        ids = await asyncio.to_thread(pick)
    for image_id in ids:
        _queue_background(image_id)
    return {"queued": len(ids)}


# ------------------------------------------------------------------- static
@app.middleware("http")
async def _no_stale_shell(request: Request, call_next):
    """index.html must always be revalidated, otherwise a rebuilt UI keeps
    loading the previous bundle; hashed /assets/* files stay cacheable."""
    resp = await call_next(request)
    p = request.url.path
    if not p.startswith("/api/") and not p.startswith("/assets/"):
        resp.headers["Cache-Control"] = "no-cache"
    return resp


if STATIC.exists():
    app.mount("/", StaticFiles(directory=STATIC, html=True), name="static")


def serve(port: int = 8765) -> None:
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


if __name__ == "__main__":
    mp.freeze_support()
    serve(int(os.environ.get("CAMEX_PORT") or os.environ.get("INTELLICELL_PORT", "8765")))
