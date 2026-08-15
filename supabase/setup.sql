-- ============================================================================
-- LOLE Finans — Uygulama Deposu (kv_store) + Güvenlik (RLS)
-- Bu dosyayı Supabase > SQL Editor'de ÇALIŞTIRIN (Faz B'de oluşturduğunuz
-- projenin üzerine; mevcut tablolarınızı SİLMEZ, yalnızca ekler).
--
-- Uygulama, tüm finansal veriyi tek bir JSON anahtar-değer deposu üzerinden
-- saklar (orijinal Claude sürümüyle birebir aynı mantık). Bu tablo o depoyu
-- sizin kendi Supabase projenizde barındırır.
--   scope = 'shared'  -> tüm ekip aynı veriyi paylaşır (asıl finans verisi)
--   scope = <uuid>     -> yalnızca o kullanıcıya özel (kişisel ayar/jeton)
-- ============================================================================

create table if not exists kv_store (
  scope       text        not null,
  key         text        not null,
  value       text,
  updated_at  timestamptz not null default now(),
  primary key (scope, key)
);

-- Row Level Security açık: yalnızca giriş yapmış (authenticated) kullanıcılar erişir.
alter table kv_store enable row level security;

-- Var olan politikayı (tekrar çalıştırmaya karşı) temizle
drop policy if exists kv_store_rw on kv_store;

-- Giriş yapmış kullanıcı: ekip verisini (scope='shared') ve kendi kişisel
-- kayıtlarını (scope = kendi uuid'si) okuyup yazabilir.
create policy kv_store_rw on kv_store
  for all
  to authenticated
  using      (scope = 'shared' or scope = auth.uid()::text)
  with check (scope = 'shared' or scope = auth.uid()::text);

-- ============================================================================
-- KULLANICI OLUŞTURMA (giriş yapabilmek için gerekli)
-- Supabase Auth kullandığımız için kullanıcıları Dashboard'dan eklersiniz:
--   Authentication -> Users -> "Add user" -> e-posta + şifre
-- İlk yönetici olarak kendi e-postanızı ekleyin:
--   celebiogluerdinc@gmail.com
-- Uygulama, bu e-posta ile giriş yapan kişiyi otomatik olarak SÜPER YÖNETİCİ
-- yapar (tüm şirketlere erişim). Diğer kullanıcıların şirket erişimini,
-- giriş yaptıktan sonra uygulama içindeki Ayarlar > Kullanıcılar'dan
-- yönetebilirsiniz.
-- ============================================================================
