-- ============================================================
-- 0022 — SAHA SATIŞ / ÇEKİRDEK (noktalar, ürünler, kriterler)
-- Supabase SQL Editor'e TEK PARÇA yapıştırılır. Tekrar çalıştırılabilir.
--
-- Bu betik yalnızca USTA VERİ (master data) kurar: nokta kartoteksi,
-- iletişim kişileri, ürün ve parti listesi, puanlama kriterleri,
-- itiraz nedenleri ve hedefler. Operasyon (rota/ziyaret/tadım) 0023'te.
--
-- Mevcut davranış GARANTİSİ: hiçbir mevcut tablo/politika değiştirilmez,
-- yalnızca yeni tablolar eklenir. Müşteri hesapları (0018) tüm yeni
-- tablolardan restrictive kuralla kilitlenir.
-- ============================================================

-- ------------------------------------------------------------
-- 1) NOKTA TİPLERİ VE KANALLAR
--    Kanal sabit (rapor kırılımı), tip şirkete göre yönetilebilir.
-- ------------------------------------------------------------
create table if not exists outlet_types (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  channel text not null
    check (channel in ('horeca','geleneksel','modern','yol','kurumsal','toptan','diger')),
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);
create index if not exists otype_company_idx on outlet_types(company_id, channel, sort_order);

-- ------------------------------------------------------------
-- 2) NOKTALAR (işletme kartoteksi)
--    F03'teki "müşteri profili / en çok satan içecek / seçim şekli"
--    serbest metin yerine alan olarak tutulur ki "rakip X'in güçlü
--    olduğu noktalar" gibi liste çıkarılabilsin.
-- ------------------------------------------------------------
create table if not exists outlets (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  code text,                                   -- formlardaki "işletme / nokta kodu"
  name text not null,
  legal_name text,                             -- fatura ünvanı
  parent_outlet_id uuid references outlets(id) on delete set null,  -- şube → merkez
  chain_decision text not null default 'sube_karar'
    check (chain_decision in ('sube_karar','merkez_karar','karma')),
  type_id uuid references outlet_types(id) on delete set null,
  city text,
  district text,
  address text,
  lat numeric(9,6),
  lng numeric(9,6),
  tax_office text,
  tax_number text,
  phone text,
  email text,
  status text not null default 'aday'
    check (status in ('aday','aktif','pasif','kaybedildi')),
  current_supplier text,                       -- mevcut tedarikçi (rakip istihbaratı)
  top_selling_drink text,                      -- en çok satan içecek
  selection_method text
    check (selection_method is null or selection_method in
           ('sahip','merkez','menu_danismani','sef','diger')),
  contract_end_date date,                      -- mevcut tedarikçi sözleşmesinin bitişi
  potential_monthly_volume numeric(12,2),      -- tahmini aylık kasa
  score numeric(4,2),                          -- son hesaplanan nokta skoru (1–5)
  segment char(1) check (segment is null or segment in ('A','B','C')),
  assigned_user_id uuid references profiles(id) on delete set null,
  last_visit_at timestamptz,
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outlets_no_self_parent check (parent_outlet_id is null or parent_outlet_id <> id)
);

-- Nokta kodu şirket içinde tekil olsun ama boş bırakılabilsin.
create unique index if not exists outlets_code_uidx
  on outlets(company_id, lower(code)) where code is not null;
-- Ana liste + kartoteks filtresi
create index if not exists outlets_company_idx on outlets(company_id, status, name);
-- Rota planlama: "Kadıköy'deki aktif noktalar"
create index if not exists outlets_geo_idx on outlets(company_id, city, district);
-- Temsilcinin kendi noktaları
create index if not exists outlets_assigned_idx on outlets(assigned_user_id) where is_active;
-- Kapsama raporu: "14 gündür ziyaret edilmeyenler"
create index if not exists outlets_lastvisit_idx on outlets(company_id, last_visit_at nulls first);
-- Form içi arama (pg_trgm yoksa prefix araması için yeterli)
create index if not exists outlets_name_idx on outlets(company_id, lower(name));
-- Zincir ağacı
create index if not exists outlets_parent_idx on outlets(parent_outlet_id) where parent_outlet_id is not null;

