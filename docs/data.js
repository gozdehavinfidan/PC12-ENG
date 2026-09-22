/* ===========================================================================
   PC12 ENG400 — DASHBOARD DATA  (single source of truth for project STATE)
   ===========================================================================

   BU DOSYA HAFTADA BİR GÜNCELLENİR. Başka hiçbir dosyaya dokunmanız gerekmez.

   Haftalık rutin (2 dakika):
     1) meta.currentWeek  -> bu haftanın numarası
     2) meta.updated      -> bugünün tarihi "YYYY-MM-DD"
     3) değişen task'ların  status / pct  alanları
     4) log[] dizisinin SONUNA bir satır ekleyin  (başına DEĞİL!)

   KURALLAR (bunlara uyun, yoksa git kavgası çıkar):
     * Her task TEK SATIR olsun. Git satır satır birleştirir; böylece Berke
       T1.3'ü, Gözde T2.1'i aynı anda değiştirse bile çakışma OLMAZ.
     * log[] ve decisions[] dizilerine SONDAN ekleyin. app.js zaten ters
       çevirip en yeniyi üstte gösteriyor. Baştan eklemek her hafta çakışır.
     * Buraya GEREKÇE yazmayın — gerekçe DECISIONS.md'de yaşar. Burada sadece
       "durum" var: ne, kim, hangi hafta, yüzde kaç.

   status değerleri:  "todo" | "doing" | "review" | "done" | "blocked"
   owner  değerleri:  "ML" (Gözde) | "BM" (Berke) | "EK" (ikisi)
   w                :  [başlangıcHaftası, bitişHaftası]  |  null = planlanmadı

   NOT: Bu dosya JSON DEĞİL, JavaScript. Yorum yazabilirsiniz, sondaki virgül
   sorun değil. Bu bilinçli bir tercih (bkz. DECISIONS.md D7).
   =========================================================================== */

