# Sunum Çalışma Notu — PC12 Hücrelerinin Yapay Zekâ ile Otomatik Morfolojik Analizi

**Tarih:** 24 Eylül 2026 · **Ders:** ENG401 · **Toplam:** 13 slayt
**Sunum dosyası:** `AI-Based_Automated_Morphological_Analysis_PC12.html`

Bu not, sunumdaki **her yazıyı tek tek** açıklar. Her slaytta önce ekranda ne yazdığı
(slaytlar İngilizce olduğu için özgün hâliyle), hemen ardından **Türkçesi** ve o yazının
ne anlama geldiği verilmiştir.

> **Not:** Sunum İngilizce yapılacağı için ekrandaki ifadeler özgün hâlleriyle bırakıldı.
> Her birinin Türkçe karşılığı yanında yazıyor — böylece slayta bakınca hangi cümleyi
> anlattığınızı şaşırmazsınız.

> **Anlatım disiplini:** Projede henüz yapay zekâ sonucu yok. **Yapılanlar** (hücre açma,
> besiyeri hazırlama, sterilizasyon) ile **planlananlar** (NGF uygulaması, görüntüleme,
> model eğitimi) birbirine karıştırılmamalı. Slaytlar bu ayrımı renkle yapıyor:
> **yeşil = tamamlandı · sarı = devam ediyor · kehribar/kesikli çerçeve = planlandı.**

> **Bu sürümde ne değişti:** Eski 6. slayttaki on üç sekmeli pano kaldırıldı; yerine
> **iki slayt** geldi — 6. slayt hücre açmanın on adımını tek bir çizgi üzerinde,
> 7. slayt ise besiyerinin bileşimini ve steril tekniği gösteriyor. 3. slayttaki dört
> ölçüm kartı, ölçümlerin **gerçek bir mikroskop görüntüsü üzerinde** işaretlendiği bir
> şekille değiştirildi. 11. slayt (görüntüleme) üç numaralı aşamaya ayrıldı.
> Toplam slayt sayısı 12'den **13'e** çıktı.

---

## Slayt 1 — Kapak

| Ekrandaki yazı | Türkçesi ve anlamı |
|---|---|
| `ENG401 · PROJECT PRESENTATION` | "ENG401 · Proje Sunumu". Ders kodu ve sunum türü. Okunmaz, sadece bağlam verir. |
| `AI-Based Automated Morphological Analysis of PC12 Cell` | "PC12 Hücresinin Yapay Zekâ Temelli Otomatik Morfolojik Analizi". Üç parçası var: **AI-Based** = yapay zekâ temelli, **Automated Morphological Analysis** = otomatik şekil/morfoloji analizi, **PC12 Cell** = hedef hücre. Yani: PC12 hücrelerinin şekil değişimini yapay zekâ ile otomatik ölçmek. |
| `PROJECT TEAM` | "Proje Ekibi" |
| `Gözde Havin Fidan · Berke Dinç` | Projeyi yürüten iki kişi |
| `DATE` | "Tarih" |
| `24 September 2026` | 24 Eylül 2026 — sunum tarihi |

**Animasyon.** Ortadaki nöron görseli 4 saniyede çiziliyor: önce hücre gövdesi (soma),
sonra kollar (nöritler) sırayla uzuyor, her kolun ucunda bir nokta beliriyor. Bu noktalar
"tespit edilen uç noktaları" temsil ediyor — yani projenin ölçeceği şeyi. Ardından kollar
hafifçe salınmaya başlıyor, çekirdek sürekli hareket hâlinde.

**Açılış cümlesi önerisi:** "Projemiz, PC12 hücrelerinin NGF ile geçirdiği şekil değişimini
elle değil, görüntü üzerinden otomatik olarak ölçmeyi hedefliyor."

---

## Slayt 2 — `Presentation Outline` (Sunum İçeriği)

Altı kart, sunumun altı ana bölümü. Kartlara tıklanınca ilgili slayta atlar.

| Kart (ekranda) | Türkçesi | Alt yazı → Türkçesi | Atladığı slayt |
|---|---|---|---|
| **1 Project Objective** | Projenin Amacı | *Question and Measurements* → Araştırma sorusu ve ölçümler | 3 |
| **2 The PC12 Model** | PC12 Modeli | *Why PC12 and Why It Matters* → Neden PC12, neden önemli | 4 |
| **3 Work Completed** | Tamamlanan İşler | *Recovery, Medium and Sterile Work* → Hücre açma, besiyeri, steril çalışma | 5 |
| **4 Process Overview** | Süreç Genel Görünümü | *Workflow and Work Packages* → İş akışı ve iş paketleri | 8 |
| **5 Next Two Weeks** | Önümüzdeki İki Hafta | *Plan and Imaging Setup* → Plan ve görüntüleme düzeneği | 9 |
| **6 Project Team** | Proje Ekibi | *Team and Supervisors* → Ekip ve danışmanlar | 12 |

**Animasyon.** Daireler 1'den 6'ya doğru bir çizgiyle bağlanıyor (soldan sağa). Çizgi
tamamlandıktan sonra daireler yavaşça aşağı-yukarı oynamaya başlıyor. Renkler koyu
laciverten açık maviye giden **sıralı bir geçiş** — yani renk de sırayı anlatıyor,
rastgele seçilmemiş.

---

## Slayt 3 — `Project Objective and Research Question` (Projenin Amacı ve Araştırma Sorusu)

