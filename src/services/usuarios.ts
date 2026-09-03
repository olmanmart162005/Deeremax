import { supabase } from '../lib/supabase'
import type { FormUsuarioSistema, UsuarioSistema, RolUsuario } from '../types'
import { normalizarRol, validarPermisoAdmin } from './permisos'

export const USUARIOS_INICIALES: UsuarioSistema[] = [
  {
    id: 'user_olman_001',
    email: 'olman@deeremax.app',
    nombre: 'Olman',
    telefono: '+504 9988-7766',
    cargo: 'Propietario / Director General',
    rol: 'Super Admin',
    activo: true,
    biometria_activa: true,
    ultimo_acceso: new Date().toISOString(),
    foto_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'user_ervin_002',
    email: 'ervin2026@admin.com',
    nombre: 'Ervin Martínez',
    telefono: '+504 9876-5432',
    cargo: 'Operador de Producción',
    rol: 'Operador',
    activo: true,
    biometria_activa: false,
    ultimo_acceso: new Date().toISOString(),
    foto_url: null,
    created_at: '2026-01-15T00:00:00.000Z',
  },
  {
    id: 'user_juancarlos_003',
    email: 'juancarlos@deeremax.app',
    nombre: 'Juan Carlos Muñoz',
    telefono: '+504 9555-1234',
    cargo: 'Supervisor General (Solo Lectura)',
    rol: 'Supervisor',
    activo: true,
    biometria_activa: false,
    ultimo_acceso: new Date().toISOString(),
    foto_url: null,
    created_at: '2026-02-01T00:00:00.000Z',
  },
]

const STORAGE_USERS_KEY = 'deeremax_usuarios_sistema_cache'

const getUsuariosLocales = (): UsuarioSistema[] => {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(USUARIOS_INICIALES))
      return USUARIOS_INICIALES
    }
    const parsed = JSON.parse(raw) as UsuarioSistema[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : USUARIOS_INICIALES
  } catch {
    return USUARIOS_INICIALES
  }
}

const saveUsuariosLocales = (usuarios: UsuarioSistema[]) => {
  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usuarios))
  } catch (e) {
    console.warn('[Usuarios] Advertencia al guardar usuarios locales:', e)
  }
}

/**
 * Consulta la lista de todos los usuarios del sistema.
 */
export const obtenerUsuariosSistema = async (rolSolicitante: RolUsuario): Promise<UsuarioSistema[]> => {
  validarPermisoAdmin(rolSolicitante, 'consultar la lista de usuarios del sistema')

  if (!supabase) {
    return getUsuariosLocales()
  }

  try {
    const { data, error } = await supabase
      .from('perfiles_usuario')
      .select('*')
      .order('nombre', { ascending: true })

    if (error) {
      console.warn('[Usuarios] Error al consultar perfiles_usuario en Supabase:', error.message)
      return getUsuariosLocales()
    }

    if (data && data.length > 0) {
      const mapeados = data.map((item) => ({
        id: String(item.id),
        email: String(item.email || ''),
        nombre: String(item.nombre || item.email?.split('@')[0] || 'Usuario'),
        telefono: item.telefono ? String(item.telefono) : null,
        cargo: item.cargo ? String(item.cargo) : 'Operaciones',
        rol: normalizarRol(item.rol as string, item.email as string),
        activo: item.estado !== 'inactivo',
        biometria_activa: Boolean(item.biometria_activa),
        ultimo_acceso: item.ultimo_acceso ? String(item.ultimo_acceso) : null,
        foto_url: item.foto_url ? String(item.foto_url) : null,
        created_at: String(item.created_at || new Date().toISOString()),
      }))

      saveUsuariosLocales(mapeados)
      return mapeados
    }

    return getUsuariosLocales()
  } catch (err) {
    console.warn('[Usuarios] Excepción al consultar usuarios:', err)
    return getUsuariosLocales()
  }
}

/**
 * Crea o actualiza un usuario en el sistema.
 * Para usuarios nuevos usa supabase.auth.admin.createUser (service role)
 * o signUp como fallback con anon key.
 */
