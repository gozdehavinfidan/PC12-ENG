"""Round 2: project name CAMEX, network-view animation slide, count-up numbers,
growing bars/stairs (CSS variables instead of fixed sizes)."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "src" / "slides.html"
s = p.read_text(encoding="utf-8")

rep = [
 # ---- name: CAMEX everywhere ----
 ('<div class="cover-eyebrow anim-fade-up delay-1" style="text-align:center;">ENG401 <span class="red">●</span> CAMEX</div>',
  '<div class="cover-eyebrow anim-fade-up delay-1" style="text-align:center;">ENG401 <span class="red">●</span> PC12</div>'),
 ('<span id="tw-static">Explainable AI–Based Morphological Analysis of PC12 Cells — </span>',
  '<span id="tw-static">Cellular Analysis of Morphology with XAI for PC12 — </span>'),
 ('<div class="item"><div class="lbl">Application</div><div class="val">CAMEX</div></div>',
  '<div class="item"><div class="lbl">Course</div><div class="val">ENG401</div></div>'),
 ('ENG401 <span style="color:var(--red);">●</span> CAMEX</div>', 'ENG401 <span style="color:var(--red);">●</span> PC12</div>'),
 ("""<span class="text-grad">XMorph</span> — explainable, automated morphology of PC12 cells,<br>from the micrograph to per-cell measurements.""",
  """<span class="text-grad">CAMEX</span> — Cellular Analysis of Morphology with XAI for PC12:<br>from the micrograph to per-cell measurements."""),
 # ---- count-up numbers ----
 ('<div class="k-value">91</div>', '<div class="k-value"><span data-count="91">91</span></div>'),
 ('<div class="k-value">53 <small>images</small></div>', '<div class="k-value"><span data-count="53">53</span> <small>images</small></div>'),
 ('<div class="k-value">38 <small>images</small></div>', '<div class="k-value"><span data-count="38">38</span> <small>images</small></div>'),
 ('<div class="k-value">0.580 <span class="big-arrow">→</span> 0.768</div>',
  '<div class="k-value">0.580 <span class="big-arrow">→</span> <span data-count="0.768" data-dec="3">0.768</span></div>'),
 ('<div class="k-value">0.747 <span class="big-arrow">→</span> 0.776</div>',
  '<div class="k-value">0.747 <span class="big-arrow">→</span> <span data-count="0.776" data-dec="3">0.776</span></div>'),
 ('<div><div class="k-value">+0.023</div>', '<div><div class="k-value"><span data-count="0.023" data-dec="3" data-prefix="+">+0.023</span></div>'),
 ('<div><div class="k-value">+0.031</div>', '<div><div class="k-value"><span data-count="0.031" data-dec="3" data-prefix="+">+0.031</span></div>'),
 ('<div class="k-eyebrow">TTA alone</div><div class="k-value">+0.005</div>',
  '<div class="k-eyebrow">TTA alone</div><div class="k-value"><span data-count="0.005" data-dec="3" data-prefix="+">+0.005</span></div>'),
 ('<div class="k-eyebrow">UNet++ + SegFormer</div><div class="k-value">+0.020</div>',
  '<div class="k-eyebrow">UNet++ + SegFormer</div><div class="k-value"><span data-count="0.020" data-dec="3" data-prefix="+">+0.020</span></div>'),
 ('<div class="k-eyebrow">Final neurite model</div><div class="k-value">0.823</div>',
  '<div class="k-eyebrow">Final neurite model</div><div class="k-value"><span data-count="0.823" data-dec="3">0.823</span></div>'),
]
for a, b in rep:
    assert a in s, a[:80]
    s = s.replace(a, b)

# bars and stairs grow when their slide is entered: size moves into a CSS variable
s = re.sub(r'<div class="(bar [^"]+)" style="width:([\d.]+%)"></div>', r'<div class="\1" style="--w:\2"></div>', s)
s = re.sub(r'<div class="s-bar" style="height:(\d+px)">([\d.]+)</div>',
           r'<div class="s-bar" style="--h:\1"><span data-count="\2" data-dec="3">\2</span></div>', s)
assert 'style="--w:' in s and 'style="--h:' in s

# ---- new slide: how the network reads the image (before the architecture tournament) ----
CONV = """<!-- ============== NETWORK VIEW — window + kernel animation ============== -->
<section data-label="Network view">
  <div class="frame">
    <div class="deck-header"><div class="left"><img src="assets/images/logos/ikcu-logo.png"></div><div class="right"></div></div>
    <div class="section-label sl--model anim-fade-up">MODEL</div>
    <h1 class="slide-title anim-fade-up delay-1">How the network reads an image</h1>
    <div class="body" id="conv-flow">
      <div class="col grow">
        <div class="fig dark anim-fade-up delay-2" style="flex:1;padding:0;overflow:hidden;">
          <canvas id="conv-image" width="1120" height="630" style="width:100%;height:100%;object-fit:contain;"></canvas>
        </div>
        <span class="conv-step" hidden></span><span class="conv-step" hidden></span>
        <div class="chips conv-step frag">
          <span class="chip" style="--accent:var(--model)"><span class="dot"></span>same kernel at every position</span>
          <span class="chip" style="--accent:var(--model)"><span class="dot"></span>weights are learned, not hand-made</span>
          <span class="chip" style="--accent:var(--model)"><span class="dot"></span>64 → 512 kernels per layer</span>
        </div>
      </div>
      <div class="col anim-fade-up delay-3" style="flex:0 0 610px;justify-content:center;">
        <canvas id="conv-zoom" width="640" height="720" style="width:100%;height:auto;"></canvas>
      </div>
    </div>
    <div class="page-num"></div>
  </div>
