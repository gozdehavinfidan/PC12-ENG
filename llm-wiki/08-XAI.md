# 08 — XAI (Explainability)

> Why is explainability part of the plan? Two reasons:
> 1. The base project is a **decision-support tool** for biologists — they
>    need to **trust** an automatic cell/neurite measurement `[BASE]` spirit.
> 2. Our **improvement loop** (`03` İP6) needs to see *where* and *why* the
>    model fails. Saliency is the fastest debug tool we have.

This is an **added** capability vs a minimal clone — a `[PLANNED]` improvement
that also serves as a strong presentation talking point.

## 1. What we explain
- **NTI component attribution** (top layer — base canon `[BASE26]`): which
  morphological parameter (neurite length / branching count /
  branching-angle distribution / soma morphology) drives the NTI change.
  With a linear NTI model this is a direct decomposition — the offline
  equivalent of the base's SHAP goal. Gated on O1 for *toxicity-direction*
  claims (`07-METRICS` Level C).
- **Per-pixel saliency**: which image regions drive the segmentation decision
  (Grad-CAM / Integrated Gradients on the decoder).
- **Per-instance explanation** `[IDEA]`: for a specific cell/neurite, show the
  mask + overlay + the features it produced.
- **Uncertainty** `[IDEA]`: pixels/regions where the model is unsure → flag for
  human review (ties to "trust").

## 2. Candidate methods (2026-09-22 araştırma sonucu — `16` §4)

**Minimum-inandırıcı set (≤3, tümü offline, görsel başına ~2 s altı):**

| Method | Type | Library (lisans) | Verdict |
|--------|------|------------------|---------|
| **Integrated Gradients** (per-pixel target, ~20–50 adım) | path-based | `pytorch/captum` (BSD-3) | **ANA SALIENCY** — aksiyom-doğrulanmış; Adebayo sanity'larını geçer; SmoothGrad = NoiseTunnel |
| **5-seed derin ensemble** (dağıtılan model); CV-fold ensemble yalnız doğrulama | uncertainty | DIY ~100 satır / `torch-uncertainty` (Apache-2.0) | **BELİRSİZLİK KATMANI** + gözden-geçirme kuyruğu. ⚠ Bir fold'ın tahminlerini kendi validasyon fold'unda asla ortalama — sızıntı (Kirscher 2026, arXiv:2605.18329) |
| **Sınıf-bazlı global sıcaklık + ECE** | calibration | `torch-uncertainty` | **CALIBRATION** — tam per-pixel değermez (app göreli U tüketir) |
| Grad-CAM (pytorch-grad-cam) | gradient-based | MIT | fallback — kaba; ViT'te reshape gerekir |
| RISE / occlusion | black-box | paper repo | **yalnız doğrulama** (deletion ground-truth + ONNX tutarlılık kontrolü) |
| ~~Seg-Grad-CAM~~ | — | Keras, "no updates planned" | **AT** — PyTorch IG/Grad-CAM aynı haritayı bakımlı kütüphanede verir |
| ~~Evidential / Bayesian U-Net~~ | — | — | **AT** — yeniden eğitim + zayıf segmentasyon kanıtı (arXiv:2410.18461) |
| ~~SHAP (deep)~~ | — | — | **AT** — per-pixel çok yavaş |
| MC-dropout | uncertainty | — | yalnız tek-checkpoint zorunlu olursa yedek (ONNX'te fiddly) |

**⚠ `pytorch-uncertainty` ÖLÜ paket** (404, iki varyant da) → **torch-uncertainty** kullan.

**Doğrulama protokolü (raporda zorunlu, ~1 gün):** (1) **deletion curve** —
IG önemine göre top-k pikseli karart → DSC düşüşü, random-k kıyası; (2)
**Adebayo model-swap**. **"U bir şey mi demek?" sayımı:** flag vs hata AUROC
(torch-uncertainty selective-classification) — holdout'ta bir kez.

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
