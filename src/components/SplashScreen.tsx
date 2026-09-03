import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck } from 'lucide-react'
import { Logo } from './Logo'

export interface SplashScreenProps {
  onFinish: () => void
  duration?: number
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish, duration = 1400 }) => {
  const [progress, setProgress] = useState(0)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const startTime = performance.now()

    const updateProgress = (now: number) => {
      const elapsed = now - startTime
      const currentProgress = Math.min(100, Math.floor((elapsed / duration) * 100))
      setProgress(currentProgress)

      if (elapsed < duration) {
        requestAnimationFrame(updateProgress)
      } else {
        setTimeout(() => {
          setIsVisible(false)
          setTimeout(onFinish, 400)
        }, 150)
      }
    }

    const rafId = requestAnimationFrame(updateProgress)
    return () => cancelAnimationFrame(rafId)
  }, [duration, onFinish])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="splash-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          role="status"
          aria-live="polite"
        >
          <div className="splash-background" />
          <div className="splash-glow splash-glow-top" />
          <div className="splash-glow splash-glow-bottom" />

          <motion.div
            className="splash-content"
            initial={{ scale: 0.9, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <div className="splash-logo-wrapper">
              <motion.div
                className="splash-logo-ring"
                animate={{ rotate: 360 }}
                transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
              />
              <div className="splash-logo-inner">
                <Logo alt="DeereMax" className="splash-logo-img" />
              </div>
            </div>

            <motion.div
              className="splash-brand-text"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <h1 className="splash-title">DEEREMAX</h1>
              <p className="splash-subtitle">Control Operativo · Gestión Empresarial</p>
            </motion.div>

            <div className="splash-progress-container">
              <div className="splash-progress-track">
                <motion.div
                  className="splash-progress-bar"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="splash-security-tag">
                <ShieldCheck size={13} className="text-emerald-400" />
                <span>Acceso Seguro Encriptado</span>
              </div>
            </div>
          </motion.div>

          <footer className="splash-footer">
            <p>© 2026 DeereMax · Soluciones que cultivan el futuro.</p>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
