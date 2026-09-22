# 00 — Overview

## The problem
Manual morphological analysis of neurons (and PC12 cells in particular) is
**observer-dependent, slow, and expensive** `[BASE26]`. Viability assays
(MTT/LDH) quantify *survival* but miss the temporal progression of
*structural* damage — neurite retraction, branching loss, soma
deformation `[BASE26]`. As neurological and toxicological research grows,
we need automated, reproducible quantification of cell + neurite
morphology — and a calibrated toxicity readout built from it.

## Why PC12 cells
- Rat adrenal-medulla chromaffin cells that, when stimulated with
  **Nerve Growth Factor (NGF)**, differentiate into a **neuronal phenotype**
  and grow **neurite extensions** `[BASE26]`.
- Easy to grow and control in the lab → a standard model for studying
  neuronal development, function, and disease mechanisms `[BASE26]`.
- Morphology (cell shape, neurite number, neurite length, branching-angle
  distribution, soma shape) is the measurable signal that reports on
  differentiation / drug effects `[BASE26]`.

## What we build
The **measurement chain** of the base concept `[BASE26]` (user, 2026-09-22:
*"konseptimiz ve amacımız aynı; mimariyi değiştiriyoruz"* — see D14):

```
phase-contrast image → segmentation (soma + neurite) → skeleton/graph
→ 4 morphometric parameters → **NTI** (Neural Toxicity Index)
→ explainable component attribution → desktop app
```

The 4 parameters, per the base canon: **neurite length, branching count,
branching-angle distribution, soma morphology** `[BASE26]`. **NTI** is a
continuous, comparable score combining them — the base calibrates it
against MTT/LDH (Pearson r ≥ 0.7); for us, how far NTI goes is gated on
whether our images carry dose/timepoint metadata (`[OPEN]` O1,
`DECISIONS`). The app concept is the base's **IntelliCell** module list
(QC, segmentation, morphometrics, NTI, temporal view, XAI, reports).

We inherit the **concept and purpose** of the TÜSEB 2026 proposal
`[BASE26]`; the **segmentation architecture is ours** — the base's
Swin/bio_prior stack is deliberately replaced by our **D13** two-branch
design (SMP-pretrained U-Net family soma branch + binary neurite branch
with soft-clDice/TopoLoss, 5-seed ensemble). See `02-BASE-PROJECT-TUSEB`
for the canon and `16-ARCHITECTURE-RESEARCH` for where we push beyond it.

## Core measurable outputs (the "what")
The base's 4 NTI parameters `[BASE26]`, plus the engineering features
underneath them:

| Feature | Definition | Tag |
|---------|-----------|-----|
| Neurite length | Total / per-neurite extension length (NTI parameter 1) | `[BASE26]` |
| Branching count | Branches per cell (NTI parameter 2) | `[BASE26]` |
| Branching-angle distribution | Angular profile of branch pairs (NTI parameter 3) | `[BASE26]` |
| Soma morphology | Area, circularity, eccentricity (NTI parameter 4) | `[BASE26]` |
| Cell count | Cell bodies per image (engineering output) | `[PLANNED]` |
| **NTI** | Continuous score combining the 4 parameters; calibration depth gated on O1 (`[OPEN]`, `DECISIONS`) | `[BASE26]`/`[PLANNED]` |

`[IDEA]` Add: per-neurite (instance) metrics, Sholl profile, measurement
uncertainty (ensemble CI). See `10-IDEAS-STRETCH`.

## Deliverables
1. **Labeled dataset** + data card + labeling protocol `[PLANNED]`
2. **Preprocessing + augmentation pipeline** (reproducible, config-driven) `[PLANNED]`
3. **Trained segmentation model(s)** + baseline comparison `[PLANNED]`
4. **Morphometric feature-extraction module** (mask → skeleton → graph →
   the 4 parameters) `[PLANNED]`
