-- ─── AI@DZ Transformation Plans – Database Schema ─────────────────────────
-- Idempotent: kann beliebig oft ausgeführt werden.
--
-- Struktur:
--   1. CREATE TABLE IF NOT EXISTS – vollständige Definition (Neudatenbanken)
--   2. ALTER TABLE ADD COLUMN IF NOT EXISTS – nachträgliche Spalten (bestehende DBs)
--   3. Datenmigration / Constraint-Pflege – idempotente Blöcke
--   4. Row Level Security + Policies

create extension if not exists "uuid-ossp";

-- ─── Business Divisions (IT-Geschäftsbereiche) ───────────────────────────

create table if not exists business_divisions (
  id          uuid        primary key default uuid_generate_v4(),
  title       text        not null,
  description text,
  created_at  timestamptz not null default now()
);

-- ─── Organizations (Arbeitsorganisationen) ────────────────────────────────

create table if not exists organizations (
  id                   uuid        primary key default uuid_generate_v4(),
  name                 text        not null,
  description          text,
  business_division_id uuid        references business_divisions(id),
  created_at           timestamptz not null default now()
);

-- Nachträglich hinzugefügte Spalten (für bestehende Datenbanken)
alter table organizations add column if not exists business_division_id uuid references business_divisions(id);

-- ─── Guidance Modes (Begleitungsmodi) ────────────────────────────────────

create table if not exists guidance_modes (
  id          uuid        primary key default uuid_generate_v4(),
  letter      text        not null,
  title       text        not null,
  description text,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now()
);

-- ─── Agile Release Trains ─────────────────────────────────────────────────

create table if not exists arts (
  id                       uuid         primary key default uuid_generate_v4(),
  org_id                   uuid         not null references organizations(id) on delete cascade,
  name                     text         not null,
  description              text,
  edit_token               text         not null unique default encode(gen_random_bytes(16), 'hex'),
  readonly_token           text         not null unique default encode(gen_random_bytes(16), 'hex'),
  mission_statement        text,
  business_context         text,
  risks                    text,
  budget_2027              numeric(14,2),
  guidance_mode_id         uuid         references guidance_modes(id),
  art_leadership           text,
  responsible_person       text,
  cyber_criticality        text,
  cyber_criticality_reason text,
  guidance_mode_reason     text,
  planned_approach         text,
  general_benefit_potential text,
  general_scaling_potential text,
  general_acceptance        text,
  current_maturity_level_id uuid,       -- FK gesetzt nach maturity_levels (siehe unten)
  created_at               timestamptz  not null default now()
);

-- Nachträglich hinzugefügte Spalten (für bestehende Datenbanken)
alter table arts add column if not exists mission_statement        text;
alter table arts add column if not exists business_context         text;
alter table arts add column if not exists risks                    text;
alter table arts add column if not exists budget_2027              numeric(14,2);
alter table arts add column if not exists guidance_mode_id         uuid references guidance_modes(id);
alter table arts add column if not exists art_leadership           text;
alter table arts add column if not exists responsible_person       text;
alter table arts add column if not exists cyber_criticality        text;
alter table arts add column if not exists cyber_criticality_reason text;
alter table arts add column if not exists guidance_mode_reason     text;
alter table arts add column if not exists planned_approach         text;
alter table arts add column if not exists general_benefit_potential text;
alter table arts add column if not exists general_scaling_potential text;
alter table arts add column if not exists general_acceptance        text;
alter table arts add column if not exists current_maturity_level_id uuid;

-- cyber_criticality CHECK: idempotent via do-Block (funktioniert auch bei bestehender Spalte ohne Constraint)
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'arts'::regclass and conname = 'arts_cyber_criticality_check'
  ) then
    alter table arts add constraint arts_cyber_criticality_check
      check (cyber_criticality in ('Hoch', 'Mittel', 'Tief'));
  end if;
end $$;

create index if not exists idx_arts_org            on arts(org_id);
create index if not exists idx_arts_edit_token     on arts(edit_token);
create index if not exists idx_arts_readonly_token on arts(readonly_token);

-- ─── Employee Roles (Mitarbeiter-Rollen) ──────────────────────────────────

create table if not exists employee_roles (
  id         uuid        primary key default uuid_generate_v4(),
  name       text        not null,
  sort_order integer     not null default 0,
  created_at timestamptz not null default now()
);

-- ─── BizDevOps Capabilities ───────────────────────────────────────────────

create table if not exists bizdevops_capabilities (
  id         uuid        primary key default uuid_generate_v4(),
  name       text        not null,
  color      text,
  sort_order integer     not null default 0,
  created_at timestamptz not null default now()
);

