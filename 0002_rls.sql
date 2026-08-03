-- ============================================================
-- LOLE YÖNETİM — 0002 ROW LEVEL SECURITY
-- Security backbone: tenant isolation + role rules in the DB.
-- ============================================================

-- ---------- HELPERS (security definer to avoid RLS recursion) ----------
create or replace function auth_company_id() returns uuid
language sql stable security definer set search_path = public as
$$ select company_id from profiles where id = auth.uid() $$;

create or replace function auth_role() returns user_role
language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() $$;

create or replace function is_super_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role from profiles where id = auth.uid()) = 'super_admin', false) $$;

create or replace function is_company_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role from profiles where id = auth.uid()) in ('admin'), false) or is_super_admin() $$;

-- departments the current user manages
create or replace function managed_department_ids() returns setof uuid
language sql stable security definer set search_path = public as
$$ select department_id from department_members where user_id = auth.uid() and is_manager $$;

create or replace function manages_department(dept uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select dept is not null and dept in (select managed_department_ids()) $$;

create or replace function is_task_assignee(t uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from task_assignees where task_id = t and user_id = auth.uid()) $$;

create or replace function is_conversation_member(c uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from conversation_members where conversation_id = c and user_id = auth.uid()) $$;

-- same tenant check used everywhere
create or replace function same_company(cid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select is_super_admin() or cid = auth_company_id() $$;

-- ---------- ENABLE RLS ----------
alter table companies enable row level security;
alter table departments enable row level security;
alter table profiles enable row level security;
alter table department_members enable row level security;
alter table templates enable row level security;
alter table template_items enable row level security;
alter table tasks enable row level security;
alter table task_assignees enable row level security;
alter table checklist_items enable row level security;
alter table attachments enable row level security;
alter table notes enable row level security;
alter table announcements enable row level security;
alter table announcement_reads enable row level security;
alter table comments enable row level security;
alter table documents enable row level security;
alter table conversations enable row level security;
alter table conversation_members enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;
alter table push_subscriptions enable row level security;
alter table activity_log enable row level security;
alter table ai_threads enable row level security;
alter table ai_messages enable row level security;
alter table ai_agent_runs enable row level security;
alter table ai_settings enable row level security;

-- ---------- COMPANIES ----------
create policy companies_select on companies for select
  using (is_super_admin() or id = auth_company_id());
create policy companies_ins on companies for insert
  with check (is_super_admin());
create policy companies_upd on companies for update
  using (is_super_admin() or (id = auth_company_id() and auth_role() = 'admin'));
create policy companies_del on companies for delete
  using (is_super_admin());

-- ---------- DEPARTMENTS ----------
create policy departments_select on departments for select
  using (same_company(company_id));
create policy departments_write on departments for all
  using (is_super_admin() or (company_id = auth_company_id() and auth_role() = 'admin'))
  with check (is_super_admin() or (company_id = auth_company_id() and auth_role() = 'admin'));

-- ---------- PROFILES ----------
create policy profiles_select on profiles for select
  using (is_super_admin() or id = auth.uid() or company_id = auth_company_id());
create policy profiles_self_update on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles p where p.id = auth.uid()));
create policy profiles_admin_all on profiles for all
  using (is_super_admin() or (company_id = auth_company_id() and auth_role() = 'admin'))
  with check (is_super_admin() or (company_id = auth_company_id() and auth_role() = 'admin'));

-- ---------- DEPARTMENT MEMBERS ----------
create policy dm_select on department_members for select
  using (is_super_admin() or exists(
    select 1 from departments d where d.id = department_id and d.company_id = auth_company_id()));
create policy dm_write on department_members for all
  using (is_super_admin() or (auth_role() = 'admin' and exists(
    select 1 from departments d where d.id = department_id and d.company_id = auth_company_id())))
  with check (is_super_admin() or (auth_role() = 'admin' and exists(
    select 1 from departments d where d.id = department_id and d.company_id = auth_company_id())));

-- ---------- TEMPLATES ----------
create policy templates_select on templates for select using (same_company(company_id));
create policy templates_write on templates for all
  using (is_super_admin() or (company_id = auth_company_id() and
        (auth_role() = 'admin' or manages_department(department_id))))
  with check (is_super_admin() or (company_id = auth_company_id() and
        (auth_role() = 'admin' or manages_department(department_id))));

create policy template_items_select on template_items for select
  using (exists(select 1 from templates t where t.id = template_id and same_company(t.company_id)));
create policy template_items_write on template_items for all
  using (exists(select 1 from templates t where t.id = template_id and
    (is_super_admin() or (t.company_id = auth_company_id() and
      (auth_role() = 'admin' or manages_department(t.department_id))))))
  with check (exists(select 1 from templates t where t.id = template_id and
    (is_super_admin() or (t.company_id = auth_company_id() and
      (auth_role() = 'admin' or manages_department(t.department_id))))));

