# Sunum Konuşma Metni — Slayt Sırasına Göre

**Ders:** ENG401 · **Tarih:** 24 Eylül 2026 · **13 slayt** · **Tahmini süre: 13–15 dakika**

Bu dosya sunum sırasında **okumak** içindir. Her slayt `##` ile ayrılmıştır.
Her slaytta iki bölüm var:

- **Anlatman gerekenler** — o slaytta mutlaka geçmesi gereken noktalar
- **Kuracağın cümleler** — doğrudan söyleyebileceğin hazır cümleler

> **Slaytlar İngilizce, konuşma Türkçe.** Ekrandaki İngilizce başlıklar metinde
> `bu biçimde` gösterildi ki hangi yazıdan bahsettiğini şaşırmayasın.

> **Geçiş kontrolü:** Sağ ok ileri, sol ok geri. **Slayt 6'da sağ ok önce on adımı
> gezer**, hepsi bittikten sonra 7. slayta geçer. Çizgideki adıma tıklayarak istediğine
> doğrudan atlayabilirsin — adımları tek tek gezmek zorunda değilsin. Aynı adıma ikinci
> kez tıklamak genel görünüme döner.

---

## Slayt 1 — Kapak (≈40 sn)

**Anlatman gerekenler**
- Projenin adı ve tek cümlelik amacı
- Ekip ve ders bağlamı
- Uzun tutma — asıl içerik sonra

**Kuracağın cümleler**

> Herkese merhaba. Projemizin adı **PC12 Hücresinin Yapay Zekâ Temelli Otomatik
> Morfolojik Analizi**.
>
> Tek cümleyle anlatmak gerekirse: PC12 hücrelerinin şekil değişimini, gözle
> puanlamak yerine **mikroskop görüntülerinden otomatik olarak ölçmek** istiyoruz.
>
> Ben Berke Dinç, projeyi Gözde Havin Fidan ile birlikte yürütüyoruz.

*(Animasyon bitene kadar bekleme — nöron çizilirken konuşmaya başlayabilirsin.)*

---

## Slayt 2 — `Presentation Outline` (≈30 sn)

**Anlatman gerekenler**
- Altı başlığı hızlıca say, tek tek açıklama
- "Önce ne yaptık, sonra ne yapacağız" mantığını ver

**Kuracağın cümleler**

> Sunumun akışı şöyle. Önce **projenin amacını ve araştırma sorusunu** anlatacağım,
> ardından **neden PC12 hücre hattını kullandığımızı**.
>
> Sonra **laboratuvarda şu ana kadar neleri tamamladığımızı**, **genel iş akışını** ve
> son olarak **önümüzdeki iki haftanın planını** paylaşacağım.

*(Kartları tek tek okuma, sadece akışı ver. 30 saniyeden fazla harcama.)*

---

## Slayt 3 — `Project Objective and Research Question` (≈100 sn)

**Anlatman gerekenler**
- Araştırma sorusunu **oku** — bu projenin özü
- "Otomatik" ve "tekrarlanabilir" kelimelerini vurgula
- Problem → yaklaşım → çıktı zincirini kur
- Dört ölçümü **görüntü üzerinde göstererek** say
- Görüntünün altındaki kırmızı satırı işaret et — üstverinin neden ölçüm sayıldığı orada

**Kuracağın cümleler**

