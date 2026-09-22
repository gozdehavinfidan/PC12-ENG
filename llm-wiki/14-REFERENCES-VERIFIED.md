# 14 — References (VERIFIED)

> **Why this file exists separately from `12-REFERENCES.md`.**
>
> `12-REFERENCES.md` was drafted from model memory and has **never been checked
> against a live source**. It contains precise-looking arXiv IDs, DOIs, author
> attributions and one entry dated *"Springer 2026"* — exactly the pattern that
> plausible-but-fabricated citations take. **Do not cite from `12` in a
> submitted report until each entry has been verified.**
>
> **Every entry in THIS file was returned by a live web search on 2026-09-22.**
> Where a claim below is the *paper's* claim rather than a verified fact about
> our data, it is written as such.

**Verification status legend:** `[V-SEARCH]` = the title/venue/identifier was
returned by a live search. `[V-READ]` = we have additionally read the paper.
`[V-RUN]` = we have run the code ourselves. Upgrade the tag as we go — a
`[V-RUN]` reference is worth ten `[V-SEARCH]` ones.

---

## Segmentation loss / topology

**R-V1 · clDice — a Novel Topology-Preserving Loss Function for Tubular
Structure Segmentation.** Shit et al., CVPR 2021. arXiv:2003.07311. `[V-SEARCH]`
- **Supports:** using a topology-aware auxiliary loss for neurites.
- **Why it matters here:** Dice measures *area* overlap. A neurite broken into
  three fragments can still score well on Dice while being topologically wrong —
  and neurite **count** and **length**, two of our five headline outputs, are
  then both wrong. clDice is computed on the morphological **skeleton**, so it
  penalises exactly the disconnection that ruins our morphometry.
- **Paper's claim:** benchmarked on five public datasets including vessels,
  roads **and neurons** (2D and 3D); training with soft-clDice gives better
  connectivity and graph similarity as well as better volumetric scores.
- ⚠ **Overlaps group A2's headline** (DS-UNet + soft-clDice). Decide
  consciously whether we use it as an auxiliary term or differentiate. See D8.
- Links: <https://arxiv.org/pdf/2003.07311> ·
  <https://openaccess.thecvf.com/content/CVPR2021/papers/Shit_clDice_-_A_Novel_Topology-Preserving_Loss_Function_for_Tubular_Structure_CVPR_2021_paper.pdf>

---

## Foundation models (directly relevant at n≈70)

**R-V2 · Cellpose-SAM: superhuman generalization for cellular segmentation.**
bioRxiv 2025, doi 10.1101/2025.04.28.651001. `[V-SEARCH]`
- **Supports:** zero-shot / few-shot instance segmentation baseline
  (`15-SMALL-DATA-STRATEGY` §8).
- **Paper's claim:** adapts SAM's pretrained transformer backbone to the
  Cellpose framework; reports outperforming inter-human agreement and
  approaching the human-consensus bound; made robust to channel shuffling, cell
  size, shot noise, downsampling and blur. Supports finetuning and
  human-in-the-loop training.
- **Why it matters here:** it produces **instance** masks. Deriving cell count
  from a *semantic* mask — which the base project does — silently merges
  touching cells into one blob. This fixes that for free.
- Link: <https://www.biorxiv.org/content/10.1101/2025.04.28.651001v1>

**R-V3 · CellSAM: a foundation model for cell segmentation.** *Nature Methods*
2025, s41592-025-02879-w. `[V-SEARCH]`
- **Supports:** an alternative foundation-model baseline; peer-reviewed venue.
- Link: <https://www.nature.com/articles/s41592-025-02879-w>

**R-V4 · Microscopy Cell Segmentation: Review and Benchmarking of Task-Specific
and Foundation Models.** *Journal of Imaging* 2025, doi 10.3390/jimaging12070297.
`[V-SEARCH]`
- **Supports:** choosing between a task-specific U-Net and a foundation model
  with evidence rather than preference — directly feeds the W9 decision gate.

---

## Neurite / neuron morphology (closest prior art)

**R-V5 · Deep Neurite Analysis Tool (DeNAT): a machine-learning framework for
precise automated neurite outgrowth measurement.** bioRxiv 2025,
doi 10.1101/2025.09.18.676567. `[V-SEARCH]`
- **Supports:** closest recent prior work for automated neurite-outgrowth
  measurement; a baseline to position ourselves against.
- **Paper's framing:** notes that existing automated neurite-outgrowth methods
  were designed almost exclusively for *cultured* neurons — which is our case.
- Link: <https://www.biorxiv.org/content/10.1101/2025.09.18.676567.full.pdf>

**R-V6 · Automated Morphological Analysis of Neurons in Fluorescence Microscopy
Using YOLOv8.** arXiv:2510.19455. `[V-SEARCH]`
- **Supports:** an instance-segmentation alternative to semantic U-Net; relevant
  because counting is an instance problem.
- Link: <https://arxiv.org/pdf/2510.19455>

