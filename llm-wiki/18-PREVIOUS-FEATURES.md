# 18 — Önceki Projeden UI'ya Aktarılacak Özellikler (GP2 "PC12 Cell Analyzer")

> **Kaynak:** Atalay Şahan, *Image Processing and AI-Based Morphological Shape
> Analysis of PC12 Neural Cells* (EEE408 GP2, 2025-26) —
> `eee408_gp2_atalay_şahan_final_thesis.docx` + `atalay_sahan_gp2_presentation.pptx`
> (53 slide). Aynı hücre hattı (PC12), aynı morfometri ailesi, ama **bambaşka
> bir app**: WinForms .NET 8 frontend + Python backend, line-oriented protokol,
> **offline masaüstü** — yani D14'TE KANONUN KENDİSİ. Bu dosya o app'in
> ekran/panel/görselleştirme envanteri: bunlardan hangisini IntelliCell
> (D16: React+FastAPI+pywebview) UI'na alalım.
>
> **Kural:** Model mimarisi (iki aşamalı ViT-UNet-CBAM, ResNet-101+Swin-Large,
> attention gates, PPM, FPN) bir **UI özelliği değil** — `05`/`16`'de kendi
> yerinde. Burada **yalnızca UI'ya düşen** ekran, panel, görselleştirme ve rapor
> çıktıları var. Her satır `[PLANNED]`/`[IDEA]`/`[OPEN]` tag'i alır; "keep"
> önerim + neden.

---

## Sınıflandırma anahtarı

| Tag | Anlam |
|-----|-------|
| **KEEP** | D16 planına doğrudan uyuyor, düşük maliyet, yüksek görünüm — alıyoruz. |
| **KEEP-LITE** | Tamamını değil, çekirdeğini alıyoruz (kapsam/n≈70 sınırı). |
| **IDEA** | Güzel ama bu yarıda kapsam dışı — `10-IDEAS-STRETCH`'e gitmek için aday. |
| **ALREADY** | `17-UI-RESEARCH` veya `10-IDEAS-STRETCH`'te zaten var — çapraz referans. |
| **DROP** | D16 mimarisine uymuyor / gereksiz — not için. |

---

## A. App ekranları / panelleri (tez §"Desktop Application", Fig 12–29)

