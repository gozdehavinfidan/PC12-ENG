# Presentation decks

One self-contained HTML file per presentation week, named by the week:

| Week | File      |
|------|-----------|
| W2   | `W2.html` |
| W4   | `W4.html` |
| W6   | `W6.html` |
| W9   | `W9.html` |
| W11  | `W11.html`|
| W13  | `W13.html`|

Two ways to add a deck. Both put the file here, and the dashboard finds it by itself:

1. **From the dashboard:** Presentations → *Upload deck* on that week's card. It commits
   the file here and records who uploaded it.
2. **With git:** copy the file here under the name above, then commit and push. The
   card shows the commit author as the uploader.

Once GitHub Pages has published the file (usually under a minute), that week's
*Start presentation* button turns on and opens the deck in a new tab.

Why here and not in the repo root: GitHub Pages serves only `docs/`. A deck outside
it would never be reachable from the site.

Keep each deck to one file with its images embedded. Only this file is published,
so linked images or scripts next to it would be missing. Anything in this folder
is public, because it is part of the dashboard site.
