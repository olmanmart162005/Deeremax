import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { addDays, format, getWeek, getWeekYear, parseISO, startOfMonth, startOfYear } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Crown,
  Download,
  Eye,
  EyeOff,
  Filter,
  FileText,
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
  Trophy,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCircle2,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
  Area,
  AreaChart,
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
import { supabase } from './lib/supabase'
import type { DetalleReporte, EntryFormState, Productor, Reporte } from './types'
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
import { ReporteEmpaque } from './components/ReporteEmpaque'
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
import { supabaseConfigError } from './lib/supabase'

type FiltroRango = 'semana' | 'mes' | 'anio' | 'personalizado' | 'todo'
type DashboardRango = 'hoy' | 'semana' | 'mes' | 'anio' | 'personalizado'
type Vista = 'inicio' | 'productores' | 'captura' | 'reportes' | 'admin'
type Toast = { kind: 'success' | 'error'; text: string }
type FiltroEstadoProductor = 'todos' | 'activos' | 'inactivos'
type OrdenProductor = 'nombre' | 'codigo' | 'creacion'

type FormProductor = {
  id: string | null
  codigo: string
  nombre: string
  telefono: string
  finca: string
  sector: string
  observaciones: string
  activo: boolean
}

type DeferredInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const UMBRAL_BUENO = 0.5
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS as string | undefined)
  ?.split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean) ?? ['ervin2026@admin.com']

const TITULOS_FILTRO: Record<FiltroRango, string> = {
  semana: 'Semana actual',
  mes: 'Mes seleccionado',
  anio: 'AÑO seleccionado',
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
  reportes: { modulo: 'Reportes', breadcrumb: 'Inicio / Reportes', cargo: 'Análisis' },
  admin: { modulo: 'Administración', breadcrumb: 'Inicio / Administración', cargo: 'Administración' },
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
    <>{displayValue.toLocaleString('es-HN', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}</>
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
  if (base.toLowerCase() === 'ervin2026') return 'Ervin Martinez'
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

function PantallaLogin() {
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

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: correo,
      password: contrasena,
    })

    if (authError) {
      logErrorSupabase('Inicio de sesión', authError)
      const msg = authError.message.toLowerCase()
      if (msg.includes('email not confirmed')) {
        setError('Tu correo no está confirmado en Supabase. Solicita activación al administrador.')
      } else if (msg.includes('invalid login credentials')) {
        setError('Credenciales inválidas. Verifica correo y contraseña.')
      } else {
        setError(authError.message)
      }
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
        <motion.img
          className="brand-logo"
          src="/logoDeereMax.jpeg"
          alt="DeereMax"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.45 }}
        />
        <p className="login-caption">Bienvenido nuevamente</p>
        <h1>Ervin Martínez</h1>
        <p className="login-tagline">Soluciones que cultivan el futuro.</p>

        <form className="login-form" onSubmit={onSubmit}>
          <label>
            Correo electronico
            <div className="field-shell">
              <Mail size={17} />
              <input
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
                autoComplete="email"
                placeholder="tu.correo@empresa.com"
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
                minLength={6}
                autoComplete="current-password"
                placeholder="Ingresa tu contraseña"
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
          >
            <LogIn size={16} /> {guardando ? 'Ingresando...' : 'Ingresar'}
          </motion.button>

          <div className="login-extras">
            <label className="remember-check">
              <input
                type="checkbox"
                checked={recordarme}
                onChange={(e) => setRecordarme(e.target.checked)}
              />
              <span>Recordarme</span>
            </label>
          </div>
        </form>
      </motion.div>

      <footer className="login-footer">
        <p>© 2026 DeereMax</p>
        <p>Soluciones que cultivan futuro.</p>
      </footer>
    </div>
  )
}

