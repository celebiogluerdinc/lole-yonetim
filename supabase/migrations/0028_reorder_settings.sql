-- ============================================================
-- 0028 — NOKTA BAZLI TEDARİK AYARLARI (F10 girdileri)
--
-- Supabase SQL Editor'e TEK PARÇA yapıştırılır. Tekrar çalıştırılabilir.
-- Önce 0022–0027 çalıştırılmış olmalı.
--
-- F10 tekrar sipariş önerisi şu formüle dayanıyor:
--   Öneri = günlük satış × (tedarik + bir sonraki kontrol aralığı)
--           + güvenlik stoku − mevcut stok
--
-- Bunun iki girdisi noktaya göre değişir ve elle belirlenecek:
--   • tedarik süresi (gün)  — o noktaya sevkiyat kaç günde ulaşıyor
--   • güvenlik stoku        — kaç GÜNLÜK ek stok tutulsun
--
-- GÜVENLİK STOKU NEDEN "GÜN", ŞİŞE DEĞİL:
-- Şişe olarak tutulsaydı her nokta için dört ayrı sayı (ürün başına)
-- girilmesi gerekirdi; yüzlerce noktada bu liste bir hafta içinde
-- bakımsız kalır. Gün olarak tutulunca nokta başına TEK sayı yetiyor
-- ve şişe karşılığı o ürünün kendi günlük satışından hesaplanıyor —
-- çok satan ürün otomatik olarak daha yüksek güvenlik stoku alıyor.
-- Temsilci yine de satır bazında elle değiştirebilir (form öyle istiyor).
-- ============================================================

alter table outlets add column if not exists lead_days smallint not null default 2
  check (lead_days >= 0 and lead_days <= 60);
alter table outlets add column if not exists safety_stock_days smallint not null default 3
  check (safety_stock_days >= 0 and safety_stock_days <= 60);

comment on column outlets.lead_days is
  'Bu noktaya sevkiyatın ulaşma süresi (gün). F10 öneri formülünün girdisi.';
comment on column outlets.safety_stock_days is
  'Bu noktada kaç günlük güvenlik stoku tutulacağı. Şişe karşılığı ürünün günlük satışından hesaplanır.';

-- ------------------------------------------------------------
-- Öneri hesabı — F10 formülünün birebir karşılığı.
-- Uygulama formu doldurulurken bunu çağırıp alanları ön-doldurur;
-- temsilci gerekirse üzerine yazar. Hesabın tek bir doğrusu olsun diye
-- formül burada da duruyor, iki yerde ayrı ayrı yazılmıyor.
-- ------------------------------------------------------------
create or replace function fn_reorder_suggestion(
  oid uuid,
  daily_sales numeric,
  current_stock int,
  next_check_days int default null
) returns table (lead_days int, safety_stock int, suggested_bottles int, suggested_cases int)
language sql stable security definer set search_path = public as $$
  with o as (
    select coalesce(outlets.lead_days, 2) as ld,
           coalesce(outlets.safety_stock_days, 3) as sd
    from outlets where id = oid
  ),
  calc as (
    select o.ld,
           ceil(coalesce(daily_sales, 0) * o.sd)::int as ss,
           coalesce(next_check_days, 7) as nc
    from o
  )
  select calc.ld,
         calc.ss,
         greatest(
           ceil(coalesce(daily_sales, 0) * (calc.ld + calc.nc))::int
           + calc.ss - coalesce(current_stock, 0),
           0) as suggested_bottles,
         ceil(
           greatest(
             ceil(coalesce(daily_sales, 0) * (calc.ld + calc.nc))::int
             + calc.ss - coalesce(current_stock, 0),
             0) / 12.0
         )::int as suggested_cases
  from calc;
$$;

-- ------------------------------------------------------------
-- Tedarik ayarlarının toplu görünümü — Ayarlar ekranı ve
-- "hangi noktada ayar yapılmamış" taraması için.
-- ------------------------------------------------------------
create or replace view v_outlet_supply_settings as
select o.id as outlet_id, o.company_id, o.name, o.city, o.district,
       o.status, o.segment, o.lead_days, o.safety_stock_days,
       (o.lead_days = 2 and o.safety_stock_days = 3) as is_default
from outlets o
where o.is_active;

comment on view v_outlet_supply_settings is
  'Nokta bazlı tedarik süresi ve güvenlik stoku (gün). is_default=true olanlar henüz elle ayarlanmamış demektir.';