| Ekrandaki yazı | Türkçesi ve anlamı |
|---|---|
| `WHAT WE ARE BUILDING, AND WHY` | "Ne kuruyoruz ve neden". Üst etiket. |
| `Project Objective and Research Question` | "Projenin Amacı ve Araştırma Sorusu" |

### Araştırma sorusu

> *"Can morphological changes in PC12 cells following NGF treatment be quantified
> automatically and reproducibly from brightfield or phase-contrast images?"*

**Türkçesi:** "PC12 hücrelerinde NGF uygulaması sonrası oluşan morfolojik değişimler,
parlak alan veya faz kontrast görüntülerinden **otomatik** ve **tekrarlanabilir** şekilde
ölçülebilir mi?"

**Projenin tek cümlelik özü budur.** İki anahtar kelime:
- **automatically** = otomatik olarak, yani elle değil
- **reproducibly** = tekrarlanabilir şekilde, yani aynı görüntüden hep aynı sonuç

*Brightfield* (parlak alan) ve *phase-contrast* (faz kontrast), mikroskop görüntüleme
modlarıdır. Boyama gerektirmedikleri için canlı hücrede kullanılabilirler — bu yüzden
seçildiler.

### Üç kutu — problem, yaklaşım, çıktı

| Etiket | Ekrandaki yazı | Türkçesi ve anlamı |
|---|---|---|
| `THE PROBLEM` (Problem) | *Morphology is scored by eye — slow, subjective, not reproducible.* | "Morfoloji gözle puanlanıyor — yavaş, öznel, tekrarlanamaz." **Projenin var olma sebebi budur.** |
| `THE APPROACH` (Yaklaşım) | *Standardise culture and imaging, then quantify with a repeatable pipeline.* | "Önce kültürü ve görüntülemeyi standartlaştır, sonra tekrarlanabilir bir işlem hattıyla ölç." **Sıra önemli** — standart veri olmadan model kurulamaz. |
| `THE OUTCOME` (Çıktı) | *A traceable dataset and a method that compares before and after NGF.* | "İzlenebilir bir veri seti ve NGF öncesi/sonrasını karşılaştıran bir yöntem." |

### Ölçüm şekli — gerçek bir görüntü üzerinde

Eski dört kart kaldırıldı. Yerine **mevcut veri setinden alınmış gerçek bir floresan
mikroskop görüntüsü** kondu; tek bir hücrenin soması ve nöritleri çizilerek işaretlendi,
kalan hücreler soluk bırakıldı. Sağdaki dört başlık çizgilerle görüntüdeki karşılığına
bağlanıyor.

| Görüntüdeki işaret | Ekrandaki başlık | Türkçesi ve anlamı |
|---|---|---|
| Beyaz kontur (hücre gövdesinin çevresi) | **Soma** — *Count · area · shape · confluence* | "Sayı · alan · şekil · doluluk". *Confluence* = kabın yüzeyinin ne kadarının hücreyle kaplandığı. |
| Kırmızı çizgiler (uzantılar) | **Neurites** — *Count · length · orientation* | "Sayı · uzunluk · yönelim". |
| Kırmızı halka (dallanma noktası) | **Branching** | "Dallanma". Halkanın içindeki nokta gerçek bir çatallanmadır — nöritin ikiye ayrıldığı yer. |
| (işaret yok) | **Differentiation** — *Comparison across NGF conditions — control vs NGF days* | "Farklılaşma — NGF koşulları arasında karşılaştırma: kontrol ile NGF günleri." Aynı ölçümlerin gruplar arası karşılaştırması. |
| Alt şeritteki kırmızı satır | **Quality metadata** — *Well · position · replicate · acquisition settings* | "Kalite üstverisi — kuyucuk · konum · tekrar · çekim ayarları." |

**Görüntünün üstündeki ve altındaki yazılar:**

| Ekrandaki yazı | Türkçesi ve anlamı |
|---|---|
| `CLASSICAL THRESHOLD + SKELETON` / `ILLUSTRATIVE, NOT OUR MODEL` | "Klasik eşikleme + iskeletleme / Açıklayıcıdır, bizim modelimiz değildir." **Bu uyarıyı atlamayın.** Görüntüdeki çizgiler bir yapay zekâ çıktısı değil; ölçümün neye benzediğini göstermek için klasik görüntü işlemeyle üretilmiş. |
| `SNAP-9626.CZI · 12 AUG 2025 · FLUORESCENCE · 18 ms` | Dosyanın **kaydettiği** üstveri: dosya adı, tarih, görüntüleme modu, pozlama süresi. |
| `WELL — · POSITION — · REPLICATE —` (kırmızı) | Dosyanın **kaydetmediği** üstveri: kuyucuk, konum, tekrar. Tireler "boş" demek. |

> **Slaytın en güçlü noktası burası.** Kalite üstverisinin neden bir "ölçüm" sayıldığı
> soyut bir iddia değil: ekrandaki gerçek dosya adı, tarihi, modu ve pozlamayı
> kaydediyor; ama hangi kuyucuktan, hangi konumdan, hangi tekrardan geldiğini
> kaydetmiyor. Kırmızı satır tam olarak bu eksiği gösteriyor. Kuracağımız yeni protokol
> bu üç alanı da zorunlu kılacak.

> **Ölçek uyarısı:** Bu görüntüde objektif bilgisi kayıtlı değil ve dosyadaki piksel
> ölçeği güvenilir değil. Bu yüzden **henüz mikrometre cinsinden bir değer vermiyoruz** —
> ölçümler şimdilik piksel düzeyinde konuşuluyor.

