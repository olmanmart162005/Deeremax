import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  CheckCheck,
  ShieldCheck,
  Info,
  CheckCircle2,
  AlertTriangle,
  X,
} from 'lucide-react'
import {
  obtenerNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
} from '../services/notificaciones'
import type { NotificacionSistema } from '../types'

export interface CentroNotificacionesProps {
  userId?: string
  onNavegar?: (vista: string) => void
}

export const CentroNotificaciones: React.FC<CentroNotificacionesProps> = ({
  userId,
  onNavegar,
}) => {
  const [abierto, setAbierto] = useState(false)
  const [notificaciones, setNotificaciones] = useState<NotificacionSistema[]>([])
  const [soloNoLeidas, setSoloNoLeidas] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const cargarNotificaciones = async () => {
    const list = await obtenerNotificaciones(userId)
    setNotificaciones(list)
  }

  useEffect(() => {
    void cargarNotificaciones()
  }, [userId])

  useEffect(() => {
    const handleClickAfuera = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    if (abierto) {
      document.addEventListener('mousedown', handleClickAfuera)
    }
    return () => document.removeEventListener('mousedown', handleClickAfuera)
  }, [abierto])

  const noLeidas = notificaciones.filter((n) => !n.leida).length

  const handleMarcarLeida = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await marcarNotificacionLeida(id, userId)
    setNotificaciones((prev) =>
      prev.map((n) => (n.id === id ? { ...n, leida: true } : n)),
    )
  }

  const handleMarcarTodasLeidas = async () => {
    await marcarTodasLeidas(userId)
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })))
  }

  const renderIcono = (tipo: NotificacionSistema['tipo']) => {
    switch (tipo) {
      case 'security':
        return <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
      case 'success':
        return <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
      case 'warning':
        return <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
      default:
        return <Info size={16} className="text-blue-600 dark:text-blue-400" />
    }
  }

  const listaFiltrada = soloNoLeidas ? notificaciones.filter((n) => !n.leida) : notificaciones

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className="boton-notificaciones relative"
        onClick={() => setAbierto((v) => !v)}
        title="Centro de Notificaciones"
        aria-label="Notificaciones"
      >
        <Bell size={18} />
        {noLeidas > 0 && (
          <span className="notificaciones-badge animate-pulse">{noLeidas > 9 ? '9+' : noLeidas}</span>
        )}
      </button>

      <AnimatePresence>
        {abierto && (
          <motion.div
            className="notificaciones-dropdown"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <div className="notificaciones-header">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-emerald-600" />
                <strong className="text-sm text-slate-900 dark:text-white">Notificaciones</strong>
                {noLeidas > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {noLeidas} nuevas
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {noLeidas > 0 && (
                  <button
                    type="button"
                    className="ghost text-xs py-1 px-2 text-slate-500 hover:text-emerald-600"
                    onClick={handleMarcarTodasLeidas}
                    title="Marcar todas como leídas"
                  >
                    <CheckCheck size={14} />
                  </button>
                )}
                <button
                  type="button"
                  className="ghost text-xs p-1"
                  onClick={() => setAbierto(false)}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="notificaciones-filtros flex items-center justify-between px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs">
              <button
                type="button"
                className={`ghost text-xs px-2 py-0.5 rounded ${!soloNoLeidas ? 'font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' : 'text-slate-500'}`}
                onClick={() => setSoloNoLeidas(false)}
              >
                Todas ({notificaciones.length})
              </button>
              <button
                type="button"
                className={`ghost text-xs px-2 py-0.5 rounded ${soloNoLeidas ? 'font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' : 'text-slate-500'}`}
                onClick={() => setSoloNoLeidas(true)}
              >
                No leídas ({noLeidas})
              </button>
            </div>

            <div className="notificaciones-lista max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {listaFiltrada.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <p className="text-xs">No tienes notificaciones pendientes.</p>
                </div>
              ) : (
                listaFiltrada.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 ${!item.leida ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''}`}
                    onClick={(e) => {
                      if (!item.leida) void handleMarcarLeida(item.id, e)
                      if (item.enlace && onNavegar) {
                        onNavegar(item.enlace)
                        setAbierto(false)
                      }
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 p-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {renderIcono(item.tipo)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className={`text-xs font-bold truncate ${!item.leida ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                            {item.titulo}
                          </h4>
                          <span className="text-[10px] text-slate-400 flex-shrink-0">
                            {new Date(item.created_at).toLocaleDateString('es-HN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                          {item.mensaje}
                        </p>
                      </div>
                      {!item.leida && (
                        <span
                          className="w-2 h-2 rounded-full bg-emerald-600 flex-shrink-0 mt-1.5"
                          title="No leída"
                        />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
