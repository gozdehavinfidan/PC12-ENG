# Frozen Plan — 2026-09-22-interactive-txt-db (collab-board/context/v1)

STATUS: FROZEN
Source turns: [P1](../turns/P1-claude.md) [P2](../turns/P2-codex.md) [P3](../turns/P3-claude.md) [P4](../turns/P4-codex.md) [P5](../turns/P5-claude.md)

## 1. Data model (P1, AGREED)

`docs/data.js` stays the immutable BASELINE (`window.PC12_DATA`, classic script tag - it
must keep working on `file://`, ADR D7). `docs/data.txt` is an APPEND-ONLY event log.
Live state = baseline, then events applied in order.

Line format (6 fields, `|`-separated):

    ISO_TS|ACTOR|ACTION|TARGET|VALUE|ID

- `ACTOR`: ML | BM
- `ACTION`: status | pct | join | note | task | del
- `ID`: 8 hex chars, per-event, the idempotency key (P4).
- A line with only 5 fields is a LEGACY line: id = hash(line). The already-committed
  `docs/data.txt` header/seed must stay parseable.
- `VALUE` escapes `|` as `%7C`; newlines are not allowed.
- `task` VALUE = `ip;title;owner;wStart;wEnd`.

Rationale of record (corrected in P3): NOT "git auto-merges EOF appends" - it does not,
two branches appending at the same insertion point conflict. The real value is cheap
**idempotent re-application** after a compare-and-swap conflict, plus provenance.

## 2. Write path (P2, AGREED)

Browser -> GitHub REST Contents API: GET blob sha, PUT base64 content, conditional on sha.

- Token: a fine-grained PAT, **JS memory only, for the current tab**. NEVER localStorage,
  NEVER committed, NEVER logged, NEVER in a URL. Input is `type="password"`
  `autocomplete="current-password"` so a password manager can refill it.
- Evidence this is the floor, not a shortcut: GitHub's OAuth token endpoint sends no CORS
  headers, so a browser-only device flow is impossible without a proxy server. Every
  serverless browser writer must expose a bearer credential to page JS.
- Residual risk accepted knowingly: a fine-grained PAT scopes to a repo, not a path, so a
  leaked token could rewrite `app.js` itself. Argues further for memory-only.
- Zero-credential fallback retained: "copy lines" to clipboard + deep link to
  `github.com/<owner>/<repo>/edit/<branch>/docs/data.txt`.

## 3. Sync state machine (P3, AGREED at six states)

`LOCAL_ONLY` · `SYNCED` · `PENDING` · `SYNCING` · `AUTH_REQUIRED` · `ERROR`.

- Outside `SYNCED` the UI must **not** claim shared persistence.
- `file://`: `fetch('data.txt')` is CORS-blocked -> catch, fall back to baseline +
  local outbox, show a visible LOCAL_ONLY notice. Never fail silently.
- Storage unavailable (private mode) -> memory-only, not a crash.
- Malformed / unknown / duplicate event lines -> skipped with a visible warning.
- CONFLICT_RETRY folded into SYNCING; OFFLINE folded into ERROR (an error reason +
  connectivity signal covers auto- vs manual retry). Codex verified no differing user
  action exists (P4).

## 4. Concurrency (P4, AGREED)

Single per-tab outbox. Every event carries an id. Save = GET latest -> append only the
ids absent from the remote tail -> conditional PUT -> on conflict, bounded randomized
backoff and repeat (NOT a single retry: with two writers the lone retry races the same
winner and loses events). The outbox is **not** cleared until a re-read of the committed
remote file contains those ids. Exhaustion stays `PENDING` with a visible retry action.

## 5. Identity + interactions (P5, AGREED)

An actor picker (ML|BM) in localStorage sets event authorship. It is a **local
preference, not a security boundary**.

Four interactions, each appending exactly one event:
(a) status change (incl. "tamamlandi"), (b) join task (idempotent; owner -> EK),
(c) add task (collision-resistant id), (d) add note.

## 6. UI work (P6 + P7, AGREED)

P6 (original): gradient on the task-status card; an unmistakably CLOSED W8 (vize) in both
the timeline and the Gantt; continuous vertical week bands instead of per-row cells.

P7 (user amendment, post-gate, same render-only character as P6 which Codex called
"orthogonal to persistence"):
- Remove the "Acik risk" KPI tile; put a task-status tile in its place.
- Remove the "tarih belirsiz" row/card from the project timeline.
- Larger week labels (W1, W2 ...); presentation weeks rendered black.
- Week label chips are squat and not centred -> give them real height and centre them.
- The project timeline as a whole is too small: increase row height, bar height and
  font sizes. The coloured owner bars (which carry the avatars) get more height.
- Card titles centred; fonts increased.

## 7. Persisted status + progress (P8, AGREED)

Task status marks (not started / active / done) AND progress bars must be **reconstructed
from the persisted log on every page load** - never from transient memory. A reload with
localStorage cleared, served over HTTP, must reproduce exactly `data.js` + `data.txt`.
This is the primary acceptance check of the whole feature.

## 8. Security rule binding on IMPL

`data.txt` content is rendered into the DOM, so escaping is a **security control**, not
formatting: every data.txt-derived string (note bodies, task titles, actor fields) passes
through `esc()` before reaching `innerHTML`. No exceptions.

## 9. Files the IMPL phase will touch

Project:
- `docs/app.js` - event parse/apply, outbox, GitHub write path, interactions, all views
- `docs/styles.css` - P6 + P7 UI work, sync-state and drawer/modal styling
- `docs/index.html` - containers for the drawer/dialog, actor picker, save box
- `docs/data.txt` - header/format doc updated for the 6th `id` field
- `docs/data.js` - baseline only; touched only if a seed field is needed

Cross-cutting consistency (expected, not scope creep):
- `llm-wiki/09-DASHBOARD.md` - document interactivity, the txt database, the save flow
- `llm-wiki/DECISIONS.md` - new ADR for the event-log DB + memory-only PAT
- `README.md` - how the two of them save changes; the token warning

NOT touched: `llm-wiki/12-REFERENCES.md` (quarantined unverified), `.gitignore`
(already correct), the TUSEB PDF, `PC12_Gantt_Chart.xlsx`.

## 10. Verification (the Done contract)

1. `docs/index.html` opens from `file://` and over HTTP, 5 views, no console errors.
2. Each of the four interactions works and survives a reload.
3. With localStorage cleared and served over HTTP, state is reproduced from
   `data.js` + `data.txt` alone (P8).
4. No secret committed anywhere in the repo.
5. No page-level horizontal scroll at 400px on any view.
6. P6 + P7 UI changes visible.
