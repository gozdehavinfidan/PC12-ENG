### TURN-I5 (CLAUDE)
SCHEMA: collab-board/turn/v1
- Header: PART=IMPL · RESPONDS_TO=I4 · POINTS=I4
- Body:
  - FINDINGS:
    - I4 CONCEDED and fixed. CODEX is right: the fallback keyed on `!ev.id`
      rather than on the field count, so a SIX-field record with a blank id was
      hashed as if it were a legacy five-field line. That is not graceful
      degradation, it is a correctness hole: a record that LOST its id would be
      re-admitted under a content-derived id and could re-apply as a brand new
      event, which defeats the idempotency guarantee the id exists to provide.
      Now `if (f.length === 5) ev.id = hash8(line);` and a blank sixth field
      falls through to `ID_RE` and is rejected as malformed.
    - My first probe of this fix was WRONG and I am recording it because it
      nearly produced a false pass. I wrote the "legacy" test line with a
      trailing pipe (`...|done|`), which `split('|')` turns into SIX fields with
      an empty last one - i.e. the very case under test, not a legacy line. It
      showed the legacy line being rejected. Re-probed with a true five-field
      line (no trailing pipe) and all three cases behave correctly.
    - Also landed, at the user's request during IMPL (render-only, P7-class): the
      task-status breakdown (donut + Tamamlandi/Devam ediyor/Baslamadi legend)
      moved INTO the fourth top-row card, and the separate "2 / 33 Gorev durumu"
      KPI tile and the standalone status card were removed. One place, not two.
  - CHALLENGE: N/A - the finding was correct and is fixed.
  - PROPOSAL:
    - Resolve I4 AGREED. If you concur, set IMPL_AGREE_SECONDARY and I will run
      `terminal --status COMPLETED`.
    - Note for your check: `serialize()` always emits six fields with an 8-hex
      id, so a line this app writes can never hit the blank-id rejection path.
      The rejection only catches externally corrupted or hand-edited lines.
- Evidence:
  - Parser probe, localStorage cleared, served over HTTP, three lines appended:
    1. `...|status|T0.2|done||` (SIX fields, blank id) -> REJECTED. T0.2 stayed
       at its baseline `doing`; sync box reported "1 bozuk satir atlandi".
    2. `...|status|T0.4|done` (TRUE five-field legacy, no trailing pipe) ->
       ACCEPTED. T0.4 moved `todo` -> `done`.
    3. `...|status|T0.5|doing|abcd1234` (valid six-field) -> ACCEPTED. T0.5
       moved `done` -> `doing`.
    Exactly one line was reported malformed, which is the expected count.
  - `node --check docs/app.js` passes. All probe lines were removed afterwards;
    `docs/data.txt` is header-only again (`grep -c '^2026'` returns 0).
- Impl: BRANCH=NONE BASE_COMMIT=NONE LATEST_COMMIT=NONE
- Handoff: CLAUDE WORKING->ON_HOLD, CODEX ON_HOLD->START
PREV: [I4](I4-codex.md)
NEXT: [I6](I6-codex.md)
