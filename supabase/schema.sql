-- Deeremax production schema
create extension if not exists pgcrypto;

create table if not exists public.producers (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.producers add column if not exists is_active boolean not null default true;
create unique index if not exists producers_code_unique_idx on public.producers (code) where code is not null;
create unique index if not exists producers_name_ci_unique_idx on public.producers ((lower(name)));

create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.producers(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (producer_id, week_start)
);

create table if not exists public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  weekly_report_id uuid not null references public.weekly_reports(id) on delete cascade,
  entry_date date not null,
  cestas_a integer not null default 0,
  cestas_h integer not null default 0,
  americana_4 integer not null default 0,
  americana_5 integer not null default 0,
  americana_7 integer not null default 0,
  hindu_4 integer not null default 0,
  hindu_5 integer not null default 0,
  hindu_7 integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (weekly_report_id, entry_date)
);

create index if not exists weekly_reports_producer_idx on public.weekly_reports (producer_id, week_start desc);
create index if not exists daily_entries_weekly_idx on public.daily_entries (weekly_report_id, entry_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_weekly_reports_updated_at on public.weekly_reports;
create trigger trg_weekly_reports_updated_at
before update on public.weekly_reports
for each row execute function public.set_updated_at();

drop trigger if exists trg_daily_entries_updated_at on public.daily_entries;
create trigger trg_daily_entries_updated_at
before update on public.daily_entries
for each row execute function public.set_updated_at();

alter table public.producers enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.daily_entries enable row level security;

-- All authenticated users can read producers and reports.
drop policy if exists producers_select_authenticated on public.producers;
create policy producers_select_authenticated on public.producers
for select to authenticated using (true);

drop policy if exists producers_insert_authenticated on public.producers;
create policy producers_insert_authenticated on public.producers
for insert to authenticated with check (true);

drop policy if exists producers_update_authenticated on public.producers;
create policy producers_update_authenticated on public.producers
for update to authenticated using (true) with check (true);

drop policy if exists producers_delete_authenticated on public.producers;
create policy producers_delete_authenticated on public.producers
for delete to authenticated using (true);

drop policy if exists weekly_reports_select_authenticated on public.weekly_reports;
create policy weekly_reports_select_authenticated on public.weekly_reports
for select to authenticated using (true);

drop policy if exists weekly_reports_insert_authenticated on public.weekly_reports;
create policy weekly_reports_insert_authenticated on public.weekly_reports
for insert to authenticated with check (created_by = auth.uid());

drop policy if exists weekly_reports_update_authenticated on public.weekly_reports;
create policy weekly_reports_update_authenticated on public.weekly_reports
for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists weekly_reports_delete_authenticated on public.weekly_reports;
create policy weekly_reports_delete_authenticated on public.weekly_reports
for delete to authenticated using (created_by = auth.uid());

drop policy if exists daily_entries_select_authenticated on public.daily_entries;
create policy daily_entries_select_authenticated on public.daily_entries
for select to authenticated using (true);

drop policy if exists daily_entries_insert_authenticated on public.daily_entries;
create policy daily_entries_insert_authenticated on public.daily_entries
for insert to authenticated
with check (
  exists (
    select 1
    from public.weekly_reports wr
    where wr.id = weekly_report_id
      and wr.created_by = auth.uid()
  )
);

drop policy if exists daily_entries_update_authenticated on public.daily_entries;
create policy daily_entries_update_authenticated on public.daily_entries
for update to authenticated
using (
  exists (
    select 1
    from public.weekly_reports wr
    where wr.id = daily_entries.weekly_report_id
      and wr.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.weekly_reports wr
    where wr.id = daily_entries.weekly_report_id
      and wr.created_by = auth.uid()
  )
);

drop policy if exists daily_entries_delete_authenticated on public.daily_entries;
create policy daily_entries_delete_authenticated on public.daily_entries
for delete to authenticated
using (
  exists (
    select 1
    from public.weekly_reports wr
    where wr.id = daily_entries.weekly_report_id
      and wr.created_by = auth.uid()
  )
);

insert into public.producers (name, code)
values
('Juan Carlos 001 finca', '001'),
('YORYI', '119'),
('FAUTO', '115'),
('Jose osabas', '105'),
('KEVIN FLORES', '101'),
('Rene Gonzales', '94'),
('LILIAN MAIRENA', '88'),
('HECTOR RUEDA', '56'),
('CHANGAY', '85'),
('OLMAN LAGOS', '104'),
('Arturo americana', '108'),
('jose ordoñez', '112'),
('Arturo hindu', '114'),
('RAMON ECALANTE', '68'),
('JOSE  MARADIAGA', '109'),
('Gerson', '118'),
('oneyda', '116'),
('ROGER OSORTO', '74'),
('JAIME MARTINEZ', '38'),
('jose alexander', '89'),
('Omar viera', '91'),
('ERIC', '113'),
('GERMAN', '111'),
('EFRAIN', '80')
on conflict (name) do nothing;
