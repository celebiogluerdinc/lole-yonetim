-- ============================================================
-- 0027 — NOKTA BAZLI FİYAT · ORTAK 1–5 ÖLÇEĞİ · NUMUNE TÜKETİMİ
--
-- Supabase SQL Editor'e TEK PARÇA yapıştırılır. Tekrar çalıştırılabilir.
-- Önce 0022–0026 çalıştırılmış olmalı.
--
-- Üç karar:
--   1) Fiyat her nokta için ayrı anlaşılabilir → nokta bazlı fiyat tablosu.
--      Liste fiyatı taban kalır, anlaşma varsa o geçerli olur.
--   2) Puanlama tek ölçeğe iniyor: HER YERDE 1–5. F02'nin 0–2 ölçeği
--      kaldırıldı; iki ölçek eğitimi ve raporu gereksiz yere zorlaştırıyordu.
--   3) Numune zimmeti yok. Yalnızca "toplamda ne verilmiş" sorusu
--      cevaplanacak → tek bir görünüm yeterli, yeni tablo gerekmiyor.
-- ============================================================

-- ------------------------------------------------------------
-- 1) NOKTA BAZLI ANLAŞILAN FİYAT
--    Fiyat çözümleme sırası:
--      a) noktayla anlaşılan geçerli fiyat
--      b) yoksa aktif fiyat listesi
--      c) o da yoksa fiyat yok (teklif ekranı uyarır)
--    Tarihli tutuluyor: eski teklifin hangi fiyatla yapıldığı
--    sonradan değişmesin.
-- ------------------------------------------------------------
create table if not exists outlet_prices (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  unit_price numeric(12,2) not null check (unit_price >= 0),   -- KDV hariç, şişe
  valid_from date not null default current_date,
  valid_to date,
  agreed_by uuid references profiles(id) on delete set null,
  agreed_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now(),
  constraint oprice_range_chk check (valid_to is null or valid_to >= valid_from),
  unique (outlet_id, product_id, valid_from)
);
create index if not exists oprice_lookup_idx
  on outlet_prices(outlet_id, product_id, valid_from desc);
create index if not exists oprice_company_idx
  on outlet_prices(company_id, created_at desc);

/**
 * Bir noktanın bir ürün için geçerli fiyatı.
 * Önce noktayla anlaşılan fiyata, yoksa aktif liste fiyatına bakar.
 */
create or replace function fn_price_for(oid uuid, pid uuid, on_date date default current_date)
returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select op.unit_price from outlet_prices op
      where op.outlet_id = oid and op.product_id = pid
        and op.valid_from <= on_date
        and (op.valid_to is null or op.valid_to >= on_date)
      order by op.valid_from desc limit 1),
    (select pli.unit_price
       from price_list_items pli
       join price_lists pl on pl.id = pli.price_list_id
       join outlets o on o.id = oid
      where pli.product_id = pid
        and pl.company_id = o.company_id
        and pl.is_active
        and pl.valid_from <= on_date
        and (pl.valid_to is null or pl.valid_to >= on_date)
      order by pl.valid_from desc limit 1)
  )
$$;

alter table outlet_prices enable row level security;

drop policy if exists oprice_select on outlet_prices;
create policy oprice_select on outlet_prices for select
  using (same_company(company_id));

-- Fiyat anlaşması ticari bir taahhüttür: temsilci teklif hazırlar,
-- fiyatı müdür veya yönetici sabitler.
drop policy if exists oprice_write on outlet_prices;
create policy oprice_write on outlet_prices for all
  using (same_company(company_id) and (
    is_super_admin() or auth_role() = 'admin'
    or exists (select 1 from outlets o
               where o.id = outlet_id and manages_department(o.department_id))))
  with check (same_company(company_id) and (
    is_super_admin() or auth_role() = 'admin'
    or exists (select 1 from outlets o
               where o.id = outlet_id and manages_department(o.department_id))));

