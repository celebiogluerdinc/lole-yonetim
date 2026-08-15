# LOLE Finans & Muhasebe — Next.js + Supabase

Bu proje, tek dosyalık Claude uygulamanızın (`LOLE-Finans-Muhasebe.html`) gerçek bir
web uygulamasına (Next.js) taşınmış hâlidir. Veriler artık **kendi Supabase
projenizde** saklanır ve Vercel üzerinden sabit bir adreste yayınlanır.

## Ne yapıldı? (Faz A tamamlandı)

Uygulamanın kanıtlanmış 16 modülünün **tamamı** birebir korunmuştur:
Ana Sayfa, AI Asistan, Banka & Kasa, Gelir-Gider, POS, Kredi Kartları, Cari,
Personel & Maaş, Sabit Ödemeler, Çek & Senet, Stok, Demirbaş, Bütçe, Raporlar,
Görev & Duyuru, Ayarlar.

Sadece **3 altyapı dikişi** yeni sisteme bağlandı:

1. **Depolama** — Uygulama tüm veriyi `window.storage` adında basit bir
   anahtar-değer arabirimi üzerinden saklıyordu. Bu arabirim artık Supabase'teki
   `kv_store` tablosuna bağlandı (`src/lib/storageShim.ts`). İş mantığının 3500
   satırına hiç dokunulmadı — bu yüzden davranış birebir aynı, ama veri sizin
   Supabase'inizde.
2. **Giriş** — Özel kullanıcı adı/şifre yerine **Supabase Auth** (e-posta/şifre).
   Giriş yapan kişi otomatik olarak uygulama içi profiline bağlanır.
3. **Çıkış** — Supabase oturumunu kapatır ve giriş ekranına döner.

> Mimari not: Uygulama, verinin tamamını tek bir JSON belgesi olarak `kv_store`
> içinde tutar (orijinal sürümle birebir aynı yaklaşım). Şirket bazlı erişim,
> uygulama içindeki rol/şirket yetkileriyle yönetilir. İleride her tabloyu ayrı
> ayrı normalize edip satır-düzeyi (RLS) güvenliğe geçmek isterseniz, Faz 2
> olarak `supabase/schema.sql` içindeki ilişkisel şema hazır bekliyor.

---

## Kurulum — Adım Adım

### 0) Gereksinim
Node.js 18+ (bilgisayarınızda kuruluysa hazırsınız).

### 1) Supabase tablosunu oluşturun (bir kez)
Supabase panosunda **SQL Editor**'ü açın, `supabase/setup.sql` dosyasının
içeriğini yapıştırıp **Run**'a basın. Bu, `kv_store` tablosunu ve güvenlik
(RLS) politikasını ekler. (Faz B'de oluşturduğunuz tabloları silmez.)

### 2) İlk kullanıcıyı (kendinizi) oluşturun
Supabase panosu → **Authentication → Users → Add user** →
- E-posta: `celebiogluerdinc@gmail.com`
- Bir şifre belirleyin
Bu e-posta ile giren kişi otomatik olarak **süper yönetici** olur (tüm şirketler).
Diğer kullanıcıları hem buraya (Authentication → Users) hem de uygulama içindeki
**Ayarlar → Kullanıcılar**'a ekleyip şirket erişimlerini oradan verirsiniz.

### 3) Ortam değişkenleri
`.env.local.example` dosyasını `.env.local` olarak kopyalayın. İçindeki iki değer
zaten sizin projenize göre doldurulmuş:
```
NEXT_PUBLIC_SUPABASE_URL=https://ajskxcboewophuyxtswy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

### 4) Yerelde çalıştırın
```bash
npm install
npm run dev
```
Tarayıcıda `http://localhost:3000` → giriş ekranı → 2. adımdaki e-posta/şifre ile
girin. Şirket seçim ekranını ve tüm modülleri göreceksiniz.

---

## Yayınlama (Faz C + D)

### GitHub'a koyma (Faz C)
1. github.com → **New repository** → boş bir depo oluşturun (README eklemeyin).
2. Bu klasörde:
   ```bash
   git init
   git add .
   git commit -m "LOLE Finans — Next.js + Supabase"
   git branch -M main
   git remote add origin <DEPO-ADRESİNİZ>
   git push -u origin main
   ```
   > `.env.local` gizli olduğu için (`.gitignore`) GitHub'a **gitmez** — doğrusu budur.

### Vercel'e bağlama (Faz D)
1. vercel.com → **Add New → Project** → GitHub deponuzu **Import** edin.
2. **Environment Variables** bölümüne şu ikisini girin (Vercel'de bunları elle
   eklemeniz gerekir, çünkü `.env.local` gönderilmedi):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://ajskxcboewophuyxtswy.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_...` (Supabase → Settings → API)
3. **Deploy** → 1-2 dakika. Vercel size sabit bir adres verir (ör.
   `lole-finans.vercel.app`) — bu adres bir daha değişmez.

---

## Veri taşıma (Faz E — sonra)
Mevcut Claude sürümündeki verinizi (Ayarlar → "Panoya Kopyala") aldıktan sonra,
yeni uygulamada **Ayarlar → Yedekten Yükle** ile içeri aktarabilirsiniz — veri
biçimi birebir aynıdır. Her şey doğrulanınca yeni sistem asıl kayıt sisteminiz olur.

## Bilinen sınır
- **AI Asistan**: Tarayıcıdan doğrudan Anthropic API'sine çağrı yaptığı için
  yayında çalışmaz (bir sonraki adımda küçük bir sunucu-tarafı yönlendirme ile
  eklenebilir). Diğer tüm finans/muhasebe işlevleri tam çalışır.

## Proje yapısı
```
src/app/login/page.tsx     Supabase Auth giriş ekranı
src/app/page.tsx           Oturum kontrolü + motoru yükleyen sayfa
src/app/globals.css        Tasarım sistemi (orijinalden birebir)
src/lib/supabaseClient.ts  Supabase tarayıcı istemcisi
src/lib/storageShim.ts     window.storage -> Supabase kv_store köprüsü
src/lib/loleShell.ts       Uygulama kabuğu (DOM)
public/engine.js           İş mantığı motoru (16 modül) — orijinalden taşındı
supabase/setup.sql         kv_store tablosu + RLS (ÇALIŞTIRIN)
supabase/schema.sql        İlişkisel şema (Faz 2 için referans)
```
