import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, format, getWeek, getWeekYear, parseISO, startOfMonth, startOfYear } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Crown,
  Download,
  Eye,
  EyeOff,
  Filter,
  FileText,
  Fingerprint,
  FolderOpen,
  Home,
  History,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  Menu,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  Plus,
  Power,
  Save,
  Settings,
  ShieldCheck,
  Trophy,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  X,
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigError } from './lib/supabase'
import type {
  DetalleReporte,
  EntryFormState,
  Productor,
  Reporte,
  PerfilUsuario,
  RolUsuario,
  WebAuthnCredentialRecord,
} from './types'
import {
  actualizarEstadoProductor,
  estaActivo,
  guardarProductor,
} from './services/productores'
import {
  exportElementToImage,
  exportElementToPdf,
  exportRowsToCsv,
  exportRowsToExcel,
} from './services/exporters'
import {
  normalizarEventoAuditoria,
  registrarEventoAuditoria,
  type EventoAuditoria,
  type TipoEventoAuditoria,
} from './services/auditoria'
import {
  normalizarRol,
  validarPermisoEscritura,
} from './services/permisos'
import {
  esWebAuthnSoportado,
  obtenerCredencialesUsuario,
} from './services/webauthn'
import { ReporteEmpaque } from './components/ReporteEmpaque'
import { Logo } from './components/Logo'
import { Avatar } from './components/Avatar'
import { ImageUploadField } from './components/ImageUploadField'
import { ModalPerfilUsuario } from './components/ModalPerfilUsuario'
import { SplashScreen } from './components/SplashScreen'
import { ModoSupervisorBadge } from './components/ModoSupervisorBadge'
import { PromptConfigurarBiometria } from './components/PromptConfigurarBiometria'
import { BiometricUnlockView } from './components/BiometricUnlockView'
import { CentroSeguridad } from './components/CentroSeguridad'
import { CentroNotificaciones } from './components/CentroNotificaciones'
import { GestionUsuarios } from './components/GestionUsuarios'
import { BottomNavigation } from './components/BottomNavigation'
import { ThemeToggle } from './components/ThemeToggle'
import { obtenerPerfilUsuario } from './services/perfilUsuario'
import { subirImagenASupabase, eliminarImagenDeSupabase } from './services/imageManager'
import {
  exportarReporteEmpaqueExcel,
  exportarReporteEmpaquePDF,
  exportarReporteEmpaquePNG,
} from './services/reporteEmpaque'
import {
  computeDailyTotals,
  computeWeeklyTotals,
  getInitialFormState,
  getWeekRange,
  toNumber,
  weeklyRendimiento,
} from './utils/report'

type FiltroRango = 'semana' | 'mes' | 'anio' | 'personalizado' | 'todo'
type DashboardRango = 'hoy' | 'semana' | 'mes' | 'anio' | 'personalizado'
type Vista =
  | 'inicio'
  | 'productores'
  | 'captura'
  | 'reportes'
  | 'auditoria'
  | 'usuarios'
  | 'seguridad'
  | 'perfil'

type Toast = { kind: 'success' | 'error'; text: string }
type FiltroEstadoProductor = 'todos' | 'activos' | 'inactivos'
type OrdenProductor = 'nombre' | 'codigo' | 'creacion'
type OrdenAuditoriaColumna = 'fecha' | 'hora' | 'usuario' | 'modulo' | 'accion' | 'descripcion'
type OrdenAuditoriaDireccion = 'asc' | 'desc'

type FormProductor = {
  id: string | null
  codigo: string
  nombre: string
  telefono: string
  finca: string
  sector: string
  observaciones: string
  activo: boolean
  foto_url: string | null
}

type FilaReporteGeneralSemanal = {
  productorId: string
  productor: string
  totalCestasAmericanasEnviadas: number
  totalCestasHinduEnviadas: number
  totalAmericanasEmpacadas: number
  totalHinduEmpacadas: number
  totalCestasEnviadas: number
  totalCajasEmpacadas: number
  fechaInicio: string
  fechaFin: string
}

const UMBRAL_BUENO = 0.5

const TITULOS_FILTRO: Record<FiltroRango, string> = {
  semana: 'Semana actual',
  mes: 'Mes seleccionado',
  anio: 'Año seleccionado',
  personalizado: 'Rango personalizado',
  todo: 'Historial completo',
}

const TITULOS_FILTRO_DASHBOARD: Record<DashboardRango, string> = {
  hoy: 'Hoy',
  semana: 'Últimos 7 días',
  mes: 'Mes actual',
  anio: 'Año en curso',
  personalizado: 'Período personalizado',
}

const META_VISTA: Record<Vista, { modulo: string; breadcrumb: string; cargo: string }> = {
  inicio: { modulo: 'Panel de Control', breadcrumb: 'Inicio', cargo: 'Operaciones' },
  productores: { modulo: 'Gestión de Productores', breadcrumb: 'Inicio / Productores', cargo: 'Productores' },
  captura: { modulo: 'Captura Semanal', breadcrumb: 'Inicio / Captura', cargo: 'Producción' },
  reportes: { modulo: 'Reportes Ejecutivos', breadcrumb: 'Inicio / Reportes', cargo: 'Análisis' },
  auditoria: { modulo: 'Auditoría y Trazabilidad', breadcrumb: 'Inicio / Auditoría', cargo: 'Seguridad' },
  usuarios: { modulo: 'Administración de Usuarios', breadcrumb: 'Inicio / Usuarios', cargo: 'Super Admin' },
  seguridad: { modulo: 'Centro de Seguridad', breadcrumb: 'Inicio / Seguridad', cargo: 'Protección' },
  perfil: { modulo: 'Mi Perfil de Usuario', breadcrumb: 'Inicio / Perfil', cargo: 'Cuenta' },
}

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const duration = 700
    const startValue = displayValue
    const diff = value - startValue
    const startTime = performance.now()
    let raf = 0

    const tick = (time: number) => {
      const elapsed = time - startTime
      const progress = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(startValue + diff * eased)
      if (progress < 1) raf = window.requestAnimationFrame(tick)
    }

    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [value])

  return (
    <>{displayValue.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}</>
  )
}

