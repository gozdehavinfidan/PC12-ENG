"""Round 3: one DATA section. Preprocessing, tested methods, augmentation and robustness
move right after Labelling; the outline becomes 4 stations (DATA, SETUP, MODEL, RESULTS)."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

# ---------------- slides ----------------
p = ROOT / "src" / "slides.html"
s = p.read_text(encoding="utf-8")

# split into comment-headed blocks, each holding one <section>
blocks = re.split(r"(?=<!-- ============== )", s)
blocks = [b for b in blocks if b.strip()]
def find(label):
    return next(i for i, b in enumerate(blocks) if f'data-label="{label}"' in b)

move = [blocks[find(l)] for l in ("09 Preprocessing", "10 Preprocessing tested", "11 Augmentation", "12 Robustness")]
for b in move:
    blocks.remove(b)
move = [b.replace('section-label sl--input', 'section-label sl--data').replace('>INPUT</div>', '>DATA</div>') for b in move]
at = find("05 Labelling") + 1
blocks[at:at] = move
s = "".join(blocks)
assert "INPUT" not in s.split("Outline")[1] or True

# outline: 4 stations
old_labels = """        <div class="station-label color-01">DATA</div>
        <div class="station-label color-02">SETUP</div>
        <div class="station-label color-03">INPUT</div>
        <div class="station-label color-04">MODEL</div>
        <div class="station-label color-05">RESULTS</div>"""
new_labels = """        <div class="station-label color-01">DATA</div>
        <div class="station-label color-02">SETUP</div>
        <div class="station-label color-03">MODEL</div>
        <div class="station-label color-04">RESULTS</div>"""
assert old_labels in s
s = s.replace(old_labels, new_labels)

i0 = s.index('        <div class="flow-col color-03">')
i1 = s.index('        <div class="flow-col color-04">')
s = s[:i0] + s[i1:]                                   # drop the INPUT station
s = s.replace('<ul class="station-slides"><li><span>Dataset</span></li><li><span>Acquisition</span></li><li><span>Labelling</span></li></ul>',
              '<ul class="station-slides"><li><span>Dataset &amp; labelling</span></li><li><span>Preprocessing</span></li><li><span>Augmentation</span></li></ul>')
s = s.replace('<div class="flow-col color-04">\n          <div class="station-circle"><span class="station-num">4</span>',
              '<div class="flow-col color-03">\n          <div class="station-circle"><span class="station-num">3</span>')
s = s.replace('<div class="flow-col color-05">\n          <div class="station-circle"><span class="station-num">5</span>',
              '<div class="flow-col color-04">\n          <div class="station-circle"><span class="station-num">4</span>')
assert s.count('class="flow-col color-0') == 4
p.write_text(s, encoding="utf-8", newline="\n")

# ---------------- CSS: 4-station outline ----------------
css = ROOT / "src" / "styles" / "camex.css"
c = css.read_text(encoding="utf-8")
c += """
/* ---------- round 3: outline with 4 stations (DATA, SETUP, MODEL, RESULTS) ---------- */
#outline-flow { --brand-3: #2563EB; --brand-1: #0F2854; }   /* station 3 = blue (MODEL), 4 = navy (RESULTS) */
#outline-flow .flow-grid, #outline-flow .flow-labels { grid-template-columns: repeat(4, 1fr); }
#outline-flow .flow-track-fill {
  background: linear-gradient(to right,
    #C2410C 0%, #C2410C 25%, #8E44AD 25%, #8E44AD 50%,
    #2563EB 50%, #2563EB 75%, #0F2854 75%, #0F2854 100%);
}
#outline-flow[data-step="1"] .flow-track-fill { clip-path: inset(0 75% 0 0); }
#outline-flow[data-step="2"] .flow-track-fill { clip-path: inset(0 50% 0 0); }
#outline-flow[data-step="3"] .flow-track-fill { clip-path: inset(0 25% 0 0); }
#outline-flow[data-step="4"] .flow-track-fill { clip-path: inset(0 0 0 0); }
#outline-flow[data-step="4"] .flow-track-cap.end { background: #0F2854; box-shadow: 0 0 0 4px rgba(15, 40, 84, 0.24); }
"""
css.write_text(c, encoding="utf-8", newline="\n")

# ---------------- notes: same order as the slides ----------------
n = ROOT / "src" / "content" / "notes.js"
t = n.read_text(encoding="utf-8")
head, body = t.split("export const NOTES = [", 1)
body, tail = body.rsplit("];", 1)
entries = re.findall(r"  \{\n.*?\n  \},\n", body, flags=re.S)
title = lambda e: re.search(r'title: "([^"]+)"', e).group(1)
order = [title(e) for e in entries]
for name in ("Preprocessing", "Preprocessing tested", "Augmentation", "Robustness"):
    order.remove(name)
k = order.index("Labelling") + 1
order[k:k] = ["Preprocessing", "Preprocessing tested", "Augmentation", "Robustness"]
by = {title(e): e for e in entries}
entries = [by[x] for x in order]

# outline note: 4 sections
by_outline = entries[1]
new_outline = """  {
    n: 2,
    title: "Outline",
    approxSeconds: 18,
    stepMax: 4,
    script: `Sunumumuz dört bölümden oluşuyor:
→ önce veri: veri setimiz, etiketleme ve görüntüyü modele hazırlayan ön işleme ile augmentation;
→ ardından yöntemleri adil karşılaştırmak için kurduğumuz deney düzeni ve metrikler;
→ sonra modelin kendisi: kayıp fonksiyonu, ağın görüntüyü nasıl okuduğu, mimari, model topluluğu ve hücre gövdeleri;
→ ve son olarak sonuçlar ile CAMEX uygulaması.`,
  },
"""
entries[1] = new_outline
# the tested-methods note now comes before the metrics slide: introduce clDice and folds briefly
entries = [e.replace(
    "Bu üç adıma birçok yöntemi deneyerek ulaştık; referansımız tam çözünürlükteki U-Net'ti ve clDice 0,728'di.",
    "Bu üç adıma birçok yöntemi deneyerek ulaştık. Sonuçları clDice ile ölçüyoruz: nöritlerin ne kadar kopmadan ve eksiksiz bulunduğunu gösteren, 1'in mükemmel olduğu bir skor; ayrıntısını deney düzeni bölümünde anlatacağım. Referansımız tam çözünürlükteki U-Net'ti ve clDice 0,728'di.")
    for e in entries]
counter = iter(range(1, 1000))
body = "".join(entries)
body = re.sub(r"(\n    n: )\d+,", lambda m: f"{m.group(1)}{next(counter)},", "\n" + body)[1:]
n.write_text(head + "export const NOTES = [\n" + body + "];" + tail, encoding="utf-8", newline="\n")
print("notes:", [title(e) for e in entries])