</section>

"""
marker = "<!-- ============== 14 — ARCHITECTURE ============== -->"
assert marker in s
s = s.replace(marker, CONV + marker, 1)
p.write_text(s, encoding="utf-8", newline="\n")

# ---- CSS: growing bars / stairs, spotlight on the current card ----
css = ROOT / "src" / "styles" / "camex.css"
c = css.read_text(encoding="utf-8")
c += """
/* ---------- round 2: motion ---------- */
.bar { width: 0; transition: width 0.9s cubic-bezier(.2,.8,.2,1); }
deck-stage section[data-deck-active] .bar { width: var(--w); }
.bar-row:nth-child(1) .bar { transition-delay: .15s; } .bar-row:nth-child(2) .bar { transition-delay: .25s; }
.bar-row:nth-child(3) .bar { transition-delay: .35s; } .bar-row:nth-child(4) .bar { transition-delay: .45s; }
.bar-row:nth-child(5) .bar { transition-delay: .55s; } .bar-row:nth-child(6) .bar { transition-delay: .65s; }
.bar-row:nth-child(7) .bar { transition-delay: .75s; } .bar-row:nth-child(8) .bar { transition-delay: .85s; }

.stair .s-bar { height: 0; overflow: hidden; transition: height 1s cubic-bezier(.2,.8,.2,1); }
deck-stage section[data-deck-active] .stair .s-bar { height: var(--h); }
.stair:nth-child(2) .s-bar { transition-delay: .15s; } .stair:nth-child(3) .s-bar { transition-delay: .3s; }
.stair:nth-child(4) .s-bar { transition-delay: .45s; } .stair:nth-child(5) .s-bar { transition-delay: .6s; }
.stair:nth-child(6) .s-bar { transition-delay: .75s; }

/* spotlight: the card of the current step lifts and glows in its own colour */
.kcard.frag.is-current, .p-step.frag.is-current {
  transform: translateY(-6px) scale(1.015);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #2563C9) 30%, transparent),
              0 24px 48px color-mix(in srgb, var(--accent, #2563C9) 22%, transparent);
}
.kcard, .p-step { transition: transform .45s ease, box-shadow .45s ease, opacity .45s ease; }
"""
css.write_text(c, encoding="utf-8", newline="\n")
print("ok")
