import React, { useState, useEffect } from 'react'
import {
  ShieldCheck,
  Fingerprint,
  KeyRound,
  Smartphone,
  Laptop,
  Trash2,
  Plus,
  Clock,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
} from 'lucide-react'
import {
  obtenerCredencialesUsuario,
  revocarCredencialWebAuthn,
  registrarCredencialWebAuthn,
  detectarNombreDispositivo,
  esWebAuthnSoportado,
} from '../services/webauthn'
import { supabase } from '../lib/supabase'
import type { PerfilUsuario, WebAuthnCredentialRecord } from '../types'

export interface CentroSeguridadProps {
  perfil: PerfilUsuario
  onNotificarExito: (msg: string) => void
  onNotificarError: (msg: string) => void
  onRegistrarAuditoria: (accion: string, descripcion: string) => Promise<void>
}

export const CentroSeguridad: React.FC<CentroSeguridadProps> = ({
  perfil,
  onNotificarExito,
  onNotificarError,
  onRegistrarAuditoria,
}) => {
  const [credenciales, setCredenciales] = useState<WebAuthnCredentialRecord[]>([])
  const [cargandoCredenciales, setCargandoCredenciales] = useState(true)
  const [registrandoNuevo, setRegistrandoNuevo] = useState(false)
  const [revocandoId, setRevocandoId] = useState<string | null>(null)

  // Password change state
  const [modalPasswordAbierto, setModalPasswordAbierto] = useState(false)
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [guardandoPassword, setGuardandoPassword] = useState(false)

  const cargarCredenciales = async () => {
    setCargandoCredenciales(true)
    const list = await obtenerCredencialesUsuario(perfil.id)
    setCredenciales(list)
    setCargandoCredenciales(false)
  }

  useEffect(() => {
    void cargarCredenciales()
  }, [perfil.id])

  const handleRegistrarNuevoDispositivo = async () => {
    if (!esWebAuthnSoportado()) {
      onNotificarError('WebAuthn no está soportado en este dispositivo.')
      return
    }

    setRegistrandoNuevo(true)
    const nombreDispositivo = detectarNombreDispositivo()

    const resultado = await registrarCredencialWebAuthn({
      userId: perfil.id,
      userEmail: perfil.email,
      userName: perfil.nombre,
      deviceName: nombreDispositivo,
    })

    setRegistrandoNuevo(false)

    if (resultado.exitoso) {
      onNotificarExito('✓ Nuevo dispositivo biométrico registrado correctamente.')
      await onRegistrarAuditoria(
        'BIOMETRIA_DISPOSITIVO_REGISTRADO',
        `Se vinculó el dispositivo "${nombreDispositivo}" a la cuenta de ${perfil.nombre}.`,
      )
      await cargarCredenciales()
    } else {
      if (resultado.error && !resultado.error.includes('cancelada')) {
        onNotificarError(resultado.error)
      }
    }
  }

  const handleRevocarCredencial = async (cred: WebAuthnCredentialRecord) => {
    if (!window.confirm(`¿Estás seguro de revocar el acceso biométrico en "${cred.device_name}"?`)) {
      return
    }

    setRevocandoId(cred.id)
    const res = await revocarCredencialWebAuthn(cred.credential_id || cred.id, perfil.id)
    setRevocandoId(null)

    if (res.exitoso) {
      onNotificarExito(`✓ Acceso biométrico en "${cred.device_name}" revocado con éxito.`)
      await onRegistrarAuditoria(
        'BIOMETRIA_DISPOSITIVO_REVOCADO',
        `Se revocó la credencial del dispositivo "${cred.device_name}".`,
      )
      await cargarCredenciales()
    } else {
      onNotificarError(res.error || 'No se pudo revocar la credencial.')
    }
  }

  const handleCambiarPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (nuevaPassword.length < 6) {
      onNotificarError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (nuevaPassword !== confirmarPassword) {
      onNotificarError('Las contraseñas no coinciden.')
      return
    }

    setGuardandoPassword(true)

    if (supabase) {
      const { error } = await supabase.auth.updateUser({ password: nuevaPassword })
      if (error) {
        onNotificarError(`Error al actualizar contraseña: ${error.message}`)
        setGuardandoPassword(false)
        return
      }
    }

    setGuardandoPassword(false)
    setModalPasswordAbierto(false)
    setNuevaPassword('')
    setConfirmarPassword('')
    onNotificarExito('✓ Contraseña actualizada correctamente.')
    await onRegistrarAuditoria(
      'SEGURIDAD_PASSWORD_ACTUALIZADA',
      `El usuario ${perfil.nombre} actualizó su contraseña de acceso.`,
    )
  }

  const getDeviceIcon = (name: string) => {
    if (/phone|samsung|android|ios|iphone/i.test(name)) {
      return <Smartphone size={20} className="text-emerald-600 dark:text-emerald-400" />
    }
    return <Laptop size={20} className="text-emerald-600 dark:text-emerald-400" />
  }

  const biometriaActiva = credenciales.length > 0 || perfil.biometria_activa

  return (
    <section className="seccion-vista centro-seguridad">
      <div className="seguridad-hero-card">
        <div className="seguridad-hero-header">
          <div className="seguridad-hero-title-wrap">
            <div className="seguridad-shield-icon">
              <ShieldCheck size={28} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Centro de Seguridad</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Gestioná la autenticación biométrica, contraseñas y dispositivos de tu cuenta.
              </p>
            </div>
          </div>
          <div className="seguridad-status-pill">
            <span className="status-indicator-dot online" />
            <span className="font-semibold text-xs text-emerald-800 dark:text-emerald-300">
              Cuenta Protegida
            </span>
          </div>
        </div>

        <div className="seguridad-kpis-grid">
          <div className="seguridad-kpi-box">
            <div className="flex items-center gap-2 mb-1">
              <Fingerprint size={18} className="text-emerald-600" />
              <span className="text-xs font-semibold text-slate-500">Autenticación Biométrica</span>
            </div>
            <p className="text-lg font-bold text-slate-800 dark:text-white">
              {biometriaActiva ? '🟢 Activada' : '⚪ Desactivada'}
            </p>
            <span className="text-xs text-slate-500">
              {credenciales.length} {credenciales.length === 1 ? 'dispositivo registrado' : 'dispositivos registrados'}
            </span>
          </div>

          <div className="seguridad-kpi-box">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={18} className="text-blue-600" />
              <span className="text-xs font-semibold text-slate-500">Último Acceso</span>
            </div>
            <p className="text-base font-bold text-slate-800 dark:text-white">
              {new Date().toLocaleDateString('es-HN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <span className="text-xs text-slate-500">Sesión actual activa</span>
          </div>

          <div className="seguridad-kpi-box">
            <div className="flex items-center gap-2 mb-1">
              <Lock size={18} className="text-amber-600" />
              <span className="text-xs font-semibold text-slate-500">Nivel de Encriptación</span>
            </div>
            <p className="text-lg font-bold text-slate-800 dark:text-white">FIDO2 / WebAuthn</p>
            <span className="text-xs text-slate-500">Criptografía de clave pública</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel de Dispositivos Biométricos Registrados */}
        <div className="lg:col-span-2 tarjeta-panel">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Fingerprint size={20} className="text-emerald-600" />
                Dispositivos con Biometría Vinculada
              </h3>
              <p className="text-xs text-slate-500">
                Dispositivos autorizados para desbloqueo rápido con Touch ID, Face ID o huella Android.
              </p>
            </div>
            <button
              type="button"
              className="btn-registrar-dispositivo text-xs py-1.5 px-3"
              onClick={handleRegistrarNuevoDispositivo}
              disabled={registrandoNuevo}
            >
              {registrandoNuevo ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Registrando...
                </>
              ) : (
                <>
                  <Plus size={14} /> Vincular este dispositivo
                </>
              )}
            </button>
          </div>

          {cargandoCredenciales ? (
            <div className="py-8 text-center text-slate-400">
              <Loader2 size={24} className="animate-spin mx-auto mb-2 text-emerald-600" />
              <p className="text-sm">Consultando dispositivos registrados...</p>
            </div>
          ) : credenciales.length === 0 ? (
            <div className="empty-devices-state py-8 text-center">
              <Fingerprint size={42} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                Aún no has configurado biometría en ningún dispositivo.
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Haz clic en "Vincular este dispositivo" para utilizar el sensor dactilar o reconocimiento facial de tu teléfono o laptop.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {credenciales.map((cred) => (
                <div
                  key={cred.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 hover:border-emerald-500/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-emerald-100/70 dark:bg-emerald-950/60 flex-shrink-0">
                      {getDeviceIcon(cred.device_name)}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                        {cred.device_name}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Registrado: {new Date(cred.created_at).toLocaleDateString('es-HN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })} · Último uso: {new Date(cred.last_used_at).toLocaleDateString('es-HN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="danger text-xs py-1.5 px-3 flex items-center gap-1"
                    onClick={() => handleRevocarCredencial(cred)}
                    disabled={revocandoId === cred.id}
                    title="Revocar acceso biométrico en este dispositivo"
                  >
                    {revocandoId === cred.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                    <span>Revocar</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Acciones de Credenciales y Contraseña */}
        <div className="tarjeta-panel space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <KeyRound size={20} className="text-emerald-600" />
              Gestión de Acceso
            </h3>
            <p className="text-xs text-slate-500">
              Controles de contraseña y sesiones de usuario.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Contraseña de la Cuenta
            </h4>
            <p className="text-xs text-slate-500">
              Recomendamos actualizar tu contraseña periódicamente o si detectas actividad inusual.
            </p>
            <button
              type="button"
              className="ghost w-full justify-center text-xs py-2 mt-2"
              onClick={() => setModalPasswordAbierto(true)}
            >
              <KeyRound size={14} /> Cambiar contraseña
            </button>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Cierre de Sesiones Global
            </h4>
            <p className="text-xs text-slate-500">
              Cierra todas las sesiones activas en otros dispositivos navegadores.
            </p>
            <button
              type="button"
              className="danger ghost w-full justify-center text-xs py-2 mt-2"
              onClick={async () => {
                if (window.confirm('¿Deseas cerrar sesión en todos los demás dispositivos?')) {
                  if (supabase) {
                    await supabase.auth.signOut({ scope: 'others' })
                  }
                  onNotificarExito('✓ Sesiones remotas cerradas correctamente.')
                  await onRegistrarAuditoria(
                    'SEGURIDAD_SESIONES_REMOTAS_REVOCADAS',
                    `El usuario ${perfil.nombre} cerró todas sus sesiones en otros dispositivos.`,
                  )
                }
              }}
            >
              <LogOut size={14} /> Cerrar otras sesiones
            </button>
          </div>
        </div>
      </div>

      {/* Modal para Cambio de Contraseña */}
      {modalPasswordAbierto && (
        <div className="overlay-modal print-hidden" onClick={() => setModalPasswordAbierto(false)}>
          <div className="modal modal-password" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="font-bold text-base text-slate-800 dark:text-white flex items-center gap-2">
                <KeyRound size={18} className="text-emerald-600" />
                Actualizar Contraseña
              </h3>
              <button className="ghost" onClick={() => setModalPasswordAbierto(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCambiarPassword} className="modal-form">
              <label>
                Nueva Contraseña
                <div className="field-shell">
                  <Lock size={16} />
                  <input
                    type={mostrarPassword ? 'text' : 'password'}
                    value={nuevaPassword}
                    onChange={(e) => setNuevaPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    className="field-toggle"
                    onClick={() => setMostrarPassword((v) => !v)}
                  >
                    {mostrarPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <label>
                Confirmar Contraseña
                <div className="field-shell">
                  <Lock size={16} />
                  <input
                    type={mostrarPassword ? 'text' : 'password'}
                    value={confirmarPassword}
                    onChange={(e) => setConfirmarPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Repite la nueva contraseña"
                  />
                </div>
              </label>

              <div className="acciones-linea mt-4">
                <button type="submit" disabled={guardandoPassword}>
                  {guardandoPassword ? 'Guardando...' : 'Guardar nueva contraseña'}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setModalPasswordAbierto(false)}
                  disabled={guardandoPassword}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
