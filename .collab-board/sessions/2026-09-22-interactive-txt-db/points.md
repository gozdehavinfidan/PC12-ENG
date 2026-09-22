# Point Tracker — 2026-09-22-interactive-txt-db
SCHEMA: collab-board/points/v1

<!-- Statuses: OPEN · AGREED · REJECTED · DEFERRED · OUT_OF_SCOPE. Prefixes: P* (plan), I* (impl).
     Resolved In = link to the turn shard that resolved the point, e.g. [P2](turns/P2-codex.md).
     Keep it lean: one row per real decision, not per remark. -->

| ID | Part | Title | Status | Resolved In |
|----|------|-------|--------|-------------|
| P1 | PLAN | Data model: append-only event log over a data.js baseline | AGREED | [P2](turns/P2-codex.md) |
| P2 | PLAN | Write path: GitHub Contents API + memory-only fine-grained PAT (no localStorage) | AGREED | [P3](turns/P3-claude.md) |
| P3 | PLAN | Sync state machine (6 states) incl. file:// degradation | AGREED | [P3](turns/P3-claude.md) |
| P4 | PLAN | Concurrency: outbox + per-event id + CAS PUT + bounded backoff | AGREED | [P3](turns/P3-claude.md) |
| P5 | PLAN | Identity picker + the four interactions (done/join/add task/add note) | AGREED | [P2](turns/P2-codex.md) |
| P6 | PLAN | UI fixes: status-card gradient, closed W8, continuous week bands | AGREED | [P2](turns/P2-codex.md) |
| P7 | PLAN | UI amendment: KPI tile swap, timeline sizing, week labels, centred titles | AGREED | [P5](turns/P5-claude.md) |
| P8 | PLAN | Status marks + progress bars reload from the persisted log on refresh | AGREED | [P5](turns/P5-claude.md) |
| I1 | IMPL | Preserve append order for last-write-wins; do not sort by client timestamp | AGREED | [I3](turns/I3-claude.md) |
| I2 | IMPL | Distinguish HTTP load failure from file LOCAL_ONLY and expose retry | AGREED | [I3](turns/I3-claude.md) |
| I3 | IMPL | Validate and visibly warn on malformed, unknown, and duplicate log lines | AGREED | [I3](turns/I3-claude.md) |
| I4 | IMPL | Reject an empty ID in a six-field record; legacy ID fallback is five-field only | AGREED | [I5](turns/I5-claude.md) |
