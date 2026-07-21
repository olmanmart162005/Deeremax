import jsPDF from 'jspdf'
import { toJpeg, toPng } from 'html-to-image'
import * as XLSX from 'xlsx'

export const exportRowsToCsv = (rows: string[][], fileName: string) => {
  const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export const exportRowsToExcel = (
  rows: Array<Record<string, string | number>>,
  fileName: string,
  sheetName = 'Reportes',
) => {
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, fileName)
}

export const exportElementToImage = async (element: HTMLElement, fileName: string) => {
  const dataUrl = await toJpeg(element, {
    cacheBust: true,
    backgroundColor: '#ffffff',
    quality: 0.96,
    pixelRatio: 2,
  })
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  link.click()
}

export const exportElementToPdf = async (element: HTMLElement, fileName: string) => {
  const imageData = await toPng(element, {
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
  img.src = imageData
  await new Promise((resolve) => {
    img.onload = resolve
  })

  const renderHeight = (img.height * renderWidth) / img.width

  if (renderHeight <= pdfHeight - margin * 2) {
    pdf.addImage(imageData, 'PNG', margin, margin, renderWidth, renderHeight)
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

      const pageImage = pageCanvas.toDataURL('image/png')
      if (page > 0) pdf.addPage()

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