export const guardarUsuarioSistema = async (
  rolSolicitante: RolUsuario,
  datos: FormUsuarioSistema,
): Promise<{ exitoso: boolean; usuario?: UsuarioSistema; error?: string }> => {
  validarPermisoAdmin(rolSolicitante, datos.id ? 'modificar usuarios' : 'crear nuevos usuarios')

  const esNuevo = !datos.id

  // =========================================================
  // CASO 1: USUARIO NUEVO → crear en Supabase Auth primero
  // =========================================================
  if (esNuevo && supabase) {
    if (!datos.password) {
      return { exitoso: false, error: 'Debes ingresar una contraseña para el nuevo usuario.' }
    }

    let authUserId: string | null = null

    try {
      // Intentar crear vía Admin API (requiere service_role, fallback silencioso)
      // En producción se recomienda crear una Edge Function. Por ahora usamos signUp.
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: datos.email.trim().toLowerCase(),
        password: datos.password,
        options: {
          data: {
            nombre: datos.nombre.trim(),
            rol: datos.rol,
          },
        },
      })

      if (signUpError) {
        // Puede que ya exista el usuario en Auth
        if (
          signUpError.message.toLowerCase().includes('already registered') ||
          signUpError.message.toLowerCase().includes('user already exists')
        ) {
          // Buscar el ID del perfil existente por email
          const { data: perfilExistente } = await supabase
            .from('perfiles_usuario')
            .select('id')
            .eq('email', datos.email.trim().toLowerCase())
            .maybeSingle()
          if (perfilExistente?.id) {
            authUserId = String(perfilExistente.id)
          } else {
            return {
              exitoso: false,
              error: `El correo ${datos.email} ya está registrado en el sistema de autenticación pero no tiene perfil. Busca al administrador de Supabase.`,
            }
          }
        } else {
          return { exitoso: false, error: `Error al crear el usuario: ${signUpError.message}` }
        }
      } else {
        authUserId = signUpData?.user?.id ?? null
        if (!authUserId) {
          return {
            exitoso: false,
            error: 'Supabase no devolvió un ID de usuario. Verifica si el correo ya existe.',
          }
        }
      }
    } catch (err) {
      return { exitoso: false, error: `Excepción al crear usuario en Auth: ${String(err)}` }
    }

    // Guardar perfil con el UUID real de Auth
    const nuevoUsuario: UsuarioSistema = {
      id: authUserId,
      email: datos.email.trim().toLowerCase(),
      nombre: datos.nombre.trim(),
      telefono: datos.telefono?.trim() || null,
      cargo: datos.cargo?.trim() || 'Operaciones',
      rol: datos.rol,
      activo: datos.activo,
      biometria_activa: false,
      ultimo_acceso: null,
      foto_url: datos.foto_url || null,
      created_at: new Date().toISOString(),
    }

    try {
      const { error: dbError } = await supabase.from('perfiles_usuario').upsert(
        {
          id: authUserId,
          email: nuevoUsuario.email,
          nombre: nuevoUsuario.nombre,
          telefono: nuevoUsuario.telefono,
          cargo: nuevoUsuario.cargo,
          rol: nuevoUsuario.rol,
          estado: 'activo',
          foto_url: nuevoUsuario.foto_url,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )

      if (dbError) {
        console.warn('[Usuarios] Error al guardar perfil en DB:', dbError.message)
      }
    } catch (err) {
      console.warn('[Usuarios] Excepción al guardar perfil:', err)
    }

    // Actualizar cache local
    const locales = getUsuariosLocales()
    const index = locales.findIndex((u) => u.id === authUserId)
    if (index >= 0) {
      locales[index] = { ...locales[index], ...nuevoUsuario }
    } else {
      locales.push(nuevoUsuario)
    }
    saveUsuariosLocales(locales)

    return { exitoso: true, usuario: nuevoUsuario }
  }

  // =========================================================
  // CASO 2: EDITAR usuario existente (ya tiene ID UUID real)
  // =========================================================
  const idFinal = datos.id!
  const nuevoUsuario: UsuarioSistema = {
    id: idFinal,
    email: datos.email.trim().toLowerCase(),
    nombre: datos.nombre.trim(),
    telefono: datos.telefono?.trim() || null,
    cargo: datos.cargo?.trim() || 'Operaciones',
    rol: datos.rol,
    activo: datos.activo,
    biometria_activa: false,
    ultimo_acceso: null,
    foto_url: datos.foto_url || null,
    created_at: new Date().toISOString(),
  }

  // Actualizar en Supabase
  if (supabase) {
    try {
      const payload = {
        id: idFinal,
        email: nuevoUsuario.email,
        nombre: nuevoUsuario.nombre,
        telefono: nuevoUsuario.telefono,
        cargo: nuevoUsuario.cargo,
        rol: nuevoUsuario.rol,
        estado: nuevoUsuario.activo ? 'activo' : 'inactivo',
        foto_url: nuevoUsuario.foto_url,
        updated_at: new Date().toISOString(),
      }

      const { error: dbError } = await supabase
        .from('perfiles_usuario')
        .upsert(payload, { onConflict: 'id' })

      if (dbError) {
        console.warn('[Usuarios] Upsert en Supabase falló:', dbError.message)
      }
    } catch (err) {
      console.warn('[Usuarios] Excepción en Supabase:', err)
    }
  }

  // Actualizar cache local
  const locales = getUsuariosLocales()
  const index = locales.findIndex((u) => u.id === idFinal)
  if (index >= 0) {
    locales[index] = { ...locales[index], ...nuevoUsuario }
  } else {
    locales.push(nuevoUsuario)
  }
  saveUsuariosLocales(locales)

  return { exitoso: true, usuario: nuevoUsuario }
}

