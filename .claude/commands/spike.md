---
description: Run the SCOPE→SEARCH→TEST→DECIDE→LOG loop on one question, honestly
argument-hint: <the question, in one sentence>
allowed-tools: Read, Glob, Grep, WebSearch, WebFetch, Edit, Write, Bash
---

# /spike — one question, resolved with evidence

Question: **$ARGUMENTS**

Run the loop defined in `llm-wiki/11-SEARCH-WORKFLOW.md`. Do not skip steps and
do not answer from memory.

## Project constraints you must apply (these are not negotiable)

Read `llm-wiki/15-SMALL-DATA-STRATEGY.md` first if you have not this session.

- **≈ 70 labeled images.** More arriving ~W3, amount unknown.
- **2 people, 15 weeks**, presenting at W2/4/6/9/11/13, midterm W8, final W15.
- GPU availability is **`[OPEN]`** (assumption A6) — do not assume one exists.
- The deliverable must run **offline** on a desktop.

## 1 · SCOPE

Restate the question in **one specific sentence**. If you cannot, it is too big
— split it and say which sub-question you are answering.

State which tag it resolves: an `[OPEN]`, a `[VERIFY]`, or an `[IDEA]` being
promoted. Name the file it lives in.

## 2 · SEARCH — real evidence only

Priority: primary source (paper / official repo / dataset page) → runnable code
→ benchmark or review → secondary (blog, forum: a lead, never a conclusion).

Rules:
- **A paper's number is a claim under the paper's conditions**, not a fact about
  our data. Write it that way.
- Record every source used in `llm-wiki/14-REFERENCES-VERIFIED.md` with a
  verification tag and **what it supports in our project**.
- **Never touch `llm-wiki/12-REFERENCES.md`** — it is quarantined as unverified.
- **If you cannot find a source, say `[OPEN]`.** Do not invent a number, an
  author, a year, a DOI or a repo path. A confident-looking fabricated citation
  is the single worst failure mode available here.

## 3 · TEST — does it survive *our* constraints?

Answer each explicitly; "probably" is not an answer:

| Check | Question |
|---|---|
| **Data** | Does this work at **n ≈ 70**? Would it need more labeled data than we have? |
| **Leakage** | Does it change how we split? Does it risk patches from one image spanning folds? |
| **Compute** | Trainable without a guaranteed GPU (A6)? |
| **Time** | Does it fit before a SUNUM gate, or is it `[IDEA]`-only? |
| **Team** | Can 2 students debug it at 1 a.m. in week 11? |
| **Metrics** | Does it move DSC / clDice / feature error — or does it just look impressive? |
| **Honesty** | Can we defend "why this?" to the instructor in one sentence? |

Prefer a **cheap spike** to a long read: "can I import this and run it on one
image in 30 minutes?" beats three hours of paper.

## 4 · DECIDE

- Load-bearing (model, class scheme, metric definition, split strategy, app
  framework, dataset scope) → draft an ADR for `llm-wiki/DECISIONS.md`:
  context → options → decision → tradeoffs → confidence + tag.
  Use the next free `Dn`. Never edit a past ADR — supersede it.
- Small → a note in the relevant wiki file is enough.
- Say which tag changed state, and edit that file so the wiki is not stale.

## 5 · LOG

Append **one line to the END** of the `log[]` array in `docs/data.js`
(the end, not the top — that is what keeps git merges clean):

```js
{ w: <hafta>, text: "<ne değişti ve neden — tek cümle>" },
```

If the answer changes a task's status or scope, update that task's line in
`docs/data.js` too.

## Output

Report, in order: the scoped question · what you found with sources · the fit
verdict against the table above · the decision (or "still `[OPEN]`, here is what
would resolve it") · the files you changed.

**Say "I don't know" when that is the truth.** An honest `[OPEN]` is worth more
than a confident guess, because everything downstream is built on it.
