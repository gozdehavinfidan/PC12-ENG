# 09 — Dashboard (built · how to run it · how to maintain it)

> **Status: BUILT.** Lives in `../docs/`. This file describes what exists and
> how to keep it alive — it is no longer a spec.
>
> Supersedes the v1 spec, which proposed `data.json` + `fetch()` and a kanban
> whose drag wrote the data file. Both were impossible under the actual
> constraints; see ADR **D7**.

## Run it

**Locally:** double-click `docs/index.html`. That's it — no server, no npm, no
install. It opens on the `file://` origin and works there by design.

**Optional local server** (only if you want a real HTTP origin):
```
cd docs && python -m http.server 8000     →  http://localhost:8000
```

**Later, for Berke:** push to GitHub, then Settings → Pages → Source: `main`,
folder `/docs`. Set `meta.repoUrl` in `data.js` so the wiki deep-links work.

## The files

| File | Changes | Owner |
|------|---------|-------|
| `docs/data.js` | **weekly** | both |
| `docs/app.js` | W1–2, then almost never | Gözde |
| `docs/styles.css` | W1–2, then almost never | Gözde |
| `docs/index.html` | basically never | Gözde |
| `docs/.nojekyll` | never (must exist) | — |

**Why four files instead of one self-contained `index.html`.** Git merges line
by line. If everything lived in one file, Berke's weekly status edit and
Gözde's CSS tweak would collide inside a 2000-line file — and the realistic
resolution by two people who are not git experts is `--ours`, which silently
deletes a week of someone's updates. Splitting by **rate of change** means the
weekly churn is confined to `data.js` and their edits never meet.

## Why `data.js` and not `data.json` (ADR D7)

A `file://` page has an opaque `null` origin, so `fetch('./data.json')` and
`XMLHttpRequest` on a sibling file are **both CORS-blocked**. `<script
type="module">` fails for the same reason — module scripts are always fetched
with CORS semantics, even as a plain `src`.

The failure mode that would have caused is the nasty one: the dashboard renders
**empty locally** and only works once pushed to Pages. For a tool meant to be
used locally first, that is worse than not building it.

A **classic** `<script src="data.js">` assigning a global is exempt from CORS
and behaves identically in both environments. Bonus: because it is JavaScript
and not JSON, it allows **comments** and **trailing commas** — which genuinely
matters for a file two people hand-edit fifteen times.

## The weekly ritual (≈ 2 minutes)

Open `docs/data.js` and:
1. `meta.currentWeek` → this week's number.
2. `meta.updated` → today, `YYYY-MM-DD`.
3. Changed tasks → their `status` and `pct`.
4. Append **one line to the END** of `log[]`.

Then commit. That is the entire maintenance cost of this dashboard.

**Two conventions that keep it conflict-free:**
- **One task per physical line.** Berke editing `T1.3` and Gözde editing `T2.1`
  then merge automatically.
- **Append to the END of `log[]` and `decisions[]`.** `app.js` reverses them for
  display. Prepending is what makes two people conflict every single week.

## Görünüm tercihi: daktilo yazısı, tek tema

- **Yazı tipi: daktilo (monospace).** `"Cascadia Mono", Consolas, "SF Mono",
  Menlo, "DejaVu Sans Mono", monospace`. **Sistem fontu kullanıyoruz, Google
  Fonts DEĞİL** — uygulama çevrimdışı çalışmak zorunda, ve harici bir font
  `file://` üzerinde veya internetsiz bir jüri bilgisayarında yüklenmez.
  Cascadia Mono Windows 11 ve Windows Terminal ile gelir; Consolas her Windows'ta
  var, macOS'ta SF Mono/Menlo devreye girer.
- **Dark mode kaldırıldı.** Sayfa her zaman açık temada. `prefers-color-scheme`
  bloğu silindi ve `:root`'a `color-scheme: light` eklendi — ikincisi olmadan
  tarayıcı kendi arayüz öğelerini (scrollbar, form alanları) yine koyu çizerdi.
- **Punto sayfa genelinde ~%15 büyütüldü** (gövde 14px → 15.5px, en küçük
  etiketler 9px → 10.5px). Monospace glifler daha geniş olduğu için Gantt'ın
  görev sütunu 290px → **420px**, hafta sütunu 52px → **58px**, tablonun
  min-width'i **1290px** oldu. Tablo kendi `.scroll-x` kutusunda yatay kayıyor;
  **sayfanın kendisi hiçbir görünümde yatay kaymıyor** (400px dahil test edildi).
- ⚠ **Hafta sütunu genişliği `--wk-w` CSS değişkeninde.** `app.js` çok-haftalı
  Gantt çubuğunun uzunluğunu bu değerden hesaplıyor (`weekColW()`); eskiden
  kodda sabit `52` yazıyordu ve CSS değişince çubuklar sessizce yanlış
  uzunlukta çiziliyordu. Genişliği değiştirecekseniz **sadece CSS'ten** değiştirin.

