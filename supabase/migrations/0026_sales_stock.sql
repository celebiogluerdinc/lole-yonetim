-- ============================================================
-- 0026 — SAHA SATIŞ / TEKRAR SİPARİŞ VE ŞİKÂYET
-- F10 Takip ve tekrar sipariş · F11 Hasar, şikâyet ve çözüm kaydı
-- (F09 stok takibi bu modülde yok — muhasebede yürütülüyor)
--
-- Supabase SQL Editor'e TEK PARÇA yapıştırılır. Tekrar çalıştırılabilir.
-- Önce 0022–0025 çalıştırılmış olmalı. Tüm miktarlar ŞİŞE.
-- ============================================================

-- ------------------------------------------------------------
-- NOT: F09 (Stok ve tüketiciye satış takibi) BU MODÜLDE YOK.
--      Stok takibi muhasebe tarafında yürütülüyor; buraya
--      bağlanmadı ki aynı stok iki yerde tutulup çelişmesin.
--      F10'un ihtiyaç duyduğu "mevcut stok" ve "günlük satış"
--      değerleri saha gözlemi olarak ziyarette girilir — kâğıt
--      formdaki gibi.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 2) TAKİP VE TEKRAR SİPARİŞ PLANI (F10)
--    Kontrol takvimi formda tanımlı: 48–72 saat, 7. gün, 14. gün,
--    sonrası rutin. Bu üç nokta ilk siparişten sonraki kritik
--    pencere — tekrar sipariş gelmezse nokta burada kaybedilir.
-- ------------------------------------------------------------
create table if not exists reorder_plans (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  outlet_id uuid not null references outlets(id) on delete cascade,
  visit_id uuid references visits(id) on delete set null,
  created_by uuid not null references profiles(id) on delete cascade,
  checkpoint text not null default 'rutin'
    check (checkpoint in ('48_72_saat','7_gun','14_gun','rutin')),
  first_order_date date,
  data_period text,                        -- veri dönemi / kaynağı
  next_check_days smallint not null default 7 check (next_check_days > 0),
  collection_status text,                  -- tahsilat durumu
  collection_doc_no text,
  slow_product_reason text,                -- yavaş ürün nedeni
  single_improvement text,                 -- "uygulanacak TEK iyileştirme"
  confirmed_order_id uuid references sales_orders(id) on delete set null,
  confirmed_qty integer check (confirmed_qty is null or confirmed_qty >= 0),
  delivery_date date,
  stock_confirmed boolean,
  created_at timestamptz not null default now()
);
create index if not exists reorder_outlet_idx on reorder_plans(outlet_id, created_at desc);
create index if not exists reorder_company_idx on reorder_plans(company_id, checkpoint, created_at desc);