5. **NTI computation module** (linear base; calibration per O1) `[PLANNED]`
6. **XAI layer** — base canon wants **SHAP-level component attribution**
   ("%X of the NTI change comes from neurite shortening") `[BASE26]`;
   our offline stack: Integrated Gradients + 5-seed ensemble
   (`08-XAI` §2) `[PLANNED]`
7. **Offline desktop app** in the **IntelliCell** module style with
   report generation `[BASE26]`/`[PLANNED]`
8. **This project dashboard** (Gantt + kanban + progress + results) `[PLANNED]`
9. **Evaluation report** vs baselines (classical tools + manual) `[PLANNED]`

## ⚠ The constraint that shapes everything: ≈ 70 labeled images

`[CONFIRMED]` (user, W1) We have **≈ 70 labeled images** today, with another
batch arriving in ~2 weeks. That is a *small-data* project, and it changes the
technical answer to almost every question below: pretrained encoders instead of
training from scratch, patch-based training, 5-fold cross-validation instead of
a single split, and foundation models (Cellpose-SAM) as a first-class option
rather than an afterthought.

**Read `15-SMALL-DATA-STRATEGY.md` before `04-PIPELINE`, `05-MODELS`,
`06-DATA` or `07-METRICS`.** Those files are downstream of it.

## Success criteria (from the base, then tightened)
`[BASE26]` (2026 canon) targets:
- cell body: **IoU ≥ 0.85, Dice ≥ 0.90**; neurite **length MAE ≤ 5 µm**
- **NTI–MTT/LDH Pearson r ≥ 0.7** (95% CI, per compound) — *their* 24-month
  validation scope; our analogue depends on O1
- temporal NTI > static (Wilcoxon p < 0.05); SH-SY5Y transfer Dice loss ≤ 0.05
- app: **SUS ≥ 80** (n ≥ 12)

`[BASE]` (2025 NeuroMind, reference only): ≥ 95% accuracy; IoU **and** DSC
≥ 90%; ≥ 95% feature accuracy; ≥ 90% user satisfaction; ≥ 15% improvement.

`[PLANNED]` We track the same numbers **plus** runtime, per-feature error
(MAE/relative error), and a robustness check. See `07-METRICS`.

> **⚠ Two of the base's targets are not defensible as written, and we say so.**
> They are grant-proposal *aspirations* stated without a measurement protocol:
> - **"DSC ≥ 90 % "** is unreachable for **neurites** at any dataset size — a
>   neurite is 2–4 px wide, so nearly every pixel is a boundary pixel and a
>   one-pixel offset roughly halves the score even when the shape is correct.
>   We report **clDice / Betti error** alongside DSC for neurites instead.
> - **"≥ 95 % accuracy in feature extraction"** is undefined — "accuracy" has no
>   meaning for a continuous quantity like a length. We report **Bland–Altman
>   agreement against hand measurement**, which is measurable.
>
> We keep the base numbers visible and tagged `[BASE]`, and report our own
> realistic targets next to them (`07-METRICS` §2). Being explicit about this is
> a *stronger* position in a viva than quietly missing an impossible target.

## Timeline at a glance
`[PLANNED]` 15 course-weeks. Milestones: **M1** plan+data plan (W2) →
**M2** pilot dataset+preprocessing (W4) → **M3** pilot model + XAI spike (W6) →
**MID** vize checkpoint (W8) → **M4** full training (W9) → **M5** features +
metrics (W11) → **M6** app + XAI (W13) → **FINAL** integration + demo (W15).
Full WBS in `03-SEMESTER-PLAN`.

## The closest thing already out there
**NeuroQuantify** (open-source) already does DL segmentation of cells +
neurites from **phase-contrast** images and reports neurite length +
orientation. It is our **closest prior work / baseline to beat or build on**.
See `05-MODELS` and `12-REFERENCES`. `[VERIFY]` confirm its exact code,
license, and whether its dataset overlaps what we have.
