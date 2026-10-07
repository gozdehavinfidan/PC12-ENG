"""Dataset slide: one explanatory 'Two image types' card (size + objective + count, drawn to scale)
instead of the separate Sizes / Magnification number cards."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "src" / "slides.html"
s = p.read_text(encoding="utf-8")

old = s[s.index('        <div class="grid c2">\n          <div class="kcard frag" style="--accent:var(--data)"><div class="k-eyebrow">Images</div>'):]
old = old[:old.index('        </div>\n      </div>\n    </div>\n    <div class="page-num"></div>') + len('        </div>\n')]
new = """        <div class="grid c2">
          <div class="kcard frag" style="--accent:var(--data)"><div class="k-eyebrow">Images</div><div class="k-value"><span data-count="91">91</span></div><div class="k-sub">fluorescence micrographs of PC12 cells</div></div>
          <div class="kcard frag" style="--accent:var(--data)"><div class="k-eyebrow">Bit depth</div><div class="k-value" style="font-size:44px">8 bit</div><div class="k-sub">per colour channel (RGB) · CZI converted to PNG</div></div>
          <div class="kcard frag span2" style="--accent:var(--data)">
            <div class="k-eyebrow">Two image types</div>
            <div class="imgtype">
              <div class="it-box"><div class="it-frame" style="width:116px;height:65px;"><span>20×</span></div></div>
              <div><div class="k-title">1920 × 1080 px · 20× objective</div><div class="k-sub"><b>53 images</b> · close-up view, cells appear large</div></div>
            </div>
            <div class="imgtype">
              <div class="it-box"><div class="it-frame" style="width:232px;height:130px;"><span>5×</span></div></div>
              <div><div class="k-title">3840 × 2160 px · 5× objective</div><div class="k-sub"><b>38 images</b> · 4× wider field of view, cells appear small</div></div>
            </div>
            <div class="tag-note">frames drawn to scale (pixels) · objective = how strongly the lens magnifies the sample</div>
          </div>
        </div>
"""
s = s.replace(old, new, 1)
p.write_text(s, encoding="utf-8", newline="\n")

css = ROOT / "src" / "styles" / "camex.css"
c = css.read_text(encoding="utf-8")
c += """
/* ---------- dataset slide: image types drawn to scale ---------- */
.kcard.span2 { grid-column: 1 / -1; gap: 14px; }
.imgtype { display: flex; align-items: center; gap: 26px; }
.imgtype .it-box { flex: 0 0 250px; display: flex; align-items: center; justify-content: center; }
.imgtype .it-frame {
  border-radius: 6px;
  background: radial-gradient(circle at 30% 40%, rgba(74,222,128,.55) 0 3px, transparent 4px),
              radial-gradient(circle at 70% 65%, rgba(74,222,128,.55) 0 3px, transparent 4px),
              #0B0F14;
  border: 2px solid var(--data);
  display: flex; align-items: center; justify-content: center;
}
.imgtype .it-frame span { color: #fff; font-weight: 800; font-size: 26px; }
"""
css.write_text(c, encoding="utf-8", newline="\n")

n = ROOT / "src" / "content" / "notes.js"
t = n.read_text(encoding="utf-8")
a = t.index('    title: "Dataset",')
b = t.index('  },', a)
t = t[:a] + """    title: "Dataset",
    approxSeconds: 35,
    stepMax: 3,
    script: `Veri setimiz PC12 hücrelerine ait floresan mikroskop görüntülerinden oluşuyor.
→ Toplam 91 görüntüyü Label Studio'da kendimiz etiketledik.
→ Görüntüler kanal başına 8 bitlik renkli görüntüler; mikroskobun CZI dosyalarını PNG'ye dönüştürdük.
→ Veri setinde iki tür görüntü var. 53 görüntü 20× objektifle çekildi ve 1920'ye 1080 piksel; bunlar yakın görünüm, hücreler büyük görünüyor. 38 görüntü 5× objektifle çekildi ve 3840'a 2160 piksel; dört kat daha geniş bir alanı gösteriyorlar ama hücreler daha küçük görünüyor. Objektif, mercek sisteminin numuneyi ne kadar büyüttüğünü belirliyor. Bu farkın ayrıntısını bir sonraki slaytta anlatacağım.`,
""" + t[b:]
n.write_text(t, encoding="utf-8", newline="\n")
print("ok")
