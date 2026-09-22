### TURN-P5 (CLAUDE)
SCHEMA: collab-board/turn/v1
- Header: PART=PLAN · RESPONDS_TO=P4 · POINTS=P7,P8
- Body:
  - FINDINGS:
    - CODEX accepted the six-state resolution in P4 on a real check (it constructed the
      strongest counterexample - offline auto-resume vs manual retry - and showed it is
      an error *reason* plus a connectivity signal, not a separate top-level state).
      Both PLAN gates are YES and all of P1-P6 are AGREED.
    - The user sent two scope messages after CODEX set its gate. Recording them as new
      points rather than smuggling them into IMPL:
      - P7 (UI amendment): remove the "Acik risk" KPI tile and put a task-status tile
        there; drop the "tarih belirsiz" row from the project timeline; bigger week
        labels with presentation weeks in black; the week chips are squat and not
        centred; the timeline overall is too small (row height, bar height, fonts);
        the coloured owner bars carrying the avatars need more height; card titles
        centred and fonts up.
      - P8: task status marks (not started / active / done) and the progress bars must
        be RELOADED FROM WHAT WAS SAVED on every page refresh.
    - P8 is not new architecture - it is precisely what the P1/P4 design already
      delivers - but it names the acceptance check the user actually cares about, so it
      is worth pinning explicitly rather than leaving implied.
  - CHALLENGE:
    - Against myself, on process: P7 arrived AFTER CODEX set PLAN_AGREE_SECONDARY, so
      strictly the secondary gated a smaller scope. I am not re-delegating a PLAN turn
      for it, because P7 is render-only work of exactly the character CODEX already
      assessed in P2 ("the three render-only changes are orthogonal to persistence").
      This is a judgement, not a loophole: P7 touches no data, no write path, and no
      state machine, and CODEX reviews it in IMPL against `plan/context.md` section 6.
      If any P7 item turns out to require a data or sync change, it stops being P7 and
      comes back as a new point.
  - PROPOSAL:
    - Resolve P7 AGREED (user directive, render-only, enumerated in context.md §6).
    - Resolve P8 AGREED and promote it to the primary acceptance check (context.md §7
      and §10.3): with localStorage cleared and served over HTTP, the rendered state
      must be reproducible from `data.js` + `data.txt` alone.
    - Freeze the plan into `plan/context.md` (done) and cross PLAN->IMPL via `advance`.
    - IMPL sequencing intent, so the review has something to check against: (1) event
      parse/apply + baseline overlay, (2) outbox + local persistence, (3) the four
      interactions, (4) the GitHub write path + six sync states, (5) P6+P7 UI. Each
      step must leave the page renderable - no step may land the board in a state where
      `docs/index.html` fails to open.
- Evidence:
  - `HEAD.md` after P4: `PLAN_AGREE_PRIMARY: YES`, `PLAN_AGREE_SECONDARY: YES`,
    `PLAN_OPEN_POINTS: 0` - the §4 preconditions for `advance` other than a non-EMPTY
    `plan/context.md`, which this turn writes.
  - `turns/P4-codex.md` Evidence section records the action-mapping check behind the
    six-state acceptance, so the gate was attested, not rubber-stamped (§4).
  - `plan/context.md` §9 enumerates every file IMPL will touch, including the three
    cross-cutting consistency files, so a consistency edit is not read as scope creep.
- Handoff: CLAUDE WORKING->ON_HOLD (retains START across the shard-less `advance` crossing)
PREV: [P4](P4-codex.md)
NEXT: [I1](I1-claude.md)
