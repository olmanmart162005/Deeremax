import ExcelJS from 'exceljs'
import { toPng, toJpeg } from 'html-to-image'
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

export const exportarReporteEmpaquePNG = async (element: HTMLElement, fileName: string) => {
  const dataUrl = await toPng(element, {
    cacheBust: true,
    backgroundColor: '#ffffff',
    pixelRatio: 2,
    filter: filterNoButtons,
  })
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  link.click()
}

export const exportarReporteEmpaqueJPG = async (element: HTMLElement, fileName: string) => {
  const dataUrl = await toJpeg(element, {
    cacheBust: true,
    backgroundColor: '#ffffff',
    quality: 0.96,
    pixelRatio: 2,
    filter: filterNoButtons,
  })
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  link.click()
}

export const exportarReporteEmpaquePDF = async (element: HTMLElement, fileName: string) => {
  const image = await toPng(element, {
    cacheBust: true,
    backgroundColor: '#ffffff',
    pixelRatio: 2,
  })

  const pdf = new jsPDF('p', 'mm', 'a4')
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()
  const margin = 8
  const renderWidth = pdfWidth - margin * 2

  const img = new Image()
  img.src = image
  await new Promise((resolve) => {
    img.onload = resolve
  })

  const renderHeight = (img.height * renderWidth) / img.width
  if (renderHeight <= pdfHeight - margin * 2) {
    pdf.addImage(image, 'PNG', margin, margin, renderWidth, renderHeight)
  } else {
    const pageCanvas = document.createElement('canvas')
    const pageCtx = pageCanvas.getContext('2d')
    if (!pageCtx) return

    const pxPerMm = img.width / renderWidth
    const pageHeightPx = Math.floor((pdfHeight - margin * 2) * pxPerMm)
    pageCanvas.width = img.width
    pageCanvas.height = pageHeightPx

    let offsetY = 0
    let page = 0

    while (offsetY < img.height) {
      pageCtx.clearRect(0, 0, pageCanvas.width, pageCanvas.height)
      pageCtx.drawImage(img, 0, offsetY, img.width, pageHeightPx, 0, 0, img.width, pageHeightPx)

      if (page > 0) pdf.addPage()
      const pageImage = pageCanvas.toDataURL('image/png')
      const remainingPx = img.height - offsetY
      const currentPagePx = Math.min(pageHeightPx, remainingPx)
      const currentHeightMm = currentPagePx / pxPerMm
      pdf.addImage(pageImage, 'PNG', margin, margin, renderWidth, currentHeightMm)

      offsetY += pageHeightPx
      page += 1
    }
  }

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