function Sparkline({ data, color = '#1B5E20' }: { data: Array<{ valor: number }>; color?: string }) {
  return (
    <div className="h-12 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="valor" stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

const formatoFechaLarga = (date: Date) => {
  const text = new Intl.DateTimeFormat('es-HN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const formatoHora = (date: Date) => {
  return new Intl.DateTimeFormat('es-HN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

const formatearNombreUsuario = (email: string) => {
  const base = email.split('@')[0].replace(/[._-]+/g, ' ').trim()
  if (base.toLowerCase() === 'ervin2026' || base.toLowerCase() === 'ervin') return 'Ervin Martínez'
  if (
    base.toLowerCase() === 'olman' ||
    base.toLowerCase() === 'olman2026' ||
    base.toLowerCase() === 'olmanmart16'
  ) return 'Olman'
  if (
    base.toLowerCase() === 'juancarlos' ||
    base.toLowerCase() === 'jcmunoz' ||
    base.toLowerCase() === 'juancarlosmunoz'
  ) return 'Juan Carlos Muñoz'
  return base
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

const normalizarCodigo = (codigo: string) => codigo.trim().toUpperCase()

const infoRendimiento = (rendA: number, rendH: number) => {
  if (rendA > UMBRAL_BUENO || rendH > UMBRAL_BUENO) {
    return { label: 'BUENO', className: 'estado-bueno' }
  }
  return { label: 'BAJO RENDIMIENTO', className: 'estado-bajo' }
}

const logErrorSupabase = (contexto: string, error: { message?: string } | null) => {
  if (!error) return
  console.error(`[Supabase] ${contexto}`, error)
}

const obtenerSemanaAnio = (fechaISO: string) => {
  const parsed = parseISO(fechaISO)
  return {
    semana: getWeek(parsed, { weekStartsOn: 4 }),
    anio: getWeekYear(parsed, { weekStartsOn: 4 }),
  }
}

const llaveSemana = (semana: number, anio: number) => `${anio}-${String(semana).padStart(2, '0')}`

const filtrarYOrdenarProductores = (
  list: Productor[],
  busqueda: string,
  filtroEstado: FiltroEstadoProductor,
  orden: OrdenProductor,
) => {
  const key = busqueda.trim().toLowerCase()

  const filtrados = list.filter((item) => {
    if (filtroEstado === 'activos' && !estaActivo(item)) return false
    if (filtroEstado === 'inactivos' && estaActivo(item)) return false

    if (!key) return true

    return item.nombre.toLowerCase().includes(key) || (item.codigo ?? '').toLowerCase().includes(key)
  })

  return filtrados.sort((a, b) => {
    if (orden === 'codigo') return (a.codigo ?? '').localeCompare(b.codigo ?? '', 'es')
    if (orden === 'creacion') return b.created_at.localeCompare(a.created_at)
    return a.nombre.localeCompare(b.nombre, 'es')
  })
}

const siguienteCodigo = (lista: Productor[]) => {
  const maximo = lista.reduce((acc, item) => {
    const match = /^P(\d{3})$/.exec(normalizarCodigo(item.codigo ?? ''))
    if (!match) return acc
    const num = Number(match[1])
    return Number.isFinite(num) ? Math.max(acc, num) : acc
  }, 0)

  return `P${String(maximo + 1).padStart(3, '0')}`
}

const normalizarProductor = (row: Record<string, unknown>): Productor => {
  return {
    id: String(row.id ?? ''),
    codigo: String(row.codigo ?? '').trim() || null,
    nombre: String(row.nombre ?? '').trim().toUpperCase(),
    telefono: String(row.telefono ?? '').trim() || null,
    finca: String(row.finca ?? '').trim() || null,
    sector: String(row.sector ?? '').trim() || null,
    observaciones: String(row.observaciones ?? '').trim() || null,
    activo: typeof row.activo === 'boolean' ? row.activo : true,
    foto_url: typeof row.foto_url === 'string' && row.foto_url.trim() ? row.foto_url.trim() : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
  }
}

const normalizarDetalle = (row: Record<string, unknown>): DetalleReporte => {
  return {
    id: String(row.id ?? ''),
    reporte_id: String(row.reporte_id ?? ''),
    fecha: String(row.fecha ?? ''),
    cestas_a: toNumber(row.cestas_a as number | string | null),
    cestas_h: toNumber(row.cestas_h as number | string | null),
    americana_4: toNumber(row.americana_4 as number | string | null),
    americana_5: toNumber(row.americana_5 as number | string | null),
    americana_7: toNumber(row.americana_7 as number | string | null),
    hindu_4: toNumber(row.hindu_4 as number | string | null),
    hindu_5: toNumber(row.hindu_5 as number | string | null),
    hindu_7: toNumber(row.hindu_7 as number | string | null),
    observaciones: String(row.observaciones ?? '').trim() || null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  }
}

const normalizarReporte = (row: Record<string, unknown>): Reporte => {
  const detalles = Array.isArray(row.detalle_reporte)
    ? row.detalle_reporte.map((item) => normalizarDetalle(item as Record<string, unknown>))
    : []

  const total_cajas = toNumber(row.total_cajas as number | string | null)
  const rendimiento_a = toNumber(row.rendimiento_a as number | string | null)
  const rendimiento_h = toNumber(row.rendimiento_h as number | string | null)
  const estado = String(row.estado ?? '').trim()

  return {
    id: String(row.id ?? ''),
    productor_id: String(row.productor_id ?? ''),
    semana: toNumber(row.semana as number | string | null),
    anio: toNumber(row.anio as number | string | null),
    fecha_inicio: String(row.fecha_inicio ?? ''),
    fecha_fin: String(row.fecha_fin ?? ''),
    total_cajas,
    rendimiento_a,
    rendimiento_h,
    estado,
    created_at: String(row.created_at ?? new Date().toISOString()),
    detalle_reporte: [...detalles].sort((a, b) => a.fecha.localeCompare(b.fecha)),
  }
}

const normalizarFilaReporteGeneralSemanal = (row: Record<string, unknown>): FilaReporteGeneralSemanal => {
  return {
    productorId: String(row.productor_id ?? ''),
    productor: String(row.productor ?? '').trim() || 'Sin nombre',
    totalCestasAmericanasEnviadas: toNumber(row.total_cestas_americanas_enviadas as number | string | null),
    totalCestasHinduEnviadas: toNumber(row.total_cestas_hindu_enviadas as number | string | null),
    totalAmericanasEmpacadas: toNumber(row.total_americanas_empacadas as number | string | null),
    totalHinduEmpacadas: toNumber(row.total_hindu_empacadas as number | string | null),
    totalCestasEnviadas: toNumber(row.total_cestas_enviadas as number | string | null),
    totalCajasEmpacadas: toNumber(row.total_cajas_empacadas as number | string | null),
    fechaInicio: String(row.fecha_inicio ?? ''),
    fechaFin: String(row.fecha_fin ?? ''),
  }
}

function PantallaLogin({
  onLoginExitoso,
  onVerificarBiometria,
}: {
  onLoginExitoso: (user: any) => void
  onVerificarBiometria: () => void
}) {
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mostrarContrasena, setMostrarContrasena] = useState(false)
  const [recordarme, setRecordarme] = useState(true)

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setGuardando(true)

    const emailTrim = correo.trim().toLowerCase()

    if (supabase) {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: emailTrim,
        password: contrasena,
      })

      if (authError) {
        logErrorSupabase('Inicio de sesión', authError)
        const msg = authError.message.toLowerCase()

        // Fallback para perfiles de prueba rápidos (Olman, Juan Carlos, Ervin)
        if (
          contrasena === '123456' &&
          (emailTrim.includes('olman') || emailTrim.includes('juancarlos') || emailTrim.includes('ervin'))
        ) {
          const mockUser = {
            id: emailTrim.includes('olman')
              ? 'user_olman_001'
              : emailTrim.includes('juancarlos')
                ? 'user_juancarlos_003'
                : 'user_ervin_002',
            email: emailTrim,
            user_metadata: {
              nombre: formatearNombreUsuario(emailTrim),
              rol: normalizarRol(null, emailTrim),
            },
          }
          onLoginExitoso(mockUser)
          setGuardando(false)
          return
        }

        if (msg.includes('email not confirmed')) {
          setError('Tu correo no está confirmado en el sistema. Solicita activación al administrador.')
        } else if (msg.includes('invalid login credentials')) {
          setError('Credenciales inválidas. Por favor verifica correo y contraseña.')
        } else {
          setError('No pudimos iniciar sesión. Verifica tus datos e intenta de nuevo.')
        }
        setGuardando(false)
        return
      }

      if (data?.session) {
        onLoginExitoso(data.session.user)
      }
    } else {
      // Mock / Offline authentication fallback
      const mockUser = {
        id: emailTrim.includes('olman')
          ? 'user_olman_001'
          : emailTrim.includes('juancarlos')
            ? 'user_juancarlos_003'
            : 'user_ervin_002',
        email: emailTrim,
        user_metadata: {
          nombre: formatearNombreUsuario(emailTrim),
          rol: normalizarRol(null, emailTrim),
        },
      }
      onLoginExitoso(mockUser)
    }

    setGuardando(false)
  }

  return (
    <div className="login-page login-premium">
      <div className="login-bg-pattern" aria-hidden="true" />
      <div className="login-bg-orb orb-left" aria-hidden="true" />
      <div className="login-bg-orb orb-right" aria-hidden="true" />

      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.45 }}
          className="flex justify-center mb-3"
        >
          <div className="p-3 bg-white dark:bg-white rounded-2xl shadow-sm border border-slate-200/80 inline-flex items-center justify-center">
            <Logo className="brand-logo" alt="DeereMax" />
          </div>
        </motion.div>
        <p className="login-caption">Control Operativo · Gestión Empresarial</p>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Iniciar Sesión</h1>
        <p className="login-tagline">Soluciones que cultivan el futuro.</p>

        <form className="login-form" onSubmit={onSubmit}>
          <label>
            Usuario o Correo Electrónico
            <div className="field-shell">
              <Mail size={17} />
              <input
                type="text"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
                autoComplete="username"
                placeholder=""
              />
            </div>
          </label>

          <label>
            Contraseña
            <div className="field-shell">
              <LockKeyhole size={17} />
              <input
                type={mostrarContrasena ? 'text' : 'password'}
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                required
                minLength={4}
                autoComplete="current-password"
                placeholder=""
              />
              <button
                type="button"
                className="field-toggle"
                onClick={() => setMostrarContrasena((prev) => !prev)}
                aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {mostrarContrasena ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>

          {error ? <span className="error-text">{error}</span> : null}

          <motion.button
            type="submit"
            disabled={guardando}
            whileHover={{ y: -1, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full justify-center h-11 text-base font-bold shadow-md mt-2"
          >
            <LogIn size={18} /> {guardando ? 'Verificando...' : 'Iniciar Sesión'}
          </motion.button>

          <div className="login-extras flex items-center justify-between mt-2">
            <label className="remember-check flex items-center gap-2">
              <input
                type="checkbox"
                checked={recordarme}
                onChange={(e) => setRecordarme(e.target.checked)}
              />
              <span>Recordar mi sesión</span>
            </label>

            {esWebAuthnSoportado() && (
              <button
                type="button"
                className="ghost text-xs py-1 px-2.5 flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold"
                onClick={onVerificarBiometria}
              >
                <Fingerprint size={15} /> Desbloqueo biométrico
              </button>
            )}
          </div>
        </form>
      </motion.div>

      <footer className="login-footer">
        <p>© 2026 DeereMax · Sistema Seguro y Encriptado</p>
        <p>Soluciones que cultivan el futuro.</p>
      </footer>
    </div>
  )
}

function App() {
  const queryClient = useQueryClient()
  const [splashCompletado, setSplashCompletado] = useState(false)
  const [sesion, setSesion] = useState<Session | null>(null)
  const [usuarioLocal, setUsuarioLocal] = useState<any | null>(null)
  const [vista, setVista] = useState<Vista>('inicio')
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false)
  const menuUsuarioRef = useRef<HTMLDivElement>(null)
  const [ahora, setAhora] = useState(new Date())

  // Biometric & Unlock State
  const [modoBiometriaDesbloqueo, setModoBiometriaDesbloqueo] = useState(false)
  const [mostrarPromptBiometria, setMostrarPromptBiometria] = useState(false)
  const [credencialesDispositivo, setCredencialesDispositivo] = useState<WebAuthnCredentialRecord[]>([])

  const [filtro, setFiltro] = useState<FiltroRango>('semana')
  const [mesSeleccionado, setMesSeleccionado] = useState(format(startOfMonth(new Date()), 'yyyy-MM'))
  const [anioSeleccionado, setAnioSeleccionado] = useState(format(startOfYear(new Date()), 'yyyy'))
  const [desdePersonalizado, setDesdePersonalizado] = useState(format(new Date(), 'yyyy-MM-01'))
  const [hastaPersonalizado, setHastaPersonalizado] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstadoProductores, setFiltroEstadoProductores] = useState<FiltroEstadoProductor>('todos')
  const [ordenProductores, setOrdenProductores] = useState<OrdenProductor>('nombre')

  const [formCaptura, setFormCaptura] = useState<EntryFormState>(getInitialFormState())
  const [detalleEnEdicionId, setDetalleEnEdicionId] = useState<string | null>(null)
  const [reporteEnFocoId, setReporteEnFocoId] = useState<string | null>(null)
  const [reporteEnEdicionId, setReporteEnEdicionId] = useState<string | null>(null)
  const [fechaDetalleSeleccionada, setFechaDetalleSeleccionada] = useState<string | null>(null)
  const [retroalimentacion, setRetroalimentacion] = useState('')

  const [productorActivoId, setProductorActivoId] = useState('')
  const [fechaReporteProductor, setFechaReporteProductor] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [fechaGeneral, setFechaGeneral] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [rpcReporteGeneralDisponible, setRpcReporteGeneralDisponible] = useState(true)
  const [filtroDashboard, setFiltroDashboard] = useState<DashboardRango>('semana')
  const [dashboardDesde, setDashboardDesde] = useState(format(new Date(), 'yyyy-MM-01'))
  const [dashboardHasta, setDashboardHasta] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [auditoriaTexto, setAuditoriaTexto] = useState('')
  const [auditoriaUsuario, setAuditoriaUsuario] = useState('todos')
  const [auditoriaModulo, setAuditoriaModulo] = useState('todos')
  const [auditoriaTipo, setAuditoriaTipo] = useState<'todos' | TipoEventoAuditoria>('todos')
  const [auditoriaDesde, setAuditoriaDesde] = useState('')
  const [auditoriaHasta, setAuditoriaHasta] = useState('')
  const [auditoriaOrdenColumna, setAuditoriaOrdenColumna] = useState<OrdenAuditoriaColumna>('fecha')
  const [auditoriaOrdenDireccion, setAuditoriaOrdenDireccion] = useState<OrdenAuditoriaDireccion>('desc')
  const [auditoriaPagina, setAuditoriaPagina] = useState(1)
  const auditoriaTamPagina = 15
  const [auditoriaTablaDisponible, setAuditoriaTablaDisponible] = useState(true)

  const [modalPerfilAbierto, setModalPerfilAbierto] = useState(false)
  const [modalProductorAbierto, setModalProductorAbierto] = useState(false)
  const [formProductor, setFormProductor] = useState<FormProductor>({
    id: null,
    codigo: 'P001',
    nombre: '',
    telefono: '',
    finca: '',
    sector: '',
    observaciones: '',
    activo: true,
    foto_url: null,
  })
  const [formProductorBlob, setFormProductorBlob] = useState<Blob | null>(null)
  const [formProductorFotoEliminada, setFormProductorFotoEliminada] = useState(false)
  const [menuProductorId, setMenuProductorId] = useState<string | null>(null)
  const [confirmacionEliminar, setConfirmacionEliminar] = useState<Productor | null>(null)

  const [toast, setToast] = useState<Toast | null>(null)
  const sesionPreviaRef = useRef<string | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setAhora(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])


  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  // Setup Supabase Auth listener
  useEffect(() => {
    if (supabaseConfigError) return

    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        setSesion(data.session)
        sesionPreviaRef.current = data.session?.user.id ?? null

        if (data.session?.user) {
          // Consultar credenciales de WebAuthn registradas
          void obtenerCredencialesUsuario(data.session.user.id).then((creds) => {
            setCredencialesDispositivo(creds)
          })
        }
      })

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, updatedSession) => {
        setSesion(updatedSession)

        if (event === 'SIGNED_IN' && updatedSession) {
          const actualId = updatedSession.user.id
          if (sesionPreviaRef.current !== actualId) {
            void registrarEventoAuditoria({
              tipo: 'auth',
              accion: 'LOGIN',
              descripcion: 'Inicio de sesión exitoso mediante credenciales.',
              modulo: 'Autenticación',
              usuarioId: actualId,
              usuarioEmail: updatedSession.user.email ?? null,
              usuarioNombre: formatearNombreUsuario(updatedSession.user.email ?? 'usuario@deeremax.app'),
            })

            // Verificar si debe mostrar prompt de biometría
            if (esWebAuthnSoportado()) {
              void obtenerCredencialesUsuario(actualId).then((creds) => {
                setCredencialesDispositivo(creds)
                if (creds.length === 0) {
                  setMostrarPromptBiometria(true)
                }
              })
            }
          }
        }

        if (event === 'SIGNED_OUT') {
          sesionPreviaRef.current = null
        } else {
          sesionPreviaRef.current = updatedSession?.user.id ?? null
        }
      })

      return () => subscription.unsubscribe()
    }
  }, [sesion?.user.email])

  const usuarioActivo = sesion?.user || usuarioLocal

  const qProductores = useQuery({
    queryKey: ['productores', usuarioActivo?.id],
    enabled: Boolean(usuarioActivo),
    queryFn: async () => {
      if (!supabase) {
        // Fallback default producers for demo
        return [
          { id: 'prod-001', codigo: 'P001', nombre: 'JUAN CARLOS 001 FINCA', finca: '001', telefono: '9988-7766', sector: 'Sector 1', observaciones: null, activo: true, foto_url: null, created_at: new Date().toISOString() },
          { id: 'prod-002', codigo: 'P002', nombre: 'OLMAN LAGOS', finca: '104', telefono: '9888-1122', sector: 'Sector 2', observaciones: null, activo: true, foto_url: null, created_at: new Date().toISOString() },
          { id: 'prod-003', codigo: 'P003', nombre: 'ERVIN PRODUCCIÓN', finca: '115', telefono: '9777-3344', sector: 'Sector 3', observaciones: null, activo: true, foto_url: null, created_at: new Date().toISOString() },
        ] as Productor[]
      }

      const { data, error } = await supabase.from('productores').select('*').order('nombre', { ascending: true })
      if (error) {
        logErrorSupabase('Consulta de productores', error)
        throw error
      }

      const lista = (data ?? []).map((row) => normalizarProductor(row as Record<string, unknown>))
      return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    },
  })

  const qReportesProductor = useQuery({
    queryKey: ['reportes-productor', productorActivoId],
    enabled: Boolean(productorActivoId),
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('reportes')
        .select('*, detalle_reporte(*)')
        .eq('productor_id', productorActivoId)
        .order('fecha_inicio', { ascending: false })

      if (error) {
        logErrorSupabase('Consulta historial de reportes', error)
        throw error
      }

      return (data ?? []).map((row) => normalizarReporte(row as Record<string, unknown>))
    },
  })

  const qReportesGlobal = useQuery({
    queryKey: ['reportes-globales', usuarioActivo?.id],
    enabled: Boolean(usuarioActivo),
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('reportes')
        .select('*, detalle_reporte(*)')
        .order('fecha_inicio', { ascending: false })

      if (error) {
        logErrorSupabase('Consulta global de reportes', error)
        throw error
      }

      return (data ?? []).map((row) => normalizarReporte(row as Record<string, unknown>))
    },
  })

  const qReporteGeneralSemanal = useQuery<FilaReporteGeneralSemanal[]>({
    queryKey: ['reporte-general-semanal', usuarioActivo?.id, fechaGeneral],
    enabled: Boolean(usuarioActivo) && vista === 'reportes' && rpcReporteGeneralDisponible,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!supabase) return []
      const criterio = obtenerSemanaAnio(fechaGeneral)
      const { data, error } = await supabase.rpc('reporte_general_semanal_productores', {
        p_semana: criterio.semana,
        p_anio: criterio.anio,
      })

      if (error) {
        const code = String((error as { code?: string }).code ?? '')
        const message = String(error.message ?? '').toLowerCase()
        const rpcNoDisponible = code === 'PGRST202' || message.includes('could not find the function')
        if (rpcNoDisponible) {
          setRpcReporteGeneralDisponible(false)
          return []
        }

        logErrorSupabase('Consulta SQL reporte general semanal', error)
        return []
      }

      const registros = (data ?? []) as Record<string, unknown>[]
      return registros
        .map((row) => normalizarFilaReporteGeneralSemanal(row))
        .sort((a, b) => a.productor.localeCompare(b.productor, 'es'))
    },
  })

  const qPerfilUsuario = useQuery<PerfilUsuario | null>({
    queryKey: ['perfil-usuario', usuarioActivo?.id],
    enabled: Boolean(usuarioActivo?.id),
    queryFn: async () => {
      if (!usuarioActivo) return null
      return obtenerPerfilUsuario(
        usuarioActivo.id,
        usuarioActivo.email ?? '',
        usuarioActivo.user_metadata,
      )
    },
  })

  // Role calculation and permissions
  const rolUsuario: RolUsuario = useMemo(() => {
    return normalizarRol(qPerfilUsuario.data?.rol, usuarioActivo?.email)
  }, [qPerfilUsuario.data?.rol, usuarioActivo?.email])

  const esSuperAdmin = rolUsuario === 'Super Admin'
  const esSupervisor = rolUsuario === 'Supervisor'

  const qAuditoria = useQuery<EventoAuditoria[]>({
    queryKey: ['auditoria-eventos', usuarioActivo?.id],
    enabled: Boolean(usuarioActivo) && vista === 'auditoria' && esSuperAdmin && auditoriaTablaDisponible,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('auditoria_eventos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000)

      if (error) {
        const code = String((error as { code?: string }).code ?? '')
        const message = String(error.message ?? '').toLowerCase()
        if (code === '42P01' || message.includes('relation') || message.includes('does not exist')) {
          setAuditoriaTablaDisponible(false)
          return []
        }

        logErrorSupabase('Consulta auditoria', error)
        return []
      }

      return (data ?? []).map((row) => normalizarEventoAuditoria(row as Record<string, unknown>))
    },
  })

  // Redirigir a inicio si un usuario no Super Admin intenta entrar a auditoría
  useEffect(() => {
    if (vista === 'auditoria' && !esSuperAdmin) {
      setVista('inicio')
    }
  }, [vista, esSuperAdmin])

  const notificarExito = (text: string) => setToast({ kind: 'success', text })
  const notificarError = (text: string) => setToast({ kind: 'error', text })

  const registrarEvento = async (
    input: Omit<Parameters<typeof registrarEventoAuditoria>[0], 'usuarioId' | 'usuarioEmail' | 'usuarioNombre'>,
  ) => {
    if (!usuarioActivo) return

    const nombreUsuarioActual =
      qPerfilUsuario.data?.nombre || formatearNombreUsuario(usuarioActivo.email ?? 'usuario@deeremax.app')

    await registrarEventoAuditoria({
      ...input,
      usuarioId: usuarioActivo.id,
      usuarioEmail: usuarioActivo.email ?? null,
      usuarioNombre: nombreUsuarioActual,
    })

    if (vista === 'auditoria') {
      void qAuditoria.refetch()
    }
  }

  useEffect(() => {
    const handleClickAfuera = (e: MouseEvent) => {
      if (menuUsuarioRef.current && !menuUsuarioRef.current.contains(e.target as Node)) {
        setMenuUsuarioAbierto(false)
      }
    }
    if (menuUsuarioAbierto) {
      document.addEventListener('mousedown', handleClickAfuera)
    }
    return () => document.removeEventListener('mousedown', handleClickAfuera)
  }, [menuUsuarioAbierto])

  const cerrarSesionUsuario = async () => {
    setMenuAbierto(false)
    setMenuUsuarioAbierto(false)
    await registrarEvento({
      tipo: 'auth',
      accion: 'LOGOUT_REQUEST',
      descripcion: 'Usuario solicitó cierre de sesión.',
      modulo: 'Autenticación',
    })
    if (supabase) {
      await supabase.auth.signOut()
    }
    setSesion(null)
    setUsuarioLocal(null)
    notificarExito('Sesión cerrada.')
  }

  const productoresActivos = useMemo(() => {
    const lista = qProductores.data ?? []
    return lista.filter((item) => estaActivo(item))
  }, [qProductores.data])

  useEffect(() => {
    if (!productorActivoId && productoresActivos.length > 0) {
      setProductorActivoId(productoresActivos[0].id)
      return
    }

    if (
      productorActivoId &&
      productoresActivos.length > 0 &&
      !productoresActivos.some((item) => item.id === productorActivoId)
    ) {
      setProductorActivoId(productoresActivos[0].id)
      setVista('inicio')
    }
  }, [productorActivoId, productoresActivos])

  useEffect(() => {
    if (!formProductor.id) {
      setFormProductor((prev) => ({
        ...prev,
        codigo: prev.codigo || siguienteCodigo(qProductores.data ?? []),
      }))
    }
  }, [formProductor.id, qProductores.data])


  const productorActivo = productoresActivos.find((item) => item.id === productorActivoId)

  const mapaResumenPorProductor = useMemo(() => {
    const mapa = new Map<string, { promedio: number; ultimaSemana: string; reportes: number }>()
    const agrupado = (qReportesGlobal.data ?? []).reduce<Record<string, Reporte[]>>((acc, rep) => {
      if (!acc[rep.productor_id]) acc[rep.productor_id] = []
      acc[rep.productor_id].push(rep)
      return acc
    }, {})

    Object.entries(agrupado).forEach(([idProductor, lista]) => {
      let suma = 0
      let conteo = 0

      lista.forEach((rep) => {
        rep.detalle_reporte.forEach((detalle) => {
          const calc = computeDailyTotals(detalle)
          suma += (calc.rendimientoA + calc.rendimientoH) / 2
          conteo += 1
        })
      })

      mapa.set(idProductor, {
        promedio: conteo > 0 ? suma / conteo : 0,
        ultimaSemana: lista[0] ? `SEM ${lista[0].semana} - ${lista[0].anio}` : 'Sin registros',
        reportes: lista.length,
      })
    })

    return mapa
  }, [qReportesGlobal.data])

  const dashboardData = useMemo(() => {
    const productores = qProductores.data ?? []
    const mapaProductores = new Map(productores.map((item) => [item.id, item]))
    const reportes = qReportesGlobal.data ?? []
    const hoy = format(new Date(), 'yyyy-MM-dd')

    const resumenSimple = (lista: Reporte[]) => {
      let total = 0
      let sumaRend = 0
      let countRend = 0
      lista.forEach((rep) => {
        const totalRep = computeWeeklyTotals(rep)
        const rendRep = weeklyRendimiento(rep)
        total += totalRep.totalBoxes
        sumaRend += (rendRep.rendimientoA + rendRep.rendimientoH) / 2
        countRend += 1
      })
      return {
        total,
        promedio: countRend > 0 ? sumaRend / countRend : 0,
        cantidad: lista.length,
      }
    }

    const filtrarPorRango = (lista: Reporte[], rango: DashboardRango, desde: string, hasta: string) => {
      if (!desde || !hasta) return lista

      if (rango === 'hoy') {
        return lista.filter((rep) => rep.fecha_inicio === hoy)
      }

      if (rango === 'semana') {
        const actual = obtenerSemanaAnio(hoy)
        return lista.filter((rep) => rep.semana === actual.semana && rep.anio === actual.anio)
      }

      if (rango === 'mes') {
        const mes = format(new Date(), 'yyyy-MM')
        return lista.filter((rep) => format(parseISO(rep.fecha_inicio), 'yyyy-MM') === mes)
      }

      if (rango === 'anio') {
        const anio = format(new Date(), 'yyyy')
        return lista.filter((rep) => String(rep.anio) === anio)
      }

      return lista.filter((rep) => rep.fecha_inicio >= desde && rep.fecha_fin <= hasta)
    }

    const reportesActuales = filtrarPorRango(reportes, filtroDashboard, dashboardDesde, dashboardHasta)

    const referenciaAnterior = format(addDays(new Date(), -1), 'yyyy-MM-dd')
    const semanaAnterior = obtenerSemanaAnio(format(addDays(new Date(), -7), 'yyyy-MM-dd'))
    const mesAnterior = format(addDays(startOfMonth(new Date()), -1), 'yyyy-MM')
    const anioAnterior = String(Number(format(new Date(), 'yyyy')) - 1)

    let reportesAnteriores: Reporte[] = []
    if (filtroDashboard === 'hoy') {
      reportesAnteriores = reportes.filter((rep) => rep.fecha_inicio === referenciaAnterior)
    } else if (filtroDashboard === 'semana') {
      reportesAnteriores = reportes.filter(
        (rep) => rep.semana === semanaAnterior.semana && rep.anio === semanaAnterior.anio,
      )
    } else if (filtroDashboard === 'mes') {
      reportesAnteriores = reportes.filter(
        (rep) => format(parseISO(rep.fecha_inicio), 'yyyy-MM') === mesAnterior,
      )
    } else if (filtroDashboard === 'anio') {
      reportesAnteriores = reportes.filter((rep) => String(rep.anio) === anioAnterior)
    } else {
      const diffMs = Math.max(1, parseISO(dashboardHasta).getTime() - parseISO(dashboardDesde).getTime())
      const diffDays = Math.max(1, Math.floor(diffMs / 86400000) + 1)
      const prevHasta = format(addDays(parseISO(dashboardDesde), -1), 'yyyy-MM-dd')
      const prevDesde = format(addDays(parseISO(prevHasta), -(diffDays - 1)), 'yyyy-MM-dd')
      reportesAnteriores = reportes.filter(
        (rep) => rep.fecha_inicio >= prevDesde && rep.fecha_fin <= prevHasta,
      )
    }

    const weeklyMap = new Map<string, { orden: number; semana: string; total: number }>()
    const dailyMap = new Map<string, number>()
    const producerMap = new Map<
      string,
      {
        id: string
        nombre: string
        codigo: string
        totalBoxes: number
        totalAmericana: number
        totalHindu: number
        cestasA: number
        cestasH: number
      }
    >()

    let totalCajas = 0
    let totalAmericana = 0
    let totalHindu = 0
    let sumaRendimiento = 0
    let conteoRendimiento = 0

    const reportesOrdenados = [...reportesActuales].sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))

    reportesOrdenados.forEach((rep) => {
      const totalRep = computeWeeklyTotals(rep)
      const rendRep = weeklyRendimiento(rep)
      totalCajas += totalRep.totalBoxes
      totalAmericana += totalRep.totalAmericana
      totalHindu += totalRep.totalHindu
      sumaRendimiento += (rendRep.rendimientoA + rendRep.rendimientoH) / 2
      conteoRendimiento += 1

      const wkKey = llaveSemana(rep.semana, rep.anio)
      const wkExistente = weeklyMap.get(wkKey)
      weeklyMap.set(wkKey, {
        orden: rep.anio * 100 + rep.semana,
        semana: `S${rep.semana}-${rep.anio}`,
        total: (wkExistente?.total ?? 0) + totalRep.totalBoxes,
      })

      const prod = mapaProductores.get(rep.productor_id)
      const prodExistente = producerMap.get(rep.productor_id)
      producerMap.set(rep.productor_id, {
        id: rep.productor_id,
        nombre: prod?.nombre ?? 'Sin nombre',
        codigo: prod?.codigo ?? 'N/A',
        totalBoxes: (prodExistente?.totalBoxes ?? 0) + totalRep.totalBoxes,
        totalAmericana: (prodExistente?.totalAmericana ?? 0) + totalRep.totalAmericana,
        totalHindu: (prodExistente?.totalHindu ?? 0) + totalRep.totalHindu,
        cestasA: prodExistente?.cestasA ?? 0,
        cestasH: prodExistente?.cestasH ?? 0,
      })

      rep.detalle_reporte.forEach((detalle) => {
        const daily = computeDailyTotals(detalle)
        dailyMap.set(detalle.fecha, (dailyMap.get(detalle.fecha) ?? 0) + daily.totalBoxes)
        const prodDetalle = producerMap.get(rep.productor_id)
        if (prodDetalle) {
          prodDetalle.cestasA += detalle.cestas_a
          prodDetalle.cestasH += detalle.cestas_h
        }
      })
    })

    const productoresResumen = Array.from(producerMap.values()).map((item) => {
      const rendimientoA = item.cestasA > 0 ? item.totalAmericana / item.cestasA : 0
      const rendimientoH = item.cestasH > 0 ? item.totalHindu / item.cestasH : 0
      return {
        ...item,
        rendimientoA,
        rendimientoH,
        rendimientoPromedio: (rendimientoA + rendimientoH) / 2,
      }
    })

    const weeklyTrend = Array.from(weeklyMap.values())
      .sort((a, b) => a.orden - b.orden)
      .slice(-14)
      .map((item) => ({ semana: item.semana, totalCajas: item.total }))

    const sparkline = weeklyTrend.slice(-8).map((item) => ({ valor: item.totalCajas }))

    let acumulado = 0
    const produccionAcumulada = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, total]) => {
        acumulado += total
        return { fecha, total, acumulado }
      })

    const topProductores = [...productoresResumen].sort((a, b) => b.totalBoxes - a.totalBoxes).slice(0, 10)
    const rendimientoPorProductor = [...productoresResumen]
      .sort((a, b) => b.rendimientoPromedio - a.rendimientoPromedio)
      .slice(0, 10)

    const top5 = [...productoresResumen].sort((a, b) => b.rendimientoPromedio - a.rendimientoPromedio).slice(0, 5)

    const pieDistribucion = [
      { name: 'Americana', value: totalAmericana },
      { name: 'Hindú', value: totalHindu },
    ]

    const promedioRendimiento = conteoRendimiento > 0 ? sumaRendimiento / conteoRendimiento : 0

    const mejor = top5[0] ?? null
    const peor = [...productoresResumen].sort((a, b) => a.rendimientoPromedio - b.rendimientoPromedio)[0] ?? null

    const mesesUnicos = new Set(reportesOrdenados.map((item) => item.fecha_inicio.slice(0, 7))).size
    const promedioDiario = produccionAcumulada.length > 0 ? totalCajas / produccionAcumulada.length : 0
    const promedioSemanal = weeklyTrend.length > 0 ? totalCajas / weeklyTrend.length : 0
    const promedioMensual = mesesUnicos > 0 ? totalCajas / mesesUnicos : 0

    const mayorProduccion = weeklyTrend.length > 0 ? Math.max(...weeklyTrend.map((item) => item.totalCajas)) : 0
    const menorProduccion = weeklyTrend.length > 0 ? Math.min(...weeklyTrend.map((item) => item.totalCajas)) : 0

    const ultimosReportes = reportesOrdenados.slice(0, 8).map((rep) => {
      const rend = weeklyRendimiento(rep)
      const estado = infoRendimiento(rend.rendimientoA, rend.rendimientoH)
      const productor = mapaProductores.get(rep.productor_id)
      return {
        id: rep.id,
        fecha: rep.fecha_inicio,
        productor: productor?.nombre ?? 'Sin nombre',
        totalCajas: computeWeeklyTotals(rep).totalBoxes,
        rendimiento: ((rend.rendimientoA + rend.rendimientoH) / 2).toFixed(2),
        estado,
      }
    })

    const previo = resumenSimple(reportesAnteriores)

    const comparar = (actual: number, anterior: number) => {
      if (!anterior) return null
      return ((actual - anterior) / anterior) * 100
    }

    return {
      reportesActuales,
      resumen: {
        totalCajas,
        totalAmericana,
        totalHindu,
        promedioRendimiento,
        reportes: reportesActuales.length,
        productores: productoresActivos.length,
        mejor,
        peor,
      },
      comparativas: {
        totalCajas: comparar(totalCajas, previo.total),
        reportes: comparar(reportesActuales.length, previo.cantidad),
        promedioRendimiento: comparar(promedioRendimiento, previo.promedio),
      },
      indicadores: {
        promedioDiario,
        promedioSemanal,
        promedioMensual,
        mayorProduccion,
        menorProduccion,
        productoresActivos: productoresActivos.length,
        totalReportes: reportesActuales.length,
      },
      weeklyTrend,
      topProductores,
      rendimientoPorProductor,
      pieDistribucion,
      produccionAcumulada,
      sparkline,
      ultimosReportes,
      top5,
    }
  }, [
    dashboardDesde,
    dashboardHasta,
    filtroDashboard,
    productoresActivos.length,
    qProductores.data,
    qReportesGlobal.data,
  ])

  const auditoriaRegistros = useMemo(() => qAuditoria.data ?? [], [qAuditoria.data])

  const auditoriaUsuariosDisponibles = useMemo(() => {
    return Array.from(
      new Set(
        auditoriaRegistros
          .map((item) => item.usuarioNombre || item.usuarioEmail || 'Usuario desconocido')
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, 'es'))
  }, [auditoriaRegistros])

  const auditoriaModulosDisponibles = useMemo(() => {
    return Array.from(new Set(auditoriaRegistros.map((item) => item.modulo).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'es'),
    )
  }, [auditoriaRegistros])

  const auditoriaFiltrada = useMemo(() => {
    const texto = auditoriaTexto.trim().toLowerCase()
    return auditoriaRegistros.filter((item) => {
      const fecha = item.createdAt.slice(0, 10)
      const usuario = item.usuarioNombre || item.usuarioEmail || 'Usuario desconocido'

      const coincideTexto =
        !texto ||
        item.descripcion.toLowerCase().includes(texto) ||
        item.accion.toLowerCase().includes(texto) ||
        item.modulo.toLowerCase().includes(texto) ||
        usuario.toLowerCase().includes(texto)

      const coincideUsuario = auditoriaUsuario === 'todos' || usuario === auditoriaUsuario
      const coincideModulo = auditoriaModulo === 'todos' || item.modulo === auditoriaModulo
      const coincideTipo = auditoriaTipo === 'todos' || item.tipo === auditoriaTipo
      const coincideDesde = !auditoriaDesde || fecha >= auditoriaDesde
      const coincideHasta = !auditoriaHasta || fecha <= auditoriaHasta

      return coincideTexto && coincideUsuario && coincideModulo && coincideTipo && coincideDesde && coincideHasta
    })
  }, [auditoriaDesde, auditoriaHasta, auditoriaModulo, auditoriaRegistros, auditoriaTexto, auditoriaTipo, auditoriaUsuario])

  const auditoriaOrdenada = useMemo(() => {
    const sorted = [...auditoriaFiltrada]
    sorted.sort((a, b) => {
      let left = ''
      let right = ''

      if (auditoriaOrdenColumna === 'fecha') {
        left = a.createdAt.slice(0, 10)
        right = b.createdAt.slice(0, 10)
      } else if (auditoriaOrdenColumna === 'hora') {
        left = format(parseISO(a.createdAt), 'HH:mm:ss')
        right = format(parseISO(b.createdAt), 'HH:mm:ss')
      } else if (auditoriaOrdenColumna === 'usuario') {
        left = a.usuarioNombre || a.usuarioEmail || ''
        right = b.usuarioNombre || b.usuarioEmail || ''
      } else if (auditoriaOrdenColumna === 'modulo') {
        left = a.modulo
        right = b.modulo
      } else if (auditoriaOrdenColumna === 'accion') {
        left = a.accion
        right = b.accion
      } else {
        left = a.descripcion
        right = b.descripcion
      }

      const result = left.localeCompare(right, 'es')
      return auditoriaOrdenDireccion === 'asc' ? result : -result
    })
    return sorted
  }, [auditoriaFiltrada, auditoriaOrdenColumna, auditoriaOrdenDireccion])

  const auditoriaTotalPaginas = Math.max(1, Math.ceil(auditoriaOrdenada.length / auditoriaTamPagina))

  const auditoriaPaginada = useMemo(() => {
    const start = (auditoriaPagina - 1) * auditoriaTamPagina
    return auditoriaOrdenada.slice(start, start + auditoriaTamPagina)
  }, [auditoriaOrdenada, auditoriaPagina])

  const productoresVisibles = useMemo(() => {
    return filtrarYOrdenarProductores(
      qProductores.data ?? [],
      busqueda,
      filtroEstadoProductores,
      ordenProductores,
    )
  }, [busqueda, filtroEstadoProductores, ordenProductores, qProductores.data])

  const reportesFiltrados = useMemo(() => {
    const reportes = qReportesProductor.data ?? []

    if (filtro === 'todo') return reportes

    if (filtro === 'semana') {
      const actual = obtenerSemanaAnio(format(new Date(), 'yyyy-MM-dd'))
      return reportes.filter((item) => item.semana === actual.semana && item.anio === actual.anio)
    }

    if (filtro === 'mes') {
      return reportes.filter((item) => format(parseISO(item.fecha_inicio), 'yyyy-MM') === mesSeleccionado)
    }

    if (filtro === 'anio') {
      return reportes.filter((item) => String(item.anio) === anioSeleccionado)
    }

    if (filtro === 'personalizado') {
      return reportes.filter(
        (item) => item.fecha_inicio >= desdePersonalizado && item.fecha_fin <= hastaPersonalizado,
      )
    }

    return reportes
  }, [anioSeleccionado, desdePersonalizado, filtro, hastaPersonalizado, mesSeleccionado, qReportesProductor.data])

  const reportesParaImpresion = useMemo(() => {
    if (!reporteEnFocoId) return reportesFiltrados
    return reportesFiltrados.filter((item) => item.id === reporteEnFocoId)
  }, [reporteEnFocoId, reportesFiltrados])

  const reporteSemanalProductor = useMemo(() => {
    const criterio = obtenerSemanaAnio(fechaReporteProductor)
    return (qReportesProductor.data ?? []).filter(
      (item) => item.semana === criterio.semana && item.anio === criterio.anio,
    )
  }, [fechaReporteProductor, qReportesProductor.data])

  const reporteSemanalActivo = reporteSemanalProductor[0] ?? null

  const reporteEnEdicion = useMemo(() => {
    if (!reporteEnEdicionId) return null
    return (qReportesProductor.data ?? []).find((item) => item.id === reporteEnEdicionId) ?? null
  }, [qReportesProductor.data, reporteEnEdicionId])

  const diasReporteEnEdicion = useMemo(() => {
    if (!reporteEnEdicion) return []

    const inicio = parseISO(reporteEnEdicion.fecha_inicio)
    return Array.from({ length: 7 }).map((_, index) => {
      const fecha = format(addDays(inicio, index), 'yyyy-MM-dd')
      const detalle = reporteEnEdicion.detalle_reporte.find((item) => item.fecha === fecha) ?? null
      const nombreDia = format(addDays(inicio, index), 'EEEE', { locale: es })

      return {
        fecha,
        nombreDia: nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1),
        detalle,
      }
    })
  }, [reporteEnEdicion])

  useEffect(() => {
    if (!reporteEnEdicion) return

    const detalleSeleccionado = fechaDetalleSeleccionada
      ? reporteEnEdicion.detalle_reporte.find((item) => item.fecha === fechaDetalleSeleccionada) ?? null
      : null
    const primerDetalle = reporteEnEdicion.detalle_reporte[0] ?? null
    const detalleActivo = detalleSeleccionado ?? primerDetalle

    if (!detalleActivo) return

    if (detalleActivo.fecha !== fechaDetalleSeleccionada) {
      setFechaDetalleSeleccionada(detalleActivo.fecha)
    }

    if (detalleActivo.id !== detalleEnEdicionId) {
      cargarDetalleEnCaptura(detalleActivo)
    }
  }, [reporteEnEdicion, fechaDetalleSeleccionada, detalleEnEdicionId])

  const filasGeneralSemanal = useMemo<FilaReporteGeneralSemanal[]>(() => {
    return qReporteGeneralSemanal.data ?? []
  }, [qReporteGeneralSemanal.data])

  const reporteGeneralMeta = useMemo(() => {
    const criterio = obtenerSemanaAnio(fechaGeneral)

    const fallbackRange = getWeekRange(fechaGeneral)
    const fechasInicio = filasGeneralSemanal.map((item) => item.fechaInicio).filter(Boolean)
    const fechasFin = filasGeneralSemanal.map((item) => item.fechaFin).filter(Boolean)

    const fechaInicio = fechasInicio.length > 0
      ? [...fechasInicio].sort((a, b) => a.localeCompare(b))[0]
      : fallbackRange.weekStart
    const fechaFin = fechasFin.length > 0
      ? [...fechasFin].sort((a, b) => b.localeCompare(a))[0]
      : fallbackRange.weekEnd

    const totalCestasAmericanasEnviadas = filasGeneralSemanal.reduce(
      (acc, fila) => acc + fila.totalCestasAmericanasEnviadas,
      0,
    )
    const totalCestasHinduEnviadas = filasGeneralSemanal.reduce((acc, fila) => acc + fila.totalCestasHinduEnviadas, 0)
    const totalAmericanasEmpacadas = filasGeneralSemanal.reduce((acc, fila) => acc + fila.totalAmericanasEmpacadas, 0)
    const totalHinduEmpacadas = filasGeneralSemanal.reduce((acc, fila) => acc + fila.totalHinduEmpacadas, 0)
    const totalCestasEnviadas = filasGeneralSemanal.reduce((acc, fila) => acc + fila.totalCestasEnviadas, 0)
    const totalCajasEmpacadas = filasGeneralSemanal.reduce((acc, fila) => acc + fila.totalCajasEmpacadas, 0)
    const fechaGeneracion = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })
    const periodoDesde = format(parseISO(fechaInicio), "d 'de' MMMM", { locale: es })
    const periodoHasta = format(parseISO(fechaFin), "d 'de' MMMM 'de' yyyy", { locale: es })

    return {
      semana: criterio.semana,
      anio: criterio.anio,
      fechaInicio,
      fechaFin,
      totalCestasAmericanasEnviadas,
      totalCestasHinduEnviadas,
      totalAmericanasEmpacadas,
      totalHinduEmpacadas,
      totalCestasEnviadas,
      totalCajasEmpacadas,
      totalProductores: filasGeneralSemanal.length,
      periodoTexto: `PERÍODO DEL ${periodoDesde.toUpperCase()} AL ${periodoHasta.toUpperCase()}`,
      fechaGeneracion: fechaGeneracion.charAt(0).toUpperCase() + fechaGeneracion.slice(1),
    }
  }, [fechaGeneral, filasGeneralSemanal])

  const metaVista = META_VISTA[vista] || META_VISTA.inicio
  const usuarioEmail = usuarioActivo?.email ?? 'usuario@deeremax.app'
  const usuarioNombre = qPerfilUsuario.data?.nombre || formatearNombreUsuario(usuarioEmail)
  const usuarioCargo = qPerfilUsuario.data?.cargo || metaVista.cargo
  const usuarioFoto = qPerfilUsuario.data?.foto_url || null

  const onCambiarCaptura = (field: keyof EntryFormState, value: string) => {
    if (field === 'fecha' || field === 'observaciones') {
      setFormCaptura((prev) => ({ ...prev, [field]: value }))
      return
    }

    const limpio = value.replace(/[^0-9]/g, '')
    setFormCaptura((prev) => ({ ...prev, [field]: limpio }))
  }

  const resetCaptura = () => {
    setFormCaptura(getInitialFormState())
    setDetalleEnEdicionId(null)
    setReporteEnEdicionId(null)
    setFechaDetalleSeleccionada(null)
    setRetroalimentacion('')
  }

  const cargarDetalleEnCaptura = (detalle: DetalleReporte | null, fechaBase?: string) => {
    if (!detalle) {
      setDetalleEnEdicionId(null)
      setFormCaptura({
        ...getInitialFormState(),
        fecha: fechaBase ?? getInitialFormState().fecha,
      })
      return
    }

    setDetalleEnEdicionId(detalle.id)
    setFormCaptura({
      fecha: detalle.fecha,
      cestas_a: String(detalle.cestas_a),
      cestas_h: String(detalle.cestas_h),
      americana_4: String(detalle.americana_4),
      americana_5: String(detalle.americana_5),
      americana_7: String(detalle.americana_7),
      hindu_4: String(detalle.hindu_4),
      hindu_5: String(detalle.hindu_5),
      hindu_7: String(detalle.hindu_7),
      observaciones: detalle.observaciones ?? '',
    })
  }

  const abrirEdicionReporte = (reporte: Reporte) => {
    setProductorActivoId(reporte.productor_id)
    setFechaReporteProductor(reporte.fecha_inicio)
    setReporteEnFocoId(reporte.id)
    setReporteEnEdicionId(reporte.id)
    setVista('captura')
    setFiltro('todo')
    setRetroalimentacion('')

    const primerDetalle = [...reporte.detalle_reporte].sort((a, b) => a.fecha.localeCompare(b.fecha))[0] ?? null
    setFechaDetalleSeleccionada(primerDetalle?.fecha ?? null)
    cargarDetalleEnCaptura(primerDetalle, reporte.fecha_inicio)
  }

  const seleccionarDiaEdicion = (fecha: string) => {
    setFechaDetalleSeleccionada(fecha)
  }

  const resetFormProductor = () => {
    setFormProductor({
      id: null,
      codigo: siguienteCodigo(qProductores.data ?? []),
      nombre: '',
      telefono: '',
      finca: '',
      sector: '',
      observaciones: '',
      activo: true,
      foto_url: null,
    })
    setFormProductorBlob(null)
    setFormProductorFotoEliminada(false)
  }

  const validarProductor = () => {
    if (!formProductor.nombre.trim()) {
      notificarError('El nombre del productor es obligatorio.')
      return false
    }
    return true
  }

  const guardarFormularioProductor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    // Validación de permisos en backend/servicio
    try {
      validarPermisoEscritura(rolUsuario, formProductor.id ? 'editar este productor' : 'crear nuevos productores')
    } catch (err: any) {
      notificarError(err.message)
      return
    }

    if (!validarProductor()) return

    let finalFotoUrl = formProductor.foto_url

    if (formProductorBlob && formProductor.foto_url) {
      const res = await subirImagenASupabase({
        blob: formProductorBlob,
        dataUrl: formProductor.foto_url,
        carpeta: 'productores',
        idEntidad: formProductor.id || `temp_${normalizarCodigo(formProductor.codigo)}`,
      })
      finalFotoUrl = res.url
    } else if (formProductorFotoEliminada && formProductor.id) {
      const previo = (qProductores.data ?? []).find((p) => p.id === formProductor.id)
      if (previo?.foto_url) {
        void eliminarImagenDeSupabase(previo.foto_url)
      }
      finalFotoUrl = null
    }

    const { error } = await guardarProductor(
      formProductor.id,
      {
        codigo: normalizarCodigo(formProductor.codigo),
        nombre: formProductor.nombre.trim().toUpperCase(),
        telefono: formProductor.telefono.trim(),
        finca: formProductor.finca.trim(),
        sector: formProductor.sector.trim(),
        observaciones: formProductor.observaciones.trim(),
        activo: formProductor.activo,
        foto_url: finalFotoUrl,
      },
      rolUsuario,
    )

    if (error) {
      notificarError(`No se pudo guardar productor: ${error.message}`)
      return
    }

    await qProductores.refetch()
    const accion = formProductor.id ? 'PRODUCTOR_ACTUALIZADO' : 'PRODUCTOR_CREADO'
    const descripcion = formProductor.id
      ? `Se actualizó el productor ${formProductor.nombre.trim().toUpperCase()}${finalFotoUrl ? ' con logotipo/fotografía' : ''}.`
      : `Se creó el productor ${formProductor.nombre.trim().toUpperCase()}${finalFotoUrl ? ' con logotipo/fotografía' : ''}.`
    await registrarEvento({
      tipo: formProductor.id ? 'update' : 'create',
      accion,
      descripcion,
      modulo: 'Productores',
      metadata: {
        productorId: formProductor.id ?? null,
        codigo: normalizarCodigo(formProductor.codigo),
        tieneFoto: Boolean(finalFotoUrl),
      },
    })
    notificarExito(formProductor.id ? 'Productor actualizado con éxito.' : 'Productor creado con éxito.')
    setModalProductorAbierto(false)
    resetFormProductor()
  }

  const abrirEdicionProductor = (item: Productor) => {
    if (esSupervisor) {
      notificarError('Acceso denegado: El modo supervisor es de solo lectura.')
      return
    }

    setFormProductor({
      id: item.id,
      codigo: item.codigo ?? siguienteCodigo(qProductores.data ?? []),
      nombre: item.nombre.toUpperCase(),
      telefono: item.telefono ?? '',
      finca: item.finca ?? '',
      sector: item.sector ?? '',
      observaciones: item.observaciones ?? '',
      activo: estaActivo(item),
      foto_url: item.foto_url ?? null,
    })
    setFormProductorBlob(null)
    setFormProductorFotoEliminada(false)
    setModalProductorAbierto(true)
  }

  const alternarEstado = async (item: Productor) => {
    try {
      validarPermisoEscritura(rolUsuario, 'cambiar el estado del productor')
    } catch (err: any) {
      notificarError(err.message)
      return
    }

    const { error } = await actualizarEstadoProductor(item, !estaActivo(item), rolUsuario)

    if (error) {
      notificarError(`No se pudo cambiar estado: ${error.message}`)
      return
    }

    await qProductores.refetch()
    await registrarEvento({
      tipo: 'update',
      accion: 'PRODUCTOR_ESTADO_ACTUALIZADO',
      descripcion: `Se ${estaActivo(item) ? 'desactivó' : 'activó'} el productor ${item.nombre}.`,
      modulo: 'Productores',
      metadata: { productorId: item.id, activo: !estaActivo(item) },
    })
    notificarExito('Estado actualizado.')
  }

  const eliminarProductor = async (item: Productor) => {
    if (!esSuperAdmin) {
      notificarError('Acceso denegado: Solo el Administrador Principal puede eliminar productores.')
      return
    }

    const tieneReportes = (qReportesGlobal.data ?? []).some((rep) => rep.productor_id === item.id)

    if (tieneReportes) {
      const { error } = await actualizarEstadoProductor(item, false, rolUsuario)
      if (error) {
        notificarError(`No se pudo desactivar productor: ${error.message}`)
        return
      }

      await qProductores.refetch()
      await registrarEvento({
        tipo: 'update',
        accion: 'PRODUCTOR_DESACTIVADO',
        descripcion: `Se desactivó el productor ${item.nombre} porque tiene reportes asociados.`,
        modulo: 'Productores',
        metadata: { productorId: item.id },
      })
      notificarExito('El productor tiene reportes. Fue desactivado, no eliminado.')
      return
    }

    if (item.foto_url) {
      void eliminarImagenDeSupabase(item.foto_url)
    }

    if (supabase) {
      const { error } = await supabase.from('productores').delete().eq('id', item.id)
      if (error) {
        logErrorSupabase('Eliminar productor', error)
        notificarError(`No se pudo eliminar productor: ${error.message}`)
        return
      }
    }

    await qProductores.refetch()
    await registrarEvento({
      tipo: 'delete',
      accion: 'PRODUCTOR_ELIMINADO',
      descripcion: `Se eliminó el productor ${item.nombre}.`,
      modulo: 'Productores',
      metadata: { productorId: item.id },
    })
    notificarExito('Productor eliminado con éxito.')
  }

  const abrirProductorDesdeFicha = (item: Productor) => {
    if (!estaActivo(item)) {
      notificarError('El productor está inactivo. Actívalo para abrirlo.')
      return
    }
    setProductorActivoId(item.id)
    setVista('captura')
  }

  const verHistorialProductor = (item: Productor) => {
    setProductorActivoId(item.id)
    setFiltro('todo')
    setVista('captura')
  }

  const verReportesProductor = (item: Productor) => {
    setProductorActivoId(item.id)
    setVista('reportes')
  }

  const guardarCaptura = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    try {
      validarPermisoEscritura(rolUsuario, 'guardar o actualizar registros de captura')
    } catch (err: any) {
      notificarError(err.message)
      return
    }

    if (!usuarioActivo || !productorActivoId) return

    setRetroalimentacion('Guardando captura...')

    const detallePayload = {
      fecha: formCaptura.fecha,
      cestas_a: toNumber(formCaptura.cestas_a),
      cestas_h: toNumber(formCaptura.cestas_h),
      americana_4: toNumber(formCaptura.americana_4),
      americana_5: toNumber(formCaptura.americana_5),
      americana_7: toNumber(formCaptura.americana_7),
      hindu_4: toNumber(formCaptura.hindu_4),
      hindu_5: toNumber(formCaptura.hindu_5),
      hindu_7: toNumber(formCaptura.hindu_7),
      observaciones: formCaptura.observaciones || null,
    }

    if (!supabase) {
      setRetroalimentacion('Captura simulada guardada.')
      notificarExito('Captura guardada.')
      resetCaptura()
      return
    }

    const actualizarResumenReporte = async (reporteId: string, reporteBase: Reporte) => {
      const { data: detallesActualizados, error: errorDetalles } = await supabase
        .from('detalle_reporte')
        .select('*')
        .eq('reporte_id', reporteId)
        .order('fecha', { ascending: true })

      if (errorDetalles) {
        logErrorSupabase('Recargar detalles de reporte', errorDetalles)
        setRetroalimentacion(`Error al recargar detalles: ${errorDetalles.message}`)
        notificarError(`Error al recargar detalles: ${errorDetalles.message}`)
        return false
      }

      const reporteCompleto: Reporte = {
        ...reporteBase,
        detalle_reporte: (detallesActualizados ?? []) as DetalleReporte[],
      }
      const total = computeWeeklyTotals(reporteCompleto)
      const rend = weeklyRendimiento(reporteCompleto)
      const estado = infoRendimiento(rend.rendimientoA, rend.rendimientoH)

      const { error: errorResumen } = await supabase
        .from('reportes')
        .update({
          total_cajas: total.totalBoxes,
          rendimiento_a: Number(rend.rendimientoA.toFixed(2)),
          rendimiento_h: Number(rend.rendimientoH.toFixed(2)),
          estado: estado.label,
        })
        .eq('id', reporteId)

      if (errorResumen) {
        logErrorSupabase('Actualizar resumen del reporte', errorResumen)
        setRetroalimentacion(`Error al actualizar resumen: ${errorResumen.message}`)
        notificarError(`Error al actualizar resumen: ${errorResumen.message}`)
        return false
      }

      return true
    }

    if (reporteEnEdicion) {
      if (!detalleEnEdicionId) {
        setRetroalimentacion('Selecciona un día registrado para editarlo.')
        notificarError('Selecciona un día registrado para editarlo.')
        return
      }

      const { error: errorDetalle } = await supabase
        .from('detalle_reporte')
        .update({ ...detallePayload, reporte_id: reporteEnEdicion.id })
        .eq('id', detalleEnEdicionId)

      if (errorDetalle) {
        logErrorSupabase('Actualizar detalle de reporte', errorDetalle)
        setRetroalimentacion(`Error al guardar detalle: ${errorDetalle.message}`)
        notificarError(`Error al guardar detalle: ${errorDetalle.message}`)
        return
      }

      const resumenActualizado = await actualizarResumenReporte(reporteEnEdicion.id, reporteEnEdicion)
      if (!resumenActualizado) return

      const resultadoReportes = await qReportesProductor.refetch()
      await qReportesGlobal.refetch()

      const reporteActualizado = (resultadoReportes.data ?? []).find((item) => item.id === reporteEnEdicion.id) ?? null
      const detalleActualizado = reporteActualizado?.detalle_reporte.find((item) => item.id === detalleEnEdicionId) ?? null

      if (reporteActualizado) {
        setFechaReporteProductor(reporteActualizado.fecha_inicio)
        setReporteEnEdicionId(reporteActualizado.id)
        if (detalleActualizado) {
          setFechaDetalleSeleccionada(detalleActualizado.fecha)
          cargarDetalleEnCaptura(detalleActualizado)
        }
      }

      setRetroalimentacion('Reporte actualizado correctamente.')
      await registrarEvento({
        tipo: 'update',
        accion: 'REPORTE_ACTUALIZADO',
        descripcion: `Se actualizó el reporte semanal del productor ${productorActivo?.nombre ?? 'N/A'}.`,
        modulo: 'Captura',
        metadata: { reporteId: reporteEnEdicion.id, productorId: productorActivoId },
      })
      notificarExito('Reporte actualizado correctamente.')
      return
    }

    const { weekStart, weekEnd } = getWeekRange(formCaptura.fecha)
    const semanaAnio = obtenerSemanaAnio(formCaptura.fecha)

    const { data: existente, error: errorBuscar } = await supabase
      .from('reportes')
      .select('*')
      .eq('productor_id', productorActivoId)
      .eq('semana', semanaAnio.semana)
      .eq('anio', semanaAnio.anio)
      .maybeSingle()

    if (errorBuscar) {
      logErrorSupabase('Buscar reporte existente', errorBuscar)
      setRetroalimentacion(`Error al buscar reporte: ${errorBuscar.message}`)
      notificarError(`Error al buscar reporte: ${errorBuscar.message}`)
      return
    }

    const calcPreview = computeDailyTotals({
      cestas_a: toNumber(formCaptura.cestas_a),
      cestas_h: toNumber(formCaptura.cestas_h),
      americana_4: toNumber(formCaptura.americana_4),
      americana_5: toNumber(formCaptura.americana_5),
      americana_7: toNumber(formCaptura.americana_7),
      hindu_4: toNumber(formCaptura.hindu_4),
      hindu_5: toNumber(formCaptura.hindu_5),
      hindu_7: toNumber(formCaptura.hindu_7),
    })
    const estadoPreviewReporte = infoRendimiento(calcPreview.rendimientoA, calcPreview.rendimientoH)

    const payloadReporte = {
      productor_id: productorActivoId,
      semana: semanaAnio.semana,
      anio: semanaAnio.anio,
      fecha_inicio: weekStart,
      fecha_fin: weekEnd,
      total_cajas: calcPreview.totalBoxes,
      rendimiento_a: Number(calcPreview.rendimientoA.toFixed(2)),
      rendimiento_h: Number(calcPreview.rendimientoH.toFixed(2)),
      estado: estadoPreviewReporte.label,
    }

    const { data: reporte, error: errorReporte } = existente?.id
      ? await supabase.from('reportes').update(payloadReporte).eq('id', existente.id).select('*').single()
      : await supabase.from('reportes').insert(payloadReporte).select('*').single()

    if (errorReporte) {
      logErrorSupabase('Guardar reporte', errorReporte)
      setRetroalimentacion(`Error al guardar reporte: ${errorReporte.message}`)
      notificarError(`Error al guardar reporte: ${errorReporte.message}`)
      return
    }

    const { data: detalleExistente, error: errorBuscarDetalle } = await supabase
      .from('detalle_reporte')
      .select('id')
      .eq('reporte_id', reporte.id)
      .eq('fecha', formCaptura.fecha)
      .maybeSingle()

    if (errorBuscarDetalle) {
      logErrorSupabase('Buscar detalle existente', errorBuscarDetalle)
      setRetroalimentacion(`Error al buscar detalle: ${errorBuscarDetalle.message}`)
      notificarError(`Error al buscar detalle: ${errorBuscarDetalle.message}`)
      return
    }

    const { error: errorDetalle } = detalleEnEdicionId || detalleExistente?.id
      ? await supabase
          .from('detalle_reporte')
          .update({ ...detallePayload, reporte_id: reporte.id })
          .eq('id', detalleEnEdicionId ?? detalleExistente?.id ?? '')
      : await supabase.from('detalle_reporte').insert({ ...detallePayload, reporte_id: reporte.id })

    if (errorDetalle) {
      logErrorSupabase('Guardar detalle de reporte', errorDetalle)
      setRetroalimentacion(`Error al guardar detalle: ${errorDetalle.message}`)
      notificarError(`Error al guardar detalle: ${errorDetalle.message}`)
      return
    }

    const resumenActualizado = await actualizarResumenReporte(reporte.id, reporte as Reporte)
    if (!resumenActualizado) return

    await Promise.all([qReportesProductor.refetch(), qReportesGlobal.refetch()])
    if (vista === 'reportes' && rpcReporteGeneralDisponible) {
      await qReporteGeneralSemanal.refetch()
    }
    await registrarEvento({
      tipo: existente?.id ? 'update' : 'create',
      accion: existente?.id ? 'REPORTE_SEMANAL_ACTUALIZADO' : 'REPORTE_SEMANAL_CREADO',
      descripcion: `${existente?.id ? 'Se actualizó' : 'Se creó'} un reporte semanal para ${productorActivo?.nombre ?? 'N/A'}.`,
      modulo: 'Captura',
      metadata: { reporteId: reporte.id, productorId: productorActivoId, semana: semanaAnio.semana, anio: semanaAnio.anio },
    })
    setRetroalimentacion('Captura guardada con éxito.')
    notificarExito('Captura guardada con éxito.')
    resetCaptura()
  }

  const eliminarReporte = async (reporteId: string) => {
    if (esSupervisor) {
      notificarError('Acceso denegado: El modo supervisor es de solo lectura.')
      return
    }

    if (!window.confirm('¿Seguro que deseas eliminar toda la semana?')) return

    if (supabase) {
      const { error: errorDetalle } = await supabase.from('detalle_reporte').delete().eq('reporte_id', reporteId)
      if (errorDetalle) {
        logErrorSupabase('Eliminar detalle por reporte', errorDetalle)
        notificarError(`No se pudieron eliminar detalles: ${errorDetalle.message}`)
        return
      }

      const { error } = await supabase.from('reportes').delete().eq('id', reporteId)
      if (error) {
        logErrorSupabase('Eliminar reporte', error)
        notificarError(`No se pudo eliminar el reporte: ${error.message}`)
        return
      }
    }

    await Promise.all([qReportesProductor.refetch(), qReportesGlobal.refetch()])
    if (vista === 'reportes' && rpcReporteGeneralDisponible) {
      await qReporteGeneralSemanal.refetch()
    }
    await registrarEvento({
      tipo: 'delete',
      accion: 'REPORTE_SEMANAL_ELIMINADO',
      descripcion: 'Se eliminó un reporte semanal completo.',
      modulo: 'Captura',
      metadata: { reporteId },
    })
    notificarExito('Reporte semanal eliminado.')
  }

  const exportarCsv = (reportes: Reporte[], nombre: string) => {
    if (reportes.length === 0) {
      notificarError('No hay datos para exportar.')
      return
    }

    const mapaProductores = new Map((qProductores.data ?? []).map((item) => [item.id, item.nombre]))
    const filas = [
      [
        'Productor',
        'Semana inicio',
        'Semana fin',
        'Fecha',
        'Cestas A',
        'Cestas H',
        'A 4kg',
        'A 5kg',
        'A 7kg',
        'H 4kg',
        'H 5kg',
        'H 7kg',
        'Total cajas',
        'Rend A',
        'Rend H',
        'Estado',
      ],
    ]

    reportes.forEach((rep) => {
      rep.detalle_reporte.forEach((detalle) => {
        const calc = computeDailyTotals(detalle)
        const estado = infoRendimiento(calc.rendimientoA, calc.rendimientoH)
        filas.push([
          mapaProductores.get(rep.productor_id) ?? 'N/A',
          rep.fecha_inicio,
          rep.fecha_fin,
          detalle.fecha,
          String(detalle.cestas_a),
          String(detalle.cestas_h),
          String(detalle.americana_4),
          String(detalle.americana_5),
          String(detalle.americana_7),
          String(detalle.hindu_4),
          String(detalle.hindu_5),
          String(detalle.hindu_7),
          String(calc.totalBoxes),
          calc.rendimientoA.toFixed(2),
          calc.rendimientoH.toFixed(2),
          estado.label,
        ])
      })
    })

    exportRowsToCsv(filas, `${nombre}.csv`)
    void registrarEvento({
      tipo: 'export',
      accion: 'EXPORT_CSV_REPORTE_PRODUCTOR',
      descripcion: `Se exportó un CSV del reporte por productor (${nombre}).`,
      modulo: 'Reportes',
      metadata: { archivo: `${nombre}.csv`, filas: filas.length - 1 },
    })
    notificarExito('CSV exportado con éxito.')
  }

  const exportarCsvGeneral = (filas: FilaReporteGeneralSemanal[], nombre: string) => {
    if (filas.length === 0) {
      notificarError('No hay datos para exportar.')
      return
    }

    const rows = [
      [
        'Productor',
        'Total de Cestas Americanas Enviadas',
        'Total de Cestas Hindú Enviadas',
        'Total de Americanas Empacadas',
        'Total de Hindú Empacadas',
        'Total de Cestas Enviadas',
        'Total de Cajas Empacadas',
      ],
      ...filas.map((fila) => [
        fila.productor,
        String(fila.totalCestasAmericanasEnviadas),
        String(fila.totalCestasHinduEnviadas),
        String(fila.totalAmericanasEmpacadas),
        String(fila.totalHinduEmpacadas),
        String(fila.totalCestasEnviadas),
        String(fila.totalCajasEmpacadas),
      ]),
    ]

    exportRowsToCsv(rows, `${nombre}.csv`)
    void registrarEvento({
      tipo: 'export',
      accion: 'EXPORT_CSV_REPORTE_GENERAL',
      descripcion: `Se exportó un CSV del reporte general semanal (${nombre}).`,
      modulo: 'Reportes',
      metadata: { archivo: `${nombre}.csv`, filas: filas.length },
    })
    notificarExito('CSV exportado con éxito.')
  }

  const exportarExcelGeneral = (filas: FilaReporteGeneralSemanal[], nombre: string) => {
    if (filas.length === 0) {
      notificarError('No hay datos para exportar.')
      return
    }

    const rows = filas.map((fila) => ({
      Productor: fila.productor,
      TotalCestasAmericanasEnviadas: fila.totalCestasAmericanasEnviadas,
      TotalCestasHinduEnviadas: fila.totalCestasHinduEnviadas,
      TotalAmericanasEmpacadas: fila.totalAmericanasEmpacadas,
      TotalHinduEmpacadas: fila.totalHinduEmpacadas,
      TotalCestasEnviadas: fila.totalCestasEnviadas,
      TotalCajasEmpacadas: fila.totalCajasEmpacadas,
    }))

    exportRowsToExcel(rows, `${nombre}.xlsx`, 'Reporte General Semanal')
    void registrarEvento({
      tipo: 'export',
      accion: 'EXPORT_EXCEL_REPORTE_GENERAL',
      descripcion: `Se exportó un Excel del reporte general semanal (${nombre}).`,
      modulo: 'Reportes',
      metadata: { archivo: `${nombre}.xlsx`, filas: filas.length },
    })
    notificarExito('Excel exportado con éxito.')
  }

  const exportarZonaPdf = async (zoneId: string, nombre: string) => {
    const element = document.getElementById(zoneId)
    if (!element) return
    await exportElementToPdf(element, `${nombre}.pdf`)
    void registrarEvento({
      tipo: 'export',
      accion: 'EXPORT_PDF',
      descripcion: `Se exportó un PDF (${nombre}).`,
      modulo: 'Reportes',
      metadata: { archivo: `${nombre}.pdf`, zona: zoneId },
    })
    notificarExito('PDF exportado con éxito.')
  }

  const exportarZonaPng = async (zoneId: string, nombre: string) => {
    const element = document.getElementById(zoneId)
    if (!element) return
    await exportElementToImage(element, `${nombre}.png`)
    void registrarEvento({
      tipo: 'export',
      accion: 'EXPORT_PNG',
      descripcion: `Se exportó un PNG (${nombre}).`,
      modulo: 'Reportes',
      metadata: { archivo: `${nombre}.png`, zona: zoneId },
    })
    notificarExito('PNG exportado con éxito.')
  }

  const alternarOrdenAuditoria = (columna: OrdenAuditoriaColumna) => {
    if (auditoriaOrdenColumna === columna) {
      setAuditoriaOrdenDireccion((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setAuditoriaOrdenColumna(columna)
    setAuditoriaOrdenDireccion('asc')
  }

  const formatoFechaAuditoria = (iso: string) => format(parseISO(iso), 'yyyy-MM-dd')
  const formatoHoraAuditoria = (iso: string) => format(parseISO(iso), 'HH:mm:ss')

  const infoTipoAuditoria = (tipo: TipoEventoAuditoria) => {
    if (tipo === 'create') return { label: 'Crear', className: 'auditoria-tipo-create' }
    if (tipo === 'update') return { label: 'Actualizar', className: 'auditoria-tipo-update' }
    if (tipo === 'delete') return { label: 'Eliminar', className: 'auditoria-tipo-delete' }
    if (tipo === 'auth') return { label: 'Acceso', className: 'auditoria-tipo-auth' }
    if (tipo === 'export') return { label: 'Exportar', className: 'auditoria-tipo-export' }
    if (tipo === 'config') return { label: 'Configurar', className: 'auditoria-tipo-config' }
    if (tipo === 'user') return { label: 'Usuario', className: 'auditoria-tipo-user' }
    if (tipo === 'permission') return { label: 'Permisos', className: 'auditoria-tipo-permission' }
    return { label: 'Sistema', className: 'auditoria-tipo-system' }
  }

  const iconoTipoAuditoria = (tipo: TipoEventoAuditoria) => {
    if (tipo === 'create') return <Plus size={14} />
    if (tipo === 'update') return <Pencil size={14} />
    if (tipo === 'delete') return <Trash2 size={14} />
    if (tipo === 'auth') return <LockKeyhole size={14} />
    if (tipo === 'export') return <Download size={14} />
    if (tipo === 'config') return <Settings size={14} />
    if (tipo === 'user') return <Users size={14} />
    if (tipo === 'permission') return <Power size={14} />
    return <Activity size={14} />
  }

  const exportarAuditoriaCsv = (rows: EventoAuditoria[], nombre: string) => {
    if (rows.length === 0) {
      notificarError('No hay datos para exportar.')
      return
    }

    const output = [
      ['Fecha', 'Hora', 'Usuario', 'Módulo', 'Tipo', 'Acción', 'Descripción'],
      ...rows.map((item) => [
        formatoFechaAuditoria(item.createdAt),
        formatoHoraAuditoria(item.createdAt),
        item.usuarioNombre || item.usuarioEmail || 'Usuario desconocido',
        item.modulo,
        item.tipo,
        item.accion,
        item.descripcion,
      ]),
    ]

    exportRowsToCsv(output, `${nombre}.csv`)
    void registrarEvento({
      tipo: 'export',
      accion: 'EXPORT_CSV_AUDITORIA',
      descripcion: 'Se exportó el historial de auditoría a CSV.',
      modulo: 'Auditoría',
      metadata: { archivo: `${nombre}.csv`, filas: rows.length },
    })
    notificarExito('CSV exportado con éxito.')
  }

  const exportarAuditoriaExcel = (rows: EventoAuditoria[], nombre: string) => {
    if (rows.length === 0) {
      notificarError('No hay datos para exportar.')
      return
    }

    const output = rows.map((item) => ({
      Fecha: formatoFechaAuditoria(item.createdAt),
      Hora: formatoHoraAuditoria(item.createdAt),
      Usuario: item.usuarioNombre || item.usuarioEmail || 'Usuario desconocido',
      Modulo: item.modulo,
      Tipo: item.tipo,
      Accion: item.accion,
      Descripcion: item.descripcion,
    }))

    exportRowsToExcel(output, `${nombre}.xlsx`, 'Auditoria')
    void registrarEvento({
      tipo: 'export',
      accion: 'EXPORT_EXCEL_AUDITORIA',
      descripcion: 'Se exportó el historial de auditoría a Excel.',
      modulo: 'Auditoría',
      metadata: { archivo: `${nombre}.xlsx`, filas: rows.length },
    })
    notificarExito('Excel exportado con éxito.')
  }

  const preview = useMemo(
    () =>
      computeDailyTotals({
        cestas_a: toNumber(formCaptura.cestas_a),
        cestas_h: toNumber(formCaptura.cestas_h),
        americana_4: toNumber(formCaptura.americana_4),
        americana_5: toNumber(formCaptura.americana_5),
        americana_7: toNumber(formCaptura.americana_7),
        hindu_4: toNumber(formCaptura.hindu_4),
        hindu_5: toNumber(formCaptura.hindu_5),
        hindu_7: toNumber(formCaptura.hindu_7),
      }),
    [formCaptura],
  )

  const estadoPreview = infoRendimiento(preview.rendimientoA, preview.rendimientoH)

  const eficienciaChartData = useMemo(() => {
    return [...dashboardData.rendimientoPorProductor]
      .sort((a, b) => b.rendimientoPromedio - a.rendimientoPromedio)
      .slice(0, 15)
  }, [dashboardData.rendimientoPorProductor])

  const kpiCards = [
    {
      title: 'Productores Registrados',
      desc: 'En operación activa',
      icon: Users,
      value: dashboardData.resumen.productores,
      decimals: 0,
      delta: dashboardData.comparativas.reportes,
      color: '#15803d',
      link: 'productores' as const,
    },
    {
      title: 'Reportes Semanales',
      desc: TITULOS_FILTRO_DASHBOARD[filtroDashboard],
      icon: FileText,
      value: dashboardData.resumen.reportes,
      decimals: 0,
      delta: dashboardData.comparativas.reportes,
      color: '#2563eb',
      link: 'reportes' as const,
    },
    {
      title: 'Producción Total (Cajas)',
      desc: 'Consolidado período',
      icon: BarChart3,
      value: dashboardData.resumen.totalCajas,
      decimals: 0,
      delta: dashboardData.comparativas.totalCajas,
      color: '#d97706',
      link: 'reportes' as const,
    },
    {
      title: 'Rendimiento Promedio',
      desc: 'Eficiencia de empaque',
      icon: Activity,
      value: dashboardData.resumen.promedioRendimiento,
      decimals: 2,
      delta: dashboardData.comparativas.promedioRendimiento,
      color: '#15803d',
      link: 'reportes' as const,
    },
    {
      title: 'Mayor Rendimiento',
      desc: dashboardData.resumen.mejor?.nombre ?? 'Sin registros',
      icon: Trophy,
      value: dashboardData.resumen.mejor?.rendimientoPromedio ?? 0,
      decimals: 2,
      delta: null,
      color: '#d97706',
      link: 'productores' as const,
    },
    {
      title: 'Producción Americana',
      desc: 'Variedad Americana',
      icon: TrendingUp,
      value: dashboardData.resumen.totalAmericana,
      decimals: 0,
      delta: null,
      color: '#15803d',
      link: 'reportes' as const,
    },
    {
      title: 'Producción Hindú',
      desc: 'Variedad Hindú',
      icon: CalendarDays,
      value: dashboardData.resumen.totalHindu,
      decimals: 0,
      delta: null,
      color: '#7c3aed',
      link: 'reportes' as const,
    },
    {
      title: 'Protección y Accesos',
      desc: `Rol: ${rolUsuario}`,
      icon: ShieldCheck,
      value: esSuperAdmin ? 3 : 1,
      decimals: 0,
      delta: null,
      color: '#0891b2',
      link: 'seguridad' as const,
    },
  ]

  // 1. Mostrar Splash Screen inicial
  if (!splashCompletado) {
    return <SplashScreen onFinish={() => setSplashCompletado(true)} />
  }

  // 2. Si no hay sesión autenticada
  if (!usuarioActivo) {
    if (modoBiometriaDesbloqueo && credencialesDispositivo.length > 0) {
      return (
        <BiometricUnlockView
          usuarioNombre={usuarioNombre}
          usuarioEmail={usuarioEmail}
          usuarioFoto={usuarioFoto}
          usuarioRol={rolUsuario}
          credencialesRegistradas={credencialesDispositivo}
          onDesbloqueoExitoso={() => {
            setUsuarioLocal({
              id: 'user_active_bio',
              email: usuarioEmail,
              user_metadata: { nombre: usuarioNombre, rol: rolUsuario },
            })
            notificarExito(`✓ Desbloqueo biométrico exitoso. Bienvenido, ${usuarioNombre}.`)
          }}
          onCambiarAContrasena={() => setModoBiometriaDesbloqueo(false)}
          onCambiarUsuario={() => setModoBiometriaDesbloqueo(false)}
          onNotificarError={notificarError}
        />
      )
    }

    return (
      <PantallaLogin
        onLoginExitoso={(user) => {
          setUsuarioLocal(user)
          notificarExito(`✓ Bienvenido a DeereMax, ${formatearNombreUsuario(user.email || 'usuario')}.`)
        }}
        onVerificarBiometria={() => setModoBiometriaDesbloqueo(true)}
      />
    )
  }

  return (
    <div className={`dm-app ${menuAbierto ? 'menu-abierto' : ''}`}>
      {/* Banner de Modo Supervisor (Solo Lectura) */}
      {esSupervisor && <ModoSupervisorBadge variante="banner" />}

      <header className="barra-superior print-hidden">
        <button
          className="boton-menu"
          onClick={() => setMenuAbierto((v) => !v)}
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>

        <div className="marca-top">
          <Logo alt="DeereMax" />
          <div className="marca-top-texto">
            <p className="ruta-top">{metaVista.breadcrumb}</p>
            <h1>{metaVista.modulo}</h1>
            <p className="hidden md:block">
              {formatoFechaLarga(ahora)} | {formatoHora(ahora)}
            </p>
          </div>
        </div>

        <div className="acciones-topbar flex items-center gap-2.5">
          {/* Badge de rol en la barra superior */}
          {esSupervisor ? (
            <ModoSupervisorBadge className="hidden sm:inline-flex" />
          ) : esSuperAdmin ? (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-xs font-bold">
              <Crown size={12} className="text-amber-600" /> Super Admin
            </span>
          ) : null}

          {/* Centro de Notificaciones */}
          <CentroNotificaciones
            userId={usuarioActivo?.id}
            onNavegar={(destino) => setVista(destino as Vista)}
          />

          {/* Selector de Modo Claro / Oscuro */}
          <ThemeToggle />

          {/* Chip de Perfil de Usuario con Menú Desplegable */}
          <div className="relative" ref={menuUsuarioRef}>
            <div
              className="usuario-topbar-chip flex items-center gap-2 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer hover:border-emerald-500 transition-all select-none"
              onClick={() => setMenuUsuarioAbierto((prev) => !prev)}
              title="Opciones de cuenta"
              role="button"
              tabIndex={0}
            >
              <Avatar
                src={usuarioFoto}
                name={usuarioNombre}
                size="sm"
                type="user"
                border={true}
              />
              <div className="hidden lg:block text-left">
                <strong className="block text-xs text-slate-800 dark:text-white leading-tight">
                  {usuarioNombre}
                </strong>
                <span className="block text-[10px] text-slate-500 leading-tight">
                  {rolUsuario}
                </span>
              </div>
            </div>

            {/* Menú Desplegable de Usuario al tocar el perfil */}
            {menuUsuarioAbierto && (
              <div className="menu-usuario-dropdown absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-[1100] p-2 overflow-hidden animate-fadeIn max-sm:fixed max-sm:top-16 max-sm:left-4 max-sm:right-4 max-sm:w-auto max-sm:max-h-[calc(100vh-64px-72px-8px)] max-sm:overflow-y-auto">
                <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 mb-1 flex items-center gap-3">
                  <Avatar src={usuarioFoto} name={usuarioNombre} size="md" type="user" border={true} />
                  <div className="min-w-0 flex-1">
                    <strong className="block text-xs text-slate-900 dark:text-white truncate">{usuarioNombre}</strong>
                    <span className="block text-[10px] font-bold text-emerald-700 dark:text-emerald-400">{rolUsuario}</span>
                    <span className="block text-[10px] text-slate-500 truncate">{usuarioEmail}</span>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <button
                    type="button"
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-left font-medium"
                    onClick={() => {
                      setMenuUsuarioAbierto(false)
                      setModalPerfilAbierto(true)
                    }}
                  >
                    <User size={15} className="text-emerald-600" />
                    <span>Mi Perfil</span>
                  </button>

                  <button
                    type="button"
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-left font-medium"
                    onClick={() => {
                      setMenuUsuarioAbierto(false)
                      setVista('seguridad')
                    }}
                  >
                    <ShieldCheck size={15} className="text-emerald-600" />
                    <span>Centro de Seguridad</span>
                  </button>

                  <div className="border-t border-slate-100 dark:border-slate-800 my-1 pt-1">
                    <button
                      type="button"
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl font-bold transition-all text-left"
                      onClick={cerrarSesionUsuario}
                    >
                      <LogOut size={15} />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Backdrop del Menú Lateral */}
      <div
        className={`fondo-menu ${menuAbierto ? 'visible' : ''}`}
        onClick={() => setMenuAbierto(false)}
      />

      {/* Sidebar Ejecutivo */}
      <aside className={`menu-lateral ${menuAbierto ? 'abierto' : ''} print-hidden flex flex-col h-full`}>
        <div className="menu-encabezado flex items-center justify-between p-3.5 border-b border-white/10">
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Menú Principal</span>
          <button
            type="button"
            className="boton-cerrar-drawer"
            aria-label="Cerrar menú"
            onClick={() => setMenuAbierto(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tarjeta Informativa de Usuario en Sidebar (No Clickable) */}
        <div className="menu-usuario-resumen flex items-center gap-3 p-3 mx-3 my-2 rounded-2xl bg-white/10 select-none">
          <div className="relative flex-shrink-0">
            <Avatar
              src={usuarioFoto}
              name={usuarioNombre}
              size="md"
              type="user"
              border={true}
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
          </div>
          <div className="menu-usuario-datos flex-1 min-w-0">
            <span className="block font-bold text-xs text-white truncate">{usuarioNombre}</span>
            <small className="block text-[11px] text-emerald-200/80 truncate font-semibold">
              {rolUsuario}
            </small>
            <small className="block text-[10px] text-slate-300/60 truncate">{usuarioEmail}</small>
          </div>
        </div>

        {/* Navegación del Sidebar */}
        <nav className="flex-1 py-2 px-3 flex flex-col justify-between overflow-y-auto min-h-0">
          <div className="space-y-1">
            <button
              className={`menu-item w-full ${vista === 'inicio' ? 'activo' : ''}`}
              onClick={() => {
                setVista('inicio')
                setMenuAbierto(false)
              }}
            >
              <Home size={18} /> Inicio
            </button>

            {/* Opción explícita para ver y editar el perfil */}
            <button
              className="menu-item w-full text-slate-100 hover:text-white"
              onClick={() => {
                setModalPerfilAbierto(true)
                setMenuAbierto(false)
              }}
            >
              <User size={18} className="text-emerald-400" /> Mi Perfil
            </button>

            <button
              className={`menu-item w-full ${vista === 'productores' ? 'activo' : ''}`}
              onClick={() => {
                setVista('productores')
                setMenuAbierto(false)
              }}
            >
              <Users size={18} /> Operaciones / Productores
            </button>

            <button
              className={`menu-item w-full ${vista === 'reportes' ? 'activo' : ''}`}
              onClick={() => {
                setVista('reportes')
                setMenuAbierto(false)
              }}
            >
              <FileText size={18} /> Reportes Ejecutivos
            </button>

            {/* Auditoría — Solo Super Admin */}
            {esSuperAdmin && (
              <button
                className={`menu-item w-full ${vista === 'auditoria' ? 'activo' : ''}`}
                onClick={() => {
                  setVista('auditoria')
                  setMenuAbierto(false)
                }}
              >
                <ClipboardList size={18} /> Auditoría y Actividad
              </button>
            )}

            {/* Módulo exclusivo para Olman (Super Admin) */}
            {esSuperAdmin && (
              <button
                className={`menu-item w-full ${vista === 'usuarios' ? 'activo' : ''}`}
                onClick={() => {
                  setVista('usuarios')
                  setMenuAbierto(false)
                }}
              >
                <Crown size={18} className="text-amber-400" /> Gestión de Usuarios
              </button>
            )}

            <button
              className={`menu-item w-full ${vista === 'seguridad' ? 'activo' : ''}`}
              onClick={() => {
                setVista('seguridad')
                setMenuAbierto(false)
              }}
            >
              <ShieldCheck size={18} /> Centro de Seguridad
            </button>
          </div>

          <div className="pt-3 mt-auto border-t border-white/10 pb-8 mb-4">
            <button
              className="menu-item menu-item-salir w-full text-red-200 hover:text-white bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl font-bold"
              onClick={cerrarSesionUsuario}
            >
              <LogOut size={18} /> Cerrar Sesión
            </button>
          </div>
        </nav>
      </aside>

      {/* Contenido Principal */}
      <main className="contenido-principal">
        {/* VISTA: PANEL DE CONTROL (DASHBOARD) */}
        {vista === 'inicio' && (
          <section className="seccion-vista dashboard-home">
            <motion.article
              className="dashboard-hero"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="dashboard-hero-row flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="dashboard-title text-2xl font-black">
                    Buenos días, {usuarioNombre} 👋
                  </h2>
                  <p className="dashboard-subtitle text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {esSuperAdmin
                      ? 'Panel Ejecutivo Principal · Control Total'
                      : esSupervisor
                        ? 'Panel de Supervisión y Análisis · Modo Solo Lectura'
                        : 'Panel de Operaciones de Producción y Empaque'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="dashboard-filter-pill">
                    <Filter size={14} /> {TITULOS_FILTRO_DASHBOARD[filtroDashboard]}
                  </div>
                </div>
              </div>

              {/* Filtros de Rango del Dashboard */}
              <div className="dashboard-filters-grid mt-4">
                <button
                  type="button"
                  className={`justify-center ${filtroDashboard === 'hoy' ? '' : 'ghost'}`}
                  onClick={() => setFiltroDashboard('hoy')}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  className={`justify-center ${filtroDashboard === 'semana' ? '' : 'ghost'}`}
                  onClick={() => setFiltroDashboard('semana')}
                >
                  Últimos 7 días
                </button>
                <button
                  type="button"
                  className={`justify-center ${filtroDashboard === 'mes' ? '' : 'ghost'}`}
                  onClick={() => setFiltroDashboard('mes')}
                >
                  Mes actual
                </button>
                <button
                  type="button"
                  className={`justify-center ${filtroDashboard === 'anio' ? '' : 'ghost'}`}
                  onClick={() => setFiltroDashboard('anio')}
                >
                  Año en curso
                </button>
                <button
                  type="button"
                  className={`justify-center ${filtroDashboard === 'personalizado' ? '' : 'ghost'}`}
                  onClick={() => setFiltroDashboard('personalizado')}
                >
                  Personalizado
                </button>
              </div>

              {filtroDashboard === 'personalizado' && (
                <div className="dashboard-custom-range mt-3">
                  <label>
                    Desde
                    <input
                      type="date"
                      value={dashboardDesde}
                      onChange={(e) => setDashboardDesde(e.target.value)}
                    />
                  </label>
                  <label>
                    Hasta
                    <input
                      type="date"
                      value={dashboardHasta}
                      onChange={(e) => setDashboardHasta(e.target.value)}
                    />
                  </label>
                </div>
              )}
            </motion.article>

            {/* Accesos Rápidos según Rol */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
              {!esSupervisor && (
                <button
                  type="button"
                  className="p-3 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/40 hover:bg-emerald-100/70 transition-all flex items-center gap-2.5 text-left text-xs font-bold text-emerald-900 dark:text-emerald-200 shadow-xs"
                  onClick={() => {
                    resetCaptura()
                    setVista('captura')
                  }}
                >
                  <Plus size={18} className="text-emerald-600" />
                  <span>+ Nueva Captura</span>
                </button>
              )}

              {esSuperAdmin && (
                <button
                  type="button"
                  className="p-3 rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/40 hover:bg-amber-100/70 transition-all flex items-center gap-2.5 text-left text-xs font-bold text-amber-900 dark:text-amber-200 shadow-xs"
                  onClick={() => setVista('usuarios')}
                >
                  <Crown size={18} className="text-amber-600" />
                  <span>Gestión de Usuarios</span>
                </button>
              )}

              <button
                type="button"
                className="p-3 rounded-2xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/60 dark:bg-blue-950/40 hover:bg-blue-100/70 transition-all flex items-center gap-2.5 text-left text-xs font-bold text-blue-900 dark:text-blue-200 shadow-xs"
                onClick={() => setVista('reportes')}
              >
                <FileText size={18} className="text-blue-600" />
                <span>Reportes Ejecutivos</span>
              </button>

              <button
                type="button"
                className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 transition-all flex items-center gap-2.5 text-left text-xs font-bold text-slate-800 dark:text-slate-200 shadow-xs"
                onClick={() => setVista('seguridad')}
              >
                <ShieldCheck size={18} className="text-emerald-600" />
                <span>Centro de Seguridad</span>
              </button>
            </div>

            {/* Grid de Tarjetas KPI */}
            <section className="dashboard-kpi-grid">
              {kpiCards.map((kpi, idx) => {
                const Icon = kpi.icon
                const delta = kpi.delta
                return (
                  <motion.article
                    key={kpi.title}
                    className="dashboard-kpi-card dashboard-kpi-card--link"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    whileHover={{ y: -4 }}
                    onClick={() => setVista(kpi.link)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setVista(kpi.link)
                    }}
                    aria-label={`Ir a ${kpi.title}`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="rounded-xl p-2" style={{ backgroundColor: `${kpi.color}1f` }}>
                        <Icon size={18} color={kpi.color} />
                      </div>
                      <div className="kpi-card-top-right">
                        {typeof delta === 'number' && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${delta >= 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'}`}
                          >
                            {delta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            {Math.abs(delta).toFixed(1)}%
                          </span>
                        )}
                        <span className="kpi-nav-arrow" style={{ color: kpi.color }}>
                          →
                        </span>
                      </div>
                    </div>
                    <p className="dashboard-kpi-label">{kpi.title}</p>
                    <p className="dashboard-kpi-value">
                      <AnimatedNumber value={kpi.value} decimals={kpi.decimals} />
                    </p>
                    <p className="dashboard-kpi-desc">{kpi.desc}</p>
                    <Sparkline data={dashboardData.sparkline} color={kpi.color} />
                  </motion.article>
                )
              })}
            </section>

            {/* Gráficos Ejecutivos */}
            <section className="dashboard-charts-grid">
              <article className="dashboard-panel dashboard-panel-large">
                <h3 className="font-bold text-base mb-3 flex items-center justify-between">
                  <span>Tendencia de Producción Semanal</span>
                  <span className="text-xs text-slate-400 font-normal">Cajas Consolidadas</span>
                </h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboardData.weeklyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d9e5d7" />
                      <XAxis dataKey="semana" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="totalCajas"
                        stroke="#1B5E20"
                        strokeWidth={3}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <article className="dashboard-panel dashboard-panel-small">
                <h3 className="font-bold text-base mb-3">Distribución por Variedad</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dashboardData.pieDistribucion}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={90}
                        label
                      >
                        {dashboardData.pieDistribucion.map((entry, index) => (
                          <Cell
                            key={`${entry.name}-${index}`}
                            fill={index === 0 ? '#1B5E20' : '#F9A825'}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <article className="dashboard-panel dashboard-panel-half">
                <h3 className="font-bold text-base mb-3">Ranking de Productores</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardData.topProductores}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d9e5d7" />
                      <XAxis dataKey="nombre" hide />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="totalBoxes" fill="#2E7D32" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <article className="dashboard-panel dashboard-panel-half">
                <h3 className="font-bold text-base mb-3">Eficiencia por Productor</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={eficienciaChartData.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#d9e5d7" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="nombre" width={110} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar
                        dataKey="rendimientoPromedio"
                        fill="#1B5E20"
                        radius={[0, 6, 6, 0]}
                        barSize={16}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </article>
            </section>

            {/* Tabla de Reportes Recientes & Indicadores */}
            <section className="dashboard-lower-grid">
              <article className="dashboard-panel dashboard-panel-table">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-base">Últimos Movimientos Registrados</h3>
                  <button
                    className="ghost text-xs py-1 px-2.5"
                    onClick={() => setVista('reportes')}
                  >
                    Ver todos los reportes →
                  </button>
                </div>
                <div className="overflow-auto">
                  <table className="responsive-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Productor</th>
                        <th>Producción</th>
                        <th>Rendimiento</th>
                        <th>Estado</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.ultimosReportes.map((fila) => (
                        <tr key={fila.id}>
                          <td data-label="Fecha">{fila.fecha}</td>
                          <td data-label="Productor">{fila.productor}</td>
                          <td data-label="Total cajas">{fila.totalCajas.toLocaleString('en-US')}</td>
                          <td data-label="Rendimiento">{fila.rendimiento}</td>
                          <td data-label="Estado">
                            <span className={`estado-pill ${fila.estado.className}`}>
                              {fila.estado.label}
                            </span>
                          </td>
                          <td data-label="Acción">
                            <button
                              className="ghost text-xs py-1 px-2"
                              onClick={() => setVista('reportes')}
                            >
                              <FileText size={13} /> Consultar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="dashboard-panel dashboard-panel-side">
                <h3 className="font-bold text-base mb-3">Indicadores Operativos</h3>
                <div className="dashboard-indicator-list space-y-2 text-xs">
                  <div className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span>Promedio diario:</span>
                    <strong>{dashboardData.indicadores.promedioDiario.toFixed(2)} cajas</strong>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span>Promedio semanal:</span>
                    <strong>{dashboardData.indicadores.promedioSemanal.toFixed(2)} cajas</strong>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span>Mayor producción semanal:</span>
                    <strong>{dashboardData.indicadores.mayorProduccion} cajas</strong>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span>Productores en operación:</span>
                    <strong>{dashboardData.indicadores.productoresActivos} activos</strong>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span>Total reportes consolidados:</span>
                    <strong>{dashboardData.indicadores.totalReportes} reportes</strong>
                  </div>
                </div>
              </article>
            </section>
          </section>
        )}

        {/* VISTA: OPERACIONES / PRODUCTORES */}
        {vista === 'productores' && (
          <section className="seccion-vista">
            <div className="panel-filtros-productor flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="barra-busqueda flex-1">
                <input
                  type="search"
                  placeholder="Buscar por código, nombre o finca..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
              <div className="filtros-grid-productor flex items-center gap-2">
                <label>
                  Estado
                  <select
                    value={filtroEstadoProductores}
                    onChange={(e) => setFiltroEstadoProductores(e.target.value as FiltroEstadoProductor)}
                  >
                    <option value="todos">Todos</option>
                    <option value="activos">Activos</option>
                    <option value="inactivos">Inactivos</option>
                  </select>
                </label>
                <label>
                  Ordenar
                  <select
                    value={ordenProductores}
                    onChange={(e) => setOrdenProductores(e.target.value as OrdenProductor)}
                  >
                    <option value="nombre">Nombre</option>
                    <option value="codigo">Código</option>
                    <option value="creacion">Fecha creación</option>
                  </select>
                </label>

                {!esSupervisor && (
                  <button
                    type="button"
                    className="btn-nuevo-productor self-end h-10 px-4"
                    onClick={() => {
                      resetFormProductor()
                      setModalProductorAbierto(true)
                    }}
                  >
                    <Plus size={16} /> Nuevo
                  </button>
                )}
              </div>
            </div>

            <section className="grid-productores" onClick={() => setMenuProductorId(null)}>
              {productoresVisibles.map((item) => {
                const resumen = mapaResumenPorProductor.get(item.id)
                return (
                  <article key={item.id} className="tarjeta-productor ficha-productor">
                    <div className="cabecera-tarjeta flex items-center justify-between">
                      <div className="avatar-badge-wrap flex items-center gap-2.5">
                        <Avatar
                          src={item.foto_url}
                          name={item.nombre}
                          size="md"
                          variant="rounded"
                          type="producer"
                          border={true}
                        />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                          {item.codigo ?? 'N/A'}
                        </span>
                      </div>
                      <div className="ficha-acciones-top flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <span className={`estado-pill ${estaActivo(item) ? 'estado-bueno' : 'estado-bajo'}`}>
                          {estaActivo(item) ? 'Activo' : 'Inactivo'}
                        </span>
                        <button
                          type="button"
                          className="ghost boton-menu-ficha"
                          onClick={() => setMenuProductorId((prev) => (prev === item.id ? null : item.id))}
                        >
                          <MoreVertical size={16} />
                        </button>
                        {menuProductorId === item.id && (
                          <div className="menu-contextual-ficha">
                            <button
                              onClick={() => {
                                abrirProductorDesdeFicha(item)
                                setMenuProductorId(null)
                              }}
                            >
                              <FolderOpen size={14} /> Abrir Productor
                            </button>
                            {!esSupervisor && (
                              <>
                                <button
                                  onClick={() => {
                                    abrirEdicionProductor(item)
                                    setMenuProductorId(null)
                                  }}
                                >
                                  <Pencil size={14} /> Editar Datos
                                </button>
                                {esSuperAdmin && (
                                  <button
                                    onClick={() => {
                                      setConfirmacionEliminar(item)
                                      setMenuProductorId(null)
                                    }}
                                  >
                                    <Trash2 size={14} /> Eliminar
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    void alternarEstado(item)
                                    setMenuProductorId(null)
                                  }}
                                >
                                  {estaActivo(item) ? <Pause size={14} /> : <Play size={14} />}
                                  {estaActivo(item) ? 'Desactivar' : 'Activar'}
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => {
                                verHistorialProductor(item)
                                setMenuProductorId(null)
                              }}
                            >
                              <History size={14} /> Ver Historial
                            </button>
                            <button
                              onClick={() => {
                                verReportesProductor(item)
                                setMenuProductorId(null)
                              }}
                            >
                              <BarChart3 size={14} /> Ver Reportes
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-2">{item.nombre}</h3>
                    <p className="text-xs text-slate-500">N° Cuenta / Finca: {item.finca || 'N/A'}</p>
                    <p className="text-xs text-slate-500">Rendimiento promedio: {(resumen?.promedio ?? 0).toFixed(2)}</p>
                    <p className="text-xs text-slate-500">Último reporte: {resumen?.ultimaSemana ?? 'Sin registros'}</p>

                    <div className="ficha-abrir-derecha mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                      <button
                        type="button"
                        className="ficha-boton-abrir text-xs py-1.5 px-3"
                        onClick={() => abrirProductorDesdeFicha(item)}
                      >
                        <FolderOpen size={14} /> Abrir
                      </button>
                    </div>
                  </article>
                )
              })}
            </section>
          </section>
        )}

        {/* VISTA: CAPTURA SEMANAL */}
        {vista === 'captura' && (
          <section className="seccion-vista">
            <article className="encabezado-captura flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mb-4">
              <div className="encabezado-captura-info flex items-center gap-3">
                <Avatar
                  src={productorActivo?.foto_url}
                  name={productorActivo?.nombre ?? 'Productor'}
                  size="lg"
                  variant="rounded"
                  type="producer"
                  border={true}
                />
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{productorActivo?.nombre ?? 'Productor'}</h2>
                  <p className="text-xs text-slate-500">
                    Código: {productorActivo?.codigo ?? 'N/A'} | Semana: {getWeekRange(format(ahora, 'yyyy-MM-dd')).weekStart} al {getWeekRange(format(ahora, 'yyyy-MM-dd')).weekEnd}
                  </p>
                </div>
              </div>
              <div className="acciones-linea">
                <button className="ghost text-xs" onClick={() => setVista('productores')}>
                  <ArrowLeft size={16} /> Volver a Productores
                </button>
              </div>
            </article>

            <section className="grid-captura grid grid-cols-1 lg:grid-cols-3 gap-6">
              <article className="tarjeta-panel lg:col-span-2">
                <h3 className="font-bold text-base mb-3 flex items-center justify-between">
                  <span>{reporteEnEdicion ? 'Editar Captura Semanal' : detalleEnEdicionId ? 'Editar Registro Diario' : 'Nueva Captura Semanal'}</span>
                  {esSupervisor && <span className="text-xs text-amber-600 font-semibold">👁️ Modo Consulta (Solo Lectura)</span>}
                </h3>

                {reporteEnEdicion && (
                  <div className="acciones-linea acciones-reporte-zona print-hidden mb-4">
                    {diasReporteEnEdicion.map((dia) => (
                      <button
                        key={dia.fecha}
                        type="button"
                        className={fechaDetalleSeleccionada === dia.fecha ? '' : 'ghost'}
                        onClick={() => seleccionarDiaEdicion(dia.fecha)}
                        disabled={!dia.detalle}
                      >
                        {dia.nombreDia} {dia.detalle ? `(${format(parseISO(dia.fecha), 'dd/MM')})` : ''}
                      </button>
                    ))}
                  </div>
                )}

                <form className="form-captura" onSubmit={guardarCaptura}>
                  <label>
                    Fecha de Entrada
                    <input
                      type="date"
                      value={formCaptura.fecha}
                      onChange={(e) => onCambiarCaptura('fecha', e.target.value)}
                      required
                      readOnly={esSupervisor}
                    />
                  </label>

                  <div className="grid-dos grid grid-cols-1 sm:grid-cols-2 gap-3 my-2">
                    <label>
                      Cestas Americana
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formCaptura.cestas_a}
                        onChange={(e) => onCambiarCaptura('cestas_a', e.target.value)}
                        readOnly={esSupervisor}
                      />
                    </label>
                    <label>
                      Cestas Hindú
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formCaptura.cestas_h}
                        onChange={(e) => onCambiarCaptura('cestas_h', e.target.value)}
                        readOnly={esSupervisor}
                      />
                    </label>
                  </div>

                  <div className="grid-tres grid grid-cols-3 gap-3 my-2">
                    <label>
                      Americana 4kg
                      <input type="text" inputMode="numeric" value={formCaptura.americana_4} onChange={(e) => onCambiarCaptura('americana_4', e.target.value)} readOnly={esSupervisor} />
                    </label>
                    <label>
                      Americana 5kg
                      <input type="text" inputMode="numeric" value={formCaptura.americana_5} onChange={(e) => onCambiarCaptura('americana_5', e.target.value)} readOnly={esSupervisor} />
                    </label>
                    <label>
                      Americana 7kg
                      <input type="text" inputMode="numeric" value={formCaptura.americana_7} onChange={(e) => onCambiarCaptura('americana_7', e.target.value)} readOnly={esSupervisor} />
                    </label>
                  </div>

                  <div className="grid-tres grid grid-cols-3 gap-3 my-2">
                    <label>
                      Hindú 4kg
                      <input type="text" inputMode="numeric" value={formCaptura.hindu_4} onChange={(e) => onCambiarCaptura('hindu_4', e.target.value)} readOnly={esSupervisor} />
                    </label>
                    <label>
                      Hindú 5kg
                      <input type="text" inputMode="numeric" value={formCaptura.hindu_5} onChange={(e) => onCambiarCaptura('hindu_5', e.target.value)} readOnly={esSupervisor} />
                    </label>
                    <label>
                      Hindú 7kg
                      <input type="text" inputMode="numeric" value={formCaptura.hindu_7} onChange={(e) => onCambiarCaptura('hindu_7', e.target.value)} readOnly={esSupervisor} />
                    </label>
                  </div>

                  <label>
                    Observaciones
                    <textarea
                      rows={2}
                      value={formCaptura.observaciones}
                      onChange={(e) => onCambiarCaptura('observaciones', e.target.value)}
                      readOnly={esSupervisor}
                    />
                  </label>

                  <div className="acciones-linea mt-3">
                    {!esSupervisor ? (
                      <>
                        <button type="submit">
                          <Save size={16} /> {reporteEnEdicion ? 'Guardar Cambios' : detalleEnEdicionId ? 'Actualizar' : 'Guardar Captura'}
                        </button>
                        {(detalleEnEdicionId || reporteEnEdicion) && (
                          <button type="button" className="ghost" onClick={resetCaptura}>
                            Cancelar
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold py-2">
                        🛡️ Modo supervisor: Acceso de solo lectura
                      </span>
                    )}
                  </div>
                </form>
                {retroalimentacion && <p className="feedback mt-2">{retroalimentacion}</p>}
              </article>

              <article className="tarjeta-panel">
                <h3 className="font-bold text-base mb-3">Cálculo en Tiempo Real</h3>
                <div className="metricas-vivas space-y-2 text-xs">
                  <div className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span>Cajas Americana:</span>
                    <strong>{preview.totalAmericana}</strong>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span>Cajas Hindú:</span>
                    <strong>{preview.totalHindu}</strong>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span>Total cajas empacadas:</span>
                    <strong>{preview.totalBoxes}</strong>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span>Rendimiento A:</span>
                    <strong>{preview.rendimientoA.toFixed(2)}</strong>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span>Rendimiento H:</span>
                    <strong>{preview.rendimientoH.toFixed(2)}</strong>
                  </div>
                  <div className="pt-2">
                    <span className={`estado-pill ${estadoPreview.className}`}>{estadoPreview.label}</span>
                  </div>
                </div>
              </article>
            </section>

            {/* Historial Semanal del Productor */}
            <article className="tarjeta-panel print-hidden mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h3 className="font-bold text-base">Historial Semanal del Productor</h3>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-500 font-medium">{TITULOS_FILTRO[filtro]}</span>
                  <select
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value as FiltroRango)}
                    className="py-1 px-2 text-xs"
                  >
                    <option value="semana">Semana actual</option>
                    <option value="mes">Por mes</option>
                    <option value="anio">Por año</option>
                    <option value="personalizado">Personalizado</option>
                    <option value="todo">Historial completo</option>
                  </select>
                  {filtro === 'mes' && (
                    <input
                      type="month"
                      value={mesSeleccionado}
                      onChange={(e) => setMesSeleccionado(e.target.value)}
                      className="py-1 px-2 text-xs"
                    />
                  )}
                  {filtro === 'anio' && (
                    <input
                      type="number"
                      value={anioSeleccionado}
                      onChange={(e) => setAnioSeleccionado(e.target.value)}
                      className="py-1 px-2 text-xs w-20"
                    />
                  )}
                  {filtro === 'personalizado' && (
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={desdePersonalizado}
                        onChange={(e) => setDesdePersonalizado(e.target.value)}
                        className="py-1 px-2 text-xs"
                      />
                      <span>-</span>
                      <input
                        type="date"
                        value={hastaPersonalizado}
                        onChange={(e) => setHastaPersonalizado(e.target.value)}
                        className="py-1 px-2 text-xs"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="tabla-wrap">
                <table className="responsive-table">
                  <thead>
                    <tr>
                      <th>Semana</th>
                      <th>Inicio</th>
                      <th>Fin</th>
                      <th>Total Cajas</th>
                      <th>Promedio</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportesFiltrados.map((rep) => {
                      const total = computeWeeklyTotals(rep)
                      const rend = weeklyRendimiento(rep)
                      const promedio = (rend.rendimientoA + rend.rendimientoH) / 2
                      const estado = infoRendimiento(rend.rendimientoA, rend.rendimientoH)
                      return (
                        <tr key={rep.id} className={reporteEnFocoId === rep.id ? 'fila-foco' : ''}>
                          <td data-label="Semana">{`SEM ${rep.semana}`}</td>
                          <td data-label="Inicio">{rep.fecha_inicio}</td>
                          <td data-label="Fin">{rep.fecha_fin}</td>
                          <td data-label="Total Cajas">{total.totalBoxes.toLocaleString('en-US')}</td>
                          <td data-label="Promedio">{promedio.toFixed(2)}</td>
                          <td data-label="Estado">
                            <span className={`estado-pill ${estado.className}`}>{estado.label}</span>
                          </td>
                          <td data-label="Acciones" className="acciones-celda">
                            <button className="ghost text-xs py-1" onClick={() => setReporteEnFocoId(rep.id)}>
                              Ver
                            </button>
                            {!esSupervisor && (
                              <>
                                <button className="ghost text-xs py-1" onClick={() => abrirEdicionReporte(rep)}>
                                  <Pencil size={12} /> Editar
                                </button>
                                <button className="danger text-xs py-1" onClick={() => void eliminarReporte(rep.id)}>
                                  Eliminar
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </article>

            <section id="zona-impresion-captura" className="zona-impresion mt-6">
              {reportesParaImpresion.map((rep) => (
                <ReporteEmpaque
                  key={rep.id}
                  id={`hoja-reporte-${rep.id}`}
                  reporte={rep}
                  productor={productorActivo}
                  mostrarAccionExportarPNG
                />
              ))}
            </section>
          </section>
        )}

        {/* VISTA: REPORTES EJECUTIVOS */}
        {vista === 'reportes' && (
          <section className="seccion-vista space-y-6">
            <article className="tarjeta-panel">
              <h3 className="font-bold text-base mb-3">Reporte Semanal por Productor</h3>
              <div className="filtros-reportes grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <label>
                  Productor
                  <select value={productorActivoId} onChange={(e) => setProductorActivoId(e.target.value)}>
                    {productoresActivos.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Semana
                  <input
                    type="date"
                    value={fechaReporteProductor}
                    onChange={(e) => setFechaReporteProductor(e.target.value)}
                  />
                </label>
              </div>

              <div className="acciones-linea export-actions">
                <button
                  className="export-action-button text-xs"
                  onClick={async () => {
                    if (!reporteSemanalActivo) return
                    const el = document.getElementById('reporte-empaque-productor') as HTMLElement | null
                    if (el) {
                      const archivo = `reporte-productor-${llaveSemana(obtenerSemanaAnio(fechaReporteProductor).semana, obtenerSemanaAnio(fechaReporteProductor).anio)}.pdf`
                      await exportarReporteEmpaquePDF(el, archivo)
                    }
                  }}
                >
                  <Download size={14} /> Exportar PDF
                </button>
                <button
                  className="export-action-button text-xs"
                  onClick={async () => {
                    if (!reporteSemanalActivo) return
                    const archivo = `reporte-productor-${llaveSemana(obtenerSemanaAnio(fechaReporteProductor).semana, obtenerSemanaAnio(fechaReporteProductor).anio)}.xlsx`
                    await exportarReporteEmpaqueExcel(reporteSemanalActivo, productorActivo, archivo)
                  }}
                >
                  <Download size={14} /> Exportar Excel
                </button>
                <button
                  className="export-action-button text-xs"
                  onClick={async () => {
                    if (!reporteSemanalActivo) return
                    const el = document.getElementById('reporte-empaque-productor') as HTMLElement | null
                    if (el) {
                      const archivo = `reporte-productor-${llaveSemana(obtenerSemanaAnio(fechaReporteProductor).semana, obtenerSemanaAnio(fechaReporteProductor).anio)}.png`
                      await exportarReporteEmpaquePNG(el, archivo)
                    }
                  }}
                >
                  <Download size={14} /> Exportar PNG
                </button>
                <button
                  className="export-action-button text-xs"
                  onClick={() => {
                    if (!reporteSemanalActivo) return
                    exportarCsv(
                      [reporteSemanalActivo],
                      `reporte-productor-${llaveSemana(obtenerSemanaAnio(fechaReporteProductor).semana, obtenerSemanaAnio(fechaReporteProductor).anio)}`,
                    )
                  }}
                >
                  <Download size={14} /> Exportar CSV
                </button>
              </div>
            </article>

            <section id="zona-reporte-productor" className="tarjeta-panel">
              {reporteSemanalActivo ? (
                <ReporteEmpaque
                  id="reporte-empaque-productor"
                  reporte={reporteSemanalActivo}
                  productor={productorActivo}
                  mostrarAccionExportarPNG
                />
              ) : (
                <p className="muted py-8 text-center text-xs">No hay datos registrados para esta semana en el productor seleccionado.</p>
              )}
            </section>

            {/* Reporte General Semanal de Productores */}
            <article className="tarjeta-panel">
              <h3 className="font-bold text-base mb-3">Reporte General Semanal de Productores</h3>
              <div className="filtros-reportes max-w-xs mb-4">
                <label>
                  Semana a Consolidar
                  <input
                    type="date"
                    value={fechaGeneral}
                    onChange={(e) => setFechaGeneral(e.target.value)}
                  />
                </label>
              </div>
              <div className="acciones-linea export-actions mb-4">
                <button
                  className="export-action-button text-xs"
                  onClick={() =>
                    exportarZonaPdf(
                      'zona-reporte-general',
                      `reporte-general-${llaveSemana(obtenerSemanaAnio(fechaGeneral).semana, obtenerSemanaAnio(fechaGeneral).anio)}`,
                    )
                  }
                >
                  <Download size={14} /> Exportar PDF
                </button>
                <button
                  className="export-action-button text-xs"
                  onClick={() =>
                    void exportarZonaPng(
                      'zona-reporte-general',
                      `reporte-general-${llaveSemana(obtenerSemanaAnio(fechaGeneral).semana, obtenerSemanaAnio(fechaGeneral).anio)}`,
                    )
                  }
                >
                  <Download size={14} /> Exportar PNG
                </button>
                <button
                  className="export-action-button text-xs"
                  onClick={() =>
                    exportarExcelGeneral(
                      filasGeneralSemanal,
                      `reporte-general-${llaveSemana(obtenerSemanaAnio(fechaGeneral).semana, obtenerSemanaAnio(fechaGeneral).anio)}`,
                    )
                  }
                >
                  <Download size={14} /> Exportar Excel
                </button>
                <button
                  className="export-action-button text-xs"
                  onClick={() =>
                    exportarCsvGeneral(
                      filasGeneralSemanal,
                      `reporte-general-${llaveSemana(obtenerSemanaAnio(fechaGeneral).semana, obtenerSemanaAnio(fechaGeneral).anio)}`,
                    )
                  }
                >
                  <Download size={14} /> Exportar CSV
                </button>
              </div>
            </article>

            <section id="zona-reporte-general" className="tarjeta-panel reporte-general-ejecutivo">
              <header className="reporte-general-head text-center mb-6">
                <Logo alt="DeereMax" className="mx-auto mb-2" />
                <h3 className="font-extrabold text-base tracking-wider text-slate-900 dark:text-white">DEEREMAX</h3>
                <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200">
                  REPORTE GENERAL SEMANAL DE PRODUCTORES
                </h4>
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  SEMANA {reporteGeneralMeta.semana} DEL AÑO {reporteGeneralMeta.anio}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">{reporteGeneralMeta.periodoTexto}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Fecha de generación: {reporteGeneralMeta.fechaGeneracion}
                </p>
              </header>

              <div className="tabla-wrap">
                <table className="responsive-table tabla-general-ejecutiva">
                  <thead>
                    <tr>
                      <th>Productor</th>
                      <th>Cestas Americanas</th>
                      <th>Cestas Hindú</th>
                      <th>Americanas Empacadas</th>
                      <th>Hindú Empacadas</th>
                      <th>Total Cestas</th>
                      <th>Total Cajas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasGeneralSemanal.map((fila) => (
                      <tr key={fila.productorId}>
                        <td data-label="Productor">{fila.productor}</td>
                        <td data-label="Cestas Americanas">{fila.totalCestasAmericanasEnviadas.toLocaleString('en-US')}</td>
                        <td data-label="Cestas Hindú">{fila.totalCestasHinduEnviadas.toLocaleString('en-US')}</td>
                        <td data-label="Americanas Empacadas">{fila.totalAmericanasEmpacadas.toLocaleString('en-US')}</td>
                        <td data-label="Hindú Empacadas">{fila.totalHinduEmpacadas.toLocaleString('en-US')}</td>
                        <td data-label="Total Cestas">{fila.totalCestasEnviadas.toLocaleString('en-US')}</td>
                        <td data-label="Total Cajas">{fila.totalCajasEmpacadas.toLocaleString('en-US')}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th>TOTAL</th>
                      <th>{reporteGeneralMeta.totalCestasAmericanasEnviadas.toLocaleString('en-US')}</th>
                      <th>{reporteGeneralMeta.totalCestasHinduEnviadas.toLocaleString('en-US')}</th>
                      <th>{reporteGeneralMeta.totalAmericanasEmpacadas.toLocaleString('en-US')}</th>
                      <th>{reporteGeneralMeta.totalHinduEmpacadas.toLocaleString('en-US')}</th>
                      <th>{reporteGeneralMeta.totalCestasEnviadas.toLocaleString('en-US')}</th>
                      <th>{reporteGeneralMeta.totalCajasEmpacadas.toLocaleString('en-US')}</th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </section>
        )}

        {/* VISTA: AUDITORÍA Y TRAZABILIDAD (SOLO SUPER ADMIN) */}
        {vista === 'auditoria' && esSuperAdmin && (
          <section className="seccion-vista">
            <article className="tarjeta-panel">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <ClipboardList size={20} className="text-emerald-600" />
                    Auditoría y Trazabilidad del Sistema
                  </h3>
                  <p className="text-xs text-slate-500">
                    Historial cronológico completo e inmutable de eventos, inicios de sesión y exportaciones.
                  </p>
                </div>
                <div className="acciones-linea export-actions">
                  <button className="export-action-button text-xs" onClick={() => exportarAuditoriaExcel(auditoriaOrdenada, `auditoria-${format(new Date(), 'yyyyMMdd')}`)}>
                    <Download size={14} /> Exportar Excel
                  </button>
                  <button className="export-action-button text-xs" onClick={() => exportarAuditoriaCsv(auditoriaOrdenada, `auditoria-${format(new Date(), 'yyyyMMdd')}`)}>
                    <Download size={14} /> Exportar CSV
                  </button>
                </div>
              </div>

              {/* Filtros de Auditoría */}
              <div className="auditoria-filtros grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3 my-4">
                <label className="sm:col-span-2">
                  Buscar
                  <input
                    type="search"
                    placeholder="Descripción, usuario, módulo o acción..."
                    value={auditoriaTexto}
                    onChange={(e) => setAuditoriaTexto(e.target.value)}
                  />
                </label>
                <label>
                  Usuario
                  <select value={auditoriaUsuario} onChange={(e) => setAuditoriaUsuario(e.target.value)}>
                    <option value="todos">Todos los usuarios</option>
                    {auditoriaUsuariosDisponibles.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tipo de Acción
                  <select
                    value={auditoriaTipo}
                    onChange={(e) => setAuditoriaTipo(e.target.value as 'todos' | TipoEventoAuditoria)}
                  >
                    <option value="todos">Todos los tipos</option>
                    <option value="auth">Acceso / Biometría</option>
                    <option value="create">Crear</option>
                    <option value="update">Actualizar</option>
                    <option value="delete">Eliminar</option>
                    <option value="export">Exportación</option>
                    <option value="user">Usuarios</option>
                    <option value="permission">Permisos</option>
                  </select>
                </label>
                <label>
                  Módulo
                  <select value={auditoriaModulo} onChange={(e) => setAuditoriaModulo(e.target.value)}>
                    <option value="todos">Todos los módulos</option>
                    {auditoriaModulosDisponibles.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Desde
                  <input
                    type="date"
                    value={auditoriaDesde}
                    onChange={(e) => setAuditoriaDesde(e.target.value)}
                  />
                </label>
                <label>
                  Hasta
                  <input
                    type="date"
                    value={auditoriaHasta}
                    onChange={(e) => setAuditoriaHasta(e.target.value)}
                  />
                </label>
              </div>

              <div className="tabla-wrap">
                <table className="responsive-table auditoria-tabla">
                  <thead>
                    <tr>
                      <th><button className="ghost auditoria-sort" onClick={() => alternarOrdenAuditoria('fecha')}>Fecha</button></th>
                      <th><button className="ghost auditoria-sort" onClick={() => alternarOrdenAuditoria('hora')}>Hora</button></th>
                      <th><button className="ghost auditoria-sort" onClick={() => alternarOrdenAuditoria('usuario')}>Usuario</button></th>
                      <th><button className="ghost auditoria-sort" onClick={() => alternarOrdenAuditoria('modulo')}>Módulo</button></th>
                      <th><button className="ghost auditoria-sort" onClick={() => alternarOrdenAuditoria('accion')}>Acción</button></th>
                      <th><button className="ghost auditoria-sort" onClick={() => alternarOrdenAuditoria('descripcion')}>Descripción</button></th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditoriaPaginada.map((item) => {
                      const tipoInfo = infoTipoAuditoria(item.tipo)
                      return (
                        <tr key={item.id}>
                          <td data-label="Fecha">{formatoFechaAuditoria(item.createdAt)}</td>
                          <td data-label="Hora">{formatoHoraAuditoria(item.createdAt)}</td>
                          <td data-label="Usuario">{item.usuarioNombre || item.usuarioEmail || 'Usuario'}</td>
                          <td data-label="Módulo">{item.modulo}</td>
                          <td data-label="Acción">
                            <span className={`auditoria-tipo ${tipoInfo.className}`}>
                              {iconoTipoAuditoria(item.tipo)} {tipoInfo.label}
                            </span>
                          </td>
                          <td data-label="Descripción">{item.descripcion}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {auditoriaTotalPaginas > 1 && (
                <div className="flex items-center justify-between p-3 border-t border-slate-200 dark:border-slate-800 text-xs">
                  <span className="text-slate-500">
                    Página {auditoriaPagina} de {auditoriaTotalPaginas} ({auditoriaOrdenada.length} eventos)
                  </span>
                  <div className="flex gap-2">
                    <button
                      className="ghost text-xs py-1 px-2.5"
                      disabled={auditoriaPagina <= 1}
                      onClick={() => setAuditoriaPagina((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </button>
                    <button
                      className="ghost text-xs py-1 px-2.5"
                      disabled={auditoriaPagina >= auditoriaTotalPaginas}
                      onClick={() => setAuditoriaPagina((p) => Math.min(auditoriaTotalPaginas, p + 1))}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </article>
          </section>
        )}

        {/* VISTA: GESTIÓN DE USUARIOS (SUPER ADMIN - OLMAN) */}
        {vista === 'usuarios' && esSuperAdmin && (
          <GestionUsuarios
            rolUsuarioActual={rolUsuario}
            onNotificarExito={notificarExito}
            onNotificarError={notificarError}
            onRegistrarAuditoria={async (accion, desc) => {
              await registrarEvento({
                tipo: 'user',
                accion,
                descripcion: desc,
                modulo: 'Usuarios',
              })
            }}
          />
        )}

        {/* VISTA: CENTRO DE SEGURIDAD */}
        {vista === 'seguridad' && (
          <CentroSeguridad
            perfil={
              qPerfilUsuario.data ?? {
                id: usuarioActivo.id,
                email: usuarioEmail,
                nombre: usuarioNombre,
                cargo: usuarioCargo,
                rol: rolUsuario,
                biometria_activa: credencialesDispositivo.length > 0,
              }
            }
            onNotificarExito={notificarExito}
            onNotificarError={notificarError}
            onRegistrarAuditoria={async (accion, desc) => {
              await registrarEvento({
                tipo: 'config',
                accion,
                descripcion: desc,
                modulo: 'Seguridad',
              })
            }}
          />
        )}
      </main>

      {/* Navegación Móvil Inferior */}
      <BottomNavigation
        vistaActual={vista}
        onCambiarVista={(v) => setVista(v)}
        onAbrirMenu={() => setMenuAbierto(true)}
        esSupervisor={esSupervisor}
        esSuperAdmin={esSuperAdmin}
      />

      {/* Modal Prompt de Registro de Biometría tras primer login */}
      <PromptConfigurarBiometria
        abierto={mostrarPromptBiometria}
        onCerrar={() => setMostrarPromptBiometria(false)}
        userId={usuarioActivo?.id || ''}
        userEmail={usuarioEmail}
        userName={usuarioNombre}
        onBiometriaConfigurada={() => {
          void obtenerCredencialesUsuario(usuarioActivo?.id || '').then((creds) => {
            setCredencialesDispositivo(creds)
          })
          void qPerfilUsuario.refetch()
        }}
        onNotificarExito={notificarExito}
        onNotificarError={notificarError}
      />

      {/* Modal Productor */}
      {modalProductorAbierto && (
        <div className="overlay-modal print-hidden" onClick={() => setModalProductorAbierto(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="font-bold text-base text-slate-800 dark:text-white">
                {formProductor.id ? 'Editar Productor' : 'Nuevo Productor'}
              </h3>
              <button className="ghost" onClick={() => setModalProductorAbierto(false)}>
                <X size={16} />
              </button>
            </div>
            <form className="modal-form" onSubmit={guardarFormularioProductor}>
              <ImageUploadField
                label="Logotipo / Fotografía del Productor"
                value={formProductor.foto_url}
                nombreReferencia={formProductor.nombre}
                tipo="producer"
                onChange={(data) => {
                  setFormProductor((prev) => ({ ...prev, foto_url: data.url }))
                  setFormProductorBlob(data.blob || null)
                  if (!data.url) setFormProductorFotoEliminada(true)
                  else setFormProductorFotoEliminada(false)
                }}
                onError={notificarError}
                helpText="Logotipo de la finca o proveedor (PNG, JPG, WebP máx. 5MB)"
              />

              <label>
                Código
                <input type="text" maxLength={10} value={formProductor.codigo} readOnly />
              </label>
              <label>
                Nombre Completo
                <input
                  type="text"
                  maxLength={120}
                  value={formProductor.nombre}
                  onChange={(e) => setFormProductor((prev) => ({ ...prev, nombre: e.target.value.toUpperCase() }))}
                  required
                />
              </label>
              <label>
                Teléfono
                <input
                  type="text"
                  maxLength={60}
                  value={formProductor.telefono}
                  onChange={(e) => setFormProductor((prev) => ({ ...prev, telefono: e.target.value }))}
                />
              </label>
              <label>
                N° Cuenta / Finca
                <input
                  type="text"
                  maxLength={120}
                  value={formProductor.finca}
                  onChange={(e) => setFormProductor((prev) => ({ ...prev, finca: e.target.value }))}
                />
              </label>
              <label>
                Sector
                <input
                  type="text"
                  maxLength={120}
                  value={formProductor.sector}
                  onChange={(e) => setFormProductor((prev) => ({ ...prev, sector: e.target.value }))}
                />
              </label>
              <label>
                Observaciones
                <textarea
                  rows={2}
                  value={formProductor.observaciones}
                  onChange={(e) => setFormProductor((prev) => ({ ...prev, observaciones: e.target.value }))}
                />
              </label>
              <div className="acciones-linea mt-4">
                <button type="submit">
                  <Save size={16} /> Guardar Productor
                </button>
                <button type="button" className="ghost" onClick={() => setModalProductorAbierto(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      {confirmacionEliminar && (
        <div className="overlay-modal print-hidden" onClick={() => setConfirmacionEliminar(null)}>
          <div className="modal modal-confirmacion" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-base text-red-600">Confirmar Eliminación</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
              ¿Estás seguro de eliminar al productor <strong>{confirmacionEliminar.nombre}</strong>?
            </p>
            <div className="acciones-linea mt-4">
              <button className="ghost" onClick={() => setConfirmacionEliminar(null)}>
                Cancelar
              </button>
              <button
                className="danger"
                onClick={async () => {
                  const target = confirmacionEliminar
                  setConfirmacionEliminar(null)
                  await eliminarProductor(target)
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Perfil de Usuario */}
      {modalPerfilAbierto && (
        <ModalPerfilUsuario
          abierto={modalPerfilAbierto}
          onCerrar={() => setModalPerfilAbierto(false)}
          perfilActual={
            qPerfilUsuario.data ?? {
              id: usuarioActivo.id,
              email: usuarioEmail,
              nombre: usuarioNombre,
              telefono: null,
              cargo: usuarioCargo,
              rol: rolUsuario,
              foto_url: usuarioFoto,
            }
          }
          onPerfilActualizado={(nuevo) => {
            queryClient.setQueryData(['perfil-usuario', usuarioActivo.id], nuevo)
          }}
          onNotificarExito={notificarExito}
          onNotificarError={notificarError}
          onRegistrarAuditoria={async (accion, descripcion) => {
            await registrarEvento({
              tipo: 'user',
              accion,
              descripcion,
              modulo: 'Usuarios',
            })
          }}
        />
      )}

      {/* Toasts */}
      {toast && (
        <div className={`toast ${toast.kind === 'success' ? 'toast-ok' : 'toast-error'}`}>
          {toast.kind === 'success' ? '✓' : '✕'} {toast.text}
        </div>
      )}
    </div>
  )
}

export default App
