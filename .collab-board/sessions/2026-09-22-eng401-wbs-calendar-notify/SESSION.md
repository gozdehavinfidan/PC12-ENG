# SESSION — 2026-09-22-eng401-wbs-calendar-notify
SCHEMA: collab-board/SESSION/v1
Catalog: ../../index.md
Protocol: ../../PROTOCOL.md

Type: FEATURE
Reset: 2026-09-22
Topic: Adversarial review of an already-implemented change set on the PC12 ENG401 dashboard: ENG400->ENG401 rename, calendar-derived current week, timeline avatar intro animation, sidebar enlargement, sidebar notifications (msg/read events), and a full WBS rebuild from the updated course Gantt.
Goal: Find real defects in the shipped diff before it is committed, with each finding either fixed and behaviourally verified, or explicitly rejected with reasoning. Priority order: (1) data-model correctness of the new msg/read events in the append-only log, (2) the week-derivation arithmetic, (3) WBS fidelity to the source Gantt and the downstream claims that depend on it, (4) render-only regressions.
Done: Every I* point is non-OPEN, both IMPL gates are YES, node --check passes on docs/app.js and docs/data.js, the page renders with zero console errors and no page-level horizontal scroll at 400px, and docs/data.txt contains no test lines.
Stall: CHECK=15m, HANDOFF=10m
Roles: PRIMARY=CLAUDE, SECONDARY=CODEX
SecondaryAdapter: codex-cli

<!--
Default pairing: PRIMARY=CLAUDE, SECONDARY=CODEX, SecondaryAdapter=codex-cli.
Adapter values: codex-cli | claude-cli | subagent:<name> | manual (peer mode included);
`codex` is a legacy alias of codex-cli. A CLI executor dispatches the named CLI as the
SECONDARY, so it must match the secondary actor (codex-cli => SECONDARY=CODEX, claude-cli =>
SECONDARY=CLAUDE; lint L18) — see the skill's references/executors/ for the exact dispatch
specs and references/hosts/ for host preflights. Other pairings use `manual` or
`subagent:<name>`. Optional `SecondaryModel:` / `SecondaryEffort:` keys pin the executor's
model/effort for this session; omit them to inherit the user's CLI config.

PRIMARY: fill Topic / Goal / Done before opening TURN-P1 (Rule 2).
  Topic — one line: what this session is about.
  Goal  — the concrete end state.
  Done  — the objective, checkable completion condition.
This file is write-once. Do not edit it after the first turn.
-->
