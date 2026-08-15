-- ============================================================================
-- LOLE Finans & Muhasebe — Supabase (PostgreSQL) Şema Taslağı
-- Mevcut, tek-dosya Claude artifact'ındaki S{} JSON yapısından türetilmiştir.
-- Bu dosya Claude Code'a verilecek; oradaki Claude gerçek Supabase projenize
-- bağlanıp bunu çalıştıracak, test edecek ve gerekirse (özellikle RLS
-- politikalarını) sizin gerçek kullanım şeklinize göre inceleyip düzeltecek.
-- ============================================================================

-- v2: Önce temiz bir başlangıç için mevcut tabloları (varsa) siler.
-- GÜVENLİDİR — henüz gerçek veri aktarımı yapılmadığı için silinecek bir şey yok.
-- Bu sayede script kaç kez çalıştırılırsa çalıştırılsın hep aynı, öngörülebilir sonucu verir.
drop table if exists audit_log, categories, budgets, assets, stock_txns, stock_items,
  cheques, notes, tasks, fixed_logs, fixed_payments, leaves, staff_txns, staff,
  pos_entries, pos, card_txns, cards, cari_txns, cari, txns, accounts,
  user_profiles, companies cascade;

-- ---------- ŞİRKETLER ----------
create table companies (
  id text primary key,              -- eski koddaki 'rest','pati','fact','loleq' gibi kısa kodlar
  name text not null,
  created_at timestamptz default now()
);

-- ---------- KULLANICILAR ----------
-- Not: Supabase'in kendi auth.users sistemini kullanmak neredeyse kesin daha doğru olacak
-- (şifre sıfırlama, e-posta doğrulama, oturum yönetimi hazır gelir). Bu tablo, ekstra
-- profil bilgilerini (rol, hangi şirketlere erişimi olduğu) tutar, auth.users'a bağlanır.
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  role text not null check (role in ('super','user')),
  companies text[] not null default '{}',   -- ['rest','pati'] gibi, ya da hepsi için '{all}'
  added_by text,
  created_at timestamptz default now()
);

-- ---------- HESAPLAR (Banka & Kasa) ----------
create table accounts (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id),
  type text not null check (type in ('banka','kasa')),
  name text not null,
  bank_name text,
  iban text,
  acc_no text,
  opening numeric not null default 0,
  note text,
  active boolean not null default true,
  created_at timestamptz default now()
);

-- ---------- İŞLEMLER (Gelir / Gider / Virman) ----------
create table txns (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id),
  type text not null check (type in ('gelir','gider','virman')),
  date date not null,
  amount numeric not null,
  cat text,
  acc_id uuid references accounts(id),
  acc_id2 uuid references accounts(id),      -- yalnızca virman için (hedef hesap)
  cari_id uuid,                              -- opsiyonel, cari tablosuna referans
  vat numeric,                               -- KDV oranı (%), null = KDV yok
  doc text,                                  -- belge no
  fatura boolean default false,
  fatura_no text,
  nakit text,                                -- cari harekete bağlı ise 'gelir'/'gider'
  "desc" text,
  created_by text, created_at timestamptz default now(),
  updated_by text, updated_at timestamptz,
  deleted_at timestamptz, deleted_by text
);

-- ---------- CARİ (Müşteri / Tedarikçi) ----------
create table cari (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id),
  name text not null,
  type text not null check (type in ('musteri','tedarikci','her2','diger')),
  tax_no text, phone text, email text,
  vade_gun integer default 30,
  opening numeric not null default 0,
  risk_limit numeric,
  note text,
  active boolean not null default true,
  created_at timestamptz default now()
);

create table cari_txns (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id),
  cari_id uuid not null references cari(id) on delete cascade,
  type text not null check (type in ('borc','alacak')),
  amount numeric not null,
  date date not null,
  vade date,
  fatura boolean default false,
  fatura_no text,
  vat numeric,
  acc_id uuid references accounts(id),       -- nakit hareketi varsa hangi hesaba/hesaptan
  nakit text,                                -- 'gelir' / 'gider' / null
  "desc" text,
  created_by text, created_at timestamptz default now(),
  deleted_at timestamptz, deleted_by text
);

-- ---------- KREDİ KARTLARI ----------
create table cards (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id),
  name text not null,
  bank text,
  "limit" numeric,
  cut_day integer, due_day integer,
  active boolean not null default true
);

create table card_txns (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id),
  card_id uuid not null references cards(id) on delete cascade,
  type text not null check (type in ('harcama','odeme')),
  amount numeric not null,
  date date not null,
  cat text, "desc" text,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

-- ---------- POS ----------
create table pos (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id),
  name text not null,
  acc_id uuid references accounts(id),
  comm numeric not null default 0,
  blokaj integer not null default 1,
  active boolean not null default true
);

