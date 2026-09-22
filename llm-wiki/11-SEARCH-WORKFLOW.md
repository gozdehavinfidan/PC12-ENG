# 11 — Search & Thinking Workflow

> This is **how we keep the wiki honest and up to date**. Every time a fact,
> a model choice, or a scope decision is in question, we run this workflow
> instead of guessing. It is the "search for new ideas + think about them"
> loop the project runs on.

## The 5-step loop (S·T·D·L)

```
        ┌────────────────────────────────────────────┐
        ▼                                            │
  1) SCOPE  →  2) SEARCH  →  3) TEST  →  4) DECIDE  →  5) LOG  ─┘
        what?      find real     does it fit    pick +        record
                   evidence?    our constraints ADR           + update
                                                                          wiki
```

### 1) SCOPE — name the question in one sentence
Before searching, write the question **specifically**.
- Good: "Can skeletonization+graph recover per-neurite angle reliably on
  phase-contrast PC12 images?"
- Bad: "neurites".
- If you can't write one sentence, the question is too big → split it.
- Attach the question to a **tag context**: which `[OPEN]`/`[VERIFY]`/
  `[IDEA]` does it resolve?

### 2) SEARCH — find real evidence (no fabrication)
Priority order (strong → weak):
1. **Primary source**: the paper / the official code repo / the dataset
   landing page.
2. **Reproducible code** (GitHub) — read it, don't just read the README.
3. **Benchmarks / reviews** (e.g., cs-benchmark, U-Net reviews).
4. **Secondary** (blog, StackOverflow, forum) — lead, not conclusion.
5. **Our own experiment** — the strongest evidence of all (see step 3).

Rules:
- **Record every source** in `12-REFERENCES.md` with *what it supports*.
- **Prefer running over reading** for anything load-bearing: a 30-min
  "can I import this and run it on one image?" beats a 3-hour paper read.
- **Distinguish fact from claim**: a paper's reported number is a *claim
  under its conditions*; it may not hold on *our* data.
- **If no source found → mark `[OPEN]`**, do NOT invent a number/fact.

### 3) TEST — does it fit OUR constraints?
An idea is only good if it survives contact with reality. Check against:
- **Data**: do we actually have the data it needs? (size, labels, modality)
- **Compute**: can we train/infer it on our hardware/timeline?
- **Time**: does it fit a milestone gate, or is it `[IDEA]`-only?
- **Team**: can 2 of us maintain/debug it?
- **Metrics**: will it *move the numbers we care about* (`07`), or just look
  cool?
- **Honesty**: can we defend it if the instructor asks "why this?"

Do a **cheap spike** when in doubt: smallest possible run that answers the
question (e.g., "run Grad-CAM on the pilot model, 1 image, 10 min").

### 4) DECIDE — choose and write an ADR
- If the decision is load-bearing (model, class scheme, metric definition,
  app framework, dataset scope) → write an entry in **`DECISIONS.md`**
  (context → options → decision → tradeoffs → confidence + tag).
- If it's small, a note in the relevant file + a `LOG.md` line is enough.
- **Always state the tag** the decision resolves (`[OPEN]`→resolved, or
  `[IDEA]`→promoted, or `[VERIFY]`→confirmed).

### 5) LOG — record and update the wiki
- Append a 1–3 line entry to **`LOG.md`** (date/week, what changed, why).
- Update the **affected files** so the wiki is never stale:
  - fact corrected → edit the file + its tag
  - scope changed → `03-SEMESTER-PLAN` + milestone gates
  - new idea validated → `10-IDEAS-STRETCH` (+ promote if chosen)
  - new source → `12-REFERENCES.md`

## When to run it
| Trigger | Run depth |
|---------|-----------|
| A new `[OPEN]`/`[VERIFY]` appears | Full loop |
| Choosing between 2+ options (model, tool, metric) | Full loop + ADR |
| A paper/tool claims something we want to reuse | Steps 2→3 (verify, then cite) |
| An idea from `10-IDEAS-STRETCH` tempts us | Steps 3→4 (fit test, then ADR) |
| Weekly (before each SUNUM) | Light pass: any new sources? any tags to update? |

## Guardrails (the "don't make it up" rules)
1. **No number without a source or a run.** If we report a metric, it came
   from our code or a cited paper — never from memory.
2. **Fact vs plan vs idea** are always separated by tags. Never blur them.
3. **Two-source rule for claims we put in the presentation**: any strong
   claim ("this is SOTA", "this is the only tool that does X") needs ≥1
   primary source, or we soften it ("we found no open tool that… as of W2").
4. **Cheap-spike-first**: when uncertain, a tiny runnable test beats debate.
5. **The wiki is the source of truth**: if it's not in the wiki, it didn't
   happen (for the project's record).

## A worked example (how a decision flows)
1. **Scope**: "Which neurite-geometry method — skeleton+graph or Canny+Hough?"
2. **Search**: read AutoNeuriteJ (skeleton+graph), the base (Canny+Hough),
   Sholl-analysis papers → record in `12-REFERENCES`.
3. **Test**: 1-day spike — skeletonize 3 pilot masks, compute branch lengths;
   compare to hand-measured (Berke). Does it match?
4. **Decide**: ADR D2 — pick skeleton+graph (handles junctions better), keep
   Canny+Hough as a fallback for sparse cases.
5. **Log**: `LOG.md` "W5: D2 decided skeleton+graph; spike matched hand
   measure within 8% on 3 images."
