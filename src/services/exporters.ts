import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import { capturarElementoPngCanvas, exportElementToPng } from './exportPng'

export { exportElementToPng }

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
  await exportElementToPng(element, fileName)
}

export const exportElementToPdf = async (element: HTMLElement, fileName: string) => {
  const canvas = await capturarElementoPngCanvas(element, { scale: 3 })
  const imageData = canvas.toDataURL('image/png', 1)

  const pdf = new jsPDF('l', 'mm', 'a4')
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()
  const margin = 10
  const maxWidth = pdfWidth - margin * 2
  const maxHeight = pdfHeight - margin * 2

  const ratio = canvas.width / canvas.height
  let drawWidth = maxWidth
  let drawHeight = drawWidth / ratio

  if (drawHeight > maxHeight) {
    drawHeight = maxHeight
    drawWidth = drawHeight * ratio
  }

  const x = (pdfWidth - drawWidth) / 2
  const y = (pdfHeight - drawHeight) / 2
  pdf.addImage(imageData, 'PNG', x, y, drawWidth, drawHeight)

  pdf.save(fileName)
}