do $$
declare pol text := 'lole_cust_block_outlet_prices';
begin
  execute format('drop policy if exists %I on public.outlet_prices', pol);
  execute format(
    'create policy %I on public.outlet_prices as restrictive for all to authenticated '
    || 'using ((select not auth_is_customer())) with check ((select not auth_is_customer()))', pol);
end $$;

-- ------------------------------------------------------------
-- 2) TEK PUANLAMA ÖLÇEĞİ: 1–5
--    F02 artık 0–2 değil 1–5. Beş kriter × 5 = 25 üzerinden.
--    A/B/C eşikleri YÜZDE olarak korunuyor, yani anlamları değişmiyor:
--      A ≥%80  →  21–25
--      B ≥%50  →  15–20
--      C <%50  →   5–14
-- ------------------------------------------------------------
update score_criteria
   set scale_min = 1, scale_max = 5
 where form_code = 'F02' and (scale_min <> 1 or scale_max <> 5);

/**
 * Değerlendirme toplamı.
 *
 * Yüzde hesabı ölçeğin TABANINI dikkate alır:
 *     (toplam − taban) / (tavan − taban)
 * 1–5 ölçeğinde hepsine 1 vermek %0 eder, hepsine 5 vermek %100.
 * Ham toplam/tavan kullanılsaydı (5/25) en kötü değerlendirme %20
 * görünür ve eşikler kayardı.
 *
 * Yanıtlanmayan kriter paydaya GİRMEZ: bilgi eksikliği puanı düşürmemeli.
 */
create or replace function fn_recalc_assessment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  aid uuid; rt int; mt int; mn int; ac int; cc int; pct numeric;
begin
  aid := coalesce(new.assessment_id, old.assessment_id);

  select coalesce(sum(s.score), 0),
         coalesce(sum(case when s.score is not null then c.scale_max else 0 end), 0),
         coalesce(sum(case when s.score is not null then c.scale_min else 0 end), 0),
         count(*) filter (where s.score is not null),
         count(*)
    into rt, mt, mn, ac, cc
  from outlet_assessment_scores s
  join score_criteria c on c.id = s.criterion_id
  where s.assessment_id = aid;

  pct := case when (mt - mn) > 0
              then round(100.0 * (rt - mn) / (mt - mn), 2)
              else null end;

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

-- Mevcut değerlendirmeleri yeni formülle tazele
do $$
declare a record;
begin
  for a in select id from outlet_assessments loop
    update outlet_assessment_scores set score = score where assessment_id = a.id;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 3) NUMUNE TÜKETİMİ — zimmet yok, yalnızca "toplamda ne verilmiş"
--    visit_tastings zaten her şeyi tutuyor; tek ihtiyaç toplamı
--    kolay okunur hale getirmek. Yeni tablo açmak, tutulmayacak bir
--    zimmet defteri yaratmak olurdu.
-- ------------------------------------------------------------
create or replace view v_sample_usage as
select
  v.company_id,
  date_trunc('month', v.visit_date)::date       as period,
  t.product_id,
  p.name                                        as product_name,
  v.user_id,
  count(distinct v.id)                          as tasting_visits,
  count(distinct v.outlet_id)                   as outlets_reached,
  coalesce(sum(t.bottles_opened), 0)            as bottles_opened,
  coalesce(sum(t.bottles_left_sealed), 0)       as bottles_left,
  coalesce(sum(t.bottles_opened + t.bottles_left_sealed), 0) as bottles_total
from visit_tastings t
join visits v   on v.id = t.visit_id
join products p on p.id = t.product_id
where v.status <> 'taslak'
group by v.company_id, date_trunc('month', v.visit_date), t.product_id, p.name, v.user_id;

comment on view v_sample_usage is
  'Numune tüketimi özeti: ürün × ay × temsilci bazında dağıtılan şişe. Zimmet takibi yoktur.';
