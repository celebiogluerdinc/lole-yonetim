-- 0007 — platform ayarları (uygulama adı vb.)
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

-- herkes okuyabilir (giriş ekranı dahil), yalnızca süper admin yazabilir
create policy app_settings_read on app_settings for select using (true);
create policy app_settings_write on app_settings for all
  using (is_super_admin()) with check (is_super_admin());

insert into app_settings (key, value) values ('app_name', 'Lole Yönetim')
on conflict (key) do nothing;