**Animasyon.** Önce somaların beyaz konturları çiziliyor, ardından nöritler uçlarına
doğru uzuyor, sonra dallanma noktaları beliriyor ve en son bağlantı çizgileri sağdaki
başlıklara doğru çiziliyor. Sıra bilinçli: önce ne ölçüldüğü, sonra adı.

---

## Slayt 4 — `The PC12 Model` (PC12 Modeli)

| Ekrandaki yazı | Türkçesi ve anlamı |
|---|---|
| `WHY PC12, AND WHY THIS MATTERS` | "Neden PC12 ve bu neden önemli". Üst etiket. |
| `The PC12 Model` | "PC12 Modeli" |
| *"PC12 is a rat adrenal pheochromocytoma cell line. Given NGF, it stops dividing and extends neurites, adopting a sympathetic neuron-like phenotype."* | **Slaytın ana cümlesi.** "PC12, sıçan böbrek üstü bezi feokromositomasından türetilmiş bir hücre hattıdır. NGF verildiğinde bölünmeyi bırakır, nörit uzatır ve **sempatik nöron benzeri bir fenotip** kazanır." *Feokromositoma* = böbrek üstü bezi tümörü. *NGF (Nerve Growth Factor)* = Sinir Büyüme Faktörü. **Projenin biyolojik dayanağı budur.** |

| # | Ekrandaki başlık | Ekrandaki yazı | Türkçesi ve anlamı |
|---|---|---|---|
| 1 | **The Model** (Model) | *Inexpensive, fast-growing and reproducible. It gives a neuronal readout without primary neuron culture.* | "Ucuz, hızlı çoğalan ve tekrarlanabilir. Primer nöron kültürü olmadan nöronal bir okuma sağlar." Gerçek nöron kültürü (*primary neuron culture*) zor ve pahalıdır — PC12 bu yükü ortadan kaldırır. |
| 2 | **The Signal** (Sinyal) | *NGF drives neurite outgrowth. Length, count and branching change measurably — that change is the data.* | "NGF nörit uzamasını tetikler. Uzunluk, sayı ve dallanma **ölçülebilir şekilde** değişir — işte veri bu değişimdir." |
| 3 | **Why It Matters** (Neden önemli) | *Neurite outgrowth is a standard readout in neurotoxicity and drug screening. Scoring it by hand is the bottleneck.* | "Nörit uzaması, nörotoksisite ve ilaç taramasında **standart bir ölçüttür**. Elle puanlamak ise darboğazdır." Otomatikleştirmek bu darboğazı açar. |

> **Vurgulanacak nokta:** Bu slayt "biz neden uğraşıyoruz" sorusunun cevabıdır. Sadece bir
> ders projesi değil — nörotoksisite testi ve ilaç taraması gibi gerçek uygulamaları olan
> bir ölçüm probleminden bahsediyoruz.

---

## Slayt 5 — `Work Completed` (Tamamlanan İşler — Bölüm Ayracı)

Ara geçiş slaytı; yeni bir bölüme girildiğini belirtir.

| Ekrandaki yazı | Türkçesi ve anlamı |
|---|---|
| `01` | Bölüm numarası (birinci bölüm) |
| `PROJECT STATUS` | "Proje Durumu" |
| `Work Completed` | "Tamamlanan İşler" |
| `Cell Recovery` | "Hücre Açma" — alt şeritteki üç konudan ilki (6. slayt) |
| `Medium Preparation` | "Besiyeri Hazırlama" — 7. slayt |
| `Sterile Technique` | "Steril Teknik" — 7. slayt |

**Ne söylenecek:** "Şimdi laboratuvarda fiilen ne yaptığımıza geçiyorum."

---

## Slayt 6 — `23 September: PC12 Cells Are Back in Culture` (23 Eylül: PC12 Hücreleri Yeniden Kültürde)

Hücre açmanın **on adımı tek bir çizgi üzerinde**. Her adımın üstünde bir simge, altında
numarası ve adı var. Sağ ok tuşu adımları sırayla açar; bir adıma **tıklayarak** da
doğrudan gidebilirsiniz (aynı adıma ikinci kez tıklamak genel görünüme döner).

| Ekrandaki yazı | Türkçesi ve anlamı |
|---|---|
| `LABORATORY RECORD · 23 SEPTEMBER 2026` | "Laboratuvar Kaydı · 23 Eylül 2026" — sunumdan bir gün öncesine ait |
| `23 September: PC12 Cells Are Back in Culture` | "23 Eylül: PC12 hücreleri yeniden kültürde" |
| `Use → to walk through the ten steps, or click any step on the line.` | "On adımı gezmek için sağ oku kullanın veya çizgideki herhangi bir adıma tıklayın." Sunumu yapan için not; izleyici okumak zorunda değil. |

### Çizginin altındaki `DMSO 10%` bandı

Bandın kendisi bir veri: **kalınlığı DMSO derişimini** gösteriyor.

| Ekrandaki yazı | Türkçesi ve anlamı |
|---|---|
| `DMSO 10%` | Bandın 2. adımda başladığı yerdeki derişim: %10 |
| `Toxic to the cells once warm` | "Isındığı anda hücreye toksiktir" — bandın kalın olduğu bölge (adım 2–3) |
| `Diluting` | "Seyreliyor" — bandın incelmeye başladığı bölge (adım 4–6) |
| `Removed` | "Uzaklaştırıldı" — bandın bittiği yer, 7. adım |

