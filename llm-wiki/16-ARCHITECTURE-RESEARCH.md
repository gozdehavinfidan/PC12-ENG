# 16 — Architecture Research Report

> **Professör-gözüyle mimari araştırması.** Mimariden sıfırdan sorumlu olan biz;
> bu dosya, pipeline'ın her aşaması için **literatürde kanıtlanmış, açık-kod,
> denenebilir** mimari/teknik adaylarını ve **cesur ama teslim edilebilir**
> fikirleri içerir. Her aday için: ne yapar, kod lisansı, VRAM/komut, n≈70
> veride uygunluğu, ve **karar** (recommend / baseline / watch / skip).
>
> Kısıtlar (sabit): ~70 etiketli görsel + ~2 haftada gelen batch 2 (boyut
> `[OPEN]`); 2D faz-kontrast + floresan; çıktılar: hücre sayısı/alanı, nörit
> sayısı/uzunluğu/açısı; **A5000 24GB + A6000 48GB (D12 — komut artık kısıt
> değil)**; 2 kişi × 15 hafta; offline masaüstü uygulaması (ONNX); 5-fold CV
> image-bazlı split.
>
> Kaynaklar: 6 paralel literatür araştırması (birincil kaynaklar, 2026-09-22):
> R1 segmentasyon mimarileri · R2 foundation models · R3 nörit morphometrisi ·
> R4 veri verimliliği · R5 XAI+belirsizlik · R6 cesur fikirler. Ham payloadlar
> `_research/` altında saklanıyor. Yeni doğrulanmış referanslar
> `14-REFERENCES-VERIFIED.md`'ye aktarıldı; `checked: false` iddialar `[VERIFY]`
> ile işaretlendi.

## 0. Yönetici özeti (bottom line)

1. **Ana mimari iki koldur ve bu 6 araştırmanın ortak bulgusudur:**
   (a) hücre gövdesi → **ImageNet-pretrained encoder + U-Net ailesi decoder**
   (SMP, MIT) ya da **nnU-Net v2 ResEnc**; (b) nörit → **aynı encoder'a bağlı
   ikinci, düz binary segmentation kolu** + **soft-clDice** loss. **Hiçbir
   doğrulanmış foundation model nöriti instance olarak segmente etmiyor**
   (R2, tutarlı bulgu) — star-convex/box shape-prior'ları 2–3 px ince, dallanan
   tüplere yapısal olarak düşman. Nörit için sahnenin kanıtlanmış yolu:
   **mask → skeleton → graf → morphometrik özellik** (R3).
2. **Loss = alan + topoloji:** vücut: Dice/Tversky; nörit: Dice/Tversky +
   **soft-clDice** (w≈0.2–0.3, MIT, `jocpae/clDice`) + (ablation) **TopoLoss**
   (Betti match, MIT). clDice kağıdının benchmark seti **nörönleri içeriyor** —
   en yakın alan kanıtı. 2×2 {clDice × TopoLoss} ablation'ı **hiç kimse kültür
   hücresi nöritinde yayımlamadı** — temiz, sunulabilir katkı.