-- ------------------------------------------------------------
-- 3) İLETİŞİM KİŞİLERİ
--    Muhasebe ve satın alma ayrı kişiler; tek telefon alanı yetmez.
--    decision_authority = F03'teki "karar yetkisi".
-- ------------------------------------------------------------
create table if not exists outlet_contacts (
  id uuid primary key default uuid_generate_v4(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  role text not null default 'diger'
    check (role in ('sahip','isletme_muduru','satin_alma','muhasebe','depo','sef','diger')),
  full_name text not null,
  phone text,
  email text,
  decision_authority text not null default 'yok'
    check (decision_authority in ('karar_verir','etkiler','yok')),
  is_primary boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists ocontact_outlet_idx on outlet_contacts(outlet_id, role);
-- Nokta başına tek ana muhatap
create unique index if not exists ocontact_primary_uidx
  on outlet_contacts(outlet_id) where is_primary;

-- ------------------------------------------------------------
-- 4) ÜRÜNLER VE PARTİLER
--    Parti elle yazılmaz, listeden seçilir: izlenebilirliğin bütün
--    anlamı güvenilir olmasında. Elle yazılan parti numarası bir
--    geri çağırma anında işe yaramaz.
-- ------------------------------------------------------------
create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  code text,
  name text not null,
  taste_reference text,                        -- F04 tat referansı
  category text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);
create index if not exists products_company_idx on products(company_id, sort_order) where is_active;

create table if not exists product_batches (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  batch_no text not null,                      -- parti
  production_date date,
  expiry_date date,                            -- TETT
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, batch_no)
);
-- Geri çağırma sorgusu: "şu parti hangi noktalara gitti"
create index if not exists batch_product_idx on product_batches(product_id, expiry_date)
  where is_active;

-- ------------------------------------------------------------
-- 5) PUANLAMA KRİTERLERİ
--    Kodda sabit değil; Ayarlar'dan yönetilir. Ağırlık şart:
--    ağırlıksız ortalamada "POS malzemesi" ile "ödeme güvenilirliği"
--    eşit sayılır ve skor karar için kullanılamaz hale gelir.
-- ------------------------------------------------------------
create table if not exists score_criteria (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  grp text not null
    check (grp in ('potansiyel','gorusme','icra','genel')),
  label text not null,
  weight smallint not null default 1 check (weight between 1 and 5),
  applies_to text not null default 'hepsi'
    check (applies_to in ('aday','musteri','hepsi')),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, label)
);
create index if not exists scrit_company_idx on score_criteria(company_id, sort_order) where is_active;

-- ------------------------------------------------------------
-- 6) İTİRAZ / SİPARİŞ ALINAMAMA NEDENLERİ
--    Sabit liste, çünkü serbest metin raporlanamaz. Aynı liste hem
--    "beyan edilen itiraz" hem "gerçek neden" için kullanılır;
--    ikisinin farkı fiyatlama ve saha eğitimi kararını verir.
-- ------------------------------------------------------------
create table if not exists no_order_reasons (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  label text not null,
  requires_note boolean not null default false,
  sort_order int not null default 0,
  is_active boolean not null default true,
  unique (company_id, code)
);
create index if not exists noreason_company_idx on no_order_reasons(company_id, sort_order) where is_active;

-- ------------------------------------------------------------
-- 7) HEDEFLER
--    F01: İstanbul 5, bölgesel ekipler 10 görüşme (kişi/ekip başına, GÜNLÜK).
-- ------------------------------------------------------------
create table if not exists sales_targets (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  scope text not null check (scope in ('varsayilan','sehir','departman','kisi')),
  scope_value text,                            -- şehir adı / departman id / kullanıcı id
  period text not null default 'gunluk' check (period in ('gunluk','haftalik','aylik')),
  metric text not null
    check (metric in ('ziyaret','yeni_nokta','donusum','hacim')),
  target_value numeric(12,2) not null,
  valid_from date not null default current_date,
  valid_to date,
  created_at timestamptz not null default now()
);
create index if not exists starget_lookup_idx
  on sales_targets(company_id, metric, period, scope, scope_value);

-- ------------------------------------------------------------
-- 8) updated_at DOKUNUCU
--    Projede şu ana kadar trigger yoktu, sütun elle güncelleniyordu.
--    Nokta kartı birden çok yoldan (form, onay, skor işleyici)
--    güncellendiği için burada trigger gerçekten gerekli.
-- ------------------------------------------------------------
create or replace function fn_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_outlets_touch on outlets;
create trigger trg_outlets_touch before update on outlets
for each row execute function fn_touch_updated_at();

-- ------------------------------------------------------------
-- 8b) BİRİM KATSAYILARI — TABAN BİRİM: ŞİŞE
--     F06 formu açıkça yazıyor: "Bir koli 12 şişedir."
--     F05 "Şişe adet", F09 "aynı şişe birimiyle" diyor.
--     Yani bu işletmenin taban birimi ŞİŞE, kasa değil.
--     Hacimle ilgili her rapor şişeye çevirip toplar; dönüşüm
--     TEK YERDE durur, yoksa er geç biri unutur.
-- ------------------------------------------------------------
create table if not exists unit_factors (
  company_id uuid not null references companies(id) on delete cascade,
  unit text not null check (unit in ('sise','koli','palet')),
  factor numeric(10,4) not null check (factor > 0),   -- 1 birim kaç ŞİŞE eder
  primary key (company_id, unit)
);

