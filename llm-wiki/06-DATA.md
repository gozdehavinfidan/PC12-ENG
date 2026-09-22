# 06 — Data (sources, labeling, QA, augmentation, splits)

> Data is the **critical path** (`03` critical path). This file is the plan to
> get from "a ready dataset from the Biomed dept" `[BASE]` to a **frozen,
> versioned, leak-free** training set with a data card.

## 0. What we know vs don't
| Fact | Status |
|------|--------|
| A dataset exists (from İzmir Katip Çelebi Biomed Eng dept) | `[BASE]` |
| Modalities: **phase-contrast** + **fluorescence** microscopy | `[BASE]` |
| **≈ 70 images are already LABELED** | `[CONFIRMED]` user, W1 |
| **A further batch arrives in ~2 weeks**, size unknown | `[CONFIRMED]` user, W1 → İP7 |
| Resolution / format / pixel size | `[OPEN]` → **T1.1** |
| Are the 70 images from ≥ 70 *independent wells/dishes*? | `[OPEN]` → **T1.1, critical for splitting** (see §5) |
| Pixel size (µm/px) | `[OPEN]` → needed for µm units |
| Current labeling state (raw / partial / none) | `[OPEN]` → T1.1 |
| License / reuse rights / any identifiers | `[OPEN]` → T1.1 (data card) |

> **First action T1.1** produces the **data card** below. Nothing downstream
> is final until T1.1 resolves these `[OPEN]`s.

## 1. Data card (partially filled — complete in T1.1)
```
Dataset name / source        : İzmir Katip Çelebi Üniv., Biyomedikal Müh. Bölümü
Acquisition (microscope, mags): [OPEN]
Modalities                   : phase-contrast / fluorescence (which, or both?) [OPEN]
Images (count, size, fmt)    : ≈70 LABELED [CONFIRMED W1]; size/format [OPEN]
  └ batch 2                  : arriving ~W3, count [OPEN]  → İP7
Independent wells/dishes     : [OPEN]  ← governs the split unit, see §5
Pixel size / scale           : [OPEN]  ← required before any µm-unit output
Conditions (NGF? timepoints?): [OPEN]
Class definitions present    : [OPEN] — do the existing labels match our scheme (§2)?
Existing labels?             : YES, ≈70. Format/convention [OPEN]
  └ labeled by whom, to what protocol? : [OPEN]  ← decides whether we can trust them
Duplicates / overlaps        : [OPEN]
License / reuse / privacy    : [OPEN]
Known artifacts              : [OPEN]
Intended splits              : 5-fold CV by image/well (§5)
```

> **⚠ The highest-value unknown is "labeled by whom, to what protocol?"** If the
> 70 existing labels were made under a different convention than the one we
> write in §3, then either we re-label them or our protocol must match theirs.
> Discovering this in W6 instead of W2 costs weeks. Ask in T1.1.

## 2. Class / label scheme (define in T0.3)
- **Core (safe) scheme `[PLANNED]`:** `background`, `cell_body`, `neurite`.
- **Nucleus** as an optional 3rd signal only if fluorescence clearly shows it
  `[IDEA]` / `[OPEN]`.