**R-V7 · Automated Analysis of Neuronal Morphology in 2D Fluorescence Micrographs
through an Unsupervised Semantic Segmentation of Neurons.** *Neuroscience* 2024,
S0306452224002185. `[V-SEARCH]`
- **Supports:** the classical-CV half of our hybrid. Uses **Hessian-based**
  neurite detection plus intensity/shape reconstruction, then classifies neurites
  into axon / dendrite / branch via geodesic distance transforms.
- **Why it matters here:** Hessian (vesselness/ridge) filtering is a strong,
  training-free prior for thin tubular structures — valuable at n≈70 and a
  credible non-DL baseline for the W9 comparison table.
- Link: <https://www.sciencedirect.com/science/article/pii/S0306452224002185>

---

## Morphometry from masks

**R-V8 · skan — skeleton analysis in Python.** Docs: <https://skeleton-analysis.org>
· code: <https://github.com/jni/skan> · napari plugin available. `[V-SEARCH]`
- **Supports:** ADR **D2** — skeleton → graph for per-neurite length, branch
  count and junctions, replacing the base's Canny+Hough.
- **Capability:** decomposes a skeleton into branches and returns per-branch
  statistics (pixel coordinates, lengths, neighbours) as pandas DataFrames;
  works in 2D and 3D.
- **Origin:** introduced alongside a study of malaria-parasite remodelling of
  the red-blood-cell membrane skeleton (PMC5816961) — i.e. it is a real
  research tool, not a toy.
- **Next step:** upgrade this to `[V-RUN]` by skeletonising 3 pilot masks and
  comparing branch lengths against Berke's hand measurement (the D2 spike).

---

## Explainability (İP-XAI)

**R-V9 · Leveraging CAM Algorithms for Explaining Medical Semantic
Segmentation.** MELBA 2024, arXiv:2409.20287. `[V-SEARCH]`
- **Supports:** the `08-XAI.md` plan — adapting classification CAM methods to
  segmentation (Seg-Grad-CAM / Seg-HiRes-Grad-CAM for pixel-wise explanation).
- Links: <https://arxiv.org/pdf/2409.20287> ·
  <https://www.melba-journal.org/papers/2024:023.html>

**R-V10 · The Do's and Don'ts of Grad-CAM in Image Segmentation.** OpenReview.
`[V-SEARCH]`
- **Supports:** using CAM **correctly**. Read this *before* producing XAI
  figures — naively transplanting classification Grad-CAM into segmentation
  produces confident-looking heatmaps that do not mean what they appear to.
  A wrong XAI figure in a presentation is worse than none.
- Link: <https://openreview.net/pdf?id=rnQUJLbODk>

**R-V11 · Explainable AI (XAI) in image segmentation in medicine, industry and
beyond: a survey.** ScienceDirect S2405959524001115. `[V-SEARCH]`
- **Supports:** method selection for the XAI spike (T4.1).

---

## Watchlist — found but NOT yet verified

Do not cite these until checked; they are recorded so we do not lose the lead.

| Lead | Where it came from | What to verify |
|------|--------------------|----------------|
| GATS (3D axon topology) | search result, arXiv:2311.04116 | Relevant to 2D? Probably 3D-only — check before investing |
| ContextLoss | search result, arXiv:2506.11134 | Topology-preserving alternative to clDice — newer, less established |

~~NeuroQuantify~~ → **verified 2026-09-22 (R3)**: arXiv:2310.10978 + repo
`StanleyZ0528/neural-image-segmentation` doğrulandı; **LICENSE dosyası YOK** —
incelenebilir, kopyalanamaz; 20 µm branch-pruning sabiti kağıttan alıntı.
~~AutoNeuriteJ~~ → **verified 2026-09-22 (R3)**: PLOS ONE 15(7):e0234529,
DOI 10.1371/journal.pone.0234529; akson kuralı (en uzun yol, >2× ikinci uzun
ve >100 px) + minimum-intensity loop-cut — `16` §2'de kullanımda.

---

## 2026-09-22 architecture research (R1–R6, all `[V-SEARCH]` + repo LICENSE checks)

Full per-claim detail + `supports` notes: `_research/R*.json` (raw scout
payloads). Entries here are the ones the plan now depends on.

**Benchmark / method-of-record**
- **Revisiting foundation models for cell instance segmentation** — MIDL 2026,
  arXiv:2603.17845. `[V-READ]` (tam okundu) CellPose-SAM / CellSAM / μ-SAM(+APG) /
  SAM2 / SAM3 head-to-head, 36 dataset; label-free mikroskopide üst-3; mSA/IoU
  matching protokolü = W6 kapısının metrik reçetesi.
- **nnU-Net Revisited: A Call for Rigorous Validation** — arXiv:2404.09556.
  100–1000+ örnekte bile CNN U-Net(ler)+scaling, transformer'lara üstün →
  TransUNet'in tek-ablation-satırı kararının kanıtı.
