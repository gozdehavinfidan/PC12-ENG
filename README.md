# PC12 Hücre Morfolojisi — Otomatik Analiz (ENG400)

Görüntü işleme + derin öğrenme ile **PC12 nöronal hücrelerinin** otomatik
morfolojik analizi: hücre sayısı, hücre alanı, nörit sayısı, nörit uzunluğu,
nörit açısı.

**Ekip**
- **Gözde Havin Fidan** — Elektrik-Elektronik Müh. · yazılım / ML / dashboard
- **Berke Dinç** — Biyomedikal Müh. · veri / biyoloji / etiketleme / doğrulama

Bu proje, TÜSEB **"NeuroMind"** başvurusunu (`Tuseb_2025_Basvuru_Eren.pdf`)
**temel sürüm** kabul edip sıfırdan geliştirilmiş hâlidir. Temel sürümün
kendisi ve nerede aştığımız `llm-wiki/02-BASE-PROJECT-TUSEB.md` ile
`llm-wiki/10-IDEAS-STRETCH.md` içinde.

---

## 📊 Dashboard

**Yerel:** `docs/index.html` dosyasına çift tıklayın. Kurulum yok, sunucu yok.

**Yayında:** _(GitHub Pages açıldıktan sonra buraya link gelecek)_

Canlı durum, Gantt, görev panosu, sunum planı ve risk kaydı buradadır.

**Site yazılabilir.** Görevi tamamlandı işaretleyin, kendinizi göreve ekleyin,
görev ekleyin, not düşün — hepsi `docs/data.txt`'ye bir satır yazar. Sayfa her
açılışta `data.js` + `data.txt`'den durumu yeniden kurar, yani işaretlemeleriniz
yenilemede kaybolmaz.

Kaydetmek için soldaki kutudan **"Token gir ve kaydet"**. Token yalnızca o sekme
açıkken bellekte tutulur, hiçbir yere kaydedilmez. Tokensiz isterseniz
**"Satırları kopyala"** deyip GitHub web editöründe yapıştırın.
Ayrıntı → `llm-wiki/09-DASHBOARD.md`, gerekçe → `llm-wiki/DECISIONS.md` D11.

## 📚 llm-wiki

Projenin bilgi tabanı. **Okuma sırası:**

1. **`llm-wiki/00-OVERVIEW.md`** — problem, ne yapıyoruz, başarı ölçütleri
2. **`llm-wiki/15-SMALL-DATA-STRATEGY.md`** ⭐ — **n ≈ 70 her şeyi belirliyor.**
   04/05/06/07'den önce okunmalı.
3. `llm-wiki/02-BASE-PROJECT-TUSEB.md` — TÜSEB temel projesinin çözümlemesi
4. **`llm-wiki/13-SUNUM-PLAN.md`** — her sunum haftasında ne gösteriyoruz
5. `llm-wiki/03-SEMESTER-PLAN.md` — dondurulmuş baseline plan
6. Gerisi ihtiyaca göre → `llm-wiki/README.md` dosya haritası

**Kaynak kullanırken:** ✅ `14-REFERENCES-VERIFIED.md`'den atıf yapın.
⚠️ `12-REFERENCES.md` **doğrulanmamıştır** — içindeki arXiv numaraları, DOI'ler
ve yazar adları kontrol edilmeden rapora girmemeli.

## 🔁 Çalışma biçimi

Her belirsizlik `llm-wiki/11-SEARCH-WORKFLOW.md` içindeki
**SCOPE → SEARCH → TEST → DECIDE → LOG** döngüsüyle çözülür. İki komut hazır:

| Komut | Ne yapar |
|-------|----------|
| `/spike <soru>` | Tek bir soru için tüm döngüyü işletir; kaynak bulur, kısıtlarımıza uyup uymadığını test eder, ADR taslağı çıkarır, log satırı yazar |
| `/sunum` | Sunum öncesi haftalık geçiş: wiki ↔ `data.js` farkı, bayat görevler, bu haftanın iddiasına dayanak olan açık `[OPEN]`/`[VERIFY]` etiketleri |

**Altın kural:** kaynağı veya kendi koşumuz olmayan hiçbir sayı yazılmaz.
Bilinmeyen `[OPEN]` olarak işaretlenir — uydurulmaz.

## 🗂 Depo yapısı

```
docs/          dashboard (GitHub Pages buradan yayınlanır)
llm-wiki/      bilgi tabanı + plan + kararlar
.gitignore     ⚠ TÜSEB PDF'i ve ham veriyi dışarıda tutar
```

> ⚠ **Ücretsiz GitHub Pages herkese açık depo gerektirir.** İlk `git add`'den
> önce `.gitignore`'u kontrol edin: `Tuseb_2025_Basvuru_Eren.pdf` yayımlanmamış
> bir proje başvurusudur ve git geçmişine girdikten sonra temizlemek zordur.
> Ham mikroskop verisi de aynı şekilde depoya girmez.

## 📅 Takvim

Sunum haftaları: **W2 · W4 · W6 · W9 · W11 · W13** (hepsinde sunuyoruz) ·
**W8** vize · **W15** final.
Her sunum için ne göstereceğimiz `llm-wiki/13-SUNUM-PLAN.md` içinde.
