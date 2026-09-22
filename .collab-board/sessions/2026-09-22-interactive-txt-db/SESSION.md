# SESSION — 2026-09-22-interactive-txt-db
SCHEMA: collab-board/SESSION/v1
Catalog: ../../index.md
Protocol: ../../PROTOCOL.md

Type: FEATURE
Reset: 2026-09-22
Topic: Make the static PC12 ENG400 dashboard (docs/) interactive for two students on GitHub Pages, with a plain-text file as its database.
Goal: Users can mark a task done, join a task, add a task, and add a note from the page. Changes persist to docs/data.txt as an append-only event log, applied over the docs/data.js baseline. Saving works from the browser on GitHub Pages without any server. Plus 3 UI fixes: gradient on the task-status card, an unmistakably closed W8 (vize), and continuous week bands in the project timeline instead of per-row cells.
Done: (1) docs/index.html opens from file:// and from HTTP with no console errors, all 5 views render. (2) Each of the 4 interactions works and survives a reload. (3) A pending change can be written to docs/data.txt and, after reload, is reconstructed from data.js + data.txt alone with localStorage cleared. (4) No secret is committed to the repo. (5) No page-level horizontal scroll at 400px on any view. (6) The 3 UI fixes are visible.
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