> Araştırma sorumuz şu: *PC12 hücrelerinde NGF uygulaması sonrası oluşan morfolojik
> değişimler, parlak alan veya faz kontrast görüntülerinden otomatik ve tekrarlanabilir
> şekilde ölçülebilir mi?*
>
> Burada iki kelime önemli. **Otomatik** — yani her görüntüyü bir insanın tek tek
> puanlamasına gerek kalmadan. Ve **tekrarlanabilir** — yani aynı görüntü her seferinde
> aynı sayıyı versin.
>
> Bugünkü problem şu: morfoloji gözle puanlanıyor. Bu hem yavaş, hem bakan kişiye göre
> değişiyor. İki farklı kişi çoğu zaman aynı sonuca varmıyor.
>
> Yaklaşımımızın sırası net. **Önce** kültürü ve görüntülemeyi standartlaştırıyoruz.
> **Ancak ondan sonra** bir işlem hattı bir şey ölçebilir — çünkü standart veri olmadan
> kurulan hiçbir model güvenilir olmaz.
>
> *(Görüntüyü göster)* Soldaki, mevcut veri setimizden gerçek bir floresan görüntü. Tek
> bir hücreyi işaretledik, diğerlerini soluk bıraktık. Şunu hemen söyleyeyim: bu
> çizgiler bizim modelimizin çıktısı değil — klasik eşikleme ve iskeletlemeyle üretildi,
> sadece **neyi ölçeceğimizi** göstermek için. Slaytta da böyle yazıyor.
>
> Dört şey ölçeceğiz. **Soma** — beyaz konturlu hücre gövdesi: sayı, alan, şekil ve
> doluluk. **Nöritler** — kırmızı uzantılar: sayı, uzunluk, yönelim. Ve **dallanma** —
> halkanın içindeki nokta gerçek bir çatallanma, nöritin ikiye ayrıldığı yer.
>
> Üçüncüsü **farklılaşma**: aynı ölçümlerin kontrol grubu ile NGF verilen günler
> arasında karşılaştırılması.
>
> Dördüncüsü **kalite üstverisi** — ve bunun neden bir ölçüm olduğunu görüntünün altında
> gösterebilirim. *(Alt şeridi işaret et)* Elimizdeki dosya adını, tarihini, görüntüleme
> modunu ve pozlamasını kaydediyor. Ama **kuyucuk, konum ve tekrar bilgisini
> kaydetmiyor** — kırmızı yazan satır bu. Bir görüntünün nereden geldiğini
> söyleyemiyorsak o sayı izlenebilir değildir; izlenebilir olmayan bir sayının da
> bilimsel değeri yoktur. Kuracağımız yeni protokol tam olarak bu üç alanı zorunlu
> kılacak.

**Olası soru:** *"Metadata neden bir ölçüm?"* → Son paragraf cevabın.
**Olası soru:** *"Neden mikrometre değeri yok?"* → "O görüntüde objektif bilgisi kayıtlı
değil ve piksel ölçeği güvenilir değil. Yeni protokol bunu düzeltecek; o zamana kadar
piksel düzeyinde konuşuyoruz."

---

## Slayt 4 — `The PC12 Model` (≈75 sn)

**Anlatman gerekenler**
- PC12 nedir, NGF ne yapar
- Neden gerçek nöron değil de PC12
- Nörit uzamasının literatürde standart bir ölçüt olduğu — **projenin önemi burada**

**Kuracağın cümleler**

> PC12, sıçan feokromositomasından — yani bir böbrek üstü bezi tümöründen — türetilmiş
> bir hücre hattı.
>
> Onu değerli kılan şu: hücreye **NGF**, yani sinir büyüme faktörü verdiğinizde bölünmeyi
> bırakıyor ve uzantı çıkarmaya başlıyor. Nöron gibi davranmaya başlıyor.
>
> Gerçek nöron yerine PC12 kullanmamızın sebebi, primer nöron kültürünün zor, pahalı ve
> tekrarlanabilirliğinin düşük olması. PC12 bize bu maliyet olmadan nöronal bir okuma
> sağlıyor.
>
> Ölçtüğümüz sinyal de nörit uzamasının kendisi. Uzunluk, sayı ve dallanma **ölçülebilir
> şekilde** değişiyor — işte verimiz bu değişim.
>
> Bu sadece bizim projemizle sınırlı bir konu da değil. Nörit uzaması, nörotoksisite
> testlerinde ve ilaç taramasında **standart bir ölçüt**. Darboğaz her zaman birinin
> bunu elle puanlamak zorunda olması olmuş. Biz tam olarak o darboğazı kaldırmaya
> çalışıyoruz.