- **Lost in the Folds: When Cross-Validation Is Not a Deep Ensemble** —
  Kirscher et al., MICCAI 2026, arXiv:2605.18329. CV-fold ensemble = meşru ama
  zayıf kalibreli proxy; gerçek 5-seed ensemble kalibrasyon/hata-tespitte üstün
  → D13 ensemble kararı.

**Morphometry stack (hepsi açık-lisans, pip)**
- **TopoLoss** — arXiv:1906.05404 (NeurIPS 2019); kod `HuXiaoling/TopoLoss` (MIT).
  Betti-match loss; 2×2 ablation'ın ikinci eksen.
- **FilFinder** — `e-koch/FilFinder` (MIT): skeleton+graf+length-pruning;
  NeuroQuantify'nin kullandığı kütüphane.
- **pycircstat2** — `circstat/pycircstat2` (MIT): Rayleigh,
  Mardia-Watson-Wheeler, Watson-Williams (circular açı istatistiği).
- **ripser.py** — `scikit-tda/ripser.py` (MIT): persistence barcode (stretch metrik).
- **SNT** — `morphonets/SNT` (GPL — output-level cross-check, depoya girmez):
  Sholl (angular), Strahler, root-angle, TDA modülü.

**XAI / uncertainty**
- **Captum** — `pytorch/captum` (BSD-3): Integrated Gradients, NoiseTunnel.
- **torch-uncertainty** — `torch-uncertainty/torch-uncertainty` (Apache-2.0,
  NeurIPS D&B 2025): ensemble/ECE/temperature scaling/selective-classification.
  ⚠ `pytorch-uncertainty` (jbshr + jacobgil) **404 — ölü paket**.
- **pytorch-grad-cam** — `jacobgil/pytorch-grad-cam` (MIT, 13k★): fallback +
  ViT reshape.

**Data-efficiency**
- **Simple Copy-Paste** — arXiv:2012.07177 (+CP2, 2203.11709): rijit-ünite
  pasting'in nadir-sınıf kanıtı.
- **Deep Active Learning (axon-myelin, histology)** — arXiv:1907.05143:
  **14 ve 24 görsellik** veri setlerinde uncertainty-AL → tam n≈70 rejimi kanıtı.
- **DINOv2** — arXiv:2304.07193, `facebookresearch/dinov2` (Apache-2.0):
  pool ≥300 ise spike; Cell-DINO varyantı CC-BY-NC+FAIR-NC (gated).

**Bold-ideas anchors**
- **NeuNet** — arXiv:2312.14518 (AAAI 2024): skeleton+GNN nörön sınıflandırma;
  5-4 spike'ın en yakın önceki çalışması (küçük-veri 2D PC12 versiyonu yok).
- **SAMed** (`hitachinsk/SAMed`, MIT) + **peft-sam** (MIDL 2025) + Conv-LoRA
  (2401.17868) + SAM-OCTA (2309.11758): LoRA-on-SAM kolu (5-7); SAM-OCTA açıkça
  "birkaç yüz örnek → overfit → LoRA" der.
- **Tent** — arXiv:2006.10726 (ICLR 2021): batch-2 shift robustluk protokolü (5-5);
  LATTA (2510.05530) kararsızlık notu.
- **Cross-modal distillation** — arXiv:2606.00928 (2026): FM teacher → 4 küçük
  U-Net, +12 Dice, 23× parametre (kağıdın iddiası) → 5-10 stretch.
- **Pixel Embedding → SWC** — arXiv:2507.23359 (2025): end-to-end image→SWC
  kanıtı → 5-9 (pipeline distillasyonu).
- **SAM2 cell tracking** (2509.09943) + **Trackastra** (2405.15700): 5-18
  (time-lapse) — longitudinal veri teyidi `[OPEN]` bekliyor.

**Negative results (doğrulanmış yokluk — alıntılamayın):**
- **VesselMUNet**: repo 404, GitHub code search 0, arXiv 0, Crossref 0.
- **TransNewSeg**: aynı dört kanıt.
- **MoCell / DICE (foundation) / Cell-Clarity / "ISCE"**: çoklu arXiv+Crossref+
  GitHub sorgusunda 0 sonuç; ISCE = μ-SAM karışıklığı.
- **CRITIC repo** (CVPR 2020 UDA): birden fazla aday URL 404 — kaynağı
  çözülene dek kullanılmaz. **STARDOM**: arXiv/GitHub'ta bulunamadı.

**License traps (doğrulandı):** Cellpose ağırlıkları CC-BY-NC (kod BSD-3) ·
 resmi UNetPlusPlus ASU-non-commercial · Swin-UNet lisanssız · Pytorch-UNet GPL ·
 NeuroQuantify LICENSE yok · MM-UNet MIT ama ONNX riski.

---

## How to add to this file

Follow `11-SEARCH-WORKFLOW.md`. Minimum bar for an entry here:

1. The source was **actually retrieved** (search result, DOI, or file in hand).
2. We wrote **what it supports in our project** — not just a bibliographic line.
3. Any number taken from it is labelled as **the paper's claim under the paper's
   conditions**, never as a fact about our data.
4. It carries a verification tag, and the tag is honest.