> **Bandı okumayı öğretin:** "Adım 2 ile 7 arasındaki her şey tek bir işi yapıyor —
> DMSO'yu seyreltmek, çöktürmek ve dökmek." Bir adımı seçtiğinizde bandın üzerinde
> kehribar bir işaretçi o adıma kayar.

### Genel görünüm kartı (henüz hiçbir adım seçili değilken)

| Ekrandaki yazı | Türkçesi |
|---|---|
| *Frozen vial to seeded flask in one session.* | "Donmuş şişeden ekilmiş flaska, tek seansta." |
| *Steps 2 to 7 are about the DMSO: dilute it, spin, then pour it off.* | "2'den 7'ye kadarki adımlar DMSO ile ilgilidir: seyrelt, santrifüjle, sonra dök." |
| `−80 °C` / `FREEZER · STEP 2` | Dondurucu sıcaklığı — 2. adım |
| `90% FBS + 10% DMSO` / `CRYOMEDIUM · STEP 2` | Dondurma ortamı — 2. adım |
| `1,250 rpm / 7 min` / `CENTRIFUGE · STEP 6` | Santrifüj parametreleri — 6. adım |
| `37 °C / 5% CO₂` / `INCUBATOR · STEP 10` | İnkübatör koşulları — 10. adım |
| `Every 3 days` / `MEDIUM RENEWAL` | Besiyeri yenileme sıklığı |

### On adım

| # | Ekrandaki başlık | Türkçesi | `WHAT` / `WHY` ve sağdaki değer |
|---|---|---|---|
| 1 `Pre-warm` | *Pre-warm the medium* | Besiyerini ön ısıt | Besiyeri, **şişe dondurucudan çıkmadan önce** hazırlanır ve 37 °C'ye getirilir. Aksi hâlde çözülen hücreler DMSO içinde bekler. → `MEDIUM 37 °C` |
| 2 `Out of −80 °C` | *Vial out of the freezer* | Şişe dondurucudan çıkarıldı | 1 mL kriyovial. Hücreler %90 FBS + %10 DMSO içinde donduruldu (mL başına 900 + 100 µL). DMSO buz kristali hasarını önler ama ısındığında toksiktir. → `STORED AT −80 °C` |
| 3 `Thaw` | *Thaw in the hand* | Elde çözdürüldü | Buz eriyene kadar elde tutuldu. **Not:** standart yöntem 37 °C su banyosudur ve daha hızlıdır; yavaş çözdürme DMSO temasını uzatır. → `OURS · SLOWER: in the hand` / `STANDARD · FASTER: 37 °C water bath` |
| 4 `Dilute` | *Dilute in the vial* | Şişenin içinde seyreltildi | Besiyeri pipetle şişeye eklenip çekip bırakarak karıştırıldı. DMSO **tam hücrenin bulunduğu yerde** seyrelmeye başlar. → `DMSO: diluting` |
| 5 `Transfer` | *Transfer to a Falcon tube* | Falcon tüpe aktarıldı | İçinde zaten besiyeri bulunan falcona aktarıldı — seyrelme tersine dönmesin, devam etsin diye. → `DMSO: still diluting` |
| 6 `Spin` | *Centrifuge* | Santrifüjlendi | **1250 rpm, 7 dakika.** Hücreler dipte pelet hâlinde toplanır; böylece DMSO'yu taşıyan sıvıdan ayrılırlar. → `SPIN 1,250 rpm / 7 min` |
| 7 `Pour off` | *Pour off the supernatant* | Üstteki sıvı döküldü | Süpernatan dökülür, pelet tüpte kalır. Kalan DMSO bu sıvıyla birlikte gider. **Santrifüjün amacı buydu.** → `DMSO: removed` |
| 8 `Rinse flask` | *Rinse the flask* | Flask yıkandı | Kültür flaskına PBS eklenir, kapağı kapatılıp taban boyunca çalkalanır, sonra boşaltılır. → `RINSE WITH PBS` |
| 9 `Resuspend` | *Resuspend the pellet* | Pelet süspanse edildi | Pelet taze besiyeri içinde **yavaş pipetlemeyle** dağıtılır. Amaç topak değil tekil hücre süspansiyonu — sağdaki şekil topaklardan tekil hücrelere geçişi gösteriyor. |
| 10 `Seed` | *Seed and incubate* | Ekildi ve inkübe edildi | Flask etiketlenir, ekilir ve 37 °C, %5 CO₂ inkübatöre kaldırılır. Bundan sonra besiyeri 3 günde bir yenilenir. → `INCUBATOR 37 °C / 5% CO₂` |

> **On adımın mantığı tek cümlede:** Her adım, hücrenin DMSO ile geçirdiği süreyi
> kısaltmak ve onu bir an önce normal besiyerine kavuşturmak üzerine kuruludur.

> ⚠️ **Teyit edilecek:** Bu kayıt, besiyerinin şişe dondurucudan çıkmadan **önce**
> hazırlanıp ısıtıldığını söylüyor (1. adım). Daha eski notlarda sıranın tersine
> işlediği yazıyordu. Sunumdan önce laboratuvar defterinden doğrulayın; ters işlediyse
> 1. adımda bunu açıkça söyleyin.

---

## Slayt 7 — `What the Cells Live In, and How We Keep It Clean` (Hücreler Neyin İçinde Yaşıyor ve Onu Nasıl Temiz Tutuyoruz)

Slayt ikiye bölünmüş: solda **besiyerinin bileşimi**, sağda **steril teknik**.

### Solda — `50 mL Growth Medium` (50 mL büyüme besiyeri)

