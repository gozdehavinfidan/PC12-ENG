// CAMEX sunum konusma metni - slayt sirasina gore (Turkce).
// Slayt yazilari Ingilizce; konusma metni Turkce. Kaynak: icerik/sayfa_*.md.
// '→' ile baslayan her satir bir adimdir (sunucu gorunumu adim adim vurgular);
// stepMax = destedeki adim sayisi.
export const NOTES = [
  {
    n: 1,
    title: "Cover",
    approxSeconds: 20,
    script: `Herkese iyi günler. Projemizin adı CAMEX, yani Cellular Analysis of Morphology with XAI for PC12. CAMEX, mikroskop görüntülerindeki PC12 hücrelerini, yani sinir hücresine benzeyen hücreleri otomatik olarak segmente eden ve morfolojilerini hücre hücre ölçen, açıklanabilir yapay zekâ tabanlı bir sistem ve bu sistemi çevrim dışı çalışan bir masaüstü uygulamasıyla kullanıcıya sunuyor.`,
  },
  {
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
  {
    n: 3,
    title: "Dataset",
    approxSeconds: 35,
    stepMax: 3,
    script: `Veri setimiz PC12 hücrelerine ait floresan mikroskop görüntülerinden oluşuyor.
→ Toplam 91 görüntüyü HumanSignal'da kendimiz etiketledik.
→ Görüntüler kanal başına 8 bitlik renkli görüntüler; mikroskobun CZI dosyalarını PNG'ye dönüştürdük.
→ Görüntüler iki farklı boyut ve çözünürlükte. 53 görüntü 20× objektifle, 1920'ye 1080 piksel olarak çekildi; burada bir piksel numunede 0,185 mikrometreye karşılık geliyor. 38 görüntü 5× objektifle, 3840'a 2160 piksel olarak çekildi; burada bir piksel yaklaşık 0,37 mikrometre. Yani ikinci grup dört kat daha geniş bir alanı gösteriyor, ama aynı hücre piksel olarak yarı boyutta görünüyor. Ölçümleri her görüntünün kendi piksel boyutuyla mikrometreye çeviriyoruz. 0,37 değeri hesaplanmış bir değer; bir kalibrasyon lamıyla doğrulayacağız.`,
  },
  {
    n: 4,
    title: "Labelling",
    approxSeconds: 30,
    stepMax: 3,
    script: `Etiketlemeyi HumanSignal'da piksel düzeyinde yeniden yaptık; arka plan dışında üç sınıfımız var.
→ "Cell", tek bir hücrenin gövdesi; hücre sayısını, alanını ve şeklini buradan ölçüyoruz.
→ "Branch", hücreden uzanan nöritler; nörit uzunluğu ve dallanma açıları buradan hesaplanıyor.
→ Üçüncü sınıf "clump of cells", yani hücre kümeleri: hücrelerin üst üste bindiği, sınırlarının ve dallarının ayırt edilemediği bölgeler. Bunları tek büyük bir hücre gibi etiketleseydik sayım ve boyut ölçümleri bozulurdu; bu yüzden ayrı bir sınıf olarak işaretleyip hücre başına ölçümlerin dışında tutuyoruz.`,
  },
  {
    n: 5,
    title: "Protocol",
    approxSeconds: 60,
    stepMax: 4,
    script: `Sonuçlara geçmeden önce yöntemleri nasıl karşılaştırdığımızı anlatayım. Bütün denemeleri ilk etiketli setimizdeki 26 görüntüyle yaptık. 5 görüntüyü kilitli test seti olarak ayırdık; bu set yalnızca en sonda, nihai model için bir kez açılacak. Kalan 21 görüntü eğitim ve doğrulama için.
→ Bu 21 görüntüyü yaklaşık dörder görüntülük 5 kata böldük. Her turda 4 katla, yani yaklaşık 17 görüntüyle eğitip kalan katta ölçüyoruz; 5 turun sonunda her görüntü bir kez, modelin hiç görmediği görüntü olarak ölçülmüş oluyor.
→ Her testte aynı ağı kullandık: U-Net. Kodlayıcısı ImageNet'te önceden eğitilmiş bir ResNet-34, yani ağ sıfırdan başlamıyor. Çıktı her piksel için biri soma, biri nörit olmak üzere iki olasılık. Kayıp iki parçalı: ikili çapraz entropi yani BCE her pikseli ayrı ayrı denetliyor; Dice ise yapıya bütün olarak bakıyor. Piksellerin yaklaşık yüzde 97'si arka plan olduğu için Dice, küçük nörit alanının da önemli sayılmasını sağlıyor. Ağ, kayıp ve eğitim ayarları sabit kaldığı için birazdan göstereceğim ön işleme ve augmentation farkları gerçekten denenen yöntemden geliyor.
→ Her yöntemi üç farklı seed ile eğittik; yani her yöntem için beş kat çarpı üç seed, on beş eğitim. Seed, eğitimdeki rastgeleliği belirleyen başlangıç değeri.
→ Bir yöntemi ancak clDice'ı en az 0,02 artırıyorsa, beş katın beşinde iyileştiriyorsa, hücre gövdesi Dice'ını en fazla 0,01, kavşak F1 skorunu en fazla 0,02 düşürüyorsa ve hiç kullanmadığımız yeni seed'lerle de aynı sonucu veriyorsa kabul ediyoruz.`,
  },
  {
    n: 6,
    title: "Preprocessing",
    approxSeconds: 50,
    stepMax: 3,
    script: `Her görüntü modele gitmeden önce aynı üç adımdan geçiyor. Kartlarda her adımın sonucunu, altta da aynı görüntünün yoğunluk histogramını görüyoruz.
→ Birincisi tek kanallı yoğunluk görüntüsü: her pikselde kırmızı, yeşil ve mavinin en büyüğünü alıp 255'e bölüyoruz; floresanda bu pratikte yeşil kanal. Histogramda piksellerin çoğu sıfıra yakın; bunlar karanlık arka plan. Bu bölme sabit, yani görüntünün karanlık ya da parlak olmasını değiştirmiyor.
→ İkincisi görüntüyü bilineer interpolasyonla üçte bire küçültmek. Histogramın şekli aynı kalıyor, yalnızca piksel sayısı yaklaşık dokuzda birine iniyor. Küçültme sayesinde model aynı boyuttaki bir parçada daha geniş bir alanı görüyor; denemelerimizde en büyük kazancı bu adım sağladı.
→ Üçüncüsü yüzdelik normalizasyonu. Mavi çizgiler bu görüntünün birinci ve doksan dokuz virgül sekizinci yüzdeliği. Eksen bunlara göre geriliyor: alt sınır sıfıra, üst sınır bire gidiyor, onun üstündeki binde iki piksel bire kırpılıyor. Bu, her görüntü için kendi değerleriyle yapılıyor. Bunu yapıyoruz çünkü pozlama süreleri görüntüden görüntüye çok farklı; önceki geliştirme setinde 18 ile 1000 milisaniye arasındaydı. Böylece karanlık ve parlak çekilmiş görüntüler aynı aralığa geliyor.`,
  },
  {
    n: 7,
    title: "Preprocessing tested",
    approxSeconds: 40,
    stepMax: 4,
    script: `Bu üç adıma birçok yöntemi deneyerek ulaştık. Sonuçları clDice ile ölçüyoruz: nöritlerin ne kadar kopmadan ve eksiksiz bulunduğunu gösteren, 1'in mükemmel olduğu bir skor. Referansımız tam çözünürlükteki U-Net'ti ve clDice 0,728'di.
→ Üçte bire küçültme en büyük kazancı sağladı: clDice 0,045 arttı, beş katın beşinde de iyileşme oldu.
→ CLAHE, asinh, gürültü giderme ve keskinleştirme gibi yaygın filtreler belirgin bir fark yaratmadı.
→ Nörit sırtlarını vurgulayan ek kanallar fayda sağlamadı; ağ bu özellikleri zaten kendi öğreniyor. Sonuçta en basit hat kazandı.
→ Kenar yumuşatmalı küçültme: küçültmeden önce görüntüyü hafifçe bulanıklaştırıyoruz, böylece atlanan pikseller de hesaba katılıyor. Küçük ama olumlu bir fark verdi, kabul eşiğimizi geçemedi. 21 görüntüde bu kadar küçük farklar gürültü sınırında kalıyor; bu yüzden bu yöntemi reddetmedik, veri seti büyüyünce aynı protokolle yeniden deneyeceğiz.`,
  },
  {
    n: 8,
    title: "Augmentation",
    approxSeconds: 45,
    stepMax: 3,
    script: `Augmentation, her eğitim kesitini modele vermeden hemen önce rastgele değiştirmek demek; hiçbir şey diske kaydedilmiyor ve yalnızca eğitimde uygulanıyor. Hatta şu an iki tanesini kullanıyoruz.
→ Birincisi rastgele kesitler: üçte ikisi bir hücre ya da nörit yakınından, yeşil kutular; üçte biri görüntünün herhangi bir yerinden, sarı kutu. Böylece model arka planı da öğreniyor.
→ İkincisi her kesitin 90 derecenin katları kadar döndürülüp aynalanması; bir kesitten sekiz farklı görünüm çıkıyor. Hücrelerin tercih ettiği bir yön olmadığı için bu bilgiyi bozmuyor.
→ Alttakiler çekim koşullarını taklit eden değişiklikler: pozlama, JPEG sıkıştırma, odak kayması, hafif ve güçlü gürültü, ölçek oynatma; ayrıca kavşak odaklı kesit seçimi ve bunların birleşimi. Temiz görüntülerde çok küçük ama olumlu katkı verdiler, kabul eşiğini geçemediler. Asıl faydaları bozuk görüntülerde: bilerek çok gürültülü yapılmış görüntülerde augmentation'sız model 0,58 clDice'a düşerken bu augmentation'larla 0,77 civarında kalıyor. Yeni veri farklı çekim koşulları içereceği için bunları orada yeniden deneyeceğiz. Serbest açılı döndürme, elastik bükme ve parça silme etkisiz kaldı; güçlü parlaklık-kontrast değişimi ve kenar kararması ise sonucu kötüleştirdi.`,
  },
  {
    n: 9,
    title: "Cell bodies",
    approxSeconds: 45,
    stepMax: 1,
    script: `Modellere hücre gövdeleriyle başlayalım. Gövdelerde özel bir sorun var: birbirine değen iki hücre tek bir leke olarak tahmin edilirse Dice yüksek kalıyor ama hücre sayısı yanlış oluyor.
Bu yüzden hücreleri tek tek eşleştiren nesne F1'i kullanıyoruz; iki hücre yeterince örtüşüyorsa doğru sayılıyor.
Ayrıca bulunan hücre sayısının gerçek sayıdan sapmasını ölçüyoruz.
Hücre gövdeleri için Cellpose-SAM kullandık: her piksel için kendi hücresinin merkezine doğru bir yön tahmin ediyor ve böylece bitişik hücreleri ayırabiliyor. Modeli kendi etiketlerimizle ince ayarladık.
→ Tabloda görüldüğü gibi nnU-Net'in Dice'ı yüksek ama hücreleri parçaladığı için sayım hatası çok büyük. İnce ayarlı Cellpose-SAM en yüksek nesne F1'ini ve en düşük sayım hatasını verdi; eğitimsiz hâli ise çok daha zayıftı, yani farkı yaratan bizim etiketlerimiz.`,
  },
  {
    n: 10,
    title: "Architecture",
    approxSeconds: 40,
    stepMax: 0,
    script: `Sonra nörit segmentasyonu için farklı modelleri denedik. Hepsi aynı 21 görüntüde, 5 katlı çapraz doğrulamayla ölçüldü; sayılar katların ortalaması. Çubuklar her modelin clDice'ının referans U-Net'e göre ne kadar değiştiğini gösteriyor; sağa uzayanlar daha iyi, sola uzayanlar daha kötü. U-Net, UNet++, MAnet, DeepLabV3+, UPerNet ve FPN gibi evrişimli ağları; farklı kodlayıcıları; transformer tabanlı SegFormer'ı; nnU-Net'i ve DINOv2 gibi büyük bir temel modeli denedik.
Tek başına en iyi model UNet++ oldu: beş katın beşinde U-Net'ten iyi, ama fark yaklaşık 0,01 ve kabul eşiğimizin altında. SegFormer ilk denemede daha yüksek çıktı ama yeni seed'lerde tutarlı değildi.
En iyi sonucu ise UNet++ ile SegFormer'ı birlikte kullanarak aldık; en üstteki yeşil çubuk bu. Biri evrişimli ağ, biri transformer; farklı hatalar yaptıkları için birbirlerini düzeltiyorlar. Tek U-Net'e göre clDice ilk denemede 0,020, hiç kullanılmamış yeni seed'lerde 0,015 arttı ve beş katın beşinde tutarlı kaldı. nnU-Net dışındaki bütün modeller aynı kayıpla eğitildi; alt başlıktaki işarete tıklayınca bu kayıp açılıyor: BCE her pikseli, Dice yapının bütününü denetliyor; sonradan eklediğimiz soft-clDice ise nöritlerin orta çizgisine bakıp kopuk nöritleri cezalandırıyor. soft-clDice clDice'ı 0,023 artırdı ve kopuk parça sayısını azalttı. Daha büyük kodlayıcılar, nnU-Net ve DINOv2 ise bu kadar az veriyle fayda sağlamadı; bunlar veri büyüyünce yeniden denenecek.`,
  },
  {
    n: 11,
    title: "Network view",
    approxSeconds: 45,
    stepMax: 3,
    script: `Ağın görüntüyü nasıl okuduğunu bu animasyonla göstermek istiyoruz. Ekrandaki görüntü, ön işlemeden geçmiş hâli: tek kanal, üçte bire küçültülmüş ve normalize edilmiş.
→ Ağ bu görüntünün tamamını tek seferde görmüyor; 256'ya 256 piksellik bir pencere görüntü üzerinde 224 piksellik adımlarla dolaşıyor.
→ Her pencerenin içinde 3'e 3'lük küçük filtreler, yani kernel'ler, piksel piksel kayıyor. Her konumda dokuz pikseli w1'den w9'a dokuz ağırlıkla çarpıp topluyor ve tek bir değer üretiyor; bu değerler bir özellik haritası oluşturuyor. Ağırlıkların değerlerini biz yazmıyoruz, eğitimde ağ kendisi öğreniyor; o yüzden kutularda sayı yerine w yazıyor.
→ Komşu pencereler 32 piksel örtüşüyor. Örtüşen piksellerde birden fazla pencerenin tahmini olduğu için bunların ağırlıklı ortalamasını alıyoruz. Ağırlık pencerenin ortasında en yüksek, kenarlarına doğru azalıyor; buna Hann ağırlığı deniyor. Ağ pencerenin kenarını daha az bağlamla gördüğü için kenar tahminlerine daha az güveniyoruz; böylece pencere sınırlarında iz ya da kopukluk oluşmuyor.`,
  },
  {
    n: 12,
    title: "CAMEX",
    approxSeconds: 35,
    stepMax: 3,
    script: `Bu analizi kullanıcıya CAMEX masaüstü uygulamasıyla sunuyoruz; uygulama tamamen çevrim dışı çalışıyor.
→ Analyze ekranı: görüntünün üzerinde segmentasyon maskeleri, numaralanmış hücreler ve hücre başına ölçümlerle NTI skoru görünüyor.
→ Compare ekranı: iki görüntü eşzamanlı kaydırılan görünümlerde yan yana duruyor ve her hücre için fark gösteriliyor.
→ Review ekranı: segmentasyon çıktıları belirsizliğe göre sıralanıyor; en emin olunmayan hücreler önce gözden geçiriliyor. Segmentasyon şu an hâlâ klasik hatla yapılıyor; eğittiğimiz ağları bir sonraki adımda aynı arayüzün arkasına ekleyeceğiz.`,
  },
  {
    n: 13,
    title: "Thank you",
    approxSeconds: 15,
    script: `Özetle CAMEX, PC12 mikroskop görüntülerinden hücre gövdelerini ve nöritleri otomatik olarak çıkarıp hücre başına ölçümlere dönüştürüyor. Dinlediğiniz için teşekkür ederiz; sorularınızı memnuniyetle yanıtlarız.`,
  },
];

export const META = { totalSeconds: 690, videoSeconds: 0, targetSeconds: 720 };