function App() {
  const [sesion, setSesion] = useState<Session | null>(null)
  const [vista, setVista] = useState<Vista>('inicio')
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [ahora, setAhora] = useState(new Date())
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<DeferredInstallPromptEvent | null>(null)
  const [esInstalable, setEsInstalable] = useState(false)
  const [mostrarGuiaInstalacion, setMostrarGuiaInstalacion] = useState(false)
  const [esIos, setEsIos] = useState(false)
  const [esAppInstalada, setEsAppInstalada] = useState(false)

  const [filtro, setFiltro] = useState<FiltroRango>('semana')
  const [mesSeleccionado, setMesSeleccionado] = useState(format(startOfMonth(new Date()), 'yyyy-MM'))
  const [anioSeleccionado, setAnioSeleccionado] = useState(format(startOfYear(new Date()), 'yyyy'))
  const [desdePersonalizado, setDesdePersonalizado] = useState(format(new Date(), 'yyyy-MM-01'))
  const [hastaPersonalizado, setHastaPersonalizado] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [busqueda, setBusqueda] = useState('')
  const [busquedaAdmin, setBusquedaAdmin] = useState('')
  const [filtroEstadoProductores, setFiltroEstadoProductores] = useState<FiltroEstadoProductor>('todos')
  const [ordenProductores, setOrdenProductores] = useState<OrdenProductor>('nombre')
  const [filtroEstadoAdmin, setFiltroEstadoAdmin] = useState<FiltroEstadoProductor>('todos')
  const [ordenAdmin, setOrdenAdmin] = useState<OrdenProductor>('nombre')

  const [formCaptura, setFormCaptura] = useState<EntryFormState>(getInitialFormState())
  const [detalleEnEdicionId, setDetalleEnEdicionId] = useState<string | null>(null)
  const [reporteEnFocoId, setReporteEnFocoId] = useState<string | null>(null)
  const [reporteEnEdicionId, setReporteEnEdicionId] = useState<string | null>(null)
  const [fechaDetalleSeleccionada, setFechaDetalleSeleccionada] = useState<string | null>(null)
  const [retroalimentacion, setRetroalimentacion] = useState('')

  const [productorActivoId, setProductorActivoId] = useState('')
  const [fechaReporteProductor, setFechaReporteProductor] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [fechaGeneral, setFechaGeneral] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [filtroDashboard, setFiltroDashboard] = useState<DashboardRango>('semana')
  const [dashboardDesde, setDashboardDesde] = useState(format(new Date(), 'yyyy-MM-01'))
  const [dashboardHasta, setDashboardHasta] = useState(format(new Date(), 'yyyy-MM-dd'))

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
  })
  const [menuProductorId, setMenuProductorId] = useState<string | null>(null)
  const [confirmacionEliminar, setConfirmacionEliminar] = useState<Productor | null>(null)

  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setAhora(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean }
    const ios = /iphone|ipad|ipod/i.test(nav.userAgent)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean(nav.standalone)

    setEsIos(ios)
    setEsAppInstalada(standalone)

    const onBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as DeferredInstallPromptEvent
      installEvent.preventDefault()
      setDeferredInstallPrompt(installEvent)
      setEsInstalable(true)
      setMostrarGuiaInstalacion(false)
    }

    const onAppInstalled = () => {
      setEsAppInstalada(true)
      setEsInstalable(false)
      setDeferredInstallPrompt(null)
      setMostrarGuiaInstalacion(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  useEffect(() => {
    if (esAppInstalada || esInstalable) return
    const timer = window.setTimeout(() => setMostrarGuiaInstalacion(true), 1500)
    return () => window.clearTimeout(timer)
  }, [esAppInstalada, esInstalable])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (supabaseConfigError) return

    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
      setSesion(updatedSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  const qProductores = useQuery({
    queryKey: ['productores', sesion?.user.id],
    enabled: !!sesion,
    queryFn: async () => {
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
    queryKey: ['reportes-globales', sesion?.user.id],
    enabled: !!sesion,
    queryFn: async () => {
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

  const esAdmin = useMemo(() => {
    const email = sesion?.user.email?.toLowerCase()
    if (!email) return false
    return ADMIN_EMAILS.includes(email)
  }, [sesion?.user.email])

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

  const notificarExito = (text: string) => setToast({ kind: 'success', text })
  const notificarError = (text: string) => setToast({ kind: 'error', text })

  const instalarAplicacion = async () => {
    if (!deferredInstallPrompt) {
      setMostrarGuiaInstalacion(true)
      return
    }

    await deferredInstallPrompt.prompt()
    const choice = await deferredInstallPrompt.userChoice

    setDeferredInstallPrompt(null)
    setEsInstalable(false)

    if (choice.outcome !== 'accepted') {
      setMostrarGuiaInstalacion(true)
    }
  }

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
        ultimaSemana: lista[0]
          ? `SEM ${lista[0].semana} - ${lista[0].anio}`
          : 'Sin registros',
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
      { name: 'Hindu', value: totalHindu },
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

    const actividad = [
      ...reportesOrdenados.slice(0, 4).map((rep) => ({
        id: `nuevo-${rep.id}`,
        fecha: rep.created_at,
        texto: 'Nuevo reporte registrado',
      })),
      ...productores
        .slice()
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 3)
        .map((item) => ({
          id: `productor-${item.id}`,
          fecha: item.created_at,
          texto: `Nuevo productor agregado: ${item.nombre}`,
        })),
      ...reportesOrdenados.slice(0, 3).map((rep) => ({
        id: `actualizado-${rep.id}`,
        fecha: rep.created_at,
        texto: 'Reporte actualizado',
      })),
    ]
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 8)

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
      actividad,
    }
  }, [
    dashboardDesde,
    dashboardHasta,
    filtroDashboard,
    productoresActivos.length,
    qProductores.data,
    qReportesGlobal.data,
  ])

  const productoresVisibles = useMemo(() => {
    return filtrarYOrdenarProductores(
      qProductores.data ?? [],
      busqueda,
      filtroEstadoProductores,
      ordenProductores,
    )
  }, [busqueda, filtroEstadoProductores, ordenProductores, qProductores.data])

  const productoresAdminVisibles = useMemo(() => {
    return filtrarYOrdenarProductores(
      qProductores.data ?? [],
      busquedaAdmin,
      filtroEstadoAdmin,
      ordenAdmin,
    )
  }, [busquedaAdmin, filtroEstadoAdmin, ordenAdmin, qProductores.data])

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

  const filasGeneralSemanal = useMemo(() => {
    const productores = qProductores.data ?? []
    const criterio = obtenerSemanaAnio(fechaGeneral)
    const reportesSemana = (qReportesGlobal.data ?? []).filter(
      (item) => item.semana === criterio.semana && item.anio === criterio.anio,
    )

    return reportesSemana.map((rep) => {
      const prod = productores.find((item) => item.id === rep.productor_id)
      const total = computeWeeklyTotals(rep)
      const rend = weeklyRendimiento(rep)
      const estado = infoRendimiento(rend.rendimientoA, rend.rendimientoH)
      return {
        id: rep.id,
        productor: prod?.nombre ?? 'Sin nombre',
        totalCajas: total.totalBoxes,
        rendimientoA: rend.rendimientoA,
        rendimientoH: rend.rendimientoH,
        estado: estado.label,
      }
    })
  }, [fechaGeneral, qProductores.data, qReportesGlobal.data])

  const reporteGeneralMeta = useMemo(() => {
    const criterio = obtenerSemanaAnio(fechaGeneral)
    const reportesSemana = (qReportesGlobal.data ?? []).filter(
      (item) => item.semana === criterio.semana && item.anio === criterio.anio,
    )

    const fallbackRange = getWeekRange(fechaGeneral)
    const fechasInicio = reportesSemana.map((item) => item.fecha_inicio)
    const fechasFin = reportesSemana.map((item) => item.fecha_fin)

    const fechaInicio = fechasInicio.length > 0
      ? [...fechasInicio].sort((a, b) => a.localeCompare(b))[0]
      : fallbackRange.weekStart
    const fechaFin = fechasFin.length > 0
      ? [...fechasFin].sort((a, b) => b.localeCompare(a))[0]
      : fallbackRange.weekEnd

    const totalCajas = filasGeneralSemanal.reduce((acc, fila) => acc + fila.totalCajas, 0)
    const fechaGeneracion = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })
    const periodoDesde = format(parseISO(fechaInicio), "d 'de' MMMM", { locale: es })
    const periodoHasta = format(parseISO(fechaFin), "d 'de' MMMM 'de' yyyy", { locale: es })

    return {
      semana: criterio.semana,
      anio: criterio.anio,
      fechaInicio,
      fechaFin,
      totalCajas,
      totalProductores: filasGeneralSemanal.length,
      periodoTexto: `PERIODO DEL ${periodoDesde.toUpperCase()} AL ${periodoHasta.toUpperCase()}`,
      fechaGeneracion: fechaGeneracion.charAt(0).toUpperCase() + fechaGeneracion.slice(1),
    }
  }, [fechaGeneral, filasGeneralSemanal, qReportesGlobal.data])

  const vistaCargando = qProductores.isLoading && !qProductores.data
  const metaVista = META_VISTA[vista]
  const usuarioEmail = sesion?.user?.email ?? 'usuario@deeremax.app'
  const usuarioNombre = formatearNombreUsuario(usuarioEmail)
  const rolUsuario = esAdmin ? 'Administrador' : 'Usuario operativo'
  const inicialesUsuario = usuarioNombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk.charAt(0).toUpperCase())
    .join('')

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
    })
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
    if (!esAdmin) {
      return
    }

    if (!validarProductor()) return

    const { error } = await guardarProductor(formProductor.id, {
      codigo: normalizarCodigo(formProductor.codigo),
      nombre: formProductor.nombre.trim().toUpperCase(),
      telefono: formProductor.telefono.trim(),
      finca: formProductor.finca.trim(),
      sector: formProductor.sector.trim(),
      observaciones: formProductor.observaciones.trim(),
      activo: formProductor.activo,
    })

    if (error) {
      notificarError(`No se pudo guardar productor: ${error.message}`)
      return
    }

    await qProductores.refetch()
    notificarExito(formProductor.id ? 'Productor actualizado con exito.' : 'Productor creado con exito.')
    setModalProductorAbierto(false)
    resetFormProductor()
  }

  const abrirEdicionProductor = (item: Productor) => {
    setFormProductor({
      id: item.id,
      codigo: item.codigo ?? siguienteCodigo(qProductores.data ?? []),
      nombre: item.nombre.toUpperCase(),
      telefono: item.telefono ?? '',
      finca: item.finca ?? '',
      sector: item.sector ?? '',
      observaciones: item.observaciones ?? '',
      activo: estaActivo(item),
    })
    setModalProductorAbierto(true)
  }

  const alternarEstado = async (item: Productor) => {
    if (!esAdmin) return
    const { error } = await actualizarEstadoProductor(item, !estaActivo(item))

    if (error) {
      notificarError(`No se pudo cambiar estado: ${error.message}`)
      return
    }

    await qProductores.refetch()
    notificarExito('Estado actualizado.')
  }

  const eliminarProductor = async (item: Productor) => {
    if (!esAdmin) return

    const tieneReportes = (qReportesGlobal.data ?? []).some((rep) => rep.productor_id === item.id)

    if (tieneReportes) {
      const { error } = await actualizarEstadoProductor(item, false)
      if (error) {
        notificarError(`No se pudo desactivar productor: ${error.message}`)
        return
      }

      await qProductores.refetch()
      notificarExito('El productor tiene reportes. Fue desactivado, no eliminado.')
      return
    }

    const { error } = await supabase.from('productores').delete().eq('id', item.id)
    if (error) {
      logErrorSupabase('Eliminar productor', error)
      notificarError(`No se pudo eliminar productor: ${error.message}`)
      return
    }

    await qProductores.refetch()
    notificarExito('Productor eliminado correctamente.')
  }

  const abrirProductorDesdeFicha = (item: Productor) => {
    if (!estaActivo(item)) {
      notificarError('El productor esta inactivo. Activalo para abrirlo.')
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

    if (!sesion || !productorActivoId) return

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
        setRetroalimentacion('Selecciona un dia registrado para editarlo.')
        notificarError('Selecciona un dia registrado para editarlo.')
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
    setRetroalimentacion('Captura guardada con exito.')
    notificarExito('Captura guardada con exito.')
    resetCaptura()
  }

  const eliminarReporte = async (reporteId: string) => {
    if (!window.confirm('Seguro que deseas eliminar toda la semana?')) return

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

    await Promise.all([qReportesProductor.refetch(), qReportesGlobal.refetch()])
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
    notificarExito('CSV exportado con exito.')
  }

  const exportarExcel = (reportes: Reporte[], nombre: string) => {
    if (reportes.length === 0) {
      notificarError('No hay datos para exportar.')
      return
    }

    const mapaProductores = new Map((qProductores.data ?? []).map((item) => [item.id, item.nombre]))
    const filas: Array<Record<string, string | number>> = []

    reportes.forEach((rep) => {
      rep.detalle_reporte.forEach((detalle) => {
        const calc = computeDailyTotals(detalle)
        const estado = infoRendimiento(calc.rendimientoA, calc.rendimientoH)
        filas.push({
          Productor: mapaProductores.get(rep.productor_id) ?? 'N/A',
          SemanaInicio: rep.fecha_inicio,
          SemanaFin: rep.fecha_fin,
          Fecha: detalle.fecha,
          CestasA: detalle.cestas_a,
          CestasH: detalle.cestas_h,
          A4kg: detalle.americana_4,
          A5kg: detalle.americana_5,
          A7kg: detalle.americana_7,
          H4kg: detalle.hindu_4,
          H5kg: detalle.hindu_5,
          H7kg: detalle.hindu_7,
          TotalCajas: calc.totalBoxes,
          RendimientoA: Number(calc.rendimientoA.toFixed(2)),
          RendimientoH: Number(calc.rendimientoH.toFixed(2)),
          Estado: estado.label,
        })
      })
    })

    exportRowsToExcel(filas, `${nombre}.xlsx`)
    notificarExito('Excel exportado con exito.')
  }

  const exportarZonaPdf = async (zoneId: string, nombre: string) => {
    const element = document.getElementById(zoneId)
    if (!element) return
    await exportElementToPdf(element, `${nombre}.pdf`)
    notificarExito('PDF exportado con exito.')
  }

  const exportarZonaPng = async (zoneId: string, nombre: string) => {
    const element = document.getElementById(zoneId)
    if (!element) return
    await exportElementToImage(element, `${nombre}.png`)
    notificarExito('PNG exportado con exito.')
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

  const kpiCards = [
    {
      title: 'Productores registrados',
      desc: 'Activos en operación',
      icon: Users,
      value: dashboardData.resumen.productores,
      decimals: 0,
      delta: dashboardData.comparativas.reportes,
      color: '#2563eb',
    },
    {
      title: 'Reportes generados',
      desc: TITULOS_FILTRO_DASHBOARD[filtroDashboard],
      icon: FileText,
      value: dashboardData.resumen.reportes,
      decimals: 0,
      delta: dashboardData.comparativas.reportes,
      color: '#15803d',
    },
    {
      title: 'Producción total',
      desc: 'Consolidado del período',
      icon: BarChart3,
      value: dashboardData.resumen.totalCajas,
      decimals: 0,
      delta: dashboardData.comparativas.totalCajas,
      color: '#d97706',
    },
    {
      title: 'Rendimiento promedio',
      desc: 'Rendimiento general',
      icon: Activity,
      value: dashboardData.resumen.promedioRendimiento,
      decimals: 2,
      delta: dashboardData.comparativas.promedioRendimiento,
      color: '#15803d',
    },
    {
      title: 'Productor con mayor rendimiento',
      desc: dashboardData.resumen.mejor?.nombre ?? 'Sin datos',
      icon: Trophy,
      value: dashboardData.resumen.mejor?.rendimientoPromedio ?? 0,
      decimals: 2,
      delta: null,
      color: '#d97706',
    },
    {
      title: 'Productor con menor rendimiento',
      desc: dashboardData.resumen.peor?.nombre ?? 'Sin datos',
      icon: TrendingDown,
      value: dashboardData.resumen.peor?.rendimientoPromedio ?? 0,
      decimals: 2,
      delta: null,
      color: '#dc2626',
    },
    {
      title: 'Producción variedad Americana',
      desc: 'Variedad Americana',
      icon: TrendingUp,
      value: dashboardData.resumen.totalAmericana,
      decimals: 0,
      delta: null,
      color: '#15803d',
    },
    {
      title: 'Producción variedad Hindú',
      desc: 'Variedad Hindú',
      icon: CalendarDays,
      value: dashboardData.resumen.totalHindu,
      decimals: 0,
      delta: null,
      color: '#7c3aed',
    },
  ]

  if (supabaseConfigError) {
    return (
      <div className="pantalla-carga">
        <div className="carga-card">
          <img src="/logoDeereMax.jpeg" alt="DeereMax" />
          <h2>Configuracion pendiente en Netlify</h2>
          <p>
            Agrega las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Site settings &gt; Environment variables.
          </p>
        </div>
      </div>
    )
  }

  if (!sesion) return <PantallaLogin />

  if (vistaCargando) {
    return (
      <div className="pantalla-carga">
        <div className="carga-card">
          <img src="/logoDeereMax.jpeg" alt="DeereMax" />
          <h2>Iniciando sesión...</h2>
          <p>Preparando el sistema, por favor espere.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`dm-app ${menuAbierto ? 'menu-abierto' : ''}`}>
      <header className="barra-superior print-hidden">
        <button className="boton-menu" onClick={() => setMenuAbierto((v) => !v)}>
          <Menu size={18} />
        </button>
        <div className="marca-top">
          <img src="/logoDeereMax.jpeg" alt="DeereMax" />
          <div className="marca-top-texto">
            <p className="ruta-top">{metaVista.breadcrumb}</p>
            <h1>{metaVista.modulo}</h1>
            <p>{formatoFechaLarga(ahora)} | {formatoHora(ahora)}</p>
          </div>
        </div>
        <div className="acciones-topbar">
          <div className="perfil-topbar">
            <div className="usuario-topbar-chip">
              <UserCircle2 size={18} />
              <div>
                <strong>{usuarioNombre}</strong>
                <span>{metaVista.cargo}</span>
              </div>
            </div>
          </div>
          {!esAppInstalada ? (
            <button className={`btn-instalar ${esInstalable ? '' : 'ghost'}`} onClick={() => void instalarAplicacion()}>
              <Download size={16} /> {esInstalable ? 'Instalar aplicación' : 'Cómo instalar'}
            </button>
          ) : null}
        </div>
      </header>

      <div className={`fondo-menu ${menuAbierto ? 'visible' : ''}`} onClick={() => setMenuAbierto(false)} />

      <aside className={`menu-lateral ${menuAbierto ? 'abierto' : ''} print-hidden`}>
        <div className="menu-encabezado">
          <div className="menu-brand-block">
            <img src="/logoDeereMax.jpeg" alt="DeereMax" />
            <div>
              <strong>DeereMax ERP</strong>
              <span>Operaciones DeereMax</span>
            </div>
          </div>
          <button type="button" className="boton-cerrar-drawer" aria-label="Cerrar menú" onClick={() => setMenuAbierto(false)}>
            <X size={16} />
          </button>
        </div>
        <div className="menu-usuario-resumen">
          <div className="menu-usuario-avatar" aria-hidden>{inicialesUsuario || 'US'}</div>
          <div className="menu-usuario-datos">
            <span>{usuarioNombre}</span>
            <small>{usuarioEmail}</small>
            <small>{rolUsuario}</small>
          </div>
        </div>
        <nav>
          <button className={`menu-item ${vista === 'inicio' ? 'activo' : ''}`} onClick={() => { setVista('inicio'); setMenuAbierto(false) }}>
            <Home size={16} /> Inicio
          </button>
          <button className={`menu-item ${vista === 'productores' ? 'activo' : ''}`} onClick={() => { setVista('productores'); setMenuAbierto(false) }}>
            <Users size={16} /> Productores
          </button>
          <button className={`menu-item ${vista === 'reportes' ? 'activo' : ''}`} onClick={() => { setVista('reportes'); setMenuAbierto(false) }}>
            <FileText size={16} /> Reportes
          </button>
          {esAdmin ? (
            <button className={`menu-item ${vista === 'admin' ? 'activo' : ''}`} onClick={() => { setVista('admin'); setMenuAbierto(false) }}>
              <Settings size={16} /> Administración
            </button>
          ) : null}
          <button className="menu-item menu-item-salir" onClick={() => { setMenuAbierto(false); supabase.auth.signOut() }}>
            <LogOut size={16} /> Cerrar sesión
          </button>
        </nav>
      </aside>

      <main className="contenido-principal">
        {vista === 'inicio' ? (
          <section className="seccion-vista dashboard-home">
            <motion.article
              className="dashboard-hero"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="dashboard-hero-row">
                <div>
                  <h2 className="dashboard-title">Panel de Control</h2>
                  <p className="dashboard-subtitle">{formatoFechaLarga(ahora)} | {formatoHora(ahora)}</p>
                </div>
                <div className="dashboard-filter-pill">
                  <Filter size={14} /> {TITULOS_FILTRO_DASHBOARD[filtroDashboard]}
                </div>
              </div>

              <div className="dashboard-filters-grid">
                <button type="button" className={`justify-center ${filtroDashboard === 'hoy' ? '' : 'ghost'}`} onClick={() => setFiltroDashboard('hoy')}>Hoy</button>
                <button type="button" className={`justify-center ${filtroDashboard === 'semana' ? '' : 'ghost'}`} onClick={() => setFiltroDashboard('semana')}>Últimos 7 días</button>
                <button type="button" className={`justify-center ${filtroDashboard === 'mes' ? '' : 'ghost'}`} onClick={() => setFiltroDashboard('mes')}>Mes actual</button>
                <button type="button" className={`justify-center ${filtroDashboard === 'anio' ? '' : 'ghost'}`} onClick={() => setFiltroDashboard('anio')}>Año en curso</button>
                <button type="button" className={`justify-center ${filtroDashboard === 'personalizado' ? '' : 'ghost'}`} onClick={() => setFiltroDashboard('personalizado')}>Período personalizado</button>
              </div>

              {filtroDashboard === 'personalizado' ? (
                <div className="dashboard-custom-range">
                  <label>
                    Desde
                    <input type="date" value={dashboardDesde} onChange={(e) => setDashboardDesde(e.target.value)} />
                  </label>
                  <label>
                    Hasta
                    <input type="date" value={dashboardHasta} onChange={(e) => setDashboardHasta(e.target.value)} />
                  </label>
                </div>
              ) : null}
            </motion.article>

            <section className="dashboard-kpi-grid">
              {kpiCards.map((kpi, idx) => {
                const Icon = kpi.icon
                const delta = kpi.delta
                return (
                  <motion.article
                    key={kpi.title}
                    className="dashboard-kpi-card"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    whileHover={{ y: -4 }}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="rounded-xl p-2" style={{ backgroundColor: `${kpi.color}1f` }}>
                        <Icon size={18} color={kpi.color} />
                      </div>
                      {typeof delta === 'number' ? (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${delta >= 0 ? 'bg-[#e8f6ee] text-[#1B5E20]' : 'bg-[#fdeaea] text-[#b22b2b]'}`}>
                          {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {Math.abs(delta).toFixed(1)}%
                        </span>
                      ) : null}
                    </div>
                    <p className="dashboard-kpi-label">{kpi.title}</p>
                    <p className="dashboard-kpi-value"><AnimatedNumber value={kpi.value} decimals={kpi.decimals} /></p>
                    <p className="dashboard-kpi-desc">{kpi.desc}</p>
                    <Sparkline data={dashboardData.sparkline} color={kpi.color} />
                  </motion.article>
                )
              })}
            </section>

            <section className="dashboard-charts-grid">
              <article className="dashboard-panel dashboard-panel-large">
                <h3>Tendencia de Producción Semanal</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboardData.weeklyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d9e5d7" />
                      <XAxis dataKey="semana" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="totalCajas" stroke="#1B5E20" strokeWidth={3} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <article className="dashboard-panel dashboard-panel-small">
                <h3>Distribución por Variedad</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={dashboardData.pieDistribucion} dataKey="value" nameKey="name" outerRadius={92} label>
                        {dashboardData.pieDistribucion.map((entry, index) => (
                          <Cell key={`${entry.name}-${index}`} fill={index === 0 ? '#1B5E20' : '#F9A825'} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <article className="dashboard-panel dashboard-panel-half">
                <h3>Ranking de Productores</h3>
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
                <h3>Eficiencia por Productor</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardData.rendimientoPorProductor} layout="vertical" margin={{ left: 10, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d9e5d7" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="nombre" width={110} />
                      <Tooltip />
                      <Bar dataKey="rendimientoPromedio" fill="#1B5E20" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <article className="dashboard-panel dashboard-panel-large">
                <h3>Producción Acumulada</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dashboardData.produccionAcumulada}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d9e5d7" />
                      <XAxis dataKey="fecha" hide />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="acumulado" stroke="#1B5E20" fill="#1B5E2038" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <article className="dashboard-panel dashboard-panel-side">
                <h3>Mejores Productores</h3>
                <div className="space-y-2">
                  {dashboardData.top5.map((item, idx) => (
                    <div key={item.id} className="rounded-xl border border-[#dce9d8] bg-[#f7fbf5] p-3">
                      <p className="flex items-center gap-2 text-sm font-extrabold text-[#173f1f]">
                        {idx === 0 ? <Crown size={16} color="#F9A825" /> : <Trophy size={16} color="#2E7D32" />}
                        #{idx + 1} {item.nombre}
                      </p>
                      <p className="text-xs text-[#5b7466]">Código: {item.codigo}</p>
                      <p className="text-xs font-bold text-[#1B5E20]">Rendimiento: {item.rendimientoPromedio.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="dashboard-lower-grid">
              <article className="dashboard-panel dashboard-panel-table">
                <h3>Reportes Recientes</h3>
                <div className="overflow-auto">
                  <table className="responsive-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Productor</th>
                        <th>Producción</th>
                        <th>Rendimiento</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.ultimosReportes.map((fila) => (
                        <tr key={fila.id}>
                            <td data-label="Fecha">{fila.fecha}</td>
                            <td data-label="Productor">{fila.productor}</td>
                            <td data-label="Total cajas">{fila.totalCajas}</td>
                            <td data-label="Rendimiento">{fila.rendimiento}</td>
                            <td data-label="Estado">
                            <span className={`estado-pill ${fila.estado.className}`}>{fila.estado.label}</span>
                          </td>
                            <td data-label="Acciones">
                            <button className="ghost" onClick={() => setVista('reportes')}>
                              <FileText size={14} /> Ver
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="dashboard-panel dashboard-panel-side">
                <h3>Indicadores Operativos</h3>
                <div className="dashboard-indicator-list">
                  <div>Promedio diario <strong>{dashboardData.indicadores.promedioDiario.toFixed(2)}</strong></div>
                  <div>Promedio semanal <strong>{dashboardData.indicadores.promedioSemanal.toFixed(2)}</strong></div>
                  <div>Promedio mensual <strong>{dashboardData.indicadores.promedioMensual.toFixed(2)}</strong></div>
                  <div>Mayor producción <strong>{dashboardData.indicadores.mayorProduccion}</strong></div>
                  <div>Menor producción <strong>{dashboardData.indicadores.menorProduccion}</strong></div>
                  <div>Productores activos <strong>{dashboardData.indicadores.productoresActivos}</strong></div>
                  <div>Total reportes <strong>{dashboardData.indicadores.totalReportes}</strong></div>
                </div>
              </article>
            </section>

            <article className="dashboard-panel dashboard-activity-panel">
              <h3>Actividad del Sistema</h3>
              <div className="grid gap-2 md:grid-cols-2">
                {dashboardData.actividad.map((item) => (
                  <motion.div key={item.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="dashboard-activity-item">
                    <p className="text-sm font-bold text-[#1a4a22]">{item.texto}</p>
                    <p className="text-xs text-[#5d7468]">{item.fecha.slice(0, 10)}</p>
                  </motion.div>
                ))}
              </div>
            </article>
          </section>
        ) : null}

        {vista === 'productores' ? (
          <section className="seccion-vista">
            <div className="panel-filtros-productor">
              <div className="barra-busqueda">
                  <input
                    type="search"
                    placeholder="Buscar por código o nombre"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
              </div>
              <div className="filtros-grid-productor">
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
                  Ordenar por
                  <select
                    value={ordenProductores}
                    onChange={(e) => setOrdenProductores(e.target.value as OrdenProductor)}
                  >
                    <option value="nombre">Nombre</option>
                    <option value="codigo">Codigo</option>
                    <option value="creacion">Fecha de creación</option>
                  </select>
                </label>
              </div>
            </div>

            {qProductores.isLoading ? (
              <section className="grid-productores">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <article key={idx} className="tarjeta-productor skeleton" />
                ))}
              </section>
            ) : null}

            {qProductores.isError ? <p className="error-text">No se pudieron cargar productores.</p> : null}

            <section className="grid-productores" onClick={() => setMenuProductorId(null)}>
              {productoresVisibles.map((item) => {
                const resumen = mapaResumenPorProductor.get(item.id)
                return (
                  <article key={item.id} className="tarjeta-productor ficha-productor">
                    <div className="cabecera-tarjeta">
                      <div className="avatar-badge">
                        <UserRound size={16} />
                        {(item.nombre || 'PR').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="ficha-acciones-top" onClick={(e) => e.stopPropagation()}>
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
                        {menuProductorId === item.id ? (
                          <div className="menu-contextual-ficha">
                            <button onClick={() => { abrirProductorDesdeFicha(item); setMenuProductorId(null) }}>
                              <FolderOpen size={14} /> Abrir productor
                            </button>
                            <button onClick={() => { abrirEdicionProductor(item); setMenuProductorId(null) }}>
                              <Pencil size={14} /> Editar productor
                            </button>
                            <button onClick={() => { setConfirmacionEliminar(item); setMenuProductorId(null) }}>
                              <Trash2 size={14} /> Eliminar productor
                            </button>
                            <button onClick={() => { alternarEstado(item); setMenuProductorId(null) }}>
                              {estaActivo(item) ? <Pause size={14} /> : <Play size={14} />}
                              {estaActivo(item) ? 'Desactivar productor' : 'Activar productor'}
                            </button>
                            <button onClick={() => { verHistorialProductor(item); setMenuProductorId(null) }}>
                              <History size={14} /> Ver historial
                            </button>
                            <button onClick={() => { verReportesProductor(item); setMenuProductorId(null) }}>
                              <BarChart3 size={14} /> Ver reportes
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <h3>{item.nombre}</h3>
                    <p>Código: {item.codigo ?? 'N/A'}</p>
                    <p>Rendimiento promedio: {(resumen?.promedio ?? 0).toFixed(2)}</p>
                    <p>Último reporte: {resumen?.ultimaSemana ?? 'Sin registros'}</p>
                    <div className="ficha-abrir-derecha">
                      <button type="button" className="ficha-boton-abrir" onClick={() => abrirProductorDesdeFicha(item)}>
                        <FolderOpen size={14} /> Abrir
                      </button>
                    </div>
                  </article>
                )
              })}
            </section>

            {esAdmin ? (
              <button
                type="button"
                className="fab-productor"
                onClick={() => {
                  resetFormProductor()
                  setModalProductorAbierto(true)
                }}
              >
                <Plus size={20} />
              </button>
            ) : null}
          </section>
        ) : null}

        {vista === 'captura' ? (
          <section className="seccion-vista">
            <article className="encabezado-captura">
              <div>
                <h2>{productorActivo?.nombre ?? 'Productor'}</h2>
                <p>
                  Código: {productorActivo?.codigo ?? 'N/A'} | Semana actual: {getWeekRange(format(ahora, 'yyyy-MM-dd')).weekStart} al {getWeekRange(format(ahora, 'yyyy-MM-dd')).weekEnd}
                </p>
              </div>
              <div className="acciones-linea">
                <button className="ghost" onClick={() => setVista('productores')}>
                  <ArrowLeft size={16} /> Volver
                </button>
              </div>
            </article>

            <section className="grid-captura">
              <article className="tarjeta-panel">
                <h3>{reporteEnEdicion ? 'Editar captura semanal' : detalleEnEdicionId ? 'Editar captura' : 'Nueva captura'}</h3>
                {reporteEnEdicion ? (
                  <div className="acciones-linea acciones-reporte-zona print-hidden">
                    {diasReporteEnEdicion.map((dia) => (
                      <button
                        key={dia.fecha}
                        type="button"
                        className={fechaDetalleSeleccionada === dia.fecha ? '' : 'ghost'}
                        onClick={() => seleccionarDiaEdicion(dia.fecha)}
                        disabled={!dia.detalle}
                        title={dia.detalle ? `Editar ${dia.nombreDia}` : `${dia.nombreDia} sin registro`}
                      >
                        {dia.nombreDia}
                        {dia.detalle ? ` ${format(parseISO(dia.fecha), 'dd/MM')}` : ' Sin registro'}
                      </button>
                    ))}
                  </div>
                ) : null}
                <form className="form-captura" onSubmit={guardarCaptura}>
                  <label>
                    Fecha
                    <input
                      type="date"
                      value={formCaptura.fecha}
                      onChange={(e) => onCambiarCaptura('fecha', e.target.value)}
                      required
                    />
                  </label>

                  <div className="grid-dos">
                    <label>
                      Cestas Americana
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formCaptura.cestas_a}
                        onChange={(e) => onCambiarCaptura('cestas_a', e.target.value)}
                      />
                    </label>
                    <label>
                      Cestas Hindú
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formCaptura.cestas_h}
                        onChange={(e) => onCambiarCaptura('cestas_h', e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="grid-tres">
                    <label>
                      Americana 4kg
                      <input type="text" inputMode="numeric" value={formCaptura.americana_4} onChange={(e) => onCambiarCaptura('americana_4', e.target.value)} />
                    </label>
                    <label>
                      Americana 5kg
                      <input type="text" inputMode="numeric" value={formCaptura.americana_5} onChange={(e) => onCambiarCaptura('americana_5', e.target.value)} />
                    </label>
                    <label>
                      Americana 7kg
                      <input type="text" inputMode="numeric" value={formCaptura.americana_7} onChange={(e) => onCambiarCaptura('americana_7', e.target.value)} />
                    </label>
                  </div>

                  <div className="grid-tres">
                    <label>
                      Hindú 4kg
                      <input type="text" inputMode="numeric" value={formCaptura.hindu_4} onChange={(e) => onCambiarCaptura('hindu_4', e.target.value)} />
                    </label>
                    <label>
                      Hindú 5kg
                      <input type="text" inputMode="numeric" value={formCaptura.hindu_5} onChange={(e) => onCambiarCaptura('hindu_5', e.target.value)} />
                    </label>
                    <label>
                      Hindú 7kg
                      <input type="text" inputMode="numeric" value={formCaptura.hindu_7} onChange={(e) => onCambiarCaptura('hindu_7', e.target.value)} />
                    </label>
                  </div>

                  <label>
                    Observaciones
                    <textarea
                      rows={3}
                      value={formCaptura.observaciones}
                      onChange={(e) => onCambiarCaptura('observaciones', e.target.value)}
                    />
                  </label>

                  <div className="acciones-linea">
                    <button type="submit">
                      <Save size={16} /> {reporteEnEdicion ? 'Guardar cambios' : detalleEnEdicionId ? 'Actualizar' : 'Guardar'}
                    </button>
                    {detalleEnEdicionId || reporteEnEdicion ? (
                      <button type="button" className="ghost" onClick={resetCaptura}>
                        {reporteEnEdicion ? 'Salir de edición' : 'Cancelar'}
                      </button>
                    ) : null}
                  </div>
                </form>
                {retroalimentacion ? <p className="feedback">{retroalimentacion}</p> : null}
              </article>

              <article className="tarjeta-panel">
                <h3>Cálculo en tiempo real</h3>
                <div className="metricas-vivas">
                  <p>Total cajas Americana: <strong>{preview.totalAmericana}</strong></p>
                  <p>Total cajas Hindu: <strong>{preview.totalHindu}</strong></p>
                  <p>Total cajas empacadas: <strong>{preview.totalBoxes}</strong></p>
                  <p>Rendimiento A: <strong>{preview.rendimientoA.toFixed(2)}</strong></p>
                  <p>Rendimiento H: <strong>{preview.rendimientoH.toFixed(2)}</strong></p>
                  <span className={`estado-pill ${estadoPreview.className}`}>{estadoPreview.label}</span>
                </div>
              </article>
            </section>

            <article className="tarjeta-panel print-hidden">
              <h3>Historial semanal del productor</h3>
              <div className="filtros-historial">
                <label>
                  Tipo
                  <select value={filtro} onChange={(e) => setFiltro(e.target.value as FiltroRango)}>
                    <option value="semana">Semanal</option>
                    <option value="mes">Mensual</option>
                    <option value="anio">Anual</option>
                    <option value="personalizado">Personalizado</option>
                    <option value="todo">Todo</option>
                  </select>
                </label>
                {filtro === 'mes' ? (
                  <label>
                    Mes
                    <input type="month" value={mesSeleccionado} onChange={(e) => setMesSeleccionado(e.target.value)} />
                  </label>
                ) : null}
                {filtro === 'anio' ? (
                  <label>
                    Anio
                    <input
                      type="number"
                      min={2020}
                      max={2100}
                      value={anioSeleccionado}
                      onChange={(e) => setAnioSeleccionado(e.target.value.replace(/[^0-9]/g, ''))}
                    />
                  </label>
                ) : null}
                {filtro === 'personalizado' ? (
                  <div className="grid-dos">
                    <label>
                      Desde
                      <input type="date" value={desdePersonalizado} onChange={(e) => setDesdePersonalizado(e.target.value)} />
                    </label>
                    <label>
                      Hasta
                      <input type="date" value={hastaPersonalizado} onChange={(e) => setHastaPersonalizado(e.target.value)} />
                    </label>
                  </div>
                ) : null}
              </div>
              <p className="muted">Mostrando: {TITULOS_FILTRO[filtro]} | Semanas: {reportesFiltrados.length}</p>

              <div className="tabla-wrap">
                <table className="responsive-table">
                  <thead>
                    <tr>
                      <th>Semana</th>
                      <th>Inicio</th>
                      <th>Fin</th>
                      <th>Total cajas</th>
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
                          <td data-label="Total cajas">{total.totalBoxes}</td>
                          <td data-label="Promedio">{promedio.toFixed(2)}</td>
                          <td data-label="Estado"><span className={`estado-pill ${estado.className}`}>{estado.label}</span></td>
                          <td data-label="Acciones" className="acciones-celda">
                            <button className="ghost" onClick={() => setReporteEnFocoId(rep.id)}>Ver</button>
                            <button className="ghost" onClick={() => {
                              setReporteEnFocoId(rep.id)
                              setTimeout(() => {
                                const el = document.getElementById(`hoja-reporte-${rep.id}`)
                                if (el) void exportarReporteEmpaquePNG(el, `reporte-${productorActivo?.nombre ? productorActivo.nombre.toLowerCase().replace(/\s+/g, '-') : 'productor'}-semana-${rep.semana}-${rep.anio}.png`)
                              }, 100)
                            }}>PNG</button>
                            <button className="ghost" onClick={() => abrirEdicionReporte(rep)}><Pencil size={14} /> Editar</button>
                            <button className="danger" onClick={() => eliminarReporte(rep.id)}>Eliminar</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </article>

            <section id="zona-impresion-captura" className="zona-impresion">
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
        ) : null}

        {vista === 'reportes' ? (
          <section className="seccion-vista">
            <article className="tarjeta-panel">
              <h3>Reporte Semanal por Productor</h3>
              <div className="filtros-reportes">
                <label>
                  Productor
                  <select value={productorActivoId} onChange={(e) => setProductorActivoId(e.target.value)}>
                    {productoresActivos.map((item) => (
                      <option key={item.id} value={item.id}>{item.nombre}</option>
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
                  className="export-action-button"
                  onClick={() => {
                    if (!reporteSemanalActivo) return
                    const el = document.getElementById('reporte-empaque-productor') as HTMLElement | null
                    if (el) void exportarReporteEmpaquePDF(el, `reporte-productor-${llaveSemana(obtenerSemanaAnio(fechaReporteProductor).semana, obtenerSemanaAnio(fechaReporteProductor).anio)}.pdf`)
                  }}
                >
                  <Download size={16} /> Exportar PDF
                </button>
                <button
                  className="export-action-button"
                  onClick={() => {
                    if (!reporteSemanalActivo) return
                    exportarReporteEmpaqueExcel(
                      reporteSemanalActivo,
                      productorActivo,
                      `reporte-productor-${llaveSemana(obtenerSemanaAnio(fechaReporteProductor).semana, obtenerSemanaAnio(fechaReporteProductor).anio)}.xlsx`,
                    )
                  }}
                >
                  <Download size={16} /> Exportar Excel
                </button>
                <button
                  className="export-action-button"
                  onClick={() => {
                    if (!reporteSemanalActivo) return
                    const el = document.getElementById('reporte-empaque-productor') as HTMLElement | null
                    if (el) void exportarReporteEmpaquePNG(el, `reporte-productor-${llaveSemana(obtenerSemanaAnio(fechaReporteProductor).semana, obtenerSemanaAnio(fechaReporteProductor).anio)}.png`)
                  }}
                >
                  <Download size={16} /> Exportar PNG
                </button>
                <button
                  className="export-action-button"
                  onClick={() => {
                    if (!reporteSemanalActivo) return
                    exportarCsv(
                      [reporteSemanalActivo],
                      `reporte-productor-${llaveSemana(obtenerSemanaAnio(fechaReporteProductor).semana, obtenerSemanaAnio(fechaReporteProductor).anio)}`,
                    )
                  }}
                >
                  <Download size={16} /> Exportar CSV
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
                <p className="muted">No hay datos para esta semana.</p>
              )}
            </section>

            <article className="tarjeta-panel">
              <h3>Reporte General Semanal</h3>
              <div className="filtros-reportes">
                <label>
                  Semana
                  <input type="date" value={fechaGeneral} onChange={(e) => setFechaGeneral(e.target.value)} />
                </label>
              </div>
              <div className="acciones-linea export-actions">
                <button className="export-action-button" onClick={() => exportarZonaPdf('zona-reporte-general', `reporte-general-${llaveSemana(obtenerSemanaAnio(fechaGeneral).semana, obtenerSemanaAnio(fechaGeneral).anio)}`)}><Download size={16} /> Exportar PDF</button>
                <button className="export-action-button" onClick={() => void exportarZonaPng('zona-reporte-general', `reporte-general-${llaveSemana(obtenerSemanaAnio(fechaGeneral).semana, obtenerSemanaAnio(fechaGeneral).anio)}`)}><Download size={16} /> Exportar PNG</button>
                <button className="export-action-button" onClick={() => exportarExcel((qReportesGlobal.data ?? []).filter((item) => llaveSemana(item.semana, item.anio) === llaveSemana(obtenerSemanaAnio(fechaGeneral).semana, obtenerSemanaAnio(fechaGeneral).anio)), `reporte-general-${llaveSemana(obtenerSemanaAnio(fechaGeneral).semana, obtenerSemanaAnio(fechaGeneral).anio)}`)}><Download size={16} /> Exportar Excel</button>
                <button className="export-action-button" onClick={() => exportarCsv((qReportesGlobal.data ?? []).filter((item) => llaveSemana(item.semana, item.anio) === llaveSemana(obtenerSemanaAnio(fechaGeneral).semana, obtenerSemanaAnio(fechaGeneral).anio)), `reporte-general-${llaveSemana(obtenerSemanaAnio(fechaGeneral).semana, obtenerSemanaAnio(fechaGeneral).anio)}`)}><Download size={16} /> Exportar CSV</button>
              </div>
            </article>

            <section id="zona-reporte-general" className="tarjeta-panel reporte-general-ejecutivo">
              <header className="reporte-general-head">
                <img src="/logoDeereMax.jpeg" alt="DeereMax" />
                <div>
                  <h3>DEEREMAX</h3>
                  <h4>REPORTE GENERAL SEMANAL DE PRODUCTORES</h4>
                  <p>SEMANA {reporteGeneralMeta.semana} DEL AÑO {reporteGeneralMeta.anio}</p>
                  <p className="linea-periodo">PERÍODO DEL {format(parseISO(reporteGeneralMeta.fechaInicio), "d 'de' MMMM 'de' yyyy", { locale: es }).toUpperCase()}</p>
                  <p>AL {format(parseISO(reporteGeneralMeta.fechaFin), "d 'de' MMMM 'de' yyyy", { locale: es }).toUpperCase()}</p>
                  <p className="linea-fecha-generacion">Fecha de generación: {reporteGeneralMeta.fechaGeneracion}</p>
                </div>
              </header>

              <div className="tabla-wrap">
                <table className="responsive-table tabla-general-ejecutiva">
                  <thead>
                    <tr>
                      <th>Productor</th>
                      <th>Total cajas</th>
                      <th>Rendimiento Americana</th>
                      <th>Rendimiento Hindu</th>
                      <th>Estado</th>
                      <th>Total semanal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasGeneralSemanal.map((fila) => (
                      <tr key={fila.id}>
                        <td data-label="Productor">{fila.productor}</td>
                        <td data-label="Total cajas">{fila.totalCajas}</td>
                        <td data-label="Rendimiento Americana">{fila.rendimientoA.toFixed(2)}</td>
                        <td data-label="Rendimiento Hindu">{fila.rendimientoH.toFixed(2)}</td>
                        <td data-label="Estado">{fila.estado}</td>
                        <td data-label="Total semanal">{fila.totalCajas}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th>TOTAL</th>
                      <th>{reporteGeneralMeta.totalCajas}</th>
                      <th colSpan={4}></th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </section>
        ) : null}

        {vista === 'admin' ? (
          <section className="seccion-vista">
            <article className="tarjeta-panel">
              <h3>Administración de Productores</h3>
              <p className="muted">Gestion completa de productores desde la aplicacion web.</p>
              <div className="acciones-linea acciones-admin-top">
                <button
                  className="btn-nuevo-productor"
                  onClick={() => {
                    resetFormProductor()
                    setModalProductorAbierto(true)
                  }}
                >
                  <Plus size={16} /> Nuevo Productor
                </button>
              </div>
            </article>

            <article className="tarjeta-panel">
              <div className="panel-filtros-productor">
                <div className="barra-busqueda">
                  <input
                    type="search"
                    placeholder="Buscar por codigo o nombre"
                    value={busquedaAdmin}
                    onChange={(e) => setBusquedaAdmin(e.target.value)}
                  />
                </div>
                <div className="filtros-grid-productor">
                  <label>
                    Estado
                    <select
                      value={filtroEstadoAdmin}
                      onChange={(e) => setFiltroEstadoAdmin(e.target.value as FiltroEstadoProductor)}
                    >
                      <option value="todos">Todos</option>
                      <option value="activos">Activos</option>
                      <option value="inactivos">Inactivos</option>
                    </select>
                  </label>
                  <label>
                    Ordenar por
                    <select value={ordenAdmin} onChange={(e) => setOrdenAdmin(e.target.value as OrdenProductor)}>
                      <option value="nombre">Nombre</option>
                      <option value="codigo">Codigo</option>
                      <option value="creacion">Fecha de creacion</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="tabla-wrap tabla-admin-productores">
                <table className="responsive-table">
                  <thead>
                    <tr>
                      <th>Codigo</th>
                      <th>Nombre</th>
                      <th>Telefono</th>
                      <th>N° Cuenta Bancaria</th>
                      <th>Sector</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productoresAdminVisibles.map((item) => (
                      <tr key={item.id}>
                        <td data-label="Codigo">{item.codigo ?? 'N/A'}</td>
                        <td data-label="Nombre">{item.nombre}</td>
                        <td data-label="Telefono">{item.telefono ?? 'N/A'}</td>
                        <td data-label="N° Cuenta Bancaria">{item.finca ?? 'N/A'}</td>
                        <td data-label="Sector">{item.sector ?? 'N/A'}</td>
                        <td data-label="Estado">
                          <span className={`estado-pill ${estaActivo(item) ? 'estado-bueno' : 'estado-bajo'}`}>
                            {estaActivo(item) ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td data-label="Acciones" className="acciones-celda">
                          <button className="ghost" onClick={() => abrirProductorDesdeFicha(item)}>
                            <FolderOpen size={14} /> Abrir
                          </button>
                          <button className="ghost" onClick={() => abrirEdicionProductor(item)}>
                            <Pencil size={14} /> Editar
                          </button>
                          <button className="danger" onClick={() => setConfirmacionEliminar(item)}>
                            <Trash2 size={14} /> Eliminar
                          </button>
                          <button className="ghost" onClick={() => alternarEstado(item)}>
                            <Power size={14} /> {estaActivo(item) ? 'Desactivar' : 'Activar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        ) : null}
      </main>

      {modalProductorAbierto ? (
        <div className="overlay-modal print-hidden" onClick={() => setModalProductorAbierto(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{formProductor.id ? 'Editar productor' : 'Nuevo productor'}</h3>
              <button className="ghost" onClick={() => setModalProductorAbierto(false)}>
                <X size={16} />
              </button>
            </div>
            <form className="modal-form" onSubmit={guardarFormularioProductor}>
              <label>
                Codigo
                <input
                  type="text"
                  maxLength={10}
                  value={formProductor.codigo}
                  readOnly
                />
              </label>
              <label>
                Nombre
                <input
                  type="text"
                  maxLength={120}
                  value={formProductor.nombre}
                  onChange={(e) => setFormProductor((prev) => ({ ...prev, nombre: e.target.value.toUpperCase() }))}
                  required
                />
              </label>
              <label>
                Telefono
                <input
                  type="text"
                  maxLength={60}
                  value={formProductor.telefono}
                  onChange={(e) => setFormProductor((prev) => ({ ...prev, telefono: e.target.value }))}
                />
              </label>
              <label>
                N° Cuenta Bancaria
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
                  rows={3}
                  value={formProductor.observaciones}
                  onChange={(e) => setFormProductor((prev) => ({ ...prev, observaciones: e.target.value }))}
                />
              </label>
              <label>
                Activo
                <select
                  value={formProductor.activo ? 'true' : 'false'}
                  onChange={(e) =>
                    setFormProductor((prev) => ({ ...prev, activo: e.target.value === 'true' }))
                  }
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </label>
              <div className="acciones-linea">
                <button type="submit"><Save size={16} /> Guardar</button>
                <button type="button" className="ghost" onClick={() => { setModalProductorAbierto(false); resetFormProductor() }}>
                  <X size={16} /> Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {confirmacionEliminar ? (
        <div className="overlay-modal print-hidden" onClick={() => setConfirmacionEliminar(null)}>
          <div className="modal modal-confirmacion" onClick={(e) => e.stopPropagation()}>
            <h3>Confirmar eliminacion</h3>
            <p>
              ¿Esta seguro de eliminar este productor?
              <br />
              <strong>{confirmacionEliminar.nombre}</strong>
            </p>
            <div className="acciones-linea">
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
      ) : null}

      {toast ? (
        <div className={`toast ${toast.kind === 'success' ? 'toast-ok' : 'toast-error'}`}>
          {toast.kind === 'success' ? 'Exito' : 'Error'}: {toast.text}
        </div>
      ) : null}

      {mostrarGuiaInstalacion && !esAppInstalada ? (
        <div className="guia-instalacion print-hidden" role="status" aria-live="polite">
          <div>
            <strong>Instalar DeereMax</strong>
            {esIos ? (
              <p>En iPhone: toque Compartir y luego Agregar a pantalla de inicio.</p>
            ) : (
              <p>En Chrome o Edge: abra el menu del navegador y seleccione Instalar aplicación.</p>
            )}
          </div>
          <button className="ghost" onClick={() => setMostrarGuiaInstalacion(false)}>Cerrar</button>
        </div>
      ) : null}
    </div>
  )
}

export default App

