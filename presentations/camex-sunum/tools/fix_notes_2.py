"""Notes round 2: CAMEX naming, new 'Network view' slide, renumbering."""
from pathlib import Path
import re

p = Path(__file__).resolve().parents[1] / "src" / "content" / "notes.js"
s = p.read_text(encoding="utf-8")

s = s.replace(
    "Herkese iyi günler. Projemizin adı XMorph: mikroskop görüntülerindeki PC12 hücrelerini, yani sinir hücresine benzeyen hücreleri otomatik olarak segmente eden ve morfolojilerini ölçen, açıklanabilir yapay zekâ tabanlı bir sistem. Bu sistemi kullanıcıya sunan masaüstü uygulamamızın adı da CAMEX.",
    "Herkese iyi günler. Projemizin adı CAMEX, yani Cellular Analysis of Morphology with XAI for PC12. CAMEX, mikroskop görüntülerindeki PC12 hücrelerini, yani sinir hücresine benzeyen hücreleri otomatik olarak segmente eden ve morfolojilerini hücre hücre ölçen, açıklanabilir yapay zekâ tabanlı bir sistem ve bu sistemi çevrim dışı çalışan bir masaüstü uygulamasıyla kullanıcıya sunuyor.")
s = s.replace("Özetle XMorph, PC12", "Özetle CAMEX, PC12")
s = s.replace("// XMorph / CAMEX sunum", "// CAMEX sunum")
assert "XMorph" not in s

NEW = """  {
    n: 0,
    title: "Network view",
    approxSeconds: 45,
    stepMax: 3,
    script: `Ağın görüntüyü nasıl okuduğunu bu animasyonla göstermek istiyoruz. Ekrandaki görüntü, ön işlemeden geçmiş hâli: tek kanal, üçte bire küçültülmüş ve normalize edilmiş.
→ Ağ bu görüntünün tamamını tek seferde görmüyor; 256'ya 256 piksellik bir pencere görüntü üzerinde 224 piksellik adımlarla dolaşıyor. Komşu pencereler 32 piksel örtüşüyor ve örtüşen bölgelerde tahminlerin ağırlıklı ortalaması alınıyor; böylece pencere sınırlarında iz kalmıyor.
→ Her pencerenin içinde ise 3'e 3'lük küçük filtreler, yani kernel'ler, piksel piksel kayıyor. Her konumda dokuz pikseli dokuz ağırlıkla çarpıp topluyor ve tek bir değer üretiyor; bu değerler bir özellik haritası oluşturuyor. Burada örnek olarak kenar yakalayan bir filtre gösteriyoruz.
→ Önemli nokta şu: bu ağırlıkları biz elle yazmıyoruz; eğitim sırasında ağ kendisi öğreniyor. Her katmanda 64'ten 512'ye kadar böyle filtre var ve derin katmanlar ince çizgi, hücre gövdesi, dallanma noktası gibi giderek karmaşıklaşan desenlere tepki veriyor.`,
  },
"""
anchor = '  {\n    n: 14,\n    title: "Architecture"'
assert anchor in s
s = s.replace(anchor, NEW + anchor, 1)

counter = iter(range(1, 1000))
s = re.sub(r"(\n    n: )\d+,", lambda m: f"{m.group(1)}{next(counter)},", s)
p.write_text(s, encoding="utf-8", newline="\n")
print("entries:", s.count("\n    n: "))