-- Nachträglich hinzugefügte Spalten (für bestehende Datenbanken)
alter table bizdevops_capabilities add column if not exists color text;

-- ─── Maturity Levels (Maturitätsstufen) ───────────────────────────────────

create table if not exists maturity_levels (
  id          uuid        primary key default uuid_generate_v4(),
  code        text        not null unique,
  title       text        not null,
  description text,
  created_at  timestamptz not null default now()
);

-- FK von arts.current_maturity_level_id auf maturity_levels (nach Tabellendefinition)
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'arts'::regclass and conname = 'arts_current_maturity_level_id_fkey'
  ) then
    alter table arts add constraint arts_current_maturity_level_id_fkey
      foreign key (current_maturity_level_id) references maturity_levels(id);
  end if;
end $$;

-- ─── AI Use Cases ─────────────────────────────────────────────────────────

create table if not exists ai_use_cases (
  id             uuid        primary key default uuid_generate_v4(),
  title          text        not null,
  description    text,
  link           text,
  status         text,
  available_from date,
  sort_order     integer     not null default 0,
  created_at     timestamptz not null default now()
);

-- Nachträglich hinzugefügte Spalten (für bestehende Datenbanken)
alter table ai_use_cases add column if not exists status         text;
alter table ai_use_cases add column if not exists available_from date;
alter table ai_use_cases add column if not exists type           text not null default 'official';
alter table ai_use_cases add column if not exists art_id         uuid references arts(id) on delete cascade;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'ai_use_cases'::regclass and conname = 'ai_use_cases_type_check'
  ) then
    alter table ai_use_cases add constraint ai_use_cases_type_check
      check (type in ('official', 'local'));
  end if;
end $$;

-- Status-Umbenennung (idempotent via WHERE-Bedingung)
alter table ai_use_cases drop constraint if exists ai_use_cases_status_check;
update ai_use_cases set status = 'In Backlog'            where status = 'Backlog';
update ai_use_cases set status = 'In Lösungsexploration' where status = 'Lösungsexploration';
update ai_use_cases set status = 'In Entwicklung'        where status = 'Entwicklung';
update ai_use_cases set status = 'Im Rollout'            where status = 'Rollout';

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'ai_use_cases'::regclass and conname = 'ai_use_cases_status_check'
  ) then
    alter table ai_use_cases add constraint ai_use_cases_status_check
      check (status in ('In Backlog', 'In Lösungsexploration', 'In Entwicklung', 'Im Rollout', 'In Betrieb', 'Abgebrochen'));
  end if;
end $$;

-- ─── AI Use Case → Capability-Verknüpfungen ───────────────────────────────

create table if not exists ai_use_case_capabilities (
  id                   uuid    primary key default uuid_generate_v4(),
  use_case_id          uuid    not null references ai_use_cases(id) on delete cascade,
  capability_id        uuid    not null references bizdevops_capabilities(id) on delete cascade,
  efficiency_potential integer check (efficiency_potential >= 0 and efficiency_potential <= 100),
  unique (use_case_id, capability_id)
);

-- Nachträglich hinzugefügte Spalten (für bestehende Datenbanken)
alter table ai_use_case_capabilities add column if not exists efficiency_potential integer;
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'ai_use_case_capabilities'::regclass
      and conname = 'ai_use_case_capabilities_efficiency_potential_check'
  ) then
    alter table ai_use_case_capabilities add constraint ai_use_case_capabilities_efficiency_potential_check
      check (efficiency_potential >= 0 and efficiency_potential <= 100);
  end if;
end $$;

create index if not exists idx_use_case_caps_use_case on ai_use_case_capabilities(use_case_id);

-- ─── AI Use Case → Maturitätsstufen-Verknüpfungen ────────────────────────

create table if not exists ai_use_case_maturity_levels (
  id                uuid primary key default uuid_generate_v4(),
  use_case_id       uuid not null references ai_use_cases(id) on delete cascade,
  maturity_level_id uuid not null references maturity_levels(id) on delete cascade,
  unique (use_case_id, maturity_level_id)
);

create index if not exists idx_use_case_maturity_use_case on ai_use_case_maturity_levels(use_case_id);

-- ─── AI Use Case → Team-Typ-Verknüpfungen ───────────────────────────────

create table if not exists ai_use_case_team_types (
  id           uuid primary key default uuid_generate_v4(),
  use_case_id  uuid not null references ai_use_cases(id) on delete cascade,
  team_type_id uuid not null references team_types(id) on delete cascade,
  unique (use_case_id, team_type_id)
);

