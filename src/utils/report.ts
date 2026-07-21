import { endOfWeek, format, parseISO, startOfWeek } from 'date-fns'
import type { DetalleReporte, EntryFormState, Reporte } from '../types'

export const toNumber = (value: string | number | null | undefined) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (!value) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const getWeekRange = (entryDate: string) => {
  const parsed = parseISO(entryDate)
  const start = startOfWeek(parsed, { weekStartsOn: 4 })
  const end = endOfWeek(parsed, { weekStartsOn: 4 })
  return {
    weekStart: format(start, 'yyyy-MM-dd'),
    weekEnd: format(end, 'yyyy-MM-dd'),
  }
}

export const getInitialFormState = (): EntryFormState => ({
  fecha: format(new Date(), 'yyyy-MM-dd'),
  cestas_a: '',
  cestas_h: '',
  americana_4: '',
  americana_5: '',
  americana_7: '',
  hindu_4: '',
  hindu_5: '',
  hindu_7: '',
  observaciones: '',
})

export const computeDailyTotals = (entry: Pick<DetalleReporte, 'americana_4' | 'americana_5' | 'americana_7' | 'hindu_4' | 'hindu_5' | 'hindu_7' | 'cestas_a' | 'cestas_h'>) => {
  const totalAmericana = entry.americana_4 + entry.americana_5 + entry.americana_7
  const totalHindu = entry.hindu_4 + entry.hindu_5 + entry.hindu_7
  const totalBoxes = totalAmericana + totalHindu
  const rendimientoA = entry.cestas_a > 0 ? totalAmericana / entry.cestas_a : 0
  const rendimientoH = entry.cestas_h > 0 ? totalHindu / entry.cestas_h : 0

  return {
    totalAmericana,
    totalHindu,
    totalBoxes,
    rendimientoA,
    rendimientoH,
  }
}

export const computeWeeklyTotals = (report: Reporte) => {
  return report.detalle_reporte.reduce(
    (acc, entry) => {
      const totals = computeDailyTotals(entry)
      return {
        cestasA: acc.cestasA + entry.cestas_a,
        cestasH: acc.cestasH + entry.cestas_h,
        totalAmericana: acc.totalAmericana + totals.totalAmericana,
        totalHindu: acc.totalHindu + totals.totalHindu,
        totalBoxes: acc.totalBoxes + totals.totalBoxes,
      }
    },
    {
      cestasA: 0,
      cestasH: 0,
      totalAmericana: 0,
      totalHindu: 0,
      totalBoxes: 0,
    },
  )
}

export const weeklyRendimiento = (report: Reporte) => {
  const weekly = computeWeeklyTotals(report)
  return {
    rendimientoA: weekly.cestasA > 0 ? weekly.totalAmericana / weekly.cestasA : 0,
    rendimientoH: weekly.cestasH > 0 ? weekly.totalHindu / weekly.cestasH : 0,
  }
}

