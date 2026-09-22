# 07 — Metrics & Evaluation

> A model is only as good as how we **measure** it. This defines what we track,
> how, and the targets we'll report — and keeps every "improvement" claim
> **relative to a baseline** (the base's "≥15% improvement" `[BASE]`).

## 1. Three-level evaluation
Segmentation quality, **morphometric feature** quality, and (new — D14)
**NTI index** quality are **different things**. A mask can look good
(high DSC) but still yield a wrong length; a feature set can be exact but
still combine into an NTI that says nothing biologically.
We report **all three**:

### Level A — Segmentation (per pixel)
| Metric | Formula / note |
|--------|---------------|
| **DSC** (Dice) | 2·\|pred∩gt\| / (\|pred\|+\|gt\|) — primary |
| **IoU** | \|pred∩gt\| / \|pred∪gt\| |
| **Sensitivity / recall** | true-positive rate |
| **Specificity** | true-negative rate |
| **Per-class** DSC/IoU | background / cell_body / neurite (report all) |
| **clDice** | Dice computed on the morphological **skeleton** — see below |
| **Betti error** | connected-component / loop count error vs ground truth |

> **Why topology metrics are not optional for neurites.** DSC measures *area*
> overlap. A neurite predicted as three disconnected fragments can score a
> respectable DSC while being topologically wrong — and **neurite count** and
> **neurite length**, two of our five headline outputs, are then both wrong.
> clDice scores the skeleton, so it measures the property we actually depend on.
> Source: `14-REFERENCES-VERIFIED.md` R-V1 (Shit et al., CVPR 2021).

### Level B — Morphometric features (per image / per cell)
| Feature | Error metric |
|---------|-------------|
| Cell count | abs. error, rel. error %, exact-match % |
| **Soma morphology** (area/circularity/eccentricity) | MAE, relative error % |
| **Branching count** | abs. error, rel. error % |
| **Neurite length** | MAE, relative error % (in px, and µm if scale known) |
| **Branching-angle distribution** | circular error (deg), Rayleigh / Mardia–Watson–Wheeler vs GT |
| Neurite count | abs. error, rel. error % |

- **Bold rows are the base-canon NTI parameters** (`02` §NTI, D14).
- **Ground truth for features** is derived from the **GT masks** with the
  *same* `features/` module → measures **mask→feature** fidelity. For a subset
  we also use **hand-measured** values (Berke) → measures **full-pipeline**
  fidelity. Report both.

### Level C — NTI index (new — D14, gated on O1)
| Case (per O1) | What we report |
|---------------|----------------|
| **Timepoint/dose metadata exists** | NTI per condition vs timepoint: monotonicity in the expected direction, per-parameter attribution (which parameter drives the change), agreement between replicate wells; if reference-assay values are available, correlation vs them |
| **No metadata** | NTI computed and displayed on available conditions (demo of the construct); **no correlation claim** — calibration stays the 24-month project's scope, and we say so explicitly |

- Either way: the **attribution** report (NTI change decomposed into the 4
  parameter contributions) is ours — it needs only the linear NTI model, no
  assay data. That is the SHAP-level explanation in `08-XAI` terms.

## 2. Targets (from base, then made concrete)
`[BASE26]` (2026 canon, our concept source) stated: cell body **IoU ≥ 0.85,
Dice ≥ 0.90**; **neurite length MAE ≤ 5 µm**; NTI–MTT/LDH **Pearson r ≥ 0.7
(95% CI)** per compound; SH-SY5Y transfer **Dice loss ≤ 0.05**; app
**SUS ≥ 80** (n ≥ 12).

`[BASE]` (2025 NeuroMind, reference only): DSC & IoU **≥ 90%**; feature
extraction **≥ 95%**; overall **≥ 95%**; user satisfaction **≥ 90%**;
**≥ 15%** improvement over current.

### ⚠ Two corrections to the base's targets

**1. `DSC (neurite) ≥ 0.90` is not achievable — at any dataset size.** A neurite
is 2–4 px wide, so almost every pixel in it is a boundary pixel. Shift a
perfectly-shaped prediction by one pixel along a 2-px-wide structure and the
overlap roughly halves, even though the segmentation is visually and
topologically correct. The metric punishes a geometry it was never designed for.
This is why R-V1 exists at all. **Report clDice alongside DSC for neurites, and
say plainly why.**

**2. Every number is `mean ± std` over the 5 folds.** At n≈70 a single split's
variance exceeds the difference between the models we are comparing
(`15-SMALL-DATA-STRATEGY` §5). A bare single number here is not a result.

`[PLANNED]` our concrete reporting grid (fill after T2.5/T3.4). All cells are
`mean ± std (5-fold)`:

| Metric | Base `[BASE]` | Realistic target `[PLANNED]` | Baseline (classical) | Ours | Δ vs baseline |
|--------|------|--------|---------------------|------|---------------|
| DSC (cell_body) | ≥ 0.90 | **0.85 – 0.90** | _ | _ | _ |
| DSC (neurite) | ≥ 0.90 | **0.65 – 0.80** | _ | _ | _ |
| **clDice (neurite)** | — | **report, no target yet** | _ | _ | _ |
| **Betti error (neurite)** | — | **report, no target yet** | _ | _ | _ |
| IoU (cell_body) | ≥ 0.90 | **0.75 – 0.85** | _ | _ | _ |
| Cell count rel-err | — | ≤ 10% | _ | _ | _ |
| Neurite length rel-err | — | ≤ 15% | _ | _ | _ |
| Neurite angle (circular) | — | ≤ 15° (med.) | _ | _ | _ |
| Inference time / image | — | < target | _ | _ | _ |

> **The ceiling.** Our inter-annotator agreement (`06-DATA` §3) is the realistic
> upper bound on any DSC we can achieve — a model cannot be more consistent with
> "the truth" than two humans are with each other. If Berke and Gözde agree at
> 0.88 on neurites, a model at 0.85 is essentially at the noise floor. **Stating
> that is a stronger, more defensible result than claiming 0.95.**

> The "≥15% improvement" is reported **as the feature-error reduction** vs the
> best baseline (classical / pretrained / NeuroQuantify), **and** as DSC gain.
> We name the baseline each Δ is against — no bare percentages.

## 3. Error analysis (not optional)
- Build a **failure gallery**: worst-DSC and worst-feature images, with
  saliency overlay (ties into `08-XAI`).
- Categorize failures: touching cells, faint neurites, background artifacts,
  out-of-distribution magnification, angle ambiguity.
- **Each category → a fix** in the improvement loop (T6.1). This is the story
  that makes the project credible to the instructor and to a future paper.

## 4. Generalization / robustness
- Report **per-modality** results (phase-contrast vs fluorescence).
- If possible, a **cross-dataset** or **held-out-plate** test.
- `[IDEA]` add an **out-of-distribution probe** (an unseen magnification) to
  show where the model degrades — honesty builds trust.

## 5. Statistical rigor
- Use the **held-out test set** only; report **mean ± std** across folds if we
  do k-fold (nnU-Net gives free 5-fold `[VERIFY]` feasibility).
- Report **95% CI** on the primary features (bootstrap over test images).
- Fix the **test set** before any hyperparameter decision (no peeking).

## 6. Reproducibility of evaluation
- Eval runs from `config` + `data_version` + `model_ckpt` → same numbers.
- Every reported number is **committed** (results JSON) so the dashboard and
  report read from artifacts, not memory.

## 7. What we do NOT claim
- No clinical/medical claims (we're a student project on a model cell line).
- No "first/only" claims unless we confirm via `11-SEARCH-WORKFLOW`.
- No absolute-angle claim if augmentation rotated the data (see `06` §4).