create index if not exists idx_use_case_team_types_uc on ai_use_case_team_types(use_case_id);

-- ─── Plan Versions ────────────────────────────────────────────────────────

create table if not exists plan_versions (
  id                 uuid        primary key default uuid_generate_v4(),
  art_id             uuid        not null references arts(id) on delete cascade,
  version_number     integer     not null,
  status             text        not null default 'draft' check (status in ('draft', 'checked_in')),
  change_description text,
  snapshot           jsonb,
  created_at         timestamptz not null default now(),
  checked_in_at      timestamptz,
  unique (art_id, version_number)
);

create index if not exists idx_plan_versions_art on plan_versions(art_id);

-- ─── Teams ────────────────────────────────────────────────────────────────

create table if not exists teams (
  id          uuid        primary key default uuid_generate_v4(),
  art_id      uuid        not null references arts(id) on delete cascade,
  name        text        not null,
  description text,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_teams_art on teams(art_id);

-- ─── Team Members ─────────────────────────────────────────────────────────

create table if not exists team_members (
  id         uuid         primary key default uuid_generate_v4(),
  team_id    uuid         not null references teams(id) on delete cascade,
  role_id    uuid         not null references employee_roles(id),
  type       text         not null check (type in ('intern', 'extern')),
  category   text         not null check (category in ('business', 'it')),
  fte        numeric(5,2) not null check (fte >= 0),
  headcount  integer      not null check (headcount >= 1),
  created_at timestamptz  not null default now(),
  constraint fte_leq_hc check (fte <= headcount)
);

create index if not exists idx_team_members_team on team_members(team_id);

-- ─── Team Capability Allocations ─────────────────────────────────────────

create table if not exists team_capability_allocations (
  id            uuid    primary key default uuid_generate_v4(),
  team_id       uuid    not null references teams(id) on delete cascade,
  capability_id uuid    not null references bizdevops_capabilities(id),
  percentage    integer not null check (percentage >= 0 and percentage <= 100),
  unique (team_id, capability_id)
);

create index if not exists idx_team_allocs_team on team_capability_allocations(team_id);

-- ─── AI Use Case Planning (pro ART + Use Case + Team) ────────────────────

create table if not exists art_ai_use_cases (
  id          uuid        primary key default uuid_generate_v4(),
  art_id      uuid        not null references arts(id) on delete cascade,
  use_case_id uuid        not null references ai_use_cases(id) on delete cascade,
  team_id     uuid        not null references teams(id) on delete cascade,
  status      text        not null default 'not_planned',
  created_at  timestamptz not null default now(),
  unique (art_id, use_case_id, team_id)
);

-- Legacy boolean `planned` → text `status` (idempotent)
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_name = 'art_ai_use_cases' and column_name = 'planned') then
    alter table art_ai_use_cases add column if not exists status text;
    update art_ai_use_cases set status = case when planned then 'planned' else 'not_planned' end
      where status is null;
    alter table art_ai_use_cases alter column status set default 'not_planned';
    alter table art_ai_use_cases alter column status set not null;
    alter table art_ai_use_cases drop column planned;
  end if;
end $$;

-- Legacy Datumsspalten entfernen (in art_ai_use_case_dates verschoben)
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_name = 'art_ai_use_cases' and column_name = 'pilot_from') then
    alter table art_ai_use_cases drop column pilot_from;
  end if;
  if exists (select 1 from information_schema.columns
             where table_name = 'art_ai_use_cases' and column_name = 'rollout_from') then
    alter table art_ai_use_cases drop column rollout_from;
  end if;
  if exists (select 1 from information_schema.columns
             where table_name = 'art_ai_use_cases' and column_name = 'full_usage_from') then
    alter table art_ai_use_cases drop column full_usage_from;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'art_ai_use_cases_status_check') then
    alter table art_ai_use_cases add constraint art_ai_use_cases_status_check
      check (status in ('planned', 'not_planned', 'not_needed'));
  end if;
end $$;

create index if not exists idx_art_use_cases_art      on art_ai_use_cases(art_id);
create index if not exists idx_art_use_cases_use_case on art_ai_use_cases(use_case_id);
create index if not exists idx_art_use_cases_team     on art_ai_use_cases(team_id);

-- ─── AI Use Case Date Planning (pro ART + Use Case + Team + Capability) ───

