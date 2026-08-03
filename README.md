# Lole Yönetim

Çok şirketli personel & görev yönetimi uygulaması — **Faz 1 (çekirdek)**.

Lole Fabrika · Lole Restaurant · Lole Patisserie · Lole Pazarlama — her şirket izole bir tenant;
Postgres **Row Level Security** ile yetkiler veritabanı katmanında zorlanır.

## Bu sürümde neler var (Faz 1)

- ✅ Giriş / oturum (Supabase Auth) + rol bazlı arayüz (süper admin, admin, müdür, personel)
- ✅ **Ana Sayfa** — Apple Anımsatıcılar tarzı: Bugün / Yaklaşan / Gecikmiş / Öncelikli / Tamamlanan sekmeleri, ilerleme çubuğu, tik atarak tamamlama, kişisel notlar, Pano önizlemesi
- ✅ **Görev detayı** — checklist maddeleri, fotoğraf/dosya ekleme (zorunlu fotoğraf kapısı), notlar, **Engel Bildir**, **yönetici Onayla/Reddet** akışı
- ✅ **Görev oluşturma** — kişi/departmana atama, tarih-saat, öncelik, **Günlük/Haftalık/Aylık/Özel tekrarlama** (RRULE, örnekler önceden üretilir)
- ✅ **Şablonlar** — checklist şablonu oluştur, tek dokunuşla görev olarak ata
- ✅ **Takvim/Ajanda** — aylık ajanda görünümü, müdürler için ekip takvimi
- ✅ **Pano & Duyurular** — şirket geneli / departman duyuruları, sabitleme, okundu takibi
- ✅ **Admin paneli** — sınırsız kullanıcı ekleme, departman ekleme (4 hazır departman otomatik)
- ✅ **Süper admin** — yeni şirket ekleme, şirketler arası geçiş (tam yetki)
- ✅ Denetim izi (activity_log) + uygulama içi bildirim kayıtları
- ✅ Tam veritabanı şeması: **mesajlaşma, push ve AI tabloları dahil** (Faz 2–3'te arayüzü eklenecek)

Sonraki fazlar: mesajlaşma arayüzü, web push, performans panoları, Lole Asistan (AI ajanları).

## Kurulum (≈15 dakika)

### 1. Supabase projesi
1. [supabase.com](https://supabase.com) → **New project** (bölge: Frankfurt önerilir).
2. **SQL Editor**'de sırayla çalıştırın:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_rls.sql`
3. **Project Settings → API**'den `URL`, `anon key` ve `service_role key` değerlerini alın.

### 2. Ortam değişkenleri
```bash
cp .env.example .env.local
# .env.local dosyasını kendi değerlerinizle doldurun
```

### 3. Bağımlılıklar + seed
```bash
npm install
npm run seed     # 4 Lole şirketi + kullanıcılar + örnek görevler
```

Seed çıktısında giriş bilgileri yazdırılır (varsayılan parola: `Lole!2026`):

| Rol | E-posta |
|---|---|
| Süper Admin | `super@lole.app` |
| Admin (Fabrika) | `admin@fabrika.lole.app` |
| Müdür (Restaurant) | `mudur@restaurant.lole.app` |
| Personel (Patisserie) | `personel1@patisserie.lole.app` |

Diğer şirketler için aynı düzen: `admin@restaurant...`, `personel2@pazarlama...` vb.

### 4. Çalıştırma
```bash
npm run dev      # http://localhost:3000
```

### 5. Yayınlama (Vercel)
Repo'yu Vercel'e bağlayın, üç env değişkenini ekleyin, deploy edin.
`SUPABASE_SERVICE_ROLE_KEY` yalnızca sunucuda kullanılır — asla `NEXT_PUBLIC_` yapmayın.

## Mimari özeti

- **Next.js 14 App Router** + Server Actions (Zod doğrulamalı) + Tailwind
- **Supabase**: Postgres + Auth + Storage (özel bucket, imzalı URL)
- **RLS her tabloda**: personel yalnızca kendine atanan görevi görür/tamamlar; müdür yalnızca yönettiği departmanı; admin şirketini; süper admin her şeyi. Şirketler arası erişim veritabanı seviyesinde imkânsızdır.
- Yeni şirket eklendiğinde **Operasyon, Satış, Üretim, Yönetim** departmanları DB trigger'ı ile otomatik oluşur.
- Tekrarlayan görevler `rrule` ile oluşturma anında örneklenir (varsayılan 8, en fazla 30 örnek).

## Klasör yapısı
```
supabase/migrations/   Şema + RLS (versiyonlu SQL)
scripts/seed.mjs       Demo veri (4 şirket, roller, görevler)
src/app/(app)/         Uygulama sayfaları (home, tasks, manage, admin, super…)
src/app/login/         Giriş
src/components/        İstemci bileşenleri
src/lib/               Supabase istemcileri, auth yardımcıları, tipler
```

## Bilinen sınırlar (Faz 1)
- PWA manifest hazır; service worker / çevrimdışı destek Faz 2'de.
- Bildirimler veritabanına yazılıyor; push gönderimi ve bildirim merkezi arayüzü Faz 2'de.
- Mesajlaşma ve AI tabloları hazır; arayüzleri Faz 2–3'te.
