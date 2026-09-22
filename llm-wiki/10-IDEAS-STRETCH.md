# 10 — Ideas & Stretch (improvements, ranked)

> Where we push **beyond** the basic TÜSEB version `[BASE]`. Ranked by
> **Impact / Effort / Risk**. Anything here that we *do* promote goes into
> `03-SEMESTER-PLAN`; the rest stays as inspiration. The "inspiring" ones are
> the story that makes the presentation memorable.

Legend: **I**mpact, **E**ffort, **R**isk (each Low/Med/High).

---

## Tier S — re-ranked for n ≈ 70 (W1 update, `15-SMALL-DATA-STRATEGY`)

These jumped the queue once we learned the dataset is ~70 labeled images. Each
has a **verified** source in `14-REFERENCES-VERIFIED.md`.

| # | Idea | I / E / R | Why it matters *here* |
|---|------|-----------|----------------------|
| **S1** | **Pretrained encoder + U-Net** | H / L / L | The single highest-value change. Directly answers the binding constraint; costs one line of library config. |
| **S2** | **Cellpose-SAM zero-shot + fine-tune** (R-V2) | H / L / L | Few-shot by design. Also produces **instance** masks — fixing a real flaw inherited from the base, where cell *count* derived from a semantic mask silently merges touching cells into one blob. |
| **S3** | **Topology-aware loss (soft-clDice, auxiliary)** (R-V1) | H / M / M | Dice is an *area* measure: a neurite broken into three fragments can score well while being topologically wrong — and then neurite **count** and **length** are both wrong. clDice scores the skeleton. ⚠ Overlaps group **A2**'s headline (D8) — choose consciously. |
| **S4** | **5-fold CV + mean ± std reporting** | H / L / L | Methodological, nearly free, and the most defensible single thing we can say at this sample size. At n≈70 a single split's noise exceeds the differences we are trying to measure. |
| **S5** | **Inter-annotator agreement as a data gate** | H / L / L | Two humans double-label a subset. The agreement score is the realistic **ceiling** on achievable DSC — it turns "we got 0.85" into "we got 0.85 against a human ceiling of 0.88", which is a far stronger claim. |
| **S6** | **`skan` skeleton → graph** (R-V8) | H / L / L | Replaces the base's Canny+Hough with a real branch-graph: per-neurite length, junctions, branch counts. Handles crossings, which Hough does not. |
| **S7** | **Bland–Altman agreement vs hand measurement** | M / L / L | Validates the *morphometry*, which is the base's actual methodological gap — it asserts "≥95 % accuracy" for a length, a quantity for which "accuracy" is undefined. |
| **S8** | **Patch-based training + leakage assertion** | H / L / M | ~70 images → ~10³ real patches. The `assert` that no image spans two folds is what keeps the resulting numbers honest (`06-DATA` §5). |
| **S9** | **ONNX packaging** | M / M / L | The concrete bridge from a Python-trained model to the base's C#/WinForms offline app — the step the base leaves unspecified. |

> **Presentation value.** S3 + S5 are the two that make a memorable talk: one
> says "we understood that the standard metric is wrong for our geometry", the
> other says "we measured our own ceiling before claiming to approach it".
> Both are cheap. Both are the kind of thing a jury remembers.

---

## Tier A — High impact, Low-Med effort (do these)
| # | Idea | I | E | R | Why it's worth it |
|---|------|---|---|---|-------------------|
| A1 | **Uncertainty overlay** (MC-dropout / TTA disagreement) | High | Med | Low | Builds *trust*; flags what a human should check. Strong differentiator. |
| A2 | **Per-feature error metrics + CI** (not just DSC) | High | Low | Low | Makes "15% improvement" concrete and defensible. |
| A3 | **Error gallery + XAI cross-check** | High | Med | Low | The credibility story; shows we understand *why*, not just *that*. |
| A4 | **Content-based, leak-free splits + data card** | High | Low | Low | Scientific hygiene; prevents the #1 student-project bug (leakage). |
| A5 | **Reproducible runs** (config + seed + env pin) | High | Low | Low | Required for any real claim; cheap to add now. |

