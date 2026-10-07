"""Assemble index.html from src/slides.html and three script blocks of the 2242 template.

Run from the deck root:  python tools/build_index.py
Template scripts reused (unchanged logic): cover particle title + typewriter,
generic step controller, presenter sync. Only texts and the controller list change.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
TPL = Path(r"N:/gozde/academic/year 4/ENG/2242-presentations-main/2242-presentations-main/index.html")
lines = TPL.read_text(encoding="utf-8").splitlines()


def block(start_marker: str, end_marker: str, after: int = 0) -> str:
    """Lines from the first line containing start_marker (searched after line `after`)
    up to and including the first following line equal to end_marker."""
    i = next(k for k in range(after, len(lines)) if start_marker in lines[k])
    j = next(k for k in range(i, len(lines)) if lines[k].strip() == end_marker)
    return "\n".join(lines[i:j + 1])


# 1. cover: particle title + typewriter (starts at the COLOR_STOPS script)
k = next(i for i, l in enumerate(lines) if "const COLOR_STOPS" in l)
cover = block("<script>", "</script>", after=k - 3)
cover = cover.replace("text: 'DiaSAGE'", "text: 'CAMEX'")
cover = re.sub(r"const TW_PHRASES = \[.*?\];",
               "const TW_PHRASES = [\n    'neurite segmentation',\n    'cell body counting',\n"
               "    'per-cell morphometry',\n    'an offline desktop application'\n  ];",
               cover, flags=re.S)
assert "'CAMEX'" in cover and "neurite segmentation" in cover

# 2. generic step controller, with our own controller list
k = next(i for i, l in enumerate(lines) if "Step-by-step slide controllers (generic)" in l)
ctrl = block("<script>", "</script>", after=k)
CONTROLLERS = """const CONTROLLERS = [
    { slideId: 'outline-flow',  elementId: 'outline-flow',  itemSelector: '.flow-col' },
    { slideId: 'dataset-flow',  elementId: 'dataset-flow',  itemSelector: '.frag' },
    { slideId: 'label-flow',    elementId: 'label-flow',    itemSelector: '.frag' },
    { slideId: 'protocol-flow', elementId: 'protocol-flow', itemSelector: '.frag' },
    {
      // Preprocessing: step cards reveal one by one; the histogram canvas follows the step.
      slideId: 'prep-flow', elementId: 'prep-flow', itemSelector: '.frag',
      render(el, step) {
        el.querySelectorAll('.frag').forEach((it, i) => {
          it.classList.toggle('is-revealed', i < step);
          it.classList.toggle('is-current', i === step - 1);
        });
        if (window.deckApplyPrepStep) window.deckApplyPrepStep(step);
      },
    },
    {
      // Kept rows brighten (stage 1); rejected rows are struck through (stage 2);
      // methods kept for a retest on the larger dataset are highlighted, not struck (stage 3).
      slideId: 'tested-flow', elementId: 'tested-flow', itemSelector: '.sl-row',
      render(el, step) {
        el.querySelectorAll('.sl-row').forEach((row, i) => {
          row.dataset.stage = i < step ? (row.dataset.keep ? '1' : row.dataset.retest ? '3' : '2') : '0';
        });
      },
    },
    { slideId: 'aug-flow',      elementId: 'aug-flow',      itemSelector: '.frag' },
    {
      // Network view: canvas animation (window -> kernel); summary chips on the last step.
      slideId: 'conv-flow', elementId: 'conv-flow', itemSelector: '.conv-step',
      render(el, step) {
        el.querySelectorAll('.conv-step').forEach((it, i) => it.classList.toggle('is-revealed', i < step));
        if (window.deckApplyConvStep) window.deckApplyConvStep(step);
      },
    },
    { slideId: 'soma-flow',     elementId: 'soma-flow',     itemSelector: '.frag' },
    {
      // CAMEX: the laptop screen (Analyze -> Compare -> Review -> Similarity) and the
      // matching orb follow the step; the 3D module (laptop.js) does the drawing.
      slideId: 'panel-orbs', elementId: 'panel-orbs', itemSelector: '.panel-orb',
      render(el, step) { if (window.deckApplyDoctorPanelStep) window.deckApplyDoctorPanelStep(step); },
    },
  ];"""
ctrl = re.sub(r"const CONTROLLERS = \[.*?\n  \];", CONTROLLERS, ctrl, count=1, flags=re.S)
# slide index is derived from the DOM, so slides can be reordered freely
ctrl = ctrl.replace(
    "      const items = Array.from(el.querySelectorAll(cfg.itemSelector));",
    "      const items = Array.from(el.querySelectorAll(cfg.itemSelector));\n"
    "      cfg.slideIndex = Array.prototype.indexOf.call(sections, el.closest('deck-stage > section'));")
# the template special-cases its slide 5 module; not present here
ctrl = ctrl.replace("if (slideIndex === 4 && window.deckApplyYenilikStep) window.deckApplyYenilikStep(n);", "")
ctrl = ctrl.replace("if (active && active.id === 'yenilik-slide' && window.deckYenilikStep) return { slideIndex: 4, step: window.deckYenilikStep() };", "")
# `sections` must exist before the controller list is mapped
ctrl = ctrl.replace("  const stage = document.querySelector('deck-stage');\n", "", 1)
ctrl = ctrl.replace("  const sections = document.querySelectorAll('deck-stage > section');\n", "", 1)
ctrl = ctrl.replace("(() => {\n  const CONTROLLERS",
                    "(() => {\n  const stage = document.querySelector('deck-stage');\n"
                    "  const sections = document.querySelectorAll('deck-stage > section');\n  const CONTROLLERS", 1)
assert "slideId: 'tested-flow'" in ctrl and "cfg.slideIndex = " in ctrl

# 3. presenter sync (multi-transport) — logic unchanged
k = next(i for i, l in enumerate(lines) if "Presenter view sync" in l)
sync = block("<script>", "</script>", after=k)

# early gesture capture from the template head (needed by the sync block)
k = next(i for i, l in enumerate(lines) if "ERKEN etkileşim yakalayıcı" in l)
early = block("<script>", "</script>", after=k - 2)

# CAMEX slide: highlight the orb whose screen the laptop shows (template listener, unchanged)
PANEL_ORBS = """<script>
(() => {
  const orbs = document.querySelectorAll('.panel-orb[data-panel]');
  if (!orbs.length) return;
  window.addEventListener('panelchange', (e) => {
    const idx = e.detail && typeof e.detail.index === 'number' ? e.detail.index : -1;
    orbs.forEach((orb) => {
      orb.classList.toggle('is-current', parseInt(orb.dataset.panel, 10) === idx);
    });
  });
})();
</script>"""

PAGE_NUM = """<script>
(() => {
  // Page numbers are computed, so slides can be added, removed or reordered freely.
  const secs = document.querySelectorAll('deck-stage > section');
  secs.forEach((s, i) => {
    const el = s.querySelector('.page-num');
    if (el) el.innerHTML = `${i + 1}<span class="sep">/</span><span class="total">${secs.length}</span>`;
  });
})();
</script>"""

slides = (ROOT / "src" / "slides.html").read_text(encoding="utf-8")
html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<script>window.addEventListener('pageshow',function(e){{if(e.persisted)location.reload();}});</script>
<title>CAMEX — PC12 Morphology</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,">
<link rel="stylesheet" href="src/styles/styles.css?v=1">
<link rel="stylesheet" href="src/styles/camex.css?v=36">
<script src="src/engine/deck-stage.js?v=1"></script>
{early}
<script src="src/slides/popup.js?v=1"></script>
<script type="importmap">
{{
  "imports": {{
    "three": "./vendor/three/three.module.js",
    "three/addons/": "./vendor/three/addons/"
  }}
}}
</script>
<script src="vendor/gsap/gsap.min.js"></script>
</head>
<body style="margin:0;background:#FFFFFF;">
<deck-stage width="1920" height="1080">
{slides}
</deck-stage>
{PAGE_NUM}
{PANEL_ORBS}
{cover}
{ctrl}
{sync}
<script src="src/slides/conv-anim.js?v=5"></script>
<script src="src/slides/effects.js?v=1"></script>
<script src="src/slides/prep-hist.js?v=8"></script>
<script type="module" src="src/slides/laptop.js?v=1"></script>
</body>
</html>
"""
(ROOT / "index.html").write_text(html, encoding="utf-8", newline="\n")
print("index.html written:", len(html.splitlines()), "lines;", slides.count("<section data-label"), "slides")
