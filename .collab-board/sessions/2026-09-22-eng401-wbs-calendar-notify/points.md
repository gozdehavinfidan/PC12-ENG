# Point Tracker — 2026-09-22-eng401-wbs-calendar-notify
SCHEMA: collab-board/points/v1

<!-- Statuses: OPEN · AGREED · REJECTED · DEFERRED · OUT_OF_SCOPE. Prefixes: P* (plan), I* (impl).
     Resolved In = link to the turn shard that resolved the point, e.g. [P2](turns/P2-codex.md).
     Keep it lean: one row per real decision, not per remark. -->

| ID | Part | Title | Status | Resolved In |
|----|------|-------|--------|-------------|
| P1 | PLAN | Review scope: docs/ only; wiki + background-process files excluded | REJECTED | [P2](turns/P2-codex.md) |
| P2 | PLAN | WP5.2 starts before WP5.1 in the source chart: copy verbatim + flag, or shift | AGREED | [P2](turns/P2-codex.md) |
| P3 | PLAN | Task-id renumbering to chart rows; orphaned log events surfaced not rewritten | REJECTED | [P2](turns/P2-codex.md) |
| P4 | PLAN | Unclassified tracked-workbook deletion and untracked replacement | AGREED | [P3](turns/P3-claude.md) |
| P5 | PLAN | 13-SUNUM-PLAN W13 promise contradicts the weakened data.js claim | AGREED | [P3](turns/P3-claude.md) |
| I1 | IMPL | Aliased task creation resurrects a stale legacy id instead of surfacing it | AGREED | [I3](turns/I3-claude.md) |
| I2 | IMPL | computeWeek accepts impossible calendar dates instead of fallback | AGREED | [I3](turns/I3-claude.md) |
| I3 | IMPL | W9 and W11 presentation claims precede workbook-scheduled WP4 work | AGREED | [I3](turns/I3-claude.md) |
| I4 | IMPL | results and other user-facing data fields remain write-only | AGREED | [I3](turns/I3-claude.md) |
| I5 | IMPL | meta.updated weekly maintenance instruction remains a silent no-op | AGREED | [I5](turns/I5-claude.md) |
| I6 | IMPL | Avatar instruction contract broken: a wrong path leaves an empty circle | AGREED | [I6](turns/I6-claude.md) |
