### TURN-I1 (CLAUDE)
SCHEMA: collab-board/turn/v1
- Header: PART=IMPL · RESPONDS_TO=P5 · POINTS=N/A
- Body:
  - FINDINGS:
    - Implemented the whole frozen plan in one pass. Files touched, exactly the
      set enumerated in `plan/context.md` §9: `docs/app.js` (rewritten),
      `docs/styles.css`, `docs/index.html`, `docs/data.txt`, `docs/data.js`
      (meta only: `branch`, `dataPath`), plus the three consistency files
      `llm-wiki/DECISIONS.md` (new ADR D11), `llm-wiki/09-DASHBOARD.md`,
      `README.md`. No other project file was modified.
    - Event log implemented as agreed: `ISO_TS|ACTOR|ACTION|TARGET|VALUE|ID`.
      `parseLog` accepts a 5-field legacy line and derives `id = hash8(line)`, so
      the header-only `data.txt` already committed stays parseable. `buildState`
      keeps a `seen[id]` set, so a duplicated line applies exactly once.
    - Write path implemented as agreed: GET -> filter outbox to ids the remote
      lacks -> conditional PUT on `sha` -> re-GET to verify -> only then clear
      the outbox, and only of the ids actually present. Conflict (409/422) goes
      to `300*2^n + rand(400)ms` backoff, max 5 attempts, then stays PENDING
      with a visible retry. Token lives in a closure variable only; grep shows
      no `localStorage` write of it.
    - Six sync states wired to a visible sidebar box. `file://` lands in
      LOCAL_ONLY via the `fetch` catch; malformed/unknown event lines increment
      `badLines` and are surfaced ("N bozuk satir atlandi"), never dropped silently.
    - P7/P6 UI done: 4th KPI tile is now task-status (the risk tile is gone),
      task-status card has the gradient, W8 is heavy-hatched in both timeline and
      Gantt with a struck-through black-on-grey header chip, presentation weeks
      are black chips, week bands are continuous behind all rows, the unscheduled
      "tarih belirsiz" row no longer renders, and the timeline now spans the FULL
      width (at 1.35fr it still scrolled on a laptop, which was the actual
      complaint) with taller rows/bars and larger labels. Card titles centred.
    - One thing I got wrong mid-implementation and fixed: I wrote `app.js` in
      ASCII out of habit from the board's L21 rule. That rule exists because the
      codex-cli adapter mangles non-ASCII in files IT writes - but Rule 7 means
      CODEX never writes project files, so it does not apply to `docs/`. The
      Turkish UI had silently degraded to "Genel bakis". Restored.
  - CHALLENGE: N/A (implementation turn)
  - PROPOSAL:
    - Review focus, in the order I think risk actually lies:
      1. `pushOutbox()` - is the clear-only-verified-ids logic correct under a
         lost PUT response? I believe the re-GET makes it safe, but this is the
         one place a bug loses a user's work.
      2. `buildState()` idempotency + ordering: events are sorted by `ts` string.
         Two events in the same second from two people order by string compare,
         which is arbitrary but deterministic. Acceptable, or does it need the id
         as a tiebreak?
      3. `esc()` coverage: I believe every data.txt-derived string is escaped.
         Please try to find one that is not - that is the security control.
      4. Anything in the six-state machine that can strand the user in a state
         with no way forward.
- Evidence:
  - `node --check` passes on `docs/app.js` and `docs/data.js`; CSS braces balance
    (246/246).
  - **P8 acceptance test, the primary one, PASSED.** Appended 6 events to
    `data.txt` (including a deliberate duplicate id), cleared `localStorage`
    (verified `localStorage.length === 0`), reloaded over HTTP: T1.1 rendered in
    "Tamamlandi" with a note badge, T1.5 showed 2 avatars (join applied,
    owner -> EK), T2.1 showed %40, the `task` event created a new card, and the
    Tamamlandi column went 2 -> 3, i.e. the duplicated id applied exactly once.
    State was therefore reconstructed from `data.js` + `data.txt` alone.
  - Interaction round-trip PASSED: clicking a card opened the drawer; marking
    Tamamlandi + adding a note produced exactly 2 outbox events, both with
    8-hex ids; after a full reload both were still applied and still pending
    ("2 bekleyen"), proving the outbox is not lost before a save.
  - Zero console errors on load. No page-level horizontal scroll at 400px on any
    of the five views; the timeline scrolls inside its own box.
  - Test events were removed from `data.txt` afterwards; the file is back to
    header-only.
- Impl: BRANCH=NONE BASE_COMMIT=NONE LATEST_COMMIT=NONE
- Handoff: CLAUDE WORKING->ON_HOLD, CODEX ON_HOLD->START
PREV: [P5](P5-claude.md)
NEXT: [I2](I2-codex.md)
