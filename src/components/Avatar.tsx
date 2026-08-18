import React, { useState, useEffect } from 'react'
import { UserRound, Building2, Image as ImageIcon } from 'lucide-react'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
export type AvatarVariant = 'circle' | 'rounded' | 'square'
export type AvatarType = 'user' | 'producer' | 'general'

export interface AvatarProps {
  src?: string | null
  name?: string
  size?: AvatarSize | number
  variant?: AvatarVariant
  type?: AvatarType
  border?: boolean
  status?: 'active' | 'inactive' | 'none'
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
  alt?: string
  loading?: 'lazy' | 'eager'
}

const PALETAS_FONDO = [
  'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)', // Deere Verde Oscuro
  'linear-gradient(135deg, #15803d 0%, #16a34a 100%)', // Esmeralda
  'linear-gradient(135deg, #b45309 0%, #d97706 100%)', // Ámbar / Dorado
  'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)', // Azul Marino
  'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)', // Verde Azulado
  'linear-gradient(135deg, #374151 0%, #4b5563 100%)', // Gris Grafito
  'linear-gradient(135deg, #4d7c0f 0%, #65a30d 100%)', // Oliva
]

const obtenerIniciales = (nombre?: string): string => {
  if (!nombre || !nombre.trim()) return 'DM'
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return 'DM'
  if (partes.length === 1) {
    return partes[0].slice(0, 2).toUpperCase()
  }
  return (partes[0].charAt(0) + partes[1].charAt(0)).toUpperCase()
}

const hashStringParaColor = (texto: string): string => {
  let hash = 0
  for (let i = 0; i < texto.length; i++) {
    hash = texto.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % PALETAS_FONDO.length
  return PALETAS_FONDO[index]
}

const SIZES_PX: Record<AvatarSize, { px: number; font: number; icon: number }> = {
  xs: { px: 24, font: 10, icon: 12 },
  sm: { px: 32, font: 12, icon: 14 },
  md: { px: 40, font: 14, icon: 18 },
  lg: { px: 48, font: 16, icon: 22 },
  xl: { px: 64, font: 20, icon: 28 },
  '2xl': { px: 96, font: 28, icon: 42 },
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name = '',
  size = 'md',
  variant = 'circle',
  type = 'user',
  border = true,
  status = 'none',
  className = '',
  style = {},
  onClick,
  alt,
  loading = 'lazy',
}) => {
  const [cargado, setCargado] = useState(false)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    setCargado(false)
    setFallo(false)
  }, [src])

  const dimension = typeof size === 'number' ? size : SIZES_PX[size]?.px || 40
  const fontSize = typeof size === 'number' ? Math.round(size * 0.38) : SIZES_PX[size]?.font || 14
  const iconSize = typeof size === 'number' ? Math.round(size * 0.45) : SIZES_PX[size]?.icon || 18

  const iniciales = obtenerIniciales(name)
  const backgroundGradient = hashStringParaColor(name || 'DeereMax')

  const radioClase =
    variant === 'circle' ? 'rounded-full' : variant === 'rounded' ? 'rounded-xl' : 'rounded-md'

  const tieneFotoValida = Boolean(src && !fallo)

  return (
    <div
      className={`dm-avatar-container relative inline-flex items-center justify-center select-none flex-shrink-0 ${
        onClick ? 'cursor-pointer hover:opacity-95 transition-transform active:scale-95' : ''
      } ${className}`}
      style={{
        width: `${dimension}px`,
        height: `${dimension}px`,
        ...style,
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      title={name || alt}
    >
      <div
        className={`dm-avatar-inner w-full h-full ${radioClase} overflow-hidden flex items-center justify-center ${
          border ? 'border border-emerald-900/15 shadow-sm' : ''
        }`}
        style={{
          background: tieneFotoValida ? '#f1f5f9' : backgroundGradient,
        }}
      >
        {tieneFotoValida ? (
          <>
            {!cargado ? (
              <div className="absolute inset-0 bg-slate-200 animate-pulse flex items-center justify-center">
                <span className="text-slate-400 font-bold" style={{ fontSize: `${fontSize}px` }}>
                  {iniciales}
                </span>
              </div>
            ) : null}
            <img
              src={src || undefined}
              alt={alt || name || 'Avatar'}
              loading={loading}
              decoding="async"
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                cargado ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setCargado(true)}
              onError={() => {
                setFallo(true)
                setCargado(false)
              }}
            />
          </>
        ) : (
          <div className="flex items-center justify-center text-white font-bold tracking-wider">
            {name ? (
              <span style={{ fontSize: `${fontSize}px`, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                {iniciales}
              </span>
            ) : type === 'producer' ? (
              <Building2 size={iconSize} className="text-white/90" />
            ) : type === 'user' ? (
              <UserRound size={iconSize} className="text-white/90" />
            ) : (
              <ImageIcon size={iconSize} className="text-white/90" />
            )}
          </div>
        )}
      </div>

      {status !== 'none' ? (
        <span
          className={`absolute bottom-0 right-0 block rounded-full ring-2 ring-white ${
            status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
          }`}
          style={{
            width: `${Math.max(8, Math.round(dimension * 0.24))}px`,
            height: `${Math.max(8, Math.round(dimension * 0.24))}px`,
          }}
          aria-label={status === 'active' ? 'Activo' : 'Inactivo'}
        />
      ) : null}
    </div>
  )
}
