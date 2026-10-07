# CAMEX — offline desktop app (D16 stack, D17 UI, D25)

**CAMEX** = Cellular Analysis of Morphology with XAI for PC12 (formerly IntelliCell).

PC12 micrographs → soma + neurite segmentation → 4 NTI parameters → NTI score.
Everything runs on this computer: React UI ↔ FastAPI on `127.0.0.1` ↔ pipeline
worker processes. **No trained model yet**: the backend runs a classical pipeline
(scikit-image, user-configurable on the Preprocess screen) behind the real contract.
The NTI is an **uncalibrated formula** (`calibrated: false`) until the TÜSEB fit exists.

## Start

```bat
launcher\run.bat          :: first run: creates app\.venv, builds the UI once (needs Node.js), opens the window
launcher\build.bat        :: PyInstaller onedir build -> app\dist\CAMEX\CAMEX.exe
```

Development (two terminals):

```bash
cd app/server && ../.venv/Scripts/python main.py      # API on :8765 (also serves app/static)
cd app/web && npm run dev                             # UI on :5173, proxies /api
npm test                                              # SSE contract tests (fixture replay)
```

Environment: `CAMEX_DATA`, `CAMEX_CACHE`, `CAMEX_PORT`, `CAMEX_TILE_DELAY`, `CAMEX_BROWSER`
(the old `INTELLICELL_*` names are still accepted as fallbacks).

## Data

Real data only, no synthetic cohort. Default data folder: `pc12-arch/PC12_resimler`
(override with `CAMEX_DATA`). The registry reads
`PC12_resimler/metadata/pc12_benzersiz_goruntuler.csv` (130 pixel-unique images) and
excludes group D (trash, "Ayrı tut"), leaving **120 images**:

| Group | Images | Modality | Scale |
|---|---|---|---|
| A | 86 | fluorescence | 0.185 µm/px |
| B | 16 | phase contrast | 0.0925 µm/px (CSV marks it DOGRULA [VERIFY]) |
| C | 18 | fluorescence | blank in CSV → shown as "uncalibrated", px units |

ZEN-processed derivatives (Gauss / Deblurring / Rolling ball) are kept and tagged `variant`.
`meta.json` carries group, modality, modality_label, variant, qc_flag, training_hint, exposure_ms.
Derived images and results live in `app/cache/` — **git-ignored**, raw microscopy never
reaches the public repo.

## Screens

| Rail | Key | Screen | What it shows |
|---|---|---|---|
| 1 | Alt+1 | **Analyze** (U1) | Drop an image → tiles stream in over SSE, uncertainty flickers, S0–S5 stepper, parameters count up; layers, objects, metrics, QC; ROI tool; **S** explodes the layers into a 3D stack |
| 2 | Alt+2 | **Preprocess** | scikit-image filter stack + thresholds (polarity → background → denoise → band-pass → intensity → enhancement; soma and neurite thresholds, ridge filter, min-size). Live region preview (raw \| processed + masks, swipe, "try all thresholds" grid, draggable histograms), presets, **Apply to pipeline** |
| 3 | Alt+3 | **Compare** (U2) | Two synced views (side by side / swipe / blend), per-cell NTI delta badges, CDF · histogram · polar · delta table |
| 4 | Alt+4 | **Similarity** (U4) | PCA atlas of per-cell feature vectors (grouped by condition / group / modality / batch), k-NN inspector with crops, group distances (**descriptive**, batch-drift warning), QC outliers |
| 5 | Alt+5 | **Review** (U5) | Uncertainty-ranked queue, immutable prediction outline vs editable annotation, brush/erase/delete/merge/undo, versioned `_seg` files |
| 6 | Alt+6 | **Batch** | Cohort table, worker lanes, conditions, cancel |
| 7 | Alt+7 | **Settings** | Runtime, offline audit, calibration override (D5), motion |

The Neuron 3D screen (U3) was removed on 2026-10-03: the data are 2-D micrographs.
`Ctrl K` command palette · `?` shortcuts.

## Preprocessing

Operators follow the scikit-image 0.25 filters gallery. **Apply to pipeline** makes the
config active (`app/cache/preproc/active.json`); the defaults reproduce the earlier
hard-coded pipeline exactly. Each result records `preproc {preset, hash, params}` and
`model_version = "classical-v1+<preproc hash>"`; results made with another config are
reported **stale** and can be re-run with *Re-analyse*. Code: `server/preproc.py`,
`web/src/screens/preprocess.tsx`, `web/src/state/preproc.ts`. Requirements:
`scikit-image>=0.25,<0.27`, PyWavelets.

## Contract (CLAUDE.md s4, s8)

`POST /api/infer` → `202 {job_id}` · `GET /api/events?job_id=` SSE: `stage` · `meta` ·
`tile` (base64 RGBA PNG: R soma, G neurite, B uncertainty) · `preview` · `result` (s8 JSON) ·
`done` | `cancelled` | `error`. Two interactive + two background worker
processes; a new job for the same image supersedes the old one; every job can
be cancelled. No field is flagged `mock`; the NTI reports `calibrated: false`.

Preprocessing and related endpoints:

- `GET/PUT /api/preproc` — read / set the active config
- `POST /api/preproc/presets`, `DELETE /api/preproc/presets/{name}` — manage presets
- `POST /api/preproc/preview` → `202 {job_id}`, result arrives as an SSE `preview` event
- `POST /api/reanalyse {scope: stale|pending|all}` — re-run results made with another config
- `GET /api/similarity?group=condition|group|modality|batch`

Replacing `server/pipeline.py`'s operators with an ONNX session leaves the UI unchanged.
