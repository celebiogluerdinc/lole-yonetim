-- 0009 — güvenlik sıkılaştırması
-- 1) Bildirim insert'i: hedef kullanıcı MUTLAKA bildirimin şirketinde olmalı
--    (önceki politika şirket içinden herkese/şirket dışına sahte bildirim yazmaya izin veriyordu)
drop policy if exists notif_insert on notifications;
create policy notif_insert on notifications for insert
  with check (
    is_super_admin()
    or (
      same_company(company_id)
      and exists (
        select 1 from profiles p
        where p.id = notifications.user_id
          and p.company_id = notifications.company_id
      )
    )
  );

-- 2) Mesai: aynı anda iki açık mesai kaydı açılamasın (yarış durumu koruması)
create unique index if not exists time_entries_one_open
  on time_entries(user_id) where clock_out is null;

-- 3) Mesai: çıkış saati girişten önce olamaz
alter table time_entries drop constraint if exists time_entries_out_after_in;
alter table time_entries add constraint time_entries_out_after_in
  check (clock_out is null or clock_out > clock_in);
