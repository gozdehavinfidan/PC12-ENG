"""Pixel size next to the image counts on the dataset slide; remove the Acquisition slide and its note."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "src" / "slides.html"
s = p.read_text(encoding="utf-8")
s = s.replace('<div class="k-title">1920 × 1080 px</div><div class="k-sub">53 images</div>',
              '<div class="k-title">1920 × 1080 px</div><div class="k-sub">53 images · 1 px = 0.185 µm</div>')
s = s.replace('<div class="k-title">3840 × 2160 px</div><div class="k-sub">38 images</div>',
              '<div class="k-title">3840 × 2160 px</div><div class="k-sub">38 images · 1 px ≈ 0.37 µm</div>')
assert "1 px = 0.185 µm" in s and "1 px ≈ 0.37 µm" in s

blocks = re.split(r"(?=<!-- ============== )", s)
blocks = [b for b in blocks if 'data-label="Acquisition"' not in b]
s = "".join(blocks)
assert 'data-label="Acquisition"' not in s
p.write_text(s, encoding="utf-8", newline="\n")

n = ROOT / "src" / "content" / "notes.js"
t = n.read_text(encoding="utf-8")
t = t.replace(
    "→ Veri setinde iki tür görüntü var: 53 görüntü 20× objektifle, 1920'ye 1080 piksel; 38 görüntü 5× objektifle, 3840'a 2160 piksel. Bu farkın ölçümlere etkisini bir sonraki slaytta anlatacağım.",
    "→ Veri setinde iki tür görüntü var. 53 görüntü 20× objektifle, 1920'ye 1080 piksel olarak çekildi; burada bir piksel numunede 0,185 mikrometreye karşılık geliyor. 38 görüntü 5× objektifle, 3840'a 2160 piksel olarak çekildi; burada bir piksel yaklaşık 0,37 mikrometre. Yani ikinci grup dört kat daha geniş bir alanı gösteriyor, ama aynı hücre piksel olarak yarı boyutta görünüyor. Ölçümleri her görüntünün kendi piksel boyutuyla mikrometreye çeviriyoruz. 0,37 değeri hesaplanmış bir değer; bir kalibrasyon lamıyla doğrulayacağız.")
assert "kalibrasyon lamıyla doğrulayacağız.`" in t
a = t.index('  {\n    n: 4,\n    title: "Acquisition",')
b = t.index("  },\n", a) + len("  },\n")
t = t[:a] + t[b:]
counter = iter(range(1, 1000))
t = re.sub(r"(\n    n: )\d+,", lambda m: f"{m.group(1)}{next(counter)},", t)
n.write_text(t, encoding="utf-8", newline="\n")
print("notes:", t.count("\n    n: "))
