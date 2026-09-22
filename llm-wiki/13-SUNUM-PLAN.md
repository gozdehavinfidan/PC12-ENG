# 13 — SUNUM Plan (the demo-first spine)

> **We present in EVERY presentation week.** `[CONFIRMED]` (user + `PC12_Gantt_Chart.xlsx`)
> That makes the presentation calendar the project's real deadline structure —
> so work is sequenced by **what is on screen that day**, not by when it is
> technically finished.

## The calendar

| Week | Type | Note |
|------|------|------|
| W2, W4, W6, W9, W11, W13 | **SUNUM** | We present. Something must be demoable. |
| W7, W10, W12, W14 | work weeks | Buffer + improvement |
| W8 | **VİZE** | Midterm — no project work planned |
| W15 | **FINAL** | Everyone together, full integration |

Calendar dates are deliberately **`[OPEN]`** — we track relative weeks only.

## The rule

Every SUNUM row below has four fields, and none of them is optional:

- **Demo** — what is literally on the screen.
- **Claim** — the one sentence we are defending. A presentation with no claim is
  a status update, and a status update is forgettable.
- **Artifact** — the thing that must exist in the repo for the demo to be real.
- **Fallback** — what we show if it slips. Decided *in advance*, calmly, rather
  than at 2 a.m. the night before.

---

## SUNUM 1 — W2 · M1 · speaker: EK (both)

- **Demo:** this dashboard, live; the `llm-wiki`; the pipeline block diagram;
  the class scheme (D0); the small-data strategy (`15-SMALL-DATA-STRATEGY`).
- **Claim:** *"We did not copy the TÜSEB proposal. We identified its real
  constraint — ~70 labeled images — and redesigned the approach around it."*
- **Artifact:** `docs/` dashboard renders; `DECISIONS.md` D0–D9.
- **Fallback:** slides generated from the wiki markdown.
- **Why this works as a first presentation:** most groups present a literature
  survey in W2. Presenting a *working tool* plus a named constraint and a
  decision log is a stronger opening and costs us nothing extra — we needed the
  dashboard anyway.

## SUNUM 2 — W4 · M2 · speaker: BM (Berke)

- **Demo:** the filled **data card** (70 images: modality, resolution, pixel
  size, batches); the labeling protocol; **inter-annotator agreement** on the
  double-labeled subset; before/after preprocessing pairs; augmentation samples;
  status of the incoming data batch (İP7).
- **Claim:** *"Our labels are consistent enough to train on — and here is the
  number that proves it, which is also the ceiling on any DSC we can honestly
  report."*
- **Artifact:** pilot dataset frozen + protocol document + agreement score.
- **Fallback:** protocol + agreement measured on 5 images instead of the full
  subset.
- **Dependency:** the protocol must be frozen **before** the new data lands, or
  old and new labels are not comparable (`15-SMALL-DATA-STRATEGY` §9).

## SUNUM 3 — W6 · M3 · speaker: ML (Gözde)

- **Demo:** training runs end-to-end — patch pipeline → pretrained-encoder U-Net
  → prediction → overlay on a real image; loss curves; first fold's DSC per
  class; plus the **Cellpose-SAM zero-shot** comparison run.
- **Claim:** *"The pipeline is real and reproducible, and we already know
  whether a foundation model beats training our own."*
- **Artifact:** working training pipeline, first CV fold, one zero-shot baseline.
- **Fallback:** deliberate overfit on 3 images — proves the pipeline is wired
  correctly even if accuracy is not there yet. This is a legitimate engineering
  result, not an excuse; say so.

*(W7 — improvement week. W8 — VİZE, no work.)*

## SUNUM 4 — W9 · M4 · speaker: ML (Gözde), with BM on morphometry

- **Demo:** the model comparison table as **mean ± std over 5 folds** (pretrained
  U-Net vs nnU-Net vs Cellpose-SAM); the chosen architecture and *why*;
  morphometry v1 — skeleton→graph neurite length/count/angle compared against
  Berke's hand measurements.
- **Claim:** *"We chose this architecture because cross-validation says so, not
  because it is fashionable — and our measurements agree with a human's."*
- **Artifact:** feature-extraction module + comparison table + agreement plot.
- **Fallback:** comparison table only; morphometry on 3 images.

## SUNUM 5 — W11 · M5 · speaker: ML (Gözde)

- **Demo:** results including the new data batch; **error analysis** — the
  specific cases where it fails (touching cells, faint neurites, out-of-focus
  fields) and *why*; Seg-Grad-CAM overlays showing where the model looks.
- **Claim:** *"We know where our model fails and we can show you what it is
  looking at when it does."*
- **Artifact:** evaluation report + XAI figures.
- **Fallback:** error analysis without the XAI layer — the failure taxonomy is
  the valuable half.

## SUNUM 6 — W13 · M6 · speaker: ML (Gözde), EK on integration

- **Demo:** the application — load a real microscopy image, run the full
  pipeline, see overlays and the measured features, export a report.
- **Claim:** *"A researcher with no machine-learning knowledge can analyse an
  image and get a report, offline."*
- **Artifact:** integrated app + ONNX-packaged model + report export.
- **Fallback:** CLI demo driving the real pipeline + the UI shell on mock data.
  Be explicit about which half is real.

*(W14 — end-to-end testing, bug fixing, polish.)*

## FINAL — W15 · speaker: EK (both)

Full end-to-end demo · final report · plan-vs-actual retrospective using the
frozen baseline in `03-SEMESTER-PLAN` against the live dashboard.

---

## How to use this file

Before each SUNUM, run `/sunum` (see `11-SEARCH-WORKFLOW` and
`.claude/commands/sunum.md`). It cross-checks this plan against `docs/data.js`,
flags stale task statuses, and surfaces any `[OPEN]`/`[VERIFY]` tag that the
week's claim depends on — because the fastest way to lose credibility in a
presentation is to assert something the wiki still marks as unverified.

**If a demo is at risk, switch to the fallback early and say so out loud.**
A delivered fallback with an honest explanation reads as competence. A failed
live demo reads as a failed project, even when the work behind it is fine.
