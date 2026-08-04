-- ============================================================
-- 0004 — SCHEDULED REMINDERS (pg_cron)
-- Every 10 minutes:
--   • tasks past due  → status 'overdue'
--   • due within 60m  → 'due_soon' notification to assignees (once)
--   • just overdue    → 'overdue' notification to assignees (once)
--   • 30+ min overdue → escalation notification to managers/admins (once)
-- Plus a webhook that delivers Web Push for these notifications.
--
-- ⚠️ Before running, replace:
--   YOUR_APP_URL     → your deployed URL (e.g. https://lole-yonetim.vercel.app)
--   YOUR_CRON_SECRET → the CRON_SECRET value you set in Vercel
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table notifications add column if not exists pushed boolean not null default false;

create or replace function fn_process_reminders()
returns void language plpgsql security definer set search_path = public as $$
begin
  -- 1) flip past-due tasks to 'overdue'
  update tasks set status = 'overdue'
   where status in ('open','in_progress')
     and due_at is not null and due_at < now();

  -- 2) due within 60 minutes → assignees (once per task+user)
  insert into notifications (company_id, user_id, type, payload)
  select t.company_id, ta.user_id, 'due_soon',
         jsonb_build_object('task_id', t.id, 'title', t.title)
    from tasks t
    join task_assignees ta on ta.task_id = t.id
   where t.status in ('open','in_progress')
     and t.due_at between now() and now() + interval '60 minutes'
     and not exists (
       select 1 from notifications n
        where n.type = 'due_soon' and n.user_id = ta.user_id
          and n.payload->>'task_id' = t.id::text);

  -- 3) overdue → assignees (once per task+user)
  insert into notifications (company_id, user_id, type, payload)
  select t.company_id, ta.user_id, 'overdue',
         jsonb_build_object('task_id', t.id, 'title', t.title)
    from tasks t
    join task_assignees ta on ta.task_id = t.id
   where t.status = 'overdue'
     and not exists (
       select 1 from notifications n
        where n.type = 'overdue' and n.user_id = ta.user_id
          and n.payload->>'task_id' = t.id::text
          and coalesce(n.payload->>'escalated','false') = 'false');

  -- 4) escalation: still incomplete 30+ min past due → managers + admins (once)
  insert into notifications (company_id, user_id, type, payload)
  select t.company_id, x.user_id, 'overdue',
         jsonb_build_object('task_id', t.id, 'title', t.title, 'escalated', true)
    from tasks t
    join lateral (
      select dm.user_id
        from department_members dm
       where dm.department_id = t.department_id and dm.is_manager
      union
      select p.id from profiles p
       where p.company_id = t.company_id and p.role = 'admin'
    ) x on true
   where t.status = 'overdue'
     and t.due_at < now() - interval '30 minutes'
     and not exists (
       select 1 from notifications n
        where n.type = 'overdue' and n.user_id = x.user_id
          and n.payload->>'task_id' = t.id::text
          and n.payload->>'escalated' = 'true');
end $$;

-- run the reminder engine every 10 minutes
select cron.schedule('lole-reminders', '*/10 * * * *',
  $$select fn_process_reminders()$$);

-- deliver Web Push for freshly created reminder notifications
select cron.schedule('lole-push', '*/10 * * * *',
  $$select net.http_get('YOUR_APP_URL/api/push?secret=YOUR_CRON_SECRET')$$);
