import React from 'react'
import { motion } from 'framer-motion'
import {
  Home,
  Users,
  FileText,
  ClipboardList,
  Menu,
} from 'lucide-react'

export interface BottomNavigationProps {
  vistaActual: string
  onCambiarVista: (vista: any) => void
  onAbrirMenu: () => void
  esSupervisor?: boolean
  esSuperAdmin?: boolean
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  vistaActual,
  onCambiarVista,
  onAbrirMenu,
  esSuperAdmin,
}) => {
  const navItems = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'productores', label: 'Operaciones', icon: Users },
    { id: 'reportes', label: 'Reportes', icon: FileText },
    ...(esSuperAdmin ? [{ id: 'auditoria', label: 'Actividad', icon: ClipboardList }] : []),
  ]

  return (
    <nav className="bottom-navigation-bar print-hidden" aria-label="Navegación Móvil">
      <div className="bottom-nav-container">
        {navItems.map((item) => {
          const Icon = item.icon
          const activo = vistaActual === item.id

          return (
            <button
              key={item.id}
              type="button"
              className={`bottom-nav-item ${activo ? 'activo' : ''}`}
              onClick={() => onCambiarVista(item.id)}
            >
              <div className="bottom-nav-icon-wrapper">
                <Icon size={20} />
                {activo && (
                  <motion.div
                    className="bottom-nav-indicator"
                    layoutId="bottomNavIndicator"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </div>
              <span className="bottom-nav-label">{item.label}</span>
            </button>
          )
        })}

        <button
          type="button"
          className="bottom-nav-item bottom-nav-menu-btn"
          onClick={onAbrirMenu}
        >
          <div className="bottom-nav-icon-wrapper">
            <Menu size={20} />
          </div>
          <span className="bottom-nav-label">Más</span>
        </button>
      </div>
    </nav>
  )
}
