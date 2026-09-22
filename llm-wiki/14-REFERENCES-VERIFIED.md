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
| NeuroQuantify | `12-REFERENCES.md` R1 / `05-MODELS.md` | Does the paper exist under the stated authors/year? Does the repo exist? Licence? Does its dataset overlap ours? |
| AutoNeuriteJ | `12-REFERENCES.md` R2 | DOI resolves? Fiji/ImageJ plugin still available? |
| GATS (3D axon topology) | search result, arXiv:2311.04116 | Relevant to 2D? Probably 3D-only — check before investing |
| ContextLoss | search result, arXiv:2506.11134 | Topology-preserving alternative to clDice — newer, less established |

---

## How to add to this file

Follow `11-SEARCH-WORKFLOW.md`. Minimum bar for an entry here:

1. The source was **actually retrieved** (search result, DOI, or file in hand).
2. We wrote **what it supports in our project** — not just a bibliographic line.
3. Any number taken from it is labelled as **the paper's claim under the paper's
   conditions**, never as a fact about our data.
4. It carries a verification tag, and the tag is honest.
