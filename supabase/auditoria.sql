-- Execute this in Supabase SQL editor.
create table if not exists public.auditoria_eventos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  accion text not null,
  descripcion text not null,
  modulo text not null,
  usuario_id uuid references auth.users(id) on delete set null,
  usuario_email text,
  usuario_nombre text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists auditoria_eventos_created_at_idx on public.auditoria_eventos (created_at desc);
create index if not exists auditoria_eventos_modulo_idx on public.auditoria_eventos (modulo);
create index if not exists auditoria_eventos_tipo_idx on public.auditoria_eventos (tipo);
create index if not exists auditoria_eventos_usuario_email_idx on public.auditoria_eventos (usuario_email);

alter table public.auditoria_eventos enable row level security;

drop policy if exists auditoria_eventos_select_authenticated on public.auditoria_eventos;
create policy auditoria_eventos_select_authenticated on public.auditoria_eventos
for select to authenticated using (true);

drop policy if exists auditoria_eventos_insert_authenticated on public.auditoria_eventos;
drop policy if exists auditoria_eventos_insert_all on public.auditoria_eventos;
create policy auditoria_eventos_insert_all on public.auditoria_eventos
for insert to authenticated, anon with check (true);
