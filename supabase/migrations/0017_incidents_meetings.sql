-- 0017 — OLAY KAYDI (incident log) + TOPLANTILAR (meetings)
--
-- 1) Olay kaydı: her kullanıcı olay raporu yazabilir; raporları ve altına
--    yazılan AKSİYON RAPORLARINI YALNIZCA admin ve süper yönetici görebilir.
--    (raporu yazan kişi yalnızca kendi kaydının durumunu görür, aksiyon
--     raporlarını göremez.)
-- 2) Toplantılar: toplantıyı yalnızca davetliler (ve kurucusu) görür;
--    admin + süper yönetici iş takibi için TÜM toplantıları ve içeriklerini görür.

-- =========================================================
-- OLAY KAYDI
-- =========================================================
create table if not exists incidents (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  reporter_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text not null,
  location text,
  occurred_at timestamptz not null default now(),
  severity text not null default 'medium'
    check (severity in ('low','medium','high','critical')),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','closed')),
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
create index if not exists inc_company_idx on incidents(company_id, created_at desc);
create index if not exists inc_reporter_idx on incidents(reporter_id, created_at desc);

create table if not exists incident_actions (
  id uuid primary key default uuid_generate_v4(),
  incident_id uuid not null references incidents(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists inca_inc_idx on incident_actions(incident_id, created_at);

alter table incidents enable row level security;
alter table incident_actions enable row level security;

-- GÖRÜNÜRLÜK: yalnızca admin + süper yönetici (is_super_admin() bu ikisini kapsar).
-- Raporu yazan kişi kendi kaydının durumunu takip edebilsin diye kendi satırını görür.
drop policy if exists inc_select on incidents;
create policy inc_select on incidents for select
  using (is_super_admin() or reporter_id = auth.uid());

drop policy if exists inc_insert on incidents;
create policy inc_insert on incidents for insert
  with check (reporter_id = auth.uid() and (is_super_admin() or same_company(company_id)));

drop policy if exists inc_update on incidents;
create policy inc_update on incidents for update
  using (is_super_admin() or (reporter_id = auth.uid() and status = 'pending'))
  with check (is_super_admin() or reporter_id = auth.uid());

drop policy if exists inc_delete on incidents;
create policy inc_delete on incidents for delete
  using (is_super_admin());

-- AKSİYON RAPORU: okuma ve yazma YALNIZCA admin + süper yönetici
drop policy if exists inca_select on incident_actions;
create policy inca_select on incident_actions for select
  using (is_super_admin());

drop policy if exists inca_insert on incident_actions;
create policy inca_insert on incident_actions for insert
  with check (is_super_admin() and author_id = auth.uid());

drop policy if exists inca_update on incident_actions;
create policy inca_update on incident_actions for update
  using (is_super_admin()) with check (is_super_admin());

drop policy if exists inca_delete on incident_actions;
create policy inca_delete on incident_actions for delete
  using (is_super_admin());

-- =========================================================
-- TOPLANTILAR
-- =========================================================
create table if not exists meetings (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  created_by uuid not null references profiles(id) on delete cascade,
  title text not null,          -- KONU
  description text,             -- AÇIKLAMA
  outcome text,                 -- DEĞERLENDİRME SONUCU
  location text,
  meeting_at timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled','done','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists mtg_company_idx on meetings(company_id, meeting_at desc nulls last);

create table if not exists meeting_participants (
  meeting_id uuid not null references meetings(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  is_organizer boolean not null default false,
  added_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);
create index if not exists mtgp_user_idx on meeting_participants(user_id);

-- toplantı odası notları / mesajları
create table if not exists meeting_notes (
  id uuid primary key default uuid_generate_v4(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists mtgn_mtg_idx on meeting_notes(meeting_id, created_at);

-- davetli mi? (security definer → RLS özyinelemesi olmaz)
create or replace function is_meeting_participant(m uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from meeting_participants p
     where p.meeting_id = m and p.user_id = auth.uid()
   ) $$;

alter table meetings enable row level security;
alter table meeting_participants enable row level security;
alter table meeting_notes enable row level security;

drop policy if exists mtg_select on meetings;
create policy mtg_select on meetings for select
  using (is_super_admin() or created_by = auth.uid() or is_meeting_participant(id));

drop policy if exists mtg_insert on meetings;
create policy mtg_insert on meetings for insert
  with check (created_by = auth.uid() and (is_super_admin() or same_company(company_id)));

drop policy if exists mtg_update on meetings;
create policy mtg_update on meetings for update
  using (is_super_admin() or created_by = auth.uid())
  with check (is_super_admin() or created_by = auth.uid());

drop policy if exists mtg_delete on meetings;
create policy mtg_delete on meetings for delete
  using (is_super_admin() or created_by = auth.uid());

drop policy if exists mtgp_select on meeting_participants;
create policy mtgp_select on meeting_participants for select
  using (
    is_super_admin() or user_id = auth.uid() or is_meeting_participant(meeting_id)
    or exists (select 1 from meetings m where m.id = meeting_id and m.created_by = auth.uid())
  );

drop policy if exists mtgp_write on meeting_participants;
create policy mtgp_write on meeting_participants for all
  using (
    is_super_admin()
    or exists (select 1 from meetings m where m.id = meeting_id and m.created_by = auth.uid())
  )
  with check (
    is_super_admin()
    or exists (select 1 from meetings m where m.id = meeting_id and m.created_by = auth.uid())
  );

drop policy if exists mtgn_select on meeting_notes;
create policy mtgn_select on meeting_notes for select
  using (
    is_super_admin() or is_meeting_participant(meeting_id)
    or exists (select 1 from meetings m where m.id = meeting_id and m.created_by = auth.uid())
  );

drop policy if exists mtgn_insert on meeting_notes;
create policy mtgn_insert on meeting_notes for insert
  with check (
    author_id = auth.uid() and (
      is_super_admin() or is_meeting_participant(meeting_id)
      or exists (select 1 from meetings m where m.id = meeting_id and m.created_by = auth.uid())
    )
  );

drop policy if exists mtgn_delete on meeting_notes;
create policy mtgn_delete on meeting_notes for delete
  using (is_super_admin() or author_id = auth.uid());
