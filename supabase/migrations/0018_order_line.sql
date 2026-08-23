-- ============================================================
-- 0018 — LOLE SİPARİŞ HATTI (Order Line)
-- Supabase SQL Editor'e TEK PARÇA yapıştırılır. Tekrar tekrar çalıştırılabilir.
--
-- GERİYE DÖNÜK UYUM GARANTİSİ:
--   • user_role ENUM'una DOKUNULMAZ.
--   • Mevcut hiçbir politika DROP edilmez; yalnızca YENİ "restrictive"
--     politikalar eklenir ve hepsi "not auth_is_customer()" ile başlar.
--     Mevcut tüm kullanıcılarda is_customer=false olduğundan bu koşul
--     daima TRUE'dur → Lole Fabrika / Restaurant / Patisserie / Pazarlama
--     davranışı BİREBİR aynı kalır.
--   • companies.kind varsayılanı 'internal', profiles.is_customer varsayılanı false.
-- ============================================================

-- ------------------------------------------------------------
-- 1) ŞİRKET TÜRÜ: normal şirket mi, sipariş hattı mı
-- ------------------------------------------------------------
alter table companies add column if not exists kind text not null default 'internal';
alter table companies drop constraint if exists companies_kind_check;
alter table companies add constraint companies_kind_check
  check (kind in ('internal','order_line'));
create index if not exists companies_kind_idx on companies(kind);

-- ------------------------------------------------------------
-- 2) MÜŞTERİ HESABI (ENUM'a dokunmadan)
--    müşteri = role 'staff' + is_customer true
--    customer_account_id: aynı müşteri firmasından 2. kullanıcı için gruplama
-- ------------------------------------------------------------
alter table profiles add column if not exists is_customer boolean not null default false;
alter table profiles add column if not exists customer_name text;
alter table profiles add column if not exists customer_account_id uuid references profiles(id) on delete set null;
create index if not exists profiles_customer_idx on profiles(company_id) where is_customer;

-- ------------------------------------------------------------
-- 3) YARDIMCI FONKSİYONLAR (SECURITY DEFINER — RLS özyinelemesi olmasın)
--    DİKKAT: fonksiyon adı bilerek auth_is_customer() seçildi;
--    profiles tablosunda "is_customer" adında bir SÜTUN olduğu için
--    is_customer() adı politikalarda karışıklık yaratırdı.
-- ------------------------------------------------------------
create or replace function auth_is_customer() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select p.is_customer from profiles p where p.id = auth.uid()), false) $$;

create or replace function customer_account_of(uid uuid) returns uuid
language sql stable security definer set search_path = public as
$$ select coalesce(p.customer_account_id, p.id) from profiles p where p.id = uid $$;

create or replace function is_order_line(cid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select c.kind from companies c where c.id = cid) = 'order_line', false) $$;

-- "bu kullanıcı müşteri DEĞİL mi?" — politika içinde profiles'a doğrudan alt sorgu
-- atmamak için (alt sorgular profiles'ın kendi RLS'ine takılabilir).
create or replace function is_staff_profile(uid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select not coalesce(p.is_customer, false) from profiles p where p.id = uid), false) $$;

-- ------------------------------------------------------------
-- 3.b) KİMLİK KİLİDİ (KRİTİK GÜVENLİK)
--   Mevcut profiles_self_update kuralı kullanıcının kendi profilini
--   güncellemesine izin verir ve yalnızca "role" alanını sabitler.
--   Bu kilit olmadan bir müşteri kendi satırında is_customer'ı false yapıp
--   tüm izolasyon katmanını kapatabilir ya da company_id'sini bir grup
--   şirketine çevirip o şirketin verisini okuyabilirdi.
--   Yönetim işlemleri servis anahtarıyla (supabaseAdmin) yapıldığı için
--   bu kilitten etkilenmez.
-- ------------------------------------------------------------
create or replace function profile_identity_ok(pid uuid, cid uuid, cust boolean, acct uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_super_admin() or exists (
    select 1 from profiles p
    where p.id = pid
      and p.company_id is not distinct from cid
      and coalesce(p.is_customer, false) = coalesce(cust, false)
      and p.customer_account_id is not distinct from acct
  )
$$;

drop policy if exists lole_profile_identity_lock on profiles;
create policy lole_profile_identity_lock on profiles as restrictive for update to authenticated
using (true)
with check (profile_identity_ok(id, company_id, is_customer, customer_account_id));

-- ------------------------------------------------------------
-- 4) SİPARİŞ ALANLARI + SİPARİŞ NUMARASI
--    order_no yalnızca sipariş hattında dolar; iç şirketlerde NULL kalır.
-- ------------------------------------------------------------
alter table purchase_requests add column if not exists order_no bigint;
alter table purchase_requests add column if not exists needed_at date;
alter table purchase_requests add column if not exists delivery_address text;

