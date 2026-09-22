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
> | **3** | **nnU-Net v2 (ResEnc L)** | Self-configuring, patch-based, heavy augmentation, built-in 5-fold CV — genuinely good on small data. A6 resolved (D12) → **enters the W9 comparison** (clDice via trainer subclass, D13). |
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

> **2026-09-22 araştırma güncellemesi** — tam tablo + 16 doğrulanmış mimari
> + 8 foundation model + lisans hijyeni: **`16-ARCHITECTURE-RESEARCH.md` §1**.
> Burası yalnızca karar özeti.

| Model | Family | Verdict at n≈70 |
|-------|--------|-----------------|
| **ImageNet-pretrained encoder + U-Net ailesi decoder** (SMP, MIT: U-Net / **UNet3+** / UNet++) | CNN, transfer | **Primary ana hat** — U-Net ailesi ~40 img'de faz-kontrastta ISBI kazandı; UNet3+'in full-res path 1–2 px nöriti korur. Loss: Dice+Tversky + soft-clDice (nörit) — **D13** |
| **nnU-Net v2 (ResEnc L)** | CNN, auto-config | **W9 karşılaştırma** — A6 çözüldü (D12); clDice için trainer subclass gerekir (D13) |
| **SA-UNet** (spatial attention, damar) | CNN, transfer-ablasyon | **W9 ablation kolu** — 40–60 img kanıtlı ince-yapı mimarisi `[VERIFY]` lisans |
| **TransUNet** | hybrid | **Tek ablation satırı** — "nnU-Net Revisited" (2404.09556): 100–1000+ örnek bile transformer'lar CNN'lere kaybediyor; beklenen sonuç n≈70'de "yardımcı olmuyor" |
| Classical **Hessian / ridge** filtering | CV, no training | **No-DL baseline** for thin tubular structures (R-V7) |
| **Cellpose-SAM** / **μ-SAM+APG** / **CellSAM** / StarDist | foundation | **W6 kapısı** — gövde instance motoru + pseudo-label kaynağı + "FM prior" satırı; **nörit kolu hiçbir zaman FM'den gelmez** (star-convex öncülü ince dallara yapısal düşman) |
| **MoCell / DICE / Cell-Clarity / "ISCE"** | — | **DOĞRULANAMADI — kamuda böyle proje yok; alıntılamayın** (ISCE = μ-SAM karışıklığı); `16` §1.2 |
| HF "Image Segmentation" listesi (RMBG/BiRefNet/Mask2Former, PP-DocLayout, clothes/face, U2-Net vb.) | genel | **GÖREV FARKLI — aday değil.** Hepsinin eğitim verisi (portre matting, belgelendirme düzeni, kıyafet bölgeleri, yüz segmenti) PC12 faz-kontrastıyla kesişmez; domain gap, model boyutundan bile önce elenme sebebi. Tek istisna **MedSAM2** (tıp SAM2'si) → W6 kapısına "zayıf kontrol" satırı olarak girdi (sıfır-atış sayısı her tabloya girecek). |

**Red'den çıkarılanlar:** Swin-UNet (LİSANSSIZ repo) · DS-UNet / **VesselMUNet / TransNewSeg** (kamu kaydında yok, 404+0 arama sonucu doğrulandı) · FPN (ince yapıda zararlı) · MM-UNet/Mamba (ONNX riski — watch) · **HF genel segmentasyon listesi** (yukarıdaki görev-farkı satırı).

## Recommendation `[PLANNED]`
- **Ana hat (16 §6):** **İKİ KOL** — (a) gövde: SMP pretrained encoder + U-Net/UNet3+ decoder;
  (b) nörit: düz binary kol + **soft-clDice** loss (MIT). 5-fold mean±std ile W9'da seçilir.
- **Run Cellpose-SAM zero-shot EARLY** (W6 gate, `13-SUNUM-PLAN` SUNUM 3) + μ-SAM+APG +
  CellSAM + StarDist + SAM (zayıf kontrol) — sıfır-atış sayıları her tablodaki "FM prior" satırı.
- **LoRA-on-SAM karşılaştırma kolu** (peft-sam, 24 GB'a sığar) — `16` §5-7.
- **nnU-Net v2 ResEnc L** W9 karşılaştırmasında (D12). **TransUNet** tek ablation satırı.
- **Always run** the classical + foundation baselines so every claim is relative.
- **Decision rule (W9 gate):** 5-fold CV **mean ± std** — DSC per class,
  tie-break: **clDice (nörit) → Betti-1 error → özellik MAE** → runtime. A bare single
  number is not a result (`07-METRICS`).

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
- `[IDEA]` TransUNet / ViT-UNet — **tek ablation satırı** (16 §1.1; 2404.09556).
- `[IDEA]` MM-UNet (Mamba, 2025) — yalnız karşılaştırma notu; ONNX export riski nedeniyle teslimatta yok (16 §1.1).
