-- 0012 — Adminler tam yetkili: hangi şirketten eklenirse eklensin
-- TÜM şirketlerin verisine erişir ve işlem yapar (süper admin ile aynı kapsam).
-- Bu fonksiyon tüm güvenlik kurallarında (RLS) "tam erişim" anahtarı olarak
-- kullanıldığı için tek değişiklik bütün tablolara işler.
create or replace function is_super_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role from profiles where id = auth.uid()) in ('super_admin','admin'), false) $$;