---

## Slayt 5 — `Work Completed` (Bölüm Ayracı) (≈10 sn)

**Anlatman gerekenler**
- Sadece geçiş yap, durma

**Kuracağın cümleler**

> Şimdi laboratuvarda fiilen ne yaptığımıza geçeyim.

---

## Slayt 6 — `23 September: PC12 Cells Are Back in Culture` (≈2,5 dk — 10 adım)

> ⚠️ **Sağ ok tuşu burada on adımı sırayla açar.** Hepsi bitince 7. slayta geçersin.
>
> 💡 **Öneri:** Adımların hepsinde durma. **4, 6 ve 7'de dur** (seyreltme, santrifüj
> parametreleri, DMSO'nun uzaklaşması); kalanları genel görünümden anlat. Çizgideki
> adıma tıklayarak doğrudan atlayabilirsin.

**Giriş cümlesi (hiçbir adım seçili değilken)**

> Bu, **23 Eylül** tarihli, yani dünkü laboratuvar kaydımız. Donmuş bir şişeden ekilmiş
> bir flaska, tek bir seansta geldik.
>
> Yukarıdaki çizgi hücre açmanın on adımı. Altındaki siyah bant ise bir veri: **kalınlığı
> DMSO derişimini gösteriyor.** İkinci adımda yüzde onla başlıyor, dörtten itibaren
> inceliyor ve yedinci adımda tamamen bitiyor.
>
> Çünkü hücreler **yüzde doksan FBS ve yüzde on DMSO** içinde donduruluyor — mililitre
> başına dokuz yüz mikrolitre FBS, yüz mikrolitre DMSO. DMSO orada bir sebeple var:
> dondurma sırasında buz kristallerinin hücre zarını parçalamasını engelliyor. Ama
> ikinci bir özelliği daha var — **ısındığı anda hücreye toksik.**
>
> Dolayısıyla adım ikiden yediye kadar olan her şey tek bir işi yapıyor: DMSO'yu
> seyreltmek, çöktürmek ve dökmek.

**Adımlar**

