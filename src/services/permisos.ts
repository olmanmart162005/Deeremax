import type { RolUsuario, PermisosUsuario } from '../types'

/**
 * Normaliza cualquier string de rol a uno de los 3 roles estándar de Deeremax.
 */
export const normalizarRol = (rolRaw?: string | null, email?: string | null): RolUsuario => {
  const mail = (email || '').toLowerCase().trim()

  // Olman siempre es Super Admin
  if (
    mail.includes('olman') ||
    mail === 'olman@deeremax.app' ||
    mail === 'olmanmart16@deeremax.app' ||
    mail === 'olman2026@admin.com'
  ) {
    return 'Super Admin'
  }

  // Juan Carlos Muñoz siempre es Supervisor (Solo Lectura)
  if (
    mail.includes('juancarlos') ||
    mail.includes('jcmunoz') ||
    mail === 'juancarlos@deeremax.app' ||
    mail === 'juancarlosmunoz@deeremax.app'
  ) {
    return 'Supervisor'
  }

  // Ervin es Operador
  if (mail.includes('ervin') || mail === 'ervin2026@admin.com' || mail === 'ervin@deeremax.app') {
    return 'Operador'
  }

  const r = (rolRaw || '').trim().toLowerCase()
  if (r.includes('super') || r.includes('admin') || r.includes('propietario')) {
    return 'Super Admin'
  }
  if (r.includes('supervis') || r.includes('jefe') || r.includes('auditor') || r.includes('lectura')) {
    return 'Supervisor'
  }
  return 'Operador'
}

/**
 * Calcula los permisos efectivos de un usuario según su rol.
 */
export const obtenerPermisos = (rol: RolUsuario): PermisosUsuario => {
  switch (rol) {
    case 'Super Admin':
      return {
        canManageUsers: true,
        canConfigureSystem: true,
        canManageSecurity: true,
        canEditProducers: true,
        canEditReports: true,
        canDeleteRecords: true,
        canViewAll: true,
        isReadOnly: false,
      }
    case 'Supervisor':
      return {
        canManageUsers: false,
        canConfigureSystem: false,
        canManageSecurity: false,
        canEditProducers: false,
        canEditReports: false,
        canDeleteRecords: false,
        canViewAll: true,
        isReadOnly: true,
      }
    case 'Operador':
    default:
      return {
        canManageUsers: false,
        canConfigureSystem: false,
        canManageSecurity: false,
        canEditProducers: true,
        canEditReports: true,
        canDeleteRecords: false,
        canViewAll: true,
        isReadOnly: false,
      }
  }
}

/**
 * Validación estricta en el servicio: rechaza cualquier mutación si el usuario es de Solo Lectura (Supervisor)
 */
export const validarPermisoEscritura = (rol: RolUsuario, accion: string = 'realizar esta operación') => {
  const permisos = obtenerPermisos(rol)
  if (permisos.isReadOnly) {
    throw new Error(
      `Acceso denegado: El rol ${rol} (Solo lectura) no tiene permisos para ${accion}.`
    )
  }
}

/**
 * Validación estricta para operaciones exclusivas del Super Administrador (Olman)
 */
export const validarPermisoAdmin = (rol: RolUsuario, accion: string = 'administrar este recurso') => {
  const permisos = obtenerPermisos(rol)
  if (!permisos.canManageUsers) {
    throw new Error(
      `Acceso denegado: Solo el Administrador Principal (Super Admin) tiene permisos para ${accion}.`
    )
  }
}
