"""Image registry + on-disk cache (CLAUDE.md s4.5).

Every image gets a lowercase-ASCII id and a cache folder:

  cache/images/<id>/meta.json     name, size, um/px, acquisition date, batch
                    raw.png       browser-decodable full image (CZI is not)
                    thumb.png     filmstrip thumbnail
                    result.json   pipeline result (s8 schema, mock: true)
                    masks.png     RGBA wire format: R soma, G neurite, B uncertainty
                    skeleton.png  labels.png

cache/ is git-ignored: raw microscopy must never reach the public repository.
When no data folder exists (public clone), a synthetic cohort is generated so
the app still demos.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import threading
import unicodedata
from pathlib import Path

from PIL import Image

APP_DIR = Path(__file__).resolve().parents[1]
CACHE = Path(os.environ.get("INTELLICELL_CACHE", APP_DIR / "cache"))
DATA_DIR = Path(os.environ.get("INTELLICELL_DATA", APP_DIR.parent / "datas"))
IMAGES = CACHE / "images"
LABELS = CACHE / "labels"
UPLOADS = CACHE / "uploads"
SYNTH = CACHE / "synthetic"
EXTS = {".czi", ".png", ".tif", ".tiff", ".jpg", ".jpeg"}
THUMB_H = 180

_lock = threading.Lock()


def slug(name: str) -> str:
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s or hashlib.md5(name.encode()).hexdigest()[:8]


def folder(image_id: str) -> Path:
    return IMAGES / image_id


def sources() -> dict[str, Path]:
    """id -> source file. Real data if present, else the synthetic cohort."""
    out: dict[str, Path] = {}
    files = sorted(p for p in DATA_DIR.glob("*") if p.suffix.lower() in EXTS) if DATA_DIR.is_dir() else []
    if not files:
        if not (SYNTH / "manifest.json").exists():
            import synth

            synth.write_fixture_set(SYNTH, n=16)
        files = sorted(SYNTH.glob("*.png"))
    for p in files + sorted(UPLOADS.glob("*")):
        if p.suffix.lower() in EXTS:
            out[slug(p.stem)] = p
    return out


def _synthetic_condition(path: Path) -> str | None:
    man = SYNTH / "manifest.json"
    if path.parent != SYNTH or not man.exists():
        return None
    for row in json.loads(man.read_text()):
        if row["file"] == path.name:
            return "synthetic-treated" if row["toxicity"] > 0.5 else "synthetic-control"
    return None


def prepare(image_id: str, src: str | Path) -> dict:
    """Decode once, write raw.png + thumb.png + meta.json. Runs in a worker."""
    from pipeline import read_image

    src = Path(src)
    d = folder(image_id)
    d.mkdir(parents=True, exist_ok=True)
    rgb, um, acquired = read_image(src)
    img = Image.fromarray(rgb)
    img.save(d / "raw.png", compress_level=1)
    tw = round(img.width * THUMB_H / img.height)
    img.resize((tw, THUMB_H), Image.LANCZOS).save(d / "thumb.png")
    variant = bool(re.search(r"-(background|color|deblur|gauss)", src.stem, re.I))
    meta = {
        "id": image_id,
        "name": src.name,
        "source": str(src),
        "width": img.width,
        "height": img.height,
        "um_per_px": um,
        "acquired": acquired,
        "batch": (acquired or "unknown")[:10] if acquired else ("synthetic" if src.parent == SYNTH else "upload"),
        "variant": variant,
        "condition": _synthetic_condition(src) or "unassigned",
        "source_mtime": src.stat().st_mtime,
    }
    (d / "meta.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    return meta


def meta(image_id: str) -> dict | None:
    f = folder(image_id) / "meta.json"
    if not f.exists():
        return None
    m = json.loads(f.read_text(encoding="utf-8"))
    cond = conditions().get(image_id)
    if cond:
        m["condition"] = cond
    r = folder(image_id) / "result.json"
    m["has_result"] = r.exists()
    if r.exists():
        s = _result_summary(image_id)
        m.update(s)
    return m


_summary_cache: dict[str, tuple[float, dict]] = {}


def _result_summary(image_id: str) -> dict:
    f = folder(image_id) / "result.json"
    mt = f.stat().st_mtime
    hit = _summary_cache.get(image_id)
    if hit and hit[0] == mt:
        return hit[1]
    r = json.loads(f.read_text(encoding="utf-8"))
    s = {"nti": r["nti"]["score"], "cell_count": r["summary"]["cell_count"],
         "mean_uncertainty": r["summary"]["mean_uncertainty"],
         "qc_warnings": len(r["qc"]["warnings"]), "model_version": r["model_version"],
         "review": review_status(image_id)}
    _summary_cache[image_id] = (mt, s)
    return s


def is_fresh(image_id: str, src: Path, model_version: str) -> bool:
    f = folder(image_id) / "result.json"
    if not f.exists():
        return False
    try:
        r = json.loads(f.read_text(encoding="utf-8"))
    except Exception:
        return False
    return r.get("model_version") == model_version and f.stat().st_mtime >= src.stat().st_mtime


def conditions() -> dict:
    f = CACHE / "conditions.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}


def set_condition(image_id: str, condition: str) -> None:
    with _lock:
        c = conditions()
        c[image_id] = condition
        CACHE.mkdir(parents=True, exist_ok=True)
        (CACHE / "conditions.json").write_text(json.dumps(c, indent=1), encoding="utf-8")


def review_status(image_id: str) -> str:
    f = LABELS / f"{image_id}_seg.json"
    if not f.exists():
        return "pending"
    return json.loads(f.read_text(encoding="utf-8")).get("status", "pending")
