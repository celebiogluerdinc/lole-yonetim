-- ============================================================
-- 0025 — SAHA SATIŞ / TİCARİ KATMAN
-- F05 Ticari teklif · F06 Sipariş ve teslimat · F07 Açılış kontrolü
-- F08 Personel eğitimi
--
-- Supabase SQL Editor'e TEK PARÇA yapıştırılır. Tekrar çalıştırılabilir.
-- Önce 0022, 0023, 0024 çalıştırılmış olmalı.
--
-- TABAN BİRİM: ŞİŞE. F06: "Bir koli 12 şişedir."
-- F06'nın kritik kuralı: "Koli ve şişe sütunları aynı miktarın
-- gösterimidir; birbirine eklenmez." Bu yüzden şemada GERÇEK olan
-- şişe adedidir; koli hesaplanan sütundur. İki ayrı alan tutulsaydı
-- er geç biri ikisini toplar ve miktar 13 katına çıkardı.
-- ============================================================

-- ------------------------------------------------------------
-- 1) BELGE SAYAÇLARI
--    Mevcut company_counters tablosu (0018) genişletiliyor.
--    Satır kilidi sayesinde iki kullanıcı aynı anda belge açsa bile
--    aynı numara ikinci kez üretilemez.
-- ------------------------------------------------------------
alter table company_counters add column if not exists quote_seq       bigint not null default 0;
alter table company_counters add column if not exists sales_order_seq bigint not null default 0;

-- ------------------------------------------------------------
-- 1b) ONAY ADIMLARI — KİŞİYE DEĞİL GÖREVE BAĞLI
--     Formlarda onaylayanlar kişi adıyla yazılı (Yaşar, Dilan, Azat).
--     Sistemde adım bir GÖREVDİR: kişi ayrılsa, işe yeni biri girse ya da
--     görev el değiştirse form ve akış değişmiyor. Kimin onayladığı yine
--     kayıt altında (denetim için) ama kural kişiye bağlı değil.
--
--     VARSAYILAN AYAR: open_to_all = true → TÜM DEPARTMANLAR ONAYLAYABİLİR.
--     Bu bilinçli bir tercihtir, eksik yapılandırma değil. İleride bir adımı
--     tek departmana kilitlemek istenirse Ayarlar'dan open_to_all kapatılıp
--     department_id seçilir; kod değişikliği gerekmez.
-- ------------------------------------------------------------
create table if not exists approval_steps (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  step_code text not null
    check (step_code in ('mali_kontrol','satis_kontrolu','stok_sevk_teyidi','siparis_kabulu')),
  label text not null,                                  -- formda görünen başlık
  open_to_all boolean not null default true,            -- tüm departmanlar onaylayabilir
  department_id uuid references departments(id) on delete set null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  unique (company_id, step_code)
);
-- mevcut kurulumlar için (0025 daha önce çalıştırıldıysa)
alter table approval_steps add column if not exists open_to_all boolean not null default true;
update approval_steps set open_to_all = true where open_to_all is distinct from true;

create index if not exists astep_company_idx on approval_steps(company_id, sort_order);

-- Onay yetkisi:
--   open_to_all açıksa  → şirketteki herkes (mevcut ayar)
--   kapalıysa           → yalnızca seçilen departmanın üyesi
-- Admin ve süper yönetici her durumda onaylayabilir.
-- Not: Bu kontrol ek bir katmandır — belgeyi düzenleme yetkisi zaten
-- RLS tarafından sınırlanıyor (sahibi, departman müdürü veya admin).
create or replace function fn_can_approve(cid uuid, code text, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when uid is null then false
    when is_super_admin() or auth_role() = 'admin' then true
    else coalesce(
      (select s.open_to_all
              or s.department_id is null
              or exists (select 1 from department_members dm
                         where dm.department_id = s.department_id and dm.user_id = uid)
       from approval_steps s
       where s.company_id = cid and s.step_code = code and s.is_active),
      true)
  end
$$;

-- ------------------------------------------------------------
-- 2) FİYAT LİSTESİ (F05: "Fiyat listesi sürümü / onaylayan")
--    Teklifteki fiyatın hangi listeden geldiği kayıt altına alınmazsa
--    "bu fiyatı kim onayladı" sorusu altı ay sonra cevapsız kalır.
-- ------------------------------------------------------------
create table if not exists price_lists (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  version text not null,                       -- "2026-S2" gibi
  valid_from date not null default current_date,
  valid_to date,
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  unique (company_id, version)
);
create index if not exists plist_company_idx on price_lists(company_id, valid_from desc);