Bileşim, **üç kademeli bir orantı çubuğu** olarak çizildi. Her kademe bir öncekinin küçük
kalan kısmını büyütür; böylece %0,1'lik gentamisin bile görülebilir hâle gelir.

| Kademe | Ne gösteriyor | Büyütme |
|---|---|---|
| 1. çubuk | Partinin **tamamı** (50,05 mL), gerçek oranlarda. Soldaki ince renkli dilimler RPMI dışındaki her şey. | — |
| 2. çubuk | RPMI dışındaki 6,55 mL büyütülmüş hâli | `ZOOM ×7.6` |
| 3. çubuk | L-glutamin + gentamisin (0,55 mL) bir kez daha büyütülmüş hâli | `ZOOM ×11.9` |

**Formülasyon (ekranda yazan değerler):**

| Bileşen | Hacim | Oran | Ne işe yarar |
|---|---|---|---|
| RPMI-1640 | 43,5 mL | %87 | Temel besi ortamı (tuz, şeker, amino asit, vitamin) |
| Horse serum (At serumu) | 3,5 mL | %7 | Büyüme faktörü kaynağı — PC12 için standart |
| FBS (Fetal sığır serumu) | 2,5 mL | %5 | İkinci büyüme faktörü kaynağı |
| L-Glutamine (L-Glutamin) | 500 µL | %1 | Amino asit kaynağı |
| Gentamicin (Gentamisin) | **50 µL** | %0,1 | Antibiyotik — uzun kültür süresinde bakteri kontrolü |

**Toplam: 50,05 mL** — yani 50 mL hedefiyle uyumlu.

> ⚠️ **Eski sürümdeki tutarsızlık düzeltildi.** Önceki slaytta gentamisin 0,5 mL (%1)
> yazıyordu; toplam 50,5 mL ve yüzdeler %101 çıkıyordu, bu yüzden slaytta turuncu bir
> uyarı kutusu duruyordu. Yeni kayıt gentamisini **50 µL (%0,1)** olarak veriyor ve
> toplam 50,05 mL'ye, yüzdeler de %100'e oturuyor. Uyarı kutusu bu yüzden kaldırıldı.
> **Sunumdan önce bu değeri laboratuvar defterinden bir kez daha teyit edin.**

**Çubukların yanındaki yazılar:**

| Ekrandaki yazı | Türkçesi ve anlamı |
|---|---|
| `base medium` | "Temel besiyeri" — RPMI diliminin sağındaki etiket |
| `Serum, 12% in total: growth factors` | "Serum, toplamda %12: büyüme faktörleri." At serumu %7 + FBS %5. |
| `added fresh: degrades in storage` | "Taze eklenir: bekletilirken bozunur." **L-glutaminin neden ayrı eklendiğinin cevabı.** |
| `Gentamicin 50 µL` / `antibiotic cover` | "Gentamisin 50 µL / antibiyotik koruma" |
| `CRYOMEDIUM 90% FBS + 10% DMSO` | "Dondurma ortamı: %90 FBS + %10 DMSO." Büyüme besiyeriyle karıştırılmasın diye aynı çubuk diliyle, küçük olarak en altta gösteriliyor. |

**Animasyon.** Üç çubuk sırayla soldan sağa açılıyor; her çubuk açıldıktan sonra onu bir
sonrakine bağlayan büyütme hunisi beliriyor. Yani ekran, büyütme sırasını kendisi
anlatıyor.

### Sağda — `Sterile Technique` (Steril teknik)

Üç katmanlı, yukarıdan aşağı okunacak şekilde numaralandırılmış.

| # | Başlık | Ekrandaki yazı | Türkçesi ve anlamı |
|---|---|---|---|
| 1 | `Cabinet` (Kabin) | *UV cycle before the session* · *HEPA laminar flow running throughout* · *70% ethanol wipe, before and after* | "Seans öncesi UV döngüsü · HEPA laminer akış çalışma boyunca açık · önce ve sonra %70 etanolle silme." Akışın açık kalmasının sebebi: filtrelenmiş hava dışarı doğru aktığı için filtresiz hava içeri giremez. |
| 2 | `Entry` (Girişte kontrol) | *Every bottle, pipette, tube and rack: 70% ethanol on the way in* | "Her şişe, pipet, tüp ve rak girerken %70 etanolle silinir." Amaç: hiçbir malzemenin kontaminasyonu hava perdesinin içine taşımaması. |
| 3 | `Handling` (Elleçleme) | *Sterile single-use consumables* · *Never over an open vessel; close it after each transfer* · *Gloves re-sterilised between steps* | "Steril tek kullanımlık sarf malzeme · asla açık kabın üzerinden geçme, her aktarımdan sonra kapat · adımlar arasında eldiveni yeniden sterilize et." Açık kabın üzerinden el geçirilmemesinin sebebi: elden düşecek partikül doğrudan içeri düşer. |

> **Sorulursa:** %70 etanol saf etanolden daha etkilidir, çünkü içindeki su proteinin
> denatüre olmasına yardım eder. Saf etanol yüzeyde hızla buharlaşır ve hücre duvarına
> nüfuz edemez.

---

## Slayt 8 — `Process Overview` (Süreç Genel Görünümü)

| Ekrandaki yazı | Türkçesi |
|---|---|
| `END-TO-END WORKFLOW` | "Baştan sona iş akışı" |
| `Process Overview` | "Süreç Genel Görünümü" |

