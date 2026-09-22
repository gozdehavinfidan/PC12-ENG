# LLM-WIKI — PC12 Morphological Analysis (ENG401)

> A living knowledge base + project plan for our 1-semester senior project:
> the **concept and purpose** of the TÜSEB 2026 NTI proposal (`TUSEB/bolumler/`)
> with our own segmentation architecture — automated neural morphological
> analysis of **PC12 cells** → **NTI** → desktop app. (D14)

**Team**
- **Gozde Havin Fidan** — Electrical & Electronic Engineering (ML / software / dashboard)
- **Berke Dinc** — Biomedical Engineering (data / biology / labeling / validation)

**One-liner.** Given a microscopy image of PC12 cells (phase-contrast and/or
fluorescence), automatically measure the **4 NTI parameters** (neurite
length, branching count, branching-angle distribution, soma morphology),
combine them into the **Neural Toxicity Index (NTI)**, explain which
parameter drives it, and show it in an **IntelliCell-style offline desktop
app** + a project dashboard.

---

## How to use this wiki

**Read order:** `00-OVERVIEW` → `15-SMALL-DATA-STRATEGY` (⭐ the constraint that
shapes every technical choice) → `02-BASE-PROJECT-TUSEB` → `13-SUNUM-PLAN` (what
we must show, and when) → `03-SEMESTER-PLAN` → everything else as needed.
`11-SEARCH-WORKFLOW` is how we keep this wiki honest and up to date.

**Conventions**
- **Weeks are relative** to the course calendar: `Week 1 … Week 15`
  (see `03-SEMESTER-PLAN`). We do NOT hardcode calendar dates here.
- Every non-obvious claim carries a **tag**. We never invent facts — unknowns
  are marked `[OPEN]`, guesses are marked `[VERIFY]`.
- Decisions go in `DECISIONS.md` (ADR-style). Changes go in `LOG.md`.

---

## Tag legend (used across ALL files)

| Tag | Meaning |
|-----|---------|
| `[BASE]` | Copied from the **2025 "NeuroMind" PDF** (reference level after D14). Fact. |
| `[BASE26]` | Copied from the **2026 TÜSEB bolumleri** = **the concept canon** (D14). Fact. |
| `[PLANNED]` | A decision/plan **we** made on top of the base. Committed. |
| `[OPEN]` | Unknown — needs info or a decision. Do **not** build on it silently. |
| `[IDEA]` | Stretch / inspiration. Not committed to the semester plan. |
| `[RISK]` | A risk we are tracking. |
| `[VERIFY]` | Plausible but not yet confirmed — check before relying on it. |
| `[DONE]` / `[IN]` / `[TODO]` | Task status. |

**Ground rule:** if it is not tagged `[BASE]`, it is either our choice
(`[PLANNED]`), an idea (`[IDEA]`), or open (`[OPEN]`/`[VERIFY]`). The wiki
must always be able to tell you *where a fact came from*.

---

## File map

| File | What it is |
|------|-----------|
| `README.md` | This hub — purpose, tags, file map, ground rules. |
| `00-OVERVIEW.md` | One-pager: problem, what we build, deliverables, success, timeline. |
| `01-TEAM.md` | Members, roles, RACI, meeting cadence, division of labor. |
| `02-BASE-PROJECT-TUSEB.md` | Faithful decode of the **2026 TÜSEB application (concept canon, D14)** + the 2025 NeuroMind PDF as reference. **⚠ Depoda YOK** — yayımlanmamış bir başvurunun içeriği olduğu için `.gitignore`'da; yerel kopyanızda durur. |
| `03-SEMESTER-PLAN.md` | **FROZEN baseline** — the plan of record. Live status lives in the dashboard. |
| `04-PIPELINE.md` | End-to-end technical architecture (data → … → app). |
| `05-MODELS.md` | Segmentation model survey + selection criteria + recommendation. |
| `06-DATA.md` | Data sources, labeling protocol, QA, augmentation, splits. |
| `07-METRICS.md` | Metrics, evaluation protocol, targets, baselines. |
| `08-XAI.md` | Explainability plan (Grad-CAM/SHAP) + validation. |
| `09-DASHBOARD.md` | The dashboard: how it is built and how to maintain it. |
| `10-IDEAS-STRETCH.md` | Inspired improvements, ranked by effort/impact/risk. |
| `11-SEARCH-WORKFLOW.md` | **The workflow for searching and thinking** (keep the wiki honest). |
| `12-REFERENCES.md` | ⚠ **UNVERIFIED** source list — do not cite in a report until checked. |
| `13-SUNUM-PLAN.md` | **The demo-first spine** — what we show at every presentation week. |
| `14-REFERENCES-VERIFIED.md` | ✅ Live-verified sources. **Cite from here.** |
| `15-SMALL-DATA-STRATEGY.md` | ⭐ **n ≈ 70 governs everything** — read before 04/05/06/07. |
| `16-ARCHITECTURE-RESEARCH.md` | ✅ **Professör-gözüyle mimari araştırması** (2026-09-22, 6 paralel literatür scout'u): doğrulanmış mimari / foundation-model / morpho / veri-verimliliği / XAI adayları + **nihai mimari önerisi** (`04`'ün v2'si). |
| `../KLAVUZ.html` | **Proje klavuzu** — yeni gelen bir EEE öğrencisi için her şeyi (konsept + rapor + pipeline + tasarım noktaları) adım adım anlatan tek dosya. **⚠ Depoda YOK** (rapor içeriği özetlediği için `.gitignore`'da); yerelde çift-tıkla. |
| `LOG.md` | Historical log + pointer — the live log is in `docs/data.js`. |
| `DECISIONS.md` | Decision log (ADR-style). |

**Outside the wiki:** `../docs/` is the **dashboard** (live status, Gantt,
kanban, SUNUM view). Its single source of truth is `../docs/data.js`.