create table if not exists art_ai_use_case_dates (
  id              uuid        primary key default uuid_generate_v4(),
  art_id          uuid        not null references arts(id) on delete cascade,
  use_case_id     uuid        not null references ai_use_cases(id) on delete cascade,
  team_id         uuid        not null references teams(id) on delete cascade,
  capability_id   uuid        not null references bizdevops_capabilities(id) on delete cascade,
  pilot_from      date,
  rollout_from    date,
  full_usage_from date,
  created_at      timestamptz not null default now(),
  unique (art_id, use_case_id, team_id, capability_id)
);

create index if not exists idx_art_uc_dates_art      on art_ai_use_case_dates(art_id);
create index if not exists idx_art_uc_dates_use_case on art_ai_use_case_dates(use_case_id);

-- ─── ART Use Case Ratings (Nutzen / Skalierbarkeit / Akzeptanz) ───────────

create table if not exists art_use_case_ratings (
  id             uuid        primary key default uuid_generate_v4(),
  art_id         uuid        not null references arts(id) on delete cascade,
  use_case_id    uuid        not null references ai_use_cases(id) on delete cascade,
  nutzen         integer     not null default 1 check (nutzen >= 1 and nutzen <= 5),
  skalierbarkeit integer     not null default 1 check (skalierbarkeit >= 1 and skalierbarkeit <= 5),
  akzeptanz      integer     not null default 1 check (akzeptanz >= 1 and akzeptanz <= 5),
  created_at     timestamptz not null default now(),
  unique (art_id, use_case_id)
);

create index if not exists idx_art_uc_ratings_art on art_use_case_ratings(art_id);

-- ─── Quality Checklist Items (globale Checklisten-Einträge) ──────────────