3. **Foundation modeller W6 kapısında, üç rolde:** (i) zero-shot baseline satırı
   (Cellpose-SAM `cpsam_v2`, μ-SAM+APG, CellSAM, StarDist, SAM zayıf kontrol);
   (ii) hücre gövdesi **instance** motoru + pseudo-label önyargısı;
   (iii) **LoRA-on-SAM karşılaştırma kolu** (24 GB'e sığar, gecelik 5-fold).
   İsim olarak dolaşan **MoCell / DICE / Cell-Clarity / ISCE doğrulanamadı —
   böyle isimlerle bir proje yok; ISCE = μ-SAM karışıklığı** (R2, arXiv +
   Crossref + GitHub arama kanıtıyla).
4. **Belirsizlik katmanı ürünün kendisi:** dağıtılan model = **5-seed derin
   ensemble** (tam veri); CV-fold ensemble yalnız doğrulama benchmark'ı
   (Kirscher 2026: meşru proxy ama kalibrasyon/hata-tespitte geride; **bir fold'
   ın kendi validasyon fold'unda ortalaması = leakage**). Çıktı: IG saliency
   overlay + ensemble belirsizlik overlay + **insan gözden-geçirme kuyruğu** +
   sıcaklık kalibrasyonu (ECE). **"pytorch-uncertainty" ölü paket —
   torch-uncertainty kullan** (R5).
5. **En savunulabilir farklılaştırıcı: her morphometrik özelliğin hata çubuğu.**
   Ensemble piksel-belirsizliği → skeleton boyunca örneklenir → sayı/uzunluk/
   açısı için CI. PC12/nörit kuantifikasyon literatüründe **kimse bunu yapmıyor**
   (NeuroQuantify yalnız nokta tahmin raporluyor). Saf analiz katmanı, mimari
   risk yok, her tabloya bir CI sütunu koyar (R6).
6. **Veri verimliliği sıralaması (n≈70):** W1 ucuz kazanımları =
   histogram-matching + sızıntı-güvenceli 5-fold + Tversky+soft-clDice +
   **rijit-ünite Copy-Paste** (hücre+nörit birlikte döndürülür → açı etiketi
   geçerli kalır; donor/recipient aynı fold içinde). Spike'lar = topology
   gate'li pseudo-label self-training (2–3 tur) + **topoloji-farkında active
   learning** (entropi ince yapıları kör — Betti uyuşmazlığı terimi eklenir).
   **Diüzyon sentezi geç:** literature kanıtı sentetik-only'un başarısız
   olduğunu, karışık kullanımda haftalar karşılığı 1–3% kazandırdığını gösteriyor;
   üretilen hiçbir model tüpümsü nörite hedeflenmiyor (R4).
7. **Zaman planı araştırma tarafından teyit edildi:** W1–3 baseline (zero-shot
   FM + U-Net 5-fold) → W4–9 ana hat (clDice + yarı-közlü) → W10–15 graf
   doğrulaması, ONNX, XAI, ensemble. 15 haftaya **sığar**, A6000 gecelik job'ları
   ile (D12).

---

## 1. Segmentasyon aşaması: aday mimariler

> R1-SegArch + R2-FoundModels sentezi. İki katman: (a) **denenecek
> train-architectures** (5-fold CV'de karşılaştırılacak), (b) **foundation
> model basline'ları** (W6 kapısında koşularak planı değiştirecek).

### 1.1 Train-able mimari adayları

| # | Mimari | Kod / Lisans | VRAM (A5000) | n≈70 uygunluğu | Nörit desteği | Karar |
|---|--------|-------------|--------------|----------------|---------------|-------|
| 1 | **U-Net (plain)** | `qubvel-org/segmentation_models.pytorch` (MIT) — `milesial/Pytorch-UNet` GPL | 2–5 GB | **Best-in-class**: 2015 ISBI kazanı *faz-kontrast/DIC* hücre görselleriyle, ~40 etiketli görselle eğitildi — bizim modalite ve n tam olarak o rejim | Kısmi (pixel-wise; bağlantılık garanti yok → clDice gerekir) | **recommend — ana hat tabanı** |
| 2 | **UNet++** | SMP (MIT); resmi repo ASU-non-commercial | 4–8 GB | İyi — derin denetim küçük veriye doğal düzenleyici; nükleus mikroskopisinde test edilmiş (+3.9 IoU, kağıdın iddiası) | Kısmi | **recommend — ana hat adayı** |
| 3 | **UNet3+** | SMP (MIT; `avBuffer` klonu lisanssız) | 5–8 GB | İyi — parametre bütçesi U-Net ile aynı; **full-resolution path 1–2 px nörit detayını korur** (tam istediğimiz başarım-modu için) | İyi (mimari olarak) | **recommend — ince-yapı kolu** |
| 4 | **nnU-Net v2 (ResEnc L)** | `MIC-DKFZ/nnUNet` (Apache-2.0) | ~23 GB (A5000 OK; XL ~37 GB → A6000) | Güçlü — self-config augmentasyon + 5-fold otomasyonu; `15`'ın istediği şeyi bedava verir | Yok — varsayılan loss Dice+CE; **clDice için trainer subclass** (destekleniyor) | **recommend — W9 karşılaştırma** |
| 5 | **SA-UNet** (spatial attention) | `changluguo/SA-UNet` (lisans doğrulanmadı `[VERIFY]`) | 3–5 GB | Kağıdın varsayımı açıkça az-etiket rejim: DRIVE (40 img) / CHASE (60) SOTA | Evet (damar tasarımı) | **watch — damar-transfer ablation kolu** |
| 6 | DR-VNet | arXiv:2111.04739 (kod doğrulanmadı) | ~5 GB | İyi (aynı retinal kültür) | Evet | watch — SA-UNet seçiliyorsa ikincil |
| 7 | **TransUNet** | `Beckschen/transunet` (Apache-2.0) | ~10 GB | **Kötü n≈70'de**: "nnU-Net Revisited" (arXiv:2404.09556, doğrulandı) 100–1000+ örnekte bile CNN U-Net'lerin transformer'ları yendiğini gösteriyor — veri azaldıkça fark büyür | Kısmi | **watch — TEK ablation satırı; beklenen sonuç "n≈70'de yardımcı olmuyor" (savunulabilir negatif sonuç)** |
| 8 | Swin-UNet | `HuCaoFighting/Swin-Unet` — **LISEANS DOSYASI YOK** (GitHub API ile doğrulandı) | 10–20 GB | Kötü + dağıtılabilir uygulama için lisans boşluğu | Kısmi | **skip** |
| 9 | Attention U-Net | `yingkaisha/keras-unet-collection` (MIT) | 3–5 GB | Orta — kapı parametreleri hafif veri açlığı; kanıt CT (mikroskop değil) | Kısmi | watch — background clutter gövde recall'ını düşürürse |
| 10 | SegResNet | MONAI (Apache-2.0) | 5–10 GB | Orta — autoencoder düzenlemesi meşru küçük-veri aracı ama 2D'de UNet++'a üstünlük yok | Yok | watch (düşük öncelik) |
| 11 | FPN / FPUNet | SMP (MIT) | 4–8 GB | Orta | **Kötü** — pyramid up-sampling 1 px detayı yıkan klasik neden | **skip** (UNet3+ aynı maliyette üstün) |
| 12 | DS-UNet | **doğrulanamadı** (yalnız 2024 üçüncü-kişi klonu, lisanssız, 0★) | — | — | — | **skip** (kaynak doğrulanana dek) |
| 13 | **VesselMUNet** | **KAMU KAYDINDA YOK** — repo 404, GitHub code search 0, arXiv 0, Crossref 0 (tümü doğrulandı) | — | — | — | **skip — alıntılamayın**; takıma: PDF elinizdeyse DOI doğrula |
| 14 | **TransNewSeg** | **KAMU KAYDINDA YOK** (aynı kanıtlar) | — | — | — | **skip — alıntılamayın** |
| 15 | MM-UNet (Mamba, 2025) | `liujiawen-jpg/MM-UNet` (MIT) | 8–16 GB | Bilinmiyor (retinal benchmark'ları büyük veri) | Evet — ince tüp, topoloji farkında | **watch** — 2025 SOTA karşılaştırma noktası; **teslimata Mamba koymayın: ssm op'larının ONNX Runtime desteği olgunlaşmadı** |
| 16 | **HoVer-Net** (iki-kollu) | `vqdang/hover_net` (MIT; bazı checkpoint'ler CC-BY-NC-SA) | infer 1–2 GB; fold eğitimi gecelik A5000 | İyi — orijinali CoNSeP ~100 img'de; **iki-kollu vücut+nörit pipeline'ın en yakın mimari atası** | Kutudan çıkmıyor; inst-head gövde için, nörit için düz binary kol eklenir (H/V distance ince tüpe genellemez) | **recommend — iki-kollu tasarımın referans şeması** |

**Lisans hijyeni (dağıtılacak uygulama için):** SMP (MIT) ana hat;
`Pytorch-UNet` GPL → app'de kullanmayın; resmi UNetPlusPlus NC → SMP'den alın;
checkpoint lisansları (Cellpose CC-BY-NC ağırlıkları vb.) **app'e gömülmez** —
tezs için serbest, ürün için değil (R2).

### 1.2 Foundation model adayları (zero-shot → fine-tune)

| # | Model | Kod / Lisans | Zero-shot beklenti (PC12-faz-kontrast) | Instance mask? | Nörit? | Fine-tune maliyeti | Karar |
|---|-------|-------------|------------------------------------------|----------------|--------|--------------------|-------|
| 1 | **Cellpose-SAM** (`cpsam_v2`, `cpdino`) | `MouseLand/cellpose` — kod BSD-3; **ağırlık+veri CC-BY-NC** (README'deki GPL rozeti yanlış, LICENSE dosyası doğrulandı) | **Güçlü** — MIDL 2026 benchmark'ı (arXiv:2603.17845, tam okundu) label-free mikroskopide üst-3'te tutarlı; faz-kontrast eğitim alanında (LIVEcell) | **EVET** (labelmap) — birbiriyle temas eden hücre sayımı için en iyi aday | **HAYIR** — star-convex öncülü ince dallara yapısal olarak düşman; beklenti: kısa kollar atılır/kısılır | **2–5 h GPU + yüzlerce tık ROI düzeltmesi** (HITL dokümante; BIBM 2025 veri-verimliliği kanıtı arXiv:2511.04803) | **recommend — gövde motoru + ana fine-tune hattı** |
| 2 | **μ-SAM / micro-sam + APG** | `computational-cell-analytics/micro-sam` (MIT; SAM ağırlıkları Apache-2.0) | **İyi-güçlü** — 2603.17845'te label-free modalitede üst-3; APG (otomatik prompt) ücretsiz performans kazancı | Evet | Hazır nörit modeli yok; instance labelmap'larla **eğitilebilir** (distance+watershed ince tüpte kanıtsız → deney, plan değil) | Pretrained checkpoint'ten fine-tune: A6000'de saatler–1 gece | **recommend — 2. FM; APG W6'de config flag** |
| 3 | **CellSAM** | `vanvalenlab/cellSAM` (Apache-2.0; Nature Methods 2025) | İyi (faz eğitim dağılımında) ama FM'ler içinde **en zayıf domain-shift genellemesi** — her box 1:1 mask'le eşlenir, kaçan detection kurtarılmaz | Evet | Hayır (box-prompt kompakt-nesne önyargısı) | Tam fine-tune yolu yok; few-shot var | **baseline — W6 kapısında 3. sıfır-atış (farklı başarım-modu)** |
| 4 | **StarDist** | `stardist/stardist` (BSD-3) | **Zayıf** faz-kontrastta — pretrained'ler yalnız floresans/H&E | Evet | Hayır (star-convex) | En kolay: ~1–2 h, n≈50 için | **baseline — klasik satır + `matching` modülü = hazır IoU-based PQ/F1 metrik** |
| 5 | **SAM / SAM2** (AMG) | `facebookresearch/segment-anything` (Apache-2.0) | **Zayıf** — 2603.17845: "SAM itself fails at difficult microscopy tasks"; AMG mikroskopide kötü; SAM2 bazı verilerde **hiç nesne segmente edemedi** | Prompt başına | Hayır | LoRA 24 GB OK; tam fine-tune 48 GB — ama Cellpose-SAM/μ-SAM'ın yaptığını yeniden yapmaktan pahalı | **watch — interaktif etiketleme yardımcı + negatif kontrol** |
| 6 | SAM3 | `facebookresearch/sam3` (Apache-2.0) | Orta-düşük, prompt-duyarlı ("blob" bazen "cell"'i yendi; bazı veri setlerinde "nucleus" tanınmadı) | Evet (text-prompt) | Hayır | Promptlama yalnız | watch — yenilik satırı |
| 7 | CellViT++ / CellViT | CellProfiler ekosistemi (derin doğrulanmadı) | Alan uyuşmazlığı (H&E histopatoloji) | — | Hayır | — | **skip** |
| 8 | **MoCell, DICE, Cell-Clarity, "ISCE"** | — | **DOĞRULANAMADI**: arXiv full-text + Crossref + GitHub repo search hepsinde 0 sonuç (çoklu sorgu). Muhtemel karışıklıklar: MoNuSeg (2018 veri seti), Dice loss, DICE-XMBD (2021, IMC), **ISCE = μ-SAM** | — | — | — | **skip — ALINTILAMAYIN**; takıma isimleri söyleyene kağıt linki sorun |

**W6 zero-shot kapı protokolü** (R2, benimsendi): 3 FM (+StarDist, +SAM zayıf
kontrol) × 2 modalite × 70 görsel; metrik reçetesi = MIDL 2026 mSA/IoU-matching
(eşik 0.5–0.95) + sınıf-bazlı DSC + count error. Sıfır-atış sayıları her sonuç
tablosunda "foundation model prior" satırı olur.

### 1.3 Ablasyon matrisi (W5–W9)

Model sıraları: **U-Net(ResNet-34) · UNet3+ · UNet++** (SMP) · **nnU-Net v2
ResEnc L** · **SA-UNet** (damar-transfer) · **TransUNet** (beklenen negatif).
Loss sütunları: `Dice` → `Dice+Tversky(0.3/0.7)` → `+soft-clDice (nörit, w 0.2–0.3)`
→ `(stretch) +TopoLoss`. FM-öncü sütunu: `yok` / `FM pseudo-label pretrain
(clDice-gated, §5-8)`.

**Karar kuralı (değişmedi, netleştirildi):** 5-fold mean±std; sınıf-bazlı DSC +
**clDice (nörit)** + **Betti-1 error** + özellik MAE; eşitlik kırma:
clDice → Betti → runtime. Hesap: 6 model × 3–4 loss × 5 fold = A6000'de
gecelik job'larla 2 haftaya sığar (D12).

---

## 2. Nörit morphometrisi: mask → özellik

> R3-NeuriteMorpho. **Doğrulanmış, pip-kurulur, açık-lisans tam stack** (tüm
> kütüphaneler bu oturumda LICENSE dosyalarıyla doğrulandı):

```
mask ──(1 temizle)──▶ ──(2 skeletonize)──▶ ──(3 skan graf)──▶ ──(4 budama)──▶ ──(5 hücre-bazlı özellikler)
```

| Aşama | Önerilen (lisans) | Alternatif | Failure mode | Mitigasyon |
|-------|-------------------|-----------|--------------|------------|
| Temizleme | `skimage.remove_small_objects` + `binary_fill_holes` + (ops.) yarı-beklenen-nörit-genişliğinde median (de-fragmantasyon) | MorphoLogic (GPL — referans) | Parça/gürültü maskesi | Parametreleri logla; half-width median |
| Skeletonizasyon | `skimage.morphology.skeletonize` (Zhang-Suen) veya `medial_axis` | SNT (GPL, output-level cross-check) | Gürültüde sahte çapraz/kiprik | Aşağıdaki budama + SNT ile bağımsız doğrulama |
| Graf kurulumu | **skan** `skeleton_graph` (BSD-3): node = branch/end point, edge weight = px, 8-bağlantıda diyagonal ×√2 | SNT (GPL) | Kesişen nöritler yanlış topolojiye birleşir | Kesişim = bilinen sınır; raporda açıkla (AutoNeuriteJ: minimum intensitede loop-cut) |
| Budama | **FilFinder** (MIT) `prune_criteria='length'`, L_min 5–10 px (≈1–2 µm), ≤10 iterasyon; **NeuroQuantify sabiti: 20 µm** | Özel rekürsif budama | Kısa kollar şube sayısını şişirir | L_min ∈ {5, 10, 20 µm} duyarlılık süpürmesi; hepsini raporla |
| Şube/açı çıkarımı | kök = gövde sınırı; **nörit = kök-yaprak yolu**; **akson kuralı (AutoNeuriteJ): en uzun yol, eğer >2× ikinci uzun VE >100 px**; açı = chord yönü + **pycircstat2** (MIT: mean resultant vector, Rayleigh, Mardia-Watson-Wheeler, Watson-Williams) | SNT root-angle | Kesişimde şube belirsizliği; lineer açı istatistiği döngü yanlılığı | Akson kuralı + **circular istatistik** (C5) |
| Instance ayırma | FM instance mask'leri (Cellpose-SAM) varsa → tam sayım; yoksa distance-transform+watershed; başarısızsa blob'u **flag'le** (D3) | — | Aşırı/az bölme | Sanity check + dürüst flag (hata analizi besler) |

**Metrik seti (doğruluk kanıtı):** count → connected components / kök-yaprak
sayısı; area → µm² `[OPEN]` pixel-size (D5); length → Σ edge weights × px-size;
angle → circular (Rayleigh + Mardia-Watson-Wheeler grup karşılaştırması);
**topoloji → Betti-1 = E−V+C + clDice**; (stretch) **persistence-barcode
distance** (ripser.py, MIT — ms ölçeğinde, 1k noktaya ≤; döndürme/ölçek
değişmez; "aynı loop sayısı"nu "benzer loop yapısı"ndan ayırır); (ops.) Sholl
profili; (ops.) nörit genişliği = skeleton üzerinde EDT (yalnız GT'de genişlik
varsa `[OPEN]` Berke).

**Doğrulama hattı:** (a) Berke elle ölçüm → **Bland–Altman** özellik-bazlı (S7);
(b) SNT ile bağımsız cross-check (output-level; GPL kod projeye girmez);
(c) **known-answer sentetik set**: rijit-ünite pasting'in döndürme takibiyle
üretilen, gerçek cevabı bilinen test görselleri (§5-12 ile aynı mekanizma).

⚠ **NeuroQuantify deposunda LICENSE dosyası YOK** (doğrulandı) — incelenir,
kod **kopyalanmaz**; sabitleri (20 µm budama) kağıttan alınıp alıntılanır.

---

## 3. Veri verimliliği playbook'u (n≈70 + unlabeled pool + batch 2)

> R4-SmallData. Sıralama = haftaya göre. "Kağıdın iddiası" etiketli sayılar
> bizim veri hakkımızda değildir.

| Teknik | Çaba | Beklenen kazanç | Kanıt | Karar |
|--------|------|-----------------|-------|-------|
| Histogram-matched preprocessing + 5-fold image-split + **sızıntı assert** | 1 gün | Basamak hijyeni; batch-2 shift için temel | `15` §4 | **commit W1** |
| Loss: **Tversky (α0.3/β0.7) + soft-clDice (w 0.2–0.3) + BCE** | günler | Nörit recall + bağlantılık | clDice kağıdı (nörön benchmark'ı); Tversky/ISBI 2019 (Crossref DOI doğrulandı) | **commit W1** |
| **Rijit-ünite Copy-Paste**: her hücre (gövde+nörit) crop'ı alınır, **bütün ünite rastgele döndürülür** (→ açı etiketi tutarlı kalır), feather, ≤2 ünite/patch, **30–40% patch yalnız gerçek**, donor=recipient'in görseli değil ve **aynı fold içinde**, donor→recipient intensite eşlemesi | 3–5 gün | Etiketlemeden instance çarpanı; nadir-sınıf kanıtı: +3.6 mask AP LVIS rare (kağıdın iddiası, arXiv:2012.07177) | Copy-Paste (2012.07177), CP2 (2203.11709) | **commit W1** — S8'in güçlü versiyonu; yan ürün = **known-answer morphometrik test seti** |
| nnU-Net tarzı elastic + rotation augmentasyonu | planlı | — | `15` §6 (D6: orientation 0–180° çözümü) | commit |
| **Pseudo-label self-training** (topology gate'li): güçlü teacher → unlabeled pool'a infer → p>0.95 **VE skeleton sanity** (parça boyu/uzunluk makul aralıkta, Betti sayısı makul) → **5 görsel insan spot-check** → yeniden eğit; **maks 2–3 tur**; tur başına kabul oranı loglanır | 3–5 gün | Etiketlemeden veri ölçeklemesi; 70 seed'li teacher zaten yeterli iyi = self-training'in çalıştığı rejim | FixMatch rejim kanıtı (40 label, kağıdın iddiası) + standart pratik | **commit W8–10** |
| **Topoloji-farkında active learning**: unlabeled pool + batch 2'yi MC-dropout belirsizliği **+ Betti uyuşmazlığı** terimiyle sırala (entropi ince yapıya kör — kırık uzun nörit az piksel kütlesi verir); en üst K etiketlensin | 2–3 gün | **14 ve 24 görsellik** histoloji veri setlerinde 3 seçili örnek 15 rastgele ile eş DSC'ye ulaştı (kağıdın iddiası, arXiv:1907.05143) — tam bizim n | + rareness-aware (2507.17359): belirsizliği tahmini nörit-piksel oranıyla ağırlıkla | **commit W8–10** — **yeni katkı: topology-aware AL PC12'de ilk** |
| DINOv2 ViT-S/B fine-tune unlabeled pool üzerinde (frozen backbone + hafif head) | 2–4 gün spike | SSL kazancı en büyük **label<100**'de (kağıdın iddiası); pool<300 ise mütevazı | arXiv:2304.07193, Apache-2.0 | **spike — pool ≥300 ise** (pretrain-scratch SAKIN: 1 gün/32 A100) |
| Cell-DINO (flor domain SSL) | 1 gün + **gated indirme** | Floresan için domain-içi başlangıç; faz-kontrastta doğrulanmamış | dinov2 README_CELL_DINO | **watch — yalnız floresan birincil girişse** (CC-BY-NC + FAIR NC → ürün değil tezs) |
| Style augmentation | 2–3 gün | Intensite varyansı CV varyansını yönetiyorsa +10% | MoNuSeg (arXiv:2211.01125) | watch — %90'ı çözüm zaten 1 saatte histogram-matching + brightness/contrast/gamma jitter |
| Focal loss | saatler | 2 sınıfta ikincil | RetinaNet motivasyonu | watch — Tversky+clDice hâlâ arka-plan fazla öngörürse |
| FixMatch portu | 1–2 hafta | 88.6% CIFAR-10 / 40 label (kağıdın iddiası) ama sınıflandırma-kod → per-pixel port elle | arXiv:2001.07685 | **skip** — self-training kazancın çoğunu 1/4 maliyete alır |
| CRITIC (UDA) | bilinmiyor | Az-etiket UDA — pool cross-domain ise anlamlı | **repo doğrulanamadı (birden fazla URL 404)** | **skip — kaynağı çözülene dek planlamayın** |
| STARDOM (diüzyon augmentasyon) | bilinmiyor | — | **arXiv/GitHub'ta bulunamadı** | **skip — doğrulanabilir URL gelene dek dedikodu** |
| Diüzyon sentezi (HistoSmith/MSDM/DualDiT) | 3–6 hafta | **Tuzak**: sentetik-only eğitim başarısız; karışık gerçek+sintetik ≈ SOTA ama 1–3% Dice; hiçbir model tüpümsü nörite hedeflenmiyor; jeneratörün kendisi için 70 çift az | arXiv:2606.26898 (tractography sentez çalışması) | **skip** — yalnız batch-2 etiketi tavanlansa VE ucuz kazanımlar tükenirse |
| IAAA/SAAA (instance-preserving aug + mask-kondisyonlu pix2pix) | 1–2 hafta | Senteze bir gün izin çıkarsa kopyalanacak blueprint | arXiv:2602.00949 | watch |

**Bu dosyanın tek gerçekten yeni, teslim edilebilir katkısı (R4):**
topology-aware active learning + döndürme-takipli pasting'den known-answer
morphometrik test seti — ucuz, yayımlanabilir, ve Betti/clDice metriklerimizle
doğrudan hizalı.

---

## 4. XAI + belirsizlik (offline uygulama kısıtıyla)

> R5-XAIUnc. **Minimum-inandırıcı set (≤3 yöntem, tümü offline, laptop GPU'da
> görsel başına ~2 s altı):**

| # | Yöntem | Kütüphane / lisans | Runtime maliyeti | UI'da ne gösterilecek | Karar |
|---|--------|--------------------|------------------|------------------------|-------|
| 1 | **Integrated Gradients** (per-pixel target = pixel logit; ~20–50 adım; SmoothGrad = NoiseTunnel) | `pytorch/captum` (BSD-3) | görsel başına birkaç saniye (GPU) | **Kırmızı-sarı overlay**: "bu piksel neden nörit?" — U-Net'te yüksek-res decoder katmanı seçilir ki ince kenarlar çözümlensin (CAM tarzı kaba kalır) | **recommend — ana saliency** (aksiom-doğrulanmış; Adebayo sanity'larını geçer) |
| 2 | **5-üyelik derin ensemble** — **dağıtılan model = tam veriyle eğitilmiş 5 farklı seed** (gerçek deep ensemble); **CV-fold ensemble YALNIZ doğrulama benchmark'ı** | DIY ~100 satır veya `torch-uncertainty` (Apache-2.0) | 5× infer (görsel 1–5 s; offline app'te ön-hesapla + önbellekle) | **Mavi ısı overlay** (piksel epistemic U) + **hücre-bazlı gözden-geçirme skoru** (mask içinde min cellprob + ensemble std) → düşük güven hücreleri **insan kuyruğuna** düşer — Cellpose `prob_map` + `ismanual` UX deseninin 1:1 aktarımı | **recommend — belirsizlik katmanı + ürün özelliği** |
| 3 | **Sınıf-bazlı global sıcaklık ölçekleme** + ECE + reliability diagram (önce/sonra) | `torch-uncertainty` (TemperatureScaler) | <1 s fit + 1 s plot | Raporda tek rakam + tek figür | **recommend** — tam per-pixel kalibrasyon değmez (app **göreli** belirsizlik tüketir: hangi pikselleri flag'le) |

**CV-fold ensemble = ücretsiz ensemble mi?** — **MEŞRU, YILDIZLI** (Kirscher
et al., "Lost in the Folds", arXiv:2605.18329, doğrulandı): CV-fold ensemble'ları
geçerli belirsizlik proxy'leri (hatta değerlendirici-arası belirsizliği izlerler)
ama kalibrasyon ve hata-tespitte **gerçek** deep ensemble'ın (aynı veri, 5 seed)
gerisinde. Komut bedava (D12) olduğundan ikisini de yaparız: 5-seed ensemble
**dağıtılır**, CV-fold ensemble **doğrulanır**. Kural: **bir fold'ın
tahminlerini asla kendi validasyon fold'unda ortalama** — o, sızıntıdır.

**Saliency doğrulama protokolü (sunumda gösterilecek, ~1 gün, holdout):**
(1) **Deletion curve**: pikselleri IG önemine göre sırala, top-k %sini karart →
DSC düşüşü; random-k kıyası bizim eğrinin belirgin hızlı düşmesi gerekir;
(2) **Adebayo model-swap**: model değişince açıklamalar da değişmeli. RISE
yalnız iki işte: occlusion ground-truth + **ONNX tutarlılık kontrolü**
(exported model PyTorch ikiziyle aynı davranıyor mu).
**"Belirsizliğimiz bir şey mi demek?" sayımı:** flag vs hata AUROC /
precision-recall (torch-uncertainty selective-classification) — holdout'ta
bir kez hesaplanır, XAI bölümünün rakamı olur.

**Atlananlar (neden):** SegGrad-CAM (Keras, "no updates planned" — PyTorch'ta
~30 satır yeniden yazımı IG/Grad-CAM'den daha iyiye götürmez);
evidential/Bayesian U-Net (yeniden eğitim + segmentasyonda görev-bağımlı zayıf
kanıt, arXiv:2410.18461); SHAP (per-pixel çok yavaş); MC-dropout — yalnız
tek-checkpoint zorunlu olursa yedek (ONNX'te dropout fiddly, ensemble daha
iyi kalibre); pytorch-grad-cam (MIT, Grad-CAM fallback + ViT reshape).

**⚠ Ölü paket:** `pytorch-uncertainty` 404 (jbshr/jacobgil varyantlarının
her ikisi de) — **torch-uncertainty** (NeurIPS D&B 2025) kullan.

**Ucuz bonus:** TTA self-consistency açı-sağlamlık kanalı — 4 döndürülmüş
tahminin açı tahminlerinin yayılımı büyükse açı "düşük güven" işaretlenir
(döndürme-eşdeğerlik kontrolü bedava; §5-12).

---

## 5. Cesur fikirler (teslim edilebilir)

> 6 scout'tan gelen 23 fikir; **kaynağına göre atfedildi, çakışanlar birleştirildi
> (Betti-kılavuzlu loss = TopoLoss; self-labeling = pseudo-label self-training),
> 18'e indirildi.** Her biri: en yakın önceki çalışma → adaptasyon → dürüst
> çaba/risk → sunumdaki etkisi → karar.

| # | Fikir | Önceki çalışma (doğrulanmış) | Çaba | Risk | Sunumdaki etkisi | Karar |
|---|-------|------------------------------|-------|------|------------------|-------|
| 5-1 | **Her morphometrik özelliğin hata çubuğu**: ensemble piksel-U → skeleton boyunca örneklenir → count/area/length/angle için CI | NeuroQuantify (arXiv:2310.10978) yalnız **nokta tahmin** raporluyor; PC12/nörit kuantifikasyonunda kimse yapmıyor | 1–2 hf (saf analiz katmanı) | Düşük — en kötü durum: geniş ve sıkıcı CI (gene geçerli bulgu) | **En savunulabilir tezs farklılaştırıcısı**: her tablo CI sütunlu, her figür hata çubuklu; "ölçümün doğru olduğunu nasıl biliyorsun?"a doğrudan cevap | **COMMIT — top pick** |
| 5-2 | **Topoloji-kondisyonlu iki-kollu ana hat** + **2×2 {clDice × TopoLoss} ablation tablosu** | clDice (2003.07311, MIT kod), TopoLoss (1906.05404, MIT kod) — ikisi de damarlarda standart, **kültür-hücre nöritinde birlikte ablate edilmemiş** | 3–4 hf (ana hat içinde) | Düşük; n≈70'de ablation ayrımı orta → 5-fold + CI ile | İlk kez: topolojiyi **eval'de ölçmekle kalmayıp train'de zorlayan** PC12 pipeline'ı | **COMMIT — ana hat** |
| 5-3 | **Foundation-model etiketleme copilot + kör-çaprazlama self-check**: CellSAM/Cellpose-SAM pre-label + 3 kör kontrol görselinde pre-label mask IoU (anchoring check) | CellSAM HITL hedefi (arXiv:2311.11004); copilot literatüründe bias kontrolü yok | 0.5–1 hf | Orta-düşük (sıfır-atış faz-kontrast nörit alanını kötü segmente edebilir; gövde çekirdekte hâlâ kazandırır) | **Ölçülen** etiketleme hızlanma sayısı (literatürden ödünç değil) + önyargı kontrolü — jüriler ölçülen süreç metriğini sever | **COMMIT — top pick** |
| 5-4 | **GNN on per-cell neurite graphs → NGF durumu sınıflandırıcı**, ablation-merkezli (hangi graf özelliği sınıf sinyali taşır) + UMAP embedding birincil sonuç | NeuNet (AAAI 2024, arXiv:2312.14518) — skeleton+GNN nörön sınıflandırmayı büyük ölçek kanıtladı; **küçük-veri 2D PC12 versiyonu yok — boşluk bizim** | **2 hf SERT TAVAN** | Orta-yüksek: n≈1400 hücre-grafla, 2 sınıf = ezberleme riski → tasarım-la mitigasyon (ablation+embedding birincil, accuracy ikincil) | En yüksek "vaay" tavanı: "pipeline yalnız morfolojiden differentiasyon durumunu tahmin ediyor"; başarısız olsa bile ablation yayınlanabilir kalitede | **W6 SPIKE → yalnız demo-grade commit** |
| 5-5 | **Tent TTA + histogram-matching = batch-2 shift için 1-haftalık robustluk protokolü** (gerçek, bedava domain-shift test yatağı) | Tent (ICLR 2021, arXiv:2006.10726); LATTA (2510.05530) kararsızlık notu | 0.5–1 hf | Düşük — en kötü ~0 kazanç → histogram-matching baseline raporlanır; her iki durumda da robustluk bölümü var | Gerçek yeni-seans verisinde **quantified before/after** — sentetik bozma demolarından güçlü | **COMMIT (DA iş-akışı içinde)** |
| 5-6 | **Pseudo-label self-training, topology gate'li** (2–3 tur, §3'te teknik) | Standart; clDice self-consistency (modelin soft vs hard skeleton) = yenilik | 3–5 gün | Orta (onay-önnyargısı) → gate + spot-check + 70 altın görsel sabit holdout | Pipeline'ın etiketli setin ötesine ölçeklendiğini gösterir ("lab aracı" çerçevesi) | **COMMIT W8–10** (pool ≥200 ise) |
| 5-7 | **LoRA-on-SAM karşılaştırma kolu**: peft-sam (micro-sam üzerine hazır) ile 5-fold | SAMed (repo MIT, train.py doğrulandı), peft-sam (MIDL 2025), Conv-LoRA (2401.17868), SAM-OCTA (2309.11758: "birkaç yüz örnek → overfit → LoRA" açık kanıt) | 1–2 hf | Düşük — 24 GB'e sığar, gecelik | Kazanç ya da **savunulabilir negatif sonuç**; FM bölümünün en modern satırı | **COMMIT kolu (W9–10)** |
| 5-8 | **FM pseudo-label pretraining** (APG-style prompt recycling: sıfır-atış FM çıktıları → pretrain → 70 insana fine-tune; clDice before/after gate) | Kidney patolojisi FM distillation (2411.00078, 2510.01287 abstract) | Orta | Orta (ince nöritte yanlış topoloji öğretebilir) → clDice gate | "Kazancın kaçı FM prior'ından?" — jürinin seveceği temiz ablation | **WATCH** (ana hat W10'da karar verir) |
| 5-9 | **Deterministik-pipeline distillasyonu → TEK ONNX model** (mask + özellik tablosu tek forward pass'te; açı için circular loss) | arXiv:2507.23359 (2025, image→SWC end-to-end kanıtı) | 4–5 hf (W8–13) | Orta — özellik regresyonu hata'ları deterministik pipeline'dan yüksek olabilir → ikisini de raporla, app varsayılanı deterministik yol | Tek-model inferans için **tam morphometrik tablo** — AutoNeuriteJ/NeuroQuantify/SNT'in vermediği kullanım+kaynaklamlık kazancı | **STRETCH (pipeline W6'da kararlı ise)** |
| 5-10 | **Cross-modal distillation: FM teacher → ~50M ONNX student** | arXiv:2606.00928 (2026): SAM/CellSAM teacher → 4 küçük U-Net, **+12 Dice, 23× parametre azalması** (kağıdın iddiası) | 1–1.5 hf (W10–12) | Düşük — student-only fallback var | "Foundation-model kalitesi, 7× küçük modelde" — araştırma → üretilen ürünü bağlayan deploy hikayesi | **STRETCH W10+** |
| 5-11 | **Active-labeling loop**: ensemble unlabeled arşivi sıralar → batch 2 geldiğinde PI yalnızca en belirsiz ~20 görseli etiketler → DSC (±20 görsel) raporlanır | 1907.05143 (n=14/24 rejimi) | 3–4 gün (infer+sıralama+export) | PI etiketlemeyi reddedebilir → yedek: "belirsizlik raporu" teslimatı | UQ'den veriye yeniden eğitime **kapanan döngü** — neredeyse hiç öğrenci projesi yapmıyor; UQ'yi figürden ölçülebilir DSC kazancına çevirir | **COMMIT (time-boxed)** |
| 5-12 | **TTA self-consistency açı-sağlamlık kanalı**: 4 döndürme → açı yayılımı = açı güveni | Döndürme-eşdeğerlik (mimari öz, kod yok) | 2 gün | Düşük — model gerçekten equivariant değilse yayılım model-tutarsızlığını ölçer, hâlâ işe yarar | En az korunan özellik (açı) için ucuz, spesifik koruma | **COMMIT (ucuz ek)** |
| 5-13 | **Persistence-barcode distance** metriği (1D VR barcode, bottleneck distance; ripser.py, MIT, ms ölçeği) | SNT'in kendi TDA modülü cross-check referansı | 3–5 gün | Düşük — ek metrik, yük taşıyan parça değil | Kültür-hücre nörit segmentasyonunda **ilk rapor** — "aynı loop sayısı" vs "benzer loop yapısı" ayrımı | **COMMIT eval ek** |
| 5-14 | **Angular-Sholl (16-sektör) + Mardia-Watson-Wheeler + wind plot** fenotip imzası (AutoNeuriteJ'in "mean±std"ının yerine istatistiksel doğru yön okuması) | SNT root-angle analizi | 2–3 gün + 1 hf analiz | Düşük (≥3 karşılaştırılabilir grup gerekli `[OPEN]` gruplar batch'lerde var mı?) | Hiçbir PC12 aracının kutudan vermediği doğru yön-morfometrisi | **COMMIT analiz ek** |
| 5-15 | **Nörit-farkında iki-sınıf flow-field** (Cellpose decoder'ını gövde+nörit labelmap'lerinde, anizotropi-aware küçük loss ile fine-tune) | Cellpose-SAM (bioRxiv 2025.04.28.651001); **PC12 nörit sınıfında flow-field modeli yok — boşluk gerçek** | 2–3 hf | Orta — star-convex dinamiği 2 px kolları hâlâ kırpabilir → güvenli versiyon = iki-kollu U-Net (ana hat zaten) | Faz-kontrast küçük-veri tezs'inde **ilk** flow-field gövde+nörit ortak modeli | **WATCH — 5-2 ana hat zayıf kalırsa "yenilik" iddiası olur** |
| 5-16 | **Saliency-güdülü morphometrik QA**: bir nörit'in skeleton'ı boyunca ensemble anlaşmazlığı yüksekse o hücrenin length/angle özelliği "güvenilmez" işaretlenir; MAE'nin yanında **özellik-bazlı güvenilirlik** raporlanır | Yok (iki pipeline yarısının birleştirilmesi = kombinasyon) | 4–5 gün (5-2 skeleton'ına bağlı) | Orta — belirsiz kenarlar U'yu abartabilir → eşik ayarı | **Özellik-bazlı** (görsel-bazlı değil) belirsizlik — tezs ölçeğinde yeni; zorunlu per-feature hata metriklerine birebir oturur | **COMMIT (W10'da plan programında ise)** |
| 5-17 | **ONNX-identical XAI**: IG/Grad-CAM exported ONNX grafiği içinde çalışır → app **dağıtılan tam artifact**ı açıklar, PyTorch ikizini değil | ONNX Runtime gradient API | 3 gün spike | Operatör boşlukları → takılırsak at (PyTorch ikizi yedek, savunulabilir) | "Ama app'iniz farklı model çalıştırıyor" itirazını öldürür — çok az öğrenci projesi | **WATCH (time-boxed spike)** |
| 5-18 | **SAM2 / Trackastra time-lapse tracking** (statik morfometri → NGF altında büyüme yörüngesi) | SAM2 cell tracking (2509.09943), Trackastra (2405.15700, micro-sam ile entegre) | Yüksek | Yüksek — **uzunlamalı (time-point) veri gerekli** | "Vaay" — C1'in somut hali | **STRETCH — bu hafta longitudinal veri var mı teyit edilmeli `[OPEN]`** |

**Reddedilenler (ve neden):** DANN/stil-transfer DA (kanıt zayıf, maliyet yüksek) ·
RetinaNet iki aşama (yalnız yoğunluk başarımında tetiklenirse) · doğrudan
morphometrik regresyonu **yenilik** olarak sunmak (literatür çapası zayıf;
5-9'daki distillasyon versiyonu kanıtlı) · Mamba (ONNX riski) · Swin-UNet
(lisans yok) · **VesselMUNet / TransNewSeg / MoCell / DICE / Cell-Clarity**
(kamu kaydında yok — üzerine plan kurmayın, alıntılamayın) · diüzyon sentezi ·
FixMatch · CRITIC (repo 404) · STARDOM (bulunamadı) · evidential · SegGrad-CAM.

**Top-3 önerisi (15 haftaya sığanlar):**
1. **5-1 Hata çubukları** — en savunulbilir, en ucuz, her yere yayılan
   farklılaştırıcı (analiz katmanı: mimari risk sıfır).
2. **5-2 Topoloji-kondisyonlu ana hat + 2×2 ablation** — projenin teknik
   omurgası; "standart metrik geometrimiz için yanlış" hikayesinin kanıtı.
3. **5-3 + 5-11 Etiketleme copilot (kör kontrolle) + active-labeling loop** —
   ölçülen süreç metrikleri + kapanan UQ→veri döngüsü; jürinin hatırladığı türden.
Plus: **5-4 GNN spike** = işe yararsa "vaay", yaramazsa yayınlanabilir ablation.

---

## 6. Nihai mimari önerisi (bu araştırmanın çıktısı)

> Aşama-aşama, tek, tutarlı, defans edilebilir mimari. Her seçim
> "neden bu, neden şu değil" gerekçesiyle. Bu bölüm, `04-PIPELINE`'ın v2'si
> olur ve W2/W4 SUNUM'larının teknik omurgasıdır.

```
 RAW (pc/fluor, batch alanlı)
   │  S0: normalize + metadata (pixel-size → µm `[OPEN]` D5)
   ▼
 S1: histogram-matching; (train-only) CLAHE + illumination/contrast/gamma jitter
   │  [BASE] yöntemler, [PLANNED] yapılandırma; non-destructive
   ▼
 S2: İKİ-KOLLU segmentasyon (paylaşımlı encoder)
   │  ┌─ gövde kolu : ImageNet-pretrained encoder (ResNet-34 / EfficientNet-B0, SMP-MIT)
   │  │               + U-Net / UNet3+ decoder ; loss = Dice+Tversky
   │  │               [neden: ~40 img'de kazanmış mimari ailesi; full-res path
   │  │                ince yapı; MIT; ONNX olgun]
   │  └─ nörit kolu : düz binary segmentation ; loss = Dice+Tversky + soft-clDice(w 0.2–0.3)
   │                  [+TopoLoss ablation]
   │                  [neden: hiçbir FM nörit instance'ı vermiyor (R2);
   │                   sahnenin kanıtlı yolu mask→skeleton (R3);
   │                   star-convex öncülü ince dallara yapısal düşman]
   │  CV: 5-fold IMAGE-bazlı (assert'li); patch-based; augmentasyon §6(15)
   │  W6 kapısı: Cellpose-SAM cpsam_v2 / μ-SAM+APG / CellSAM / StarDist / SAM
   │             → "FM prior" satırı + gövde instance motoru + pseudo-label kaynağı
   │             + LoRA-on-SAM kolu (5-7)
   ▼
 S3: Post-processing
   │  gövde: FM instance mask'i varsa tam sayım; yoksa watershed; başarısızsa FLAG (D3)
   │  nörit: clean → skeletonize (Zhang-Suen) → skan graf → FilFinder budama
   │         (L_min 5/10/20 µm süpürmesi) → kök-yaprak yolları
   ▼
 S4: Morphometrik özellik tablosu (hücre + görsel)
   │  count, area(µm²), nörit sayısı, uzunluk, açı(circular)
   │  + TOPOLOJİ: Betti-1, clDice, (stretch) barcode distance
   │  + CI: ensemble U → skeleton → **özellik-bazlı hata çubukları** (5-1)
   │  + güven: TTA açı yayılımı (5-12) · QA flag'leri (5-16)
   ▼
 S5: XAI / UQ (app'te)
   │  IG saliency overlay · ensemble belirsizlik overlay · gözden-geçirme kuyruğu
   │  sıcaklık kalibrasyonu (ECE) · deletion-curve doğrulama (raporda)
   ▼
 S6: Offline app (ONNX)
      dağıtılan model: 5-seed ensemble (tek checkpoint gerekirse distille)
      rapor: PDF/HTML — her tablo CI sütunlu, her model "5-fold mean±std"
```

**Ana hat adaylarının W9'daki yeri:** SMP {U-Net, UNet3+, UNet++} + nnU-Net v2
ResEnc L + SA-UNet (damar-transfer) + TransUNet (negatif satır) → 5-fold
mean±std ile birincil seçilir; FM'ler "öncü" rolünde kalır (gövde instance +
pseudo-label + LoRA kolu), nörit kolu hiçbir zaman FM'den gelmez.

---

## 7. Açık maddeler ve riskler

| # | Madde | Durum | Kapı |
|---|-------|-------|------|
| O1 | Pixel-size (µm/px) — uzunluk/alan µm için | `[OPEN]` (D5) | W3 (T1.1, dept'e sor) |
| O2 | Unlabeled pool büyüklüğü — pseudo-label/AL/DINOv2 ölçeğini belirler | `[OPEN]` (Berke) | W3 |
| O3 | Batch-2 boyutu — plan her ≥20 img için geçerli | `[OPEN]` (D10) | ETA ~W3 |
| O4 | Longitudinal (time-point) veri var mı — 5-18'i açar/kapatır | `[OPEN]` | **bu hafta teyit** |
| O5 | Karşılaştırılabilir grup (kontrol/NGF) ≥3 mü — 5-14'ü açar | `[OPEN]` (Berke) | W3 |
| O6 | GT'de nörit genişliği etiketi var mı — EDT genişlik özelliği | `[OPEN]` (Berke) | W4 protokol freeze |
| O7 | 70 img az sayıda well'den mi — split by well gerekebilir | `[OPEN]` (`15` §4) | W3 |
| O8 | Cell-DINO (gated + NC) — yalnız floresan birincil girişse | `[OPEN]` | W6 kararı |
| O9 | SA-UNet repo lisansı | `[VERIFY]` (repo açılmadı) | alıntılarken |
| O10 | 5-4 GNN spike'ın 2 hf tavanına uyumu | W6 spike sonucu | W8 |

**Lisans riskleri (dağıtılacak app için):** NeuroQuantify repo'da LICENSE yok →
incelenebilir, **kopyalanamaz** · Cellpose ağırlıkları CC-BY-NC → tezs'te
koşulur, **app'e gömülmez** · Pytorch-UNet GPL, Swin-UNet lisanssız, resmi
UNetPlusPlus NC → SMP (MIT) kullanılır · SNT/MorphoLogic GPL → **yalnız
output-level cross-check** (depo koduna girmez) · checkpoint lisansları
(PanNuke/MoNuSAC CC-BY-NC-SA) → dağıtımda yok.

**Risk→mitigasyon (araştırmadan):**
- n≈70'de ablation ayrımının gölgede kalması → 5-fold + CI + Betti/clDice
  (alan-metriklerinin gölgeleyemeyeceği topoloji metrikleri) (R1/R3).
- FM pseudo-label'lerin yanlış topoloji öğretmesi → clDice before/after gate (R2).
- Ensemble'in "CV-fold = ensemble" tuzağı → 5-seed deploy + fold benchmark ayrımı,
  kendi fold'ında asla ortalama yok (R5, 2605.18329).
- Saliency'in "güvenilir görünen ama anlamsız" olması → deletion curve + model-swap
  rapora zorunlu (R5; R-V10 uyarısı).
- ONNX export'te operatör boşluğu (özellikle Mamba) → Mamba teslimatta yok;
  ana hat olgun operatör seti (R1).
- Pseudo-label onay-önnyargısı → topology gate + 5-img spot-check + 2–3 tur tavanı
  + 70 altın görsel sabit holdout (R4/R3).
