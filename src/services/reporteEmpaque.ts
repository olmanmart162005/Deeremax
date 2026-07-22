import ExcelJS from 'exceljs'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import type { Productor, Reporte } from '../types'
import { computeDailyTotals, computeWeeklyTotals, weeklyRendimiento } from '../utils/report'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const blobToBase64 = async (blob: Blob) => {
  const arrayBuffer = await blob.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(arrayBuffer)
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

const cargarLogoBase64 = async () => {
  const response = await fetch('/logoDeereMax.jpeg')
  const blob = await response.blob()
  return blobToBase64(blob)
}

const filterNoButtons = (node: Node) => {
  if (node instanceof HTMLElement) {
    if (
      node.classList.contains('print-hidden') ||
      node.classList.contains('acciones-linea') ||
      node.tagName === 'BUTTON'
    ) {
      return false
    }
  }
  return true
}

const esperarSiguienteFrame = () => new Promise<void>((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
})

const esperarImagenes = async (element: HTMLElement) => {
  const imagenes = Array.from(element.querySelectorAll('img'))
  await Promise.all(
    imagenes.map((img) => {
      if (img.complete) return Promise.resolve()
      return new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true })
        img.addEventListener('error', () => resolve(), { once: true })
      })
    }),
  )
}

const EXPORT_DESKTOP_WIDTH = 1400
const EXPORT_PADDING = 28
const EXPORT_SCALE = 4
const PNG_TARGET_WIDTH = 3508
const PNG_TARGET_HEIGHT = 2480
const CAPTURE_BUFFER = 8
const EXPORT_BOTTOM_MARGIN = 24

const prepararClonParaCaptura = (element: HTMLElement) => {
  const host = document.createElement('div')
  host.style.position = 'absolute'
  host.style.left = '-99999px'
  host.style.top = '0'
  host.style.background = '#ffffff'
  host.style.padding = `${EXPORT_PADDING}px`
  host.style.overflow = 'visible'
  host.style.width = 'max-content'
  host.style.minWidth = `${EXPORT_DESKTOP_WIDTH}px`
  host.style.zIndex = '-1'
  host.style.pointerEvents = 'none'

  const clone = element.cloneNode(true) as HTMLElement
  clone.removeAttribute('id')
  clone.dataset.exportMode = 'desktop'
  clone.style.overflow = 'visible'
  clone.style.width = `${EXPORT_DESKTOP_WIDTH}px`
  clone.style.minWidth = `${EXPORT_DESKTOP_WIDTH}px`
  clone.style.maxWidth = `${EXPORT_DESKTOP_WIDTH}px`
  clone.style.transform = 'none'

  const nodos = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))]

  nodos.forEach((node) => {
    const computed = window.getComputedStyle(node)

    if (computed.overflow === 'hidden' || computed.overflowX === 'hidden' || computed.overflowY === 'hidden') {
      node.style.overflow = 'visible'
    }

    if (computed.maxWidth !== 'none') {
      node.style.maxWidth = 'none'
    }

    if (computed.transform && computed.transform !== 'none') {
      node.style.transform = 'none'
    }

    node.style.transition = 'none'
    node.style.animation = 'none'

    if (node.classList.contains('tabla-excel-wrap')) {
      node.style.overflow = 'visible'
      node.style.width = `${EXPORT_DESKTOP_WIDTH - EXPORT_PADDING * 2}px`
      node.style.maxWidth = 'none'
      node.style.minWidth = '0'
      node.scrollLeft = 0
    }

    if (node.classList.contains('tabla-excel')) {
      node.style.width = 'max-content'
      node.style.maxWidth = 'none'
      node.style.minWidth = '100%'
    }

    if (node.classList.contains('cabecera-hoja')) {
      node.style.display = 'flex'
      node.style.flexDirection = 'row'
      node.style.alignItems = 'center'
      node.style.textAlign = 'left'
      node.style.gap = '16px'
    }

    if (node.classList.contains('hoja-reporte') || node.classList.contains('reporte-empaque')) {
      node.style.width = `${EXPORT_DESKTOP_WIDTH}px`
      node.style.minWidth = `${EXPORT_DESKTOP_WIDTH}px`
      node.style.maxWidth = `${EXPORT_DESKTOP_WIDTH}px`
      node.style.overflow = 'visible'
    }
  })

  host.appendChild(clone)

  // Keep an explicit blank space after the report to avoid clipping the bottom border.
  const bottomSpacer = document.createElement('div')
  bottomSpacer.style.height = `${EXPORT_BOTTOM_MARGIN}px`
  bottomSpacer.style.width = '100%'
  bottomSpacer.style.pointerEvents = 'none'
  host.appendChild(bottomSpacer)

  document.body.appendChild(host)

  const limpiar = () => {
    host.remove()
  }

  return { host, limpiar }
}

