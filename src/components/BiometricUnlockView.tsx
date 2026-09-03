import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Fingerprint, LockKeyhole, KeyRound, Loader2 } from 'lucide-react'
import { Logo } from './Logo'
import { Avatar } from './Avatar'
import { autenticarConWebAuthn } from '../services/webauthn'
import type { WebAuthnCredentialRecord } from '../types'

export interface BiometricUnlockViewProps {
  usuarioNombre: string
  usuarioEmail: string
  usuarioFoto?: string | null
  usuarioRol?: string
  credencialesRegistradas: WebAuthnCredentialRecord[]
  onDesbloqueoExitoso: () => void
  onCambiarAContrasena: () => void
  onCambiarUsuario: () => void
  onNotificarError: (msg: string) => void
}

export const BiometricUnlockView: React.FC<BiometricUnlockViewProps> = ({
  usuarioNombre,
  usuarioEmail,
  usuarioFoto,
  usuarioRol = 'Operaciones',
  credencialesRegistradas,
  onDesbloqueoExitoso,
  onCambiarAContrasena,
  onCambiarUsuario,
  onNotificarError,
}) => {
  const [desbloqueando, setDesbloqueando] = useState(false)
  const [mensajeError, setMensajeError] = useState<string | null>(null)

  const handleDesbloquearBiometria = async () => {
    setDesbloqueando(true)
    setMensajeError(null)

    const resultado = await autenticarConWebAuthn({
      credencialesRegistradas,
    })

    setDesbloqueando(false)

    if (resultado.exitoso) {
      onDesbloqueoExitoso()
    } else {
      if (resultado.error && !resultado.error.includes('cancelado')) {
        setMensajeError(resultado.error)
        onNotificarError(resultado.error)
      }
    }
  }

  return (
    <div className="login-page login-premium">
      <div className="login-bg-pattern" aria-hidden="true" />
      <div className="login-bg-orb orb-left" aria-hidden="true" />
      <div className="login-bg-orb orb-right" aria-hidden="true" />

      <motion.div
        className="login-card biometric-unlock-card"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="text-center mb-4">
          <Logo className="brand-logo mx-auto" alt="DeereMax" />
          <p className="login-caption mt-2">Bienvenido nuevamente</p>
        </div>

        <div className="biometric-user-chip">
          <Avatar
            src={usuarioFoto}
            name={usuarioNombre}
            size="lg"
            type="user"
            border={true}
          />
          <div className="biometric-user-info">
            <h2 className="biometric-user-name">{usuarioNombre}</h2>
            <span className="biometric-user-role">{usuarioRol}</span>
            <small className="biometric-user-email">{usuarioEmail}</small>
          </div>
        </div>

        <div className="biometric-sensor-zone">
          <motion.div
            className={`biometric-sensor-circle ${desbloqueando ? 'scanning' : ''}`}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleDesbloquearBiometria}
            role="button"
            tabIndex={0}
            aria-label="Tocar para desbloquear con biometría"
          >
            {desbloqueando ? (
              <motion.div
                className="biometric-scan-wave"
                animate={{ scale: [1, 1.4, 1], opacity: [0.8, 0, 0.8] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            ) : null}
            <Fingerprint
              size={48}
              className={`biometric-fingerprint-svg ${desbloqueando ? 'text-emerald-500 animate-pulse' : 'text-emerald-700 dark:text-emerald-400'}`}
            />
          </motion.div>
          <p className="biometric-sensor-hint">
            {desbloqueando
              ? 'Validando biometría en tu dispositivo...'
              : 'Tocá para desbloquear con tu huella dactilar o Face ID'}
          </p>
        </div>

        {mensajeError && (
          <div className="biometric-error-alert" role="alert">
            <span>{mensajeError}</span>
          </div>
        )}

        <div className="biometric-actions-group">
          <motion.button
            type="button"
            className="btn-biometric-primary"
            onClick={handleDesbloquearBiometria}
            disabled={desbloqueando}
            whileHover={{ y: -1, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            {desbloqueando ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Verificando...
              </>
            ) : (
              <>
                <LockKeyhole size={18} /> Desbloquear con biometría
              </>
            )}
          </motion.button>

          <div className="login-divider">
            <span>o</span>
          </div>

          <button
            type="button"
            className="btn-biometric-password ghost"
            onClick={onCambiarAContrasena}
            disabled={desbloqueando}
          >
            <KeyRound size={16} /> Usar contraseña
          </button>
        </div>

        <div className="biometric-footer-links">
          <button
            type="button"
            className="link-switch-user"
            onClick={onCambiarUsuario}
          >
            Iniciar con otra cuenta →
          </button>
        </div>
      </motion.div>

      <footer className="login-footer">
        <p>© 2026 DeereMax · Sistema Seguro y Encriptado</p>
      </footer>
    </div>
  )
}
