# 17 — UI & App Research (2026-09-26)

> 5 paralel scout (birincil kaynaklar: resmî dokümanlar, PyPI, GitHub issue
> tracker'ları, arXiv/Crossref kayıtları): **stack** · **UI patternleri** ·
> **hücre similarity** · **HITL/labeling** · **packaging**.
> Her iddia kaynağıyla verildi; doğrulanamayanlar `[UNVERIFIED]`.
> Bu dosya **D4'ü (app framework) çözer** → ADR **D16** (status: proposed).
> Karar alırken okunacak tek dosya budur.

## 0. Yönetici özeti (bottom line)

1. **Mimari: "local website" — ama akıllı.** UI = React/Vite statik frontend;
   inference = **Python/FastAPI + ONNX** (aynı süreç, localhost HTTP);
   kabuk = **pywebview** (Win11'de hazır WebView2) → çift-tık `.exe`.
   Bu, alanın standardı: ilastik/QuPath/napari tam bunu yapıyor
   (Python pipeline'ı bir kabukla sarıyor) — **browser-ın içinde inference
   yapmak kimseyle ortak kanıtımız yok**, ORT Web teknik olarak mümkün ama
   riskli (aşağıda §1/§5).
2. **GPU değil CPU build dağıtılır.** CUDA EP + PyInstaller kırık-by-default
   (#8015, #11826, #7346); ilastik'in 2.4 GB GPU exe'i "CUDA kutuya gömülür"
   deseninin alan standardı olduğunu gösteriyor ama bizde demo makinesi
   bilinmiyor → **CPU = şarjlı batarya, CUDA = opsiyonel ikinci build**.
3. **Üç cesur, shippable UI fikri (sıralı, toplam ≈ 6–9 hafta):**
   (1) **"Watch it think"** — yükle→maske karolar halinde canlı akar→NTI
   sayar (2–3 hf); (2) **Before/After Toxicity** senkron çift görüntü +
   kaydırılabilir ayırıcı (1–2 hf); (3) **3D "Neuron Room"** — Three.js ile
   döndürülebilir nörit grafı, dal başına morfometri (2–4 hf).
4. **Hocanın "hücreler arası similarity" fikri = alanın kanonik pratiği.**
   Feature-vectör PCA/UMAP + mesafe (Zinsstag 2017, CellProfiler, cytominer)
   — bu yarıda **öğrenmiş embedding YAPMAYIN** (DeepProfiler ağırlıkları 5
   kanallı Cell Painting'e özgü; n≈100–300 hücrede fine-tune literatürün
   altına düşer). UI'da 4 panel: UMAP atlası, k-NN inspector, koşul-mesafe
   çubukları (yalnızca betimleyici), outlier/QC bayrağı.
5. **App aynı zamanda labeling iş istasyonu** olur (Cellpose'un `_seg.npy`
   deseni + Label Studio'nun `prediction`/`annotation` iki-şemalı ayrımı +
   VessQC'nin belirsizlik-kuyruğu: hat tespiti recall'ı 67%→94%, p=0.007).
   Bu, W9–W11 batch-2 etiketleme yükünü fiilen azaltır ve `16` §5-11
   (active-labeling loop) planının somut arayüzü olur.

---

## 1. Stack kararı (D4 → D16)

### Adaylar ve ölçütler (2026-09-26 doğrulanmış)

| Ölüt | PySide6/Qt | **React + FastAPI + pywebview** | Tauri v2 + sidecar | Electron | ORT Web (in-browser) |
|------|-----------|--------------------------------|--------------------|----------|----------------------|
| 2 öğrenciye dev hızı | Düşük (Qt styling yavaş) | **Yüksek (hot-reload, CSS)** | Orta (Rust öğrenilir) | Orta | Yüksek ama inference'u yeniden doğrulamalı |
| Demo "imaj" | Orta | **Yüksek** | Yüksek | Yüksek | Yüksek |
| Offline (lab PC) | İyi | **İyi (hepsi localhost)** | İyi (WebView2 offline modu +127–180 MB) | İyi | CDN'leri vendor'lamak şart |
| Windows paketleme | En ağır (Qt DLL'leri; onedir ≈150–250 MB `[INFERRED]`; Qt kendi dokümanında PyInstaller'a "partial" der) | **En hafif (~100 satır kabuk, PyInstaller onedir)** | Hafif kabuk (<600 KB) ama Rust toolchain + NSIS | En şişirici (Chromium bundle) | Kabuksuz ama sürücü riski |
| Python pipeline'a dikiş | Aynı süreç | **localhost HTTP** | localhost HTTP (resmî sidecar dokümanı bu deseni isimli isim veriyor) | localhost HTTP | ikinci inference runtime |
| Sahne kanıtı | ilastik, napari (Qt) | alan standardının web yansıması | Tauri resmî sidecar dok. | referans repo var | SAM browser örneği |

Doğrulanan sayısal gerçekler:
- `pyside6-essentials` 6.11.2 win wheel = **76.9 MB** (PyPI) — frozen onedir
  ≈150–250 MB, ONNX/NumPy/CV olmadan `[INFERRED]`. Kaynak:
  <https://pypi.org/pypi/pyside6-essentials/json>,
  <https://doc.qt.io/qtforpython-6/deployment/index.html>
- `onnxruntime` (CPU) wheel = **14.3 MB**; `onnxruntime-gpu` = **160.5 MB**
  + hedef makinede CUDA/cuDNN (ya da 1.21+ ile `onnxruntime-gpu[cuda,cudnn]`
  + `preload_dlls()` ile kutuya gömme). Kaynak:
  <https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html>
- PyInstaller+PySide6: Qt resmî dokümanı `--onefile`'ı güvenilir saymıyor,
  system-PySide6'yi sessizce seçme tuzağı var:
  <https://doc.qt.io/qtforpython-6/deployment/deployment-pyinstaller.html>
- PyInstaller + ONNX CUDA EP: #8015 / #11826 / #7346 (error-126, provider
  yüklenmiyor) — düzeltme deseni: DLL'leri bundle'a koy + `preload_dlls()`.
  Kaynak: <https://github.com/microsoft/onnxruntime/issues/8015> ve diğeri.
- Tauri v2: resmî sidecar dokümanı "Python API server'ları PyInstaller ile
  bundle'la" der; Windows NSIS/WiX installer; WebView2 offline
  `offlineInstaller`/`fixedVersion` gerekir. Kaynak:
  <https://v2.tauri.app/develop/sidecar/>,
  <https://v2.tauri.app/distribute/windows-installer/>,
  hazır örnek: <https://github.com/dieharders/example-tauri-v2-python-server-sidecar>
- pywebview: WinForms+WebView2 (browser bundle'lamaz), dahili HTTP sunucu,
  PyInstaller freeze kılavuzu tek satır. Kaynak:
  <https://pywebview.flowrl.com/guide/freezing.html>
- ORT Web: WebGPU EP cross-vendor; Windows Chrome/Edge ≥113, Firefox Win
  ≥141; resmî SAM örneğinde **encoder ~45 sn WASM / ~200 ms WebGPU** —
  U-Net sınıfta "mümkün" ama ORT Web kendi dokümanında küçük/quantized model
  öneriyor. Kaynak:
  <https://onnxruntime.ai/docs/tutorials/web/>,
  <https://onnxruntime.ai/docs/execution-providers/WebGPU-ExecutionProvider.html>,
  <https://github.com/microsoft/onnxruntime-inference-examples/blob/main/js/segment-anything/README.md>
- Alan standardı: ilastik Windows **≈500 MB CPU** / **2.4 GB GPU** (CUDA
  kutuda); QuPath jpackage'lı native. Kaynak:
  <https://www.ilastik.org/download>, <https://github.com/qupath/qupath>
- Napari'nin tarayıcı/WASM versiyonu **sadece 2025 roadmap** — bu yarıda
  "napari'yi web'e koy" diye bir şey yok:
  <https://napari.org/stable/roadmaps/active_roadmap.html>

### Karar önerisi (D16): **React + Vite + FastAPI + ONNX(CPU) + pywebview**

- Neden: pipeline'ın dikiş yüzeyi en basit (localhost HTTP), UI iterasyonu
  en hızlı (hot-reload), demo görünümü en yüksek (canvas/WebGL katmanları),
  kabuk maliyeti ≈100 satır, TUSEB kanonundaki "offline masaüstü" şartını
  karşılar (her şey localhost'ta; internet gerekmez).
- Tauri = "installer şıklığı gerekirse" upgrade yolu (aynı UI, aynı backend);
  bu yarıda Rust öğrenilmeyecek.
- PySide6 yalnızca "tek dilde kalalım" ısrarıyla seçilir — ve kabul edelim:
  aynı görsel etki için 3–6 hafta fazla UI işi (scout'un 3. sırası).
- In-browser inference **reddedildi**: ikinci runtime doğrulaması, lab
  makinesinde WebGPU sürücü riski, ve alan standardının tersi. (D16.)

### Hedef depo yapısı (WP6 için)

```
app/
  server/            FastAPI: /infer, /image, /export, /label (sonra)
    main.py
    pipeline.py      S0–S5 (mevcut pipeline'a dikiş)
    onnx_session.py  CPU EP; GPU: ONNX_CUDA=1 env ile ayrı build
  static/            Vite build çıktısı (React + canvas)
    index.html, assets/
  models/            *.onnx (CPU-quantized opsiyon)
launcher/
  run.bat            pythonw + sunucu + tarayıcı/pywebview penceresi
  build.bat          PyInstaller onedir spec'i
```

---

## 2. UI konsepti & etkileşim patternleri

### Omurga (her bilim-imajcısından ortak çıktı — 6 araç tarandı)

1. **Canvas merkezli, paneller ince** — görüntü ekranın ≥%70'i; gerisi dar
   panel (QuPath, napari, CVAT).
2. **Her şey toggle'lanabilir katman** — raw / mask / skeleton / uncertainty /
   labels; katman başına eye-toggle + opacity + colormap + solo kısayolu
   (napari layer list; ilastik layers). Bu, mask-over-image işinin evrensel deseni.
3. **Canlı geri bildirim** — "model önünde düşünüyor" deseni: QuPath live
   update, ilastik live update + uncertainty katmanı, CVAT auto-annotation
   progress bar, Cellpose progress. **Demoda duygusal çekirdek bu.**
4. **Obje listesi ↔ kamera bağı** — ilastik Label Explorer / QuPath
   hierarchy: hücre satırına tıkla → kamera uçar, metrik panel dolar; piksele
   tıkla → satır vurgulanır.
5. **Overview minimap + canlı scale bar** — QuPath; projeksiyonda ölçek kaybı
   olmadan demosuzluk olmaz.
6. **Senkron multi-view** — QuPath View→Multi-View: pan/zoom birden çok
   görüntüye akar. "Sağlıklı vs. muameleli"nin doğrudan deseni.
7. **Window/level fare-drag ile** — ilastik: sağa-sola = level, ileri-geri =
   width. Faz-kontrastta slider'dan hızlı.
8. **Punto tipografi yalnız sayısal okumalarda** (µm barı, NTI, count'lar) —
   "precision instrument" hissi (scout önerisi, alan taraması değil).

Taranan araç başına kaynaklar: napari
(<https://napari.org/stable/getting_started/viewer.html>,
`/stable/howtos/layers/image.html`, `/stable/howtos/themes.html`), QuPath
(<https://qupath.readthedocs.io/en/latest/docs/starting/first_steps.html>,
`/docs/starting/viewing.html`, `/docs/tutorials/cell_classification.html`),
CVAT (<https://docs.cvat.ai/docs/annotation/auto-annotation/ai-tools/>,
`/docs/annotation/annotation-editor/layers/`, `/docs/qa-analytics/`),
ilastik (<https://www.ilastik.org/documentation/pixelclassification/pixelclassification>,
`/documentation/basics/navigation`, `/documentation/basics/layers`),
Cellpose GUI (<https://cellpose.readthedocs.io/en/latest/gui.html>),
Cellpose web Space (<https://huggingface.co/spaces/mouseland/cellpose>),
Imaris (<https://imaris.oxinst.com/imaris-viewer>,
`/products/imaris-for-neuroscientists`), OpenSeadragon
(<https://openseadragon.github.io/>).

### Cesur ama shippable 3 konsept (sıralı)

**#1 — "Watch it think": canlı kademeli inference** *(2–3 hf, saat başına en yüksek etki)*
Görsel sürükle-bırak → FastAPI tiled inference → maskeler karolar halinde
akarak doluma başlar → önce belirsizlik alanı mavi kırpırdar (ensemble
varyansı, `16` §4) → 4 morfometrik parametre + NTI **sayarak** dolar.
Sağ tık + CVAT-style pozitif/negatif nokta interactor ile "bu soma'yı
yeniden segmente et". Öncüleri: Cellpose HF Space (upload→progress→masks),
CVAT auto-annotation progress, ilastik live-update. **Her demoyu 30 sn'lik
bir "reveal"e çevirir ve XAI/belirsizlik işini direkt sahneye koyar.**

**#2 — "Before/After Toxicity": senkron dual-viewer + kaydırılabilir ayırıcı** *(1–2 hf — en ucuz wow)*
Sağlıklı kontrol + muameleli görsel tek senkron viewport'ta (paylaşılan
transform), sürüklenebilir karşılaştırma slider'ı, hücre başına NTI delta
rozet'i, altta kohort filmstrip (70 görsel; CVAT reference-strip tarzı).
Zaman serisi verisi gelince **temporal view**'un doğal evi bu ekran
(TUSEB kanonunun "temporal visualization modülü"). Öncüleri: QuPath
multi-view, OpenSeadragon compare plugin'leri.

**#3 — 3D "Neuron Room": döndürülebilir nörit grafı** *(2–4 hf — en "pahalı yazılım" hissi)*
Three.js sahne: her nörit dalağı = boy kodlu tüp (renk = dal level'ı veya
uzunluk), dallanma noktaları tıklanabilir küre (açı okuması açılır), soma =
yüzey; altta "lab slide" olarak eğik 2D görsel düzlemi; napari deseniyle
2D/3D toggle. Dört hedef parametrenin hepsini tek sahnede gösterir — Imaris
for Neuroscientists'ın (segment length/orientation, branch level, spine
density) web karşılığı. Dürüst sınır: PC12 alanları genelde 2D → "eğik slide"
(2.5D) sunumu; Z-stack varsa gerçek 3D. Öncüleri: Imaris, Neuroglancer
(<https://neuroglancer-demo.appspot.com/>), napari 2D/3D toggle.

Sıralama: **#2 önce** (1–2 hf, layout'u sabitler) → **#1** (2–3 hf, imza
an) → **#3** (2–4 hf, kapanış vuruşu). Her biri ayrı demo'lanabilir; toplam
≈6–9 hafta @ 10–15 hf/hafta → yarıya sığar.
Runner-up (zaman varsa): **kohort atlası** — tüm hücrelerin NTI/feature
uzayında deck.gl scatter'ı; noktaya tıkla → görsel, Plotly lasso ile
alt-popülasyon seçimi (2–3 hf; batch-2 hikayesiyle birleşir).

Tasarım dili: Dracula ailesi koyu tema (QuPath'in stil dokümanı doğrudan
dracula-theme'a link veriyor; napari'de WCAG tablosu ile tematik sistem),
koyu canvas + doygun etiket renkleri, sayısal okumalarda monospace.

---

## 2b. Concurrency & performance (kullanici sartı, 2026-09-26) `[PLANNED]`

> Kullanici gereksinimi: görsel yukleme + model isleme vakit alir; **kullanici
> cok bekletilmez** — yuklemeler ve model calismasi arka plandaki is
> parcalariyla paralel yapilir, UI her an akıcı kalir. Bekleme payi sifirlanir.

- **Backend:** agir is (decode, tile inference, morfoloji, UMAP, batch)
  FastAPI request handler'inda degil, `jobs.py` worker kuyrugunda calisir;
  `POST /infer` → `202 {job_id}`, ilerleme **SSE** ile akar (`/events?job_id=`).
  Ayni gorselin yeni job'u eskisini supersede eder; farkli gorseller paralel kosar.
- **Preload:** app acilir acilmaz ONNX session'ı arka planda hazir olur;
  ilk gorselde ek gecikme yok.
- **Streaming tiling:** her 256×256 karonun maskesi biter bitmez UI'a akar
  → ekranda karo karo dolus = U1 "watch it think" animasyonunun kendisi
  (ayri animasyon sahteciligi gerekmez).
- **Cache:** kohort filmstrip (70 gorsel) sonuclari bir kez hesaplanir,
  `cache/`'ta tutulur; taze degilse eski cache'le baslar, arka planda yeniden hesaplar.
- **Frontend:** gorsel decode + kademeli canvas cizimi worker/rAF'te;
  pan/zoom/slider 60fps; bos "yukleniyor..." ekranı **yasak** — her bekleme anı
  bir ilerleme anıdır (sayaç/progress/kirpirti) + iptal düğmesi.
- **Kabul ölçütü:** 2048² gorsel islenirken filmstrip kaydirilabilir, pan/zoom
  takilmaz; sonuc katmanlari karo karo dolar.

Uygulama tarafında tam sozlesme (endpoint'ler + JSON sekli): `../CLAUDE.md` §4.

## 3. Hücre similarity (hocanın fikri — literatür + ne inşa edilir)

### Bilimsel zemin (2026-09-26 Crossref/OpenAlex/arXiv ile doğrulandı)

- **Feature-vectör benzerliği kanonik standarttır.** HCS'de imaj-based
  profiling = QC → normalize → PCA/UMAP → mesafe/kümeleme; öğrenmiş
  embedding GEREKMEZ: Zinsstag et al., *Nat Methods* 2017 —
  <https://doi.org/10.1038/nmeth.4397>; CellProfiler (hücre başına ~1000
  feature) — <https://doi.org/10.1186/gb-2006-7-10-r100>; cytominer
  (koşul arası fenotipik mesafenin purpose-built R paketi) —
  <https://doi.org/10.32614/cran.package.cytominer>.
- **Öğrenmiş embedding'in referans uygulaması:** DeepProfiler (EfficientNet,
  hücre crop'ları → embedding; Luth et al., *Nat Commun* 2024 —
  <https://doi.org/10.1038/s41467-024-45999-1>, kod
  <https://github.com/cytomining/DeepProfiler>). ⚠ Hazır ağırlıklar
  **5-kanallı Cell Painting**'e özgü — tek kanallı faz-kontrast crop'ları
  kapsam dışı `[INFERRED, repo CITATION.cff + dokümanla doğrulandı]`.
- **Batch confounding uyarısı:** farklı gün/plaka/görüntü seansı, koşul
  etkisini feature uzayında boğabilir — koşul-mesafe iddiası batch'i
  düzeltmeden geçersiz: *Nat Commun* 2024 —
  <https://doi.org/10.1038/s41467-024-50613-5>.
- **Yakın literatür (alıntılanabilir):** Cell Painting on yılı
  <https://doi.org/10.1038/s41592-024-02528-8>; kontrastif öğrenme ile
  koşul karşılaştırması *PLoS Comput Biol* 2024 —
  <https://doi.org/10.1371/journal.pcbi.1012547>; hücre health phenotype
  benzerliği *Mol Biol Cell* 2021 <https://doi.org/10.1091/mbc.e20-12-0784>
  ve BioMorph 2024 <https://doi.org/10.1091/mbc.e23-08-0298>.

### Ne inşa edilir (4 panel — tamamı mevcut morfometri çıktısıyla beslenir)

1. **UMAP atlası** — tüm hücreler, standartlaştırılmış feature vectörü
   (uzunluk, dallanma, açı profili, soma alanı/dairelilik/eksantriklik +
   NTI); koşul/kuşak (batch) ile renklenir. (Zinsstag/cytominer deseni.)
2. **k-NN inspector** — hücreye tıkla → en yakın 5 hücre (crop'ları +
   mesafeleri) ve "en yakın sağlıklı hücreden X uzaklık" okuması.
3. **Koşul-mesafe çubukları** — koşul çiftleri arası dağılım mesafesi
   (örn. kontrol↔H₂O₂ 100 µM); **yalnızca betimleyici** etiketi + batch-drift
   uyarısı.
4. **Outlier bayrağı (QC)** — robust eşikle (medyan+MAD) "bu hücre kohorttan
   sapıyor" → QC çerçevesi, "toksik" hücre iddiası **değil**.

**Dürüst sınırlar (rapora yazılacak):** n≈100–300 hücre/koşulde bunlar
**betimleyici görselleştirme + QC**'dir; 3+ teknik tekrar olmadan
p-değeri iddiası yok. **Öğrenmiş embedding bu yarıda YAPILMAZ** (DeepProfiler
ağırlıkları Cell Painting'e kilitli; bu n'de fine-tune literatür eşiğinin
altında). İleriye: batch-2 + O1 metadata'ı kesinleşirse, kontrastif bir
hücre-crop encoder'ı `10-IDEAS-STRETCH`'te `[IDEA]` olarak bekler.

---

## 4. Labeling iş istasyonu (HITL + active learning)

> App'in ikinci kişiliği: W9–W11 batch-2 etiketlemesinde (WP3.1) ve W4
> çift-etiket IAA ölçümünde fiilen kullanılacak.

### Kopyalanacak desenler (hepsi doğrulandı)

| Desen | Kaynak araç | Nerede kullanılır |
|-------|-----------|-------------------|
| `_seg.npy` deseni: düzeltme otomatik, görselin yanına dosya olarak yazılır; training bu dosyaları `--mask_filter` ile yer | **Cellpose** GUI (Nature Methods 2022, <https://www.nature.com/articles/s41592-022-01663-4>) | offline, dosya-tabanlı akış — bizde: `labels/` klasörü, versioned |
| **`prediction` (değişmez, score + model_version taşır) vs `annotation` (değişir)** iki-şemalı ayrımı; düzeltme geçmişi = diff'i | **Label Studio** (<https://labelstud.io/guide/predictions>, <https://labelstud.io/guide/ml>; `/api/ml/{id}/train` = düzeltilen etiketlerin geri akması) | review kuyruğu veritabanı şeması |
| Review modu: çizim araçları gizli, sadece Issue aracı + sağ-tık "Quick issue"; tam klavye kısayolu sistemi | **CVAT** (<https://docs.cvat.ai/docs/qa-analytics/manual-qa/>, <https://docs.cvat.ai/docs/getting_started/shortcuts/>) | "model önerdi → insan kontrol etti" ekranı |
| Maske edit primitifleri: sağ-tık çiz, Ctrl+click sil, Alt+click birleştir, Ctrl+Z undo | **Cellpose GUI** (<https://cellpose.readthedocs.io/en/latest/gui.html>) | mask editor (canvas) |
| **Belirsizlik-kılavuzlu review kuyruğu**: uncertainty → bağlı bölgeler → her bölgeye belirsizlik + voxel sayısı + işlem durumu; kullanıcı çalışması hat tespiti recall'ını **%67→%94 (p=0.007)**'ye çıkarıp toplam süreyi artırmadan | **VessQC** (napari plugin, <https://github.com/MMV-Lab/VessQC>, <https://arxiv.org/abs/2511.22236>) | kuyruk sıralaması — doğrudan `16` §4 ensemble U'su ile |

### Active learning sorgu stratejisi (literatür kanıtı)

- **nnActive** (TMLR 2025, <https://arxiv.org/abs/2511.19183>, kod
  <https://github.com/MIC-DKFZ/nnActive>): 8 yöntem × 4 veri seti; tüm AL
  random'ı yener ama **hiçbiri Foreground-Aware Random'ı güvenilir şekilde
  geçmez**; Predictive Entropy en iyi tekil yöntem ama en etiket açıktır.
- **TMLR 2026**: class-stratified scheduled power-noised PE (**ClaSP PE**)
  random'ı **tutarlı** geçiren ilk yöntem (<https://arxiv.org/abs/2601.13677>).
- **Sıralama kanıtı:** önce belirsizlik, sonra representativeness (UMAP)
  hibriti +3.2–4.5% Dice (<https://arxiv.org/abs/2312.10361>) — `16`'daki
  **topoloji-farkında AL** planıyla birebir uyumlu: entropi ince yapıya kör,
  Betti uyuşmazlığı terimini ekleyip representativeness geçişinden sonra
  etiketleneni seç.
- Evidential (Dirichlet) belirsizlik, piksel hatasıyla Shannon entropisinden
  iyi korele (<https://arxiv.org/abs/2410.18461>) — `08-XAI`'de evidential'ı
  "AT" etmiştik; AL kuyruğu gerekçesiyle **yeniden gözden geçirilebilir**
  (karar: `08-XAI` §2 notu, D16'ya bağlı değil).
- Ucuz weak-label alternatifi: YOLOv8+SAM box + MC-Dropout seçimi, >%90
  etiket süresi tasarrufu (<https://arxiv.org/abs/2405.01701>).

### IAA (Dice-IAA ≥ 0.80 / ICC ≥ 0.85) — hazır off-the-shelf araç YOK

- Doğrulama: iki anotörün aynı görsel maskelerinden Dice-IAA veren tek açık
  araç bulunamadı; alan normali = UI'da consensus merge (CVAT) + **kendi
  scriptimiz** (NumPy'da satır birimi — pixel-wise Dice, merkeze/IoU'ya göre
  instance eşleştirme). Öncü: cilt lezyonu IAV çalışması (Dice-tabanlı,
  açık kod) <https://arxiv.org/abs/2508.09381>, <https://github.com/sfu-mial/skin-IAV>.
- ICC: `pingouin.intraclass_corr` (ICC(A,1) + %95 CI, R `psych` ile
  doğrulamalı) — hücre-bazlı sürekli özelliklere (uzunluk, alan) uygulanır:
  <https://github.com/raphaelvallat/pingouin>.
- Pratik: 20 görsel alt küme çift-etiket → tek geçişte hem Dice-IAA hem
  özellik-bazlı ICC.

### Review kuyruğu ekranı (1 ekran taslak)

- Sol: kuyruk — görsel + belirsizlik skoru (ensemble varyansı + Betti
  uyuşmazlığı) + durum (pending/approved/corrected); sıralama = AL skoru.
- Orta: canvas — görsel + `prediction` katmanı (sarı, değişmez) +
  `annotation` katmanı (yeşil); mask edit primitifleri (Cellpose seti).
- Sağ: hücre listesi ↔ kamera bağı + "Accept" / "Issue" (CVAT quick-issue
  taksonomisi: incorrect position / incorrect attribute) +
  model_version rozeti.
- Akış: onay/düzeltme → `labels/`'a versioned dosya → training pipeline'ı
  `--mask_filter` eşdeğeriyle okur (Label Studio `/train` deseninin
  offline hali).

---

## 5. Packaging & dağıtım

- **Dağıtılacak artifact = CPU build.** `onnxruntime` 14.3 MB; yama
  başına CPU'da ~yüzde-ileri saniye `[INFERRED] — ölçülecek`. GPU =
  `ONNX_CUDA=1` ile ayrı build, DLL'ler kutuda + `preload_dlls()` (ilastik
  deseni, ama W14–15'te sadece zaman kalırsa).
- **Kullanıcı deneyi:** `run.bat` (veya pywebview `.exe`) → sunucu
  ayağa kalkar → pencere `http://localhost:PORT`'te açılır → sağlık
  kontrolü (backend up mı) pencere açılmadan çalışır (React+FastAPI
  paketleme kılavuzundaki desen:
  <https://salkarveda.com/blogs/blog-detail?slug=from-code-to-installable-software-how-to-package-a-react-python-application>).
- **Bilinen tuzaklar (dokümante):** PyInstaller `--windowed`'de
  `sys.stdout/stderr` = None (devnull'a sar); `multiprocessing.freeze_support()`
  zorunlu; FastAPI `StaticFiles` yolu onefile'da kırılır → **onedir** mod +
  bundle root'tan path çözümleme (<https://github.com/fastapi/fastapi/issues/11707>);
  Swagger CDN'si internette → `fastapi-offline`
  (<https://pypi.org/project/fastapi-offline/>) — statik frontend zaten
  offline-by-construction.
- **Tauri yükseltme yolu:** NSIS installer + imzalı kurulum gerekirse aynı
  UI/backend taşınır (`bundle.externalBin` sidecar) — karar zamanı gelir.

---

## 6. Yapılmayacaklar (risk listesi)

| Reddedilen | Neden (kanıt) |
|-----------|---------------|
| In-browser ORT Web'ı production inference olarak | ikinci runtime doğrulaması; WebGPU sürücü riski (bilinmeyen lab PC); ORT Web'in kendi performans dokümanı "küçük/quantized model" diyor; alan standardı Python-side inference |
| Electron | Chromium bundle'ı (milyarlarca bayt fazlası) Tauri/pywebview'in üstünde hiçbir avantaj vermiyor |
| GPU build'i birincil artifact | #8015/#11826/#7346 + 160 MB wheel + hedef makinedeki CUDA sürümü; demo-ölümü senaryosu; ilastik bile bunu ikinci build yapıyor |
| Bu yarıda öğrenmiş hücre-embedding | DeepProfiler ağırlıkları 5-kanal Cell Painting'e kilitli; n≈100–300 hücrede fine-tune = ezberleme riski, literatür eşiğinin altında |
| Koşul-mesafesi üzerine p-değeri iddiası (3+ teknik tekrar yoksa) | *Nat Commun* 2024 batch-drift uyarısı; n küçük → yalnız betimleyici + QC çerçevesi |
| PySide6'ya sonradan geçiş | UI işinin büyük kısmı web'te yazıldıktan sonra Qt'e taşınmak = W14–15'te yeniden yazım; D16 ile ilk günden tek yol |

---

## 7. Karar ve bir sonraki adım

- **D16 yazıldı** (`DECISIONS.md`, status: **proposed** — kullanıcı onayıyla
  accepted olur). D4'ü (app framework) **supersede** eder.
- Onay gelirse WP6 satırları güncellenir: WP6.1 "web shell (React) +
  FastAPI", WP6.3 "ONNX CPU packaging + pywebview `.exe`". Cesur 3 konsept
  + similarity tab'ı + labeling kuyruğu `10-IDEAS-STRETCH`'e satır olarak
  girer (onayla birlikte).
- W13 SUNUM'u etkilenmez: WP6.3 hâlâ W14–15'te; UI shell W9–11'de mock
  veriyle, W13'te gerçek çıktıyla gösterilir — bu araştırma shell'in
  **içeriğini** (hangisi demo anı) netleştirdi, takvimi değil.

## Kaynak dizini (tümü 2026-09-26'ta canlı erişildi)

**Stack/packaging:** Qt deployment dokümanları (index/nuitka/pyinstaller/
pyside6-deploy, doc.qt.io) · PyPI: pyside6-essentials, onnxruntime,
onnxruntime-gpu · PyInstaller 6.22.3 changelog + common-issues ·
onnxruntime issues #8015/#11826/#7346 · CUDA/DirectML EP dokümanları ·
Tauri v2 (sidecar, windows-installer, start) + dieharders örnek repo ·
pywebview (guide, freezing, installation) · fastapi#11707 ·
fastapi-offline · salkarveda React+FastAPI paketleme kılavuzu ·
ilastik download · QuPath GitHub · napari active roadmap ·
onnxruntime-inference-examples (js/segment-anything) · WebGPU EP dokümanı +
gpuweb implementation-status · VTK.js dokümanları.

**UI patternleri:** napari (viewer, layers/image, layers/labels, themes) ·
QuPath (first_steps, viewing, measurements, object_hierarchy,
cell_classification, styling) · CVAT (editor, layers, ai-tools,
automatic-annotation, qa-analytics) · ilastik (navigation, layers,
pixelclassification) · Cellpose (gui, train) · Cellpose HF Space · Imaris
(viewer, for-neuroscientists) · OpenSeadragon · deck.gl · Plotly.js ·
Three.js · WebGPU MDN · ONNX Runtime web dokümanı · Neuroglancer.

**Cell similarity:** Zinsstag 2017 (10.1038/nmeth.4397) · CellProfiler
(10.1186/gb-2006-7-10-r100) · cytominer (10.32614/cran.package.cytominer) ·
batch correction (10.1038/s41467-024-50613-5) · DeepProfiler
(10.1038/s41467-024-45999-1 + GitHub) · Cell Painting on yılı
(10.1038/s41592-024-02528-8) · PLoS CB 2024 (10.1371/journal.pcbi.1012547) ·
Mol Biol Cell 2021 (10.1091/mbc.e20-12-0784) + BioMorph 2024
(10.1091/mbc.e23-08-0298) · CVPR 2018 (10.1109/cvpr.2018.00970) ·
bioRxiv 2023 (10.1101/2023.06.16.545359) · bioRxiv 2025
(10.1101/2025.06.05.658097) · CellSeg3D (10.7554/elife.99848) · CellSAM
(10.1038/s41592-025-02879-w) · CellViT++ (arXiv 2501.05269).

**HITL/AL:** Cellpose GUI + train dokümanları + Nature Methods 2022
(10.1038/s41592-022-01663-4) · CVAT (shortcuts, manual-qa, consensus) ·
Label Studio (predictions, ml) · VessQC (arXiv 2511.22236 + GitHub) ·
micro-sam (GitHub) · Zhu 2024 (arXiv 2405.01701) · nnActive (arXiv
2511.19183 + GitHub) · ClaSP PE (arXiv 2601.13677) · evidential
(2410.18461) · UMAP-AL hibrit (2312.10361) · skin IAV (2508.09381 + GitHub) ·
pingouin (GitHub).

⚠ `[UNVERIFIED]` kalanlar: STAR proje sayfası (404 — repo + DOI ile
doğrulandı) · Electron boyut rakamları (mimari çıkarımı) · Labelme/VIA
repo'ları (404 — UX referansı olarak kullanılmadı).
