-- 0014 — duyuru yorumları
create table if not exists announcement_comments (
  id uuid primary key default uuid_generate_v4(),
  announcement_id uuid not null references announcements(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists annc_ann_idx on announcement_comments(announcement_id, created_at);

alter table announcement_comments enable row level security;

-- duyuruyu görebilen yorumları da görür
create policy annc_select on announcement_comments for select using (
  exists (select 1 from announcements a where a.id = announcement_id
          and (is_super_admin() or (a.company_id = auth_company_id() and (
            a.department_id is null
            or exists (select 1 from department_members dm
                       where dm.department_id = a.department_id and dm.user_id = auth.uid())
            or auth_role() = 'admin')))));

create policy annc_insert on announcement_comments for insert with check (
  author_id = auth.uid()
  and exists (select 1 from announcements a where a.id = announcement_id
          and (is_super_admin() or (a.company_id = auth_company_id() and (
            a.department_id is null
            or exists (select 1 from department_members dm
                       where dm.department_id = a.department_id and dm.user_id = auth.uid())
            or auth_role() = 'admin')))));

create policy annc_delete on announcement_comments for delete using (
  is_super_admin() or author_id = auth.uid()
  or (same_company(company_id) and auth_role() = 'admin'));
