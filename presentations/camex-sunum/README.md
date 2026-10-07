# CAMEX presentation

HTML deck (1920 × 1080) built on the engine and visual style of the 2242 template.
Slide text is in English; the speaker notes (presenter view) are in Turkish.

## Run
- Double-click `start-windows.bat` (serves on port 8242 and opens the deck), or
- `python -m http.server 8242 --bind 127.0.0.1` in this folder → open `http://127.0.0.1:8242/index.html`.

Keys: → / Space next (reveals the next item first) · ← back · F full screen · P presenter view (notes, timer, next slide).

## Edit
- Slides: `src/slides.html` → then run `python tools/build_index.py` to regenerate `index.html`.
- Speaker notes: `src/content/notes.js` (one `→` line per step).
- Styles: `src/styles/camex.css` (template styles in `styles.css` are unchanged).
- Slides can be reordered or removed freely: page numbers and step controllers follow the DOM order.
- Step-by-step reveal: add `class="frag"` to an element inside a container whose id is listed in
  `CONTROLLERS` in `tools/build_index.py`.

## Sources
Content: `icerik/sayfa_*.md`; figures: `overleaf/figures/` and `icerik/pc12.png`.