İki ayrı iz (track) var. **Numaralar her izde 1'den başlar**, bu yüzden konuşurken hangi
izden bahsettiğinizi belirtin.

### `EXPERIMENTAL TRACK · BME · LABORATORY` — Deneysel iz (Biyomedikal / laboratuvar)

| Paket | Ekrandaki adım | Türkçesi | Durum |
|---|---|---|---|
| WP1 | Planning | Planlama | `DONE` = Tamamlandı (yeşil) |
| WP2 | Cell Recovery | Hücre açma | `DONE` = Tamamlandı (yeşil) |
| WP3 | Cell Culture | Hücre kültürü | `ONGOING` = Devam ediyor (sarı) — **şu an buradayız** |
| WP4 | NGF Treatment | NGF uygulaması | `PLANNED` = Planlandı (kesikli çerçeve) |
| WP5 | Imaging | Görüntüleme | `PLANNED` = Planlandı (kesikli çerçeve) |

**Animasyon.** Tamamlanan ve devam eden kartlar, planlanan kartlarla aynı görünümde
başlar; sonra aşağıdan yukarı **sıvı gibi dolarlar** ve ancak dolduktan sonra çerçeveleri,
rozetleri ve etiketleri yeşile/sarıya döner. Yani ekran "bu durum kazanıldı" diyor.

### `COMPUTATIONAL TRACK · EEE · GANTT WEEKS 2–15` — Hesaplama izi (Elektrik-Elektronik)

Bu paketler **Gantt chart dosyasından** alınmıştır; hafta aralıkları da oradan gelir.
Hepsi henüz **planlanmış** durumdadır.

| Paket | Ekrandaki iş | Türkçesi ve anlamı | Hafta |
|---|---|---|---|
| WP1 | Preprocessing of Existing Dataset | Mevcut veri setinin ön işlenmesi — temizleme, yeniden etiketleme, veri çoğaltma (augmentasyon), veri bölme | 3–4 |
| WP2 | New Dataset Preparation | Yeni veri setinin hazırlanması (etiketleme) — bizim çekeceğimiz görüntüler | 9–11 |
| WP3 | Segmentation | Segmentasyon — görüntüde hücre ve nöritin piksel piksel ayrılması | 5–11 |
| WP4 | Post-processing & Analysis | Son işleme ve analiz — özellik çıkarımı, metrikler, hata analizi | 9–13 |
| WP5 | XAI | Açıklanabilir yapay zekâ — modelin kararını gerekçelendirmesi | 5–13 |
| WP6 | Interface Development | Arayüz geliştirme — masaüstü arayüz, rapor modülü, entegrasyon, test | 9–15 |

**Lejant:** `Completed` = Tamamlandı (yeşil) · `Ongoing` = Devam ediyor (sarı) ·
`Planned` = Planlandı (kehribar, kesikli)

> **Vurgu:** Deneysel iz ilerliyor, hesaplama izi henüz başlamadı. **Hesaplama izi
> deneysel izin verisini bekliyor** — WP2 (yeni veri seti) 9. haftada, çünkü o zamana
> kadar standart görüntü setinin oluşması gerekiyor.

---

## Slayt 9 — `Next Two Weeks` (Önümüzdeki İki Hafta — Bölüm Ayracı)

| Ekrandaki yazı | Türkçesi |
|---|---|
| `02` | Bölüm numarası (ikinci bölüm) |
| `UPCOMING WORK` | "Gelecek işler" |
| `Next Two Weeks` | "Önümüzdeki İki Hafta" |
| `Culture Monitoring` | "Kültür takibi" |
| `AI Method Research` | "Yapay zekâ yöntem araştırması" |
| `Imaging Setup` | "Görüntüleme düzeneğinin kurulumu" |

---

## Slayt 10 — `Plan for the Next Two Weeks` (İki Haftalık Plan)

| Ekrandaki yazı | Türkçesi |
|---|---|
| `PLANNED ACTIVITIES` | "Planlanan faaliyetler" |
| `Plan for the Next Two Weeks` | "Önümüzdeki İki Haftanın Planı" |

### `WEEK 1` — 1. Hafta

| # | Ekrandaki yazı | Türkçesi ve anlamı |
|---|---|---|
| 1 | *Monitor attachment, viability and confluence* | "Tutunma, canlılık ve doluluğu izle." *Attachment* = hücrenin kap yüzeyine yapışması; yapışmayan hücre sağlıklı değildir. |
| 2 | *Renew the medium every 3 days* | "Besiyerini 3 günde bir yenile." Hücre besini tüketir, atık birikir. 23 Eylül ekimine göre ilk yenilemeler 26 ve 29 Eylül. |
| 3 | *Check for contamination at every inspection* | "Her kontrolde kontaminasyona bak." Belirtiler: bulanıklık, renk değişimi, hareketli partikül. |
| 4 | *Log every medium batch and renewal in the laboratory record* | "Her besiyeri partisini ve yenilemeyi laboratuvar kaydına işle." Bileşim artık tutarlı (Slayt 7); buradaki iş **izlenebilirliği sürdürmek** — hangi parti, hangi gün. |

### `WEEK 2` — 2. Hafta

