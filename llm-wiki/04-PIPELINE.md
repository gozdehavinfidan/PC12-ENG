# 04 — Technical Pipeline (architecture)

> End-to-end: raw microscopy image → quantitative morphometric report + app.
> This is our **design intent** `[PLANNED]`. It inherits the base's hybrid
> philosophy (DL for segmentation, image processing for morphometrics)
> `[BASE26]` — the 2026 canon's whole measurement chain — but is made
> concrete and testable.
> Concept/purpose canon = the 2026 TÜSEB NTI chain (D14): the morphometrics
> stage must yield the **4 NTI parameters** (`02` §NTI) and feed the **NTI
> computation module** (`00` deliverable 5).

> ## ⚠ Constrained by n ≈ 70
>
> **Read `15-SMALL-DATA-STRATEGY.md` first.** This file is that strategy's
> concrete architecture: **pretrained encoder + U-Net decoder**, **patch-based**
> training, **5-fold CV split by image** (never by patch), augmentation as
> regularisation (S1), and **Cellpose-SAM as a first-class candidate** (S2) —
> not the from-scratch U-Net / reach-transformer plan an unconstrained team
> would pick.
>
> ## ✅ 2026-09-22: araştırma sonuçları geldi
>
> `16-ARCHITECTURE-RESEARCH.md` (6 paralel literatür scout'u, birincil kaynaklar)
> bu dosyayı **doğruladı ve netleştirdi**: ana hat = **İKİ KOL** (gövde: SMP
> pretrained U-Net ailesi; nörit: düz binary kol + soft-clDice), morphometrik
> stack = **skan + FilFinder + pycircstat2** (tümü açık-lisans, pip), XAI/UQ =
> **IG + 5-seed ensemble + sıcaklık kalibrasyonu**. Aşağıdaki S2–S5 o doğrultuda
> güncellendi; `16` §6 resmi v2 mimaridir.

## Block diagram

```
                 ┌─────────────────────────────────────────────┐
   RAW IMAGE     │      IntelliCell-style (offline app, D14)       │
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
- **Model set to compare** (full verified table: `16` §1; governed by
  `15-SMALL-DATA-STRATEGY`):
  - **gövde kolu:** ImageNet-pretrained encoder + **U-Net ailesi** decoder
    (SMP-MIT: U-Net / **UNet3+** — full-res path 1–2 px nörit detayını korur — / UNet++)
    · **nnU-Net v2 ResEnc L** (clDice için trainer subclass; D12)
    · **SA-UNet** (damar-transfer ablation) · **TransUNet** (tek ablation satırı —
      2404.09556: n≈70'de transformer'lar CNN'lere kaybediyor)
  - **nörit kolu:** düz binary segmentation + soft-clDice. **Hiçbir doğrulanmış
    foundation model nörit instance'ı vermiyor** (star-convex/box öncülü ince
    dallara yapısal düşman — `16` §1.2, tutarlı bulgu) → nörit her zaman
    mask→skeleton yolundan gelir.
  - **foundation modeller W6 kapısında** (3 rol): Cellpose-SAM `cpsam_v2` /
    μ-SAM+APG / CellSAM / StarDist / SAM(zayıf kontrol) → "FM prior" satırı +
    gövde **instance** motoru + pseudo-label kaynağı (+ **LoRA-on-SAM kolu**, 16 §5-7).
  Every comparison is reported as **5-fold mean ± std**.
- **Loss:** gövde: Dice + Tversky(0.3/0.7); **nörit: + soft-clDice (w 0.2–0.3,
  MIT)** + (ablation) TopoLoss — alan + topoloji (16 §1.3, §5-2).
- **Training:** reproducible (seed, config), early stopping on validation DSC;
  W8–10: topology-gate'li pseudo-label self-training + topology-aware active
  learning (16 §3, §5-6/§5-11).
- **Output:** probability map → mask; **5-seed derin ensemble** dağıtılır
  (CV-fold ensemble yalnız doğrulama — 16 §4); belirsizlik = ensemble varyansı.

### S3 — Post-processing `[PLANNED]`
Turn masks into **instances** and clean artifacts:
- Morphological clean (small opening) → remove specks.
- **Connected-component** labeling → cell bodies (count, area).
- **Instance separation** of touching cell bodies: prefer **Cellpose-SAM
  instance masks** where available (counting touching cells is exact); else
  distance transform + watershed; if it fails, keep a merged blob and **flag
  it** (honest limitation, feeds the error analysis). `[VERIFY]` needed.
- **Neurite graph (doğrulanmış stack — `16` §2):** from the `neurite` mask:
  clean (remove_small_objects + fill holes) → **skeletonize** (Zhang-Suen) →
  **skan** `skeleton_graph` (BSD-3) → **FilFinder** length-pruning (L_min 5/10/20 µm
  süpürmesi; NeuroQuantify sabiti 20 µm) → kök-yaprak yolları → per-neurite
  length & direction (**pycircstat2** circular statistics). The base's
  Canny + Hough `[BASE]` remains the documented fallback. (D2 — accepted by
  evidence: SNT cross-check + Bland-Altman vs Berke's hand measurement.)

### S4 — Morphometric features `[BASE26]` outputs (4 NTI params), `[PLANNED]` module
Per image (and per cell where possible). **Bold = a base-canon NTI
parameter** (`02` §NTI):
| Feature | How | Units |
|---------|-----|-------|
| Cell count | FM instance mask varsa tam sayım; yoksa components (cell_body) | # |
| **Soma morphology** | component area + **circularity + eccentricity** | px² / µm² `[OPEN]` pixel-size (D5) |
| **Branching count** | skan junction/branch noktaları / per cell | # |
| **Neurite length** | Σ skeleton edge weights (× px-size) | px / µm |
| **Branching-angle distribution** | branch-pair açılarının circular profili (Rayleigh, Mardia-Watson-Wheeler) | deg |
| Neurite count | skan kök-yaprak yolları / per cell (axon kuralı: en uzun, >2× 2. uzun ve >100 px) | # |
- **NTI module (yeni — D14):** 4 parametreden NTI hesabı; base canon
  **lineer temel model** `[BASE26]`; kalibrasyon derinliği **O1**'e
  (metadata) bağlı — `00` #5, `DECISIONS` D14.
- **Topoloji (yeni — 16 §2):** Betti-1 = E−V+C, clDice, (stretch) persistence-barcode distance.
- **Yeni (16 §5-1, COMMIT):** her özelliğin **hata çubuğu** — ensemble piksel-U →
  skeleton boyunca → CI; (5-12) TTA açı-yayılımı = açı güveni; (5-14) angular-Sholl (16 sektör).
- `[IDEA]` add: Sholl profile, per-neurite length distribution, width (EDT, GT'de genişlik varsa `[OPEN]`).
- **Unit-test this module on synthetic + hand-measured images** (T3.3) — it is
  pure geometry, so it must be exactly right; plus **known-answer set** from
  rotation-tracked rigid-unit pasting (16 §3/§5-13).

### S5 — XAI / explainability (see `08-XAI`) `[PLANNED]`
> Base canon's XAI goal `[BASE26]`: **SHAP-level component attribution** —
> show *which parameter* (length / branching / angle / soma) drives the NTI
> change. With a linear NTI model, per-parameter contribution is available
> directly; IG + ensemble U covers the *pixel-level* layer below it.
- **Integrated Gradients** (captum, per-pixel target) — ana saliency; U-Net'te
  yüksek-res decoder katmanı (ince kenarlar çözümlensin) (16 §4).
- **5-seed ensemble belirsizliği** → mavi overlay + hücre-bazlı **gözden-geçirme
  kuyruğu** (Cellpose prob_map UX deseninin aktarımı).
- Cross-check saliency against **error analysis** + **deletion curve + model-swap**
  doğrulaması raporda zorunlu (16 §4).

### S6 — App + report (see `09-DASHBOARD` + `02` İP4) `[PLANNED]`
- Module list follows the base's **IntelliCell** canon `[BASE26]`: image
  load/**QC** · segmentation (ONNX) · morphometrics · **NTI computation** ·
  **temporal visualization** (0/6/24 h) · **explainability (SHAP-style
  attribution)** · **reporting (PDF/Excel)**. Which of these are live at the
  demo depends on O1 + schedule (temporal view needs timepoint metadata).
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
