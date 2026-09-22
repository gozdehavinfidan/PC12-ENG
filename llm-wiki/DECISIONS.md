# DECISIONS (ADR log)

> Load-bearing decisions, in reverse-chron order. Each entry: context →
> options → decision → tradeoffs → confidence + tag. Small decisions can be a
> one-liner. If a decision gets **reversed**, don't delete — add a new entry
> that supersedes it (keep the history).

Format:
```
### D<n> — <title>  [Wk] [status: proposed/accepted/reversed]
- Context:
- Options:
- Decision:
- Tradeoffs / confidence:
```



### D14 — Konsept kanonu = TÜSEB 2026 NTI başvurusu; mimari bizim  [2026-09-22] [accepted]
- Context: kullanıcı `TUSEB/bolumler/`'i ekledi (2026 TÜSEB başvurusu —
  Prof. Dr. Mustafa Şen, 24 ay, 3.000.000 TL, 5 İP, **NTI** kavramı) ve
  net konuştu: *"mimariyi değiştireceğiz ama konseptimiz ve amacımız
  buradaki ile aynı olacak"*. Wiki'nin kanonu o zamana kadar 2025
  "NeuroMind" PDF'i (44235, Eren B. Yıldız, 50 000 TL, 12 ay) idi.
- Options: (a) 2025 PDF'i kanon olarak koru  (b) **2026 bolumleri konsept/
  amaç kanonu yap; 2025 PDF'ini referans seviyesine düşür**.
- Decision: **(b)**. Konsept ölçüm zinciri = segmentasyon → 4 morfometrik
  parametre (nörit uzunluğu, dallanma sayısı, dallanma açısı dağılımı, soma
  morfolojisi) → **NTI** (MTT/LDH ile kalibre, süreksiz skor) → zamansal
  profil (0/6/24 s) → SHAP düzeyi bileşen atfı → IntelliCell masaüstü
  uygulaması. Mimari (segmentasyon + loss) bilinçli olarak D13'ün
  iki-kollu tasarımı — tablonun Swin/bio_prior yığını değiştirir.
