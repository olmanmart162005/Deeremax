import React, { useState, useEffect } from 'react'
import {
  Users,
  UserPlus,
  Pencil,
  Trash2,
  Power,
  ShieldCheck,
  Eye,
  Crown,
  Fingerprint,
  X,
  Save,
  AlertTriangle,
  Loader2,
  Search,
} from 'lucide-react'
import {
  obtenerUsuariosSistema,
  guardarUsuarioSistema,
  alternarEstadoUsuario,
  eliminarUsuarioSistema,
} from '../services/usuarios'
import { Avatar } from './Avatar'
import type { FormUsuarioSistema, UsuarioSistema, RolUsuario } from '../types'

export interface GestionUsuariosProps {
  rolUsuarioActual: RolUsuario
  onNotificarExito: (msg: string) => void
  onNotificarError: (msg: string) => void
  onRegistrarAuditoria: (accion: string, descripcion: string) => Promise<void>
}

export const GestionUsuarios: React.FC<GestionUsuariosProps> = ({
  rolUsuarioActual,
  onNotificarExito,
  onNotificarError,
  onRegistrarAuditoria,
}) => {
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState<string>('todos')

  // Modal form state
  const [modalAbierto, setModalAbierto] = useState(false)
  const [form, setForm] = useState<FormUsuarioSistema>({
    id: null,
    email: '',
    nombre: '',
    password: '',
    telefono: '',
    cargo: 'Operaciones',
    rol: 'Operador',
    activo: true,
    foto_url: null,
  })
  const [guardando, setGuardando] = useState(false)
  const [usuarioAEliminar, setUsuarioAEliminar] = useState<UsuarioSistema | null>(null)

  const cargarUsuarios = async () => {
    setCargando(true)
    try {
      const list = await obtenerUsuariosSistema(rolUsuarioActual)
      setUsuarios(list)
    } catch (err) {
      console.warn('[GestionUsuarios] Error al cargar:', err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    void cargarUsuarios()
  }, [rolUsuarioActual])

  const usuariosFiltrados = usuarios.filter((u) => {
    const term = busqueda.toLowerCase().trim()
    const coincideTexto =
      !term ||
      u.nombre.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      (u.cargo && u.cargo.toLowerCase().includes(term))

    const coincideRol = filtroRol === 'todos' || u.rol === filtroRol

    return coincideTexto && coincideRol
  })

  const handleAbrirCrear = () => {
    setForm({
      id: null,
      email: '',
      nombre: '',
      password: '',
      telefono: '',
      cargo: 'Operaciones',
      rol: 'Operador',
      activo: true,
      foto_url: null,
    })
    setModalAbierto(true)
  }

  const handleAbrirEditar = (user: UsuarioSistema) => {
    setForm({
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      telefono: user.telefono || '',
      cargo: user.cargo || 'Operaciones',
      rol: user.rol,
      activo: user.activo,
      foto_url: user.foto_url ?? null,
    })
    setModalAbierto(true)
  }

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim() || !form.email.trim()) {
      onNotificarError('Nombre y correo electrónico son requeridos.')
      return
    }

    setGuardando(true)
    const res = await guardarUsuarioSistema(rolUsuarioActual, form)
    setGuardando(false)

    if (res.exitoso) {
      onNotificarExito(form.id ? '✓ Usuario actualizado con éxito.' : '✓ Usuario creado con éxito.')
      await onRegistrarAuditoria(
        form.id ? 'USUARIO_ACTUALIZADO' : 'USUARIO_CREADO',
        `Se ${form.id ? 'actualizó' : 'creó'} el usuario ${form.nombre} (${form.email}) con rol ${form.rol}.`,
      )
      setModalAbierto(false)
      await cargarUsuarios()
    } else {
      onNotificarError(res.error || 'No se pudo guardar el usuario.')
    }
  }

  const handleToggleEstado = async (user: UsuarioSistema) => {
    const nuevoEstado = !user.activo
    const res = await alternarEstadoUsuario(rolUsuarioActual, user.id, nuevoEstado)
    if (res.exitoso) {
      onNotificarExito(`✓ Usuario ${nuevoEstado ? 'activado' : 'desactivado'} con éxito.`)
      await onRegistrarAuditoria(
        'USUARIO_ESTADO_CAMBIADO',
        `Se ${nuevoEstado ? 'activó' : 'desactivó'} el usuario ${user.nombre}.`,
      )
      await cargarUsuarios()
    } else {
      onNotificarError(res.error || 'No se pudo cambiar el estado.')
    }
  }

  const handleEliminar = async () => {
    if (!usuarioAEliminar) return
    const target = usuarioAEliminar
    setUsuarioAEliminar(null)

    const res = await eliminarUsuarioSistema(rolUsuarioActual, target.id)
    if (res.exitoso) {
      onNotificarExito(`✓ Usuario ${target.nombre} eliminado.`)
      await onRegistrarAuditoria(
        'USUARIO_ELIMINADO',
        `Se eliminó al usuario ${target.nombre} (${target.email}).`,
      )
      await cargarUsuarios()
    } else {
      onNotificarError(res.error || 'No se pudo eliminar el usuario.')
    }
  }

  const renderBadgeRol = (rol: RolUsuario) => {
    if (rol === 'Super Admin') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
          <Crown size={12} className="text-amber-600" /> Super Admin
        </span>
      )
    }
    if (rol === 'Supervisor') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60">
          <Eye size={12} className="text-purple-600" /> Supervisor (Solo Lectura)
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
        <ShieldCheck size={12} className="text-emerald-600" /> Operador
      </span>
    )
  }

  return (
    <section className="seccion-vista gestion-usuarios-modulo">
      <div className="tarjeta-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users size={24} className="text-emerald-600" />
              Administración de Usuarios y Accesos
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Control de identidades, asignación de roles y permisos corporativos de Deeremax.
            </p>
          </div>
          <button
            type="button"
            className="btn-nuevo-usuario flex items-center gap-2"
            onClick={handleAbrirCrear}
          >
            <UserPlus size={16} /> Nuevo Usuario
          </button>
        </div>

        {/* Buscador y Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="sm:col-span-2 relative">
            <input
              type="search"
              placeholder="Buscar por nombre, correo o cargo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          </div>
          <div>
            <select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)}>
              <option value="todos">Todos los roles</option>
              <option value="Super Admin">Super Admin (Olman)</option>
              <option value="Operador">Operador (Ervin)</option>
              <option value="Supervisor">Supervisor (Juan Carlos)</option>
            </select>
          </div>
        </div>

        {/* Lista de Usuarios */}
        {cargando ? (
          <div className="py-12 text-center text-slate-400">
            <Loader2 size={28} className="animate-spin mx-auto mb-2 text-emerald-600" />
            <p className="text-sm">Cargando directorio de usuarios...</p>
          </div>
        ) : (
          <div className="tabla-wrap">
            <table className="responsive-table tabla-usuarios-admin">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Contacto</th>
                  <th>Rol / Permisos</th>
                  <th>Biometría</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map((user) => (
                  <tr key={user.id}>
                    <td data-label="Usuario">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={user.foto_url}
                          name={user.nombre}
                          size="md"
                          type="user"
                          border={true}
                        />
                        <div>
                          <strong className="block text-sm text-slate-900 dark:text-white">
                            {user.nombre}
                          </strong>
                          <span className="text-xs text-slate-500 block">{user.email}</span>
                          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                            {user.cargo}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td data-label="Contacto">
                      <span className="text-xs text-slate-600 dark:text-slate-300">
                        {user.telefono || 'Sin teléfono'}
                      </span>
                    </td>
                    <td data-label="Rol">{renderBadgeRol(user.rol)}</td>
                    <td data-label="Biometría">
                      {user.biometria_activa ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          <Fingerprint size={14} /> Vinculada
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">No vinculada</span>
                      )}
                    </td>
                    <td data-label="Estado">
                      <span
                        className={`estado-pill ${user.activo ? 'estado-bueno' : 'estado-bajo'}`}
                      >
                        {user.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td data-label="Acciones" className="acciones-celda">
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => handleAbrirEditar(user)}
                        title="Editar información y rol"
                      >
                        <Pencil size={13} /> Editar
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => handleToggleEstado(user)}
                        title={user.activo ? 'Desactivar usuario' : 'Activar usuario'}
                      >
                        <Power size={13} /> {user.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      {user.rol !== 'Super Admin' && (
                        <button
                          type="button"
                          className="danger"
                          onClick={() => setUsuarioAEliminar(user)}
                          title="Eliminar usuario del sistema"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Crear / Editar Usuario */}
      {modalAbierto && (
        <div className="overlay-modal print-hidden" onClick={() => setModalAbierto(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="font-bold text-base text-slate-800 dark:text-white flex items-center gap-2">
                <UserPlus size={18} className="text-emerald-600" />
                {form.id ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h3>
              <button className="ghost" onClick={() => setModalAbierto(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleGuardar} className="modal-form">
              <label>
                Nombre Completo
                <input
                  type="text"
                  required
                  value={form.nombre}
                  onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: Olman Lagos"
                />
              </label>

              <label>
                Correo Electrónico
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="usuario@deeremax.app"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label>
                  Teléfono
                  <input
                    type="text"
                    value={form.telefono}
                    onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
                    placeholder="+504 9999-0000"
                  />
                </label>
                <label>
                  Cargo / Puesto
                  <input
                    type="text"
                    value={form.cargo}
                    onChange={(e) => setForm((p) => ({ ...p, cargo: e.target.value }))}
                    placeholder="Ej: Operaciones"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label>
                  Rol del Usuario
                  <select
                    value={form.rol}
                    onChange={(e) => setForm((p) => ({ ...p, rol: e.target.value as RolUsuario }))}
                  >
                    <option value="Super Admin">Super Admin (Control Total)</option>
                    <option value="Operador">Operador (Registro y Captura)</option>
                    <option value="Supervisor">Supervisor (Solo Lectura)</option>
                  </select>
                </label>
                <label>
                  Estado
                  <select
                    value={form.activo ? 'true' : 'false'}
                    onChange={(e) => setForm((p) => ({ ...p, activo: e.target.value === 'true' }))}
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </label>
              </div>

              {!form.id && (
                <label>
                  Contraseña Inicial (Opcional)
                  <input
                    type="password"
                    value={form.password || ''}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                  />
                </label>
              )}

              <div className="acciones-linea mt-4">
                <button type="submit" disabled={guardando}>
                  <Save size={16} /> {guardando ? 'Guardando...' : 'Guardar Usuario'}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setModalAbierto(false)}
                  disabled={guardando}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      {usuarioAEliminar && (
        <div className="overlay-modal print-hidden" onClick={() => setUsuarioAEliminar(null)}>
          <div className="modal modal-confirmacion" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertTriangle size={18} /> Confirmar Eliminación
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-300 mt-2">
              ¿Estás seguro de eliminar permanentemente al usuario{' '}
              <strong>{usuarioAEliminar.nombre}</strong> ({usuarioAEliminar.email})?
            </p>
            <div className="acciones-linea mt-4">
              <button className="ghost" onClick={() => setUsuarioAEliminar(null)}>
                Cancelar
              </button>
              <button className="danger" onClick={handleEliminar}>
                Eliminar Permanentemente
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
