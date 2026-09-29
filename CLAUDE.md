# CLAUDE.md — IntelliCell UI Geliştirme Kaynağı

> Bu dosya, UI tasarım/uygulama haftasında (T5.1 W10–11 iskelet → T5.3 W13–14 entegrasyon)
> **Claude'a verilecek tek kaynak dosya**dır. Detaylı gerekçeli araştırma: `llm-wiki/17-UI-RESEARCH.md`.
> Önceki projeden aktarılacak özellikler: `llm-wiki/18-PREVIOUS-FEATURES.md`.
> Karar geçmişi: `llm-wiki/DECISIONS.md` (özellikle **D16**, **D14**). Bu dosya ile wiki çelişirse
> **wiki kazanır** ve bu dosya güncellenir.

## 1. Proje (3 satır)

PC12 nöral hücre mikroskopi görüntülerinden (faz-kontrast ± floresan) soma ve nöritleri
segmente edip **4 NTI parametresini** ölçeriz: ① nörit uzunluğu, ② dallanma sayısı,
③ dallanma açısı dağılımı, ④ soma morfolojisi → bunlar **Neural Toxicity Index (NTI)**
sürekli skoruna birleşir. Çıktı: **offline masaüstü uygulaması** (IntelliCell).
Konsept kanonu TÜSEB 2026 başvurusudur (D14) — amac/kapsam değişmez, mimari bizim.
Veri: n≈70 etiketli görsel (batch-2 W9'da gelir); **model henüz yok** → UI önce mock data ile.

## 2. Stack — KARARLI (yeniden tartışma yok; D16)

- **React + Vite** (statik frontend, canvas tabanlı görüntü katmanı)
- **FastAPI** (Python backend, mevcut pipeline'a dikiş) — localhost HTTP
- **ONNX Runtime, CPU build birincil artifact** (GPU = `ONNX_CUDA=1` ile ikinci, opsiyonel build)
- **pywebview** kabuk → çift-tık `.exe` (PyInstaller **onedir**, onefile değil)
- Reddedilenler ve nedenleri `17` §1/§6'da: PySide6 (görsel etki başına 3–6 hf fazla UI işi),
  in-browser ORT Web (ikinci inference runtime + WebGPU sürücü riski, bilinmeyen lab makinesi),
  Electron (Chromium şişkinliği), GPU build birincili (PyInstaller+CUDA kırık-by-default).

### Hedef depo yapısı

```
app/
  server/
    main.py            FastAPI: /infer, /image, /layers, /export, /label, /events (SSE)
    pipeline.py        mevcut pipeline'a (S0–S5) dikiş
    onnx_session.py    CPU EP; lazy load; tek session tüm isteklerde paylaşılır
    jobs.py            worker kuyruğu + job state (aşağıda §4)
  static/              Vite build çıktısı (React)
  models/              *.onnx
launcher/
  run.bat / build.bat
```

## 3. UI kapsamı ve sıralama

**Sıralama: U2 → U1 → U3** (layout'u sabitle → imza an → kapanış vuruşu). U4/U5 veriyle birlikte.
Detay `llm-wiki/10-IDEAS-STRETCH.md` "UI & App" tablosu.

| Öncelik | Ekran/konsept | İçerik |
|---------|---------------|--------|
| **U2** | **Before/After Toxicity** | Sağlıklı+muameleli senkron dual-viewer (paylaşılan pan/zoom), kaydırılabilir karşılaştırma slider'ı, hücre başına NTI delta rozeti, altta kohort filmstrip (70 görsel). Temporal view'un evi. |
| **U1** | **Watch it think** | Sürükle-bırak → maskeler karolar halinde canlı akar → belirsizlik alanı mavi kırpırdar → 4 parametre + NTI **sayarak** dolar. SSE ilerleme akışının sahne versiyonu. |
| **U3** | **3D Neuron Room** | Three.js: nörit dalağı = boy kodlu tüp, dallanma = tıklanabilir küre (açı okuması), soma = yüzey, eğik 2D slide; 2D/3D toggle. |
| **U4** | **Hücre similarity tab'ı** | UMAP atlas (feature-vectör, koşul renkli) + k-NN inspector + koşul-mesafe çubukları (**yalnız betimleyici**, batch-drift uyarısıyla) + outlier/QC bayrağı. **Öğrenmiş embedding YOK.** |
| **U5** | **Labeling iş istasyonu** | Belirsizlik-sıralı review kuyruğu, `prediction`/`annotation` iki-şemalı ayrım, `_seg.npy` akışı, mask edit (sağ-tık çiz / Ctrl+click sil / Alt+click birleştir / Ctrl+Z). W9–11 batch-2 etiketlemesi + W4 IAA bu ekran. |
| — | **Önceki projeden KEEP'ler** (18 §D) | QC paneli (blur/Canny/low-conf/FG oranı + uyarı kuralları), numaralı soma + alan kategorisi, skeleton+junction+uzunluk, açı okları, **ROI analiz**, sonuç kartları (mean/median/std/CV + export txt/CSV), confidence heatmap, CDF+polar+scatter, batch queue, klasik filter stack (CLAHE/contrast/unsharp/gamma — **GAN YOK**). |

## 4. ⚡ Concurrency & performance — BİRİNCİ SINIF ŞART

> **Kural: kullanıcı hiçbir zaman donmuş ekran beklemesin.** Yüklemeler arka tarafta
> işlenir; UI thread'i (hem tarayıcı tarafı hem FastAPI tarafı) her an responsive kalır.
> Bekleme payı sıfırlanır: işler paralel akar, ilerleme canlı görünür.

### Backend (FastAPI + Python)

1. **Ağır iş hiçbir zaman request handler içinde çalışmaz.** Görsel yükleme/decode,
   tile inference, morfometri çıkarma, UMAP hesaplama, batch işleme — hepsi
   `jobs.py`'deki worker havuzunda (`asyncio.to_thread` / process pool; CPU-bound
   morpho için `ProcessPoolExecutor` ya da job başına worker thread, GIL'e dikkat):
   ```
   POST /infer  →  202 {job_id}  (asenkron; asla inference'ı bekleyip dönmek YOK)
   GET  /events?job_id=  →  SSE stream: tile ilerleme, katman çıktıları, parametre sayacı, hata
   GET  /jobs/{id}  →  durum (queued/running/done/failed) + çıktı path'leri
   ```
2. **İşler arası bağımsızlık:** kullanıcı ikinci görseli, birinci henüz işlemeye
   devam ederken yükleyebilir; iki job paralel koşar (VRAM/RAM bütçesi CPU build'de
   sorun değil). Job sıralaması FIFO; aynı görsel için yeni job eski job'u **süperse**
   (iptal + yeniden), kuyrukta bekletmez.
3. **Ön-yükleme (preload):** app açılır açılmaz model session'ı arka planda yüklenir
   (`onnx_session.py` lazy init + hazır olana kadar "model hazırlanıyor" rozeti).
   İlk görsel gelince model zaten hazır → sıfır ek gecikme.
4. **Tiled inference streaming:** görsel 256×256 karolara bölünür; her karonun maskesi
   biter bitmez SSE ile frontend'e akar → ekran karolar halinde dolar (bu aynı zamanda
   U1 "watch it think" animasyonunun kendisidir; ayrı bir animasyon sahteciliği gerekmez).
5. **Ön-hesap + cache:** kohort filmstrip için 70 görselin sonuçları bir kez hesaplanır
   ve `cache/` altında saklanır; app başlatılınca cache taze değilse arka planda
   yeniden hesaplanır (kullanıcı bekletilmez, eski cache'le başlar).
6. **Model session'ı tek ve paylaşımlı** (thread-safe kullanım; ONNX Runtime session
   `intra_op_num_threads` makineye göre ayarlanır).

### Frontend (React)

7. **Hiçbir fetch/decode/render UI thread'ini bloklamaz:** büyük görseller
   `createImageBitmap` + worker'da decode; tile overlay'leri canvas'ta
   `requestAnimationFrame`'te kademeli çizim; UMAP/batch hesapları backend job →
   frontend sadece SSE'den gelen parçaları boyar.
8. **İmleç her an hareketli:** pan/zoom/slider'lar 60fps hedef; ağır hesaplar
   asla `useEffect` zincirinde senkron çalışmaz.
9. **Kullanıcı geri bildirim dili:** her bekletme anı bir *ilerleme* anıdır
   (progress, sayan, kırpırtı) — boş "yükleniyor..." ekranı **yasak**.
   İptal düğmesi her job'da mevcut.

### Kabul ölçütü (smoke)

- 2048×2048 görsel yüklenirken aynı anda filmstrip kaydırılabilmeli,
  pan/zoom takılmadan çalışabilmeli; yükleme biter bitmez sonuç katmanları
  karo karo dolmalı.

## 5. Etkileşim omurgası (her bilim-imajcısının ortak deseni — 17 §2)

1. Görüntü ekranın **≥%70'i**; paneller ince kenar.
2. **Her şey katman**: raw / mask / skeleton / uncertainty / labels — eye-toggle +
   opacity + colormap + solo (napari/ilastik deseni).
3. **Obje listesi ↔ kamera bağı**: hücre satırına tıkla → kamera uçar + metrik panel dolar.
4. **Minimap + canlı scale bar** (µm) — projeksiyonda ölçek kaybı yok.
5. **Senkron multi-view**: pan/zoom tüm görünümlere akar (U2'nin altyapısı).
6. Window/level fare-drag (sağ-sol = level, ileri-geri = width) — faz-kontrast için.
7. Sayısal okumalar (µm, NTI, count) **monospace** — "precision instrument" hissi.

## 6. Tasarım dili

- **Dracula ailesi koyu tema** (koyu canvas + doygun etiket renkleri; QuPath/napari standardı).
- Katman renkleri: soma = sıcak (amber), nörit = soğuk (cyan), belirsizlik = mavi kırpırtı,
  outlier = kırmızı çerçeve; NTI = tek sayı, büyük, monospace.
- Hedef referanslar (görsel dil için): QuPath, napari, CVAT, ilastik,
  Cellpose HF Space, Imaris for Neuroscientists (linkler 17 §2'de).

## 7. Sert kısıtlar (kırmayan çizgiler)

- **Offline her şey**: internet bağımlılığı yok; CDN yok; statik frontend self-contained.
- **In-browser inference YOK** — inference Python'da (D16).
- **GAN / deep-super-resolution YOK** (kanondan çıkarıldı); yalnız klasik filtreler.
- **Öğrenmiş hücre embedding YOK** (DeepProfiler ağırlıkları 5-kanallı Cell Painting'e
  kilitli; n≈100–300 hücrede fine-tune ezberleme) → U4 feature-vectör PCA/UMAP ile.
- **Dürüst sınırlar UI'a yansır**: koşul-mesafe ve outlier panelleri *betimleyici*
  etiket taşır ("tahmin değil", batch-drift uyarısı); p-değeri iddiası yok.
- Mock data döneminde (model yokken) UI, gerçek pipeline sözleşmesine
  (`/infer` → SSE → sonuç JSON şeması) göre çalışır; sahte sayılar `mock:true` flag'i taşır.
- Dosya adları küçük harf ASCII; UTF-8 BOM'suz; Windows'ta çalışır.

## 8. Sonuç veri şeması (mock dönem dahil tek sözleşme)

```json
{
  "image_id": "snap9631", "model_version": "w9-seed3",
  "cells": [{ "id": 1, "area_px": 1234, "circularity": 0.82, "centroid": [x, y],
              "confidence": 0.97, "outlier": false }],
  "neurites": [{ "id": "B1", "length_px": 512, "tortuosity": 1.12,
                 "junctions": 2, "endpoints": 1 }],
  "angles_deg": [...],
  "nti": { "score": 0.63, "contrib": {"neurite_length": -0.21, "branching": -0.09,
          "angle": 0.04, "soma": -0.33} },
  "qc": { "blur": 0.8, "fg_ratio": 0.31, "mean_conf": 0.94, "warnings": [] }
}
```
(Saha adları `18` §A/B KEEP'lerinin hepsini kapsayacak şekilde genişletilebilir;
şema frontend'in tek truth'u — backend bunu üretir, UI bunu çizer.)

## 9. İş akışı kuralları (repo disiplini)

- Karar = `llm-wiki/DECISIONS.md`'ye ADR; değişiklik = `docs/data.js` loguna satır
  (append-only, `w:` hafta numarasıyla). Kaynak iddiasız yazılmaz: doğrulanamayan
  `[VERIFY]`, bilinmeyen `[OPEN]` tag'i alır.
- `llm-wiki/03-SEMESTER-PLAN.md` **frozen** — oraya dokunma; canlı durum dashboard'da.
- Her ekran ayrı demo'lanabilir olacak şekilde modüler kurulur (U2 tamamlanmışken
  U1 yarıda kalabilir).
- Test: UI'da her job akışı için mock SSE fixture'ları; `run.bat` ile yerel başlatma;
  offline (internet kesik) smoke testi T5.3'te zorunlu.
