export type RolUsuario = 'Super Admin' | 'Operador' | 'Supervisor'

export interface PermisosUsuario {
  canManageUsers: boolean
  canConfigureSystem: boolean
  canManageSecurity: boolean
  canEditProducers: boolean
  canEditReports: boolean
  canDeleteRecords: boolean
  canViewAll: boolean
  isReadOnly: boolean
}

export type Productor = {
  id: string
  codigo: string | null
  nombre: string
  telefono?: string | null
  finca?: string | null
  sector?: string | null
  observaciones?: string | null
  activo?: boolean | null
  foto_url?: string | null
  created_at: string
}

export type PerfilUsuario = {
  id: string
  email: string
  nombre: string
  telefono?: string | null
  cargo?: string | null
  rol?: RolUsuario | string | null
  estado?: 'activo' | 'inactivo' | string | null
  foto_url?: string | null
  biometria_activa?: boolean | null
  ultimo_acceso?: string | null
  created_at?: string
  updated_at?: string
}

export type FormPerfilUsuario = {
  nombre: string
  telefono: string
  cargo: string
  foto_url: string | null
}

export type UsuarioSistema = {
  id: string
  email: string
  nombre: string
  telefono?: string | null
  cargo?: string | null
  rol: RolUsuario
  activo: boolean
  biometria_activa: boolean
  ultimo_acceso?: string | null
  foto_url?: string | null
  created_at: string
}

export type FormUsuarioSistema = {
  id: string | null
  email: string
  nombre: string
  password?: string
  telefono: string
  cargo: string
  rol: RolUsuario
  activo: boolean
  foto_url: string | null
}

export type WebAuthnCredentialRecord = {
  id: string
  user_id: string
  credential_id: string
  public_key: string
  algorithm: number
  sign_counter: number
  device_name: string
  authenticator_attachment?: string | null
  created_at: string
  last_used_at: string
}

export type NotificacionSistema = {
  id: string
  user_id?: string | null
  titulo: string
  mensaje: string
  tipo: 'info' | 'success' | 'warning' | 'security'
  leida: boolean
  enlace?: string | null
  metadata?: Record<string, unknown> | null
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
