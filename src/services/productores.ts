import { supabase } from '../lib/supabase'
import type { Productor } from '../types'

export type PayloadProductor = {
  codigo: string
  nombre: string
  telefono: string
  finca: string
  sector: string
  observaciones: string
  activo: boolean
}

export const estaActivo = (productor: Productor) => {
  if (typeof productor.activo === 'boolean') return productor.activo
  return true
}

export const guardarProductor = async (productorId: string | null, payload: PayloadProductor) => {
  const nombre = payload.nombre.trim().toUpperCase()

  const basePayload = {
    codigo: payload.codigo,
    nombre,
    telefono: payload.telefono,
    finca: payload.finca,
    sector: payload.sector,
    observaciones: payload.observaciones,
    activo: payload.activo,
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

export const actualizarEstadoProductor = async (productor: Productor, activo: boolean) => {
  const { error } = await supabase
    .from('productores')
    .update({ activo })
    .eq('id', productor.id)

  if (error) {
    console.error('[Supabase] Cambiar estado de productor', error)
  }

  return { error }
}