-- ============================================================
-- 9) RLS
-- ============================================================
alter table outlet_types     enable row level security;
alter table unit_factors     enable row level security;
alter table outlets          enable row level security;
alter table outlet_contacts  enable row level security;
alter table products         enable row level security;
alter table product_batches  enable row level security;
alter table score_criteria   enable row level security;
alter table no_order_reasons enable row level security;
alter table sales_targets    enable row level security;

-- --- Referans tabloları: şirketteki herkes OKUR, yalnızca admin YAZAR ---
do $$
declare t text;
begin
  foreach t in array array['outlet_types','products','product_batches',
                           'score_criteria','no_order_reasons','sales_targets',
                           'unit_factors'] loop
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

-- --- NOKTALAR ---
-- OKUMA: şirketteki tüm personel. Gerekçe aşağıdaki tasarım notunda.
drop policy if exists outlets_select on outlets;
create policy outlets_select on outlets for select
  using (is_super_admin() or same_company(company_id));

-- EKLEME: sahadaki herkes nokta açabilir ama 'aday' olarak doğar
-- (onay akışı uygulama katmanında; burada sadece sahiplik şartı var).
drop policy if exists outlets_insert on outlets;
create policy outlets_insert on outlets for insert
  with check (created_by = auth.uid() and (is_super_admin() or same_company(company_id)));

-- GÜNCELLEME: sorumlu temsilci, departman müdürü veya admin.
-- Herkese açık olsaydı vergi numarası ve iletişim bilgileri ezilirdi.
drop policy if exists outlets_update on outlets;
create policy outlets_update on outlets for update
  using (
    is_super_admin()
    or (same_company(company_id) and (
          auth_role() = 'admin'
          or assigned_user_id = auth.uid()
          or created_by = auth.uid()
          or manages_department(department_id)
    ))
  );

drop policy if exists outlets_delete on outlets;
create policy outlets_delete on outlets for delete
  using (is_super_admin() or (same_company(company_id) and auth_role() = 'admin'));

-- --- İLETİŞİM KİŞİLERİ: üst kaydın kuralını miras alır ---
drop policy if exists ocontact_select on outlet_contacts;
create policy ocontact_select on outlet_contacts for select
  using (is_super_admin() or same_company(company_id));

drop policy if exists ocontact_write on outlet_contacts;
create policy ocontact_write on outlet_contacts for all
  using (exists (select 1 from outlets o where o.id = outlet_id
                 and (is_super_admin() or (same_company(o.company_id) and (
                        auth_role() = 'admin'
                        or o.assigned_user_id = auth.uid()
                        or o.created_by = auth.uid()
                        or manages_department(o.department_id))))))
  with check (exists (select 1 from outlets o where o.id = outlet_id
                 and o.company_id = outlet_contacts.company_id
                 and (is_super_admin() or (same_company(o.company_id) and (
                        auth_role() = 'admin'
                        or o.assigned_user_id = auth.uid()
                        or o.created_by = auth.uid()
                        or manages_department(o.department_id))))));

-- ============================================================
-- 10) MÜŞTERİ KİLİDİ (0018 çizgisi — ATLANMAMALI)
--     Sipariş hattı müşterileri saha verisine erişemez.
-- ============================================================
do $$
declare t text; pol text;
begin
  foreach t in array array['outlet_types','outlets','outlet_contacts','products',
                           'product_batches','score_criteria','no_order_reasons',
                           'sales_targets','unit_factors'] loop
    pol := 'lole_cust_block_' || t;
    execute format('drop policy if exists %I on public.%I', pol, t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated '
      || 'using ((select not auth_is_customer())) with check ((select not auth_is_customer()))',
      pol, t);
  end loop;
end $$;

