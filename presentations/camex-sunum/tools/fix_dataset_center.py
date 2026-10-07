"""Dataset slide: no µm chips, image counts as plain text, card contents centred."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "src" / "slides.html"
s = p.read_text(encoding="utf-8")
rep = [
 ('<div><div class="k-title">1920 × 1080 px · 20×</div><div class="chips" style="margin-top:8px"><span class="chip">53 images</span><span class="chip">0.185 µm / px</span></div></div>',
  '<div class="it-text"><div class="k-title">1920 × 1080 px · 20×</div><div class="k-sub">53 images</div></div>'),
 ('<div><div class="k-title">3840 × 2160 px · 5×</div><div class="chips" style="margin-top:8px"><span class="chip">38 images</span><span class="chip">0.37 µm / px*</span></div></div>',
  '<div class="it-text"><div class="k-title">3840 × 2160 px · 5×</div><div class="k-sub">38 images</div></div>'),
 ('            <div class="tag-note">* computed from the camera pixel and the objective</div>\n', ''),
]
for a, b in rep:
    assert a in s, a[:60]
    s = s.replace(a, b)
s = s.replace('<div class="body" id="dataset-flow">', '<div class="body dataset-centred" id="dataset-flow">', 1)
p.write_text(s, encoding="utf-8", newline="\n")

css = ROOT / "src" / "styles" / "camex.css"
c = css.read_text(encoding="utf-8")
c += """
/* dataset slide: centred card contents */
.dataset-centred .kcard { align-items: center; text-align: center; }
.dataset-centred .imgtype { justify-content: center; width: 100%; }
.dataset-centred .imgtype .it-box { flex: 0 0 250px; }
.dataset-centred .imgtype .it-text { flex: 0 0 340px; text-align: left; }
"""
css.write_text(c, encoding="utf-8", newline="\n")

n = ROOT / "src" / "content" / "notes.js"
t = n.read_text(encoding="utf-8")
old = "→ Veri setinde iki tür görüntü var. 53 görüntü 20× objektifle, 1920'ye 1080 piksel olarak çekildi; burada bir piksel numunede 0,185 mikrometreye karşılık geliyor. 38 görüntü ise 5× objektifle, 3840'a 2160 piksel olarak çekildi; burada bir piksel yaklaşık 0,37 mikrometre. Yani aynı hücre ikinci grupta piksel olarak yarı boyutta görünüyor. 0,37 değeri hesaplanmış bir değer; bir kalibrasyon lamıyla doğrulayacağız."
new = "→ Veri setinde iki tür görüntü var: 53 görüntü 20× objektifle, 1920'ye 1080 piksel; 38 görüntü 5× objektifle, 3840'a 2160 piksel. Bu farkın ölçümlere etkisini bir sonraki slaytta anlatacağım."
assert old in t
t = t.replace(old, new)
n.write_text(t, encoding="utf-8", newline="\n")
print("ok")
