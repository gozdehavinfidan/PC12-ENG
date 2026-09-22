# 12 — References

> Every external source we rely on, with **what it supports** and how strong
> the evidence is. Add new entries as we search (`11-SEARCH-WORKFLOW` step 2).
> Strongness: **P**=primary (paper/repo), **R**=review/benchmark, **S**=secondary.

## Prior work / baselines
| ID | Source | Type | What it supports |
|----|--------|------|------------------|
| R1 | **NeuroQuantify** — Dang et al. 2023. arXiv:2310.10978; code `github.com/StanleyZ0528/neural-image-segmentation` | P | Closest prior work: DL seg of cells+neurites from phase-contrast; neurite length + orientation; offline tool. Our baseline to beat / build on. `[VERIFY]` license + data overlap. |
| R2 | **AutoNeuriteJ** — PLOS ONE 2020 (`journal.pone.0234529`) | P | ImageJ plugin; particle analysis + **skeletonization** for length, branching, width; min-length filtering. Supports the skeleton+graph morphometric approach. |
| R3 | **Sholl analysis** — Wikipedia + Wiley `cyto.a.20954` (automated Sholl) | P | Standard quantitative method for neurite branching/complexity. Supports `[IDEA]` B2 (Sholl profile). |

## Segmentation models / tools
| ID | Source | Type | What it supports |
|----|--------|------|------------------|
| R4 | **Cellpose** / **StarDist** — comparison (Technology Networks 2025) + DeepCell | P/R | Strong off-the-shelf cell segmentation; Cellpose star-conv instances; our **pretrained baseline**. |
| R5 | **nnU-Net v2** (isicnn / MICCAI) | P | Auto-config U-Net; 5-fold CV; strong default → our "auto-config option". `[VERIFY]` our hardware. |
| R6 | **TransUNet** (Petersen et al.) | P | CNN+ViT hybrid; global context → the "reach" model. Data-hungry caveat. |
| R7 | **cs-benchmark** — `github.com/STOmics/cs-benchmark` | R | Benchmark of 11 cell-seg methods (MEDIAR, Cellpose, StarDist, SAM, HoVer-Net…). Useful for picking a baseline. |
| R8 | **U-Net architecture review** — Springer 2026 (comprehensive) | R | U-Net variants for cell/nuclei segmentation; supports choosing a U-Net-family workhorse. |
| R9 | **MONAI** | P | Named in the TÜSEB base as the 2D segmentation reference `[BASE]`. A stated baseline. |

## Morphometrics / analysis
| ID | Source | Type | What it supports |
|----|--------|------|------------------|
| R10 | **Quantitative Assessment of Neurite Outgrowth in PC12 Cells** — Springer Protocols | P | How to measure neurite number + length under NGF; the biological ground for our metrics. |
| R11 | **Yokogawa — PC12 Cell Neurite Analysis** application note | S | Practical example of neurite extension measurement after NGF. |
| R12 | **Differentiating PC12 cells to evaluate neurite densities (live-cell)** — Cell STAR Protocols 2022 | P | Protocol for differentiating PC12 to known neurite densities; relevant to data conditions. |

## Datasets
| ID | Source | Type | What it supports |
|----|--------|------|------------------|
| R13 | **NeuroQuantify Dataset** — Edmond (Max Planck), doi:10.17617/3.UIBMJX | P | Public PC12/neurite phase-contrast dataset. Potential **open data** if our dept data is insufficient. |
| R14 | **PC12 (kylejlynch/PC12)** — GitHub | P | PC12 SEM images + neurite length/orientation measurements. Candidate supplementary data. |
| R15 | **IDR — Image Data Resource** (`idr.openmicroscopy.org`) | R | Public microscopy repository; search fallback for neurite/PC12 data. |

## XAI
| ID | Source | Type | What it supports |
|----|--------|------|------------------|
| R16 | **pytorch-grad-cam** — jacobgil | P | Grad-CAM / Integrated-Gradients for CNN+ViT, segmentation. Our XAI spike tool. |
| R17 | **Grad-CAM SLR** — J. Computational Science 2025 | R | Grad-CAM variants + medical-imaging applicability; supports XAI method choice. |

## The base project (internal)
| ID | Source | Type | What it supports |
|----|--------|------|------------------|
| R18 | **Tuseb_2025_Basvuru_Eren.pdf** (in this folder) | P | The 2025 "NeuroMind" proposal (44235) — **reference only** after D14; source of the `[BASE]` tags. |
| R18b | **`TUSEB/bolumler/*.txt`** (this repo) | P | **The concept canon** (D14): 2026 TÜSEB application, section-by-section dump — NTI, 5 WPs, H₁–H₃, K1–K6, R1–R11, IntelliCell. Source of all `[BASE26]` facts (see `02`). |
| R19 | **PC12_Gantt_Chart.xlsx** (in this folder) | P | Example Gantt / WBS structure + candidate model tracks (DS-UNet, nnU-Net, ViT-UNet). Reference only — not binding. |

## Datasets / models we may *add* (watchlist)
- `[VERIFY]` Can we use R13 (NeuroQuantify Edmond dataset) as a supplement?
- `[VERIFY]` Is a **Cell-SAM / SAM-based** baseline (C3) runnable on our data?
- `[OPEN]` Any **time-lapse PC12 under NGF** dataset for the C1 trajectory idea?
