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
- **Claim:** *"We did not copy the TÜSEB proposal. We kept its concept — the
  NTI measurement chain — and redesigned the architecture around our real
  constraint: ~70 labeled images."*
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

> 2026-09-22 araştırması (`16-ARCHITECTURE-RESEARCH`) bu SUNUM'u netleştirdi:
> ana hat **iki kollu** (gövde + nörit/soft-clDice) ve **W6 = FM zero-shot kapısı**
> (5 model: Cellpose-SAM `cpsam_v2` · μ-SAM+APG · CellSAM · StarDist · SAM zayıf
> kontrol; metrik reçetesi = MIDL 2026 mSA/IoU-matching, arXiv:2603.17845).
> **W6'e ek kontrol (2026-09-22):** **MedSAM2** — tıp görüntüsü SAM2'si; "tıp
> domain'inde eğitilmiş FM bile nöriti alamaz mı?" sorusunun satırı (zayıf
> kontrol, beklenti: gövdede SAM'den iyi, nöritte yine yok → FM öncülü tezi
> için en güçlü karşı-argümanı denemiş oluyoruz).

- **Demo:** training runs end-to-end — patch pipeline → pretrained-encoder U-Net
  (gövde) + nörit kolu (soft-clDice) → prediction → overlay on a real image;
  loss curves; first fold's DSC per class; plus the **FM zero-shot gate table**
  (6 model × 2 modality, MedSAM2 dahil; "FM prior" satırı her tabloya girecek).
- **Claim:** *"The pipeline is real and reproducible, and we already know
  whether a foundation model beats training our own — and no foundation model
  segments our neurites, which is why our neurite branch is classical
  skeleton-graph morphometry."*
- **Artifact:** working training pipeline, first CV fold, zero-shot gate table.
- **Fallback:** deliberate overfit on 3 images — proves the pipeline is wired
  correctly even if accuracy is not there yet. This is a legitimate engineering
  result, not an excuse; say so.

*(W7 — improvement week. W8 — VİZE, no work.)*

## SUNUM 4 — W9 · M4 · speaker: ML (Gözde)

- **Demo:** the model comparison table as **mean ± std over 5 folds** (U-Net
  ailesi × {U-Net, UNet3+, UNet++, nnU-Net v2 ResEnc L, SA-UNet, TransUNet-negatif}
  × loss ablations); the chosen architecture and *why*; the **post-processing
  module (WP4.1)** turning a raw mask into separated instances, including the
  cases it *cannot* separate; **2×2 {clDice × TopoLoss} ablation** (topoloji
  metrikleri: clDice + Betti-1).
- **Claim:** *"We chose this architecture because cross-validation says so, not
  because it is fashionable — we can already turn its output into countable
  cells, and our topology ablation shows that standard Dice metrics lie about
  broken neurites."*
- **Artifact:** comparison table + ablation table + instance-separation overlays.
- **Fallback:** comparison table only; instance separation on 3 images.

> ⚠ **Morphometry was moved out of this week.** The updated course Gantt puts
> **WP4.2 (feature extraction, skeleton→graph) at W11–W12** and **WP4.3
> (metrics + error analysis, incl. Bland–Altman) at W12**. The old version of
> this section promised measurements agreeing with Berke's hand measurements
> two weeks before the task that produces them. Mirrored in `docs/data.js`
> `sunum` W9 — change one, change the other (D15).

## SUNUM 5 — W11 · M5 · speaker: ML (Gözde)

- **Demo:** results including the new data batch (**WP3.5** retrain on the
  expanded set); the **first feature-extraction output** (**WP4.2**, which is
  mid-package this week) — skeleton→graph neurite length/count/angle on a few
  images; **Integrated Gradients** overlays showing where the model looks;
  ensemble **uncertainty overlay + review queue**; the **deletion curve**
  proving the saliency means something.
- **Claim:** *"More data measurably moved the numbers, we can already extract
  neurite geometry from the masks, and the model tells you when it is not
  sure."*
- **Artifact:** expanded-data comparison + first geometry table + XAI figures +
  flag-vs-error AUROC number.
- **Fallback:** expanded-data comparison + XAI overlays; feature extraction on
  3 images.

> ⚠ **Systematic error analysis was moved out of this week.** The chart puts
> **WP4.3 (metrics + error analysis) at W12** and **WP4.4 (improvement loop) at
> W13**, so the failure taxonomy belongs to the W13 slot. Mirrored in
> `docs/data.js` `sunum` W11 — change one, change the other (D15).

## SUNUM 6 — W13 · M6 · speaker: ML (Gözde), EK on integration

- **Demo:** closed improvement loop (error analysis → model revision → new
  numbers); a report generated from a real run; validated XAI layer; NTI
  computed for a dose series; the UI shell showing real pipeline output.
- **Claim:** *"Every piece of the system works and produces a real report; what
  remains is wiring them into one executable, which the schedule puts in
  W14–15."*
- **Artifact:** report module output + XAI validation + NTI values + UI shell on
  real outputs.
- **Fallback:** CLI driving the real pipeline end to end, with the UI shell on
  mock data — stated clearly as two halves.

> ⚠ **Why this is weaker than it used to be.** The updated course Gantt puts
> **WP6.3 (Pipeline ↔ UI integration + ONNX packaging) at W14–W15**, i.e. AFTER
> the last presentation. The old claim here ("a researcher can analyse an image
> and get a report, offline") promised an integrated app a week before the
> schedule builds one. Mirrored in `docs/data.js` `sunum` W13 — if you change
> one, change the other (D15).

*(W14 — WP6.3 integration + ONNX packaging; end-to-end testing and polish.)*

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
