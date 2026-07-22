import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Download } from 'lucide-react'
import type { Productor, Reporte } from '../types'
import { computeDailyTotals, computeWeeklyTotals, weeklyRendimiento } from '../utils/report'
import { exportarReporteEmpaquePNG } from '../services/reporteEmpaque'
import { Logo } from './Logo'

type Props = {
  reporte: Reporte
  productor?: Productor | null
  id?: string
  className?: string
  mostrarAccionExportarPNG?: boolean
}

export function ReporteEmpaque({
  reporte,
  productor,
  id,
  className,
  mostrarAccionExportarPNG = false,
}: Props) {
  const total = computeWeeklyTotals(reporte)
  const rend = weeklyRendimiento(reporte)
  const fechaGeneracion = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })
  const periodoDesde = format(parseISO(reporte.fecha_inicio), "d 'de' MMMM 'de' yyyy", { locale: es })
  const periodoHasta = format(parseISO(reporte.fecha_fin), "d 'de' MMMM 'de' yyyy", { locale: es })
  const observaciones = reporte.detalle_reporte
    .map((detalle) => ({
      id: detalle.id,
      fecha: detalle.fecha,
      texto: detalle.observaciones?.trim() ?? '',
    }))
    .filter((item) => item.texto.length > 0)
  const totalPorCalibre = reporte.detalle_reporte.reduce(
    (acc, detalle) => ({
      a4: acc.a4 + detalle.americana_4,
      a5: acc.a5 + detalle.americana_5,
      a7: acc.a7 + detalle.americana_7,
      h4: acc.h4 + detalle.hindu_4,
      h5: acc.h5 + detalle.hindu_5,
      h7: acc.h7 + detalle.hindu_7,
    }),
    { a4: 0, a5: 0, a7: 0, h4: 0, h5: 0, h7: 0 },
  )

  const handleExportarPNG = () => {
    const el = id ? document.getElementById(id) : null
    if (!el) return
    const prodSlug = productor?.nombre ? productor.nombre.toLowerCase().replace(/\s+/g, '-') : 'productor'
    const nombreFile = `reporte-${prodSlug}-semana-${reporte.semana}-${reporte.anio}.png`
    void exportarReporteEmpaquePNG(el, nombreFile)
  }

  return (
    <article id={id} className={['hoja-reporte', 'reporte-empaque', className].filter(Boolean).join(' ')}>
      {mostrarAccionExportarPNG ? (
        <div className="acciones-linea acciones-reporte-zona print-hidden">
          <button type="button" className="export-action-button" onClick={handleExportarPNG}>
            <Download size={16} /> Exportar PNG
          </button>
        </div>
      ) : null}

      <header className="cabecera-hoja cabecera-excel">
        <Logo alt="DeereMax" />
        <div className="datos-cabecera-excel">
          <h3>DEEREMAX</h3>
          <p className="titulo-reporte-principal">REPORTE DE EMPAQUE</p>
          <p>
            <strong>PRODUCTOR:</strong> {(productor?.nombre ?? 'N/A').toUpperCase()}
          </p>
          <p>
            <strong>CÓDIGO:</strong> {(productor?.codigo ?? 'N/A').toUpperCase()}
          </p>
          <p className="titulo-semana-excel">SEMANA {reporte.semana} DEL AÑO {reporte.anio}</p>
          <p className="titulo-semana-excel">
            PERÍODO DEL {periodoDesde.toUpperCase()}
          </p>
          <p className="titulo-semana-excel">
            AL {periodoHasta.toUpperCase()}
          </p>
          <p className="fecha-generacion-reporte">
            Fecha de generación: {fechaGeneracion}
          </p>
        </div>
      </header>

      <div className="tabla-excel-wrap">
        <table className="tabla-excel">
        <thead>
          <tr className="tabla-excel-head-l1">
            <th rowSpan={2} colSpan={1}>DESCRIPCIÓN</th>
            <th colSpan={8}>EMPAQUE</th>
            <th rowSpan={2} colSpan={2}>RENDIMIENTO</th>
          </tr>
          <tr className="tabla-excel-head-l2">
            <th colSpan={2}>CESTAS</th>
            <th colSpan={3}>CAJAS DE AMERICANA</th>
            <th colSpan={3}>CAJAS DE HINDÚ</th>
          </tr>
          <tr className="tabla-excel-head-l3">
            <th>FECHA</th>
            <th>A</th>
            <th>H</th>
            <th>A-4KG</th>
            <th>A-5KG</th>
            <th>A-7KG</th>
            <th>H-4KG</th>
            <th>H-5KG</th>
            <th>H-7KG</th>
            <th>A</th>
            <th>H</th>
          </tr>
        </thead>
        <tbody>
          {reporte.detalle_reporte.map((detalle) => {
            const calc = computeDailyTotals(detalle)
            return (
              <tr key={detalle.id}>
                <td>{format(parseISO(detalle.fecha), 'dd-MMM-yy', { locale: es })}</td>
                <td>{detalle.cestas_a}</td>
                <td>{detalle.cestas_h}</td>
                <td>{detalle.americana_4}</td>
                <td>{detalle.americana_5}</td>
                <td>{detalle.americana_7}</td>
                <td>{detalle.hindu_4}</td>
                <td>{detalle.hindu_5}</td>
                <td>{detalle.hindu_7}</td>
                <td>{calc.rendimientoA.toFixed(2).replace('.', ',')}</td>
                <td>{calc.rendimientoH.toFixed(2).replace('.', ',')}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <th>TOTAL</th>
            <th>{total.cestasA}</th>
            <th>{total.cestasH}</th>
            <th>{totalPorCalibre.a4}</th>
            <th>{totalPorCalibre.a5}</th>
            <th>{totalPorCalibre.a7}</th>
            <th>{totalPorCalibre.h4}</th>
            <th>{totalPorCalibre.h5}</th>
            <th>{totalPorCalibre.h7}</th>
            <th>{rend.rendimientoA.toFixed(2).replace('.', ',')}</th>
            <th>{rend.rendimientoH.toFixed(2).replace('.', ',')}</th>
          </tr>
        </tfoot>
        </table>
      </div>

      <div className="total-empacado-excel">
        <span>TOTAL DE CAJAS EMPACADAS</span>
        <strong>{total.totalBoxes}</strong>
      </div>

      {observaciones.length > 0 ? (
        <section className="observaciones-reporte">
          <h4>Observaciones</h4>
          <ul>
            {observaciones.map((item) => (
              <li key={item.id}>
                <strong>{format(parseISO(item.fecha), 'dd-MMM-yy', { locale: es })}:</strong> {item.texto}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  )
}
