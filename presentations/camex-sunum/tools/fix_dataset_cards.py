"""Dataset slide: magnification + bit depth cards instead of format / model input; no metadata chip."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "src" / "slides.html"
s = p.read_text(encoding="utf-8")
old_cards = """          <div class="kcard frag" style="--accent:var(--data)"><div class="k-eyebrow">Format</div><div class="k-title">RGB · 8-bit</div><div class="k-sub">Zeiss CZI converted to PNG</div></div>
          <div class="kcard frag" style="--accent:var(--data)"><div class="k-eyebrow">Model input</div><div class="k-title">1 gray channel</div><div class="k-sub">signal in the <b>green</b> channel</div></div>"""
new_cards = """          <div class="kcard frag" style="--accent:var(--data)"><div class="k-eyebrow">Magnification</div><div class="k-value" style="font-size:34px">53 <small>×</small> 20×<br>38 <small>×</small> 5×</div><div class="k-sub">objective, from CZI metadata</div></div>
          <div class="kcard frag" style="--accent:var(--data)"><div class="k-eyebrow">Bit depth</div><div class="k-title">8 bit / channel</div><div class="k-sub">RGB 24-bit · Zeiss CZI converted to PNG</div></div>"""
assert old_cards in s
s = s.replace(old_cards, new_cards)
old_chip = """        <div class="chips frag">
          <span class="chip" style="--accent:var(--data)"><span class="dot"></span>Per-image metadata: date · objective · camera mode · pixel size</span>
        </div>
"""
assert old_chip in s
s = s.replace(old_chip, "")
p.write_text(s, encoding="utf-8", newline="\n")

n = ROOT / "src" / "content" / "notes.js"
t = n.read_text(encoding="utf-8")
old_note = """    stepMax: 5,
    script: `Veri setimiz PC12 hücrelerine ait floresan mikroskop görüntülerinden oluşuyor.
→ Toplam 91 görüntüyü Label Studio'da kendimiz etiketledik.
→ Görüntüler iki farklı boyutta: 53 tanesi 1920'ye 1080, 38 tanesi 3840'a 2160 piksel.
→ Mikroskobun CZI dosyalarını PNG olarak dışa aktardık; görüntüler kanal başına 8 bitlik renkli görüntüler.
→ Floresan sinyali yeşil kanalda olduğu için modele tek bir gri kanal veriyoruz.
→ Her görüntünün çekim tarihini, objektifini, kamera modunu ve piksel boyunu orijinal dosyalardan çıkarıp tek bir tabloda kaydettik; ölçümleri bu tabloya göre mikrometreye çevireceğiz.`,"""
new_note = """    stepMax: 4,
    script: `Veri setimiz PC12 hücrelerine ait floresan mikroskop görüntülerinden oluşuyor.
→ Toplam 91 görüntüyü Label Studio'da kendimiz etiketledik.
→ Görüntüler iki farklı boyutta: 53 tanesi 1920'ye 1080, 38 tanesi 3840'a 2160 piksel.
→ Mikroskobun CZI dosyalarındaki bilgilere göre 53 görüntü 20×, 38 görüntü 5× objektifle çekildi.
→ Görüntüler kanal başına 8 bit, yani 24 bitlik renkli görüntüler; CZI dosyalarını PNG'ye dönüştürdük.`,"""
assert old_note in t
t = t.replace(old_note, new_note)
n.write_text(t, encoding="utf-8", newline="\n")
print("ok")