create unique index if not exists preq_order_no_uidx
  on purchase_requests(company_id, order_no) where order_no is not null;
create index if not exists preq_requester_idx
  on purchase_requests(company_id, requester_id, created_at desc);

create table if not exists company_counters (
  company_id uuid primary key references companies(id) on delete cascade,
  order_seq bigint not null default 0
);
alter table company_counters enable row level security;
drop policy if exists company_counters_select on company_counters;
create policy company_counters_select on company_counters for select
  using (is_super_admin());

-- sayaç: satır kilidi sayesinde iki müşteri aynı anda sipariş verse bile
-- aynı numara ikinci kez üretilemez (yarış koruması)
create or replace function fn_assign_order_no() returns trigger
language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  if new.order_no is not null then return new; end if;
  if not is_order_line(new.company_id) then return new; end if;
  insert into company_counters (company_id, order_seq) values (new.company_id, 1)
  on conflict (company_id) do update set order_seq = company_counters.order_seq + 1
  returning order_seq into n;
  new.order_no := n;
  return new;
end $$;

drop trigger if exists trg_preq_order_no on purchase_requests;
create trigger trg_preq_order_no before insert on purchase_requests
for each row execute function fn_assign_order_no();

-- sipariş numarası yalnızca trigger tarafından yazılır; kullanıcı değiştiremez
do $$
begin
  execute 'revoke update (order_no) on purchase_requests from authenticated';
exception when others then
  raise notice 'order_no yazma yetkisi kaldirilamadi: %', sqlerrm;
end $$;

-- ------------------------------------------------------------
-- 5) SİPARİŞ HATTINDA HAZIR DEPARTMAN AÇILMASIN
--    (iç şirketler için davranış aynen korunur)
-- ------------------------------------------------------------
create or replace function fn_create_preset_departments() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'order_line' then return new; end if;
  insert into departments (company_id, name, is_preset) values
    (new.id, 'Operasyon', true),
    (new.id, 'Satış', true),
    (new.id, 'Üretim', true),
    (new.id, 'Yönetim', true);
  return new;
end $$;

-- ============================================================
-- 6) MÜŞTERİ İZOLASYONU — RESTRICTIVE KATMAN
--    Restrictive politikalar mevcut politikalarla VE'lenir.
--    Personel/yönetici için hepsi TRUE döner → hiçbir davranış değişmez.
-- ============================================================

-- 6.a) Müşteriye TAMAMEN kapalı modüller (görev, vardiya, mesai, ödeme,
--      departman, dosya, olay, toplantı, yapay zekâ, kayıt defteri...)
do $$
declare t text; pol text;
begin
  foreach t in array array[
    'tasks','task_assignees','checklist_items','comments',
    'templates','template_items',
    'shifts','leave_requests','time_entries',
    'payment_requests','payment_templates',
    'departments','department_members','activity_log',
    'ai_reports','ai_threads','ai_messages','ai_agent_runs','ai_settings',
    'documents','notes',
    'announcement_comments',
    'incidents','incident_actions',
    'meetings','meeting_participants','meeting_notes'
  ] loop
    if to_regclass('public.' || t) is not null then
      pol := 'lole_cust_block_' || t;
      execute format('drop policy if exists %I on public.%I', pol, t);
      -- (select ...) sarmalı: fonksiyon satır başına değil, sorgu başına bir kez
      -- çalışır — mevcut şirketlerde performans kaybı olmaz.
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated '
        || 'using ((select not auth_is_customer())) with check ((select not auth_is_customer()))',
        pol, t);
    end if;
  end loop;
end $$;

-- EKLER (attachments): müşteri görev/belge eklerine erişemez, ancak
-- kendi sohbetindeki mesaj eklerini görebilir ve gönderebilir.
drop policy if exists lole_cust_block_attachments on attachments;
create policy lole_cust_block_attachments on attachments as restrictive for all to authenticated
using (
  (select not auth_is_customer())
  or (message_id is not null and exists (
        select 1 from messages m
        where m.id = attachments.message_id and is_conversation_member(m.conversation_id)))
)
with check (
  (select not auth_is_customer())
  or (message_id is not null and task_id is null and checklist_item_id is null and exists (
        select 1 from messages m
        where m.id = attachments.message_id and is_conversation_member(m.conversation_id)))
);

