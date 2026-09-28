# IntelliCell — offline desktop app (D16 stack, D17 UI)

PC12 micrographs → soma + neurite segmentation → 4 NTI parameters → NTI score.
Everything runs on this computer: React UI ↔ FastAPI on `127.0.0.1` ↔ pipeline
worker processes. **No model yet**: the backend runs a classical-CV placeholder
that speaks the real contract; every number carries `mock: true`.

## Start

```bat
launcher\run.bat          :: first run: creates app\.venv, builds the UI once (needs Node.js), opens the window
launcher\build.bat        :: PyInstaller onedir build -> app\dist\IntelliCell\IntelliCell.exe
```

Development (two terminals):

```bash
cd app/server && ../.venv/Scripts/python main.py      # API on :8765 (also serves app/static)
cd app/web && npm run dev                             # UI on :5173, proxies /api
npm test                                              # SSE contract tests (fixture replay)
```

Data folder: `INTELLICELL_DATA` (default `../datas`, the raw CZI files). Without it
a synthetic cohort is generated. Derived images and results live in
`app/cache/` — **git-ignored**, raw microscopy never reaches the public repo.

## Screens

| Rail | Screen | What it shows |
|---|---|---|
| 1 | **Analyze** (U1) | Drop an image → tiles stream in over SSE, uncertainty flickers, S0–S5 stepper, parameters count up; layers, objects, metrics, QC; ROI tool; **S** explodes the layers into a 3D stack |
| 2 | **Compare** (U2) | Two synced views (side by side / swipe / blend), per-cell NTI delta badges, CDF · histogram · polar · delta table |
| 3 | **Neuron 3D** (U3) | Neurite tubes coloured by length/tortuosity/orientation, clickable junctions with angle arcs, soma surfaces, micrograph slide, 2D↔3D morph (2.5D relief, not a Z-stack) |
| 4 | **Similarity** (U4) | PCA atlas of per-cell feature vectors, k-NN inspector with crops, group distances (**descriptive**, batch-drift warning), QC outliers |
| 5 | **Review** (U5) | Uncertainty-ranked queue, immutable prediction outline vs editable annotation, brush/erase/delete/merge/undo, versioned `_seg` files |
| 6 | **Batch** | Cohort table, worker lanes, conditions, cancel |
| 7 | **Settings** | Runtime, offline audit, calibration override (D5), motion |

`Ctrl K` command palette · `?` shortcuts.

## Contract (CLAUDE.md s4, s8)

`POST /api/infer` → `202 {job_id}` · `GET /api/events?job_id=` SSE: `stage` · `meta` ·
`tile` (base64 RGBA PNG: R soma, G neurite, B uncertainty) · `result` (s8 JSON) ·
`done` | `cancelled` | `error`. Two interactive + two background worker
processes; a new job for the same image supersedes the old one; every job can
be cancelled. Replace `server/pipeline.py`'s operators with the ONNX session
and the UI does not change.
