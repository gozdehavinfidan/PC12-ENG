"""Dataset slide: short facts in the 'Two image types' card, with pixel size in micrometres."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "src" / "slides.html"
s = p.read_text(encoding="utf-8")
rep = [
 ('<div><div class="k-title">1920 × 1080 px · 20× objective</div><div class="k-sub"><b>53 images</b> · close-up view, cells appear large</div></div>',
  '<div><div class="k-title">1920 × 1080 px · 20×</div><div class="chips" style="margin-top:8px"><span class="chip">53 images</span><span class="chip">0.185 µm / px</span></div></div>'),
 ('<div><div class="k-title">3840 × 2160 px · 5× objective</div><div class="k-sub"><b>38 images</b> · 4× wider field of view, cells appear small</div></div>',
  '<div><div class="k-title">3840 × 2160 px · 5×</div><div class="chips" style="margin-top:8px"><span class="chip">38 images</span><span class="chip">0.37 µm / px*</span></div></div>'),
 ('<div class="tag-note">frames drawn to scale (pixels) · objective = how strongly the lens magnifies the sample</div>',
  '<div class="tag-note">* computed from the camera pixel and the objective</div>'),
]
for a, b in rep:
    assert a in s, a[:60]
    s = s.replace(a, b)
p.write_text(s, encoding="utf-8", newline="\n")

n = ROOT / "src" / "content" / "notes.js"
t = n.read_text(encoding="utf-8")
old = "→ Veri setinde iki tür görüntü var. 53 görüntü 20× objektifle çekildi ve 1920'ye 1080 piksel; bunlar yakın görünüm, hücreler büyük görünüyor. 38 görüntü 5× objektifle çekildi ve 3840'a 2160 piksel; dört kat daha geniş bir alanı gösteriyorlar ama hücreler daha küçük görünüyor. Objektif, mercek sisteminin numuneyi ne kadar büyüttüğünü belirliyor. Bu farkın ayrıntısını bir sonraki slaytta anlatacağım."
new = "→ Veri setinde iki tür görüntü var. 53 görüntü 20× objektifle, 1920'ye 1080 piksel olarak çekildi; burada bir piksel numunede 0,185 mikrometreye karşılık geliyor. 38 görüntü ise 5× objektifle, 3840'a 2160 piksel olarak çekildi; burada bir piksel yaklaşık 0,37 mikrometre. Yani aynı hücre ikinci grupta piksel olarak yarı boyutta görünüyor. 0,37 değeri hesaplanmış bir değer; bir kalibrasyon lamıyla doğrulayacağız."
assert old in t
t = t.replace(old, new)
n.write_text(t, encoding="utf-8", newline="\n")
print("ok")