- Each class: precise written definition in the **labeling guide**
  (e.g., "cell_body = soma boundary; neurite = any extension > N px from the
  soma; do/ don't label dead cells as ..."). Ambiguity here becomes metric
  noise later — so the guide must be explicit.

## 3. Labeling protocol
- **Tool:** pick one (e.g., **Labelme** for polygons, **CVAT**, or
  **napari** for masks) `[VERIFY]` — decide in T1.2.
- **Who:** B leads (biomedical), E co-label.
- **Double-labeling:** **10%** of the pilot set labeled **independently by both**
  to measure inter-annotator agreement (Dice / Cohen's kappa on masks).
- **QA:** every label pass reviewed; disputed images re-labeled; a **freeze**
  (v1.0, checksums) happens at T1.6. No edits after freeze — new labels → v1.1.

## 4. Augmentation (training only, **never** val/test)

> Governed by `15-SMALL-DATA-STRATEGY` §6. `[BASE]` named augmentation for
> generalisation; `[PLANNED]` the concrete set, **spatially consistent**
> image↔mask:
- flips (h/v), scale jitter, small **elastic** deformation (neurites are thin —
  keep magnitude low)
- **illumination / contrast / gamma jitter** — deliberately chosen: the base
  names light intensity, resolution and lens characteristics as the reason
  classical methods fail; simulating that variation attacks that weakness
  directly
- mild blur / noise (real focus + shot-noise variation)
- ⚠ **Rotation conflicts with neurite-angle ground truth** (rotating 30° shifts
  every angle label by 30°). Resolve per ADR **D6**: recompute angle labels
  under the transform, define the angle as **orientation (0–180°)**, or exclude
  rotation from the folds that evaluate the angle feature. Decide at **T1.4**.
- **Augmentation regularises; it does not add information** (§6) — the effective
  sample size stays ≈ 70 independent images. Say this in the report.

## 5. Splits — **5-fold CV, split by image** (no leakage)

> Governed by `15-SMALL-DATA-STRATEGY.md` §4–5. **Supersedes** the earlier
> provisional 70/15/15 ratio.

**Why not 70/15/15 any more.** 15 % of 70 images is ~10 images. At that size one
unusually dense or out-of-focus image swings DSC by several points — so the gap
between "model A: 0.86" and "model B: 0.83" is smaller than the measurement
noise, and we would be picking our architecture by coin flip without knowing it.

**What we do instead** `[PLANNED]`:
- **5-fold cross-validation** over the ~70 images. Every image is validated
  exactly once. Report **mean ± std**, never a bare single number.
- When batch 2 arrives (İP7), hold out a genuinely **untouched test set** from
  the new batch — performance on data no fold ever saw is the strongest claim
  we can make.
- Keep a **balanced** subset for the per-class / feature evaluation.

### ⚠ The hard rule: split by IMAGE, then patch — never the reverse

We train on **patches** (`15-SMALL-DATA-STRATEGY` §3), and that creates the
easiest way to silently invalidate every number we report:

> Patches from the same image share the same cells, illumination, focus and
> staining batch. If patch A of image 7 is in train and patch B of image 7 is in
> validation, the model has already seen the validation data. **The DSC comes
> out high and means nothing — and nothing in the training logs looks wrong.**

Enforcement, as code and not as a comment:
- The split function takes a list of **image ids**, not patches.
- `assert` that the image-id sets of any two folds are disjoint.
- Augmented copies inherit their source image's fold. Always.
- **Ideally split by well/dish, not by image** — two fields of view from the same
  well are not independent either. Resolve the `[OPEN]` in §0 first.

## 6. Versioning & reproducibility
- Store: `raw/ preprocessed/ masks/ features/` with hashes.
- One **manifest** per version (image → mask → split → conditions).
- `data_version` pinned in every run config → any result is reproducible.

## 7. Risks & mitigations (data-specific)
| Risk | Mitigation |
|------|-----------|
| Dataset too small | Pretrained init (Cellpose/nnU-Net weights), aggressive (valid) augmentation, or **İP7 new-data** story `[PLANNED]` |
| Poor/inconsistent labels | Double-label + IAA gate; re-label worst offenders; document |
| No pixel size | Report px + state assumption; ask dept for µm/px `[OPEN]` |
| Mixed modalities behave differently | Train/eval **per modality** or condition the model; report both |
| Duplicates leak into test | Content-based split + duplicate check in T1.1 |

## 8. Incoming data — **CONFIRMED, ETA ≈ 2 weeks** `[CONFIRMED]` user

Batch 2 arrives around **W3**. `[PLANNED]` protocol:
- **Freeze the labeling protocol BEFORE it lands** (W4 gate, `13-SUNUM-PLAN`
  SUNUM 2) — otherwise old and new labels are not comparable and the combined
  set is inconsistent (`15-SMALL-DATA-STRATEGY` §9).
- Record **`batch`** as a first-class field in the data card → enables an
  old-vs-new **distribution-shift** test instead of silently averaging over it.
- Hold out a genuinely **untouched test set from batch 2** for the final
  numbers — the strongest generalisation claim we can make.
- Model selection stays on **5-fold CV of batch 1**; batch 2 = held-out test +
  optional fine-tune comparison (old vs new).
- This is now the **generalisation story** (B1), not a contingency.
