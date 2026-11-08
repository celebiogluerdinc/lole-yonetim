-- ============================================================
-- 0024 — SAHA SATIŞ / F02 ADAY NOKTA DEĞERLENDİRMESİ
-- Supabase SQL Editor'e TEK PARÇA yapıştırılır. Tekrar çalıştırılabilir.
--
-- NEDEN AYRI BİR MİGRATION:
-- F02 formu (Aday satış noktası değerlendirmesi) 0022/0023 yazıldıktan
-- sonra incelendi ve puanlama tasarımını üç yerde değiştirdi:
--
--   1) F02 ölçeği 0–2 (uygun değil / kısmen / uygun), 1–5 değil.
--      "bilinmiyor ise boş bırak" kuralı var — yani NULL anlamlı.
--   2) F02 her puanın yanında "Gözlem / kanıt" istiyor. Puanı
--      gerekçelendirme disiplini mevcut sistemde yoktu.
--   3) F02 "ilk temas ÖNCESİ veya sonrasında" doldurulabiliyor —
--      yani ziyarete bağlı olmayabilir. visit_scores'a sığmaz;
--      değerlendirme NOKTAYA ait bir olaydır.
--
-- Ayrıca LOTE'nin kendi A/B/C eşiği bu formda tanımlı:
--   Toplam /10 → A 8-10 · B 5-7 · C 0-4   (yani %80 / %50 / altı)
-- 0023'teki eşikler (A ≥4.2, B ≥3.4 üzerinden) buna hizalandı.
-- A eşiği zaten birebir aynıydı: 4.2/5 = %80 = 8/10.
--
-- Bu betik yalnızca EKLER. 0022/0023 çalıştırılmış olsa da olmasa da
-- güvenle çalışır; mevcut veri bozulmaz.
-- ============================================================

-- ------------------------------------------------------------
-- 1) PUANLAMA KRİTERLERİ: ölçek ve form bilgisi
--    Varsayılanlar mevcut 14 kriteri olduğu gibi geçerli bırakır
--    (F03 formu, 1–5 ölçeği).
-- ------------------------------------------------------------
alter table score_criteria add column if not exists form_code text not null default 'F03';
alter table score_criteria add column if not exists scale_min smallint not null default 1;
alter table score_criteria add column if not exists scale_max smallint not null default 5;

do $$ begin
  alter table score_criteria add constraint score_criteria_form_chk
    check (form_code in ('F02','F03'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table score_criteria add constraint score_criteria_scale_chk
    check (scale_max > scale_min);
exception when duplicate_object then null; end $$;

-- F02 kriterleri 'potansiyel' grubunda değil, kendi grubunda dursun
do $$ begin
  alter table score_criteria drop constraint score_criteria_grp_check;
exception when undefined_object then null; end $$;
do $$ begin
  alter table score_criteria add constraint score_criteria_grp_check
    check (grp in ('potansiyel','gorusme','icra','genel','aday'));
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- 2) ZİYARET PUANLARINA DA KANIT ALANI
--    F02'nin "Gözlem / kanıt" disiplini iyi; ziyaret puanlarında da
--    opsiyonel olarak bulunsun.
-- ------------------------------------------------------------
alter table visit_scores add column if not exists evidence text;

-- ------------------------------------------------------------
-- 3) İLETİŞİM: UYGUN GÖRÜŞME SAATİ
--    F02'deki "İletişim / uygun görüşme saati" alanı. Bir sonraki
--    ziyaretin doğru saatte yapılmasını sağlayan tek veri bu —
--    "karar verici yoktu" itirazının en büyük panzehiri.
-- ------------------------------------------------------------
alter table outlets          add column if not exists preferred_contact_time text;
alter table outlet_contacts  add column if not exists preferred_contact_time text;

-- ------------------------------------------------------------
-- 4) HIZLI TİP SEÇİMİ
--    F02 sahada yalnızca 5 kutucuk sunuyor: Restoran · Kafe ·
--    Benzinlik · Zincir · Diğer. Tam taksonomi (21 tip) raporlama
--    için kalır, formda önce bu beşi büyük buton olarak çıkar.
-- ------------------------------------------------------------
alter table outlet_types add column if not exists is_quick_pick boolean not null default false;

update outlet_types set is_quick_pick = true
where is_quick_pick = false
  and name in ('Restoran','Kafe','Akaryakıt İstasyonu','Zincir Market','Diğer');