-- 6.b) PROFİLLER — müşteri, DİĞER MÜŞTERİLERİ göremez.
--      Kendisini, kendi firmasının hesaplarını ve hattın PERSONEL
--      profillerini görür (mesajlaşmada ad gösterimi için şart).
drop policy if exists lole_cust_profiles_select on profiles;
create policy lole_cust_profiles_select on profiles as restrictive for select to authenticated
using (
  (select not auth_is_customer())
  or id = auth.uid()
  or customer_account_of(id) = (select customer_account_of(auth.uid()))
  or coalesce(is_customer, false) = false   -- personel profilleri (mesajlaşmada ad gösterimi)
);

-- 6.c) SİPARİŞLER — müşteri yalnızca kendi (firmasının) siparişlerini görür
drop policy if exists lole_cust_preq_select on purchase_requests;
create policy lole_cust_preq_select on purchase_requests as restrictive for select to authenticated
using (
  (select not auth_is_customer())
  or customer_account_of(requester_id) = (select customer_account_of(auth.uid()))
);

-- müşteri yalnız SİPARİŞ HATTI şirketine ve kendi adına sipariş açabilir
drop policy if exists lole_cust_preq_insert on purchase_requests;
create policy lole_cust_preq_insert on purchase_requests as restrictive for insert to authenticated
with check (
  (select not auth_is_customer())
  or (requester_id = auth.uid() and is_order_line(company_id))
);

-- müşteri ASLA onaylayamaz/tamamlayamaz; yalnız kendi bekleyen siparişini iptal eder
drop policy if exists lole_cust_preq_update on purchase_requests;
create policy lole_cust_preq_update on purchase_requests as restrictive for update to authenticated
using (
  (select not auth_is_customer())
  or (requester_id = auth.uid() and status = 'pending')
)
with check (
  (select not auth_is_customer())
  or (requester_id = auth.uid() and status in ('pending','cancelled'))
);

-- sipariş kalemleri: üst kayıt kuralını miras alır
drop policy if exists lole_cust_pitem_all on purchase_items;
create policy lole_cust_pitem_all on purchase_items as restrictive for all to authenticated
using (
  (select not auth_is_customer())
  or exists (select 1 from purchase_requests r
              where r.id = request_id
                and customer_account_of(r.requester_id) = (select customer_account_of(auth.uid())))
)
with check (
  (select not auth_is_customer())
  or exists (select 1 from purchase_requests r
              where r.id = request_id and r.requester_id = auth.uid())
);

-- 6.c.2) SİPARİŞ HATTINDA GÖRÜNÜRLÜK KURALI (kullanıcının açık talebi)
--   Siparişleri YALNIZCA süper yönetici, admin ve MÜDÜRLER görür.
--   Müşteri yalnızca kendi (firmasının) siparişlerini görür.
--   Sipariş hattında departman olmadığı için "müdür" doğrudan rolden okunur.
--   `not is_order_line(company_id)` sayesinde İÇ ŞİRKETLERDE hiçbir şey değişmez.
drop policy if exists lole_orderline_preq_select on purchase_requests;
create policy lole_orderline_preq_select on purchase_requests as restrictive for select to authenticated
using (
  not is_order_line(company_id)
  or is_super_admin()                       -- süper yönetici + admin (0012)
  or auth_role() = 'manager'                -- müdürler (sipariş sorumlusu)
  -- yalnızca MÜŞTERİ, yalnızca kendi firmasının siparişlerini görür
  or ((select auth_is_customer())
      and customer_account_of(requester_id) = (select customer_account_of(auth.uid())))
);

-- kalemler aynı kuralı miras alır
drop policy if exists lole_orderline_pitem_select on purchase_items;
create policy lole_orderline_pitem_select on purchase_items as restrictive for select to authenticated
using (
  exists (
    select 1 from purchase_requests r
    where r.id = request_id
      and (not is_order_line(r.company_id)
           or is_super_admin()
           or auth_role() = 'manager'
           or ((select auth_is_customer())
               and customer_account_of(r.requester_id) = (select customer_account_of(auth.uid()))))
  )
);