window.PC12_DATA = {

  meta: {
    project:     "PC12 Hücre Morfolojisi — Otomatik Analiz",
    course:      "ENG400",
    subtitle:    "Görüntü işleme + derin öğrenme ile PC12 nöronal morfoloji analizi",
    currentWeek: 1,              // <-- HER HAFTA GÜNCELLE
    updated:     "2026-09-22",   // <-- HER HAFTA GÜNCELLE (YYYY-MM-DD)
    totalWeeks:  15,
    repoUrl:     "https://github.com/gozdehavinfidan/PC12-ENG",
    branch:      "main",         // Pages hangi daldan yayinlaniyorsa
    dataPath:    "docs/data.txt", // olay gunlugunun depo icindeki yolu
    wikiPath:    "llm-wiki",
  },

  // avatar: kare bir foto yolu, veya null -> bas harfler gosterilir.
  // Berke'nin fotografi gelince: assets/ icine kare kirpilmis berke.jpg koyun
  // ve asagidaki null yerine "assets/berke.jpg" yazin. Baska hicbir yeri
  // degistirmeniz gerekmez.
  people: [
    { code: "ML", name: "Gözde Havin Fidan", role: "Yazılım / ML",             short: "Gözde", initials: "GH", avatar: "assets/gozde.jpg" },
    { code: "BM", name: "Berke Dinç",        role: "Biyomedikal / etiketleme", short: "Berke", initials: "BD", avatar: null },
    { code: "EK", name: "Ekip (ikisi)",      role: "Ortak çalışma",            short: "Ekip",  initials: "EK", avatar: null },
  ],

  // Sadece ÖZEL haftalar. Diğerleri normal çalışma haftası sayılır.
  weeks: [
    { w: 2,  type: "sunum" },
    { w: 4,  type: "sunum" },
    { w: 6,  type: "sunum" },
    { w: 8,  type: "vize",  note: "Vize haftası — yeni kapsam yok, tampon" },
    { w: 9,  type: "sunum" },
    { w: 11, type: "sunum" },
    { w: 13, type: "sunum" },
    { w: 15, type: "final", note: "Final — hep birlikte, tam entegrasyon" },
  ],

  ips: [
    { id: "IP0", label: "İP0 — Kurulum & Plan" },
    { id: "IP1", label: "İP1 — Veri" },
    { id: "IP2", label: "İP2 — Segmentasyon" },
    { id: "IP3", label: "İP3 — Son işleme & Morfometri" },
    { id: "IP4", label: "İP4 — XAI" },
    { id: "IP5", label: "İP5 — Ürünleştirme / Uygulama" },
    { id: "IP6", label: "İP6 — İyileştirme döngüsü" },
    { id: "IP7", label: "İP7 — Yeni veri seti", optional: true },
  ],

  // --- GÖREVLER — her biri TEK SATIR ---------------------------------------
  tasks: [
    { id:"T0.1", ip:"IP0", title:"Kickoff, repo, env, wiki",                      owner:"EK", w:[1,1],   status:"done",  pct:100, ms:"M1" },
    { id:"T0.2", ip:"IP0", title:"Literatür + mimari araştırması",                owner:"ML", w:[1,2],   status:"doing", pct:70,  ms:"M1" },
    { id:"T0.3", ip:"IP0", title:"Pipeline tasarımı + sınıf şeması kararı",       owner:"EK", w:[2,2],   status:"todo",  pct:0,   ms:"M1" },
    { id:"T0.4", ip:"IP0", title:"Veri envanteri + etiketleme protokolü",         owner:"BM", w:[2,2],   status:"todo",  pct:0,   ms:"M1" },
    { id:"T0.5", ip:"IP0", title:"Proje dashboard altyapısı",                     owner:"ML", w:[1,2],   status:"done",  pct:100, ms:"M1" },

    { id:"T1.1", ip:"IP1", title:"Veri seti envanteri + data card (~70 görüntü)", owner:"BM", w:[2,3],   status:"doing", pct:30,  ms:"M2", note:"KRİTİK YOL. Etiketler kim tarafından, hangi protokolle yapıldı?" },
    { id:"T1.2", ip:"IP1", title:"Etiketleme protokolü + araç seçimi",            owner:"BM", w:[2,3],   status:"todo",  pct:0,   ms:"M2", note:"Yeni veri gelmeden ÖNCE dondurulmalı" },
    { id:"T1.3", ip:"IP1", title:"Pilot etiketleme + %10 çift etiketleme",        owner:"EK", w:[3,4],   status:"todo",  pct:0,   ms:"M2", note:"Annotator uyumu = ulaşılabilir DSC tavanı" },
    { id:"T1.4", ip:"IP1", title:"Ön işleme + augmentasyon + patch/fold bölme",   owner:"ML", w:[3,4],   status:"todo",  pct:0,   ms:"M2", note:"Görüntüye göre böl, SONRA patch'le (sızıntı!)" },
    { id:"T1.5", ip:"IP1", title:"Kalan etiketleme",                              owner:"BM", w:[5,7],   status:"todo",  pct:0,   ms:"M4" },
    { id:"T1.6", ip:"IP1", title:"Tutarlılık kontrolü + veri setini dondurma",    owner:"BM", w:[9,9],   status:"todo",  pct:0,   ms:"M4" },

    { id:"T2.1", ip:"IP2", title:"Eğitim boru hattı kurulumu + ilk koşu",         owner:"ML", w:[4,5],   status:"todo",  pct:0,   ms:"M3" },
    { id:"T2.2", ip:"IP2", title:"Baseline: Cellpose-SAM zero-shot + klasik",     owner:"ML", w:[5,5],   status:"todo",  pct:0,   ms:"M3", note:"Erken koş — sonucu planı değiştirebilir" },
    { id:"T2.3", ip:"IP2", title:"Pilot model (ön-eğitimli encoder + U-Net)",     owner:"ML", w:[5,6],   status:"todo",  pct:0,   ms:"M3" },
    { id:"T2.4", ip:"IP2", title:"Segmentasyon iyileştirme (denge, çözünürlük)",  owner:"ML", w:[7,7],   status:"todo",  pct:0,   ms:"M4" },
    { id:"T2.5", ip:"IP2", title:"Tam veri eğitimi + 5-katlı CV karşılaştırma",   owner:"ML", w:[9,9],   status:"todo",  pct:0,   ms:"M4", note:"Mimari kararı BURADA verilir (D8)" },

    { id:"T3.1", ip:"IP3", title:"Post-process modülü (bileşen/instance ayrımı)", owner:"ML", w:[9,10],  status:"todo",  pct:0,   ms:"M5" },
    { id:"T3.2", ip:"IP3", title:"Öznitelik çıkarımı (skan: iskelet → graf)",     owner:"ML", w:[10,11], status:"todo",  pct:0,   ms:"M5" },
    { id:"T3.3", ip:"IP3", title:"Morfometri birim testleri",                     owner:"ML", w:[11,11], status:"todo",  pct:0,   ms:"M5" },
    { id:"T3.4", ip:"IP3", title:"Değerlendirme + hata analizi + Bland-Altman",   owner:"EK", w:[11,11], status:"todo",  pct:0,   ms:"M5" },

    { id:"T4.1", ip:"IP4", title:"XAI spike (yöntem seçimi + pilot koşu)",        owner:"ML", w:[6,6],   status:"todo",  pct:0,   ms:"M3" },
    { id:"T4.2", ip:"IP4", title:"XAI ile hata yorumlama",                        owner:"ML", w:[9,9],   status:"todo",  pct:0,   ms:"M4" },
    { id:"T4.3", ip:"IP4", title:"XAI görselleştirme katmanı",                    owner:"ML", w:[12,12], status:"todo",  pct:0,   ms:"M6" },
    { id:"T4.4", ip:"IP4", title:"XAI doğrulama (hata analiziyle çapraz)",        owner:"ML", w:[13,13], status:"todo",  pct:0,   ms:"M6" },

    { id:"T5.1", ip:"IP5", title:"Masaüstü uygulama iskeleti (mock veri)",        owner:"ML", w:[10,11], status:"todo",  pct:0,   ms:"M6" },
    { id:"T5.2", ip:"IP5", title:"Rapor modülü (şablon + üretici)",               owner:"ML", w:[12,13], status:"todo",  pct:0,   ms:"M6" },
    { id:"T5.3", ip:"IP5", title:"Pipeline ↔ UI entegrasyonu + ONNX/offline",     owner:"ML", w:[13,14], status:"todo",  pct:0,   ms:"M6" },
    { id:"T5.4", ip:"IP5", title:"Uçtan uca test & hata giderme",                 owner:"EK", w:[14,15], status:"todo",  pct:0,   ms:"FIN" },
    { id:"T5.5", ip:"IP5", title:"Final demo & sunum hazırlığı",                  owner:"EK", w:[15,15], status:"todo",  pct:0,   ms:"FIN" },

    { id:"T6.1", ip:"IP6", title:"Hata → model/öznitelik revizyon döngüsü",       owner:"ML", w:[12,14], status:"todo",  pct:0,   ms:"M6" },

    { id:"T7.1", ip:"IP7", title:"Yeni veri setini teslim alma (~2 hafta içinde)",owner:"BM", w:null,    status:"todo",  pct:0,   ms:null, note:"Tarih belirsiz — geldiğinde w alanını doldurun" },
    { id:"T7.2", ip:"IP7", title:"Yeni veriyi etiketleme (AYNI protokol)",        owner:"EK", w:null,    status:"todo",  pct:0,   ms:null },
    { id:"T7.3", ip:"IP7", title:"Eski/yeni karşılaştırma + fine-tune",           owner:"ML", w:null,    status:"todo",  pct:0,   ms:null, note:"Dokunulmamış test seti buradan çıkar" },
  ],

  milestones: [
    { id:"M1",  w:2,  gate:"Plan kilitli · repo+env · veri planı · dashboard canlı" },
    { id:"M2",  w:4,  gate:"Pilot veri etiketli · ön işleme uçtan uca çalışıyor · data card yazıldı" },
    { id:"M3",  w:6,  gate:"Pilot model eğitildi · baseline koşuldu · XAI spike yapıldı" },
    { id:"MID", w:8,  gate:"Vize kontrolü: metrikler gözden geçirildi, plan revize edildi" },
    { id:"M4",  w:9,  gate:"Tam veri modeli · 5-katlı CV ile en iyi mimari seçildi" },
    { id:"M5",  w:11, gate:"Morfometrik öznitelikler · hata analizi · insan ölçümüyle uyum" },
    { id:"M6",  w:13, gate:"Uygulama gerçek pipeline'a bağlı · ONNX/offline · XAI katmanı" },
    { id:"FIN", w:15, gate:"Uçtan uca offline çalışıyor · rapor üretiliyor · demo hazır" },
  ],

  // --- SUNUM HAFTALARI — bu dashboard'un varlık sebebi ----------------------
  // "claim" = o gün savunduğumuz TEK cümle. Sunumu durum raporundan ayıran şey.
  sunum: [
    { w:2,  ms:"M1", speaker:"EK",
      demo:"Bu dashboard canlı + llm-wiki + pipeline diyagramı + sınıf şeması + küçük-veri stratejisi",
      claim:"TÜSEB önerisini kopyalamadık; gerçek kısıtını (~70 etiketli görüntü) tespit edip yaklaşımı ona göre yeniden tasarladık.",
      fallback:"Wiki markdown'larından üretilmiş slaytlar", ready:true },

    { w:4,  ms:"M2", speaker:"BM",
      demo:"Doldurulmuş data card (70 görüntü) + etiketleme protokolü + annotator uyum skoru + ön işleme öncesi/sonrası + yeni veri durumu",
      claim:"Etiketlerimiz eğitim için yeterince tutarlı — ve bunu kanıtlayan sayı aynı zamanda dürüstçe raporlayabileceğimiz DSC'nin tavanı.",
      fallback:"Protokol + 5 görüntü üzerinde ölçülmüş uyum", ready:false },

    { w:6,  ms:"M3", speaker:"ML",
      demo:"Uçtan uca eğitim: patch pipeline → ön-eğitimli U-Net → tahmin → overlay; loss eğrileri; ilk fold DSC; Cellpose-SAM zero-shot karşılaştırması",
      claim:"Boru hattı gerçek ve tekrarlanabilir; üstelik bir foundation model'in kendi modelimizi yenip yenmediğini şimdiden biliyoruz.",
      fallback:"3 görüntü üzerinde bilinçli overfit — boru hattının doğru kurulduğunu kanıtlar", ready:false },

    { w:9,  ms:"M4", speaker:"ML",
      demo:"5-katlı CV mean ± std karşılaştırma tablosu · seçilen mimari ve gerekçesi · morfometri v1 (iskelet→graf) vs Berke'nin elle ölçümü",
      claim:"Mimariyi moda olduğu için değil, çapraz doğrulama öyle dediği için seçtik — ve ölçümlerimiz bir insanınkiyle uyuşuyor.",
      fallback:"Sadece karşılaştırma tablosu; morfometri 3 görüntüde", ready:false },

    { w:11, ms:"M5", speaker:"ML",
      demo:"Yeni veri dahil sonuçlar · hata analizi (değen hücreler, soluk nöritler, odak dışı alanlar) · Seg-Grad-CAM overlay'leri",
      claim:"Modelimizin nerede başarısız olduğunu biliyoruz ve başarısız olurken neye baktığını gösterebiliyoruz.",
      fallback:"XAI olmadan hata analizi — hata taksonomisi zaten değerli yarısı", ready:false },

    { w:13, ms:"M6", speaker:"ML",
      demo:"Uygulama: gerçek mikroskop görüntüsü yükle → tam pipeline → overlay + ölçülen öznitelikler → rapor dışa aktar",
      claim:"Makine öğrenmesi bilmeyen bir araştırmacı, çevrimdışı olarak bir görüntüyü analiz edip rapor alabiliyor.",
      fallback:"Gerçek pipeline'ı süren CLI demo + mock veriyle UI kabuğu (hangi yarısının gerçek olduğunu açıkça söyle)", ready:false },
  ],

  risks: [
    { id:"R1", text:"Veri seti küçük (~70 görüntü)",                       p:3, i:3, owner:"EK", status:"open",
      mit:"Ön-eğitimli encoder + patch tabanlı eğitim + 5-katlı CV + foundation model baseline (15-SMALL-DATA-STRATEGY)" },
    { id:"R2", text:"Mevcut 70 etiket farklı bir protokolle yapılmış olabilir", p:2, i:3, owner:"BM", status:"open",
      mit:"T1.1'de sor. Uyumsuzsa: ya yeniden etiketle ya protokolü onlarınkine uydur. W6'da öğrenmek haftalara mal olur." },
    { id:"R3", text:"GPU yok / eğitim çok yavaş",                          p:2, i:3, owner:"ML", status:"open",
      mit:"Küçük encoder (ResNet-34) + patch; gerekirse bulut notebook. nnU-Net'e söz vermeden önce çöz (A6)." },
    { id:"R4", text:"Patch sızıntısı → anlamsız ama yüksek DSC",           p:2, i:3, owner:"ML", status:"open",
      mit:"Görüntüye (ideali: kuyuya) göre böl, sonra patch'le. Fold'lar arası kesişim boş mu diye ASSERT yaz." },
    { id:"R5", text:"Yeni veri gecikir / hiç gelmez",                      p:2, i:2, owner:"BM", status:"open",
      mit:"İP7 zaten opsiyonel. Mevcut 70 görüntü tek başına geçerli bir proje; yeni veri bonus genelleme hikâyesi." },
    { id:"R6", text:"Örtüşen/değen hücreler → sayım hatası",               p:3, i:2, owner:"ML", status:"open",
      mit:"Instance segmentasyon (Cellpose-SAM) veya watershed; ayrılamayanı rapor et, gizleme." },
    { id:"R7", text:"12-REFERENCES.md doğrulanmamış — uydurma atıf riski", p:3, i:3, owner:"EK", status:"open",
      mit:"Rapora girmeden önce her kaydı doğrula. O zamana kadar SADECE 14-REFERENCES-VERIFIED.md'den atıf yap." },
  ],

  // Sadece İNDEKS — gerekçeler DECISIONS.md'de yaşar.
  decisions: [
    { id:"D0", title:"Sınıf şeması: background / cell_body / neurite",        w:2, status:"accepted" },
    { id:"D1", title:"Ana model: U-Net ailesi (ön-eğitimli encoder)",         w:2, status:"proposed" },
    { id:"D2", title:"Nörit geometrisi: iskelet + graf (skan)",               w:5, status:"proposed" },
    { id:"D3", title:"Instance ayrımı derinliği",                              w:9, status:"proposed" },
    { id:"D4", title:"Uygulama framework'ü",                                  w:10, status:"open" },
    { id:"D5", title:"Birimler (µm vs px)",                                   w:3, status:"open" },
    { id:"D6", title:"Rotasyon augmentasyonu vs açı metriği",                 w:4, status:"proposed" },
    { id:"D7", title:"Dashboard = statik data.js (data.json değil)",          w:1, status:"accepted" },
    { id:"D8", title:"Atanmış mimari yok; karar W9'da CV ile",                w:1, status:"accepted" },
    { id:"D9", title:"Küçük veri stratejisi (ön-eğitim + patch + 5-fold CV)", w:1, status:"accepted" },
    { id:"D10", title:"Yeni veri partisi ≈ W3 — İP7 artık taahhüt",           w:1, status:"accepted" },
  ],

  // Koşu sonuçları — ELLE yapıştırılır. Sayı yoksa null bırakın, uydurmayın.
  results: [
    // { run:"2026-10-20-unet-r34", model:"U-Net + ResNet34", dscCell:null, dscNeurite:null, clDice:null, folds:5, note:"" },
  ],

  // --- LOG — EN ESKİ ÜSTTE. SONA ekleyin; app.js ters çevirip gösterir. -----
  log: [
    { w:1, text:"llm-wiki kuruldu; TÜSEB NeuroMind temel projesi çözümlendi (proje 44235, 50.000 TL, 12 ay)." },
    { w:1, text:"Veri gerçeği öğrenildi: ~70 etiketli görüntü, ~2 hafta içinde yeni parti. 15-SMALL-DATA-STRATEGY yazıldı (D9)." },
    { w:1, text:"06-DATA: 70/15/15 bölme yerine 5-katlı CV; patch sızıntısı kuralı eklendi." },
    { w:1, text:"07-METRICS: clDice/Betti eklendi; tüm sonuçlar mean ± std; nörit DSC ≥0.90 hedefi gerçekçi değil diye düzeltildi." },
    { w:1, text:"Gantt xlsx incelendi: SUNUM haftaları W2/4/6/9/11/13, W8 vize, W15 final doğrulandı. A1–A3 varsayımları CONFIRMED." },
    { w:1, text:"xlsx'te diğer grupların mimari track'leri bulundu (A1 nnU-Net, A2 DS-UNet+clDice, A3 ViT-UNet) → D8: biz atanmadık." },
    { w:1, text:"13-SUNUM-PLAN yazıldı: her sunum haftası için demo + savunulacak TEK cümle + yedek plan." },
    { w:1, text:"14-REFERENCES-VERIFIED yazıldı: 11 canlı doğrulanmış kaynak. 12-REFERENCES hâlâ DOĞRULANMAMIŞ (R7)." },
    { w:1, text:"03-SEMESTER-PLAN baseline olarak donduruldu; ASCII Gantt silindi (WBS tablosuyla çelişiyordu)." },
    { w:1, text:"Dashboard kuruldu (docs/). Artık haftalık güncelleme sadece bu dosyada (D7)." },
  ],

};
