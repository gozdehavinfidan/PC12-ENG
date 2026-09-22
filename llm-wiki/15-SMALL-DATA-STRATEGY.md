# 15 — Small-Data Strategy (n ≈ 70)

> **This file governs every technical choice in the project.** Read it before
> `04-PIPELINE`, `05-MODELS`, `06-DATA` or `07-METRICS` — those files are
> downstream of the constraint written here.

## The constraint

| Fact | Value | Tag |
|------|-------|-----|
| Labeled images available now | **≈ 70** | `[BASE-TEAM]` (user, W1) |
| New data expected | **within ~2 weeks** of W1, amount unknown | `[OPEN]` |
| Augmentation planned | yes | `[PLANNED]` |
| Effective sample size after augmentation | **still ≈ 70 independent images** | see §6 |

**2026-09-22 (araştırma):** bu dosyanın her kararı, 6 paralel birincil-kaynak
taramasıyla **doğrulandı ve keskinleştirildi** — tam kanıt:
`16-ARCHITECTURE-RESEARCH.md`. Keskinleşenler: §1 → decoder ailesi {U-Net,
UNet3+, UNet++} + nnU-Net v2 ResEnc L (D13); §2 → "nnU-Net Revisited"
(arXiv:2404.09556) transformer'ların n≈70'de kaybettiğini sayıyla gösterdi;
§7 → loss = Tversky(0.3/0.7) + **soft-clDice** (nörit); §8 → W6 kapısı 5 FM'ye
çıktı (Cellpose-SAM/μ-SAM+APG/CellSAM/StarDist/SAM) + LoRA-on-SAM kolu — ve
**hiçbir FM nörit segmente etmiyor**, bu yüzden nörit kolu klasik
skeleton-graph (D13); §9 → batch 2 = **topology-aware active learning** +
**Tent TTA** test yatağı.

**The governing sentence:** segmentation quality here is limited by the number
of *labeled pixels we actually have*, not by architecture cleverness. Every
decision below is judged by **"does this extract more from 70 images?"** —
never by "is this the strongest model in the literature?"

---

## 1. Transfer learning is mandatory, not optional

**Decision:** ImageNet-pretrained CNN encoder + U-Net decoder
(`segmentation_models_pytorch`, e.g. ResNet-34 or EfficientNet-B0 encoder). `[PLANNED]`

**Cause → effect.** A randomly-initialised network must learn *everything* from
our data: first that edges exist, then textures, then shapes, and only then
"what a neurite looks like". Our 70 images get spent on the generic part. A
pretrained encoder already contains edge/texture/shape detectors learned from
millions of images, so our 70 images only have to teach the **decoder** the
PC12-specific mapping. Same data, far more of it spent on the actual problem.

**What breaks if we don't:** training from scratch on 70 images produces a model
that fits the training set almost perfectly and generalises poorly — and with a
val set this small we may not even detect it reliably (see §5).

**Cost of this choice:** the encoder expects 3-channel, ImageNet-normalised
input. Our images are likely single-channel phase-contrast / fluorescence, so we
replicate to 3 channels (cheap) and accept a slight normalisation mismatch. This
is a far smaller penalty than training from scratch.

---

## 2. Transformers are deprioritised

**Decision:** ViT-UNet / TransUNet stay `[IDEA]` only. Not on the critical path.

**Cause → effect.** A convolution *assumes* that nearby pixels are related and
that a feature means the same thing wherever it appears (locality + translation
equivariance). A ViT assumes neither — it must **learn** them from data, which
is why transformers need very large datasets to match CNNs. At n≈70 a ViT will
memorise the training images.

**Convenient side-note:** ViT-UNet + SimAM + Tversky is group **A3**'s track, so
skipping it also avoids duplicating another group's work. See `DECISIONS.md` D8.

---

## 3. Patch-based training is the main multiplier

**Decision:** tile images into patches (e.g. 256×256) rather than resizing whole
images. `[PLANNED]`

**Cause → effect.** Resizing a 1024×1024 microscopy image to 256×256 throws away
15/16 of the pixels — and neurites are *thin*, so they are exactly what
downsampling destroys first. Tiling instead yields ~16 patches per image, turning
~70 images into ~10³ training samples made of **real, full-resolution pixels**.

**Why this beats augmentation:** a patch shows the network genuinely different
content. An augmented copy shows it the same content again, transformed.
Patching adds information that we already owned but were discarding; augmentation
does not add information at all (§6).

**Practical notes:**
- Use overlapping patches (e.g. stride 128) for training, non-overlapping +
  stitching for inference.
- Discard or downweight patches that are ~100 % background, or the loss will be
  dominated by empty tiles.
- At inference, blend overlapping predictions to avoid visible tile seams.

---

## 4. ⚠ Patch-level leakage — the #1 silent failure

**Hard rule: split by IMAGE first, then patch. Never patch first, then split.**

**Cause → effect.** Patches from the same image share the same cells, the same
illumination, the same focus and the same staining batch. If patch A of image 7
is in train and patch B of image 7 is in validation, the model has effectively
already seen the validation data. The reported DSC comes out high **and is
meaningless** — and nothing in the training logs looks wrong. This is the single
easiest way to invalidate a small-data result without noticing.

**Enforcement:** the split function takes a list of *image ids*, not patches, and
the patch loader is constructed per-split. Add an assertion that the intersection
of image ids across folds is empty; make it a test, not a comment.

Also applies to: augmented copies (an augmented version of a train image must
never appear in val), and any multi-field-of-view images taken from the same
well/dish — ideally split by **well**, not by image. `[OPEN]` confirm with Berke
whether the 70 images come from fewer independent wells.

---

## 5. 5-fold cross-validation, not a 70/15/15 split

