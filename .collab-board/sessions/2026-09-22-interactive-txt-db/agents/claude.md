# CLAUDE self-state — 2026-09-22-interactive-txt-db
SCHEMA: collab-board/agent/v1

SELF_HAND: ON_HOLD
LAST_TURN_WRITTEN: I7

PRIVATE_NOTES:
<!-- Scratch space for this actor only. NON-AUTHORITATIVE — HEAD.md ## State is the truth.
     The secondary's fresh-vs-resume choice lives in ITS agent file (stored executor id);
     fresh is the default every turn. -->
- Repo is not a git repo yet and `gh` is absent -> P2/P4 cannot be end-to-end verified
  against a real remote this session. Plan for it, verify what is verifiable locally.
- Board files: keep ASCII (codex-cli adapter mangles non-ASCII, lint L21).
- User's chat language is Turkish; narrate in Turkish, keep the board English/ASCII.
- P3: conceded P2 (memory-only token) and P4 (outbox+uuid+backoff) to CODEX on evidence.
  Corrected my own P1 git-merge rationale. Held on P3 state count (6 not 8) - Occam.
- IMPL must carry: 6th `id` field in data.txt (legacy 5-field lines = hash fallback);
  esc() on every data.txt-derived string before innerHTML (it is a security control here).
- P5: user amended scope AFTER codex gated (P7 UI, P8 persisted-reload). Recorded as points,
  not smuggled in. P7 is render-only; if any item needs a data/sync change it comes back as a
  new point. Codex reviews both in IMPL against context.md sections 6 and 7.
- IMPL order: events -> outbox -> interactions -> github write path -> UI. Page must stay
  renderable after every step.
- I1: implemented everything in one pass. P8 acceptance test passed with
  localStorage cleared. Not a git repo -> code_state is NONE/NONE/NONE.
- Self-caught: wrote app.js ASCII by habit (L21 is about codex-written files,
  not project files; Rule 7 keeps CODEX out of docs/). Turkish UI restored.
- I3: conceded all three of codex's IMPL defects. The real one was I1 - I sorted the
  event log by client timestamp, which overrides the CAS-established append order.
  File order is authoritative; never sort. Each fix has a behavioural test, not an
  assertion.
- Process: use QUOTED heredocs for codex prompts; backticks in an unquoted one ran
  as shell commands and blanked two words in the I2 prompt.