## Views

1. **Genel bakış** — KPIs, status donut, the next SUNUM and its claim, recent
   log, milestone gates, staleness banner.
2. **Zaman çizelgesi** — İP0…İP7 × W1–W15. Bars coloured by owner, SUNUM columns
   highlighted lime, W8 hatched, W15 teal, a red line on `currentWeek`.
3. **Görev panosu** — kanban. Drag to change status; "copy `data.js` lines"
   exports a pasteable block.
4. **Sunum planı** — the `13-SUNUM-PLAN` table: what's on screen, the claim, the
   fallback. **This is the view that matters.**
5. **Risk & karar** — risk register, ADR index (deep-links to `DECISIONS.md`),
   results table.


## Avatarlar (kim hangi görevi yapıyor)

`example ui base.png` mockup'ındaki gibi: her görev kartında sahibinin küçük
dairesel fotoğrafı görünür.

- **Fotoğraf `docs/assets/` içinde.** `gozde.jpg` (160px) + `gozde@2x.jpg`
  (320px, retina). Orijinal `gozde pp.png`'den yüze kare kırpıldı — 26px'lik
  bir dairede boy fotoğrafı tanınmaz oluyor.
- **Fotoğrafı olmayan kişi baş harflerini gösterir.** Berke şu an `BD` rozetiyle
  çıkıyor. Fotoğrafı gelince: kare kırpılmış `assets/berke.jpg` koy ve
  `data.js → people[]` içindeki `avatar: null` yerine `"assets/berke.jpg"` yaz.
  **Başka hiçbir yeri değiştirmen gerekmez** — beş görünüm de aynı
  `avatarHTML()` yardımcısını kullanıyor.
- **Renkli halka korundu.** Her avatarın çevresindeki 2px halka kişinin rengi
  (ML yeşil, BM mavi). Gantt zaten bu renk koduna dayanıyordu; fotoğraf
  eklemek bilgi kaybettirmesin diye halka bırakıldı.
- **Ortak görevler (`EK`) iki avatarı üst üste** gösterir — mockup'taki
  yığılmış avatar grubunun aynısı. Zaman çizelgesindeki bir İP çubuğu da
  o pakette çalışan **tüm** kişileri gösterir (`EK` görevi ikisini de sayar),
  bu yüzden İP1'de hem Berke hem Gözde çıkar: etiketleme Berke'nin, ama
  T1.4 (ön işleme + patch/fold bölme) yazılım işi.

- **Kart içerikleri ortalı** (KPI kutuları, görev kartları, pano özeti).
- **"Bu hafta" kırmızı çizgisi kaldırıldı** — hem özet çizelgeden hem Gantt'tan.
  Hangi hafta olduğumuz zaten sol üstteki KPI kutusunda ve alt bilgide yazıyor.

⚠ **`min-width:0` kuralına dokunmayın** (`styles.css`, `.grid > *`, `.card`,
`.scroll-x`). Grid/flex çocukları varsayılan `min-width:auto` ile içeriklerine
göre şişer; o kural olmadan 15 sütunlu zaman çizelgesi telefonda **tüm sayfayı**
yana kaydırıyordu. Çizelge kendi kutusunda kayar (`min-width:560px`).

⚠ **Gizlilik:** ücretsiz Pages herkese açık depo gerektirdiği için bu fotoğraf
push'tan sonra **herkese açık bir URL'de** yayında olur. İstemiyorsan
`assets/`'i `.gitignore`'a ekle — avatar otomatik olarak baş harflere düşer,
sayfa bozulmaz.

## Genel bakış paneli düzeni

Mockup'taki üç bölüm genel bakış sayfasında:
1. **Proje zaman çizelgesi** — iş paketi bazında özet. Her hafta için saydam
   bir kart var; üstteki W1…W15 başlıkları hangi sütunun hangi haftaya ait
   olduğunu gösterir. Sunum haftaları beyaz, vize taralı, final turkuaz
   (altta açıklama şeridi). Her İP çubuğu tek bir aralık (en erken başlangıç →
   en geç bitiş) ve **içinde o paketi kimin yaptığı avatar olarak** durur —
   yüzde ve hafta aralığı yazısı yok. Sol menüdeki *Zaman çizelgesi*
   görünümünden kasten daha kaba.
2. **Görev durumu** — donut.
3. **Görev panosu** — sütun başına 3 kart, avatar + ilerleme çubuğuyla özet.

## Etkileşim ve veritabanı (D11)

Site artık **yazılabilir**: görev durumu değiştirme, kendini göreve ekleme,
görev ekleme, not düşme. Hepsi `docs/data.txt`'ye bir satır yazar.

- **`data.js` = baseline (değişmez), `data.txt` = sadece sona eklenen olay
  günlüğü.** Sayfa her açılışta baseline'ı okur, üstüne olayları uygular. Yani
  ilerleme çubukları ve durum işaretleri **her yenilemede kayıttan geri gelir**.
