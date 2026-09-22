# PLAN CONTEXT (frozen) — 2026-09-22-eng401-wbs-calendar-notify
SCHEMA: collab-board/context/v1
STATUS: FROZEN
Frozen at: TURN-P5 (CLAUDE)

## 1. What this session is

A post-hoc adversarial review. The change set was already written and sits
uncommitted on `main` at base commit 63313f8. IMPL = CODEX reviews the shipped
diff, CLAUDE fixes what survives scrutiny. No new features.

## 2. What is under review (5 changes in docs/)

1. **ENG400 -> ENG401** across docs/, README.md, KLAVUZ.html, two wiki files.
2. **Calendar-derived week.** `computeWeek()` in `docs/app.js` derives the
   current week from one new anchor `meta.w1Thursday` ("2026-09-24"). The class
   meets Thursday, so week N+1 begins the following Friday 00:00 **local**
   (local, not UTC: at 01:00 Istanbul on a Friday, UTC is still Thursday).
   Day count via `Math.round` so a clock shift cannot slip a day.
   `meta.currentWeek` is demoted to a fallback for a missing/invalid anchor.
3. **Timeline avatar intro.** First render emits `left:24px` + `data-x`; a
   double-rAF writes the target; CSS transitions 1.15s with a 90ms per-row
   stagger; `prefers-reduced-motion` skips it. The "done" flag is raised on
   completion, not on start, because startup renders twice (immediately, then
   when `loadRemote()` resolves) and the second render replaces innerHTML.
4. **Sidebar.** Nav 15->17.5px, icons 16->21px, rail 252->280px. Plus a
   NOTIFICATIONS box backed by two new event actions in the append-only log:
   `msg` (TARGET = recipient code ML|BM, VALUE = text, the event id doubles as
   the message id) and `read` (TARGET = the message id). Dismissal APPENDS a
   `read` event; it never deletes. Read-ids are applied AFTER the event loop so
   an out-of-order `read` still hides its message.
5. **WBS rebuild** from `PC12_Gantt_Chartt.xlsx` sheet "Gantt Chart": 7
   packages, 28 tasks, task ids mirroring the chart rows. IP colours moved from
   `app.js` into `data.js` `ips[].color`. New `orphanLines` counter.

## 3. Decisions frozen this phase

- **P1 (PRIMARY's proposal REJECTED, amended contract adopted).** Edit scope
  and verification read-set are different boundaries. See §4.
- **P2 (AGREED).** `WP5.2` keeps the chart's W5-W13 span verbatim even though
  the chart starts it one week BEFORE `WP5.1` selects the method it depends on.
  A silent shift to W7 would falsify the source calendar the user asked for.
  **IMPL must verify the anomaly warning is USER-VISIBLE**, not merely present
  in the data — a `note` no view renders is indistinguishable from silence.
- **P3 (PRIMARY's proposal REJECTED, amended).** An orphan COUNT diagnoses lost
  history without retaining its meaning. Add `meta.taskAliases` in
  `docs/data.js` as a flat `{ "T3.5": "WP4.5" }` map, resolved in
  `buildState()` before the task lookup. It lives in `data.js`, not `app.js`,
  because `app.js` must not become a second home for project facts — the same
  reason this change set moved the IP colour table out of it.
  **CODEX's sharpening, binding:** map membership is NOT proof of resolution.
  Map the id, then look the mapped id up; attach only on a hit; otherwise still
  increment `orphanLines`. A stale alias must be as visible as an unmapped one.
  `docs/data.txt` is NOT rewritten — guaranteed by the format, not a choice.
- **P4 (AGREED).** `PC12_Gantt_Chart.xlsx` (tracked, published) is
  intentionally superseded by `PC12_Gantt_Chartt.xlsx` (untracked, the user's
  new workbook, doubled "t"). Stage the deletion, add the new file, keep the
  user's filename verbatim — renaming a user-owned input silently would break
  their local reference; the spelling was already flagged to them.
- **P5 (AGREED).** `llm-wiki/13-SUNUM-PLAN.md` "SUNUM 6 — W13" contradicts the
  rebuilt `docs/data.js`. The chart puts `WP6.3` (Pipeline <-> UI integration +
  ONNX) at W14-W15, i.e. AFTER the last presentation, so `data.js` was weakened
  to "every piece works, integration is next" while the markdown still promises
  "the application ... export a report" with artifact "integrated app +
  ONNX-packaged model". The W13 section joins the edit scope to be reconciled.
  **Conditional clause, binding:** if IMPL verifies that the W6/W9/W11 sections
  also contradict the rebuilt WBS, those sections join P5 — they are NOT a new
  scope request.
- **DEFERRED, recorded so it is not lost as an oversight.** The structural fix
  for P5 — making `13-SUNUM-PLAN.md` point at `data.js` instead of restating
  the claim — is out of scope this session. Leaving the duplication means the
  pair can diverge again the next time the calendar moves.

## 4. Files the IMPL phase may touch

**EDIT (project):**
- `docs/app.js`
- `docs/data.js`
- `docs/data.txt`
- `docs/index.html`
- `docs/styles.css`
- `llm-wiki/13-SUNUM-PLAN.md` — the **W13 section only**, unless the P5
  conditional clause above is triggered by verified evidence.

**EDIT (board):** everything under
`.collab-board/sessions/2026-09-22-eng401-wbs-calendar-notify/`.

**READ-ONLY VERIFICATION REFERENCES:**
- `PC12_Gantt_Chartt.xlsx` (sheet "Gantt Chart") — the WBS source of truth
- `llm-wiki/03-SEMESTER-PLAN.md` — a deliberately frozen W1 baseline;
  divergence from the dashboard is its PURPOSE, not a defect
- `llm-wiki/13-SUNUM-PLAN.md` (whole file)
- `git show HEAD:docs/*` — the committed baseline

**OUT OF SCOPE ENTIRELY:** the other 13 modified `llm-wiki/*.md` files,
`.gitignore`, `README.md`, `llm-wiki/16-ARCHITECTURE-RESEARCH.md`,
`llm-wiki/_research/`. These came from a separate background process.

## 5. Review priority (highest risk first)

a. `msg`/`read` semantics in the append-only log — idempotency, ordering,
   escaping, and the `esc()` security boundary (data.txt strings reach innerHTML).
b. `computeWeek()` arithmetic and its boundaries — Thursday/Friday rollover,
   the local-vs-UTC choice, clamping, invalid-anchor fallback.
c. WBS fidelity to the workbook, plus every downstream claim that depends on
   the calendar (milestone gates, `sunum` entries, `13-SUNUM-PLAN.md`).
d. Render-only regressions — sidebar sizing, avatar intro, legend swatch.

## 6. Done condition

Every `I*` point non-OPEN; both `IMPL_AGREE_*` = YES; `node --check` passes on
`docs/app.js` and `docs/data.js`; the page renders with zero console errors and
no page-level horizontal scroll at 400px; `docs/data.txt` contains no test
lines (`grep -c '^2026'` equals the pre-session count of 3).

## 7. Commit-hygiene obligation (not a review finding)

The working tree carries 13 out-of-scope modified wiki files. They will land in
the same commit unless staged separately. Whoever commits must stage the
reviewed set explicitly rather than `git add -A`.