> *(1–3'ü hızlı geç)* Önce besiyerini hazırlayıp otuz yedi dereceye ısıtıyoruz — şişe
> dondurucudan çıkmadan **önce**, ki çözülen hücreler DMSO içinde beklemesin. Şişeyi
> eksi seksen dereceden çıkarıyoruz ve **elimizde tutarak, vücut ısımızla**, içindeki
> çözelti eriyene kadar bekliyoruz. Dürüst bir not: standart yöntem otuz yedi derecelik
> su banyosudur ve daha hızlıdır; el sıcaklığı yavaş olduğu için DMSO teması biraz uzadı.
>
> *(4'te dur)* Dördüncü adım işin kilit noktası. Besiyerini pipetle şişenin içine koyup
> çekerek karıştırıyoruz. DMSO **tam hücrenin bulunduğu yerde** seyrelmeye başlıyor.
>
> *(5'i hızlı geç)* Sonra süspansiyonu, içinde zaten besiyeri bulunan bir falcona
> alıyoruz — seyrelme tersine dönmesin, devam etsin diye.
>
> *(6'da dur)* Falconu **bin iki yüz elli devirde, yedi dakika** santrifüjlüyoruz.
> Hücreler dipte pelet hâlinde toplanıyor, yani DMSO'yu taşıyan sıvıdan ayrılıyorlar.
>
> *(7'de dur)* Üstteki sıvıyı döktüğümüzde, geriye kalan DMSO da o sıvıyla birlikte
> gidiyor. Santrifüjün asıl amacı zaten buydu.
>
> *(8–10'u akıcı geç)* Bu sırada flaska PBS ekleyip tabanında çalkalayıp boşaltıyoruz.
> Peleti taze besiyeri içinde yavaşça pipetleyerek dağıtıyoruz — topak hâlinde değil,
> tekil hücreler hâlinde gitsin diye. Ve flaskı etiketleyip otuz yedi derece, yüzde beş
> karbondioksitli inkübatöre kaldırıyoruz. Buradan sonra besiyeri üç günde bir
> yenileniyor.
>
> Canlılık kontrolünü bu haftaki ilk incelemelerde yapacağız.

> 💡 **Çizgideki adıma tıklayarak atlayabilirsin.** Onunu sırayla gezmek zorunda
> değilsin; 4, 6 ve 7'ye tıklayıp diğerlerini genel görünümden anlatmak da olur.

---

## Slayt 7 — `What the Cells Live In, and How We Keep It Clean` (≈100 sn)

**Anlatman gerekenler**
- Besiyeri: beş bileşen, iki kademeli büyütme mantığı
- Serumun %12 olduğu ve neden gerektiği
- L-glutaminin neden ayrı eklendiği
- Steril teknik: kabin → giriş → elleçleme, üç katman

**Kuracağın cümleler**

> Hücrelerin içinde yaşadığı sıvı ve onu temiz tutma yöntemimiz.
>
> Solda elli mililitrelik bir büyüme besiyeri partisi var, laboratuvar defterinden.
> Üstteki çubuk partinin tamamı: neredeyse hepsi **RPMI**, kırk üç buçuk mililitre,
> yani yüzde seksen yedi.
>
> Geri kalan yüzde on üçü göremediğimiz için **yedi buçuk kat büyütüyoruz** — ortadaki
> çubuk bu. Burada iki serum var: **at serumu** üç buçuk mililitre ve **FBS** iki buçuk
> mililitre. İkisi birlikte yüzde on iki eder ve PC12'nin ihtiyaç duyduğu büyüme
> faktörlerini sağlarlar.
>
> Sağ uçta hâlâ görünmeyen ince bir dilim kalıyor; onu da **on iki kat daha**
> büyütüyoruz — alttaki çubuk. **L-glutamin** beş yüz mikrolitre, yani yüzde bir.
> L-glutamin ayrıca ekleniyor, çünkü bekleyen besiyerinde bozunuyor; hazır karışım
> içinde gelmesi mümkün değil. En sağdaki siyah dilim ise **gentamisin, elli
> mikrolitre** — yüzde nokta bir. Uzun kültür süresi boyunca bakteriyel
> kontaminasyonu baskılıyor.
>
> *(Steril tekniğe geç)* Sağda kontaminasyon kontrolü, üç katman hâlinde.
>
> **Kabin.** Seans öncesi UV döngüsü çalıştırıyoruz ve laminer akışı çalışma boyunca
> açık bırakıyoruz — filtrelenmiş hava yüzey boyunca dışarı doğru aktığı için
> filtresiz hava içeri giremiyor. Yüzeyi önce ve sonra yüzde yetmişlik etanolle
> siliyoruz.
>
> **Giriş.** Kabine giren her şey — şişeler, pipetler, tüpler, raklar — girerken yüzde
> yetmişlik etanolle siliniyor. Hiçbir malzeme kontaminasyonu hava perdesinin içine
> taşımıyor.
>
> **Elleçleme.** Sadece steril, tek kullanımlık sarf malzeme. **Asla açık bir kabın
> üzerinden elimizi geçirmiyoruz** — eldivenden düşecek herhangi bir partikül doğrudan
> içine düşer. Kaplar her aktarımdan hemen sonra kapatılıyor, adımlar arasında eldiven
> yeniden sterilize ediliyor, atık da seans sonunda çıkarılıyor.

*(Sorulursa: %70 etanol saf etanolden daha etkilidir, çünkü içindeki su proteinin
denatüre olmasına yardım eder.)*

> ⚠️ **Sunumdan önce teyit et:** Gentamisin değeri bu slaytta **50 µL (%0,1)** olarak
> yazıyor ve toplam 50,05 mL'ye oturuyor. Eski sürümde 0,5 mL yazıyordu ve toplam 50,5
> çıkıyordu. Laboratuvar defterinden bir kez daha bak; sorulursa "kaydı düzelttik"
> diyebilmen gerek.

---

## Slayt 8 — `Process Overview` (≈90 sn)

**Anlatman gerekenler**
- İki iz var: deneysel (BME) ve hesaplama (EEE)
- **Numaralar her izde 1'den başlıyor** — hangi izden bahsettiğini belirt
- Şu an WP3'teyiz (Cell Culture, sarı)
- Hesaplama izi veriyi bekliyor — WP2'nin neden 9. haftada olduğunu açıkla

**Kuracağın cümleler**

> Bu slaytta tüm proje iki iz hâlinde görünüyor.
>
> **Üstteki iz deneysel**, biyomedikal tarafından yürütülüyor. Planlama ve hücre açma
> tamamlandı — yeşil olanlar. Hücre kültürü **devam ediyor**, sarı renkli olan — bugün
> tam olarak buradayız. NGF uygulaması ve görüntüleme ise planlanmış durumda.
>
> **Alttaki iz hesaplama tarafı**, elektronik tarafından yürütülüyor. Bunlar Gantt
> chart'ımızdaki iş paketleri, hafta aralıklarıyla birlikte.
>
> Numaralandırmaya dair bir not: her iz yeniden WP1'den başlıyor, o yüzden WP3 dediğimde
> hangi izden bahsettiğimi belirteceğim.
>
> Hesaplama izi henüz başlamadı ve bu bilinçli bir tercih. WP2'ye bakın — yeni veri
> setinin hazırlanması — **dokuzuncu haftada** duruyor. Çünkü deneysel ize bağımlı.
> Henüz var olmayan bir veri setini etiketleyemeyiz. Standartlaştırılmış görüntü setinin
> önce oluşması gerekiyor.

**Olası soru:** *"Sonuçlarınız nerede?"* → "Hâlâ veri standardizasyonu aşamasındayız.
Hesaplama izi standart görüntü seti oluştuktan sonra başlıyor — WP2'nin dokuzuncu
haftada olmasının sebebi bu."

---

## Slayt 9 — `Next Two Weeks` (Bölüm Ayracı) (≈10 sn)

**Kuracağın cümleler**

> Önümüzdeki iki haftanın planıyla bitireyim.

---

## Slayt 10 — `Plan for the Next Two Weeks` (≈60 sn)

**Anlatman gerekenler**
- 1. hafta tamamen kültürün sağlığı
- 2. hafta takip sürerken paralelde AI araştırması + düzenek kurulumu
- Kayıt tutmanın neden bir iş kalemi olduğu

**Kuracağın cümleler**

> **Birinci haftada** öncelik tamamen kültürün sağlığı. Tutunmayı, canlılığı ve
> doluluğu izliyoruz, besiyerini üç günde bir yeniliyoruz ve her kontrolde
> kontaminasyona bakıyoruz. Yirmi üç Eylül ekimine göre ilk iki yenileme yirmi altı ve
> yirmi dokuz Eylül'de.
>
> Dördüncü madde kayıt tutmayla ilgili: her besiyeri partisini ve her yenilemeyi
> laboratuvar kaydına işliyoruz. Bu bir formalite değil — az önce üstverinin neden bir
> ölçüm olduğunu anlattım, aynı gerekçe burada da geçerli.
>
> **İkinci haftada** aynı takip sürerken paralelde iki iş başlıyor. **Aday yapay zekâ
> segmentasyon modellerinin literatür taramasına** başlıyoruz ve **görüntüleme
> düzeneğini kurup** manipülatörle denemelere geçiyoruz.
>
> Bir şeyi netleştirmek isterim: morfoloji kayıtlarını seanslar arasında tutarlı tutmak
> — aynı büyütme, aynı çerçeveleme, aynı format — sadece kayıt tutmak değil. Veri
> setini ileride kullanılabilir kılan şey tam olarak bu.

---

## Slayt 11 — `Micromanipulator-Assisted Whole-Well Imaging` (≈90 sn)

**Anlatman gerekenler**
- Üç aşama var, numaralı: konumla → tara → birleştir
- Mikroskop sabit, **plaka hareket ediyor**
- Neden tek alan değil tüm kuyucuk — önyargı argümanı
- 3×3 sadece örnek
- **Bu iki haftada mikroskopla çekim yok** — dürüst ol

**Kuracağın cümleler**

> Bu, kurmayı planladığımız görüntüleme yöntemi. Üç aşamada okunuyor.
>
> **Bir — kuyucuğu konumlandırma.** Tek bir kuyucuk mikroskobun altına getiriliyor.
> Mikroskop **sabit kalıyor** — hareket eden plaka, ve onu bir XY mikromanipülatör
> sürüyor.
>
> **İki — karo karo tarama.** Sağdaki daire, hedef kuyucuğun büyütülmüş hâli. Kırmızı
> kare sabit görüş alanı. Plaka altında kayarken her konumda duruyor, bir kare çekiyor
> ve bir sonrakine geçiyor. Hareket hâlinde çekim yapılmıyor.
>
> **Üç — kuyucuğu birleştirme.** Aşağıdaki şeritte, taramadan çıkan dokuz kare birikiyor.
> Önemli olan şu: her karo **alındığı konumu da taşıyor**. Yani kuyucuk temsili tek bir
> alandan değil, bilinen bir ızgaradan yeniden kuruluyor.
>
> *(Slayt 3'e bağla)* Üçüncü slaytta size, elimizdeki görüntülerin kuyucuk, konum ve
> tekrar bilgisini kaydetmediğini göstermiştim. Bu düzeneğin ürettiği şey tam olarak o
> eksik bilgi.
>
> Peki neden iyi bir alan seçmek yerine tüm kuyucuğu tarıyoruz? Çünkü alan seçmek bir
> insanın verdiği karardır ve bu önyargı getirir. Tüm kuyucuğu taramak o kararı ortadan
> kaldırıyor ve istatistiği tüm popülasyon üzerinden kurmamızı sağlıyor.
>
> İki tane de dürüst kayıt düşeyim. Buradaki üçe üçlük ızgara **sadece bir örnek** —
> gerçek ızgara boyutu kuyucuk çapından, objektifin görüş alanından ve ihtiyaç duyduğumuz
> örtüşme oranından çıkacak.
>
> Ve önümüzdeki iki hafta içinde mikroskopla **çekim yapmayacağız**. Bu sürede yapacağımız
> şey, bu yöntemin ihtiyaç duyduğu tablayı ve montaj düzeneğini kurmak ve manipülatörle
> konumlandırma denemeleri yapmak.

---

## Slayt 12 — `Project Team` (≈25 sn)

**Anlatman gerekenler**
- Dört kişi
- **8. slayttaki iki izle bağlantı kur** — bu, sunumu toparlayan cümle

**Kuracağın cümleler**

> Son olarak ekibimiz. Elektrik-Elektronik Mühendisliği'nden Gözde Havin Fidan ve
> Biyomedikal Mühendisliği'nden ben, Berke Dinç.
>
> Danışmanlarımız Volkan Kılıç ve Mustafa Şen.
>
> Bu yapı, az önce gördüğünüz iki izle birebir örtüşüyor — elektronik tarafı hesaplama
> iş paketlerini, biyomedikal tarafı deneysel olanları yürütüyor.

---

## Slayt 13 — `Thank You` (≈10 sn)

**Kuracağın cümleler**

> Dinlediğiniz için teşekkür ederim. Sorularınızı almaktan memnuniyet duyarım.

---

## Soru-Cevap — Hazır Cevaplar

**"Sonuçlarınız nerede?"**
> Henüz analiz sonucumuz yok ve bunu saklamıyoruz. Şu an deneysel aşamada ve veri
> standardizasyonu aşamasındayız. Hesaplama izi, standartlaştırılmış görüntü seti
> oluştuktan sonra başlıyor — WP2'nin dokuzuncu haftada planlanmış olmasının sebebi bu.

**"Slayt 3'teki çizgileri modeliniz mi çizdi?"**
> Hayır. Görüntü mevcut veri setimizden, üzerindeki konturlar ise klasik eşikleme ve
> iskeletleme ile çizildi. Slaytta bunu açıkça yazıyoruz. Amaç modeli göstermek değil,
> **hangi büyüklükleri ölçeceğimizi** gerçek bir hücre üzerinde göstermek.

**"Neden mikrometre cinsinden bir sayı vermiyorsunuz?"**
> O görüntüde objektif bilgisi kayıtlı değil ve dosyadaki piksel ölçeği güvenilir değil.
> Kuracağımız protokol objektif ve ölçek bilgisini zorunlu kılacak; o zamana kadar
> ölçümleri piksel düzeyinde konuşuyoruz.

**"Besiyeri hacimleriniz tutuyor mu?"**
> Tutuyor. RPMI kırk üç buçuk, at serumu üç buçuk, FBS iki buçuk, L-glutamin beş yüz
> mikrolitre, gentamisin elli mikrolitre — toplam elli virgül sıfır beş mililitre, yani
> elli mililitre hedefiyle uyumlu. Önceki sürümde gentamisin sehven yarım mililitre
> yazılmıştı ve toplam elli buçuk çıkıyordu; kaydı düzelttik.

**"Neden gerçek nöron kullanmıyorsunuz?"**
> Primer nöron kültürü zor, pahalı ve tekrarlanabilirliği düşük. PC12 ise NGF altında
> nöron benzeri fenotip kazanan standart bir model hattı ve nörit uzaması literatürde
> kabul görmüş bir ölçüt.

**"Neden tüm kuyucuğu tarıyorsunuz, tek alan yetmez mi?"**
> Tek bir alan seçmek insan kararıdır ve seçim önyargısı getirir. Tüm kuyucuğu taramak
> bu kararı ortadan kaldırıyor, bize tüm popülasyon üzerinden istatistik veriyor ve her
> karonun konumu kaydedildiği için sonuç izlenebilir oluyor.

**"Hangi yapay zekâ modelini kullanacaksınız?"**
> Henüz seçmedik. Aday segmentasyon modellerinin literatür taraması önümüzdeki iki
> haftanın işlerinden biri. Gantt chart'ımızda değerlendirilecek adaylar olarak nnU-Net,
> DS-UNet ve ViT-UNet listeleniyor.

**"Veriyi nasıl böleceksiniz?"**
> **Biyolojik tekrar** düzeyinde. Aynı kuyucuktan veya aynı çekim seansından gelen
> görüntüler eğitim ve test setlerine dağıtılmamalı — aksi hâlde model olduğundan daha
> başarılı görünür. Buna veri sızıntısı deniyor ve bölme kuralını model eğitimine
> başlamadan önce sabitleyeceğiz.

**"Proje ne kadar sürecek?"**
> Gantt chart ikinci haftadan on beşinci haftaya kadar uzanıyor. Deneysel iz şu anda
> işliyor; hesaplama iş paketleri üçüncü haftadan itibaren başlıyor, son entegrasyon da
> on beşinci haftada.

---

## Sunum Öncesi Kontrol Listesi

- [ ] HTML dosyasını tarayıcıda aç, **tam ekran** butonuna bas (sol alt)
- [ ] Slayt 6'da sağ okun önce on adımı gezdiğini hatırla
- [ ] Slayt 3'te alt şeritteki **kırmızı satırı** işaret et — üstveri argümanın orada
- [ ] Slayt 7'de gentamisin değerini defterden teyit etmiş ol (50 µL)
- [ ] Slayt 11'de "bu iki haftada çekim yok" cümlesini atlama
- [ ] Slayt 8'de hangi izden bahsettiğini her seferinde belirt
- [ ] Slayt 11'i Slayt 3'e bağla — eksik üstveriyi üreten düzenek bu
- [ ] Toplam süreyi 13–15 dakikada tut; en uzun slayt 6 (≈2,5 dk)
