import { supabase } from '../lib/supabase'

export type TipoEventoAuditoria =
  | 'create'
  | 'update'
  | 'delete'
  | 'auth'
  | 'export'
  | 'config'
  | 'user'
  | 'permission'
  | 'system'

export type EventoAuditoriaPayload = {
  tipo: TipoEventoAuditoria
  accion: string
  descripcion: string
  modulo: string
  usuarioId?: string | null
  usuarioEmail?: string | null
  usuarioNombre?: string | null
  metadata?: Record<string, unknown> | null
}

export type EventoAuditoria = {
  id: string
  tipo: TipoEventoAuditoria
  accion: string
  descripcion: string
  modulo: string
  usuarioId: string | null
  usuarioEmail: string | null
  usuarioNombre: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

const toTipoEvento = (value: unknown): TipoEventoAuditoria => {
  const text = String(value ?? '').trim().toLowerCase()
  if (text === 'create' || text === 'update' || text === 'delete' || text === 'auth' || text === 'export' || text === 'config' || text === 'user' || text === 'permission' || text === 'system') {
    return text
  }
  return 'system'
}

export const normalizarEventoAuditoria = (row: Record<string, unknown>): EventoAuditoria => {
  return {
    id: String(row.id ?? ''),
    tipo: toTipoEvento(row.tipo),
    accion: String(row.accion ?? '').trim() || 'N/A',
    descripcion: String(row.descripcion ?? '').trim() || 'Sin descripcion',
    modulo: String(row.modulo ?? '').trim() || 'General',
    usuarioId: row.usuario_id ? String(row.usuario_id) : null,
    usuarioEmail: row.usuario_email ? String(row.usuario_email) : null,
    usuarioNombre: row.usuario_nombre ? String(row.usuario_nombre) : null,
    metadata: row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  }
}

export const registrarEventoAuditoria = async (payload: EventoAuditoriaPayload) => {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    // Si no hay sesión autenticada activa (ej. usuario deslogueado o en pantalla de login),
    // no enviar la mutación para no disparar 401 / 42501 de RLS en consola
    if (!sessionData?.session) {
      return { error: null }
    }

    const { error } = await supabase.from('auditoria_eventos').insert({
      tipo: payload.tipo,
      accion: payload.accion,
      descripcion: payload.descripcion,
      modulo: payload.modulo,
      usuario_id: payload.usuarioId ?? sessionData.session.user.id ?? null,
      usuario_email: payload.usuarioEmail ?? sessionData.session.user.email ?? null,
      usuario_nombre: payload.usuarioNombre ?? null,
      metadata: payload.metadata ?? null,
    })

    if (error) {
      if (error.code !== '42501' && !error.message?.includes('violates row-level security')) {
        console.warn('[Supabase] Auditoria info:', error.message)
      }
    }

    return { error }
  } catch {
    return { error: null }
  }
}
