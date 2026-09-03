import { supabase } from '../lib/supabase'
import type { NotificacionSistema } from '../types'

export const NOTIFICACIONES_INICIALES: NotificacionSistema[] = [
  {
    id: 'notif_001',
    titulo: 'Protección Biométrica Habilitada',
    mensaje: 'La autenticación biométrica WebAuthn está disponible para tu dispositivo.',
    tipo: 'security',
    leida: false,
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'notif_002',
    titulo: 'Reporte Semanal Consolidado',
    mensaje: 'Los registros de empaque de la semana actual se han actualizado correctamente.',
    tipo: 'success',
    leida: false,
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: 'notif_003',
    titulo: 'Control de Productores',
    mensaje: 'Se han sincronizado los parámetros de rendimiento y variedades Americana e Hindú.',
    tipo: 'info',
    leida: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
]

const STORAGE_NOTIF_KEY = 'deeremax_notificaciones_cache'

const getNotificacionesLocales = (_userId?: string): NotificacionSistema[] => {
  try {
    const raw = localStorage.getItem(STORAGE_NOTIF_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_NOTIF_KEY, JSON.stringify(NOTIFICACIONES_INICIALES))
      return NOTIFICACIONES_INICIALES
    }
    const parsed = JSON.parse(raw) as NotificacionSistema[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : NOTIFICACIONES_INICIALES
  } catch {
    return NOTIFICACIONES_INICIALES
  }
}

const saveNotificacionesLocales = (lista: NotificacionSistema[]) => {
  try {
    localStorage.setItem(STORAGE_NOTIF_KEY, JSON.stringify(lista))
  } catch (e) {
    console.warn('[Notificaciones] Advertencia al guardar localmente:', e)
  }
}

export const obtenerNotificaciones = async (userId?: string): Promise<NotificacionSistema[]> => {
  if (!supabase) {
    return getNotificacionesLocales(userId)
  }

  try {
    const { data, error } = await supabase
      .from('notificaciones')
      .select('*')
      .or(`user_id.is.null,user_id.eq.${userId || '00000000-0000-0000-0000-000000000000'}`)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.warn('[Notificaciones] Consulta en Supabase falló:', error.message)
      return getNotificacionesLocales(userId)
    }

    if (data && data.length > 0) {
      return data as NotificacionSistema[]
    }

    return getNotificacionesLocales(userId)
  } catch (err) {
    console.warn('[Notificaciones] Excepción al consultar:', err)
    return getNotificacionesLocales(userId)
  }
}

export const marcarNotificacionLeida = async (
  notificacionId: string,
  userId?: string,
): Promise<void> => {
  const locales = getNotificacionesLocales(userId)
  const target = locales.find((n) => n.id === notificacionId)
  if (target) {
    target.leida = true
    saveNotificacionesLocales(locales)
  }

  if (supabase) {
    try {
      await supabase.from('notificaciones').update({ leida: true }).eq('id', notificacionId)
    } catch (err) {
      console.warn('[Notificaciones] Error al actualizar en DB:', err)
    }
  }
}

export const marcarTodasLeidas = async (userId?: string): Promise<void> => {
  const locales = getNotificacionesLocales(userId)
  locales.forEach((n) => {
    n.leida = true
  })
  saveNotificacionesLocales(locales)

  if (supabase && userId) {
    try {
      await supabase.from('notificaciones').update({ leida: true }).eq('user_id', userId)
    } catch (err) {
      console.warn('[Notificaciones] Error al actualizar todas en DB:', err)
    }
  }
}

export const agregarNotificacion = async (
  payload: Omit<NotificacionSistema, 'id' | 'created_at' | 'leida'>,
): Promise<NotificacionSistema> => {
  const nueva: NotificacionSistema = {
    id: `notif_${Date.now()}`,
    ...payload,
    leida: false,
    created_at: new Date().toISOString(),
  }

  const locales = getNotificacionesLocales()
  locales.unshift(nueva)
  saveNotificacionesLocales(locales)

  if (supabase) {
    try {
      await supabase.from('notificaciones').insert({
        id: nueva.id,
        user_id: nueva.user_id ?? null,
        titulo: nueva.titulo,
        mensaje: nueva.mensaje,
        tipo: nueva.tipo,
        leida: false,
        enlace: nueva.enlace ?? null,
        metadata: nueva.metadata ?? null,
        created_at: nueva.created_at,
      })
    } catch (err) {
      console.warn('[Notificaciones] Error al insertar en DB:', err)
    }
  }

  return nueva
}
