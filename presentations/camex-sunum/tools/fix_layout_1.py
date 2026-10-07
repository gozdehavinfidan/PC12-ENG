"""One-off layout fixes after the first visual check (slides 5, 7, 8, 10, 11, 13, 16)."""
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src" / "slides.html"
s = p.read_text(encoding="utf-8")

rep = [
 # 05 labelling: example image on the left, class cards stacked on the right
 ("""    <div class="body" style="flex-direction:column;justify-content:center;" id="label-flow">
      <div class="grid c3">""",
  """    <div class="body" id="label-flow">
      <div class="fig anim-fade-up delay-2" style="flex:1.25;">
        <img src="assets/figures/label_example.png" alt="Micrograph crop and its label">
        <div class="cap">crop and label · yellow = cell · green = branch</div>
      </div>
      <div class="col grow" style="justify-content:center;">"""),
 ("""          <div class="k-sub">single cells not separable → <b>kept out</b> of per-cell measurements</div>
        </div>
      </div>
    </div>""",
  """          <div class="k-sub">single cells not separable → <b>kept out</b> of per-cell measurements</div>
        </div>
      </div>
    </div>"""),
 # 07 protocol: larger split tree
 ('<div class="split-tree">', '<div class="split-tree" style="zoom:1.15">'),
 # 08 metrics: figure sized to its content
 ("""      <div class="fig frag" style="flex:1;">
        <img src="assets/figures/fig_dice_vs_cldice.png" alt="Dice and clDice on synthetic errors">""",
  """      <div class="fig frag" style="padding:26px 22px;margin-top:10px;">
        <img src="assets/figures/fig_dice_vs_cldice.png" alt="Dice and clDice on synthetic errors" style="width:100%;">"""),
 # 10 tested: short titles, method names in the keys line
 ('<span class="sl-title">CLAHE · asinh · denoising · sharpening</span>', '<span class="sl-title">Contrast &amp; denoising</span>'),
 ('<div class="sl-keys">no effect (−0.006 … +0.003)</div>', '<div class="sl-keys">CLAHE · asinh · NLM · gamma · sharpening: no effect</div>'),
 ('<span class="sl-title">Flat-field · top-hat · rolling ball · z-score</span>', '<span class="sl-title">Background removal</span>'),
 ('<div class="sl-keys">harmful (down to −0.199): they erase the signal</div>', '<div class="sl-keys">flat-field · top-hat · rolling ball: harmful, down to −0.199</div>'),
 ('<span class="sl-title">Ridge-filter input channels</span>', '<span class="sl-title">Ridge-filter channels</span>'),
 ('<span class="sl-title">Tighter percentile (99.5 · 99)</span>', '<span class="sl-title">Tighter percentile</span>'),
 ('<div class="sl-keys">−0.012 · −0.025</div>', '<div class="sl-keys">99.5 · 99: −0.012 · −0.025</div>'),
 # 11 augmentation: cards in a side column, larger gallery
 ("""    <div class="body" style="flex-direction:column;" id="aug-flow">
      <div class="grid c2">
        <div class="kcard frag" style="--accent:var(--input)"><div class="k-eyebrow">Always on</div><div class="k-title">Random crops</div><div class="k-sub">2/3 near a cell or neurite · 1/3 anywhere</div></div>
        <div class="kcard frag" style="--accent:var(--input)"><div class="k-eyebrow">Always on</div><div class="k-title">8 rotations &amp; flips</div><div class="k-sub">cells have no preferred direction</div></div>
      </div>
      <div class="fig frag" style="flex:1;"><img src="assets/figures/fig_aug_gallery.png" alt="Augmentations on one crop"></div>
      <div class="chips frag">""",
  """    <div class="body" style="flex-direction:column;gap:22px;" id="aug-flow">
      <div class="body" style="gap:24px;">
        <div class="col" style="flex:0 0 470px;justify-content:center;">
          <div class="kcard frag" style="--accent:var(--input)"><div class="k-eyebrow">Always on</div><div class="k-title">Random crops</div><div class="k-sub">2/3 near a cell or neurite · 1/3 anywhere</div></div>
          <div class="kcard frag" style="--accent:var(--input)"><div class="k-eyebrow">Always on</div><div class="k-title">8 rotations &amp; flips</div><div class="k-sub">cells have no preferred direction</div></div>
        </div>
        <div class="fig frag" style="flex:1;"><img src="assets/figures/fig_aug_gallery.png" alt="Augmentations on one crop"></div>
      </div>
      <div class="chips frag">"""),
 # 13 loss: cards sized to content, vertically centred
 ('<div class="body" id="loss-flow">', '<div class="body" id="loss-flow" style="align-items:center;">'),
 ('<div class="kcard frag" style="--accent:var(--model);flex:1;">\n          <div class="k-eyebrow">soft-clDice loss</div>',
  '<div class="kcard frag" style="--accent:var(--model);padding:34px 36px;">\n          <div class="k-eyebrow">soft-clDice loss</div>'),
 ('<div class="kcard frag" style="--accent:var(--model);flex:1;">\n          <div class="k-eyebrow">Training collapse</div>',
  '<div class="kcard frag" style="--accent:var(--model);padding:34px 36px;">\n          <div class="k-eyebrow">Training collapse</div>'),
 # 16 soma: readable count-error line
 ('<div class="k-title">|found − true| / true</div>', '<div class="k-title">gap between found and true cell count</div>'),
]
for a, b in rep:
    assert a in s, a[:70]
    s = s.replace(a, b)
p.write_text(s, encoding="utf-8", newline="\n")
print("ok")