create table if not exists reorder_plan_items (
  id uuid primary key default uuid_generate_v4(),
  plan_id uuid not null references reorder_plans(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  current_stock integer not null default 0 check (current_stock >= 0),
  daily_sales numeric(10,2) not null default 0 check (daily_sales >= 0),
  lead_days smallint not null default 2 check (lead_days >= 0),
  safety_stock integer not null default 0 check (safety_stock >= 0),
  next_check_days smallint not null default 7 check (next_check_days > 0),
  -- F10 formülü birebir:
  -- Öneri = günlük satış × (tedarik + bir sonraki kontrol aralığı)
  --         + güvenlik stoku − mevcut stok ; negatifse 0
  suggested_bottles integer generated always as (
    greatest(
      ceil(daily_sales * (lead_days + next_check_days))::int + safety_stock - current_stock,
      0)
  ) stored,
  -- koli yuvarlaması (1 koli = 12 şişe) — formdaki "koli yuvarlamasını teyit et"
  suggested_cases integer generated always as (
    ceil(
      greatest(
        ceil(daily_sales * (lead_days + next_check_days))::int + safety_stock - current_stock,
        0) / 12.0
    )::int
  ) stored,
  position int not null default 0,
  unique (plan_id, product_id)
);
create index if not exists ritem_plan_idx on reorder_plan_items(plan_id, position);

-- ------------------------------------------------------------
-- 3) HASAR, ŞİKÂYET VE ÇÖZÜM (F11)
--    "Ürün güvenliği şüphesinde satıştan ayır; yeniden tadım
--     yaptırma." Bu bir gıda güvenliği kuralıdır — veritabanı
--     uyguluyor (bkz. trigger).
--    Mevcut `incidents` modülü iç olay bildirimi içindir (admin
--    görünürlüğü, onay akışı). Müşteri şikâyeti parti/TETT
--    izlenebilirliği ve karantina gerektirdiği için ayrı tablo.
-- ------------------------------------------------------------
create table if not exists outlet_complaints (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  outlet_id uuid not null references outlets(id) on delete cascade,
  visit_id uuid references visits(id) on delete set null,
  order_id uuid references sales_orders(id) on delete set null,
  reported_by uuid not null references profiles(id) on delete cascade,
  reported_at timestamptz not null default now(),
  category text not null
    check (category in ('teslimat_hasari','tat_beklentisi','hizmet','urun_guvenligi','diger')),
  product_id uuid references products(id) on delete set null,
  batch_id uuid references product_batches(id) on delete set null,
  expiry_date date,                        -- TETT (parti seçilemiyorsa elle)
  quantity integer check (quantity is null or quantity >= 0),
  shipment_doc_no text,                    -- sipariş / sevk belgesi
  event_description text not null,         -- bildirilen olay
  event_at timestamptz,
  -- karantina: F11 "Ürün satıştan ayrıldı mı? / adet"
  quarantined boolean not null default false,
  quarantined_qty integer check (quarantined_qty is null or quarantined_qty >= 0),
  notified_person text,                    -- bildirim yapılan yetkili
  notified_at timestamptz,
  investigation_result text,               -- talep / inceleme sonucu / onaylanan işlem
  resolution_doc_no text,                  -- değişim / sevk / iade belge no
  resolved_at timestamptz,
  outlet_confirmed boolean not null default false,
  status text not null default 'acik'
    check (status in ('acik','incelemede','cozuldu','reddedildi')),
  created_at timestamptz not null default now()
);
create index if not exists complaint_outlet_idx on outlet_complaints(outlet_id, reported_at desc);
create index if not exists complaint_company_idx on outlet_complaints(company_id, status, reported_at desc);
-- Parti bazlı geri çağırma taraması — kalite olayında en kritik sorgu
create index if not exists complaint_batch_idx on outlet_complaints(batch_id)
  where batch_id is not null;
create index if not exists complaint_safety_idx on outlet_complaints(company_id, reported_at desc)
  where category = 'urun_guvenligi';

