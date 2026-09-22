### TURN-P1 (CLAUDE)
SCHEMA: collab-board/turn/v1
- Header: PART=PLAN · RESPONDS_TO=NEW · POINTS=P1,P2,P3,P4,P5,P6
- Body:
  - FINDINGS:
    - Target is `docs/` in this repo: a static, build-free dashboard (index.html +
      styles.css + app.js + data.js + assets/). It must render identically from the
      `file://` origin (double-click) and from GitHub Pages. ADR D7 in
      `llm-wiki/DECISIONS.md` fixed that constraint and is why data is a classic
      `<script src="data.js">` assigning `window.PC12_DATA`, not `fetch('data.json')`.
    - Two users: Gozde (ML, software) and Berke (BM, data/labeling). They want to
      mark tasks done, join a task, add tasks, and add notes FROM the page, and have
      it persist to a text file that is the site's database.
    - Hard constraint the user already identified: GitHub Pages serves static files
      only. No server-side write path exists. A page cannot write its own repo.
    - The repo is NOT yet a git repo (`git rev-parse` fails) and `gh` is absent, so
      nothing can be verified against a real remote in this session.
    - Free GitHub Pages requires a PUBLIC repo, so anything committed is world-readable.
  - CHALLENGE: N/A (opening turn; no prior shard to challenge)
  - PROPOSAL:
    - P1 Data model: event sourcing. `docs/data.js` stays the immutable BASELINE.
      `docs/data.txt` is an APPEND-ONLY event log
      (`ISO_TS|ACTOR|ACTION|TARGET|VALUE`). The page computes live state as
      baseline + events in order. Rationale: two students editing one shared state
      file would conflict in git every week; two people APPENDING distinct lines to
      one file merges cleanly or trivially. Occam check: a single rewritten state
      file is simpler to implement but strictly worse under concurrent edits, which
      is the stated use case.
    - P2 Write path: browser -> GitHub REST Contents API
      (GET sha, PUT base64 content) using a FINE-GRAINED PAT that each user pastes
      into the page once and that is stored in `localStorage` ONLY. Never committed.
      Fallback when no token: "copy lines to clipboard" + a deep link to
      `github.com/<o>/<r>/edit/<branch>/docs/data.txt`. This is the only mechanism
      that delivers the user's literal ask (automatic save) on a static host.
    - P3 `file://` degradation: `fetch('data.txt')` is CORS-blocked on `file://`.
      Define it explicitly: wrap in try/catch, fall back to baseline + localStorage,
      and show a visible "local mode, changes not shared" notice. Never fail silently.
    - P4 Concurrency: the Contents API PUT is conditional on the blob `sha`. On a
      409/conflict, re-GET, re-apply our pending lines to the NEW tail, and retry
      once. Because events are append-only, a re-apply is a concatenation, not a
      merge - this is the main payoff of P1.
    - P5 Identity + interactions: a "Ben:" actor picker (ML|BM) in localStorage sets
      the event author. Four interactions: (a) status -> done, (b) join task, (c) add
      task, (d) add note. Each appends exactly one event line.
    - P6 UI fixes requested by the user: gradient background on the task-status card
      (matching the next-SUNUM card), an unmistakably CLOSED W8 (vize) in both the
      timeline and the Gantt, and CONTINUOUS vertical week bands in the project
      timeline instead of one set of cells per row.
    - Requested of CODEX: attack P2 hardest. A PAT in `localStorage` on a public
      Pages origin is the weakest link; if you can show a materially safer path that
      still auto-saves without a server, I will take it. Also check P3 and P4 for
      states I have not defined.
- Evidence:
  - `llm-wiki/DECISIONS.md` D7 records the `file://` CORS finding that forbids
    `fetch`-based data loading; `docs/index.html` loads `data.js` via a classic
    script tag for that reason.
  - `git rev-parse --is-inside-work-tree` -> "fatal: not a git repository", and
    `command -v gh` -> not found: no remote verification is possible this session.
  - GitHub Pages documentation: Pages serves static content; free-tier Pages
    requires a public repository. Both are the basis of the P2 constraint.
- Handoff: CLAUDE WORKING->ON_HOLD, CODEX ON_HOLD->START
PREV: NEW
NEXT: [P2](P2-codex.md)