-- ============================================================
-- 11) VARSAYILAN VERİ
--     Fonksiyon olarak tanımlanır ki yeni şirket açıldığında da
--     tek çağrıyla kurulabilsin.
-- ============================================================
create or replace function fn_seed_sales_defaults(cid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Nokta tipleri (kanal → tip)
  insert into outlet_types (company_id, channel, name, sort_order) values
    (cid,'horeca','Kafe',10),(cid,'horeca','Restoran',20),(cid,'horeca','Otel',30),
    (cid,'horeca','Pastane / Fırın',40),(cid,'horeca','Nargile Kafe',50),
    (cid,'horeca','Catering',60),(cid,'horeca','Düğün / Organizasyon',70),
    (cid,'geleneksel','Bakkal',110),(cid,'geleneksel','Büfe / Kuruyemiş',120),
    (cid,'geleneksel','Süpermarket (yerel)',130),
    (cid,'modern','Zincir Market',210),(cid,'modern','AVM Yemek Katı',220),
    (cid,'yol','Akaryakıt İstasyonu',310),(cid,'yol','Dinlenme Tesisi',320),
    (cid,'kurumsal','Okul / Kantin',410),(cid,'kurumsal','Spor Salonu',420),
    (cid,'kurumsal','Hastane',430),(cid,'kurumsal','Fabrika Yemekhanesi',440),
    (cid,'toptan','Toptancı',510),(cid,'toptan','Distribütör Adayı',520),
    (cid,'diger','Diğer',900)
  on conflict (company_id, name) do nothing;

  -- Ürünler ve tat referansları (F04)
  insert into products (company_id, name, taste_reference, sort_order) values
    (cid,'Koruk','canlı ekşi / hafif buruk',10),
    (cid,'Kara Üzüm','tatlı / dolgun',20),
    (cid,'Elma-Nar','tatlı mayhoş',30),
    (cid,'Reyhan','bitkisel tatlı',40)
  on conflict (company_id, name) do nothing;

  -- Puanlama kriterleri
  insert into score_criteria (company_id, grp, label, weight, applies_to, sort_order) values
    (cid,'potansiyel','Müşteri trafiği / lokasyon',3,'hepsi',10),
    (cid,'potansiyel','Ciro / hacim potansiyeli',3,'hepsi',20),
    (cid,'potansiyel','Ödeme güvenilirliği',3,'hepsi',30),
    (cid,'potansiyel','Karar vericiye erişim',2,'hepsi',40),
    (cid,'potansiyel','Rakipten çıkma esnekliği',2,'hepsi',50),
    (cid,'gorusme','İlgi düzeyi',2,'hepsi',110),
    (cid,'gorusme','Ürüne yaklaşım',2,'hepsi',120),
    (cid,'gorusme','İş birliğine açıklık',2,'hepsi',130),
    (cid,'icra','Raf / dolap görünürlüğü',2,'musteri',210),
    (cid,'icra','Stok yeterliliği',2,'musteri',220),
    (cid,'icra','POS malzemesi / tabela',1,'musteri',230),
    (cid,'icra','Fiyat etiketi uyumu',1,'musteri',240),
    (cid,'icra','Soğutucu durumu',1,'musteri',250),
    (cid,'genel','Ziyaret başarısı',1,'hepsi',310)
  on conflict (company_id, label) do nothing;

  -- İtiraz / sipariş alınamama nedenleri
  insert into no_order_reasons (company_id, code, label, requires_note, sort_order) values
    (cid,'fiyat','Fiyat yüksek',false,10),
    (cid,'tedarikci','Mevcut tedarikçi / sözleşme bağı',false,20),
    (cid,'stok','Stok var / ihtiyaç yok',false,30),
    (cid,'karar_yok','Karar verici yoktu',false,40),
    (cid,'merkez','Merkez kararı bekleniyor',false,50),
    (cid,'tat','Ürün / tat beğenilmedi',true,60),
    (cid,'yer','Raf veya dolap yeri yok',false,70),
    (cid,'vade','Vade / ödeme koşulu talebi',false,80),
    (cid,'sezon','Sezon dışı',false,90),
    (cid,'ilgisiz','İlgilenmedi',false,100),
    (cid,'diger','Diğer',true,900)
  on conflict (company_id, code) do nothing;

  -- Hedefler (F01): İstanbul 5, diğer şehirler 10 — kişi başına GÜNLÜK
  insert into sales_targets (company_id, scope, scope_value, period, metric, target_value)
  select cid,'sehir','İstanbul','gunluk','ziyaret',5
  where not exists (select 1 from sales_targets t where t.company_id = cid
                    and t.scope='sehir' and t.scope_value='İstanbul'
                    and t.period='gunluk' and t.metric='ziyaret');
  insert into sales_targets (company_id, scope, scope_value, period, metric, target_value)
  select cid,'varsayilan',null,'gunluk','ziyaret',10
  where not exists (select 1 from sales_targets t where t.company_id = cid
                    and t.scope='varsayilan' and t.period='gunluk' and t.metric='ziyaret');

  -- Birim katsayıları — F06: "Bir koli 12 şişedir". Taban birim şişe.
  insert into unit_factors (company_id, unit, factor) values
    (cid,'sise',1),(cid,'koli',12),(cid,'palet',576)
  on conflict (company_id, unit) do nothing;
end $$;

-- Mevcut iç şirketlere uygula (sipariş hattı şirketleri hariç)
do $$
declare c record;
begin
  for c in select id from companies where coalesce(kind,'internal') = 'internal' loop
    perform fn_seed_sales_defaults(c.id);
  end loop;
end $$;