create table if not exists price_list_items (
  price_list_id uuid not null references price_lists(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  unit_price numeric(12,2) not null check (unit_price >= 0),   -- KDV hariç, şişe başına
  primary key (price_list_id, product_id)
);

-- ------------------------------------------------------------
-- 3) TİCARİ TEKLİF (F05)
--    "Bu form fatura değildir" — teklif bir taahhüt hazırlığıdır,
--    iki ayrı kontrolden (mali + satış) geçmeden sunulamaz.
-- ------------------------------------------------------------
create table if not exists quotes (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  outlet_id uuid not null references outlets(id) on delete cascade,
  visit_id uuid references visits(id) on delete set null,
  created_by uuid not null references profiles(id) on delete cascade,
  quote_no bigint,                              -- trigger doldurur
  valid_until date,                             -- geçerlilik tarihi
  price_list_id uuid references price_lists(id) on delete set null,
  price_list_version text,                      -- anlık görüntü: liste sonradan değişse de teklif sabit kalır
  -- tutarlar (trigger hesaplar)
  subtotal_excl_vat numeric(14,2) not null default 0,
  vat_rate numeric(5,2) not null default 1,     -- LOLEE: gıda, %1
  vat_amount numeric(14,2) not null default 0,
  total_incl_vat numeric(14,2) not null default 0,
  -- ticari koşullar
  payment_method text,
  approved_term_days smallint check (approved_term_days is null or approved_term_days >= 0),
  delivery_fee_included boolean,
  delivery_date date,
  campaign_note text,                           -- kampanya / bedelsiz ürün / istisna
  written_approval_ref text,                    -- yazılı onay referansı
  -- iki aşamalı kontrol (F05: "Mali kontrol" ve "Satış kontrolü")
  finance_checked_by uuid references profiles(id) on delete set null,
  finance_checked_at timestamptz,
  sales_checked_by uuid references profiles(id) on delete set null,
  sales_checked_at timestamptz,
  status text not null default 'taslak'
    check (status in ('taslak','kontrolde','onayli','sunuldu','kabul','red','suresi_doldu','iptal')),
  reject_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists quote_no_uidx on quotes(company_id, quote_no) where quote_no is not null;
create index if not exists quote_outlet_idx on quotes(outlet_id, created_at desc);
create index if not exists quote_company_idx on quotes(company_id, status, created_at desc);
-- Süresi dolan teklifleri tarayan gecelik iş için
create index if not exists quote_valid_idx on quotes(company_id, valid_until)
  where status in ('onayli','sunuldu');

create table if not exists quote_items (
  id uuid primary key default uuid_generate_v4(),
  quote_id uuid not null references quotes(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  bottles integer not null check (bottles > 0),           -- F05: "Şişe adet"
  unit_price numeric(12,2) not null check (unit_price >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  net_line numeric(14,2) generated always as
    (greatest(bottles * unit_price - discount, 0)) stored,
  position int not null default 0,
  unique (quote_id, product_id)
);
create index if not exists qitem_quote_idx on quote_items(quote_id, position);

-- ------------------------------------------------------------
-- 4) SİPARİŞ VE TESLİMAT TALİMATI (F06)
--    "Onaylı teklif referansı olmadan fiyat taahhüdü verilmez."
-- ------------------------------------------------------------
create table if not exists sales_orders (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  outlet_id uuid not null references outlets(id) on delete cascade,
  quote_id uuid references quotes(id) on delete set null,
  visit_id uuid references visits(id) on delete set null,
  created_by uuid not null references profiles(id) on delete cascade,
  order_no bigint,                              -- trigger doldurur
  customer_approval_date date,                  -- müşteri onay tarihi
  -- fatura bilgisi: noktadan kopyalanır, sonradan nokta değişse de belge sabit kalır
  invoice_title text,
  tax_office text,
  tax_number text,
  -- tutar
  total_amount numeric(14,2) not null default 0,
  vat_included boolean not null default true,
  payment_method text,
  collection_ref text,                          -- tahsilat referansı
  -- teslimat
  delivery_address text,
  receiver_name text,
  receiver_phone text,
  delivery_time_window text,                    -- "09:00-12:00"
  delivery_date date,
  -- iki aşamalı teyit (F06: "Stok ve sevk teyidi" / "Sipariş kabulü")
  stock_confirmed_by uuid references profiles(id) on delete set null,
  stock_confirmed_at timestamptz,
  order_accepted_by uuid references profiles(id) on delete set null,
  order_accepted_at timestamptz,
  -- zincir bağlar
  training_appointment_at timestamptz,          -- F08 randevusu
  first_followup_date date,                     -- F10 ilk takip
  first_followup_owner uuid references profiles(id) on delete set null,
  status text not null default 'taslak'
    check (status in ('taslak','onay_bekliyor','onayli','sevk_edildi','teslim','iptal')),
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists sorder_no_uidx on sales_orders(company_id, order_no) where order_no is not null;
create index if not exists sorder_outlet_idx on sales_orders(outlet_id, created_at desc);
create index if not exists sorder_company_idx on sales_orders(company_id, status, created_at desc);
create index if not exists sorder_delivery_idx on sales_orders(company_id, delivery_date)
  where status in ('onayli','sevk_edildi');

-- GERÇEK miktar şişedir; koli hesaplanır (F06: "birbirine eklenmez")
create table if not exists sales_order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references sales_orders(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  paid_bottles integer not null default 0 check (paid_bottles >= 0),   -- ücretli şişe
  free_bottles integer not null default 0 check (free_bottles >= 0),   -- bedelsiz şişe
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  line_total numeric(14,2) generated always as (paid_bottles * unit_price) stored,
  -- gösterim: 1 koli = 12 şişe
  paid_cases numeric(10,2) generated always as (round(paid_bottles / 12.0, 2)) stored,
  batch_id uuid references product_batches(id) on delete set null,
  position int not null default 0,
  unique (order_id, product_id),
  constraint soitem_qty_chk check (paid_bottles + free_bottles > 0)
);
create index if not exists soitem_order_idx on sales_order_items(order_id, position);
create index if not exists soitem_product_idx on sales_order_items(product_id);

-- ------------------------------------------------------------
-- 4b) ZİYARET ↔ SİPARİŞ ENTEGRASYONU
--     Ziyarette alınan sipariş ayrı bir kayıt DEĞİL; sales_orders
--     kaydının kendisi. Ziyaret ona bağlanır. Tek satış, tek kayıt:
--     iki yerde tutulsaydı hacim raporu çift sayardı.
-- ------------------------------------------------------------
alter table visits add column if not exists sales_order_id uuid
  references sales_orders(id) on delete set null;
create index if not exists visits_sorder_idx on visits(sales_order_id)
  where sales_order_id is not null;

-- Ziyaret "sipariş" sonucuyla kapanıyorsa bağlı sipariş zorunlu.
-- "Sipariş aldım" deyip kaydı olmayan ziyaret, hacim raporundaki
-- en sinsi hata kaynağıdır.
create or replace function fn_visit_order_link_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('gonderildi','onaylandi')
     and new.outcome = 'siparis' and new.sales_order_id is null then
    raise exception 'Ziyaret "sipariş" olarak kapatılamaz: sipariş kaydı oluşturulmalı (F03/F06).';
  end if;
  return new;
end $$;

drop trigger if exists trg_visit_order_link on visits;
create trigger trg_visit_order_link before insert or update of status, outcome, sales_order_id on visits
for each row execute function fn_visit_order_link_guard();

-- ------------------------------------------------------------
-- 5) AÇILIŞ KONTROLÜ (F07)
--    "Tüm kritik koşullar tamamlanmadan 'satışa hazır' olarak kapatma."
--    Bu cümle bir kuraldır, veritabanı uyguluyor (bkz. trigger).
-- ------------------------------------------------------------
create table if not exists outlet_openings (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  outlet_id uuid not null references outlets(id) on delete cascade,
  order_id uuid references sales_orders(id) on delete set null,
  delivery_doc_no text,
  outlet_manager text,                          -- işletme sorumlusu
  shift text,                                   -- vardiya
  checked_by uuid not null references profiles(id) on delete cascade,
  checked_at timestamptz not null default now(),
  result text not null default 'eksik_var'
    check (result in ('satisa_hazir','eksik_var','ertelendi')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists opening_outlet_idx on outlet_openings(outlet_id, checked_at desc);
create index if not exists opening_company_idx on outlet_openings(company_id, result, checked_at desc);

-- Kontrol başlıkları şirkete göre yönetilebilir; is_critical olanlar
-- tamamlanmadan açılış "satışa hazır" kapanamaz.
create table if not exists opening_check_items (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  label text not null,
  is_critical boolean not null default true,
  sort_order int not null default 0,
  is_active boolean not null default true,
  unique (company_id, label)
);

create table if not exists outlet_opening_results (
  opening_id uuid not null references outlet_openings(id) on delete cascade,
  check_item_id uuid not null references opening_check_items(id) on delete cascade,
  answer text not null check (answer in ('evet','hayir','uygulanmaz')),
  missing_note text,                            -- F07: "Eksik / sorumlu / tarih"
  owner_user_id uuid references profiles(id) on delete set null,
  due_date date,
  primary key (opening_id, check_item_id)
);

-- ------------------------------------------------------------
-- 6) PERSONEL EĞİTİMİ (F08)
--    "15 dakika ... Kabul: 5/5" — beş kontrolün hepsi geçmeden
--    katılımcı eğitimli sayılmaz.
-- ------------------------------------------------------------
create table if not exists outlet_trainings (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  outlet_id uuid not null references outlets(id) on delete cascade,
  order_id uuid references sales_orders(id) on delete set null,
  trainer_id uuid not null references profiles(id) on delete cascade,
  trained_at timestamptz not null default now(),
  duration_min smallint default 15,
  outlet_training_owner text,                   -- işletme eğitim sorumlusu
  missing_topics text,                          -- eksik konu
  retrain_date date,                            -- tekrar eğitim tarihi
  absent_shift text,                            -- katılmayan vardiya
  materials_left text,                          -- bırakılan tat kartı / materyal
  owner_accepted_by text,                       -- işletme sorumlusu kabulü
  owner_accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists training_outlet_idx on outlet_trainings(outlet_id, trained_at desc);
create index if not exists training_company_idx on outlet_trainings(company_id, trained_at desc);

-- F08'in beş kontrolü sabit sütun: form bunları adıyla sayıyor ve
-- "Kabul: 5/5" kuralı bu beşe bağlı. Esnek liste yapılsaydı kural kayardı.
create table if not exists training_participants (
  id uuid primary key default uuid_generate_v4(),
  training_id uuid not null references outlet_trainings(id) on delete cascade,
  full_name text not null,
  role text,
  shift text,
  chk_taste_match  text not null default 'tekrar' check (chk_taste_match  in ('gecti','tekrar')),
  chk_recommend    text not null default 'tekrar' check (chk_recommend    in ('gecti','tekrar')),
  chk_label        text not null default 'tekrar' check (chk_label        in ('gecti','tekrar')),
  chk_service      text not null default 'tekrar' check (chk_service      in ('gecti','tekrar')),
  chk_report       text not null default 'tekrar' check (chk_report       in ('gecti','tekrar')),
  passed boolean generated always as (
    chk_taste_match = 'gecti' and chk_recommend = 'gecti' and chk_label = 'gecti'
    and chk_service = 'gecti' and chk_report = 'gecti'
  ) stored,
  note text,
  position int not null default 0
);
create index if not exists tpart_training_idx on training_participants(training_id, position);

-- ------------------------------------------------------------
-- 7) HESAPLAMA TRIGGER'LARI
-- ------------------------------------------------------------

-- Teklif toplamları
create or replace function fn_recalc_quote() returns trigger
language plpgsql security definer set search_path = public as $$
declare qid uuid; sub numeric; rate numeric;
begin
  qid := coalesce(new.quote_id, old.quote_id);
  select coalesce(sum(net_line), 0) into sub from quote_items where quote_id = qid;
  select vat_rate into rate from quotes where id = qid;
  update quotes set
    subtotal_excl_vat = sub,
    vat_amount        = round(sub * coalesce(rate,0) / 100.0, 2),
    total_incl_vat    = sub + round(sub * coalesce(rate,0) / 100.0, 2),
    updated_at        = now()
  where id = qid;
  return null;
end $$;

drop trigger if exists trg_quote_items_recalc on quote_items;
create trigger trg_quote_items_recalc
after insert or update or delete on quote_items
for each row execute function fn_recalc_quote();

-- KDV oranı değişirse de tazele
create or replace function fn_quote_vat_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update quotes set
    vat_amount     = round(subtotal_excl_vat * coalesce(new.vat_rate,0) / 100.0, 2),
    total_incl_vat = subtotal_excl_vat + round(subtotal_excl_vat * coalesce(new.vat_rate,0) / 100.0, 2)
  where id = new.id;
  return null;
end $$;

drop trigger if exists trg_quote_vat on quotes;
create trigger trg_quote_vat after update of vat_rate on quotes
for each row when (old.vat_rate is distinct from new.vat_rate)
execute function fn_quote_vat_touch();

-- Sipariş toplamı
create or replace function fn_recalc_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare oid uuid; tot numeric;
begin
  oid := coalesce(new.order_id, old.order_id);
  select coalesce(sum(line_total), 0) into tot from sales_order_items where order_id = oid;
  update sales_orders set total_amount = tot, updated_at = now() where id = oid;
  return null;
end $$;

drop trigger if exists trg_order_items_recalc on sales_order_items;
create trigger trg_order_items_recalc
after insert or update or delete on sales_order_items
for each row execute function fn_recalc_order();

-- Belge numaraları (0018'in company_counters desenine uygun)
create or replace function fn_assign_quote_no() returns trigger
language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  if new.quote_no is not null then return new; end if;
  insert into company_counters (company_id, quote_seq) values (new.company_id, 1)
  on conflict (company_id) do update set quote_seq = company_counters.quote_seq + 1
  returning quote_seq into n;
  new.quote_no := n;
  return new;
end $$;

drop trigger if exists trg_quote_no on quotes;
create trigger trg_quote_no before insert on quotes
for each row execute function fn_assign_quote_no();

create or replace function fn_assign_sales_order_no() returns trigger
language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  if new.order_no is not null then return new; end if;
  insert into company_counters (company_id, sales_order_seq) values (new.company_id, 1)
  on conflict (company_id) do update set sales_order_seq = company_counters.sales_order_seq + 1
  returning sales_order_seq into n;
  new.order_no := n;
  return new;
end $$;

drop trigger if exists trg_sorder_no on sales_orders;
create trigger trg_sorder_no before insert on sales_orders
for each row execute function fn_assign_sales_order_no();

-- F05 KURALI: iki kontrol tamamlanmadan teklif 'onayli' olamaz
create or replace function fn_quote_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('onayli','sunuldu','kabul')
     and (new.finance_checked_at is null or new.sales_checked_at is null) then
    raise exception 'Teklif onaylanamaz: mali kontrol ve satış kontrolü tamamlanmalı (F05).';
  end if;
  -- onaylayanlar ilgili departmanın üyesi olmalı
  if new.finance_checked_by is not null
     and not fn_can_approve(new.company_id, 'mali_kontrol', new.finance_checked_by) then
    raise exception 'Mali kontrolü yalnızca ilgili departman üyesi yapabilir (F05).';
  end if;
  if new.sales_checked_by is not null
     and not fn_can_approve(new.company_id, 'satis_kontrolu', new.sales_checked_by) then
    raise exception 'Satış kontrolünü yalnızca ilgili departman üyesi yapabilir (F05).';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_quote_guard on quotes;
create trigger trg_quote_guard before update on quotes
for each row execute function fn_quote_guard();

-- F06 KURALI: onaylı teklif referansı olmadan sipariş onaylanamaz
create or replace function fn_order_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare qstatus text;
begin
  if new.status in ('onayli','sevk_edildi','teslim') then
    if new.quote_id is null then
      raise exception 'Sipariş onaylanamaz: onaylı teklif referansı zorunlu (F06).';
    end if;
    select status into qstatus from quotes where id = new.quote_id;
    if qstatus not in ('onayli','sunuldu','kabul') then
      raise exception 'Sipariş onaylanamaz: bağlı teklif henüz onaylı değil (durum: %).', qstatus;
    end if;
    if new.stock_confirmed_at is null then
      raise exception 'Sipariş onaylanamaz: stok ve sevk teyidi gerekli (F06).';
    end if;
    if new.stock_confirmed_by is not null
       and not fn_can_approve(new.company_id, 'stok_sevk_teyidi', new.stock_confirmed_by) then
      raise exception 'Stok ve sevk teyidini yalnızca ilgili departman üyesi verebilir (F06).';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_order_guard on sales_orders;
create trigger trg_order_guard before update on sales_orders
for each row execute function fn_order_guard();

-- F07 KURALI: kritik kontroller tamamlanmadan "satışa hazır" kapanamaz
create or replace function fn_opening_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare bad int;
begin
  if new.result = 'satisa_hazir' then
    select count(*) into bad
    from opening_check_items i
    left join outlet_opening_results r
      on r.opening_id = new.id and r.check_item_id = i.id
    where i.company_id = new.company_id and i.is_active and i.is_critical
      and (r.answer is null or r.answer = 'hayir');
    if bad > 0 then
      raise exception 'Açılış "satışa hazır" kapatılamaz: % kritik kontrol eksik veya hayır (F07).', bad;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_opening_guard on outlet_openings;
create trigger trg_opening_guard before update of result on outlet_openings
for each row execute function fn_opening_guard();

-- Departman otomatik doldurma (0024'teki fonksiyon yeniden kullanılıyor)
drop trigger if exists trg_quote_dept on quotes;
create trigger trg_quote_dept before insert on quotes
for each row execute function fn_fill_department();
drop trigger if exists trg_sorder_dept on sales_orders;
create trigger trg_sorder_dept before insert on sales_orders
for each row execute function fn_fill_department();
drop trigger if exists trg_opening_dept on outlet_openings;
create trigger trg_opening_dept before insert on outlet_openings
for each row execute function fn_fill_department();
drop trigger if exists trg_training_dept on outlet_trainings;
create trigger trg_training_dept before insert on outlet_trainings
for each row execute function fn_fill_department();

-- ------------------------------------------------------------
-- 8) TAKİP KAYNAKLARINI GENİŞLET
--    F05–F11'in hepsinde "Sonraki adım ve kontrol" bloğu var.
-- ------------------------------------------------------------
do $$ begin
  alter table follow_ups drop constraint if exists follow_ups_source_type_check;
  alter table follow_ups add constraint follow_ups_source_type_check
    check (source_type in ('visit','tasting','assessment','quote','order',
                           'opening','training','stock','reorder','complaint','manual'));
end $$;

-- ------------------------------------------------------------
-- 9) RLS
-- ------------------------------------------------------------
alter table approval_steps          enable row level security;
alter table price_lists             enable row level security;
alter table price_list_items        enable row level security;
alter table quotes                  enable row level security;
alter table quote_items             enable row level security;
alter table sales_orders            enable row level security;
alter table sales_order_items       enable row level security;
alter table outlet_openings         enable row level security;
alter table opening_check_items     enable row level security;
alter table outlet_opening_results  enable row level security;
alter table outlet_trainings        enable row level security;
alter table training_participants   enable row level security;

-- Referans tabloları: şirkette herkes okur, admin yazar
do $$
declare t text;
begin
  foreach t in array array['price_lists','opening_check_items','approval_steps'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select using (is_super_admin() or same_company(company_id))',
      t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for all '
      || 'using (is_super_admin() or (same_company(company_id) and auth_role() = ''admin'')) '
      || 'with check (is_super_admin() or (same_company(company_id) and auth_role() = ''admin''))',
      t || '_write', t);
  end loop;
end $$;

drop policy if exists plitem_all on price_list_items;
create policy plitem_all on price_list_items for all
  using (exists (select 1 from price_lists p where p.id = price_list_id and same_company(p.company_id)))
  with check (exists (select 1 from price_lists p where p.id = price_list_id
                      and same_company(p.company_id)
                      and (is_super_admin() or auth_role() = 'admin')));

-- Belgeler: temsilci kendi · müdür departmanı · admin hepsi
drop policy if exists quotes_select on quotes;
create policy quotes_select on quotes for select
  using (same_company(company_id) and sales_can_see(created_by, department_id));
drop policy if exists quotes_insert on quotes;
create policy quotes_insert on quotes for insert
  with check (created_by = auth.uid() and same_company(company_id));
drop policy if exists quotes_update on quotes;
create policy quotes_update on quotes for update
  using (same_company(company_id) and (
    is_super_admin() or auth_role() = 'admin' or manages_department(department_id)
    or (created_by = auth.uid() and status in ('taslak','kontrolde'))));
drop policy if exists quotes_delete on quotes;
create policy quotes_delete on quotes for delete
  using (same_company(company_id) and (is_super_admin() or auth_role() = 'admin'));

drop policy if exists qitem_all on quote_items;
create policy qitem_all on quote_items for all
  using (exists (select 1 from quotes q where q.id = quote_id
                 and same_company(q.company_id) and sales_can_see(q.created_by, q.department_id)))
  with check (exists (select 1 from quotes q where q.id = quote_id
                 and same_company(q.company_id) and sales_can_see(q.created_by, q.department_id)));

drop policy if exists sorder_select on sales_orders;
create policy sorder_select on sales_orders for select
  using (same_company(company_id) and sales_can_see(created_by, department_id));
drop policy if exists sorder_insert on sales_orders;
create policy sorder_insert on sales_orders for insert
  with check (created_by = auth.uid() and same_company(company_id));
drop policy if exists sorder_update on sales_orders;
create policy sorder_update on sales_orders for update
  using (same_company(company_id) and (
    is_super_admin() or auth_role() = 'admin' or manages_department(department_id)
    or (created_by = auth.uid() and status in ('taslak','onay_bekliyor'))));
drop policy if exists sorder_delete on sales_orders;
create policy sorder_delete on sales_orders for delete
  using (same_company(company_id) and (is_super_admin() or auth_role() = 'admin'));

drop policy if exists soitem_all on sales_order_items;
create policy soitem_all on sales_order_items for all
  using (exists (select 1 from sales_orders o where o.id = order_id
                 and same_company(o.company_id) and sales_can_see(o.created_by, o.department_id)))
  with check (exists (select 1 from sales_orders o where o.id = order_id
                 and same_company(o.company_id) and sales_can_see(o.created_by, o.department_id)));

drop policy if exists opening_all on outlet_openings;
create policy opening_all on outlet_openings for all
  using (same_company(company_id) and sales_can_see(checked_by, department_id))
  with check (same_company(company_id));

drop policy if exists oresult_all on outlet_opening_results;
create policy oresult_all on outlet_opening_results for all
  using (exists (select 1 from outlet_openings o where o.id = opening_id
                 and same_company(o.company_id) and sales_can_see(o.checked_by, o.department_id)))
  with check (exists (select 1 from outlet_openings o where o.id = opening_id
                 and same_company(o.company_id) and sales_can_see(o.checked_by, o.department_id)));

drop policy if exists training_all on outlet_trainings;
create policy training_all on outlet_trainings for all
  using (same_company(company_id) and sales_can_see(trainer_id, department_id))
  with check (same_company(company_id));

drop policy if exists tpart_all on training_participants;
create policy tpart_all on training_participants for all
  using (exists (select 1 from outlet_trainings t where t.id = training_id
                 and same_company(t.company_id) and sales_can_see(t.trainer_id, t.department_id)))
  with check (exists (select 1 from outlet_trainings t where t.id = training_id
                 and same_company(t.company_id) and sales_can_see(t.trainer_id, t.department_id)));

-- Sipariş hattı müşterilerini kilitle (0018 deseni)
do $$
declare t text; pol text;
begin
  foreach t in array array['approval_steps','price_lists','price_list_items','quotes','quote_items',
                           'sales_orders','sales_order_items','outlet_openings',
                           'opening_check_items','outlet_opening_results',
                           'outlet_trainings','training_participants'] loop
    pol := 'lole_cust_block_' || t;
    execute format('drop policy if exists %I on public.%I', pol, t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated '
      || 'using ((select not auth_is_customer())) with check ((select not auth_is_customer()))',
      pol, t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 10) VARSAYILAN VERİ — F07'nin sekiz kontrol başlığı
-- ------------------------------------------------------------
create or replace function fn_seed_opening_checks(cid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into opening_check_items (company_id, label, is_critical, sort_order) values
    (cid,'Adet / hasar kontrol edildi',   true, 10),
    (cid,'Ödeme / teslim kaydı tamam',    true, 20),
    (cid,'Soğuk servis alanı hazır',      true, 30),
    (cid,'Menü veya kasa ürünü açıldı',   true, 40),
    (cid,'Fiyat görünür ve doğru',        true, 50),
    (cid,'Stand / dolap etiketi görünür', false,60),
    (cid,'Personel eğitimi tamam',        true, 70),
    (cid,'Takip tarihi belirlendi',       true, 80)
  on conflict (company_id, label) do nothing;
end $$;

-- Onay adımları — hepsi tüm departmanlara açık (open_to_all varsayılan true)
create or replace function fn_seed_approval_steps(cid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into approval_steps (company_id, step_code, label, open_to_all, sort_order) values
    (cid,'mali_kontrol',     'Mali Kontrol',        true, 10),
    (cid,'satis_kontrolu',   'Satış Kontrolü',      true, 20),
    (cid,'stok_sevk_teyidi', 'Stok ve Sevk Teyidi', true, 30),
    (cid,'siparis_kabulu',   'Sipariş Kabulü',      true, 40)
  on conflict (company_id, step_code) do nothing;
end $$;

-- Fiyat listesi: dört ürün de 56,00 TL (KDV hariç, şişe başına)
create or replace function fn_seed_price_list(cid uuid, ver text, price numeric) returns void
language plpgsql security definer set search_path = public as $$
declare lid uuid;
begin
  insert into price_lists (company_id, version, valid_from)
  values (cid, ver, current_date)
  on conflict (company_id, version) do nothing;

  select id into lid from price_lists where company_id = cid and version = ver;
  if lid is null then return; end if;

  insert into price_list_items (price_list_id, product_id, unit_price)
  select lid, p.id, price from products p
  where p.company_id = cid and p.is_active
  on conflict (price_list_id, product_id) do nothing;
end $$;

do $$
declare c record;
begin
  for c in select id from companies where coalesce(kind,'internal') = 'internal' loop
    perform fn_seed_opening_checks(c.id);
    perform fn_seed_approval_steps(c.id);
    perform fn_seed_price_list(c.id, to_char(current_date,'YYYY-MM'), 56.00);
  end loop;
end $$;