- **Her olayın bir id'si var.** Yazma isteği gidip cevabı kaybolursa, tekrar
  denerken aynı olay ikinci kez eklenmez. Aynı id iki kez geçerse bir kez uygulanır.
- **Kaydetme:** soldaki kutudan "Token gir ve kaydet". Token **yalnızca o sekme
  açıkken** bellekte durur — kaydedilmez, sekme kapanınca silinir. GitHub →
  Settings → Developer settings → Fine-grained tokens, sadece bu depo,
  izin `Contents: Read and write`.
- **Tokensiz yol:** "Satırları kopyala" → GitHub'ın web editörü açılır → yapıştır
  → commit. Sıfır kimlik bilgisi.
- **`file://` ile açarsanız** paylaşım yok (tarayıcı `data.txt`'yi okumayı
  engeller): sayfa "Yerel mod" der ve değişiklikler sadece sizde kalır.
- Senkron durumları: `LOCAL_ONLY · SYNCED · PENDING · SYNCING · AUTH_REQUIRED ·
  ERROR`. `SYNCED` dışında sayfa asla "paylaşıldı" demez.

## Honest limitation: drag does not save

A static page **cannot write its own files.** Dragging a card updates in-memory
state and `localStorage` (so a refresh doesn't lose it), and the **"data.js
satırlarını kopyala"** button serialises the current tasks into pasteable lines.
Paste them over the `tasks` array and commit.

The v1 acceptance criterion *"drag updates the data file"* was therefore
impossible and has been removed. Leaving an unachievable checkbox in a spec is
how a tool starts feeling broken.

## What stops this being abandoned in week 4

The risk is **not** effort — it is already about ten lines a week. The risk is
that it has **no consumer**: two people who talk every day already know their
own status, so updating it benefits nobody *this week*.

The fix is the **Sunum view**. They must stand in front of an instructor six
times, and preparing that status slide is work they cannot skip. If the
dashboard *is* the slide, then updating `data.js` **replaces** presentation prep
instead of adding to it — the marginal cost of maintenance drops below zero.

Reinforced by:
- a **staleness banner** (green → amber → red, *"Son güncelleme: 12 gün önce"*),
  visible to anyone the link is shared with;
- giving the instructor the Pages link in **W2**. One external viewer is the
  cheapest recurring forcing function there is.

## Division of labour with the wiki — "one fact, one home"

| Kind of fact | Lives in |
|---|---|
| Task status, %, weeks, risk status, log entries | **`docs/data.js`** |
| Decision *rationale*, protocols, metric definitions, pipeline design | **markdown** |
| Decision *id + title + status* | duplicated in `data.js` as a 3-field **index** only |

**No generator script.** Parsing the markdown tables to build `data.js` sounds
elegant and is a trap: the parser breaks the first time a task title contains a
`|`, and it adds a build step that gets skipped in week 7 — after which the
dashboard goes stale *while still looking fresh*, which is worse than being
obviously out of date.

This is also why `03-SEMESTER-PLAN.md` is **frozen as a baseline** and its ASCII
Gantt was deleted: it was a second copy of the task list and had already drifted
(`T0.3` owned by `E` in one table and `G B` in the other) after a single week.

## Acceptance criteria

- [x] Opens by double-click from `file://` with no server and no console errors
- [x] Renders identically over HTTP (verified at `localhost:8000`)
- [x] Gantt marks SUNUM weeks, the midterm, the final, and the current week
- [x] Kanban groups by status; unscheduled İP7 tasks land in "Planlanmadı"
- [x] Drag updates state and exports pasteable `data.js` lines
- [x] SUNUM view shows demo + claim + fallback per presentation week
- [x] A syntax error in `data.js` shows a red banner with the line number,
      not a blank page
- [x] Usable at ~400 px width
- [ ] Published to GitHub Pages and the link shared with Berke *(pending `git init`)*

## Traps for the Pages push

- ⚠ **Free Pages needs a PUBLIC repo** → `Tuseb_2025_Basvuru_Eren.pdf` is already
  in `.gitignore`. **Verify before the first `git add`** — it is an unpublished
  grant application and scrubbing it from git history afterwards is painful.
- Relative paths only, no leading `/`. All filenames lowercase ASCII —
  `Styles.css` works on Windows and 404s on Pages' Linux.
- Save as **UTF-8 without BOM**. PowerShell's `>` and `Out-File` default to
  BOM-or-ANSI and will turn `Nöronal` into `NÃ¶ronal`.
- `.nojekyll` must exist, or Pages silently drops anything starting with `_`.
- `.gitattributes` pins `eol=lf`, or CRLF churn rewrites every line each week
  and destroys the merge-friendliness above.
- Pages caches ~10 minutes — Berke may need Ctrl+F5 after a push.