## Tier B — Strong story, Med effort (promote if on schedule)
| # | Idea | I | E | R | Why |
|---|------|---|---|---|-----|
| B1 | **Generalization story: İP7 new dataset** (old vs new, transfer) — **CONFIRMED, ETA ~W3** `[CONFIRMED]` | High | Med | Med | Now a **commitment**, not a contingency: batch 2 = held-out test set + distribution-shift test. |
| B2 | **Neurite graph + Sholl profile** (branching, branch order, Sholl curve) | High | Med | Med | Richer morphometrics than count/length/angle; very publishable-looking. |
| B3 | **nnU-Net auto-config + 5-fold CV** | Med | Med | Med | Free rigor + strong baseline; but data-format work. |
| B4 | **Offline ONNX app** (truly no-internet, IntelliCell module style) | High | Med | Low | Honors the base's explicit offline goal; impressive in demo. |
| B5 | **Robustness probe** (unseen magnification / modality) | Med | Med | Low | Honest OOD evaluation; shows maturity. |

## Tier C — Inspiring / stretch (only if we're ahead) `[IDEA]`
| # | Idea | I | E | R | Note |
|---|------|---|---|---|------|
| C1 | **Time-lapse / multi-timepoint** analysis (track a cell's neurites across NGF timepoints) | Very High | High | High | The "wow" — turning static morphology into a **growth trajectory**. Needs longitudinal data. |
| C2 | **Per-cell instance tracking** across a plate / over time | High | High | Med | Instance identity, not just per-image. |
| C3 | **Foundation-model baseline** (SAM / Cell-SAM) — **promoted to first-class** by `15` §8 `[PLANNED]` | High (was Med) | Med | Med | No longer "risky as main model" — at n≈70 it's a primary candidate, run early at the **W6 gate**. |
| C4 | **Foundation-seg + active-learning loop** (label only the uncertain ones) | High | High | Med | Elegant: uncertainty → label the hard cases → improve. Story-gold. |
| C5 | **Angle as circular data** (Rayleigh test for directional alignment) | Med | Low | Low | Statistically proper way to claim "NGF makes neurites align". |
| C6 | **NeuroQuantify head-to-head** benchmark | High | Med | Med | Direct prior-art comparison = strong paper section. |
| C7 | **Auto-report with figures** (bar/histogram/Sholl + narrative) | Med | Med | Low | The app writes a mini-paper. Great demo. |
| C8 | **Web version** of the app (shareable link) | Low | Med | Low | Convenience; not core. |

## The "inspiration" shortlist — 2026-09-22 araştırmasıyla yenilendi

6 scout'un birincil-kaynak taramasından **18 doğrulanmış cesur fikir** çıktı
(tam tablo + kararlar: **`16-ARCHITECTURE-RESEARCH.md` §5**). Sunumun
başına koyacağımız üç:

1. **Trust via uncertainty — somut hali:** *her morphometrik özelliğin hata
   çubuğu* (ensemble piksel-U → skeleton → CI; 16 §5-1). PC12/nörit
   kuantifikasyonunda kimse yapmıyor; NeuroQuantify yalnız nokta tahmin
   raporluyor. En savunulabilir tezs farklılaştırıcısı.
2. **A tool that generalizes — ölçülmüş hali:** *etiketleme copilot (kör
   kontrolle) + active-labeling loop* (16 §5-3 + §5-11): ölçülen etiketleme
   hızlanması, ve batch 2'ye en belirsiz ~20 görselin seçilmesiyle UQ'den
   DSC'ye kapanan döngü.
3. **Growth trajectories** (C1) — somut yolu bulundu: **SAM2/Trackastra**
   (doğrulanmış, 16 §5-18); **koşul: longitudinal veri var mı — bu hafta teyit** `[OPEN]`.

Bunları destekleyen ana hat: **topoloji-kondisyonlu iki-kollu segmentasyon +
2×2 {clDice × TopoLoss} ablation** (16 §5-2 — kimse kültür hücresi nöritinde
yapmamış) ve **GNN spike** (16 §5-4 — işe yararsa "vaay", yaramazsa
yayınlana bilir ablation).

## How an idea becomes a task
1. It lives here with a tag.
2. We validate it via `11-SEARCH-WORKFLOW` (does it actually help? is it real?).
3. We write an **ADR** in `DECISIONS.md` (decision + tradeoffs).
4. We promote it into `03-SEMESTER-PLAN` as a task with a done-criterion.
