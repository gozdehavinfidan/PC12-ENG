### TURN-P1 (CLAUDE)
SCHEMA: collab-board/turn/v1
- Header: PART=PLAN · RESPONDS_TO=NEW · POINTS=P1,P2,P3
- Body:
  - FINDINGS:
    - Unusual shape for this board: the change set is ALREADY WRITTEN and
      uncommitted in the working tree. The user asked for a review after the
      fact, so PLAN is short by design - it fixes the review scope and settles
      three judgement calls I made unilaterally while implementing. IMPL is then
      CODEX reviewing the shipped diff, me fixing what survives scrutiny.
    - Base commit 63313f8 on `main`, nothing committed since. `git diff --stat`:
      docs/app.js +166/-, docs/data.js 143 changed, docs/styles.css 58,
      docs/index.html 12, docs/data.txt 14, plus 14 llm-wiki files and
      .gitignore/README that a BACKGROUND process (not this change set) wrote.
    - Five things landed in docs/:
      1. ENG400 -> ENG401 across docs/, README, KLAVUZ.html, two wiki files.
      2. `computeWeek()` in app.js derives the current week from a single new
         calendar anchor `meta.w1Thursday`; the class is on Thursday, so week
         N+1 starts the following Friday 00:00 LOCAL. `meta.currentWeek` is
         demoted to a fallback for a missing/invalid anchor.
      3. Timeline avatar intro: first render emits `left:24px` + `data-x`,
         a double-rAF writes the target, CSS transitions it over 1.15s with a
         90ms per-row stagger; `prefers-reduced-motion` skips it.
      4. Sidebar: nav 15->17.5px, icons 16->21px, rail 252->280px; plus a new
         NOTIFICATIONS box backed by two new event actions, `msg` (TARGET =
         recipient code, VALUE = text, the event id doubles as the message id)
         and `read` (TARGET = the message id). Dismissal APPENDS, never deletes.
      5. WBS rebuilt from the updated course Gantt (PC12_Gantt_Chartt.xlsx,
         sheet "Gantt Chart"): 7 packages, 28 tasks, task ids now mirror the
         chart rows (WP3.2 here IS WP3.2 there). IP colours moved out of
         app.js into data.js `ips[].color`. New `orphanLines` counter surfaces
         events whose target task no longer exists.
  - CHALLENGE: N/A (opening turn)
  - PROPOSAL:
    - P1 - REVIEW SCOPE. In: `docs/` only (app.js, data.js, data.txt,
      index.html, styles.css) plus this board. Out: the 14 llm-wiki files,
      .gitignore and README changes in the tree - they came from a separate
      background process, are not mine, and folding them in would make the
      review unbounded. Also out: `llm-wiki/16-ARCHITECTURE-RESEARCH.md` and
      `llm-wiki/_research/` (untracked drafts). Review priority, highest risk
      first: (a) msg/read semantics in the append-only log, (b) computeWeek
      arithmetic and its boundary behaviour, (c) WBS fidelity to the xlsx plus
      the downstream claims that depend on the calendar, (d) render-only.
    - P2 - THE WP5.2 ANOMALY. The source chart starts WP5.2 (full XAI layer) at
      W5, one week BEFORE WP5.1 selects the method it is built on. I copied the
      weeks verbatim and left a `note` on the task saying so. The alternative
      was to silently shift WP5.2 to W7. I claim verbatim+flag is correct: the
      user's instruction was "use the chart's calendar", and a silent shift
      would make the dashboard disagree with the artefact the instructor sees
      while hiding the reason. Asking CODEX to attack this.
    - P3 - RENUMBERING AND ORPHANED EVENTS. Task ids changed from T1.x/T2.x/...
      to the chart's own WP1.1/WP3.2/... . `docs/data.txt` already holds three
      committed-in-spirit `note` events; T0.2 still resolves, but one note
      targeting the old `T3.5` now resolves to nothing. Previously such an
      event was dropped silently by `if (!t) return`. I added an `orphanLines`
      counter surfaced in the sync box rather than rewriting history (the log
      is append-only) or keeping the old ids. Asking CODEX whether surfacing is
      sufficient or whether the renumbering itself is the wrong trade.
- Evidence:
  - Base: `git rev-parse HEAD` = 63313f89160777557124dc182e065cdb5b2a245e,
    branch `main`, nothing committed since; `git diff --stat` as quoted above.
  - Source of the WBS: `PC12_Gantt_Chartt.xlsx`, sheet "Gantt Chart", header row
    2 maps column C..P to Week2..Week15. Extracted spans: WP1.1 W3-4 TEAM,
    WP1.2 W3-4 EEE, WP2.1 W9-10 TEAM, WP2.2 W10-11 TEAM, WP3.1 W5, WP3.2 W6,
    WP3.3 W7, WP3.4 W9, WP3.5 W10-11, WP4.1 W9-10, WP4.2 W11-12, WP4.3 W12,
    WP4.4 W13, WP5.1 W6, WP5.2 W5-13, WP6.1 W9-11, WP6.2 W12-13, WP6.3 W14-15,
    WP6.4 W15, WP6.5 W15 - all EEE unless noted.
  - computeWeek verified against the anchor 2026-09-24: 2026-09-24 -> W1,
    2026-09-25 -> W2, 2026-10-01 -> W2, 2026-10-02 -> W3, 2026-11-12 -> W8
    (which is the vize week in data.js `weeks`), 2027-01-01 -> W15 (clamped).
  - msg/read verified end to end over HTTP with localStorage cleared: ML sends
    -> not shown to ML, shown to BM with badge "1" -> survives reload -> `read`
    hides it -> survives reload. A `|` inside the text round-tripped via the
    %7C escape.
  - Avatar intro sampled per animation frame from an init script: row 1 moved
    559px -> 612px over ~1.1s with decelerating steps; rows at 0% did not move,
    which is correct (clamp floors them at the bar start).
  - `node --check` passes on docs/app.js and docs/data.js; CSS braces balance
    298/298; documentElement scrollWidth - clientWidth = 0.
  - Structural assertions over the rebuilt data.js: 7 packages, 28 tasks, task
    ids unique, every `ip` resolves to a package, every `ms` resolves to a
    milestone, all week pairs within [1,15] and non-inverted.
- Handoff: CLAUDE WORKING->ON_HOLD, CODEX ON_HOLD->START
PREV: NEW
NEXT: [P2](P2-codex.md)