-- karar verme (onay / karşılanamadı / teslim) da yalnızca yönetici ve müdürlerde
drop policy if exists lole_orderline_preq_update on purchase_requests;
create policy lole_orderline_preq_update on purchase_requests as restrictive for update to authenticated
using (
  not is_order_line(company_id)
  or is_super_admin()
  or auth_role() = 'manager'
  -- müşteri yalnız KENDİ bekleyen siparişini iptal edebilir
  or ((select auth_is_customer()) and requester_id = auth.uid() and status = 'pending')
);

-- müşteri hiçbir sipariş kaydını silemez (derinlemesine savunma)
drop policy if exists lole_cust_preq_delete on purchase_requests;
create policy lole_cust_preq_delete on purchase_requests as restrictive for delete to authenticated
using ((select not auth_is_customer()));

-- 6.d) ŞABLONLAR — müşteri kendi şablonlarını ve hattın (personelin yazdığı)
--      hazır sipariş şablonlarını görür; başka müşterinin şablonunu göremez.
drop policy if exists lole_cust_ptpl_all on purchase_templates;
create policy lole_cust_ptpl_all on purchase_templates as restrictive for all to authenticated
using (
  (select not auth_is_customer())
  or created_by = auth.uid()
  or is_staff_profile(created_by)
)
with check ((select not auth_is_customer()) or created_by = auth.uid());

-- sipariş hattında MÜŞTERİ şablonlarını yalnızca yönetici ve müdürler görebilir
drop policy if exists lole_orderline_ptpl_select on purchase_templates;
create policy lole_orderline_ptpl_select on purchase_templates as restrictive for select to authenticated
using (
  not is_order_line(company_id)
  or is_super_admin()
  or auth_role() = 'manager'
  or created_by = auth.uid()
  or is_staff_profile(created_by)
);

drop policy if exists lole_cust_ptpli_all on purchase_template_items;
create policy lole_cust_ptpli_all on purchase_template_items as restrictive for all to authenticated
using (
  (select not auth_is_customer())
  or exists (select 1 from purchase_templates t
              where t.id = template_id
                and (t.created_by = auth.uid()
                     or is_staff_profile(t.created_by)))
)
with check (
  (select not auth_is_customer())
  or exists (select 1 from purchase_templates t
              where t.id = template_id and t.created_by = auth.uid())
);

-- 6.e) ŞİRKET LİSTESİ — müşteri grup şirketlerinin adlarını göremez
drop policy if exists lole_cust_companies_select on companies;
create policy lole_cust_companies_select on companies as restrictive for select to authenticated
using ((select not auth_is_customer()) or id = auth_company_id());

-- 6.f) MESAJLAŞMA — müşteri yalnızca Lole personeliyle sohbet açabilir,
--      müşteri ↔ müşteri sohbeti kurulamaz
drop policy if exists lole_cust_convm_insert on conversation_members;
create policy lole_cust_convm_insert on conversation_members as restrictive for insert to authenticated
with check (
  (select not auth_is_customer())
  or user_id = auth.uid()
  or is_staff_profile(user_id)
);

-- 6.g) DEPOLAMA — müşteri yalnızca kendi yüklediği dosyayı okuyabilir
--      (diğer kovalar ve tüm personel için davranış aynı kalır)
--      NOT: bazı Supabase projelerinde storage.objects üzerinde politika
--      oluşturma yetkisi kısıtlıdır; bu adım başarısız olursa TÜM betiğin
--      geri alınmaması için hata yutulur (uyarı basılır).
do $$
begin
  execute 'drop policy if exists lole_cust_storage_select on storage.objects';
  execute 'create policy lole_cust_storage_select on storage.objects '
       || 'as restrictive for select to authenticated '
       || 'using (bucket_id <> ''attachments'' or not auth_is_customer() or owner = auth.uid())';
exception when others then
  raise notice 'storage.objects politikasi atlandi (yetki yok): %', sqlerrm;
end $$;

-- ============================================================
-- KURULUM SONRASI (arayüzden yapılır, SQL gerekmez):
--   1) Şirketler → "+ Sipariş Hattı Oluştur" ile "Lole Sipariş Hattı" açın.
--   2) Kullanıcılar → o şirkete önce EN AZ BİR "Sipariş Sorumlusu"
--      (müşteri kutusu İŞARETSİZ) hesabı açın; bildirimler ve mesajlaşma
--      bu hesaplara gider.
--   3) Ardından müşteri hesaplarını "Müşteri hesabı" kutusu işaretli açın.
-- ============================================================