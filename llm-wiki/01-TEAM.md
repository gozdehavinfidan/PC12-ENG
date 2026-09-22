# 01 — Team & Division of Labor

## Members
| Person | Dept | Code | Strengths / focus |
|--------|------|------|-------------------|
| **Gozde Havin Fidan** | Electrical & Electronic Engineering | **G** | ML pipelines, preprocessing, model training, post-processing, feature extraction, dashboard/app engineering, ONNX/packaging |
| **Berke Dinc** | Biomedical Engineering | **B** | PC12 biology, dataset acquisition, labeling protocol, ground-truth masks, biological validity of metrics, domain validation |

**E = Ekip (both)** for shared tasks (labeling, integration, presentations,
QA).

> Rationale: the split follows the base project's two halves — the **biology/data
> side** (Berke) and the **AI/software side** (Gozde) — so each person is
> accountable for their half but they co-own the shared seams. `[PLANNED]`

## Role map (RACI)
R = Responsible (does it), A = Accountable (owns outcome), C = Consulted,
I = Informed.

| Area | G | B |
|------|---|---|
| Dataset acquisition & data card | C | **A/R** |
| Labeling protocol & ground-truth masks | R | **A/R** |
| Preprocessing + augmentation pipeline | **A/R** | C |
| Model selection & training | **A/R** | I |
| Post-processing / morphometric features | **A/R** | C |
| Metric validity (biological meaning) | C | **A/R** |
| XAI layer | **A/R** | C |
| Dashboard (project tracker) | **A/R** | I |
| Desktop app (NeuroMind) | **A/R** | C |
| Report generation | R | **A/R** |
| Presentation content (biology) | I | **A/R** |
| Presentation content (method/ML) | **A/R** | I |

## Meeting cadence `[PLANNED]`
- **Weekly sync** (before each SUNUM week): 30–60 min — review WBS status,
  move tasks, flag `[RISK]`s, update `LOG.md`, prep the presentation.
- **Async by default**: shared repo + this wiki; tasks tracked in the
  dashboard; decisions logged in `DECISIONS.md`.
- **Presentation rotation**: alternate who leads; both present.

## Working agreements `[PLANNED]`
1. One shared git repo; every experiment runs from **config + seed**
   (reproducibility).
2. Every task has a **done-criterion** in `03-SEMESTER-PLAN`.
3. Any fact that changes our plan goes through `11-SEARCH-WORKFLOW`
   (search → tag → decide → log).
4. No silent scope changes — add to `10-IDEAS-STRETCH` first, then promote
   into the plan only if time allows.
