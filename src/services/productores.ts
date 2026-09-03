import { supabase } from '../lib/supabase'
import type { Productor, RolUsuario } from '../types'
import { validarPermisoEscritura } from './permisos'

export type PayloadProductor = {
  codigo: string
  nombre: string
  telefono: string
  finca: string
  sector: string
  observaciones: string
  activo: boolean
  foto_url?: string | null
}

const normalizarNombreProductor = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase()

export const estaActivo = (productor: Productor) => {
  if (typeof productor.activo === 'boolean') return productor.activo
  return true
}

export const guardarProductor = async (
  productorId: string | null,
  payload: PayloadProductor,
  rolSolicitante: RolUsuario = 'Operador',
) => {
  // Validación estricta: Juan Carlos (Supervisor) no puede guardar ni modificar productores
  validarPermisoEscritura(rolSolicitante, productorId ? 'editar este productor' : 'crear nuevos productores')

  const nombre = normalizarNombreProductor(payload.nombre)

  const basePayload: Record<string, unknown> = {
    codigo: payload.codigo,
    nombre,
    telefono: payload.telefono,
    finca: payload.finca,
    sector: payload.sector,
    observaciones: payload.observaciones,
    activo: payload.activo,
    foto_url: payload.foto_url ?? null,
  }

  const query = productorId
    ? supabase.from('productores').update(basePayload).eq('id', productorId)
    : supabase.from('productores').insert(basePayload)

  const { error } = await query
  if (error) {
    console.error('[Supabase] Guardar productor', error)
  }

  return { error }
}

export const actualizarEstadoProductor = async (
  productor: Productor,
  activo: boolean,
  rolSolicitante: RolUsuario = 'Operador',
) => {
  // Validación estricta: Juan Carlos (Supervisor) no puede cambiar el estado de productores
  validarPermisoEscritura(rolSolicitante, 'cambiar el estado del productor')

  const { error } = await supabase
    .from('productores')
    .update({ activo })
    .eq('id', productor.id)

  if (error) {
    console.error('[Supabase] Cambiar estado de productor', error)
  }

  return { error }
}