-- ---------- TASKS ----------
-- staff see only their own; managers their departments; admin whole company
create policy tasks_select on tasks for select using (
  is_super_admin()
  or (company_id = auth_company_id() and (
       auth_role() = 'admin'
       or manages_department(department_id)
       or is_task_assignee(id)
       or created_by = auth.uid()
  )));

create policy tasks_insert on tasks for insert with check (
  is_super_admin()
  or (company_id = auth_company_id() and (
       auth_role() = 'admin'
       or manages_department(department_id)
       -- staff may create personal tasks (no department, self-created)
       or (auth_role() = 'staff' and department_id is null and created_by = auth.uid())
  )));

create policy tasks_update on tasks for update using (
  is_super_admin()
  or (company_id = auth_company_id() and (
       auth_role() = 'admin'
       or manages_department(department_id)
       or is_task_assignee(id)   -- staff: field-level limits enforced in server actions
  )))
  with check (
  is_super_admin()
  or (company_id = auth_company_id() and (
       auth_role() = 'admin'
       or manages_department(department_id)
       or is_task_assignee(id)
  )));

create policy tasks_delete on tasks for delete using (
  is_super_admin()
  or (company_id = auth_company_id() and (auth_role() = 'admin' or manages_department(department_id))));

-- ---------- TASK ASSIGNEES ----------
create policy ta_select on task_assignees for select using (
  is_super_admin() or user_id = auth.uid()
  or exists(select 1 from tasks t where t.id = task_id and t.company_id = auth_company_id()
            and (auth_role() = 'admin' or manages_department(t.department_id))));
create policy ta_write on task_assignees for all using (
  is_super_admin()
  or exists(select 1 from tasks t where t.id = task_id and t.company_id = auth_company_id()
            and (auth_role() = 'admin' or manages_department(t.department_id)
                 or (t.created_by = auth.uid() and t.department_id is null))))
  with check (
  is_super_admin()
  or exists(select 1 from tasks t where t.id = task_id and t.company_id = auth_company_id()
            and (auth_role() = 'admin' or manages_department(t.department_id)
                 or (t.created_by = auth.uid() and t.department_id is null and user_id = auth.uid()))));

-- ---------- CHECKLIST ITEMS ----------
create policy ci_select on checklist_items for select using (
  exists(select 1 from tasks t where t.id = task_id and (
    is_super_admin() or (t.company_id = auth_company_id() and (
      auth_role() = 'admin' or manages_department(t.department_id) or is_task_assignee(t.id))))));
create policy ci_write on checklist_items for all using (
  exists(select 1 from tasks t where t.id = task_id and (
    is_super_admin() or (t.company_id = auth_company_id() and (
      auth_role() = 'admin' or manages_department(t.department_id) or is_task_assignee(t.id))))))
  with check (
  exists(select 1 from tasks t where t.id = task_id and (
    is_super_admin() or (t.company_id = auth_company_id() and (
      auth_role() = 'admin' or manages_department(t.department_id) or is_task_assignee(t.id))))));

-- ---------- ATTACHMENTS ----------
create policy att_select on attachments for select using (
  is_super_admin() or (company_id = auth_company_id() and (
    uploaded_by = auth.uid()
    or (task_id is not null and exists(select 1 from tasks t where t.id = task_id and (
         auth_role() = 'admin' or manages_department(t.department_id) or is_task_assignee(t.id))))
    or (message_id is not null and exists(select 1 from messages m where m.id = message_id and is_conversation_member(m.conversation_id))))));
create policy att_insert on attachments for insert with check (
  is_super_admin() or (company_id = auth_company_id() and uploaded_by = auth.uid()));
create policy att_delete on attachments for delete using (
  is_super_admin() or uploaded_by = auth.uid() or is_company_admin());

-- ---------- NOTES ----------
create policy notes_select on notes for select using (
  is_super_admin() or author_id = auth.uid()
  or (task_id is not null and company_id = auth_company_id() and exists(
      select 1 from tasks t where t.id = task_id and (
        auth_role() = 'admin' or manages_department(t.department_id) or is_task_assignee(t.id)))));
create policy notes_write on notes for all
  using (is_super_admin() or author_id = auth.uid())
  with check (is_super_admin() or (author_id = auth.uid() and same_company(company_id)));

-- ---------- ANNOUNCEMENTS ----------
create policy ann_select on announcements for select using (
  is_super_admin() or (company_id = auth_company_id() and (
    department_id is null
    or exists(select 1 from department_members dm where dm.department_id = announcements.department_id and dm.user_id = auth.uid())
    or auth_role() = 'admin')));
create policy ann_write on announcements for all
  using (is_super_admin() or (company_id = auth_company_id() and (
    auth_role() = 'admin' or manages_department(department_id))))
  with check (is_super_admin() or (company_id = auth_company_id() and (
    auth_role() = 'admin' or manages_department(department_id))));

