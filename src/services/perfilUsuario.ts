import { supabase } from '../lib/supabase'
import type { FormPerfilUsuario, PerfilUsuario } from '../types'
import { normalizarRol } from './permisos'

export const formatearNombrePorDefecto = (email: string) => {
  const base = email.split('@')[0].replace(/[._-]+/g, ' ').trim()
  if (base.toLowerCase() === 'ervin2026' || base.toLowerCase() === 'ervin') return 'Ervin Martínez'
  if (base.toLowerCase() === 'olman' || base.toLowerCase() === 'olman2026') return 'Olman'
  if (base.toLowerCase() === 'juancarlos' || base.toLowerCase() === 'jcmunoz') return 'Juan Carlos Muñoz'
  return base
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export const normalizarPerfil = (
  userId: string,
  email: string,
  row?: Record<string, unknown> | null,
  metadata?: Record<string, unknown> | null,
): PerfilUsuario => {
  const nombrePorDefecto = formatearNombrePorDefecto(email)

  const nombre =
    (row?.nombre as string | undefined)?.trim() ||
    (metadata?.full_name as string | undefined)?.trim() ||
    (metadata?.nombre as string | undefined)?.trim() ||
    nombrePorDefecto

  const telefono =
    (row?.telefono as string | undefined)?.trim() ||
    (metadata?.telefono as string | undefined)?.trim() ||
    (metadata?.phone as string | undefined)?.trim() ||
    null

  const cargo =
    (row?.cargo as string | undefined)?.trim() ||
    (metadata?.cargo as string | undefined)?.trim() ||
    (email.toLowerCase().includes('olman')
      ? 'Director General'
      : email.toLowerCase().includes('juancarlos')
        ? 'Supervisor General'
        : 'Operaciones')

  const rol = normalizarRol(
    (row?.rol as string | undefined) || (metadata?.rol as string | undefined),
    email,
  )

  let foto_url =
    (row?.foto_url as string | undefined)?.trim() ||
    (metadata?.avatar_url as string | undefined)?.trim() ||
    (metadata?.foto_url as string | undefined)?.trim() ||
    null

  if (foto_url && foto_url.includes('fbcdn.net')) {
    try {
      const urlObj = new URL(foto_url)
      const oe = urlObj.searchParams.get('oe')
      if (oe) {
        const exp = parseInt(oe, 16)
        if (Math.floor(Date.now() / 1000) > exp) {
          foto_url = null
        }
      }
    } catch {
      foto_url = null
    }
  }

  const biometria_activa = Boolean(row?.biometria_activa ?? metadata?.biometria_activa ?? false)

  return {
    id: userId,
    email,
    nombre,
    telefono,
    cargo,
    rol,
    estado: (row?.estado as string | undefined) || 'activo',
    foto_url,
    biometria_activa,
    ultimo_acceso: (row?.ultimo_acceso as string | undefined) ?? new Date().toISOString(),
    created_at: (row?.created_at as string | undefined) ?? new Date().toISOString(),
    updated_at: (row?.updated_at as string | undefined) ?? new Date().toISOString(),
  }
}

/**
 * Consulta el perfil del usuario actual desde la tabla 'perfiles_usuario' o metadata de Auth
 */
export const obtenerPerfilUsuario = async (
  userId: string,
  email: string,
  userMetadata?: Record<string, unknown> | null,
): Promise<PerfilUsuario> => {
  if (!supabase) {
    return normalizarPerfil(userId, email, null, userMetadata)
  }

  try {
    const { data, error } = await supabase
      .from('perfiles_usuario')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      const msg = error.message.toLowerCase()
      if (!msg.includes('relation') && !msg.includes('does not exist')) {
        console.warn('[PerfilUsuario] Consulta perfiles_usuario falló:', error.message)
      }
      return normalizarPerfil(userId, email, null, userMetadata)
    }

    return normalizarPerfil(userId, email, data as Record<string, unknown> | null, userMetadata)
  } catch (err) {
    console.warn('[PerfilUsuario] Excepción al consultar perfil:', err)
    return normalizarPerfil(userId, email, null, userMetadata)
  }
}

/**
 * Guarda los cambios del perfil tanto en Auth User Metadata como en la tabla perfiles_usuario.
 */
export const guardarPerfilUsuario = async (
  userId: string,
  email: string,
  datos: FormPerfilUsuario,
): Promise<{ perfil: PerfilUsuario; error?: string }> => {
  let errorMsg: string | undefined

  const rolCalculado = normalizarRol(null, email)

  // 1. Actualizar metadata en Supabase Auth
  if (supabase) {
    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: datos.nombre,
          nombre: datos.nombre,
          telefono: datos.telefono,
          cargo: datos.cargo,
          avatar_url: datos.foto_url,
          foto_url: datos.foto_url,
        },
      })

      if (authError) {
        console.warn('[PerfilUsuario] Error al actualizar auth metadata:', authError.message)
        errorMsg = authError.message
      }
    } catch (err) {
      console.warn('[PerfilUsuario] Excepción en updateUser:', err)
    }

    // 2. Intentar actualizar/insertar en tabla perfiles_usuario
    try {
      const payload = {
        id: userId,
        email,
        nombre: datos.nombre,
        telefono: datos.telefono || null,
        cargo: datos.cargo || null,
        rol: rolCalculado,
        foto_url: datos.foto_url || null,
        updated_at: new Date().toISOString(),
      }

      const { error: dbError } = await supabase
        .from('perfiles_usuario')
        .upsert(payload, { onConflict: 'id' })

      if (dbError) {
        const msg = dbError.message.toLowerCase()
        if (!msg.includes('relation') && !msg.includes('does not exist')) {
          console.warn('[PerfilUsuario] Error al hacer upsert en perfiles_usuario:', dbError.message)
        }
      }
    } catch (err) {
      console.warn('[PerfilUsuario] Excepción en upsert de perfiles_usuario:', err)
    }
  }

  const perfilActualizado: PerfilUsuario = {
    id: userId,
    email,
    nombre: datos.nombre,
    telefono: datos.telefono || null,
    cargo: datos.cargo || 'Operaciones',
    rol: rolCalculado,
    foto_url: datos.foto_url || null,
    updated_at: new Date().toISOString(),
  }

  return { perfil: perfilActualizado, error: errorMsg }
}