create table if not exists quality_checklist_items (
  id          uuid        primary key default uuid_generate_v4(),
  sort_order  integer     not null default 0,
  title       text        not null,
  description text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_qc_items_sort on quality_checklist_items(sort_order);

-- ─── ART Quality Checklist Completions (pro ART) ─────────────────────────

create table if not exists art_quality_checklist_completions (
  id                uuid        primary key default uuid_generate_v4(),
  art_id            uuid        not null references arts(id) on delete cascade,
  checklist_item_id uuid        not null references quality_checklist_items(id) on delete cascade,
  completed_at      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  unique (art_id, checklist_item_id)
);

create index if not exists idx_art_qc_completions_art on art_quality_checklist_completions(art_id);

-- ─── Standortbestimmung Dimensionen (global, Admin-verwaltbar) ───────────

create table if not exists standortbestimmung_dimensionen (
  id         uuid        primary key default uuid_generate_v4(),
  sort_order integer     not null default 0,
  title      text        not null,
  leitfragen text,
  created_at timestamptz not null default now()
);

alter table standortbestimmung_dimensionen add column if not exists leitfragen text;

create index if not exists idx_sb_dim_sort on standortbestimmung_dimensionen(sort_order);

-- ─── ART Standortbestimmung (Bewertungen pro ART + Dimension) ────────────

create table if not exists art_standortbestimmung (
  id            uuid        primary key default uuid_generate_v4(),
  art_id        uuid        not null references arts(id) on delete cascade,
  dimension_key text        not null,
  color         text        check (color in ('gruen', 'gelb', 'rot')),
  reason        text,
  created_at    timestamptz not null default now(),
  unique (art_id, dimension_key)
);

create index if not exists idx_art_standortbestimmung_art on art_standortbestimmung(art_id);

-- ─── ART Timeline Entries (custom milestones/phases in Gantt) ────────────

create table if not exists art_timeline_entries (
  id         uuid        primary key default uuid_generate_v4(),
  art_id     uuid        not null references arts(id) on delete cascade,
  title      text        not null,
  date_from  date        not null,
  date_until date        not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_art_timeline_entries_art on art_timeline_entries(art_id);

-- ─── Team Types ───────────────────────────────────────────────────────────

create table if not exists team_types (
  id         uuid        primary key default uuid_generate_v4(),
  name       text        not null,
  color      text,
  sort_order integer     not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists team_team_types (
  id           uuid        primary key default uuid_generate_v4(),
  team_id      uuid        not null references teams(id) on delete cascade,
  team_type_id uuid        not null references team_types(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (team_id, team_type_id)
);

create index if not exists idx_team_team_types_team on team_team_types(team_id);

alter table teams add column if not exists challenges text;

-- ─── Row Level Security ───────────────────────────────────────────────────

alter table business_divisions              enable row level security;
alter table organizations                   enable row level security;
alter table guidance_modes                  enable row level security;
alter table arts                            enable row level security;
alter table employee_roles                  enable row level security;
alter table bizdevops_capabilities          enable row level security;
alter table maturity_levels                 enable row level security;
alter table ai_use_cases                    enable row level security;
alter table ai_use_case_capabilities        enable row level security;
alter table ai_use_case_maturity_levels     enable row level security;
alter table plan_versions                   enable row level security;
alter table teams                           enable row level security;
alter table team_members                    enable row level security;
alter table team_capability_allocations     enable row level security;
alter table art_ai_use_cases               enable row level security;
alter table art_ai_use_case_dates          enable row level security;
alter table art_use_case_ratings           enable row level security;
alter table quality_checklist_items        enable row level security;
alter table art_quality_checklist_completions enable row level security;
alter table standortbestimmung_dimensionen   enable row level security;
alter table art_standortbestimmung           enable row level security;
alter table team_types                       enable row level security;
alter table team_team_types                  enable row level security;
alter table ai_use_case_team_types           enable row level security;

-- ─── Policies (drop + create = idempotent) ───────────────────────────────

do $$ begin
  drop policy if exists "auth_all" on business_divisions;
  drop policy if exists "auth_all" on organizations;
  drop policy if exists "auth_all" on guidance_modes;
  drop policy if exists "auth_all" on arts;
  drop policy if exists "auth_all" on employee_roles;
  drop policy if exists "auth_all" on bizdevops_capabilities;
  drop policy if exists "auth_all" on maturity_levels;
  drop policy if exists "auth_all" on ai_use_cases;
  drop policy if exists "auth_all" on ai_use_case_capabilities;
  drop policy if exists "auth_all" on ai_use_case_maturity_levels;
  drop policy if exists "auth_all" on plan_versions;
  drop policy if exists "auth_all" on teams;
  drop policy if exists "auth_all" on team_members;
  drop policy if exists "auth_all" on team_capability_allocations;
  drop policy if exists "auth_all" on art_ai_use_cases;
  drop policy if exists "auth_all" on art_ai_use_case_dates;
  drop policy if exists "auth_all" on art_use_case_ratings;
  drop policy if exists "auth_all" on quality_checklist_items;
  drop policy if exists "auth_all" on art_quality_checklist_completions;
  drop policy if exists "auth_all" on standortbestimmung_dimensionen;
  drop policy if exists "auth_all" on art_standortbestimmung;
  drop policy if exists "auth_all" on art_timeline_entries;
  drop policy if exists "auth_all" on team_types;
  drop policy if exists "auth_all" on team_team_types;
  drop policy if exists "auth_all" on ai_use_case_team_types;
end $$;

create policy "auth_all" on business_divisions              for all using (true) with check (true);
create policy "auth_all" on organizations                   for all using (true) with check (true);
create policy "auth_all" on guidance_modes                  for all using (true) with check (true);
create policy "auth_all" on arts                            for all using (true) with check (true);
create policy "auth_all" on employee_roles                  for all using (true) with check (true);
create policy "auth_all" on bizdevops_capabilities          for all using (true) with check (true);
create policy "auth_all" on maturity_levels                 for all using (true) with check (true);
create policy "auth_all" on ai_use_cases                    for all using (true) with check (true);
create policy "auth_all" on ai_use_case_capabilities        for all using (true) with check (true);
create policy "auth_all" on ai_use_case_maturity_levels     for all using (true) with check (true);
create policy "auth_all" on plan_versions                   for all using (true) with check (true);
create policy "auth_all" on teams                           for all using (true) with check (true);
create policy "auth_all" on team_members                    for all using (true) with check (true);
create policy "auth_all" on team_capability_allocations     for all using (true) with check (true);
create policy "auth_all" on art_ai_use_cases               for all using (true) with check (true);
create policy "auth_all" on art_ai_use_case_dates          for all using (true) with check (true);
create policy "auth_all" on art_use_case_ratings           for all using (true) with check (true);
create policy "auth_all" on quality_checklist_items        for all using (true) with check (true);
create policy "auth_all" on art_quality_checklist_completions for all using (true) with check (true);
create policy "auth_all" on standortbestimmung_dimensionen   for all using (true) with check (true);
create policy "auth_all" on art_standortbestimmung           for all using (true) with check (true);
create policy "auth_all" on art_timeline_entries             for all using (true) with check (true);
create policy "auth_all" on team_types                       for all using (true) with check (true);
create policy "auth_all" on team_team_types                  for all using (true) with check (true);
create policy "auth_all" on ai_use_case_team_types           for all using (true) with check (true);
