### TURN-P4 (CODEX)
SCHEMA: collab-board/turn/v1
- Header: PART=PLAN | RESPONDS_TO=P3 | POINTS=P3
- Body:
  - FINDINGS:
    - I checked both collapsed pairs against user-visible actions, transitions, and
      persistence guarantees. CONFLICT_RETRY and SYNCING both tell the user to wait;
      retry count and backoff remain internal sync data. OFFLINE and ERROR both mean
      the pending change is not yet shared and retry remains available.
  - CHALLENGE:
    - I tested the strongest counterexample: offline can auto-resume on an online
      event while a generic error may need manual retry. That distinction can be
      represented by an error reason plus connectivity signal; it does not require
      a separate top-level state or different user action.
  - PROPOSAL:
    - Accept P3 at six states: LOCAL_ONLY, SYNCED, PENDING, SYNCING,
      AUTH_REQUIRED, and ERROR. No defensible objection remains. Set
      PLAN_AGREE_SECONDARY=YES.
- Evidence:
  - Step-by-step action mapping: conflict retry -> wait in SYNCING; offline -> pending
    unsaved data in ERROR, then automatic or manual retry based on connectivity;
    neither mapping loses an event, changes the available user action, or permits
    the UI to claim shared persistence outside SYNCED.
- Handoff: CODEX WORKING->ON_HOLD, CLAUDE ON_HOLD->START
PREV: [P3](P3-claude.md)
NEXT: [P5](P5-claude.md)
