-- ============================================================
-- 0019 — BİLDİRİM DÜZELTMESİ
--   SORUN: Satın alma / sipariş / ödeme talebi oluşturulduğunda
--   yöneticilere bildirim DÜŞMÜYORDU. İki ayrı sebep vardı:
--
--   1) Uygulama, bildirim gönderilecek yöneticileri ararken
--      profiles tablosunu okuyor; profiles_select kuralı ise personele
--      yalnızca KENDİ şirketindeki profilleri gösteriyor.
--      → company_id'si NULL olan SÜPER YÖNETİCİLER ve başka bir
--        şirkete kayıtlı (ama tüm şirketlerde yetkili) ADMİNLER
--        hiç bulunamıyordu.
--
--   2) Bulunsalar bile 0009'daki notif_insert kuralı, hedef kişinin
--      profilindeki company_id'nin bildirimin company_id'siyle
--      birebir aynı olmasını şart koşuyordu.
--      → Çapraz yetkili admin/süper yöneticiye yazılan bildirim
--        veritabanı tarafından sessizce reddediliyordu.
--
--   ÇÖZÜM: İki SECURITY DEFINER yardımcı fonksiyon.
--   Tekrar tekrar çalıştırılabilir. ÖNCE 0018 çalıştırılmış olmalı.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Bir şirkette bildirim alacak YETKİLİLER
--    (SECURITY DEFINER olduğu için profiles kurallarına takılmaz)
--      • tüm adminler ve süper yöneticiler (çapraz yetkilidirler)
--      • o şirketin departman müdürleri
--      • sipariş hattında müdür rolündeki sipariş sorumluları
--    Müşteri hesapları ve pasif hesaplar ASLA dâhil edilmez.
-- ------------------------------------------------------------
create or replace function decider_ids(cid uuid)
returns table (user_id uuid)
language sql stable security definer set search_path = public as $$
  select p.id
  from profiles p
  where coalesce(p.is_active, true)
    and coalesce(p.is_customer, false) = false
    and (
      p.role in ('admin', 'super_admin')
      or exists (
        select 1 from department_members dm
        join departments d on d.id = dm.department_id
        where dm.user_id = p.id and dm.is_manager and d.company_id = cid
      )
      or (
        p.company_id = cid and p.role = 'manager'
        and exists (select 1 from companies c where c.id = cid and c.kind = 'order_line')
      )
    )
$$;

-- yetki: yalnızca giriş yapmış kullanıcılar çağırabilir
-- (SECURITY DEFINER fonksiyonlarda EXECUTE varsayılan olarak herkeste olduğu
--  için önce PUBLIC'ten geri alınır — aksi halde giriş yapmamış biri
--  yönetici kimliklerini listeleyebilirdi)
revoke execute on function decider_ids(uuid) from public;
grant execute on function decider_ids(uuid) to authenticated;

-- ------------------------------------------------------------
-- 2) Bildirim yazılabilecek hedefler
--    0009'un amacı korunur (şirket dışına rastgele bildirim yazılamaz),
--    ancak ADMİN ve SÜPER YÖNETİCİLER tüm şirketlerde yetkili olduğu
--    için onlara da bildirim yazılabilir.
-- ------------------------------------------------------------
create or replace function notif_target_ok(uid uuid, cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = uid
      and (p.company_id = cid or p.role in ('admin', 'super_admin'))
  )
  -- decider_ids ile birebir hizalı olsun: toplu bildirim yazımında
  -- tek satırın reddedilip TÜM insert'in düşmesini önler
  or exists (select 1 from decider_ids(cid) d where d.user_id = uid)
$$;

revoke execute on function notif_target_ok(uuid, uuid) from public;
grant execute on function notif_target_ok(uuid, uuid) to authenticated;

drop policy if exists notif_insert on notifications;
create policy notif_insert on notifications for insert
  with check (
    is_super_admin()
    or (same_company(company_id) and notif_target_ok(user_id, company_id))
  );

-- ------------------------------------------------------------
-- 3) Süper yönetici, şirketi olmayan (company_id NULL) bir hesap
--    olabildiği için kendi bildirimlerini de görebilmeli.
--    (notif_select zaten user_id = auth.uid() içeriyor — dokunulmadı.)
-- ------------------------------------------------------------
