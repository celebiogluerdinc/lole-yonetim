-- ============================================================
-- 0006 — FAZ 4: VARDİYA · İZİN · PUANTAJ
-- ============================================================

-- ---------- VARDİYALAR ----------
create table if not exists shifts (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  user_id uuid not null references profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists shifts_company_idx on shifts(company_id, starts_at);
create index if not exists shifts_user_idx on shifts(user_id, starts_at);

alter table shifts enable row level security;

create policy shifts_select on shifts for select using (
  is_super_admin() or (company_id = auth_company_id() and (
    user_id = auth.uid() or auth_role() = 'admin' or manages_department(department_id))));
create policy shifts_write on shifts for all
  using (is_super_admin() or (company_id = auth_company_id() and (
    auth_role() = 'admin' or manages_department(department_id))))
  with check (is_super_admin() or (company_id = auth_company_id() and (
    auth_role() = 'admin' or manages_department(department_id))));

-- ---------- İZİN TALEPLERİ ----------
create table if not exists leave_requests (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null default 'annual' check (type in ('annual','sick','unpaid','other')),
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  decided_by uuid references profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists leave_company_idx on leave_requests(company_id, status);
create index if not exists leave_user_idx on leave_requests(user_id);

alter table leave_requests enable row level security;

-- managers see requests of people in their departments
create or replace function manages_user(target uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists(
     select 1 from department_members dm
      where dm.user_id = target
        and dm.department_id in (select managed_department_ids())) $$;

create policy leave_select on leave_requests for select using (
  is_super_admin() or (company_id = auth_company_id() and (
    user_id = auth.uid() or auth_role() = 'admin' or manages_user(user_id))));
create policy leave_insert on leave_requests for insert with check (
  user_id = auth.uid() and (is_super_admin() or company_id = auth_company_id()));
create policy leave_update on leave_requests for update using (
  is_super_admin() or (company_id = auth_company_id() and (
    (user_id = auth.uid() and status = 'pending')     -- own: cancel while pending
    or auth_role() = 'admin' or manages_user(user_id)))) -- decide
  with check (
  is_super_admin() or (company_id = auth_company_id() and (
    user_id = auth.uid() or auth_role() = 'admin' or manages_user(user_id))));

-- ---------- PUANTAJ (MESAİ) ----------
create table if not exists time_entries (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  in_method text not null default 'manual' check (in_method in ('qr','manual')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists te_company_idx on time_entries(company_id, clock_in);
create index if not exists te_user_idx on time_entries(user_id, clock_in);

alter table time_entries enable row level security;

create policy te_select on time_entries for select using (
  is_super_admin() or (company_id = auth_company_id() and (
    user_id = auth.uid() or auth_role() = 'admin' or manages_user(user_id))));
create policy te_insert on time_entries for insert with check (
  user_id = auth.uid() and (is_super_admin() or company_id = auth_company_id()));
create policy te_update on time_entries for update using (
  is_super_admin() or user_id = auth.uid() or
  (company_id = auth_company_id() and auth_role() = 'admin'))
  with check (
  is_super_admin() or user_id = auth.uid() or
  (company_id = auth_company_id() and auth_role() = 'admin'));
