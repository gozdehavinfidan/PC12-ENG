# 05 — Segmentation Models (survey + selection)

> Goal: pick a **defensible** model set that a 2-person team can train in a
> semester, with a **baseline to beat** so the base's "≥15% improvement"
> `[BASE]` target is actually measurable.

> ## ⚠ Re-ranked for n ≈ 70 — read `15-SMALL-DATA-STRATEGY.md` first
>
> With ~70 labeled images, the ranking below is **not** "which architecture is
> strongest" but **"which extracts the most from 70 images"**. That inverts the
> usual order:
>
> | Rank | Approach | Why, at this sample size |
> |---|---|---|
> | **1** | **ImageNet-pretrained encoder + U-Net decoder** (`segmentation_models_pytorch`, ResNet-34 / EfficientNet-B0) | The encoder already knows edges and textures, so our 70 images are spent teaching the *decoder* the PC12-specific mapping instead of re-learning generic vision. Highest value per labeled image. |
> | **2** | **Cellpose-SAM zero-shot / fine-tune** (R-V2) | Built for the few-shot regime. Costs ~1 day, may beat a model we train for 3 weeks — and gives **instance** masks, so cell counting stops failing on touching cells. Run it **early** (W6) so the answer can change our plan. |
> | **3** | **nnU-Net** | Self-configuring, patch-based, heavy augmentation, built-in 5-fold CV — genuinely good on small data. Deprioritised only on **compute and setup cost**; gated on A6 (GPU). |
> | **4** | Classical Hessian/ridge filtering (R-V7) | Training-free prior for thin tubular structures. A credible non-DL baseline for the W9 comparison, and it costs almost nothing. |
> | **last** | **ViT-UNet / TransUNet** | `[IDEA]` only. A ViT has no built-in locality or translation-equivariance assumption and must learn both from data — at n≈70 it will memorise. Also group **A3**'s track (D8). |
>
> **Consequence for the W9 gate:** the decision is made by 5-fold CV
> **mean ± std** (`07-METRICS`), not by which architecture sounds most advanced.

## The closest prior work (our reference point)
**NeuroQuantify** (Dang et al. 2023, open-source,
`github.com/StanleyZ0528/neural-image-segmentation`) `[VERIFY]` — DL
segmentation of **cells + neurites** from **phase-contrast** images, then
post-processing for **neurite length + orientation**, in a user-friendly
offline tool. This is almost exactly our task.
- Use as: (a) a **baseline** to compare against, and/or (b) prior art to
  cite, and (c) a code reference for the morphometric post-processing.
- `[VERIFY]` license, exact architecture, and whether its data overlaps ours.

## Baselines we MUST run (to make "improvement" real)
| Baseline | What it is | Why |
|----------|-----------|-----|
| **Classical (no-DL floor)** | threshold/Otsu + morphology + skeleton; **Hessian/ridge** filtering for the thin tubular (neurite) signal (R-V7) | No-DL floor; cheap; shows DL's value `[PLANNED]` |
| **Pretrained (zero/few-shot)** | **Cellpose** or **StarDist** on our data | SOTA off-the-shelf; strong floor `[PLANNED]` |
| **Reference tool** | **NeuroQuantify** (if runnable) | Direct prior-art comparison |
| **MONAI** | Named in the base as the 2D reference `[BASE]` | Honors the base's stated reference |

## Candidate architectures (re-ranked for n ≈ 70)
| Model | Family | Verdict at n≈70 |
|-------|--------|-----------------|
| **ImageNet-pretrained encoder + U-Net decoder** (`segmentation_models_pytorch`: ResNet-34 / EfficientNet-B0) | CNN, transfer | **Primary** — the 70 images spend on the decoder, not on re-learning edges |
| **nnU-Net (v2)** | CNN, auto-config | **Enter the W9 comparison** — A6 resolved (D12, A5000+A6000); self-configuring, patch-based, built-in 5-fold CV |
| Classical **Hessian / ridge** filtering | CV, no training | **No-DL baseline** for thin tubular structures (R-V7) |
| **DS-UNet** (random init) / **TransUNet** / ViT-UNet | CNN / hybrid | **`[IDEA]`** — DS-UNet wastes scarce data re-learning vision; ViTs memorise at n≈70 (also A3's track) |

## Recommendation `[PLANNED]`
- **Primary workhorse:** **ImageNet-pretrained encoder + U-Net decoder**
  (`segmentation_models_pytorch`) — transfer learning is *mandatory* at n≈70
  (`15-SMALL-DATA-STRATEGY` §1).
- **Run Cellpose-SAM zero-shot EARLY** (W6 gate, `13-SUNUM-PLAN` SUNUM 3) so the
  answer can change the plan; fine-tune from the few annotated images if it
  wins the gate.
- **nnU-Net** only if A6 (GPU) is resolved. **TransUNet / ViT-UNet** stay
  `[IDEA]`.
- **Always run** the classical + foundation baselines so every claim is relative.
- **Decision rule (W9 gate):** 5-fold CV **mean ± std** — DSC per class,
  tie-break IoU → **clDice (neurites)** → runtime. A bare single number is not
  a result (`07-METRICS`).

## Why not the fanciest model
At n≈70 the question is not "which architecture is strongest" but "which
extracts the most from 70 images" (`15-SMALL-DATA-STRATEGY`). A ViT has no
built-in locality and will **memorise**; a from-scratch DS-UNet spends our
scarce labels re-learning generic vision. The pretrained CNN + foundation-model
baseline is the safe, defensible default `[PLANNED]`.

## Selection criteria (ranked)
1. **Validation DSC/IoU** on *our* held-out set.
2. **Downstream feature accuracy** (count/length/angle) — a model with
   slightly lower DSC but cleaner boundaries can win on features.
3. **Runtime / inference** (we ship it in an offline app).
4. **Training time + data hunger** (must fit our data + timeline).
5. **Reproducibility & debuggability** (we can fix it when it fails).

## Metrics per model
See `07-METRICS`. Every model reports: DSC, IoU, sensitivity/specificity,
per-class results, inference time, **and** downstream feature error.

## Open items
- `[RESOLVED]` A6: **A5000 24GB + A6000 48GB** available (D12) — nnU-Net and
  foundation-model fine-tune are both affordable; A6000 for long 5-fold/ensemble runs.
- `[IDEA]` TransUNet / ViT-UNet — only if batch 2 + time allow (see §2 of the strategy).
