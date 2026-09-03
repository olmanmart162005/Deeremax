-- ==============================================================================
-- Deeremax ERP: Migración de WebAuthn Biometría, Roles RBAC y Seguridad
-- ==============================================================================

-- 1. Tabla para Credenciales Públicas WebAuthn (FIDO2 / Biometría de Dispositivo)
-- IMPORTANTE: Solo almacena metadatos públicos de la credencial criptográfica.
-- NUNCA almacena huellas, rostros, imágenes biométricas, PINs ni claves privadas.
create table if not exists public.webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique, -- Credential ID codificado en base64url
  public_key text not null,          -- Clave pública codificada en base64url / DER
  algorithm integer not null default -7, -- -7 = ES256, -257 = RS256
  sign_counter bigint not null default 0,
  device_name text not null default 'Dispositivo Biomédico',
  authenticator_attachment text default 'platform',
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

create index if not exists webauthn_credentials_user_idx on public.webauthn_credentials (user_id);
create index if not exists webauthn_credentials_cred_id_idx on public.webauthn_credentials (credential_id);

-- 2. Asegurar campos en perfiles_usuario
alter table public.perfiles_usuario add column if not exists rol text default 'Operador';
alter table public.perfiles_usuario add column if not exists estado text default 'activo';
alter table public.perfiles_usuario add column if not exists ultimo_acceso timestamptz;
alter table public.perfiles_usuario add column if not exists biometria_activa boolean default false;

-- 3. Tabla para Notificaciones del Sistema
create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade, -- null = para todos
  titulo text not null,
  mensaje text not null,
  tipo text not null default 'info', -- 'info' | 'success' | 'warning' | 'security'
  leida boolean not null default false,
  enlace text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notificaciones_user_idx on public.notificaciones (user_id, leida, created_at desc);

-- 4. Funciones auxiliares para validación de roles en RLS
create or replace function public.obtener_rol_usuario(p_user_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  v_rol text;
begin
  select coalesce(rol, 'Operador') into v_rol
  from public.perfiles_usuario
  where id = p_user_id;

  return coalesce(v_rol, 'Operador');
end;
$$;

create or replace function public.puede_escribir(p_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_rol text;
begin
  v_rol := public.obtener_rol_usuario(p_user_id);
  -- Juan Carlos (Supervisor) es SOLO LECTURA. Super Admin y Operador pueden escribir.
  return v_rol in ('Super Admin', 'Administrador', 'Operador');
end;
$$;

create or replace function public.es_super_admin(p_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_rol text;
begin
  v_rol := public.obtener_rol_usuario(p_user_id);
  return v_rol in ('Super Admin', 'Administrador');
end;
$$;

-- 5. RLS en webauthn_credentials
alter table public.webauthn_credentials enable row level security;

drop policy if exists webauthn_select_policy on public.webauthn_credentials;
create policy webauthn_select_policy on public.webauthn_credentials
for select to authenticated
using (user_id = auth.uid() or public.es_super_admin(auth.uid()));

drop policy if exists webauthn_insert_policy on public.webauthn_credentials;
create policy webauthn_insert_policy on public.webauthn_credentials
for insert to authenticated
with check (user_id = auth.uid() or public.es_super_admin(auth.uid()));

drop policy if exists webauthn_update_policy on public.webauthn_credentials;
create policy webauthn_update_policy on public.webauthn_credentials
for update to authenticated
using (user_id = auth.uid() or public.es_super_admin(auth.uid()))
with check (user_id = auth.uid() or public.es_super_admin(auth.uid()));

drop policy if exists webauthn_delete_policy on public.webauthn_credentials;
create policy webauthn_delete_policy on public.webauthn_credentials
for delete to authenticated
using (user_id = auth.uid() or public.es_super_admin(auth.uid()));

-- 6. RLS en notificaciones
alter table public.notificaciones enable row level security;

drop policy if exists notificaciones_select_policy on public.notificaciones;
create policy notificaciones_select_policy on public.notificaciones
for select to authenticated
using (user_id is null or user_id = auth.uid());

drop policy if exists notificaciones_update_policy on public.notificaciones;
create policy notificaciones_update_policy on public.notificaciones
for update to authenticated
using (user_id is null or user_id = auth.uid())
with check (user_id is null or user_id = auth.uid());

-- 7. Actualización de Políticas RLS para Productores y Reportes con Restricción de Supervisor
-- Productores
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'productores') then
    alter table public.productores enable row level security;

    drop policy if exists productores_select_policy on public.productores;
    create policy productores_select_policy on public.productores
    for select to authenticated using (true);

    drop policy if exists productores_insert_policy on public.productores;
    create policy productores_insert_policy on public.productores
    for insert to authenticated
    with check (public.puede_escribir(auth.uid()));

    drop policy if exists productores_update_policy on public.productores;
    create policy productores_update_policy on public.productores
    for update to authenticated
    using (public.puede_escribir(auth.uid()))
    with check (public.puede_escribir(auth.uid()));

    drop policy if exists productores_delete_policy on public.productores;
    create policy productores_delete_policy on public.productores
    for delete to authenticated
    using (public.es_super_admin(auth.uid()));
  end if;
end $$;

-- Reportes
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'reportes') then
    alter table public.reportes enable row level security;

    drop policy if exists reportes_select_policy on public.reportes;
    create policy reportes_select_policy on public.reportes
    for select to authenticated using (true);

    drop policy if exists reportes_insert_policy on public.reportes;
    create policy reportes_insert_policy on public.reportes
    for insert to authenticated
    with check (public.puede_escribir(auth.uid()));

    drop policy if exists reportes_update_policy on public.reportes;
    create policy reportes_update_policy on public.reportes
    for update to authenticated
    using (public.puede_escribir(auth.uid()))
    with check (public.puede_escribir(auth.uid()));

    drop policy if exists reportes_delete_policy on public.reportes;
    create policy reportes_delete_policy on public.reportes
    for delete to authenticated
    using (public.es_super_admin(auth.uid()));
  end if;
end $$;

-- Detalle Reporte
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'detalle_reporte') then
    alter table public.detalle_reporte enable row level security;

    drop policy if exists detalle_reporte_select_policy on public.detalle_reporte;
    create policy detalle_reporte_select_policy on public.detalle_reporte
    for select to authenticated using (true);

    drop policy if exists detalle_reporte_insert_policy on public.detalle_reporte;
    create policy detalle_reporte_insert_policy on public.detalle_reporte
    for insert to authenticated
    with check (public.puede_escribir(auth.uid()));

    drop policy if exists detalle_reporte_update_policy on public.detalle_reporte;
    create policy detalle_reporte_update_policy on public.detalle_reporte
    for update to authenticated
    using (public.puede_escribir(auth.uid()))
    with check (public.puede_escribir(auth.uid()));

    drop policy if exists detalle_reporte_delete_policy on public.detalle_reporte;
    create policy detalle_reporte_delete_policy on public.detalle_reporte
    for delete to authenticated
    using (public.es_super_admin(auth.uid()));
  end if;
end $$;
