# 04 — Technical Pipeline (architecture)

> End-to-end: raw microscopy image → quantitative morphometric report + app.
> This is our **design intent** `[PLANNED]`. It inherits the base's hybrid
> philosophy (DL for segmentation, image processing for morphometrics) `[BASE]`
> but is made concrete and testable.

> ## ⚠ Constrained by n ≈ 70
>
> **Read `15-SMALL-DATA-STRATEGY.md` first.** This file is that strategy's
> concrete architecture: **pretrained encoder + U-Net decoder**, **patch-based**
> training, **5-fold CV split by image** (never by patch), augmentation as
> regularisation (S1), and **Cellpose-SAM as a first-class candidate** (S2) —
> not the from-scratch U-Net / reach-transformer plan an unconstrained team
> would pick.

## Block diagram

```
                 ┌─────────────────────────────────────────────┐
   RAW IMAGE     │              NeuroMind (offline app)          │
  (pc/fluor) ───▶│  ┌──────────┐  ┌───────────┐  ┌───────────┐  │
                 │  │  Load &  │─▶│Preprocess │─▶│ Segmentation│ │
                 │  │ normalize│  │  (config) │  │  (DL model)│  │
                 │  └──────────┘  └───────────┘  └─────┬─────┘  │
                 │                                      ▼        │
                 │  ┌───────────┐   ┌─────────────┐ ┌────────┐ │
                 │  │  Report   │◀──│  Morpho-    │◀│Post-   │ │
                 │  │  (PDF/HTML│   │  metrics    │ │process│ │
                 │  └───────────┘   │ (features)  │ └────────┘ │
                 │                  └──────┬──────┘            │
                 │                         ▼                   │
                 │  ┌───────────┐   ┌─────────────┐            │
                 │  │  UI / XAI │◀──│  Saliency / │            │
                 │  │  overlay  │   │  uncertainty│            │
                 │  └───────────┘   └─────────────┘            │
                 └─────────────────────────────────────────────┘
        config (YAML) drives every stage; runs fully offline (ONNX).
```

## Stages

### S0 — Load & normalize `[PLANNED]`
- Read formats we'll actually get (see `06-DATA`; `[OPEN]` exact format).
- Normalize intensity/dtype, record **metadata** (source, magnification,
  micro type, scale/pixel-size) — scale is needed to report length in **µm**.
  `[OPEN]` pixel size available? if not, report in pixels + note.

### S1 — Preprocessing `[BASE]` methods, `[PLANNED]` implementation
Reproducible, config-driven, **non-destructive** (keep original). The base
names these `[BASE]`:
- **Contrast**: global + adaptive histogram equalization (CLAHE).
- **Denoise**: median / Gaussian / bilateral (pick per noise profile).
- **Edge/feature**: Sobel/Prewitt/Laplacian *for analysis*, not as the main
  segmentation input.
- **Color-space** transforms (fluorescence channels).
- **Morphological** cleanup: opening/closing (small kernels) — for mask
  post-processing, not heavy image editing.
- **Augmentation** (training only, **never** on val/test folds) — governed by
  `15-SMALL-DATA-STRATEGY` §6: flips, scale jitter, small elastic,
  illumination/contrast/gamma jitter, mild blur/noise — **spatially consistent**
  between image and mask, deterministic on `(image, mask, rng_seed)`, logged.
  ⚠ Rotation conflicts with the neurite-**angle** ground truth → ADR **D6**:
  define the angle as orientation (0–180°) / recompute labels under the
  transform, or exclude rotation from the angle-evaluated folds.
  Augmentation regularises; it does **not** add information (§6).

### S2 — Segmentation (DL) `[PLANNED]`
- **Task:** pixel-wise, **multi-class**: `background`, `cell_body`, `neurite`.
  This 2-class-signal + background is the **safe core** `[PLANNED]`.
  `[IDEA]` a 3rd class (e.g., nucleus under fluorescence) only if data supports it.