create table if not exists complaint_photos (
  id uuid primary key default uuid_generate_v4(),
  complaint_id uuid not null references outlet_complaints(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  uploaded_by uuid not null references profiles(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  created_at timestamptz not null default now()
);
create index if not exists cphoto_complaint_idx on complaint_photos(complaint_id, created_at);

-- ------------------------------------------------------------
-- 4) KURALLAR
-- ------------------------------------------------------------

-- F11: ürün güvenliği şüphesi karantina olmadan kapatılamaz
create or replace function fn_complaint_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.category = 'urun_guvenligi' then
    if new.status = 'cozuldu' and not new.quarantined then
      raise exception 'Ürün güvenliği şikâyeti kapatılamaz: ürün satıştan ayrılmadan çözüldü işaretlenemez (F11).';
    end if;
    if new.quarantined and coalesce(new.quarantined_qty, 0) = 0 then
      raise exception 'Karantinaya alınan adet girilmelidir (F11).';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_complaint_guard on outlet_complaints;
create trigger trg_complaint_guard before insert or update on outlet_complaints
for each row execute function fn_complaint_guard();

-- F11: ürün güvenliği şüphesi olan parti TADIMA KAPANIR
-- "yeniden tadım yaptırma" kuralı. Saha ekibi farkında olmadan
-- şüpheli partiyi tattırmaya devam edemesin.
create or replace function fn_block_unsafe_batch() returns trigger
language plpgsql security definer set search_path = public as $$
declare bad int;
begin
  if new.batch_id is null then return new; end if;
  select count(*) into bad from outlet_complaints c
  where c.batch_id = new.batch_id
    and c.category = 'urun_guvenligi'
    and c.status in ('acik','incelemede');
  if bad > 0 then
    raise exception 'Bu parti ürün güvenliği incelemesinde — tadım yapılamaz (F11).';
  end if;
  return new;
end $$;

drop trigger if exists trg_tasting_batch_guard on visit_tastings;
create trigger trg_tasting_batch_guard before insert or update of batch_id on visit_tastings
for each row execute function fn_block_unsafe_batch();

-- Departman otomatik doldurma
drop trigger if exists trg_reorder_dept on reorder_plans;
create trigger trg_reorder_dept before insert on reorder_plans
for each row execute function fn_fill_department();
drop trigger if exists trg_complaint_dept on outlet_complaints;
create trigger trg_complaint_dept before insert on outlet_complaints
for each row execute function fn_fill_department();

-- ------------------------------------------------------------
-- 5) RLS
-- ------------------------------------------------------------
alter table reorder_plans      enable row level security;
alter table reorder_plan_items enable row level security;
alter table outlet_complaints  enable row level security;
alter table complaint_photos   enable row level security;

drop policy if exists reorder_all on reorder_plans;
create policy reorder_all on reorder_plans for all
  using (same_company(company_id) and sales_can_see(created_by, department_id))
  with check (same_company(company_id));

drop policy if exists ritem_all on reorder_plan_items;
create policy ritem_all on reorder_plan_items for all
  using (exists (select 1 from reorder_plans p where p.id = plan_id
                 and same_company(p.company_id) and sales_can_see(p.created_by, p.department_id)))
  with check (exists (select 1 from reorder_plans p where p.id = plan_id
                 and same_company(p.company_id) and sales_can_see(p.created_by, p.department_id)));

-- Şikâyet: ürün güvenliği olayları şirketteki TÜM yöneticilere açık,
-- çünkü geri çağırma kararı tek departmanın işi değildir.
drop policy if exists complaint_select on outlet_complaints;
create policy complaint_select on outlet_complaints for select
  using (same_company(company_id) and (
    sales_can_see(reported_by, department_id)
    or (category = 'urun_guvenligi' and auth_role() in ('admin','manager'))));
drop policy if exists complaint_insert on outlet_complaints;
create policy complaint_insert on outlet_complaints for insert
  with check (reported_by = auth.uid() and same_company(company_id));
drop policy if exists complaint_update on outlet_complaints;
create policy complaint_update on outlet_complaints for update
  using (same_company(company_id) and (
    is_super_admin() or auth_role() = 'admin' or manages_department(department_id)
    or (reported_by = auth.uid() and status = 'acik')));
drop policy if exists complaint_delete on outlet_complaints;
create policy complaint_delete on outlet_complaints for delete
  using (same_company(company_id) and (is_super_admin() or auth_role() = 'admin'));

drop policy if exists cphoto_all on complaint_photos;
create policy cphoto_all on complaint_photos for all
  using (exists (select 1 from outlet_complaints c where c.id = complaint_id
                 and same_company(c.company_id)))
  with check (uploaded_by = auth.uid() and same_company(company_id));

-- Sipariş hattı müşterilerini kilitle
do $$
declare t text; pol text;
begin
  foreach t in array array['reorder_plans','reorder_plan_items',
                           'outlet_complaints','complaint_photos'] loop
    pol := 'lole_cust_block_' || t;
    execute format('drop policy if exists %I on public.%I', pol, t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated '
      || 'using ((select not auth_is_customer())) with check ((select not auth_is_customer()))',
      pol, t);
  end loop;
end $$;
