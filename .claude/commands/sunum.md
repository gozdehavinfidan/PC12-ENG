---
description: Weekly pre-presentation pass — what we show, what we claim, what could embarrass us
argument-hint: "[week number, optional — defaults to meta.currentWeek]"
allowed-tools: Read, Glob, Grep, Bash, Edit
---

# /sunum — pre-presentation check

Target week: **$ARGUMENTS** (if empty, use `meta.currentWeek` from `docs/data.js`).

We present at **every** SUNUM week (W2, W4, W6, W9, W11, W13). This command
exists so the presentation is never assembled the night before, and so we never
claim something the wiki still marks unverified.

## Read first
- `docs/data.js` — live state
- `llm-wiki/13-SUNUM-PLAN.md` — the demo, the claim, the fallback for this week
- `llm-wiki/LOG.md` + `docs/data.js → log[]` — what actually happened

## 1 · The trio

Print, for the target SUNUM week:

- **EKRANDA** — what is literally on screen.
- **İDDİA** — the one sentence we defend.
- **YEDEK PLAN** — what we show instead if it slips.

Then the honest verdict: **is the demo real today?** Base it on task status in
`docs/data.js`, not on optimism. If the artifact behind the demo is not `done`
or `review`, say so plainly and recommend switching to the fallback **now**,
while switching is calm rather than panicked.

## 2 · Staleness

- Is `meta.updated` within the last 7 days? If not, that is the first fix.
- Does `meta.currentWeek` match reality?
- List tasks whose `w` window has **passed** but whose status is still `todo` or
  `doing` — these are the schedule's actual problems, and they are what an
  instructor asks about.
- List tasks whose window is **current** but which are still `todo`.

## 3 · Claim safety — the part that protects credibility

For the week's **claim**, find every `[OPEN]` and `[VERIFY]` tag in the wiki
that the claim depends on:

```
grep -rn "\[OPEN\]\|\[VERIFY\]" llm-wiki/
```

Report any that are load-bearing for this week's claim. **Do not let a claim
rest on an unverified tag** — either verify it (run `/spike`) or soften the
claim before the presentation, not during it.

Specifically check, every time:
- Any **number** we plan to show — does it come from our own run (`results[]` in
  `docs/data.js`) or a cited source in `14-REFERENCES-VERIFIED.md`? If neither,
  it does not go on the slide.
- Any citation — is it from `14-REFERENCES-VERIFIED.md` (safe) or
  `12-REFERENCES.md` (⚠ **unverified, do not cite**)?
- Any metric — is it reported as **mean ± std** over folds? A bare single number
  at n ≈ 70 is not a result (`07-METRICS`).

## 4 · Consistency

- Every `decisions[]` entry in `docs/data.js` has a matching ADR in
  `llm-wiki/DECISIONS.md`.
- Every task's `ms` refers to a real milestone.
- No task bar crosses **W8** (vize, no work).
- `13-SUNUM-PLAN.md` and `docs/data.js → sunum[]` still agree.

## 5 · Output

A short, blunt checklist:

```
SUNUM W<n> — <hazır | riskli | yedek plana geç>

EKRANDA : ...
İDDİA   : ...
YEDEK   : ...

✅ Hazır        : ...
⚠  Risk altında : ...
🚫 İddiayı zayıflat : <claim> — dayanağı <tag>, henüz doğrulanmadı
📌 Bugün yapılacak : <en fazla 3 madde>
```

Then offer to update `docs/data.js` (`currentWeek`, `updated`, task statuses,
a `log[]` line appended **at the end**) — but make the edits only if asked.

Be direct about bad news. A fallback chosen three days early reads as
competence; a failed live demo reads as a failed project even when the work
behind it is fine.
