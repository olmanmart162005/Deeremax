export type Productor = {
  id: string
  codigo: string | null
  nombre: string
  telefono?: string | null
  finca?: string | null
  sector?: string | null
  observaciones?: string | null
  activo?: boolean | null
  created_at: string
}

export type DetalleReporte = {
  id: string
  reporte_id: string
  fecha: string
  cestas_a: number
  cestas_h: number
  americana_4: number
  americana_5: number
  americana_7: number
  hindu_4: number
  hindu_5: number
  hindu_7: number
  observaciones: string | null
  created_at: string
  updated_at: string
}

export type Reporte = {
  id: string
  productor_id: string
  semana: number
  anio: number
  fecha_inicio: string
  fecha_fin: string
  total_cajas: number
  rendimiento_a: number
  rendimiento_h: number
  estado: string
  created_at: string
  detalle_reporte: DetalleReporte[]
}

export type EntryFormState = {
  fecha: string
  cestas_a: string
  cestas_h: string
  americana_4: string
  americana_5: string
  americana_7: string
  hindu_4: string
  hindu_5: string
  hindu_7: string
  observaciones: string
}

