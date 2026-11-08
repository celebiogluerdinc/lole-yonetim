-- ============================================================
-- 0023 — SAHA SATIŞ / OPERASYON (rota, ziyaret, tadım, takip)
-- 0022'den SONRA çalıştırılır. Tekrar çalıştırılabilir.
-- ============================================================

-- ------------------------------------------------------------
-- 0) BİLDİRİM TÜRLERİ
--    notifications.type bir pg ENUM (0001). Yeni değerler burada eklenir.
--    DİKKAT: PostgreSQL'de eklenen enum değeri AYNI işlemde kullanılamaz.
--    Aşağıda değerler yalnızca fonksiyon GÖVDESİNDE geçiyor (gövde
--    oluşturma anında değerlendirilmez), bu yüzden sorun çıkmaz.
--    0021 de aynı deseni kullanıyor.
-- ------------------------------------------------------------
alter type notif_type add value if not exists 'visit_submitted';
alter type notif_type add value if not exists 'follow_up_due';

-- ------------------------------------------------------------
-- 1) ROTA PLANI (F01)
-- ------------------------------------------------------------
create table if not exists route_plans (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  user_id uuid not null references profiles(id) on delete cascade,
  plan_date date not null,
  city text,
  district text,
  vehicle text,
  team text,
  target_visits smallint not null default 10 check (target_visits between 1 and 50),
  blocker_note text,                           -- rota engeli / ertelenen görüşme
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
-- Bir kişi bir gün için tek rota planı
create unique index if not exists rplan_user_date_uidx on route_plans(user_id, plan_date);
create index if not exists rplan_company_idx on route_plans(company_id, plan_date desc);

create table if not exists route_stops (
  id uuid primary key default uuid_generate_v4(),
  route_plan_id uuid not null references route_plans(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  planned_time time,
  outlet_id uuid references outlets(id) on delete set null,
  outlet_label text,                           -- nokta kartoteksi dışı serbest giriş
  purpose text,
  contact_person text,
  status text not null default 'planlandi'
    check (status in ('planlandi','gerceklesti','ertelendi','iptal')),
  visit_id uuid,                               -- gerçekleşince bağlanır (FK aşağıda)
  result_note text,
  position int not null default 0
);
create index if not exists rstop_plan_idx on route_stops(route_plan_id, position, planned_time);
create index if not exists rstop_outlet_idx on route_stops(outlet_id) where outlet_id is not null;

-- ------------------------------------------------------------
-- 2) ZİYARETLER (F03)
--    department_id noktadan KOPYALANIR. Gerekçe: RLS'teki
--    manages_department() doğrudan bir departman uuid'si alır;
--    kopyalamazsak her satır için outlets'a JOIN gerekir ve
--    politika binlerce satırda yavaşlar.
--    client_uuid: çevrimdışı kuyruğun mükerrer göndermesini engeller.
-- ------------------------------------------------------------
create table if not exists visits (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  outlet_id uuid not null references outlets(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  route_stop_id uuid references route_stops(id) on delete set null,
  client_uuid uuid,                            -- istemci tarafı tekillik anahtarı
  visit_date date not null default current_date,
  started_at timestamptz,
  ended_at timestamptz,
  visit_type text not null default 'rutin'
    check (visit_type in ('ilk_ziyaret','rutin','tanitim_tadim','siparis','tahsilat','sikayet')),

  -- Görüşülen kişi
  met_contact_id uuid references outlet_contacts(id) on delete set null,
  met_person_name text,
  met_person_role text,
  met_decision_authority text
    check (met_decision_authority is null or
           met_decision_authority in ('karar_verir','etkiler','yok')),

  -- F03 gövdesi
  main_need text,                              -- asıl ihtiyaç / servis, dolap, menü, ödeme
  offered_solution text,                       -- sunulan çözüm / önerilen ürünler
  outlet_comment text,                         -- işletmenin yorumu
  objection_stated_id uuid references no_order_reasons(id) on delete set null,
  objection_stated_note text,                  -- müşterinin kendi ifadesi
  objection_real_id uuid references no_order_reasons(id) on delete set null,
  objection_real_note text,                    -- temsilcinin değerlendirmesi
  our_answer text,                             -- verdiğimiz yanıt

  -- Sonuç
  outcome text not null default 'takip'
    check (outcome in ('tadim_planlandi','teklif_istendi','siparis','takip','olumsuz')),
  order_requested boolean not null default false,
  -- Tutar burada tutulmaz: bağlı sales_orders kaydından gelir (tek gerçek).
  purchase_request_id uuid references purchase_requests(id) on delete set null,  -- 0018 köprüsü

  customer_comment text,
  private_note text,

  -- Skor (0023 §5'teki trigger tarafından yazılır)
  overall_score numeric(4,2),
  score_count smallint not null default 0,

  -- Konum doğrulama
  lat numeric(9,6),
  lng numeric(9,6),
  gps_distance_m int,

  status text not null default 'taslak'
    check (status in ('taslak','gonderildi','onaylandi','reddedildi')),
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint visits_time_order check (ended_at is null or started_at is null or ended_at >= started_at)
);

-- Çevrimdışı kuyruk mükerrer gönderemez
create unique index if not exists visits_client_uuid_uidx
  on visits(client_uuid) where client_uuid is not null;
-- Ana liste + günlük/haftalık/aylık rapor
create index if not exists visits_company_date_idx on visits(company_id, visit_date desc);
-- Temsilci kendi listesi + karne
create index if not exists visits_user_date_idx on visits(user_id, visit_date desc);
-- Nokta kartı ziyaret geçmişi
create index if not exists visits_outlet_date_idx on visits(outlet_id, visit_date desc);
-- Müdür ekip listesi (RLS manages_department bu sütunu kullanır)
create index if not exists visits_dept_date_idx on visits(department_id, visit_date desc)
  where department_id is not null;
-- Dönüşüm hunisi: sonuca göre sayım
create index if not exists visits_outcome_idx on visits(company_id, visit_date, outcome);
-- Onay kuyruğu
create index if not exists visits_status_idx on visits(company_id, status)
  where status = 'gonderildi';
-- Mükerrer uyarısı (UNIQUE DEĞİL: aynı gün ikinci ziyaret engellenmez, uyarılır)
create index if not exists visits_dup_idx on visits(outlet_id, user_id, visit_date);

drop trigger if exists trg_visits_touch on visits;
create trigger trg_visits_touch before update on visits
for each row execute function fn_touch_updated_at();

-- route_stops → visits bağı (visits sonradan oluştuğu için burada)
do $$
begin
  alter table route_stops
    add constraint rstop_visit_fk foreign key (visit_id) references visits(id) on delete set null;
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- 3) PUANLAR
--    weight_snapshot: ağırlık KAYIT ANINDA dondurulur. Admin gelecek
--    ay ağırlığı değiştirirse geçmiş ziyaretlerin skoru DEĞİŞMEZ.
--    Skor bir kanıttır; geriye dönük değişmesi raporu güvenilmez yapar.
-- ------------------------------------------------------------
create table if not exists visit_scores (
  visit_id uuid not null references visits(id) on delete cascade,
  criterion_id uuid not null references score_criteria(id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  weight_snapshot smallint not null default 1 check (weight_snapshot between 1 and 5),
  primary key (visit_id, criterion_id)
);
create index if not exists vscore_criterion_idx on visit_scores(criterion_id);

-- ------------------------------------------------------------
-- 4) TADIM (F04)
--    Birebir müşteri sözü (customer_verbatim) ASLA özetlenmez;
--    yanındaki 1–5 puan sayılabilir olanı sağlar. İkisi birbirinin
--    yerine değil, yan yana.
-- ------------------------------------------------------------
create table if not exists visit_tastings (
  id uuid primary key default uuid_generate_v4(),
  visit_id uuid not null references visits(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  batch_id uuid references product_batches(id) on delete set null,
  bottles_opened smallint not null default 0 check (bottles_opened >= 0),
  bottles_left_sealed smallint not null default 0 check (bottles_left_sealed >= 0),
  taste_score smallint check (taste_score between 1 and 5),
  packaging_score smallint check (packaging_score between 1 and 5),
  price_perception smallint check (price_perception between 1 and 5),
  customer_verbatim text,                      -- müşterinin birebir sözü
  verdict text check (verdict is null or verdict in ('listeye_alir','dusunur','almaz')),
  created_at timestamptz not null default now(),
  unique (visit_id, product_id)
);
create index if not exists vtast_visit_idx on visit_tastings(visit_id);
-- Tat sıralaması raporu
create index if not exists vtast_product_idx on visit_tastings(product_id, created_at desc);
-- GERİ ÇAĞIRMA: "şu parti hangi ziyaretlere gitti" — izlenebilirliğin kalbi
create index if not exists vtast_batch_idx on visit_tastings(batch_id) where batch_id is not null;

-- Ziyaret düzeyi tadım özeti (F04 alt blokları)
create table if not exists visit_tasting_summary (
  visit_id uuid primary key references visits(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  preferred_product_id uuid references products(id) on delete set null,
  preference_reason text,
  menu_match text,                             -- eşleşebilecek menü
  sample_purpose text,
  received_by text,                            -- teslim alan
  sample_approval_no text,                     -- numune onay no
  delivery_confirmed boolean not null default false,
  unused_disposition text                      -- kullanılmayan ürünün akıbeti
);
create index if not exists vtsum_pref_idx on visit_tasting_summary(preferred_product_id);

-- ------------------------------------------------------------
-- 5) SİPARİŞ — AYRI TABLO YOK
--    Ziyarette alınan sipariş, 0025'teki sales_orders kaydının
--    TA KENDİSİDİR. Ziyaret yalnızca ona bağlanır (visits.sales_order_id).
--
--    Neden: iki ayrı sipariş kaydı tutulsaydı (biri ziyarette, biri
--    sipariş belgesinde) aynı satış iki kez sayılır, hacim raporu
--    şişer ve hangisinin doğru olduğu belli olmazdı. Tek kayıt, tek
--    gerçek.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 6) FOTOĞRAFLAR (incident_photos deseni)
--    Yol: <company_id>/visits/<visit_id>/<dosya>
--    Ek depolama kuralı GEREKMEZ: 0002'deki "ilk klasör = şirket"
--    kuralı yeterli, çünkü ziyaret fotoğrafı şirket içi açık veridir
--    (olay fotoğrafı gibi admin-özel değil).
-- ------------------------------------------------------------
create table if not exists visit_photos (
  id uuid primary key default uuid_generate_v4(),
  visit_id uuid not null references visits(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  uploaded_by uuid not null references profiles(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  kind text check (kind is null or kind in ('raf','dolap','teshir','tadim','diger')),
  created_at timestamptz not null default now()
);
create index if not exists vphoto_visit_idx on visit_photos(visit_id, created_at);

-- ------------------------------------------------------------
-- 7) TAKİPLER — F03/F04'teki "Sonraki adım ve kontrol" bloğu
--    Modülün disiplin omurgası. Tek sorumlu + son tarih +
--    kontrol eden + kapanış kanıtı: işin gerçekten bitip bitmediğini
--    ölçen tek yapı bu.
-- ------------------------------------------------------------
create table if not exists follow_ups (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  source_type text not null check (source_type in ('visit','tasting','manual')),
  source_id uuid,
  outlet_id uuid references outlets(id) on delete cascade,
  action text not null,                        -- yapılacak işlem
  owner_user_id uuid not null references profiles(id) on delete cascade,  -- TEK sorumlu
  due_date date not null,
  verifier_user_id uuid references profiles(id) on delete set null,
  verified_at timestamptz,
  closure_evidence text,                       -- sonuç / kapanış kanıtı
  status text not null default 'acik' check (status in ('acik','kapandi','iptal')),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
-- Geciken takipler taraması (gecelik iş + panel)
create index if not exists fup_due_idx on follow_ups(company_id, status, due_date)
  where status = 'acik';
-- Kişinin takip listesi
create index if not exists fup_owner_idx on follow_ups(owner_user_id, status, due_date);
create index if not exists fup_outlet_idx on follow_ups(outlet_id, created_at desc);

-- ============================================================
-- 8) SKOR HESAPLAMA
--    Trigger ile, çünkü puanlar ÇOCUK SATIR olarak yazılıyor;
--    hesabı server action'a bırakırsak sıralama hatası (önce skor
--    sonra ziyaret güncelleme) sessizce yanlış skor üretir.
-- ============================================================
create or replace function fn_recalc_visit_score() returns trigger
language plpgsql security definer set search_path = public as $$
declare vid uuid; s numeric; c smallint;
begin
  vid := coalesce(new.visit_id, old.visit_id);
  select case when sum(weight_snapshot) > 0
              then round(sum(score * weight_snapshot)::numeric / sum(weight_snapshot), 2)
              else null end,
         count(*)
    into s, c
  from visit_scores where visit_id = vid;

  update visits set overall_score = s, score_count = coalesce(c,0) where id = vid;
  return null;
end $$;

drop trigger if exists trg_vscore_recalc on visit_scores;
create trigger trg_vscore_recalc
after insert or update or delete on visit_scores
for each row execute function fn_recalc_visit_score();

-- Nokta skoru = SON 3 gönderilmiş ziyaretin ortalaması.
-- Tek ziyaretle segment değiştirmemek için 3; "son" olduğu için
-- iyileşen nokta yukarı çıkar, bozulan aşağı iner.
create or replace function fn_recalc_outlet_score(oid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s numeric;
begin
  select round(avg(overall_score), 2) into s
  from (select overall_score from visits
        where outlet_id = oid and status in ('gonderildi','onaylandi')
          and overall_score is not null
        order by visit_date desc, created_at desc limit 3) q;

  update outlets set
    score = s,
    segment = case when s is null then null
                   when s >= 4.2 then 'A'
                   when s >= 3.4 then 'B'
                   else 'C' end
  where id = oid;
end $$;

create or replace function fn_visit_after_submit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('gonderildi','onaylandi')
     and (tg_op = 'INSERT' or old.status is distinct from new.status
          or old.overall_score is distinct from new.overall_score) then
    update outlets set last_visit_at = greatest(coalesce(last_visit_at, 'epoch'::timestamptz), new.created_at)
      where id = new.outlet_id;
    perform fn_recalc_outlet_score(new.outlet_id);
  end if;
  return null;
end $$;

drop trigger if exists trg_visit_after_submit on visits;
create trigger trg_visit_after_submit
after insert or update of status, overall_score on visits
for each row execute function fn_visit_after_submit();

-- ============================================================
-- 9) RLS
--    Temsilci kendi · müdür departmanı · admin hepsi
-- ============================================================
alter table route_plans           enable row level security;
alter table route_stops           enable row level security;
alter table visits                enable row level security;
alter table visit_scores          enable row level security;
alter table visit_tastings        enable row level security;
alter table visit_tasting_summary enable row level security;
alter table visit_photos          enable row level security;
alter table follow_ups            enable row level security;

-- Tek yerden tanımlanan görünürlük kuralı (politikalarda tekrar etmemek için)
create or replace function sales_can_see(owner uuid, dept uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_super_admin()
      or auth_role() = 'admin'
      or owner = auth.uid()
      or manages_department(dept)
$$;

-- --- ROTA ---
drop policy if exists rplan_select on route_plans;
create policy rplan_select on route_plans for select
  using (same_company(company_id) and sales_can_see(user_id, department_id));
drop policy if exists rplan_write on route_plans;
create policy rplan_write on route_plans for all
  using (same_company(company_id) and sales_can_see(user_id, department_id))
  with check (same_company(company_id) and (user_id = auth.uid() or auth_role() = 'admin' or is_super_admin()));

drop policy if exists rstop_all on route_stops;
create policy rstop_all on route_stops for all
  using (exists (select 1 from route_plans p where p.id = route_plan_id
                 and same_company(p.company_id) and sales_can_see(p.user_id, p.department_id)))
  with check (exists (select 1 from route_plans p where p.id = route_plan_id
                 and p.company_id = route_stops.company_id
                 and same_company(p.company_id) and sales_can_see(p.user_id, p.department_id)));

-- --- ZİYARETLER ---
drop policy if exists visits_select on visits;
create policy visits_select on visits for select
  using (same_company(company_id) and sales_can_see(user_id, department_id));

drop policy if exists visits_insert on visits;
create policy visits_insert on visits for insert
  with check (user_id = auth.uid() and same_company(company_id));

-- Gönderilmiş ziyareti temsilci DÜZELTEMEZ; yalnızca müdür/admin.
-- Gerekçe: gönderim bir beyandır, sonradan sessizce değiştirilememeli.
drop policy if exists visits_update on visits;
create policy visits_update on visits for update
  using (
    same_company(company_id) and (
      is_super_admin() or auth_role() = 'admin'
      or manages_department(department_id)
      or (user_id = auth.uid() and status = 'taslak')
    )
  );

drop policy if exists visits_delete on visits;
create policy visits_delete on visits for delete
  using (same_company(company_id) and (
    is_super_admin() or auth_role() = 'admin'
    or (user_id = auth.uid() and status = 'taslak')));

-- --- ZİYARETİN ÇOCUKLARI: üst kaydın kuralını miras alır ---
do $$
declare t text;
begin
  foreach t in array array['visit_scores','visit_tastings','visit_tasting_summary',
                           'visit_photos'] loop
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format(
      'create policy %I on public.%I for all using (exists ('
      || '  select 1 from visits v where v.id = %I.visit_id'
      || '    and same_company(v.company_id) and sales_can_see(v.user_id, v.department_id)))'
      || ' with check (exists ('
      || '  select 1 from visits v where v.id = %I.visit_id'
      || '    and same_company(v.company_id) and ('
      || '      is_super_admin() or auth_role() = ''admin'''
      || '      or manages_department(v.department_id)'
      || '      or (v.user_id = auth.uid() and v.status = ''taslak''))))',
      t || '_all', t, t, t);
  end loop;
end $$;

-- Fotoğraf yolu zorlaması: doğrudan API'den başka ziyarete fotoğraf iliştirilemez
drop policy if exists vphoto_path_guard on visit_photos;
create policy vphoto_path_guard on visit_photos as restrictive for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and storage_path like company_id::text || '/visits/' || visit_id::text || '/%'
);

-- --- TAKİPLER ---
drop policy if exists fup_select on follow_ups;
create policy fup_select on follow_ups for select
  using (same_company(company_id) and (
    sales_can_see(owner_user_id, department_id)
    or verifier_user_id = auth.uid() or created_by = auth.uid()));
drop policy if exists fup_write on follow_ups;
create policy fup_write on follow_ups for all
  using (same_company(company_id) and (
    is_super_admin() or auth_role() = 'admin'
    or manages_department(department_id)
    or owner_user_id = auth.uid() or created_by = auth.uid()))
  with check (same_company(company_id));

-- ============================================================
-- 10) MÜŞTERİ KİLİDİ
-- ============================================================
do $$
declare t text; pol text;
begin
  foreach t in array array['route_plans','route_stops','visits','visit_scores',
                           'visit_tastings','visit_tasting_summary',
                           'visit_photos','follow_ups'] loop
    pol := 'lole_cust_block_' || t;
    execute format('drop policy if exists %I on public.%I', pol, t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated '
      || 'using ((select not auth_is_customer())) with check ((select not auth_is_customer()))',
      pol, t);
  end loop;
end $$;
