import React from 'react'
import { Eye } from 'lucide-react'

export interface ModoSupervisorBadgeProps {
  className?: string
  variante?: 'banner' | 'pill'
}

export const ModoSupervisorBadge: React.FC<ModoSupervisorBadgeProps> = ({
  className = '',
  variante = 'pill',
}) => {
  if (variante === 'banner') {
    return (
      <div
        className={`bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 flex items-center justify-between text-xs font-semibold text-amber-700 dark:text-amber-300 print-hidden ${className}`}
      >
        <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
          <Eye size={14} className="text-amber-600 dark:text-amber-400 flex-shrink-0 animate-pulse" />
          <span>
            <strong>Modo Supervisor:</strong> Tienes acceso de solo lectura para consultar información, métricas y reportes. Las funciones de modificación están deshabilitadas.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs font-semibold shadow-xs ${className}`}
      title="Acceso de supervisión (Solo lectura): Consultas y reportes habilitados, controles de edición desactivados"
    >
      <Eye size={13} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
      <span>Modo supervisor · Solo lectura</span>
    </div>
  )
}