create table pos_entries (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id),
  pos_id uuid not null references pos(id) on delete cascade,
  date date not null,
  gross numeric not null,
  comm numeric not null,
  net numeric not null,
  status text not null default 'bekliyor' check (status in ('bekliyor','gecti')),
  settle_date date,
  deleted_at timestamptz
);

-- ---------- PERSONEL ----------
create table staff (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id),
  active boolean not null default true,
  name text not null,
  pos_title text, phone text,
  start_date date,
  salary numeric,
  iban text, note text
);

create table staff_txns (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id),
  staff_id uuid not null references staff(id) on delete cascade,
  type text not null check (type in ('maas','avans','prim','kesinti')),
  amount numeric not null,
  date date not null,
  period text,                               -- 'YYYY-MM'
  "desc" text,
  deleted_at timestamptz
);

create table leaves (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id),
  staff_id uuid not null references staff(id) on delete cascade,
  type text not null check (type in ('yillik','ucretsiz','rapor','mazeret')),
  start_date date not null, end_date date not null,
  note text,
  deleted_at timestamptz
);

-- ---------- SABİT ÖDEMELER ----------
create table fixed_payments (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id),
  type text not null check (type in ('kira','vergi','sgk','fatura')),
  name text not null,
  pay_day integer not null,
  amount numeric,                            -- opsiyonel (v9.9'da zorunluluk kaldırıldı)
  note text
);

create table fixed_logs (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id),
  fixed_id uuid references fixed_payments(id) on delete cascade,
  date date not null,
  amount numeric not null,
  txn_id uuid references txns(id),
  deleted_at timestamptz
);

-- ---------- GÖREVLER & DUYURULAR ----------
create table tasks (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id),
  title text not null,
  who text,
  due date, pri text default 'normal',
  "desc" text,
  status text not null default 'acik' check (status in ('acik','tamam'))
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id),
  date date not null,
  title text not null,
  level text default 'normal',
  body text not null
);

-- ---------- ÇEK / SENET ----------
create table cheques (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id),
  tip text not null check (tip in ('alinan','verilen')),
  tur text not null check (tur in ('cek','senet')),
  kisi text not null,
  banka text, no text,
  tutar numeric not null,
  vade date not null,
  durum text not null default 'portfoy' check (durum in ('portfoy','kapandi','karsiliksiz')),
  note text
);

-- ---------- STOK ----------
create table stock_items (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id),
  name text not null,
  unit text not null default 'kg',
  cost numeric default 0,
  qty numeric default 0,                     -- açılış miktarı
  min_qty numeric default 0
);

create table stock_txns (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id),
  item_id uuid not null references stock_items(id) on delete cascade,
  type text not null check (type in ('giris','cikis')),
  qty numeric not null,
  date date not null,
  deleted_at timestamptz
);

-- ---------- DEMİRBAŞ ----------
create table assets (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id),
  name text not null,
  cat text, loc text,
  date date, cost numeric,
  durum text default 'aktif' check (durum in ('aktif','bakim','hurda')),
  note text
);

-- ---------- BÜTÇE ----------
create table budgets (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id),
  cat text not null,
  amount numeric not null
);

-- ---------- DENETİM KAYDI ----------
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id text references companies(id),
  ts timestamptz default now(),
  username text,
  action text,
  detail text
);

-- ---------- KATEGORİLER ----------
create table categories (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id),
  kind text not null check (kind in ('gelir','gider')),
  name text not null
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) — TASLAK
-- Her tabloda RLS açılmalı; kullanıcı yalnızca kendi erişimi olan şirketlerin
-- verisini görebilmeli. Aşağıdaki, TÜM tablolara uygulanacak ORTAK deseni
-- gösteriyor — Claude Code gerçek projede bunu her tabloya uygulayıp test etmeli.
-- ============================================================================

alter table accounts enable row level security;
-- (diğer tüm tablolarda da enable row level security çalıştırılmalı)

create policy "Kullanıcı yalnızca yetkili olduğu şirketleri görür"
on accounts for select
using (
  exists (
    select 1 from user_profiles p
    where p.id = auth.uid()
    and (p.role = 'super' or company_id = any(p.companies) or 'all' = any(p.companies))
  )
);
-- Bu politika deseni her tabloya (companies hariç) uyarlanmalı.
-- INSERT/UPDATE/DELETE için de benzer "for insert/update/delete" politikaları gerekir.

-- ============================================================================
-- NOT: Bu şema bir BAŞLANGIÇ TASLAĞIDIR. Claude Code gerçek Supabase projenizde
-- çalıştırırken: (1) foreign key/cascade davranışlarını gerçek kullanım
-- senaryolarıyla test etmeli, (2) RLS politikalarını her tablo için tamamlamalı,
-- (3) gerekli index'leri (özellikle company_id ve date sütunlarında) eklemeli.
-- ============================================================================
