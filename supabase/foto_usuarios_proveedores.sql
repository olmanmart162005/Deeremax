-- ==============================================================================
-- Deeremax: Migración Idempotente para Fotografías de Usuarios y Productores
-- Ejecuta este script en el editor SQL de Supabase para configurar Storage y Tablas
-- ==============================================================================

-- 1. Asegurar columna foto_url en tabla productores
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'productores') then
    alter table public.productores add column if not exists foto_url text;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'producers') then
    alter table public.producers add column if not exists foto_url text;
  end if;
end $$;

-- 2. Crear tabla de perfiles de usuario si no existe
create table if not exists public.perfiles_usuario (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  email text,
  telefono text,
  cargo text default 'Operaciones',
  rol text default 'Operador',
  foto_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists perfiles_usuario_email_idx on public.perfiles_usuario (email);

-- Triggers de actualización automática de timestamp
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_perfiles_usuario_updated_at on public.perfiles_usuario;
create trigger trg_perfiles_usuario_updated_at
before update on public.perfiles_usuario
for each row execute function public.set_updated_at();

-- Habilitar RLS en perfiles_usuario
alter table public.perfiles_usuario enable row level security;

-- Políticas de RLS para perfiles de usuario
drop policy if exists perfiles_usuario_select_authenticated on public.perfiles_usuario;
create policy perfiles_usuario_select_authenticated on public.perfiles_usuario
for select to authenticated using (true);

drop policy if exists perfiles_usuario_insert_authenticated on public.perfiles_usuario;
create policy perfiles_usuario_insert_authenticated on public.perfiles_usuario
for insert to authenticated with check (auth.uid() = id or true);

drop policy if exists perfiles_usuario_update_authenticated on public.perfiles_usuario;
create policy perfiles_usuario_update_authenticated on public.perfiles_usuario
for update to authenticated using (true) with check (true);

drop policy if exists perfiles_usuario_delete_authenticated on public.perfiles_usuario;
create policy perfiles_usuario_delete_authenticated on public.perfiles_usuario
for delete to authenticated using (auth.uid() = id);

-- 3. Configuración de Supabase Storage para el bucket 'avatars'
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

-- Políticas de Storage para el bucket 'avatars'
drop policy if exists "Avatars acceso público de lectura" on storage.objects;
create policy "Avatars acceso público de lectura" on storage.objects
for select using (bucket_id = 'avatars');

drop policy if exists "Avatars subida para usuarios autenticados" on storage.objects;
create policy "Avatars subida para usuarios autenticados" on storage.objects
for insert to authenticated with check (bucket_id = 'avatars');

drop policy if exists "Avatars actualización para usuarios autenticados" on storage.objects;
create policy "Avatars actualización para usuarios autenticados" on storage.objects
for update to authenticated using (bucket_id = 'avatars') with check (bucket_id = 'avatars');

drop policy if exists "Avatars eliminación para usuarios autenticados" on storage.objects;
create policy "Avatars eliminación para usuarios autenticados" on storage.objects
for delete to authenticated using (bucket_id = 'avatars');
