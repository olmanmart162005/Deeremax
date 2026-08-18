import { supabase } from '../lib/supabase'
import type { FormPerfilUsuario, PerfilUsuario } from '../types'

const formatearNombrePorDefecto = (email: string) => {
  const base = email.split('@')[0].replace(/[._-]+/g, ' ').trim()
  if (base.toLowerCase() === 'ervin2026') return 'Ervin Martínez'
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
    'Operaciones'

  const rol =
    (row?.rol as string | undefined)?.trim() ||
    (metadata?.rol as string | undefined)?.trim() ||
    (email.toLowerCase().includes('admin') || email.toLowerCase() === 'ervin2026@admin.com' ? 'Administrador' : 'Operador')

  const foto_url =
    (row?.foto_url as string | undefined)?.trim() ||
    (metadata?.avatar_url as string | undefined)?.trim() ||
    (metadata?.foto_url as string | undefined)?.trim() ||
    null

  return {
    id: userId,
    email,
    nombre,
    telefono,
    cargo,
    rol,
    foto_url,
    created_at: (row?.created_at as string | undefined) ?? new Date().toISOString(),
    updated_at: (row?.updated_at as string | undefined) ?? new Date().toISOString(),
  }
}

/**
 * Consulta el perfil del usuario actual desde la tabla 'perfiles_usuario' o 'profiles',
 * combinando con los metadatos de autenticación de Supabase.
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
      // Si la tabla no existe todavía, usamos los metadatos de auth de forma transparente
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
    rol: email.toLowerCase().includes('admin') || email.toLowerCase() === 'ervin2026@admin.com' ? 'Administrador' : 'Operador',
    foto_url: datos.foto_url || null,
    updated_at: new Date().toISOString(),
  }

  return { perfil: perfilActualizado, error: errorMsg }
}
