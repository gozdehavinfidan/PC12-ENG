# 08 — XAI (Explainability)

> Why is explainability part of the plan? Two reasons:
> 1. The base project is a **decision-support tool** for biologists — they
>    need to **trust** an automatic cell/neurite measurement `[BASE]` spirit.
> 2. Our **improvement loop** (`03` İP6) needs to see *where* and *why* the
>    model fails. Saliency is the fastest debug tool we have.

This is an **added** capability vs a minimal clone — a `[PLANNED]` improvement
that also serves as a strong presentation talking point.

## 1. What we explain
- **Per-pixel saliency**: which image regions drive the segmentation decision
  (Grad-CAM / Integrated Gradients on the decoder).
- **Per-instance explanation** `[IDEA]`: for a specific cell/neurite, show the
  mask + overlay + the features it produced.
- **Uncertainty** `[IDEA]`: pixels/regions where the model is unsure → flag for
  human review (ties to "trust").

## 2. Candidate methods
| Method | Type | Good for | Notes |
|--------|------|----------|-------|
| **Grad-CAM** | gradient-based | coarse regions, fast | works for CNNs; ViT variants exist |
| **Integrated Gradients** | path-based | finer, per-pixel-ish | needs a baseline input |
| **SHAP (deep)** | model-agnostic | per-feature attribution | heavier; maybe `[IDEA]` |
| **Occlusion** | perturbation | model-agnostic sanity | slow but interpretable |
| **MC-dropout / TTA disagreement** | uncertainty | "where unsure" | pairs with the above |

## 3. Plan (maps to İP4 in `03`)
- **T4.1 Spike (W6):** pick **one** method (start **Grad-CAM**), run on the
  pilot, eyeball whether maps are sensible. Cheap, early, de-risking.
- **T4.2 Error interpretation (W9):** overlay saliency on the **failure
  gallery** from `07` — does the model "look at" the right thing where it
  fails?
- **T4.3 Full visualization (W12):** saliency + (optional) uncertainty as a
  toggleable overlay in the app.
- **T4.4 Validation (W13):** cross-check — high-error regions should correlate
  with weak/absent saliency or high uncertainty. Write it up.

## 4. Honest limits `[PLANNED]`
- Saliency is a **hypothesis aid**, not proof. We state this in the report.
- We do **not** claim XAI "proves" correctness; we claim it **helps us and the
  user localize** errors.
- If a method is too heavy or gives noise, we **drop it** (spike decides).

## 5. Success
- Saliency maps **visually plausible** on ≥ most good predictions.
- Maps **correlate with the error analysis** (failure regions get flagged).
- The app shows overlay in < 1 s after inference.