-- ------------------------------------------------------------
-- 5) ADAY NOKTA DEĞERLENDİRMESİ (F02)
--    Ziyarete DEĞİL noktaya bağlıdır; visit_id opsiyoneldir.
--    Aynı nokta bilgi arttıkça yeniden değerlendirilebilir,
--    bu yüzden tarihçe tutulur.
-- ------------------------------------------------------------
create table if not exists outlet_assessments (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  outlet_id uuid not null references outlets(id) on delete cascade,
  visit_id uuid references visits(id) on delete set null,   -- ilk temas sonrası doldurulduysa
  assessed_by uuid not null references profiles(id) on delete cascade,
  assessed_at timestamptz not null default now(),
  -- F02 başlık alanları
  contact_name text,                      -- Yetkili / rol
  contact_role text,
  contact_info text,                      -- İletişim
  preferred_contact_time text,            -- uygun görüşme saati
  customer_profile text,                  -- Müşteri profili / mevcut içecekler / ihtiyaç
  -- hesaplanan (trigger doldurur)
  raw_total smallint not null default 0,          -- yanıtlanan kriterlerin toplamı
  max_total smallint not null default 0,          -- yanıtlanan kriter sayısı × scale_max
  answered_count smallint not null default 0,
  criteria_count smallint not null default 0,
  score_pct numeric(5,2),                         -- raw_total / max_total × 100
  priority char(1) check (priority is null or priority in ('A','B','C')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists oassess_outlet_idx on outlet_assessments(outlet_id, assessed_at desc);
create index if not exists oassess_company_idx on outlet_assessments(company_id, assessed_at desc);
create index if not exists oassess_visit_idx on outlet_assessments(visit_id) where visit_id is not null;

-- Puan satırları. score NULL = "bilinmiyor" (F02: boş bırak).
-- Satırın var olup score'un NULL olması, kriterin hiç sorulmamasından farklıdır:
-- biri "bakıldı, bilinmiyor", diğeri "hiç bakılmadı".
create table if not exists outlet_assessment_scores (
  assessment_id uuid not null references outlet_assessments(id) on delete cascade,
  criterion_id uuid not null references score_criteria(id) on delete cascade,
  score smallint check (score is null or score between 0 and 5),
  evidence text,                                   -- F02: "Gözlem / kanıt"
  primary key (assessment_id, criterion_id)
);
create index if not exists oascore_criterion_idx on outlet_assessment_scores(criterion_id);

-- ------------------------------------------------------------
-- 6) DEĞERLENDİRME TOPLAMI — trigger
--    Yanıtlanmayan kriter paydaya GİRMEZ. 5 kriterden 3'ü
--    yanıtlandıysa toplam 6 üzerinden hesaplanır, 10 üzerinden değil;
--    yoksa bilgi eksikliği düşük puan gibi görünür ve nokta haksız
--    yere C segmentine düşer.
-- ------------------------------------------------------------
create or replace function fn_recalc_assessment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  aid uuid; rt int; mt int; ac int; cc int; pct numeric;
begin
  aid := coalesce(new.assessment_id, old.assessment_id);

  select coalesce(sum(s.score), 0),
         coalesce(sum(case when s.score is not null then c.scale_max else 0 end), 0),
         count(*) filter (where s.score is not null),
         count(*)
    into rt, mt, ac, cc
  from outlet_assessment_scores s
  join score_criteria c on c.id = s.criterion_id
  where s.assessment_id = aid;

  pct := case when mt > 0 then round(100.0 * rt / mt, 2) else null end;

  update outlet_assessments set
    raw_total = rt, max_total = mt,
    answered_count = ac, criteria_count = cc,
    score_pct = pct,
    priority = case when pct is null then null
                    when pct >= 80 then 'A'
                    when pct >= 50 then 'B'
                    else 'C' end
  where id = aid;
  return null;
end $$;

drop trigger if exists trg_assessment_recalc on outlet_assessment_scores;
create trigger trg_assessment_recalc
after insert or update or delete on outlet_assessment_scores
for each row execute function fn_recalc_assessment();

-- ------------------------------------------------------------
-- 7) NOKTA SKORU — birleşik hesap
--    Aday nokta  → en son F02 değerlendirmesinin yüzdesi
--    Aktif/pasif → son 3 gönderilmiş ziyaretin ağırlıklı ortalaması
--    İki ölçek de YÜZDEYE çevrilip aynı eşikten geçer:
--        A ≥%80 · B %50–79 · C <%50     (F02'deki 8-10 / 5-7 / 0-4)
--    1–5 ölçeği yüzdeye: (ort − 1) / 4 × 100
-- ------------------------------------------------------------
create or replace function fn_recalc_outlet_score(oid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  st text; avg5 numeric; pct numeric;
begin
  select status into st from outlets where id = oid;

  -- Ziyaret tabanlı skor (son 3 gönderilmiş ziyaret)
  select round(avg(overall_score), 2) into avg5
  from (select overall_score from visits
        where outlet_id = oid and status in ('gonderildi','onaylandi')
          and overall_score is not null
        order by visit_date desc, created_at desc limit 3) q;

  if st = 'aday' then
    -- Adayda F02 esastır; yoksa ziyaret puanına düşer
    select a.score_pct into pct
    from outlet_assessments a
    where a.outlet_id = oid and a.score_pct is not null
    order by a.assessed_at desc limit 1;

    if pct is null and avg5 is not null then
      pct := round((avg5 - 1) / 4.0 * 100, 2);
    end if;
  else
    if avg5 is not null then
      pct := round((avg5 - 1) / 4.0 * 100, 2);
    else
      select a.score_pct into pct
      from outlet_assessments a
      where a.outlet_id = oid and a.score_pct is not null
      order by a.assessed_at desc limit 1;
    end if;
  end if;

  update outlets set
    score = avg5,
    score_pct = pct,
    segment = case when pct is null then null
                   when pct >= 80 then 'A'
                   when pct >= 50 then 'B'
                   else 'C' end
  where id = oid;
end $$;

alter table outlets add column if not exists score_pct numeric(5,2);

-- Değerlendirme değişince nokta skoru da tazelensin
create or replace function fn_assessment_after_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform fn_recalc_outlet_score(coalesce(new.outlet_id, old.outlet_id));
  return null;
end $$;

drop trigger if exists trg_assessment_outlet on outlet_assessments;
create trigger trg_assessment_outlet
after insert or update of score_pct or delete on outlet_assessments
for each row execute function fn_assessment_after_change();

-- ------------------------------------------------------------
-- 8) RLS
-- ------------------------------------------------------------
alter table outlet_assessments       enable row level security;
alter table outlet_assessment_scores enable row level security;

drop policy if exists oassess_select on outlet_assessments;
create policy oassess_select on outlet_assessments for select
  using (same_company(company_id) and sales_can_see(assessed_by, department_id));

drop policy if exists oassess_insert on outlet_assessments;
create policy oassess_insert on outlet_assessments for insert
  with check (assessed_by = auth.uid() and same_company(company_id));

drop policy if exists oassess_update on outlet_assessments;
create policy oassess_update on outlet_assessments for update
  using (same_company(company_id) and (
    is_super_admin() or auth_role() = 'admin'
    or manages_department(department_id) or assessed_by = auth.uid()));

drop policy if exists oassess_delete on outlet_assessments;
create policy oassess_delete on outlet_assessments for delete
  using (same_company(company_id) and (
    is_super_admin() or auth_role() = 'admin' or manages_department(department_id)));

drop policy if exists oascore_all on outlet_assessment_scores;
create policy oascore_all on outlet_assessment_scores for all
  using (exists (select 1 from outlet_assessments a where a.id = assessment_id
                 and same_company(a.company_id) and sales_can_see(a.assessed_by, a.department_id)))
  with check (exists (select 1 from outlet_assessments a where a.id = assessment_id
                 and same_company(a.company_id) and sales_can_see(a.assessed_by, a.department_id)));

-- Sipariş hattı müşterilerini kilitle (0018 deseni)
do $$
declare t text; pol text;
begin
  foreach t in array array['outlet_assessments','outlet_assessment_scores'] loop
    pol := 'lole_cust_block_' || t;
    execute format('drop policy if exists %I on public.%I', pol, t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated '
      || 'using ((select not auth_is_customer())) with check ((select not auth_is_customer()))',
      pol, t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 9) F02 KRİTERLERİ (0–2 ölçeği)
--    Formdaki beş satır, birebir ve aynı sırada.
-- ------------------------------------------------------------
create or replace function fn_seed_f02_criteria(cid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into score_criteria
    (company_id, grp, label, weight, applies_to, sort_order, form_code, scale_min, scale_max)
  values
    (cid,'aday','Müşteri / tat uyumu',       1,'aday',1010,'F02',0,2),
    (cid,'aday','Soğuk servis imkânı',       1,'aday',1020,'F02',0,2),
    (cid,'aday','Karar vericiye erişim (aday)',1,'aday',1030,'F02',0,2),
    (cid,'aday','Görünürlük alanı',          1,'aday',1040,'F02',0,2),
    (cid,'aday','Ödeme / teslimat uyumu',    1,'aday',1050,'F02',0,2)
  on conflict (company_id, label) do nothing;
end $$;

do $$
declare c record;
begin
  for c in select id from companies where coalesce(kind,'internal') = 'internal' loop
    perform fn_seed_f02_criteria(c.id);
  end loop;
end $$;

-- Yeni şirket açıldığında da kurulsun: ana seed fonksiyonuna bağla
create or replace function fn_seed_sales_all(cid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform fn_seed_sales_defaults(cid);
  perform fn_seed_f02_criteria(cid);
  update outlet_types set is_quick_pick = true
   where company_id = cid
     and name in ('Restoran','Kafe','Akaryakıt İstasyonu','Zincir Market','Diğer');
end $$;

-- ------------------------------------------------------------
-- 10) DEPARTMAN OTOMATİK DOLDURMA  ⚠ ÖNEMLİ
--     Görünürlük kuralı sales_can_see(sahip, departman) üzerinden
--     çalışıyor. Kayıt departman_id'siz yazılırsa müdür KENDİ
--     EKİBİNİN kaydını göremez — sessiz ve fark edilmesi zor bir hata.
--     Bu testte bizzat yakalandı. Uygulama katmanına güvenmek yerine
--     veritabanı garantiye alıyor: boşsa noktanın departmanından,
--     o da boşsa kullanıcının ilk departmanından doldurulur.
-- ------------------------------------------------------------
create or replace function fn_fill_department() returns trigger
language plpgsql security definer set search_path = public as $$
declare d uuid; uid uuid;
begin
  if new.department_id is not null then return new; end if;

  if to_jsonb(new) ? 'outlet_id' and (to_jsonb(new)->>'outlet_id') is not null then
    select department_id into d from outlets where id = (to_jsonb(new)->>'outlet_id')::uuid;
  end if;

  if d is null then
    uid := coalesce((to_jsonb(new)->>'user_id')::uuid,
                    (to_jsonb(new)->>'assessed_by')::uuid);
    if uid is not null then
      select dm.department_id into d
      from department_members dm
      join departments dp on dp.id = dm.department_id
      where dm.user_id = uid
      order by dm.is_manager desc, dp.name
      limit 1;
    end if;
  end if;

  new.department_id := d;
  return new;
end $$;

drop trigger if exists trg_visits_dept on visits;
create trigger trg_visits_dept before insert or update of outlet_id on visits
for each row execute function fn_fill_department();

drop trigger if exists trg_assess_dept on outlet_assessments;
create trigger trg_assess_dept before insert or update of outlet_id on outlet_assessments
for each row execute function fn_fill_department();

drop trigger if exists trg_rplan_dept on route_plans;
create trigger trg_rplan_dept before insert on route_plans
for each row execute function fn_fill_department();

drop trigger if exists trg_fup_dept on follow_ups;
create trigger trg_fup_dept before insert on follow_ups
for each row execute function fn_fill_department();

-- Geçmişte departmansız yazılmış kayıtları da topla
update visits v set department_id = o.department_id
  from outlets o where o.id = v.outlet_id
   and v.department_id is null and o.department_id is not null;
update outlet_assessments a set department_id = o.department_id
  from outlets o where o.id = a.outlet_id
   and a.department_id is null and o.department_id is not null;
update follow_ups f set department_id = o.department_id
  from outlets o where o.id = f.outlet_id
   and f.department_id is null and o.department_id is not null;

-- ------------------------------------------------------------
-- 11) MEVCUT NOKTALARIN SKORUNU TAZELE
-- ------------------------------------------------------------
do $$
declare o record;
begin
  for o in select id from outlets loop
    perform fn_recalc_outlet_score(o.id);
  end loop;
end $$;
