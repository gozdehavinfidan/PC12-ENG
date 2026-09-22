### TURN-I6 (CLAUDE)
SCHEMA: collab-board/turn/v1
- Header: PART=IMPL · RESPONDS_TO=I5 · POINTS=I6
- Body:
  - FINDINGS:
    - **Why a PRIMARY turn is sitting where a SECONDARY turn should be.** CODEX
      is usage-limited. Two consecutive dispatches (I6-a1, I6-a2) returned the
      same signature - "You've hit your usage limit ... try again at Sep 23rd,
      2026 12:31 AM" - with an empty `-o` file, so both results are INVALID per
      the codex-cli validity rule. Board verified clean before and after: no
      `turns/I6-codex.md`, `I5` NEXT still `pending`, `points.md` unchanged,
      no `TURN_COMMIT I6` in the log. Nothing to roll back.
    - **USER DIRECTIVE (Rule 9), recorded verbatim in effect:** the project
      owner instructed "devam etmeyi dene codex ile olmazsa kendin devam et" -
      try Codex, and if it fails, continue alone. I tried twice and it failed
      the same way, so I am proceeding under that directive.
    - **What this costs, stated plainly rather than buried.** PROTOCOL §4 bans
      the PRIMARY's self-review from standing in for the adversarial gate, and
      that ban exists for a reason this very session demonstrated twice: CODEX
      found five blocking defects, and TWO of them (I3, I5) were direct
      refutations of claims where I had written "verified". A self-review has
      exactly the blind spot that record predicts. So this turn does the WORK
      CODEX was asked to do, but it is **not** the gate:
      `IMPL_AGREE_SECONDARY` stays `NO` and I am not touching it. The session
      terminates as completed-by-user-directive, not by mutual agreement.
    - **(d) The exhaustive sweep - the one item that was genuinely outstanding
      and not just re-verification.** CODEX asked for it because two instances
      of the same defect in one file argues against sampling. Ran it as a
      script rather than by eye: extracted every key in `data.js` and counted
      references in `app.js`. Five fields have zero read path: `subtitle`,
      `wikiPath`, `role`, `ready`, and the `NOTE` token (a comment artifact,
      not a field). `weeks[].note` and `risks[].status` are also unread, masked
      in the raw count by the task-level `note`/`status` fields.
    - Then applied the agreed test - does the field carry a user-facing
      INSTRUCTION whose result is invisible - by grepping the instruction-shaped
      comments rather than guessing. There are exactly three: the avatar swap
      (L61-62), `results[]` "pasted in BY HAND" (L223-224), and `log` "append
      at the END" (L229). `results[]` was fixed in I3 and `log` is rendered.
      **None of the five unread fields carries an instruction**, so they pass
      the test we agreed and stay deferred - this time on evidence rather than
      on my assumption, which is how I got I5 wrong.
    - **NEW DEFECT, found by that sweep (I6).** The third instruction is the
      one nobody had checked, and it is the one that WILL be executed: "When
      Berke's photo arrives: put a square-cropped berke.jpg in assets/ and
      replace the null below ... **Nothing else changes.**" That last claim was
      false. `avatarHTML` branched on `p.avatar` being truthy and emitted a
      bare `<img>` with no fallback, so a wrong filename - the likely outcome
      when a teammate adds a file from another machine - left an empty circle
      with no initials and no name. Strictly worse than the placeholder it
      replaced. Fixed: initials render underneath and the image removes itself
      via a static `onerror="this.remove()"` (no interpolated data, so no new
      injection surface).
  - CHALLENGE:
    - Against the temptation to close this cleanly: I will not mark
      `IMPL_AGREE_SECONDARY=YES` on CODEX's behalf, and I will not quietly
      terminate as though both gates were granted. The board must show what
      actually happened, because the audit value of this session is precisely
      that an independent reviewer caught things I asserted were fine.
    - Against my own I6 fix, the one thing I could not verify: with a
      transparent PNG avatar the initials would show through from underneath.
      `gozde.jpg` is opaque so this is latent, not live. Not fixing it
      speculatively; recording it.
    - Unverified by anyone: items (a), (b), (c) of the I6 brief were my own
      work re-checked by me. I re-read `freshnessHTML` for escaping and
      re-exercised its branches, and I still think the 10-day threshold is
      right (a 2-week gap between updates during a 3-week presentation gap
      SHOULD read as stale - the field means "when did a human last look at
      this", not "when was the last presentation"). But CODEX was asked to
      attack that judgement and did not get to. It is a judgement call that
      has had one pair of eyes, and the board should say so.
  - PROPOSAL:
    - Resolve I6 AGREED (the avatar fallback, verified below).
    - Terminate the session COMPLETED under the user directive, with
      `IMPL_AGREE_SECONDARY` left at `NO`. The five defects CODEX found are
      fixed and verified; the sixth is mine and verified; what is missing is
      the second pair of eyes on the last three fixes (I5's freshness label,
      the routine rewrite, and this avatar fallback).
    - Carried to the next session, in priority order: (1) the P5 structural
      duplication between `data.js` and `13-SUNUM-PLAN.md`, which produced two
      divergences in this session alone; (2) a CODEX review of the three
      unreviewed fixes; (3) `sunum[].ready`, invisible and false for five of
      six entries.
- Evidence:
  - Limit classification: `stderr-eng401-I6-a1.txt` and `-a2.txt` both end with
    "ERROR: You've hit your usage limit ... try again at Sep 23rd, 2026 12:31
    AM."; a1 exited 0 with an EMPTY `-o` file, a2 exited 1 with no `-o` file at
    all. Host clock at the second attempt: 2026-09-22T18:02Z. Two attempts,
    same explicit reset, so this is a classified hard limit, not a transient.
  - Read-path sweep output (fields with 0 references in `app.js`): `subtitle`,
    `wikiPath`, `role`, `ready`. Instruction-comment grep returned exactly
    three instruction sites: `data.js:61-62` (avatar), `223-224` (results),
    `229` (log).
  - **I6 fix verified by breaking it first.** Set Berke's `avatar` to
    `"assets/berke-TYPO.jpg"` (a path that 404s) and loaded over HTTP: the
    avatar element's innerHTML was `<i class="ini">BD</i>`, visible text "BD",
    `imgStillThere: false`, while Gozde's real photo still loaded
    (`gozdePhotoStillLoads: true`). Before the fix the same input produced an
    empty circle. `data.js` restored afterwards (`grep -c 'avatar: null'` = 2).
  - Full regression pass on the restored tree, served over HTTP with
    localStorage cleared: no `.fatal`, zero console errors, "1 / 15 WEEK",
    freshness "Updated 2026-09-22 &middot; today", sync "Saved" with no
    orphan/anchor diagnostics, Gozde's photo renders as an image and Berke as
    "BD". All five views render non-empty with no error banner. At a 400px
    viewport `scrollWidth == clientWidth == 385`.
  - `node --check` passes on `docs/app.js` and `docs/data.js`; CSS braces
    balance 303/303; `grep -c '^2026' docs/data.txt` = 3 (unchanged, no test
    data leaked). Cache-buster at `?v=10`.
- Impl: BRANCH=main BASE_COMMIT=63313f89160777557124dc182e065cdb5b2a245e LATEST_COMMIT=NONE
- Handoff: CLAUDE WORKING->ON_HOLD (terminal turn; CODEX remains unavailable and its gate is NOT set)
PREV: [I5](I5-claude.md)
NEXT: pending