- **Model set to compare** (details + ranking in `05-MODELS`, governed by
  `15-SMALL-DATA-STRATEGY`): **ImageNet-pretrained encoder + U-Net decoder**
  (primary workhorse) · **Cellpose-SAM zero-shot / fine-tune** (first-class
  candidate, run early at the W6 gate, and the route to **instance** masks) ·
  nnU-Net (gated on GPU, A6) · classical Hessian/ridge (no-DL baseline).
  **TransUNet stays `[IDEA]`** — a ViT at n≈70 memorises (§2 of the strategy).
  Every comparison is reported as **5-fold mean ± std**.
- **Loss:** Dice + (soft) cross-entropy; class-balanced.
- **Training:** reproducible (seed, config), early stopping on validation DSC.
- **Output:** probability map → mask; plus (optional) **uncertainty**
  (MC dropout / TTA disagreement) `[IDEA]`.

### S3 — Post-processing `[PLANNED]`
Turn masks into **instances** and clean artifacts:
- Morphological clean (small opening) → remove specks.
- **Connected-component** labeling → cell bodies (count, area).
- **Instance separation** of touching cell bodies: prefer **Cellpose-SAM
  instance masks** where available (counting touching cells is exact); else
  distance transform + watershed; if it fails, keep a merged blob and **flag
  it** (honest limitation, feeds the error analysis). `[VERIFY]` needed.
- **Neurite graph**: from the `neurite` mask, skeletonize → graph; identify
  branches, endpoints, junctions; compute per-neurite length & direction.
  (Canny + Hough in the base `[BASE]` is one option; **skeleton + graph** is
  the cleaner general approach — decision in `DECISIONS.md`.)

### S4 — Morphometric features `[BASE]` outputs, `[PLANNED]` module
Per image (and per cell where possible):
| Feature | How | Units |
|---------|-----|-------|
| Cell count | components (cell_body) | # |
| Cell area | component area | px² / µm² `[OPEN]` |
| Neurite count | skeleton branches / per cell | # |
| Neurite length | sum of skeleton branch lengths | px / µm |
| Neurite angle | branch direction(s) | deg |
- `[IDEA]` add: total neurite length/cell, mean angle, circular (Rayleigh)
  alignment, Sholl profile, per-neurite length distribution, uncertainty band.
- **Unit-test this module on synthetic + hand-measured images** (T3.3) — it is
  pure geometry, so it must be exactly right.

### S5 — XAI / explainability (see `08-XAI`) `[PLANNED]`
- Saliency (Grad-CAM / Integrated-Grad) on the segmentation model.
- Cross-check saliency against **error analysis** (where does it fail?).
- Optional: per-pixel **uncertainty** shown as a third overlay.

### S6 — App + report (see `09-DASHBOARD` + `02` İP4) `[PLANNED]`
- Offline desktop (Python: e.g. **PySide6**/Qt, or web-in-shell); model
  shipped as **ONNX** (or TorchScript) → no internet, no training stack.
- Inputs: image(s) / folder → runs S0–S4 → shows overlay + feature table +
  histograms → exports **report** (PDF/HTML).
- Report is co-owned by Berke (biology framing) — the numbers must be
  **biologically meaningful** `[PLANNED]`.

## Data & control flow rules `[PLANNED]`
1. **Config-first**: one YAML per run; the pipeline is `run(config)`.
2. **Versioned artifacts**: raw → preprocessed → mask → features all stored
   with hashes; a report can always be reproduced from its config.
3. **No silent skips**: any stage that can't proceed (e.g., no neurites)
   emits a structured result + a warning, never a crash or a fake 0.
4. **Testability**: S4 (features) and S3 (post-process) are unit-tested;
   S2 has a fixed eval set; the app has an end-to-end smoke test.

## Open technical decisions (→ `DECISIONS.md`)
- **D0** class scheme (bg/cell_body/neurite) — accepted
- **D6** neurite-angle definition (orientation 0–180°) vs rotation augmentation — **T1.4**
- **D9** small-data strategy (pretrained + patch + 5-fold + foundation models) — accepted
- **D1** primary model — by 5-fold CV mean±std at the W9 gate (`05-MODELS`)
- **D4** app framework (Qt vs web-shell) — **T5.1** · **D5** units (µm vs px) — **T1.1**
- **D2** neurite geometry = skeleton+graph vs Canny+Hough — **T3.1** · **D3** instance-separation depth — **T3.1**
