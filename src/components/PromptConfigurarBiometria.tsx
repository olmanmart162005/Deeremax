import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Fingerprint, ShieldCheck, X, Loader2, Smartphone } from 'lucide-react'
import { registrarCredencialWebAuthn, detectarNombreDispositivo } from '../services/webauthn'

export interface PromptConfigurarBiometriaProps {
  abierto: boolean
  onCerrar: () => void
  userId: string
  userEmail: string
  userName: string
  onBiometriaConfigurada: () => void
  onNotificarExito: (msg: string) => void
  onNotificarError: (msg: string) => void
}

export const PromptConfigurarBiometria: React.FC<PromptConfigurarBiometriaProps> = ({
  abierto,
  onCerrar,
  userId,
  userEmail,
  userName,
  onBiometriaConfigurada,
  onNotificarExito,
  onNotificarError,
}) => {
  const [procesando, setProcesando] = useState(false)
  const nombreDispositivo = detectarNombreDispositivo()

  if (!abierto) return null

  const handleConfigurar = async () => {
    setProcesando(true)

    const resultado = await registrarCredencialWebAuthn({
      userId,
      userEmail,
      userName,
      deviceName: nombreDispositivo,
    })

    setProcesando(false)

    if (resultado.exitoso) {
      onNotificarExito('✓ Biometría configurada correctamente en tu dispositivo.')
      onBiometriaConfigurada()
      onCerrar()
    } else {
      if (resultado.error && !resultado.error.includes('cancelada')) {
        onNotificarError(resultado.error)
      }
    }
  }

  return (
    <AnimatePresence>
      <div className="overlay-modal print-hidden" onClick={onCerrar}>
        <motion.div
          className="modal modal-biometria-prompt"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <div className="modal-biometria-top">
            <button
              type="button"
              className="modal-biometria-close"
              onClick={onCerrar}
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
            <div className="biometria-icon-pulse-wrapper">
              <motion.div
                className="biometria-icon-pulse-ring"
                animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="biometria-icon-pulse-core">
                <Fingerprint size={36} className="text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </div>

          <div className="modal-biometria-body">
            <h3 className="modal-biometria-title">Protegé tu acceso</h3>
            <p className="modal-biometria-desc">
              Podés desbloquear la aplicación más rápidamente usando la autenticación biométrica de tu dispositivo.
            </p>

            <div className="biometria-features-card">
              <div className="biometria-feature-item">
                <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <div>
                  <strong>Huella digital / Face ID / Windows Hello</strong>
                  <span>Acceso instantáneo con la biometría real de tu sistema operativo.</span>
                </div>
              </div>
              <div className="biometria-feature-item">
                <Smartphone size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <div>
                  <strong>Dispositivo detectado</strong>
                  <span>{nombreDispositivo}</span>
                </div>
              </div>
            </div>

            <p className="biometria-privacy-note">
              🔒 <strong>Privacidad:</strong> DeereMax nunca almacena huellas ni imágenes biométricas. La autenticación la realiza de forma segura tu propio teléfono o computadora.
            </p>

            <div className="modal-biometria-actions">
              <motion.button
                type="button"
                className="btn-configurar-biometria"
                onClick={handleConfigurar}
                disabled={procesando}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                {procesando ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Verificando con el dispositivo...
                  </>
                ) : (
                  <>
                    <Fingerprint size={18} /> Configurar biometría
                  </>
                )}
              </motion.button>
              <button
                type="button"
                className="btn-ahora-no ghost"
                onClick={onCerrar}
                disabled={procesando}
              >
                Ahora no
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
