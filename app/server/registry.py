"""Image registry + on-disk cache (CLAUDE.md s4.5).

Every image gets a lowercase-ASCII id and a cache folder:

  cache/images/<id>/meta.json     name, size, um/px, acquisition date, batch
                    raw.png       browser-decodable full image (CZI is not)
                    thumb.png     filmstrip thumbnail
                    result.json   pipeline result (s8 schema)
                    masks.png     RGBA wire format: R soma, G neurite, B uncertainty
                    skeleton.png  labels.png

cache/ is git-ignored: raw microscopy must never reach the public repository.
Real micrographs come from DATA_DIR (manifest-driven, group D excluded).
"""
from __future__ import annotations

import hashlib
import csv
import json
import os
import re
import shutil
import threading
import unicodedata
from pathlib import Path

from PIL import Image

APP_DIR = Path(__file__).resolve().parents[1]
CACHE = Path(os.environ.get("CAMEX_CACHE") or os.environ.get("INTELLICELL_CACHE", APP_DIR / "cache"))
DATA_DIR = Path(os.environ.get("CAMEX_DATA") or os.environ.get("INTELLICELL_DATA", APP_DIR.parent / "PC12_resimler"))
IMAGES = CACHE / "images"
LABELS = CACHE / "labels"
UPLOADS = CACHE / "uploads"
MANIFEST: dict[str, dict] = {}
EXTS = {".czi", ".png", ".tif", ".tiff", ".jpg", ".jpeg"}
THUMB_H = 180

_lock = threading.Lock()


def slug(name: str) -> str:
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s or hashlib.md5(name.encode()).hexdigest()[:8]


def folder(image_id: str) -> Path:
    return IMAGES / image_id


def _load_manifest() -> dict[str, dict]:
    """id -> manifest row (group D excluded), in manifest order. Empty when no manifest."""
    f = DATA_DIR / "metadata" / "pc12_benzersiz_goruntuler.csv"
    if not f.exists():
        return {}
    with open(f, encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))
    out: dict[str, dict] = {}
    for r in rows:
        if (r.get("grup") or "").strip() == "D":
            continue
        i = slug(r["goruntu_id"])
        if i in out:
            i = f"{i}-{(r.get('piksel_hash') or '')[:6]}"
        r["_path"] = _first_existing(r.get("tum_konumlar") or "")
        if r["_path"] is not None:
            out[i] = r
    return out


def _first_existing(locations: str) -> Path | None:
    for loc in locations.split(" | "):
        loc = loc.strip()
        if loc and (DATA_DIR / loc).is_file():
            return DATA_DIR / loc
    return None


def sources() -> dict[str, Path]:
    """id -> source file: the manifest's non-D images, else a recursive scan; plus uploads."""
    MANIFEST.clear()
    MANIFEST.update(_load_manifest())
    out: dict[str, Path] = {i: r["_path"] for i, r in MANIFEST.items()}
    if not out and DATA_DIR.is_dir():
        for p in sorted(DATA_DIR.rglob("*")):
            if p.suffix.lower() in EXTS and "trash" not in p.parts:
                out[slug(p.stem)] = p
    if UPLOADS.is_dir():
        for p in sorted(UPLOADS.glob("*")):
            if p.suffix.lower() in EXTS:
                out[slug(p.stem)] = p
    return out


def purge_legacy() -> None:
    """Drop the synthetic cohort and its cached images left by older versions."""
    shutil.rmtree(CACHE / "synthetic", ignore_errors=True)
    if IMAGES.is_dir():
        for d in IMAGES.glob("synth-*"):
            shutil.rmtree(d, ignore_errors=True)


def _modality(raw: str | None) -> str | None:
    if not raw:
        return None
    low = raw.strip().lower()
    if low.startswith("floresan"):
        return "fluorescence"
    if "faz" in low or "phase" in low:
        return "phase-contrast"
    return low


def _float(v: str | None) -> float | None:
    try:
        return float(v) if v not in (None, "") else None
    except ValueError:
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
    row = MANIFEST.get(image_id)
    if row is None:
        sources()
        row = MANIFEST.get(image_id)
    if row:
        date = acquired or row.get("cekim_zamani") or ""
        grup = (row.get("grup") or "").strip() or None
        um = _float(row.get("calisma_um_px"))
        variant = (row.get("turev") or "").strip() or None
        batch = date[:10] or "unknown"
    else:
        grup = None
        variant = "variant" if re.search(r"-(background|color|deblur|gauss)", src.stem, re.I) else None
        batch = acquired[:10] if acquired else "upload"
    raw_mod = (row.get("modalite") or "").strip() or None if row else None
    meta = {
        "meta_version": 2,
        "id": image_id,
        "name": src.name,
        "source": str(src),
        "width": img.width,
        "height": img.height,
        "um_per_px": um,
        "acquired": acquired,
        "batch": batch,
        "group": grup,
        "modality": _modality(raw_mod),
        "modality_label": raw_mod,
        "variant": variant,
        "qc_flag": ((row.get("qc_bayrak") or "").strip() or None) if row else None,
        "training_hint": ((row.get("egitim_onerisi") or "").strip() or None) if row else None,
        "exposure_ms": _float(row.get("pozlama_ms")) if row else None,
        "condition": "unassigned",
        "source_mtime": src.stat().st_mtime,
    }
    (d / "meta.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    return meta


# The manifest is written in Turkish; the UI is English (deliverables rule).
_EN = {
    "Floresan (yesil)": "Fluorescence (green)",
    "Faz-kontrast / parlak alan": "Phase contrast / bright field",
    "grup-ici bulanik": "blurry within group",
    "vinyet": "vignetting",
    "Evet": "yes",
    "Evet - QC kontrol": "yes, after QC check",
    "HAYIR - ZEN islenmis turev (kaynagiyla ayni alan, sizinti)":
        "no: ZEN-processed derivative of the same field (leakage risk)",
}


def _english(m: dict) -> dict:
    for k in ("modality_label", "qc_flag", "training_hint"):
        if m.get(k) in _EN:
            m[k] = _EN[m[k]]
    # the batch is the acquisition date; the session-group letter is not shown
    if isinstance(m.get("batch"), str):
        m["batch"] = re.sub(r"^[A-Z] · ", "", m["batch"])
    return m


def meta(image_id: str) -> dict | None:
    f = folder(image_id) / "meta.json"
    if not f.exists():
        return None
    m = json.loads(f.read_text(encoding="utf-8"))
    if m.get("meta_version") != 2:
        return None
    cond = conditions().get(image_id)
    if cond:
        m["condition"] = cond
    r = folder(image_id) / "result.json"
    m["has_result"] = r.exists()
    if r.exists():
        s = _result_summary(image_id)
        m.update(s)
    return _english(m)


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