| # | Önceki app özelliği (fig) | Ne yapıyor | IntelliCell'e uyarlaması | Karar |
|---|---------------------------|-----------|--------------------------|-------|
| A1 | **Welcome + file-select** (Fig 12) | Karşılama ekranı + kurumsal logo + "görsel seç" | React route: boş durum = dropzone. pywebview `window.create_file_dialog`. | **KEEP** — D16 kabuğunun doğal giriş ekranı. |
| A2 | **Side-by-side original / mask** (Fig 13) | Orijinal solda, tahmin maskesi sağda | `17 §2` #1 "watch it think" viewer'ının **başlangıç layout'u**. Tek panele overlay + yan panel. | **ALREADY** → `17` §2 konsept #1. |
| A3 | **Level & filter config** (Fig 14) | RGB kanal seviyesi, gamma, CLAHE/contrast-stretch/unsharp **filter stack**, real-time önizleme | Önbellek: preprocess pipeline'ı (04 §4) UI'da canlı ayarlanabilir. **Ama GAN iyileştirme kanondan çıkarıldı** (03 §3) — yalnızca klasik filtre. | **KEEP-LITE** — sadece klasik filtre (CLAHE/contrast/unsharp/gamma); GAN yok. |
| A4 | **Cell counting screen** (Fig 15) | Algılanan hücreler numaralı + kontur | Cell listesi ↔ kamera bağı (`17 §2` pattern). Numaralı soma = NTI soma sayımı. | **KEEP** — soma sayısı NTI'nin girdisi. |
| A5 | **Cell area screen** (Fig 16) | Hücreler küçük/orta/büyük renk kategorisi + piksel alan değeri | Soma morfometrisi (NTI param #4) görseli. Renk skalası: small=yeşil/medium=sarı/large=mavi. | **KEEP** — doğrudan NTI param #4. |
| A6 | **Branch skeleton screen** (Fig 17) | İskelet, B1/B2 ID'li dallar, piksel uzunluk, junction + endpoint işaretleri | NTI param #1 (nörit uzunluğu) + #2 (dallanma sayısı) görseli. | **KEEP** — doğrudan NTI param #1/#2. |
| A7 | **Angle screen** (Fig 18) | Dallar/hücre arası açı okları + derece | NTI param #3 (dallanma açısı dağılımı) görseli. | **KEEP** — doğrudan NTI param #3. |
| A8 | **QC confidence view** (Fig 19) | QC metrikleri panel + tahmin çıktısı üstüne **confidence heatmap** | `10` A1 (uncertainty overlay) ile aynı kök. Önceki tezde aleatoric uncertainty head → per-pixel varyans; biz MC-dropping/TTA. | **ALREADY** → `10` A1 + `17` §2 "watch it think" shimmer. |
| A9 | **ROI-based analysis** (Fig 20) | Kullanıcı ROI çizer → ROI'ye özgü metrikler (confidence, FG oranı, komponent istat., sınıf oranı) | **İmza etkileşim.** `17`'de yoktu — güçlü ekleme. Zoom/pan'a bağlanır. | **KEEP** — en beğenilenlerden, NTI parametrik analizi için ideal. |
| A10 | **Batch analyzer** (Fig 21) | Çoklu görsel sıralı işleme + batch queue panel | 70+ kohort filmini besler; WP3 kohort analizi. | **KEEP** — kohort/uzunluksal çalışmanın UI taşıyıcısı. |
| A11 | **Tuning Lab** (Fig 22) | Orijinal + mask + preview + QC-heatmap yan yana, interaktif ince ayar | A3 (filter) + A8 (confidence) birleşimi; "modeli/hızları ayarla" ekranı. | **IDEA** — demo sonrası; kapsam genişlerse. |
| A12 | **Annotation interface** (Fig 23) | Maskenin manuel düzeltme/rafine etme (çizim/arız) | **Bu = `17 §4` HITL labeling kuyruğu.** Önceki app'te basit çizim; biz belirsizlik-sıralı review + `_seg.npy` akışı. | **ALREADY** → `17` §4 (daha gelişkin hali). |
| A13 | **Comprehensive dashboard** (Fig 24) | Hücre boyut dağılımı, alan↔index, dal uzunluğu/kompleksite, açı — histogram+box+CDF+polar | `17`/`09` dashboard'a düşer; tek görselde "tüm metrikler". | **KEEP-LITE** — seçili metrikler; tüm 12 dal tablosu IDEA. |
| A14 | **Result pop-ups** (Fig 25–28) | Hücre sayısı / alan istat (mean/median/std/CV/total) / dal ağı (total-avg length, network density, junction, endpoint, branching index) / açı (mean/median/min/max/std + per-connection) | NTI parametrik rapor kartları. Tıklanabilir cell/branch → popup detay. | **KEEP** — NTI'nin "kanıtı" ekranı; her parametre = 1 kart. |
| A15 | **Export dialog** (Fig 29) | Text / CSV save + copy | Rapor çıktısı (B bölümü). | **KEEP** — rapor gereksinimi (TUSEB kanon çıktısı). |

---

## B. Görselleştirme / istatistik desenleri (tez §"Post Image Process & Morphological Analysis", Fig 4–11 + PPTX 44–51)

| # | Desen | Ne gösterir | IntelliCell karşılığı | Karar |
|---|-------|-------------|------------------------|-------|
| B1 | **Numaralı soma + kontur + dolgulu bölge** (Fig 5) | Blue index, yellow contour, green fill | `17 §2` overlay pattern. | **ALREADY** → `17` §2. |
| B2 | **Renk-kategori ölçeği** (small/medium/large) | Alan bazlı sınıflandırma | NTI soma morfometrisi. | **KEEP** (A5 ile). |
| B3 | **Skeleton + junction/endpoint + per-branch length** (Fig 7) | Topolojik değerlendirme | NTI param #1/#2. | **KEEP** (A6 ile). |
| B4 | **Açı okları + derece** (Fig 8) | Vektör tabanlı, 0–360 normalize | NTI param #3. | **KEEP** (A7 ile). |
| B5 | **Histogramlar** (alan, uzunluk; mean+std ile) | Dağılım/varyans/merkez eğilim | `17` + `09` dashboard. | **KEEP-LITE** — NTI parametrik dağılımlar. |
| B6 | **Box plot + density (tortuosity/curvature)** | Doğrusal vs kıvrımlı nörit ayrımı | **Kompleksite proxy.** NTI'ye ek sinyal (dallanma açısına yakın). | **IDEA** → `10` Tier C (dallanma kompleksitesi). |
| B7 | **CDF (kümülatif dağılım)** | Normalite/karşılaştırma | İki koşul dağılımını üst üste bindir → before/after farkı. | **KEEP-LITE** — `17` #2 "before/after" delta'ı için ideal. |
| B8 | **Polar mapping (açı)** (Fig 11) | Yön dağılımı | `17 §2` #3 "3D Neuron Room"un 2D öncülü; orientasyon rozetli kutu. | **KEEP-LITE** — kutu kutu kutu; 3D varsa rotasyon. |
| B9 | **Açı ↔ dal uzunluğu ilişkisi** (Fig 11) | Scatter: orientation vs length | **Hocanın "hücreler arası similarity" fikriyle örtüşür.** | **KEEP** — similarity tab'ının (17 §3) alt paneli. |
| B10 | **Comprehensive branch network** (Fig 9) | Length, tortuosity, thickness, orientation, complexity, connectivity + tablo (avg length, junction count, complexity index) | Zengin rapor tablosu. | **IDEA** — n≈70'de 12 dal tablosu gürültü; summary yeterli. |
| B11 | **Comprehensive cell area** (Fig 10) | Histogram, stat summary, cumulative+quantile, size cat, **outlier detection** | Outlier = QC bayrağı. | **KEEP-LITE** — outlier/QC (17 §4) + dağılım. |
| B12 | **Class-wise metric tabloları** (PPTX 45–46) | Dice/IoU/P/R/F1 per class | `07`/`08` model değerlendirme; UI'da "model card" paneli. | **KEEP-LITE** — W9 sonrası gerçek model metrikleri; "modeli tanıt" kartı. |
| B13 | **Smart viz: gradient bg + clear text placement** (PPTX 18) | Arka plan gradyanı, okunur etiket yerleşimi | `17 §2` görsel dil (Dracula, monospace sayısal). | **KEEP** — tasarım dili. |
| B14 | **Real-time statistical reporting + detailed charts** (PPTX 18) | Canlı metrik raporu | `09` dashboard + `17` panel. | **KEEP-LITE**. |

---

## C. Sistem / rapor çıktıları (tez + PPTX)

| # | Özellik | Karar | Not |
|---|---------|-------|-----|
| C1 | **QC modülü** — blur (Laplacian variance), Canny edge density, mean confidence, low-conf ratio, FG ratio, component count, small-component ratio + **uyarı kuralları** (low focus, high uncertainty, low FG coverage, excessive small components) | **KEEP** | `17 §4` QC bayrağıyla birleşir; giriş görseli yüklenince otomatik çalışır. Düşük maliyet, yüksek güven hissi. |
| C2 | **`.txt` rapor dosyaları** (alan ölçümleri, dal analizi, açı) + CSV | **KEEP** | TUSEB kanon çıktısı (rapor). A15 export ile. |
| C3 | **Multi-format output** (PPTX 18) | **KEEP-LITE** | PNG (overlay) + CSV (metrik) + .txt/.md (rapor). |
| C4 | **Ground-truth karşılaştırma / built-in validation** (PPTX 18) | **IDEA** | Test seti W9 sonrası; "hata ısı haritası" = A8'in uzantısı. |
| C5 | **Continuous daemon processing** (PPTX 18) | **DROP** | D16'da FastAPI job queue yeterli; daemon gerekmez. |
| C6 | **Smart caching / memory mgmt** (PPTX 18) | **KEEP-LITE** | Kohort filmstrip cache (17 §2); ONNX session reuse. |
| C7 | **20+ quantitative metrics extraction** (PPTX 18) | **KEEP** | NTI 4 param + türev metrikler (tortuosity, complexity, orientation) — B6/B10 girdisi. |

---

## D. Keep-shortlist (önceki projeden **alınan** — sıralı)

Düşük maliyet → yüksek görünüm. `17-UI-RESEARCH` konseptleri + bu listeyi
birleştirince D16 UI'ının ekran haritası şuna oturur:

1. **QC paneli (C1)** — görsel yüklenince otomatik, uyarı rozetleri. *(en ucuz güven)*
2. **Numaralı soma + renkli alan kategorisi (A4+A5+B2)** — NTI param #4.
3. **Skeleton + junction/endpoint + uzunluk (A6+B3)** — NTI param #1/#2.
4. **Açı okları + derece (A7+B4)** — NTI param #3.
5. **ROI analiz (A9)** — imza etkileşim; zoom/pan'a bağlı.
6. **Sonuç kartları + export (A14+A15+C2/C3)** — NTI kanıtı + rapor.
7. **Confidence heatmap (A8/B11)** — `10` A1 ile birleşir, "watch it think" shimmer.
8. **Before/after CDF + polar + açı↔uzunluk scatter (B7+B8+B9)** — similarity tab'ı (17 §3).
9. **Batch queue (A10)** — kohort/filmstrip taşıyıcısı.
10. **Klasik filter stack (A3, GAN'sız)** — önizlemeli.

**IDEA'ya gidenler:** A11 Tuning Lab, B6 tortuosity box-plot, B10 tam branch tablosu, C4 GT karşılaştırma — `10-IDEAS-STRETCH`'e satır eklenir.

---

## E. D16 mimarisine notlar

- Önceki app **WinForms+Python+line protokol** idi; D16'da bu **React+FastAPI+
  pywebview**'a dönüşür. Protokol line-oriented yerine **JSON REST + SSE**
  (ilerleme = SSE stream → "watch it think"). Özellikler birebir taşınır.
- Önceki app'in **offline** olması D14 kanonuyla aynı → D16 da offline;
  hiçbir özellik internete bağlı değil.
- **Uncertainty head** (aleatoric, per-pixel varyans) önceki tezde var →
  bizde MC-dropping/TTA ile aynı çıktı: **confidence heatmap (A8)**. Bu,
  iki projenin en güçlü ortak mirası.

---

## Kaynak figür/slide eşlemesi

- Tez Fig 4–11 = morfometri görselleştirmeler (B bölümü).
- Tez Fig 12–29 = app ekranları (A bölümü).
- PPTX 18 = sistem özellikleri (C bölümü); 44–51 = metrik tabloları (B12).
- PPTX 2–52 = eğitim/veri/segmentasyon (UI'ya **düşmez**, `05`/`06`/`07` alanı).
