# 00 — Overview

## The problem
Manual morphological analysis of neurons (and PC12 cells in particular) is
**observer-dependent, slow, and expensive** `[BASE]`. As neurological research
grows, we need automated, reproducible quantification of cell + neurite
morphology.

## Why PC12 cells
- Rat adrenal-medulla chromaffin cells that, when stimulated with
  **Nerve Growth Factor (NGF)**, differentiate into a **neuronal phenotype**
  and grow **neurite extensions** `[BASE]`.
- Easy to grow and control in the lab → a standard model for studying neuronal
  development, function, and disease mechanisms (Alzheimer, Parkinson, MS)
  `[BASE]`.
- Morphology (cell shape, neurite number, neurite length, neurite direction)
  is the measurable signal that reports on differentiation / drug effects
  `[BASE]`.

## What we build
A **hybrid deep-learning + image-processing** system that, given a PC12
microscopy image, outputs quantitative morphometric features — wrapped in a
**user-friendly, offline desktop app** (the TÜSEB project calls it
"**NeuroMind**" `[BASE]`).

We are **not** cloning the TÜSEB project. The TÜSEB proposal is the **basic
version** `[BASE]`; our semester project is an **improved** version — better
segmentation, better morphometrics, uncertainty, robustness, and a real,
maintainable tool. See `02-BASE-PROJECT-TUSEB` for the base and `10-IDEAS-STRETCH`
for where we push beyond it.

## Core measurable outputs (the "what")
| Feature | Definition | Source in base |
|---------|-----------|----------------|
| Cell count | Number of PC12 cell bodies per image | `[BASE]` |
| Cell area | Area occupied by cell bodies | `[BASE]` |
| Neurite count | Number of neurites per (cell / image) | `[BASE]` |
| Neurite length | Total / per-neurite extension length | `[BASE]` |
| Neurite angle / direction | Orientation of neurite extension | `[BASE]` |

`[IDEA]` Add: per-neurite (instance) metrics, branching/branch-order, Sholl
profile, measurement uncertainty. See `10-IDEAS-STRETCH`.

## Deliverables
1. **Labeled dataset** + data card + labeling protocol `[PLANNED]`
2. **Preprocessing + augmentation pipeline** (reproducible, config-driven) `[PLANNED]`
3. **Trained segmentation model(s)** + baseline comparison `[PLANNED]`
4. **Morphometric feature-extraction module** (post-processing) `[PLANNED]`
5. **XAI layer** (saliency + error interpretation) `[PLANNED]`
6. **Offline desktop app** (NeuroMind-style) with report generation `[PLANNED]`
7. **This project dashboard** (Gantt + kanban + progress + results) `[PLANNED]`
8. **Evaluation report** vs baselines (classical tools + manual) `[PLANNED]`

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
`[BASE]` targets from TÜSEB:
- ≥ 95% overall accuracy in training/segmentation
- IoU **and** DSC ≥ 90% for the chosen architecture
- ≥ 95% accuracy in morphometric feature extraction
- ≥ 90% user satisfaction
- ≥ 15% improvement over the current/baseline tooling

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