const capturarCanvasCompleto = async (element: HTMLElement, scale = 4) => {
  if ('fonts' in document) {
    await (document as Document & { fonts: FontFaceSet }).fonts.ready
  }

  const { host, limpiar } = prepararClonParaCaptura(element)

  await esperarImagenes(host)
  await esperarSiguienteFrame()
  await esperarSiguienteFrame()

  const width = Math.ceil(Math.max(host.scrollWidth, host.getBoundingClientRect().width) + CAPTURE_BUFFER)
  const height = Math.ceil(Math.max(host.scrollHeight, host.getBoundingClientRect().height) + CAPTURE_BUFFER)

  try {
    return await html2canvas(host, {
      backgroundColor: '#ffffff',
      scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      width,
      height,
      windowWidth: Math.max(width, EXPORT_DESKTOP_WIDTH),
      windowHeight: Math.max(height, 1200),
      scrollX: 0,
      scrollY: 0,
      ignoreElements: (node) => !filterNoButtons(node),
    })
  } finally {
    limpiar()
  }
}

const prepararCanvasAltaResolucion = (sourceCanvas: HTMLCanvasElement) => {
  const upscaleFactor = Math.max(
    1,
    PNG_TARGET_WIDTH / sourceCanvas.width,
    PNG_TARGET_HEIGHT / sourceCanvas.height,
  )

  const scaledWidth = Math.ceil(sourceCanvas.width * upscaleFactor)
  const scaledHeight = Math.ceil(sourceCanvas.height * upscaleFactor)

  const canvas = document.createElement('canvas')
  canvas.width = scaledWidth
  canvas.height = scaledHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) return sourceCanvas

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(sourceCanvas, 0, 0, scaledWidth, scaledHeight)

  return canvas
}

export const exportarReporteEmpaquePNG = async (element: HTMLElement, fileName: string) => {
  const captured = await capturarCanvasCompleto(element, EXPORT_SCALE)
  const canvas = prepararCanvasAltaResolucion(captured)
  const dataUrl = canvas.toDataURL('image/png', 1)
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  link.click()
}

export const exportarReporteEmpaqueJPG = async (element: HTMLElement, fileName: string) => {
  const captured = await capturarCanvasCompleto(element, EXPORT_SCALE)
  const canvas = prepararCanvasAltaResolucion(captured)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.98)
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  link.click()
}

export const exportarReporteEmpaquePDF = async (element: HTMLElement, fileName: string) => {
  const sourceCaptured = await capturarCanvasCompleto(element, EXPORT_SCALE)
  const sourceCanvas = prepararCanvasAltaResolucion(sourceCaptured)
  const image = sourceCanvas.toDataURL('image/png', 1)

  const pdf = new jsPDF('l', 'mm', 'a4')
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()
  const margin = 10
  const renderWidth = pdfWidth - margin * 2
  const renderHeightLimit = pdfHeight - margin * 2

  const ratio = sourceCanvas.width / sourceCanvas.height
  let drawWidth = renderWidth
  let drawHeight = drawWidth / ratio

  if (drawHeight > renderHeightLimit) {
    drawHeight = renderHeightLimit
    drawWidth = drawHeight * ratio
  }

  const x = (pdfWidth - drawWidth) / 2
  const y = (pdfHeight - drawHeight) / 2
  pdf.addImage(image, 'PNG', x, y, drawWidth, drawHeight)

  pdf.save(fileName)
}

