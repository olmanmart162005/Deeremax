import React, { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export type ModoTema = 'light' | 'dark' | 'auto'

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [tema, setTema] = useState<ModoTema>(() => {
    try {
      const guardado = localStorage.getItem('deeremax_theme_preference') as ModoTema
      return guardado || 'light'
    } catch {
      return 'light'
    }
  })

  useEffect(() => {
    const root = document.documentElement

    const aplicarTema = (mode: ModoTema) => {
      if (mode === 'dark') {
        root.classList.add('dark')
      } else if (mode === 'light') {
        root.classList.remove('dark')
      } else {
        const prefiereOscuro = window.matchMedia('(prefers-color-scheme: dark)').matches
        if (prefiereOscuro) root.classList.add('dark')
        else root.classList.remove('dark')
      }
    }

    aplicarTema(tema)
    try {
      localStorage.setItem('deeremax_theme_preference', tema)
    } catch {
      // ignore
    }
  }, [tema])

  const alternar = () => {
    if (tema === 'light') setTema('dark')
    else if (tema === 'dark') setTema('light')
    else setTema('light')
  }

  return (
    <button
      type="button"
      className={`theme-toggle-btn ghost ${className}`}
      onClick={alternar}
      title={`Modo actual: ${tema === 'dark' ? 'Oscuro' : 'Claro'}. Clic para cambiar.`}
      aria-label="Cambiar tema claro / oscuro"
    >
      {tema === 'dark' ? <Moon size={16} className="text-amber-300" /> : <Sun size={16} className="text-amber-500" />}
    </button>
  )
}