**Decision:** replace the provisional 70/15/15 split in `06-DATA.md` with
**5-fold CV** over the 70 images. Report **mean ± std**. `[PLANNED]`

**Cause → effect.** 15 % of 70 is ~10 images. With a test set that small, one
unusually dense or out-of-focus image moves DSC by several points — so the
difference between "model A scored 0.86, model B scored 0.83" is smaller than
the noise in the measurement. We would be choosing our architecture by coin
flip and not knowing it. 5-fold CV uses every image for validation exactly once
and yields a spread, which tells us whether a difference is real.

**What we report:** `DSC = 0.84 ± 0.05 (5-fold)` — never a bare single number.
A model that wins on the mean but has double the std is not obviously better.

**Cost:** 5× the training time. At this dataset size that is affordable and is
the main reason CV is viable here at all.

**When new data arrives (§9):** hold out a genuinely untouched test set from the
*new* batch. That gives the strongest possible claim — performance on data that
was never seen, by any fold, during model selection.

---

## 6. Augmentation regularises; it does not add information

**Say this honestly in the report.** Augmentation increases the *number of
training samples*, not the amount of *independent information*. It tells the
model "these transformations should not change the answer" — genuinely useful
regularisation — but it cannot show the model a cell morphology it has never
seen. Our effective sample size stays ≈ 70 independent images.

**Recommended set** `[PLANNED]`:
- flips (horizontal/vertical), scale jitter, elastic deformation
- **illumination / contrast / gamma jitter** — deliberately chosen: the base
  proposal names light intensity, resolution and lens characteristics as the
  reason classical methods are not robust. Simulating that variation attacks the
  base project's stated weakness directly.
- mild blur / noise (matches real focus and shot-noise variation)

**⚠ Rotation conflicts with neurite-angle ground truth.** If we rotate an image
by 30°, every neurite angle label is now wrong by 30°. Two valid resolutions:
(a) recompute the angle labels under the transform, or (b) exclude rotation from
the folds used to evaluate the angle feature. This sharpens ADR **D6**.

**Never augment the validation/test folds.** Evaluate on real images only.

---

## 7. Class imbalance is worse at small n

Neurites are thin, so they occupy a small fraction of pixels — a model that
predicts "background everywhere" already scores well on pixel accuracy. With few
images there are also fewer neurite examples in absolute terms.

**Plan** `[PLANNED]`: Dice + cross-entropy as the base loss; consider Tversky or
focal loss to weight **recall** on neurites (missing a neurite is worse for our
downstream morphometry than slightly over-segmenting one). Evaluate per class —
never report a single averaged DSC that hides neurite failure behind cell-body
success.

---

## 8. Foundation models are now a first-class option

At n≈70, **Cellpose-SAM** and **CellSAM** are not just baselines — they are
designed for exactly this regime (strong zero-shot generalisation, plus
fine-tuning from very few annotated images).

**Concrete plan:** a zero-shot Cellpose-SAM run costs roughly a day and may beat
a U-Net we spend three weeks training. Run it **early** (W6 gate) so the answer
informs model choice rather than arriving too late to act on.

It also fixes a real flaw inherited from the base: deriving **cell count** from a
*semantic* mask silently fails when cells touch — two adjacent cells become one
blob. Cellpose-SAM produces **instance** masks, where counting is exact.

See `14-REFERENCES-VERIFIED.md` for sources.

---

## 9. The incoming data (~2 weeks)

Tracked as **İP7**; feeds the **W4 SUNUM** demo (`13-SUNUM-PLAN`).

**Freeze the labeling protocol BEFORE it arrives.** `[PLANNED]`
*Cause → effect:* if the new images are labeled under a slightly different
convention (what counts as a neurite start, how to treat crossing neurites,
minimum length threshold), then old and new data are not comparable, the
combined set is inconsistent, and the model learns the inconsistency. Protocol
first, then labeling — and the double-labeling agreement check (`06-DATA`) is
what proves the protocol is actually being followed.

**Do not assume the new data is equivalent.** Different imaging session →
possibly different illumination, magnification or confluence. Record it as a
separate `batch` field in the data card so we can test old-vs-new performance
rather than silently averaging over a distribution shift.

---

## 10. Revised, defensible targets

The base's targets are grant aspirations stated without a measurement protocol.
Keep them tagged `[BASE]`, but commit to these instead:

| Metric | Base `[BASE]` | Realistic at n≈70 `[PLANNED]` | Why |
|---|---|---|---|
| Cell-body DSC | ≥ 0.90 | **0.85 – 0.90** | Compact, well-defined regions — achievable |
| Neurite DSC | ≥ 0.90 | **0.65 – 0.80** | Thin structures are almost all boundary pixels; a one-pixel offset along a 2-px-wide neurite halves its DSC. **≥ 0.90 is not reachable at any n.** |
| Neurite topology | — | **clDice, Betti error** | The metric that actually reflects whether count/length are right |
| Morphometry | ≥ 95 % | **Bland–Altman agreement vs hand measurement** | An agreement interval is measurable; "95 % accuracy" is undefined for a length |
| All of the above | single number | **mean ± std over 5 folds** | §5 |

**Ceiling check:** our inter-annotator agreement (`06-DATA`) is the realistic
upper bound on achievable DSC. If two humans agree at 0.88 on neurites, a model
scoring 0.85 is essentially at the noise floor — and saying so is a *stronger*
result than claiming 0.95.

---

## Checklist before any training run

- [ ] Split is by **image** (or well), asserted in code — not by patch
- [ ] Validation/test folds contain **no** augmented images
- [ ] Encoder is **pretrained**, not random init
- [ ] Per-class metrics reported, not a single average
- [ ] Result reported as **mean ± std** across folds
- [ ] Run recorded in `data.js` `results[]` with the config that produced it
