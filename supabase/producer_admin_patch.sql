-- Run this patch once in Supabase SQL editor if your current DB was created before admin module.
alter table public.producers add column if not exists is_active boolean not null default true;

create unique index if not exists producers_code_unique_idx on public.producers (code) where code is not null;
create unique index if not exists producers_name_ci_unique_idx on public.producers ((lower(name)));

drop policy if exists producers_update_authenticated on public.producers;
create policy producers_update_authenticated on public.producers
for update to authenticated using (true) with check (true);

drop policy if exists producers_delete_authenticated on public.producers;
create policy producers_delete_authenticated on public.producers
for delete to authenticated using (true);

-- Normalize existing codes to P-format optionally if desired.
-- Example manual update pattern:
-- update public.producers set code = 'P001' where id = '...';