- Consequences: `02` yeniden yazıldı (`[BASE26]` etiketi yeni kanon için;
  `[BASE]` artık 2025 NeuroMind'a götüren referans etiketi). `00`, `03`
  (notlar), `04`, `06`, `07`, `08`, `10`, `12`, `13`, `README` uyum
  edildi. NTI bizim teslimat setimize girdi (00 #5).
- Tradeoffs / confidence: **Yüksek** (doğrudan kullanıcı talimatı, belge
  elden geçti). Açık kapı **O1** `[OPEN]`: elimizdeki ≈70 görselin
  **doz/zaman noktası/koşul metadata'sı var mı?** Var → NTI gerçek koşullar
  üzerinde hesaplanır; yok → NTI kavramı mevcut koşullarda demo edilir,
  kalibrasyon derinliği 24-aylık projenin kapsamı olarak kalır. O1'i
  T1.1 data card'da sor (T1.1 notu buna göre güncellendi).

---
### D0 — Keep the base's 2-class core (bg / cell_body / neurite)  [W2] [accepted]
- Context: class scheme drives segmentation, metrics, and features.
- Options: (a) bg/cell/neurite  (b) + nucleus  (c) instance-based only.
- Decision: **(a)** for the core; nucleus is `[IDEA]` only if fluorescence
  clearly shows it.
- Tradeoffs/confidence: High. (a) is the minimum that yields all 5 base
  outputs; (b) adds a class we may not be able to label; (c) is hard on
  overlapping neurites.

### D1 — Primary model = U-Net family; nnU-Net as auto-config option; TransUNet as reach  [W2] [proposed]  **partially superseded by D9 + `15` §2**
- Context: small data, 2 people, 1 semester → need a debuggable, reliable model.
- Options: DS-UNet/U-Net++ (workhorse), nnU-Net (auto), TransUNet (reach), Cellpose (trainable).
- Decision: **U-Net family as workhorse**; run the 4 baselines always; promote
  nnU-Net / TransUNet only if on schedule.
- Tradeoffs/confidence: Med-High. Favors reliability over novelty; final pick
  is by validation DSC (T2.5). Confirm hardware (A6) before committing nnU-Net.
- ⚠ **Superseded (D9, W1 session 2):** the workhorse is now specifically an
  **ImageNet-pretrained encoder + U-Net decoder** (random-init DS-UNet is out —
  it wastes scarce labels), and **TransUNet is `[IDEA]`-only, not "if on
  schedule"** (`15-SMALL-DATA-STRATEGY` §2). nnU-Net was gated on A6 — **resolved
  (D12)** and **final model set + loss defined in D13** (`16-ARCHITECTURE-RESEARCH`).
  state of record: `05-MODELS.md`.

### D2 — Neurite geometry = skeleton + graph (Canny+Hough as fallback)  [W5] [proposed]
- Context: need per-neurite length, count, angle, and (ideally) branching.
- Options: (a) **skeletonize → graph** (branches/junctions/endpoints)  (b)
  Canny + Hough (as in the base)  (c) hybrid.
- Decision: **(a)** primary; (b) fallback for sparse/faint cases.
- Tradeoffs/confidence: Med. Skeleton+graph handles junctions and yields
  branch order (feeds Sholl, B2). Canny+Hough is simpler but weaker at
  junctions. Confirm with the T3.1 spike vs hand-measured (Berke) before final.

### D3 — Instance separation depth  [W9] [proposed]
- Context: touching cell bodies break connected-component counting.
- Options: (a) distance-transform + watershed  (b) flag merged blobs, don't
  separate.
- Decision: **(a)** attempt separation; **(b)** when it clearly fails — and
  *flag* it in the report + error analysis.
- Tradeoffs/confidence: Med-High. Honest flagging is better than a silently
  wrong count. Watershed can over-split → gated by a sanity check.

### D4 — App framework  [W10] [open]
- Context: offline desktop app (NeuroMind-style) that ships an ONNX model.
- Options: (a) **PySide6/Qt** (native desktop)  (b) web-in-shell
  (Electron/Tauri / pywebview).
- Decision: **TBD at T5.1** — leaning (a) for a true offline .exe; (b) if we
  want a shareable web view (C8).
- Tradeoffs/confidence: Low (not yet decided). Both viable; decide by demo
  needs + packaging ease.

### D5 — Units (µm vs px)  [W3] [open]
- Context: length/area in µm require pixel size; the base doesn't state it.
- Options: (a) get µm/px from the dept  (b) report in px + state assumption.
- Decision: **TBD (T1.1)** — ask the dept; if unavailable, (b) with a clear note.
- Tradeoffs/confidence: Med. µm is far more meaningful to a biologist.

### D6 — Rotation augmentation vs the angle metric  [W4] [proposed]
- Context: 90° rotation augmentation changes absolute neurite angle.
- Options: (a) allow rotation (angle task uses *relative/directional* or
  orientation-only)  (b) disable rotation for the angle-sensitive model.
- Decision: **TBD** — if angle is a *primary* output, prefer (b) or define the
  angle as **orientation** (0–180°) so 180°-symmetry is safe; keep 90°-flips
  only if the metric is rotation-invariant.
- Tradeoffs/confidence: Med. This is a subtle-but-real correctness issue;
  resolve in T0.3/T1.4.


### D7 — Dashboard = static `data.js`, not `data.json` + fetch  [W1] [accepted]  **supersedes `09-DASHBOARD.md` v1**
- Context: the dashboard must run **locally by double-click first**, and be
  published to **GitHub Pages later** so Berke can view it. One codebase, both
  environments, no build step.
- Options: (a) `data.json` + `fetch()`  (b) `<script type="module">`
  (c) inline `<script type="application/json">`  (d) **classic
  `<script src="data.js">` assigning `window.PC12_DATA`**.
- Decision: **(d)**.
- Tradeoffs / confidence: **High.** (a) and (b) both fail on the `file://`
  origin — `fetch` and module scripts are CORS-checked, and a `file://` page has
  an opaque `null` origin, so the page would render **empty locally and work
  only after being pushed**, which is the worst possible failure mode for a tool
  meant to be used locally first. (c) works but buries the weekly-churning data
  inside `index.html`, guaranteeing git conflicts between Berke's status edits
  and Gözde's layout edits. (d) is CORS-exempt, keeps the churn isolated in one
  file, and — because it is JS, not JSON — permits comments and trailing commas,
  which matters for a file two people hand-edit fifteen times.
- Consequence: a syntax error in `data.js` blanks the page silently, so
  `app.js` **must** ship a `window.onerror` + missing-global red banner.
- Also supersedes 09 v1's acceptance criterion *"drag updates the data file"* —
  a static page cannot write a sibling file. Replaced by *drag updates state +
  a "copy data.js" export button*.

### D8 — No assigned architecture track; model chosen by CV at the W9 gate  [W1] [accepted]
- Context: `PC12_Gantt_Chart.xlsx` contains three variants — A1 nnU-Net,
  A2 DS-UNet + soft-clDice, A3 ViT-UNet + SimAM + Tversky. User confirmed these
  belong to **other groups**; we are on the main sheet with no assigned track.
- Options: (a) adopt one of A1–A3  (b) keep model choice open and decide by
  evidence.
- Decision: **(b)** — run the candidates ranked in `05-MODELS`, decide at the
  **W9 gate** by 5-fold CV **mean ± std**.
- Tradeoffs / confidence: **High.** Being unassigned is an advantage: we can
  report a *comparison* rather than a single architecture, which is a better
  result and is also robust to any one approach failing.
- ⚠ Note the overlap: if we adopt soft-clDice (S3), we are partially on A2's
  ground. Acceptable as an **auxiliary loss** on a different backbone, but make
  it a conscious choice and say so in the presentation rather than being asked.

### D9 — Small-data strategy: pretrained encoder + patching + 5-fold CV  [W1] [accepted]
- Context: **≈70 labeled images**, more in ~2 weeks (user, W1). This is the
  binding constraint of the whole project.
- Options: (a) train from scratch, single 70/15/15 split (the original plan)
  (b) pretrained encoder + patch-based training + 5-fold CV + foundation-model
  baseline.
- Decision: **(b)**. Full reasoning in `15-SMALL-DATA-STRATEGY.md`.
- Tradeoffs / confidence: **High.** (a) spends scarce labeled data on relearning
  generic vision features, and its ~10-image test set has variance larger than
  the model differences we are trying to measure — we would pick an architecture
  by coin flip. (b) costs 5× training time, which is affordable at this size.
- Hard constraint it introduces: **split by image, then patch — never the
  reverse** (`06-DATA` §5). Enforced by assertion, not by comment.
- Supersedes: the 70/15/15 ratio in `06-DATA` v1.

### D6 — UPDATE  [W1]
- `15-SMALL-DATA-STRATEGY` §6 sharpens this: augmentation is now **load-bearing**
  (small data), so "just disable rotation" is more costly than it was. Preferred
  resolution is now **define the angle as orientation (0–180°)** and recompute
  labels under the transform where feasible — keeping rotation available as a
  regulariser. Still `[proposed]`; decide at T1.4.

### D10 — Incoming data batch: ETA ≈ 2 weeks (≈ W3), plan around it  [W1] [accepted]  **supersedes İP7 "contingency" framing**
- Context: user confirmed (W1, session 2) that **≈ 70 PC12 images are already
  labeled** in hand, and a **further batch arrives in ~2 weeks** — so the
  architecture design and the schedule must be built around a known two-phase
  data arrival.
- Options: (a) keep İP7 as an optional contingency (original plan)
  (b) **plan around the arrival**: freeze the labeling protocol before it
  lands, record `batch` as a data-card field, use batch 2 as the held-out
  final test set.
- Decision: **(b)** — İP7 is a **commitment**, not a contingency.
- Tradeoffs / confidence: **High.** The only cost is sequencing (protocol
  freeze at the W4 gate), which the SUNUM calendar already forces
  (`13-SUNUM-PLAN` SUNUM 2). It also *unlocks* the two strongest claims:
  performance on never-seen data (batch 2 held-out test) and an honest
  distribution-shift / old-vs-new comparison.
- Consequence: `03-SEMESTER-PLAN` İP7 + risk register, `06-DATA` §8,
  `10-IDEAS-STRETCH` B1 updated. Batch-2 size is still `[OPEN]` — the plan
  holds for any size ≥ ~20 images.

### D12 — Compute confirmed: A5000 24GB + A6000 48GB  [W1] [accepted]  **resolves A6**
- Context: user confirmed (W1, session 3) access to an **RTX A5000 (24 GB)**
  and an **RTX A6000 (48 GB)**. A6 was the last `[OPEN]` assumption; its
  resolution lifts the gate on nnU-Net and makes foundation-model fine-tuning
  and ensembles affordable.
- Decision: two-GPU division of labour —
  - **A6000 (48 GB)**: long jobs — 5-fold CV, large encoders, foundation-model
    fine-tune, ensembles, overnight runs.
  - **A5000 (24 GB)**: dev/iteration — fast single-fold runs, HP sweeps,
    Cellpose-SAM zero-shot, XAI experiments.
- Consequences (state of record):
  - `03-SEMESTER-PLAN`: A6 → `[CONFIRMED]`; risk row "No GPU" resolved.
  - `05-MODELS`: nnU-Net is **no longer gated** — enter the W9 comparison.
  - Ensembles become credible: **the 5 CV folds are a free 5-model ensemble**
    for uncertainty — **refined by D13** (deploy a true 5-seed ensemble; use the
    CV-fold ensemble only as validation benchmark).
  - Compute is **no longer a constraint** — the binding constraint remains
    **labeled data** (n≈70) and **time** (15 weeks).

### D13 — Ana mimari: iki-kollu segmentasyon + topoloji-kondisyonlu loss + 5-seed ensemble  [W1] [accepted]
- Context: `16-ARCHITECTURE-RESEARCH.md` (2026-09-22, 6 paralel literatür
  scout'u, birincil kaynaklar) döndü. D1/D9'un model seçimini mimari düzeyde
  netleştirmek gerekiyordu; ayrıca ensemble, morpho-stack ve XAI'nin kaynağı
  tek dosyada toplanmalıydı.
- Options:
  (a) tek kollu multi-class (bg/gövde/nörit) — orijinal `04` taslağı
  (b) **iki kollu**: gövde = SMP pretrained U-Net ailesi; nörit = düz binary
      kol + soft-clDice; morphometrik özellikler mask→skeleton→graf'tan
  (c) foundation model'leri ana hat olarak (Cellpose-SAM'ın nörit sınıfına fine-tune)
- Decision: **(b)** — `16` §6 resmi v2 mimari.
- Tradeoffs / confidence: **High.** (c) düşer: hiçbir doğrulanmış FM nörit
  instance'ı vermiyor (star-convex/box öncülü ince dallara yapısal düşman —
  `16` §1.2 tutarlı bulgu; R2: "use it as the cell-body engine, not the
  neurite engine"); (a) tek-kollu versiyonu nörit kolunun shape-prior'ı
  gövdeye bulaştırır. (b) sahnenin kanıtlı yolu (NeuroQuantify, AutoNeuriteJ,
  SNT — hepsi mask→skeleton) ve D0 sınıf şemasıyla uyumlu. Loss: gövde
  Dice+Tversky, nörit +soft-clDice (w 0.2–0.3, MIT) + (ablation) TopoLoss.
  Ensemble: dağıtılan model = **5-seed derin ensemble** (tam veri); CV-fold
  ensemble yalnız doğrulama benchmark'ı; bir fold'ın tahmini kendi
  validasyon fold'unda asla ortalama (leakage) — Kirscher 2026,
  arXiv:2605.18329. D9'un "pretrained encoder + U-Net" kararı **doğrulandı**,
  decoder ailesi {U-Net, UNet3+, UNet++} + nnU-Net v2 ResEnc L olarak
  genişledi; nnU-Net'in clDice için trainer subclass gerektirdiği not edildi.
- Consequence: `04-PIPELINE` S2–S5, `05-MODELS` tablosu, `08-XAI` §2,
  `13-SUNUM-PLAN` SUNUM 3/4/5, `10-IDEAS-STRETCH` shortlist — tamamı
  2026-09-22 güncellendi.

### D11 — Dashboard veritabanı: data.txt olay günlüğü + bellekte tutulan token  [W1] [accepted]
- Context: Berke ile ortak kullanılacak; site GitHub Pages'te statik. Kullanıcı
  "eklenenler otomatik bir txt dosyasına kaydedilsin" istedi.
- Options: (a) tek bir durum dosyasını her seferinde baştan yaz
  (b) **append-only olay günlüğü** + `data.js` baseline.
- Decision: **(b)**. `docs/data.txt` sadece sona eklenir; canlı durum =
  `data.js` + olaylar. Her olay 6. alanda bir **id** taşır.
- Tradeoffs / confidence: **Yüksek.** Codex ile incelendi (collab-board oturumu
  `2026-09-22-interactive-txt-db`). Codex iki hatamı düzeltti:
  1. "git EOF eklemelerini otomatik birleştirir" **yanlıştı** — aynı noktaya iki
     ekleme tam da git'in çakışma verdiği durum. Olay günlüğünün gerçek değeri:
     çakışma sonrası **idempotent yeniden uygulama** ve kaynak izlenebilirliği.
  2. Tek retry yetersiz: iki yazıcıda A→S1, B çakışır→S1, A→S2, B'nin tek
     denemesi yine çakışır ve olay kaybolur. Çözüm: outbox + id + sınırlı
     rastgeleleştirilmiş backoff; outbox, uzak dosya yeniden okunup id'ler
     orada görülene kadar **temizlenmez**.
- **Token bellekte, localStorage'da değil.** GitHub'ın OAuth token endpoint'i
  CORS başlığı göndermiyor → sunucusuz device flow imkânsız; yani tarayıcıdan
  yazan her çözüm sayfa JS'ine bir kimlik bilgisi göstermek zorunda. Tek kaldıraç
  token'ın ömrü: sekme kapanınca siliniyor.
- Kabul edilen artık risk: fine-grained PAT depo bazında yetkilendirilir, **yol
  bazında değil** — sızan bir token `app.js`'i de değiştirebilir. Bilinerek kabul
  edildi, memory-only tercihini güçlendiriyor.
- **Güvenlik kuralı:** `data.txt`'den gelen her metin (notlar, görev başlıkları)
  DOM'a girmeden önce `esc()`'ten geçer. Burada kaçış bir **güvenlik kontrolü**,
  biçimlendirme değil.