| # | Ekrandaki yazı | Türkçesi ve anlamı |
|---|---|---|
| 1 | *Continue the 3-day monitoring and medium renewal* | "Üç günlük takibe ve besiyeri yenilemeye devam et." |
| 2 | *Keep morphology records consistent between sessions* | "Morfoloji kayıtlarını seanslar arasında tutarlı tut." Yani **aynı büyütme, aynı alan, aynı format** — sonraki veri setinin temeli budur. |
| 3 | *Literature review of candidate AI segmentation models* | "Aday yapay zekâ segmentasyon modellerinin literatür taraması." Gantt'taki nnU-Net, DS-UNet, ViT-UNet gibi seçenekler. |
| 4 | *Build the imaging setup and run manipulator trials* | "Görüntüleme düzeneğini kur ve manipülatör denemelerini yap." |

> **Planın mantığı:** 1. hafta tamamen kültürün sağlığı üzerine. 2. hafta aynı takip
> sürerken paralelde yapay zekâ araştırması ve düzenek kurulumu başlıyor.
> **Mikroskopla asıl çekim bu iki haftada yok** — bir sonraki slaytta bu açıkça söyleniyor.

---

## Slayt 11 — `Micromanipulator-Assisted Whole-Well Imaging` (Mikromanipülatör Destekli Tam-Kuyucuk Görüntüleme)

| Ekrandaki yazı | Türkçesi ve anlamı |
|---|---|
| `INFRASTRUCTURE TO BE BUILT` | "Kurulacak altyapı" — **yani bu henüz yapılmadı** |
| `Micromanipulator-Assisted Whole-Well Imaging` | "Mikromanipülatör Destekli Tam-Kuyucuk Görüntüleme" |
| *"Instead of one hand-picked field, the well is moved beneath a fixed field of view and scanned tile by tile, so the whole well is covered."* | "Elle seçilmiş tek bir alan yerine, kuyucuk **sabit** bir görüş alanının altında hareket ettirilir ve karo karo taranır; böylece kuyucuğun tamamı kaydedilir." **Yöntemin özü budur.** |

Slayt **üç numaralı aşamaya** bölünmüştür; soldan sağa, sonra aşağı okunur.

### `01 Position the well` — Kuyucuğu konumla

| Ekrandaki etiket | Türkçesi ve anlamı |
|---|---|
| `MICROSCOPE` | "Mikroskop" — sabit duran objektif. **Hareket eden mikroskop değil, plakadır.** |
| `XY MANIPULATOR` | "XY manipülatör" — plakayı X ve Y ekseninde hareket ettiren düzenek. Animasyonda kol yatayda uzayıp kısalıyor, dikeyde yukarı-aşağı gidiyor; hareketi plakayla senkron. |
| (kırmızı çerçeveli kuyucuk) | Hedef kuyucuk — objektifin tam altına getirilen kuyucuk |
| `NEXT TWO WEEKS` — *No acquisition yet: we build the stage and mounting, and run XY positioning trials.* | "Önümüzdeki iki hafta — henüz çekim yok: tablayı ve montajı kuruyoruz, XY konumlandırma denemeleri yapıyoruz." **Bu cümleyi atlamayın.** |

### `02 Scan tile by tile` — Karo karo tara

| Ekrandaki etiket | Türkçesi ve anlamı |
|---|---|
| (yuvarlak kuyucuk görünümü) | Hedef kuyucuğun büyütülmüş hâli |
| (kırmızı kare) | Sabit görüş alanı (*fixed field of view*). Plaka altında kayarken her konumda flaş çakar — çekim anı. |
| `3 × 3 GRID` — *Illustrative. The final grid follows from well diameter, field of view and overlap.* | "3 × 3 ızgara — açıklayıcıdır. Gerçek ızgara kuyucuk çapı, görüş alanı ve örtüşmeden hesaplanacaktır." |

> **Not:** Tarama her konumda **durur**, sonra çekim yapılır. Hareket hâlinde çekim
> yapılmaz — animasyon da buna göre kurgulanmıştır.

### `03 Assemble the well` — Kuyucuğu birleştir

| Ekrandaki etiket | Türkçesi ve anlamı |
|---|---|
| `01` – `09` | Dokuz tarama konumundan biriken dokuz kare. Şerit soldan sağa dolar. |
| `WHY` — *Every tile carries the position it was taken from, so the well is reconstructed from a known grid instead of one representative field.* | "Neden — her karo, alındığı konumu da taşır; böylece kuyucuk temsili tek bir alandan değil, **bilinen bir ızgaradan** yeniden kurulur." |

> **3. slaytla bağlantı:** 3. slaytta eksik olduğunu gösterdiğimiz `WELL · POSITION ·
> REPLICATE` üstverisini üreten şey tam olarak budur. İki slayt birbirinin cevabıdır —
> bunu söylemek sunumu bağlar.

> **Soru gelirse — "Neden 3×3?"**
> "Çizim için seçilmiş bir örnek. Gerçek sayı kuyucuk çapı, objektifin görüş alanı ve
> kareler arası örtüşme oranından hesaplanacak."

---

## Slayt 12 — `Project Team` (Proje Ekibi)

Dört eşit fotoğraf, yan yana.

| Ekrandaki etiket | Kişi | Ekrandaki bölüm | Türkçesi |
|---|---|---|---|
| `PROJECT TEAM` (Proje ekibi) | **Gözde Havin Fidan** | Electrical and Electronics Engineering | Elektrik-Elektronik Mühendisliği |
| `PROJECT TEAM` (Proje ekibi) | **Berke Dinç** | Biomedical Engineering | Biyomedikal Mühendisliği |
| `SUPERVISOR` (Danışman) | **Volkan Kılıç** | Project Supervisor | Proje danışmanı |
| `SUPERVISOR` (Danışman) | **Mustafa Şen** | Project Supervisor | Proje danışmanı |

