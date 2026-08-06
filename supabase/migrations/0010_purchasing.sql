-- 0010 — Satın Alma Talepleri + Şablonları ve Ödeme Talepleri

-- ========== SATIN ALMA ==========
create table if not exists purchase_requests (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  requester_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  note text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled')),
  decided_by uuid references profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
create index if not exists preq_company_idx on purchase_requests(company_id, created_at desc);

create table if not exists purchase_items (
  id uuid primary key default uuid_generate_v4(),
  request_id uuid not null references purchase_requests(id) on delete cascade,
  product text not null,
  quantity text,
  unit text,
  brand text,
  spec text,
  position int not null default 0
);
create index if not exists pitem_req_idx on purchase_items(request_id);

create table if not exists purchase_templates (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  name text not null,
  note text,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists ptpl_company_idx on purchase_templates(company_id);

create table if not exists purchase_template_items (
  id uuid primary key default uuid_generate_v4(),
  template_id uuid not null references purchase_templates(id) on delete cascade,
  product text not null,
  quantity text,
  unit text,
  brand text,
  spec text,
  position int not null default 0
);
create index if not exists ptpli_tpl_idx on purchase_template_items(template_id);

-- ========== ÖDEME TALEPLERİ ==========
create table if not exists payment_requests (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  requester_id uuid not null references profiles(id) on delete cascade,
  work_title text not null,
  work_detail text,
  firm_name text not null,
  tax_no text,
  iban text,
  amount numeric(14,2),
  currency text not null default 'TRY',
  note text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled')),
  decided_by uuid references profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
create index if not exists payreq_company_idx on payment_requests(company_id, created_at desc);

-- ödeme şablonları (sık kullanılan firma/iş bilgileri)
create table if not exists payment_templates (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  name text not null,
  work_title text,
  work_detail text,
  firm_name text,
  tax_no text,
  iban text,
  amount numeric(14,2),
  currency text not null default 'TRY',
  note text,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists paytpl_company_idx on payment_templates(company_id);

-- ========== RLS ==========
alter table purchase_requests enable row level security;
alter table purchase_items enable row level security;
alter table purchase_templates enable row level security;
alter table purchase_template_items enable row level security;
alter table payment_requests enable row level security;
alter table payment_templates enable row level security;

-- şirketteki herkes görebilir
create policy preq_select on purchase_requests for select
  using (is_super_admin() or same_company(company_id));
create policy preq_insert on purchase_requests for insert
  with check (requester_id = auth.uid() and (is_super_admin() or same_company(company_id)));
create policy preq_update on purchase_requests for update
  using (
    is_super_admin()
    or (same_company(company_id) and (
      auth_role() = 'admin'
      or requester_id = auth.uid()
      or exists (select 1 from department_members dm
                 join departments d on d.id = dm.department_id
                 where dm.user_id = auth.uid() and dm.is_manager
                   and d.company_id = purchase_requests.company_id)
    ))
  );
create policy preq_delete on purchase_requests for delete
  using (is_super_admin() or (same_company(company_id) and auth_role() = 'admin'));

create policy pitem_select on purchase_items for select
  using (exists (select 1 from purchase_requests r where r.id = request_id
                 and (is_super_admin() or same_company(r.company_id))));
create policy pitem_write on purchase_items for all
  using (exists (select 1 from purchase_requests r where r.id = request_id
                 and (is_super_admin() or (same_company(r.company_id)
                      and (r.requester_id = auth.uid() or auth_role() = 'admin')))))
  with check (exists (select 1 from purchase_requests r where r.id = request_id
                 and (is_super_admin() or (same_company(r.company_id)
                      and (r.requester_id = auth.uid() or auth_role() = 'admin')))));

create policy ptpl_select on purchase_templates for select
  using (is_super_admin() or same_company(company_id));
create policy ptpl_insert on purchase_templates for insert
  with check (created_by = auth.uid() and (is_super_admin() or same_company(company_id)));
create policy ptpl_update on purchase_templates for update
  using (is_super_admin() or (same_company(company_id) and (created_by = auth.uid() or auth_role() = 'admin')));
create policy ptpl_delete on purchase_templates for delete
  using (is_super_admin() or (same_company(company_id) and (created_by = auth.uid() or auth_role() = 'admin')));

create policy ptpli_select on purchase_template_items for select
  using (exists (select 1 from purchase_templates t where t.id = template_id
                 and (is_super_admin() or same_company(t.company_id))));
create policy ptpli_write on purchase_template_items for all
  using (exists (select 1 from purchase_templates t where t.id = template_id
                 and (is_super_admin() or (same_company(t.company_id)
                      and (t.created_by = auth.uid() or auth_role() = 'admin')))))
  with check (exists (select 1 from purchase_templates t where t.id = template_id
                 and (is_super_admin() or (same_company(t.company_id)
                      and (t.created_by = auth.uid() or auth_role() = 'admin')))));

create policy payreq_select on payment_requests for select
  using (is_super_admin() or same_company(company_id));
create policy payreq_insert on payment_requests for insert
  with check (requester_id = auth.uid() and (is_super_admin() or same_company(company_id)));
create policy payreq_update on payment_requests for update
  using (
    is_super_admin()
    or (same_company(company_id) and (
      auth_role() = 'admin'
      or requester_id = auth.uid()
      or exists (select 1 from department_members dm
                 join departments d on d.id = dm.department_id
                 where dm.user_id = auth.uid() and dm.is_manager
                   and d.company_id = payment_requests.company_id)
    ))
  );
create policy payreq_delete on payment_requests for delete
  using (is_super_admin() or (same_company(company_id) and auth_role() = 'admin'));

create policy paytpl_select on payment_templates for select
  using (is_super_admin() or same_company(company_id));
create policy paytpl_insert on payment_templates for insert
  with check (created_by = auth.uid() and (is_super_admin() or same_company(company_id)));
create policy paytpl_update on payment_templates for update
  using (is_super_admin() or (same_company(company_id) and (created_by = auth.uid() or auth_role() = 'admin')));
create policy paytpl_delete on payment_templates for delete
  using (is_super_admin() or (same_company(company_id) and (created_by = auth.uid() or auth_role() = 'admin')));