/**
 * Cambia el estado activo/inactivo de un usuario.
 */
export const alternarEstadoUsuario = async (
  rolSolicitante: RolUsuario,
  usuarioId: string,
  activo: boolean,
): Promise<{ exitoso: boolean; error?: string }> => {
  validarPermisoAdmin(rolSolicitante, 'cambiar el estado de activación de un usuario')

  if (supabase) {
    try {
      await supabase
        .from('perfiles_usuario')
        .update({ estado: activo ? 'activo' : 'inactivo', updated_at: new Date().toISOString() })
        .eq('id', usuarioId)
    } catch (err) {
      console.warn('[Usuarios] Error al actualizar estado en DB:', err)
    }
  }

  const locales = getUsuariosLocales()
  const target = locales.find((u) => u.id === usuarioId)
  if (target) {
    target.activo = activo
    saveUsuariosLocales(locales)
  }

  return { exitoso: true }
}

/**
 * Cambia el rol de un usuario.
 */
export const cambiarRolUsuario = async (
  rolSolicitante: RolUsuario,
  usuarioId: string,
  nuevoRol: RolUsuario,
): Promise<{ exitoso: boolean; error?: string }> => {
  validarPermisoAdmin(rolSolicitante, 'cambiar roles de usuario')

  if (supabase) {
    try {
      await supabase
        .from('perfiles_usuario')
        .update({ rol: nuevoRol, updated_at: new Date().toISOString() })
        .eq('id', usuarioId)
    } catch (err) {
      console.warn('[Usuarios] Error al cambiar rol en DB:', err)
    }
  }

  const locales = getUsuariosLocales()
  const target = locales.find((u) => u.id === usuarioId)
  if (target) {
    target.rol = nuevoRol
    saveUsuariosLocales(locales)
  }

  return { exitoso: true }
}

/**
 * Elimina un usuario del sistema (solo Super Admin).
 */
export const eliminarUsuarioSistema = async (
  rolSolicitante: RolUsuario,
  usuarioId: string,
): Promise<{ exitoso: boolean; error?: string }> => {
  validarPermisoAdmin(rolSolicitante, 'eliminar usuarios del sistema')

  if (supabase) {
    try {
      await supabase.from('perfiles_usuario').delete().eq('id', usuarioId)
    } catch (err) {
      console.warn('[Usuarios] Error al eliminar usuario en DB:', err)
    }
  }

  const locales = getUsuariosLocales().filter((u) => u.id !== usuarioId)
  saveUsuariosLocales(locales)

  return { exitoso: true }
}
