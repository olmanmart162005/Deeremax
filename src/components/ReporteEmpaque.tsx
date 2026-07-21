import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { FileImage, Printer } from 'lucide-react'
import type { Productor, Reporte } from '../types'
import { computeDailyTotals, computeWeeklyTotals, weeklyRendimiento } from '../utils/report'
import { exportarReporteEmpaquePNG } from '../services/reporteEmpaque'

type Props = {
  reporte: Reporte
  productor?: Productor | null
  id?: string
  className?: string
  mostrarAccionImprimir?: boolean
  onImprimir?: () => void
  onExportarPNG?: () => void
}

export function ReporteEmpaque({
  reporte,
  productor,
  id,
  className,
  mostrarAccionImprimir = false,
  onImprimir,
  onExportarPNG,
}: Props) {
  const total = computeWeeklyTotals(reporte)
  const rend = weeklyRendimiento(reporte)
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
    if (onExportarPNG) {
      onExportarPNG()
      return
    }
    const el = id ? document.getElementById(id) : null
    if (el) {
      const prodSlug = productor?.nombre ? productor.nombre.toLowerCase().replace(/\s+/g, '-') : 'productor'
      const nombreFile = `reporte-${prodSlug}-semana-${reporte.semana}-${reporte.anio}.png`
      void exportarReporteEmpaquePNG(el, nombreFile)
    }
  }

  return (
    <article id={id} className={['hoja-reporte', 'reporte-empaque', className].filter(Boolean).join(' ')}>
      {mostrarAccionImprimir ? (
        <div className="acciones-linea acciones-reporte-zona print-hidden">
          <button type="button" className="ghost" onClick={handleExportarPNG}>
            <FileImage size={16} /> Exportar PNG
          </button>
          {onImprimir ? (
            <button type="button" onClick={onImprimir}>
              <Printer size={16} /> Imprimir reporte
            </button>
          ) : null}
        </div>
      ) : null}

      <header className="cabecera-hoja cabecera-excel">
        <img src="/logoDeereMax.jpeg" alt="DeereMax" />
        <div className="datos-cabecera-excel">
          <h3>DEEREMAX</h3>
          <p>
            <strong>PROD:</strong> {(productor?.nombre ?? 'N/A').toUpperCase()}
          </p>
          <p>
            <strong>CÓDIGO:</strong> {(productor?.codigo ?? 'N/A').toUpperCase()}
          </p>
          <p className="titulo-semana-excel">
            REPORTE DE EMPAQUE / SEMANA DEL{' '}
            {format(parseISO(reporte.fecha_inicio), "d 'DE' MMMM 'DEL' yyyy", { locale: es }).toUpperCase()}{' '}
            AL{' '}
            {format(parseISO(reporte.fecha_fin), "d 'DE' MMMM 'DEL' yyyy", { locale: es }).toUpperCase()}
          </p>
        </div>
      </header>

      <div className="tabla-excel-wrap">
        <table className="tabla-excel">
        <thead>
          <tr>
            <th colSpan={1}>DESCRIPCION</th>
            <th colSpan={8}>EMPAQUE</th>
            <th colSpan={2}>RENDIMIENTO</th>
          </tr>
          <tr>
            <th></th>
            <th colSpan={2}>CESTAS</th>
            <th colSpan={3}>CAJAS DE AMERICANA</th>
            <th colSpan={3}>CAJAS DE HINDÚ</th>
            <th colSpan={1}>A</th>
            <th colSpan={1}>H</th>
          </tr>
          <tr>
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
