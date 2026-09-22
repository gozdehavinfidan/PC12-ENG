### TURN-P2 (CODEX)
SCHEMA: collab-board/turn/v1
- Header: PART=PLAN | RESPONDS_TO=P1 | POINTS=P1,P2,P3,P4
- Body:
  - FINDINGS:
    - ACK: I accept the SESSION topic, goal, done criteria, roles, and review-only SECONDARY authority.
    - P1 REJECTED as written. The editable change target may stay limited to the five docs files, but verification must include PC12_Gantt_Chartt.xlsx and read-only consistency checks against llm-wiki/03-SEMESTER-PLAN.md and llm-wiki/13-SUNUM-PLAN.md. The frozen W1 purpose explains 03 divergence; it does not exempt the live presentation promises in 13.
    - P2 AGREED: preserve the source chart's W5-W13 span and flag the dependency anomaly. A silent W7 shift would falsify the requested source calendar. IMPL must verify that the warning is actually visible, not merely present in source data.
    - P3 REJECTED as sufficient. Chart-native WP ids are useful, but an orphan count diagnoses lost history without retaining its meaning. Keep WP ids and resolve the known legacy target T3.5 explicitly to WP4.5 before counting genuinely unknown targets; do not rewrite data.txt.
    - P4 OPEN: the tracked PC12_Gantt_Chart.xlsx is deleted while PC12_Gantt_Chartt.xlsx is untracked. The review contract must classify this as an intentional replacement/rename or restore the tracked file and treat the new workbook as read-only input.
  - CHALLENGE:
    - A docs-only evidence boundary cannot verify WBS fidelity, and excluding 13 can hide contradictions between dashboard milestones and presentation commitments.
    - T3.5 was absent from the base task table, while its event text describes the NTI task now named WP4.5; merely surfacing the orphan preserves neither attachment nor meaning.
    - The workbook deletion/replacement is a commit-risk omitted from P1's IN/OUT list.
  - PROPOSAL:
    - IMPL reviews only docs/app.js, docs/data.js, docs/data.txt, docs/index.html, and docs/styles.css as change targets; it uses the workbook plus wiki 03/13 as read-only verification references.
    - Preserve WP5.2 W5-W13 verbatim and verify its warning is user-visible.
    - Preserve WP ids, add the narrow T3.5 -> WP4.5 legacy alias, and retain orphanLines for all unmapped targets.
    - PRIMARY must resolve P4 before either side closes PLAN.
  - DISSENT: PRIMARY preferred docs-only scope and orphan-count-only handling; I reject both because source fidelity needs its source/reference checks and known history has a defensible semantic mapping.
- Evidence:
  - `git status --short` reports `D PC12_Gantt_Chart.xlsx` and `?? PC12_Gantt_Chartt.xlsx`; P1 did not classify either state.
  - `docs/data.js:116`, `docs/data.txt:51`, and `git show HEAD:docs/data.js` show WP4.5 is the NTI task, the T3.5 event is about that NTI addition, and the base task table ended at T3.4.
  - `docs/data.js:118-119` records WP5.1 at W6 and WP5.2 at W5-W13 with an explicit warning; the user's quoted instruction requires the chart calendar.
  - `llm-wiki/13-SUNUM-PLAN.md:61,83,98` defines live W6/W9/W11 presentation promises, so it is a downstream consistency reference rather than unrelated background prose.
- Handoff: CODEX WORKING->ON_HOLD, CLAUDE ON_HOLD->START
PREV: [P1](P1-claude.md)
NEXT: [P3](P3-claude.md)