> **Bağlantı kurun:** Bu ikili yapı, Slayt 8'deki iki izle birebir örtüşüyor —
> **EEE izi** hesaplama/yapay zekâ tarafını, **BME izi** deneysel/laboratuvar tarafını
> yürütüyor.

---

## Slayt 13 — `Thank You` (Teşekkürler)

| Ekrandaki yazı | Türkçesi |
|---|---|
| `ENG401 · PROJECT PRESENTATION` | "ENG401 · Proje Sunumu" |
| `Thank You` | "Teşekkürler" |
| `AI-Based Automated Morphological Analysis of PC12 Cell` | Proje başlığı tekrar |
| `PROJECT TEAM` / Gözde Havin Fidan · Berke Dinç | "Proje ekibi" |
| `SUPERVISORS` / Volkan Kılıç · Mustafa Şen | "Danışmanlar" |
| `Questions` | "Sorular" — soru bölümüne geçiş |
| `İZMİR KÂTİP ÇELEBİ UNIVERSITY · 24 SEPTEMBER 2026` | "İzmir Kâtip Çelebi Üniversitesi · 24 Eylül 2026" |

---

## Hızlı Referans — Akılda Tutulacak Sayılar

| Konu | Değer |
|---|---|
| Dondurma ortamı | %90 FBS + %10 DMSO (1 mL = 900 µL + 100 µL) |
| Saklama sıcaklığı | −80 °C |
| Besiyeri | RPMI 43,5 mL / At serumu 3,5 mL / FBS 2,5 mL / L-Glutamin 500 µL / Gentamisin 50 µL |
| Besiyeri toplam hacmi | 50,05 mL (hedef 50 mL) |
| Toplam serum oranı | %12 (at serumu %7 + FBS %5) |
| Santrifüj | 1250 rpm · 7 dakika |
| İnkübatör | 37 °C · %5 CO₂ |
| Besiyeri yenileme | 3 günde bir |
| Yüzey sterilizasyonu | %70 etanol |
| Görüntüleme kabı | 6 kuyucuklu plaka |
| Örnek tarama ızgarası | 3 × 3 (kesin değil) |
| Gantt süresi | Hafta 2 – Hafta 15 |
| Hücre açma tarihi | 23 Eylül 2026 |
| Örnek görüntü dosyası | `SNAP-9626.CZI` · 12 Ağu 2025 · floresan · 18 ms |

---

## Sıkça Gelebilecek Sorular

**"Sonuçlarınız nerede?"**
Henüz yok ve bunu slaytlarda saklamıyoruz. Şu an deneysel altyapıyı ve veri standardını
kurma aşamasındayız. Hesaplama izi (Slayt 8), standart görüntü seti oluştuktan sonra
başlıyor — bu yüzden WP2 9. haftada konumlandırılmış.

**"Slayt 3'teki görüntüyü siz mi ürettiniz, model mi?"**
Model değil. Görüntü mevcut veri setinden; üzerindeki konturlar klasik eşikleme ve
iskeletleme ile çizildi. Slaytta bunu açıkça yazıyoruz: *illustrative, not our model*.
Amaç, hangi büyüklüklerin ölçüleceğini gerçek bir hücre üzerinde göstermek.

**"Neden mikrometre cinsinden değer vermiyorsunuz?"**
Çünkü o görüntüde objektif bilgisi kayıtlı değil ve dosyadaki piksel ölçeği güvenilir
değil. Kuracağımız yeni protokol objektif ve ölçek bilgisini zorunlu kılacak; o zamana
kadar ölçümleri piksel düzeyinde konuşuyoruz.

**"Besiyeri hacimleri tutuyor mu?"**
Evet. RPMI 43,5 + at serumu 3,5 + FBS 2,5 + L-glutamin 0,5 + gentamisin 0,05 = **50,05 mL**,
yani 50 mL hedefiyle uyumlu. Önceki sürümde gentamisin sehven 0,5 mL yazılmıştı ve
toplam 50,5 çıkıyordu; kayıt düzeltildi.

**"Neden gerçek nöron kullanmıyorsunuz?"**
Primer nöron kültürü zor, pahalı ve tekrarlanabilirliği düşüktür. PC12, NGF ile nöron
benzeri fenotip kazanan standart bir model hattıdır ve nörit uzaması literatürde kabul
görmüş bir ölçüttür.

**"Neden tüm kuyucuğu tarıyorsunuz, tek alan yetmez mi?"**
Tek alan seçmek, seçimi yapan kişiye bağlı bir önyargı (bias) yaratır. Tam kuyucuk
taraması bu seçimi ortadan kaldırır ve istatistiği tüm popülasyon üzerinden kurar. Ayrıca
her karo kendi konumuyla kaydedildiği için sonuç izlenebilir olur.

**"Hangi yapay zekâ modelini kullanacaksınız?"**
Henüz seçilmedi. Önümüzdeki iki haftanın işlerinden biri, aday segmentasyon modellerinin
literatür taramasıdır (Slayt 10, 2. hafta). Gantt'ta nnU-Net, DS-UNet ve ViT-UNet gibi
adaylar değerlendiriliyor.

**"Veriyi nasıl böleceksiniz?"**
Biyolojik tekrar (*biological replicate*) düzeyinde. Aynı kuyucuktan veya aynı çekim
seansından gelen görüntüler eğitim ve test setlerine dağıtılmamalıdır — aksi hâlde model
olduğundan daha başarılı görünür. Buna **veri sızıntısı** (*data leakage*) denir.
