# THE LONGEST RUN — Proje Durumu / Taşıma Dosyası

> **Son Güncelleme:** Faz 2.5 — Dönem Bazlı Kart Mimarisi (Era Cards), Dinamik Rakip OVR Dengelemesi, Azalan Verimler (Diminishing Returns) & HOF Rozetleri, Günlük Bilet ve Kalıcı Kart Albümü (Binder).

---

## 1) Son Yapılan Mimari İyileştirmeler ve Düzeltmeler

1. **Dönem/Sezon Bazlı Kart Havuzu (`donors.js`):**
   - Tekil oyuncu profilleri yerine oyuncuların kariyerlerinin farklı zirvelerini yansıtan **Era Kartları** tanımlandı (`'88 Jordan`, `'96 Jordan`, `'00 Shaq`, `'06 Shaq`, `'13 LeBron`, `'20 LeBron`, `'16 Curry`, `'86 Bird` vb.).
   - Her kartın o döneme özgü oyun stili (şut yeteneği, atletizm, savunma gücü) gerçeğe sadık kalınarak modellendi.

2. **Karşı Takım OVR'ının 54'te Kilitlenme Hatası Giderildi (`engine.js`):**
   - Logaritmik delta ve 50 nötr bazlı ölçekleme formülü revize edildi.
   - Yeni dinamik formül: Rakip gücü, oyuncunun anchor gücünden 5 puan geride başlar ve her galibiyette $+1.25$ OVR akıcı bir şekilde tırmanır ($OVR = \text{Anchor} - 5 + \text{Streak} \times 1.25$). Rakipler artık seri boyunca kademeli olarak güçlenmektedir.

3. **Ödüllerde Azalan Verimler (Diminishing Returns) ve 99 HOF Rozetleri (`rewards.js`):**
   - Oyuncuyu 4-5 maçta sınıra dayayan sabit +12, +18, +27 boost sistemi kaldırıldı.
   - Kalan mesafe formülü uygulandı: $\text{Artış} = \lceil(99 - \text{Mevcut}) \times \text{Oran}\rceil$.
   - **Limit Break:** 99'a ulaşan statlar için boşa gitme durumu engellendi; stat 99'a vardığında o slot için **HOF Rozeti (Badge)** kilit açılır.

4. **Günlük Bağlılık Döngüsü (Daily Tickets, Tokens & Binder):**
   - Oyuncunun günlük 3 giriş bileti (🎟️) ve kazandığı tokenler (`tlr_tokens`) kaydedilir.
   - Run sırasında absorbe edilen tarihi kartlar oyuncunun kalıcı **Albümüne (Binder)** eklenir. Oyuncu dilediği zaman üst bardan koleksiyonunu açıp topladığı dönem kartlarını inceleyebilir.