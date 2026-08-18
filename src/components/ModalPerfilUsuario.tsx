import React, { useState } from 'react'
import { X, Save, UserCheck, Mail, Phone, Briefcase, Shield, Loader2 } from 'lucide-react'
import { ImageUploadField } from './ImageUploadField'
import { subirImagenASupabase, eliminarImagenDeSupabase, type ImagenOptimizada } from '../services/imageManager'
import { guardarPerfilUsuario } from '../services/perfilUsuario'
import type { PerfilUsuario } from '../types'

export interface ModalPerfilUsuarioProps {
  abierto: boolean
  onCerrar: () => void
  perfilActual: PerfilUsuario
  onPerfilActualizado: (nuevoPerfil: PerfilUsuario) => void
  onNotificarExito: (mensaje: string) => void
  onNotificarError: (mensaje: string) => void
  onRegistrarAuditoria?: (accion: string, descripcion: string) => Promise<void>
}

export const ModalPerfilUsuario: React.FC<ModalPerfilUsuarioProps> = ({
  abierto,
  onCerrar,
  perfilActual,
  onPerfilActualizado,
  onNotificarExito,
  onNotificarError,
  onRegistrarAuditoria,
}) => {
  const [nombre, setNombre] = useState(perfilActual.nombre)
  const [telefono, setTelefono] = useState(perfilActual.telefono || '')
  const [cargo, setCargo] = useState(perfilActual.cargo || 'Operaciones')
  const [fotoUrl, setFotoUrl] = useState<string | null>(perfilActual.foto_url || null)
  const [nuevoBlob, setNuevoBlob] = useState<Blob | null>(null)
  const [fotoFueEliminada, setFotoFueEliminada] = useState(false)
  const [guardando, setGuardando] = useState(false)

  if (!abierto) return null

  const onFotoChange = (data: { url: string | null; blob?: Blob | null; optimizada?: ImagenOptimizada | null }) => {
    setFotoUrl(data.url)
    setNuevoBlob(data.blob || null)
    if (!data.url) {
      setFotoFueEliminada(true)
    } else {
      setFotoFueEliminada(false)
    }
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!nombre.trim()) {
      onNotificarError('El nombre del usuario es obligatorio.')
      return
    }

    setGuardando(true)

    try {
      let finalFotoUrl = fotoUrl

      // 1. Si se seleccionó una nueva foto, subir a Supabase Storage
      if (nuevoBlob && fotoUrl) {
        const resultadoSubida = await subirImagenASupabase({
          blob: nuevoBlob,
          dataUrl: fotoUrl,
          carpeta: 'usuarios',
          idEntidad: perfilActual.id,
        })
        finalFotoUrl = resultadoSubida.url
      } else if (fotoFueEliminada && perfilActual.foto_url) {
        // Eliminar del storage si era una foto remota
        void eliminarImagenDeSupabase(perfilActual.foto_url)
        finalFotoUrl = null
      }

      // 2. Guardar datos en perfil y Auth
      const { perfil, error } = await guardarPerfilUsuario(
        perfilActual.id,
        perfilActual.email,
        {
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          cargo: cargo.trim(),
          foto_url: finalFotoUrl,
        },
      )

      if (error) {
        console.warn('[ModalPerfilUsuario] Advertencia al guardar:', error)
      }

      // 3. Registrar auditoría si hubo cambio de foto o datos
      if (onRegistrarAuditoria) {
        if (finalFotoUrl !== perfilActual.foto_url) {
          if (!finalFotoUrl) {
            await onRegistrarAuditoria(
              'USUARIO_FOTO_ELIMINADA',
              `El usuario ${perfil.nombre} eliminó su fotografía de perfil.`,
            )
          } else {
            await onRegistrarAuditoria(
              'USUARIO_FOTO_ACTUALIZADA',
              `El usuario ${perfil.nombre} actualizó su fotografía de perfil.`,
            )
          }
        }
        if (perfil.nombre !== perfilActual.nombre || perfil.telefono !== perfilActual.telefono) {
          await onRegistrarAuditoria(
            'USUARIO_PERFIL_ACTUALIZADO',
            `El usuario actualizó sus datos de perfil personal.`,
          )
        }
      }

      onPerfilActualizado(perfil)
      onNotificarExito('Perfil actualizado correctamente.')
      onCerrar()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al guardar perfil.'
      onNotificarError(msg)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="overlay-modal print-hidden" onClick={onCerrar}>
      <div className="modal modal-perfil-usuario" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="flex items-center gap-2">
            <UserCheck size={18} className="text-emerald-700" />
            <h3 className="text-base font-bold text-slate-800">Mi Perfil</h3>
          </div>
          <button type="button" className="ghost" onClick={onCerrar} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <form className="modal-form" onSubmit={onSubmit}>
          {/* Componente de Foto de Usuario */}
          <ImageUploadField
            label="Fotografía de Perfil"
            value={fotoUrl}
            nombreReferencia={nombre || perfilActual.nombre}
            tipo="user"
            onChange={onFotoChange}
            onError={onNotificarError}
            disabled={guardando}
          />

          <label>
            Nombre completo
            <div className="field-shell">
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                maxLength={100}
                placeholder="Ej. Ervin Martínez"
              />
            </div>
          </label>

          <label>
            Correo electrónico (cuenta activa)
            <div className="field-shell opacity-80 cursor-not-allowed">
              <Mail size={15} className="text-slate-400" />
              <input
                type="email"
                value={perfilActual.email}
                readOnly
                disabled
                className="bg-slate-100/70"
              />
            </div>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label>
              Teléfono de contacto
              <div className="field-shell">
                <Phone size={15} className="text-slate-400" />
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  maxLength={30}
                  placeholder="+504 0000-0000"
                />
              </div>
            </label>

            <label>
              Cargo / Puesto
              <div className="field-shell">
                <Briefcase size={15} className="text-slate-400" />
                <input
                  type="text"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  maxLength={60}
                  placeholder="Ej. Operaciones / Supervisor"
                />
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center gap-2">
              <Shield size={16} className="text-emerald-700 flex-shrink-0" />
              <div className="text-xs text-emerald-950">
                Rol del sistema: <strong className="text-emerald-800">{perfilActual.rol || 'Operador'}</strong>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
              <div className="text-xs text-slate-800">
                Estado de cuenta: <strong className="text-emerald-700 font-bold">Activa</strong>
              </div>
            </div>
          </div>

          <div className="acciones-linea mt-4">
            <button type="submit" disabled={guardando} className="flex items-center gap-2">
              {guardando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {guardando ? 'Guardando...' : 'Guardar Cambios'}
            </button>
            <button type="button" className="ghost" onClick={onCerrar} disabled={guardando}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
