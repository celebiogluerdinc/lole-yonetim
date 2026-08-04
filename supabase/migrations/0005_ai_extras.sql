-- ============================================================
-- 0005 — AI EXTRAS
--   • attachments.ai_verdict / ai_note  (Fotoğraf Denetçisi)
--   • ai_reports                        (haftalık Performans Analisti raporları)
--   • haftalık rapor cron'u (Pazartesi 09:00 İstanbul = 06:00 UTC)
--
-- ⚠️ Çalıştırmadan önce en alttaki satırda değiştirin:
--   YOUR_APP_URL     → yayın adresiniz (örn. https://lole-yonetim.vercel.app)
--   YOUR_CRON_SECRET → Vercel'deki CRON_SECRET değeriniz
-- ============================================================

alter table attachments add column if not exists ai_verdict text; -- 'ok' | 'suspicious'
alter table attachments add column if not exists ai_note text;

create table if not exists ai_reports (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  week_start date not null,
  content text not null,
  created_at timestamptz not null default now(),
  unique(company_id, week_start)
);

alter table ai_reports enable row level security;

-- managers & admins of the company (and super admins) can read reports
create policy ai_reports_select on ai_reports for select using (
  is_super_admin()
  or (company_id = auth_company_id() and (
    auth_role() = 'admin'
    or exists (select 1 from department_members dm
                where dm.user_id = auth.uid() and dm.is_manager)))
);

-- weekly AI report — Monday 06:00 UTC (09:00 İstanbul)
select cron.schedule('lole-weekly-report', '0 6 * * 1',
  $$select net.http_get('YOUR_APP_URL/api/report?secret=YOUR_CRON_SECRET')$$);
