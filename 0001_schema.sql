-- ============================================================
-- LOLE YÖNETİM — 0001 SCHEMA
-- Multi-tenant personnel & task management
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- ENUMS ----------
create type user_role as enum ('super_admin','admin','manager','staff');
create type task_type as enum ('task','checklist');
create type task_priority as enum ('low','normal','high','urgent');
create type task_status as enum ('open','in_progress','pending_review','completed','blocked','overdue','cancelled');
create type conv_type as enum ('dm','group');
create type notif_type as enum ('task_assigned','due_soon','overdue','task_completed','task_pending_review','task_blocked','task_rejected','announcement','comment','message','custom');
create type ai_agent as enum ('assistant','task_creator','checklist_generator','photo_verifier','performance_analyst','announcement_writer','workload_balancer');
create type ai_trigger as enum ('manual','cron');
create type ai_run_status as enum ('success','error','skipped');
create type ai_msg_role as enum ('user','assistant','tool');

-- ---------- CORE ORG ----------
create table companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique,
  logo_url text,
  accent_color text,
  timezone text not null default 'Europe/Istanbul',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table departments (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  description text,
  is_preset boolean not null default false,
  created_at timestamptz not null default now()
);
create index on departments(company_id);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references companies(id) on delete set null, -- NULL => super_admin
  full_name text not null default '',
  email text not null default '',
  role user_role not null default 'staff',
  avatar_url text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on profiles(company_id);

create table department_members (
  id uuid primary key default uuid_generate_v4(),
  department_id uuid not null references departments(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  is_manager boolean not null default false,
  unique(department_id, user_id)
);
create index on department_members(user_id);
create index on department_members(department_id);

-- ---------- TASKS ----------
create table templates (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  name text not null,
  description text,
  type task_type not null default 'task',
  default_recurrence text,
  default_priority task_priority not null default 'normal',
  requires_photo boolean not null default false,
  requires_approval boolean not null default false,
  document_id uuid,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on templates(company_id);

create table template_items (
  id uuid primary key default uuid_generate_v4(),
  template_id uuid not null references templates(id) on delete cascade,
  title text not null,
  position int not null default 0,
  requires_photo boolean not null default false
);
create index on template_items(template_id);

create table tasks (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  title text not null,
  description text,
  type task_type not null default 'task',
  created_by uuid references profiles(id) on delete set null,
  start_at timestamptz,
  due_at timestamptz,
  priority task_priority not null default 'normal',
  status task_status not null default 'open',
  requires_photo boolean not null default false,
  requires_approval boolean not null default false,
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,
  rejection_note text,
  blocked_reason text,
  template_id uuid references templates(id) on delete set null,
  recurrence_rule text,
  parent_recurring_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on tasks(company_id);
create index on tasks(department_id);
create index on tasks(due_at);
create index on tasks(status);

create table task_assignees (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  unique(task_id, user_id)
);
create index on task_assignees(user_id);
create index on task_assignees(task_id);

create table checklist_items (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references tasks(id) on delete cascade,
  title text not null,
  position int not null default 0,
  is_done boolean not null default false,
  done_by uuid references profiles(id) on delete set null,
  done_at timestamptz,
  requires_photo boolean not null default false,
  note text
);
create index on checklist_items(task_id);

-- ---------- CONTENT ----------
create table attachments (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  checklist_item_id uuid references checklist_items(id) on delete cascade,
  message_id uuid,
  uploaded_by uuid references profiles(id) on delete set null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index on attachments(task_id);
create index on attachments(company_id);

create table notes (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade, -- null => personal note
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on notes(author_id);
create index on notes(task_id);

create table announcements (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete cascade, -- null => company-wide (Pano)
  author_id uuid references profiles(id) on delete set null,
  title text not null,
  body text not null,
  is_pinned boolean not null default false,
  send_push boolean not null default true,
  created_at timestamptz not null default now()
);
create index on announcements(company_id);

create table announcement_reads (
  id uuid primary key default uuid_generate_v4(),
  announcement_id uuid not null references announcements(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique(announcement_id, user_id)
);
create index on announcement_reads(user_id);

create table comments (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index on comments(task_id);

create table documents (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete cascade,
  title text not null,
  category text,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on documents(company_id);

-- ---------- CHAT ----------
create table conversations (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  type conv_type not null default 'dm',
  name text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on conversations(company_id);

create table conversation_members (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  unique(conversation_id, user_id)
);
create index on conversation_members(user_id);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index on messages(conversation_id, created_at);

alter table attachments
  add constraint attachments_message_fk
  foreign key (message_id) references messages(id) on delete cascade;

-- ---------- NOTIFICATIONS ----------
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  type notif_type not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications(user_id, created_at);

create table push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index on push_subscriptions(user_id);

-- ---------- AUDIT ----------
create table activity_log (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on activity_log(company_id, created_at);

-- ---------- AI MODULE ----------
create table ai_threads (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

create table ai_messages (
  id uuid primary key default uuid_generate_v4(),
  thread_id uuid not null references ai_threads(id) on delete cascade,
  role ai_msg_role not null,
  content text not null default '',
  tool_calls jsonb,
  created_at timestamptz not null default now()
);
create index on ai_messages(thread_id, created_at);

create table ai_agent_runs (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade,
  agent ai_agent not null,
  triggered_by uuid references profiles(id) on delete set null,
  trigger ai_trigger not null default 'manual',
  input jsonb, output jsonb,
  status ai_run_status not null default 'success',
  input_tokens int default 0, output_tokens int default 0,
  created_at timestamptz not null default now()
);

create table ai_settings (
  company_id uuid primary key references companies(id) on delete cascade,
  enabled_agents jsonb not null default '{}',
  monthly_token_budget int,
  updated_at timestamptz not null default now()
);

-- ---------- TRIGGERS ----------

-- Every new company gets the 4 preset departments
create or replace function fn_create_preset_departments()
returns trigger language plpgsql security definer as $$
begin
  insert into departments (company_id, name, is_preset) values
    (new.id, 'Operasyon', true),
    (new.id, 'Satış', true),
    (new.id, 'Üretim', true),
    (new.id, 'Yönetim', true);
  return new;
end $$;

create trigger trg_company_preset_departments
after insert on companies
for each row execute function fn_create_preset_departments();

-- Every new auth user gets a profile (metadata may carry name/company/role)
create or replace function fn_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, company_id, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'company_id','')::uuid,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'staff')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger trg_on_auth_user_created
after insert on auth.users
for each row execute function fn_handle_new_user();

-- ---------- STORAGE ----------
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;