create policy ann_reads_select on announcement_reads for select using (
  is_super_admin() or user_id = auth.uid()
  or exists(select 1 from announcements a where a.id = announcement_id and a.company_id = auth_company_id()
            and (auth_role() = 'admin' or a.author_id = auth.uid())));
create policy ann_reads_insert on announcement_reads for insert
  with check (user_id = auth.uid());

-- ---------- COMMENTS ----------
create policy comments_select on comments for select using (
  is_super_admin() or (company_id = auth_company_id() and exists(
    select 1 from tasks t where t.id = task_id and (
      auth_role() = 'admin' or manages_department(t.department_id) or is_task_assignee(t.id)))));
create policy comments_insert on comments for insert with check (
  author_id = auth.uid() and (is_super_admin() or company_id = auth_company_id()));
create policy comments_delete on comments for delete using (
  is_super_admin() or author_id = auth.uid() or is_company_admin());

-- ---------- DOCUMENTS ----------
create policy docs_select on documents for select using (
  is_super_admin() or (company_id = auth_company_id() and (
    department_id is null or is_company_admin()
    or exists(select 1 from department_members dm where dm.department_id = documents.department_id and dm.user_id = auth.uid()))));
create policy docs_write on documents for all
  using (is_super_admin() or (company_id = auth_company_id() and (
    auth_role() = 'admin' or manages_department(department_id))))
  with check (is_super_admin() or (company_id = auth_company_id() and (
    auth_role() = 'admin' or manages_department(department_id))));

-- ---------- CHAT ----------
create policy conv_select on conversations for select using (
  is_super_admin() or (company_id = auth_company_id() and is_conversation_member(id)));
create policy conv_insert on conversations for insert with check (
  is_super_admin() or (company_id = auth_company_id() and created_by = auth.uid()));
create policy conv_update on conversations for update using (
  is_super_admin() or (company_id = auth_company_id() and created_by = auth.uid()));

create policy convm_select on conversation_members for select using (
  is_super_admin() or user_id = auth.uid() or is_conversation_member(conversation_id));
create policy convm_insert on conversation_members for insert with check (
  is_super_admin() or exists(
    select 1 from conversations c where c.id = conversation_id
      and c.company_id = auth_company_id()
      and (c.created_by = auth.uid() or is_conversation_member(c.id))
      -- member being added must belong to the same company
      and exists(select 1 from profiles p where p.id = user_id and p.company_id = c.company_id)));
create policy convm_update_self on conversation_members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy msg_select on messages for select using (
  is_super_admin() or (company_id = auth_company_id() and is_conversation_member(conversation_id)));
create policy msg_insert on messages for insert with check (
  sender_id = auth.uid() and company_id = auth_company_id() and is_conversation_member(conversation_id));
create policy msg_update_own on messages for update
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());

-- ---------- NOTIFICATIONS ----------
create policy notif_select on notifications for select using (user_id = auth.uid() or is_super_admin());
create policy notif_update on notifications for update using (user_id = auth.uid());
-- inserts happen via server (service role bypasses RLS); allow in-company inserts too:
create policy notif_insert on notifications for insert with check (
  is_super_admin() or same_company(company_id));

create policy push_all on push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- ACTIVITY LOG ----------
create policy log_select on activity_log for select using (
  is_super_admin() or (company_id = auth_company_id() and (auth_role() in ('admin','manager'))));
create policy log_insert on activity_log for insert with check (
  actor_id = auth.uid() and (is_super_admin() or same_company(company_id)));

-- ---------- AI ----------
create policy ai_threads_all on ai_threads for all
  using (user_id = auth.uid() or is_super_admin())
  with check (user_id = auth.uid() or is_super_admin());
create policy ai_msgs_all on ai_messages for all
  using (exists(select 1 from ai_threads t where t.id = thread_id and (t.user_id = auth.uid() or is_super_admin())))
  with check (exists(select 1 from ai_threads t where t.id = thread_id and (t.user_id = auth.uid() or is_super_admin())));
create policy ai_runs_select on ai_agent_runs for select using (
  is_super_admin() or (company_id = auth_company_id() and auth_role() = 'admin'));
create policy ai_settings_select on ai_settings for select using (same_company(company_id));
create policy ai_settings_write on ai_settings for all
  using (is_super_admin() or (company_id = auth_company_id() and auth_role() = 'admin'))
  with check (is_super_admin() or (company_id = auth_company_id() and auth_role() = 'admin'));

-- ---------- STORAGE POLICIES ----------
create policy storage_attachments_select on storage.objects for select
  using (bucket_id = 'attachments' and (is_super_admin() or (storage.foldername(name))[1] = auth_company_id()::text));
create policy storage_attachments_insert on storage.objects for insert
  with check (bucket_id = 'attachments' and (is_super_admin() or (storage.foldername(name))[1] = auth_company_id()::text));
create policy storage_attachments_delete on storage.objects for delete
  using (bucket_id = 'attachments' and (is_super_admin() or owner = auth.uid()));