export const exportarReporteEmpaqueExcel = async (
  reporte: Reporte,
  productor: Productor | null | undefined,
  fileName: string,
) => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Reporte')
  const logoBase64 = await cargarLogoBase64()
  const logoId = workbook.addImage({ base64: logoBase64, extension: 'jpeg' })

  worksheet.properties.defaultRowHeight = 20
  worksheet.views = [{ showGridLines: false }]
  worksheet.pageSetup = {
    orientation: 'portrait',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.3, right: 0.3, top: 0.35, bottom: 0.35, header: 0.2, footer: 0.2 },
  }

  worksheet.columns = [
    { width: 14 },
    { width: 8 },
    { width: 8 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
  ]

  worksheet.mergeCells('A1:B4')
  worksheet.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 120, height: 78 } })

  worksheet.mergeCells('C1:K1')
  worksheet.getCell('C1').value = 'DEEREMAX'
  worksheet.getCell('C1').font = { bold: true, size: 12 }
  worksheet.getCell('C1').alignment = { horizontal: 'center', vertical: 'middle' }

  worksheet.mergeCells('C2:K2')
  worksheet.getCell('C2').value = `PROD: ${productor?.nombre ?? 'N/A'}`
  worksheet.getCell('C2').font = { bold: true, size: 10 }
  worksheet.getCell('C2').alignment = { horizontal: 'center', vertical: 'middle' }

  worksheet.mergeCells('C3:K3')
  worksheet.getCell('C3').value = `CÓDIGO: ${productor?.codigo ?? 'N/A'}`
  worksheet.getCell('C3').font = { bold: true, size: 10 }
  worksheet.getCell('C3').alignment = { horizontal: 'center', vertical: 'middle' }

  worksheet.mergeCells('C4:K4')
  worksheet.getCell('C4').value = `REPORTE DE EMPAQUE / SEMANA DEL ${format(parseISO(reporte.fecha_inicio), "d 'DE' MMMM 'DEL' yyyy", { locale: es }).toUpperCase()} AL ${format(parseISO(reporte.fecha_fin), "d 'DE' MMMM 'DEL' yyyy", { locale: es }).toUpperCase()}`
  worksheet.getCell('C4').font = { bold: true, size: 10 }
  worksheet.getCell('C4').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }

  const headerRows = [
    ['DESCRIPCION', '', '', 'EMPAQUE', '', '', '', '', '', 'RENDIMIENTO', ''],
    ['', 'CESTAS', '', 'CAJAS DE AMERICANA', '', '', 'CAJAS DE HINDÚ', '', '', 'A', 'H'],
    ['FECHA', 'A', 'H', 'A-4KG', 'A-5KG', 'A-7KG', 'H-4KG', 'H-5KG', 'H-7KG', 'A', 'H'],
  ]

  headerRows.forEach((rowValues, index) => {
    const row = worksheet.getRow(6 + index)
    rowValues.forEach((value, colIndex) => {
      const cell = row.getCell(colIndex + 1)
      if (value) cell.value = value
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.font = { bold: true, size: 10 }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: index === 0 ? 'FF53B335' : 'FF61C038' },
      }
    })
  })

  const startRow = 9
  reporte.detalle_reporte.forEach((detalle, idx) => {
    const row = worksheet.getRow(startRow + idx)
    const calc = computeDailyTotals(detalle)
    row.values = [
      format(parseISO(detalle.fecha), 'dd-MMM-yy', { locale: es }),
      detalle.cestas_a,
      detalle.cestas_h,
      detalle.americana_4,
      detalle.americana_5,
      detalle.americana_7,
      detalle.hindu_4,
      detalle.hindu_5,
      detalle.hindu_7,
      Number(calc.rendimientoA.toFixed(2)),
      Number(calc.rendimientoH.toFixed(2)),
    ]
    row.eachCell((cell) => {
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F1F1' } }
    })
  })

  const totalsRowIndex = startRow + reporte.detalle_reporte.length
  const total = computeWeeklyTotals(reporte)
  const rend = weeklyRendimiento(reporte)
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

  const totalsRow = worksheet.getRow(totalsRowIndex)
  totalsRow.values = [
    'TOTAL',
    total.cestasA,
    total.cestasH,
    totalPorCalibre.a4,
    totalPorCalibre.a5,
    totalPorCalibre.a7,
    totalPorCalibre.h4,
    totalPorCalibre.h5,
    totalPorCalibre.h7,
    Number(rend.rendimientoA.toFixed(2)),
    Number(rend.rendimientoH.toFixed(2)),
  ]
  totalsRow.eachCell((cell) => {
    cell.font = { bold: true }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0C215' } }
  })

  const cajasRow = worksheet.getRow(totalsRowIndex + 2)
  worksheet.mergeCells(`A${totalsRowIndex + 2}:F${totalsRowIndex + 2}`)
  cajasRow.getCell(1).value = 'TOTAL DE CAJAS EMPACADAS'
  cajasRow.getCell(1).font = { bold: true }
  cajasRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
  cajasRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0C215' } }
  cajasRow.getCell(1).border = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  }
  cajasRow.getCell(7).value = total.totalBoxes
  cajasRow.getCell(7).font = { bold: true }
  cajasRow.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' }
  cajasRow.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0C215' } }
  cajasRow.getCell(7).border = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  }

  await workbook.xlsx.writeBuffer().then((buffer) => {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    URL.revokeObjectURL(url)
  })
}
