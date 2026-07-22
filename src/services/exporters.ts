import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import * as XLSX from 'xlsx'

const EXPORT_DESKTOP_WIDTH = 1400
const EXPORT_PADDING = 28
const EXPORT_PIXEL_RATIO = 4
const CAPTURE_BUFFER = 8

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

const esperarRender = () => new Promise<void>((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
})

const crearClonExportacion = (element: HTMLElement) => {
  const host = document.createElement('div')
  host.style.position = 'absolute'
  host.style.left = '-99999px'
  host.style.top = '0'
  host.style.background = '#ffffff'
  host.style.padding = `${EXPORT_PADDING}px`
  host.style.overflow = 'visible'
  host.style.width = 'max-content'
  host.style.minWidth = `${EXPORT_DESKTOP_WIDTH}px`
  host.style.pointerEvents = 'none'

  const clone = element.cloneNode(true) as HTMLElement
  clone.style.width = `${EXPORT_DESKTOP_WIDTH}px`
  clone.style.minWidth = `${EXPORT_DESKTOP_WIDTH}px`
  clone.style.maxWidth = `${EXPORT_DESKTOP_WIDTH}px`
  clone.style.overflow = 'visible'
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
  })

  host.appendChild(clone)
  document.body.appendChild(host)

  return {
    host,
    clone,
    cleanup: () => host.remove(),
  }
}

const capturarPngEscritorio = async (element: HTMLElement) => {
  const { host, clone, cleanup } = crearClonExportacion(element)
  try {
    if ('fonts' in document) {
      await (document as Document & { fonts: FontFaceSet }).fonts.ready
    }

    await esperarImagenes(clone)
    await esperarRender()

    const width = Math.ceil(host.scrollWidth + CAPTURE_BUFFER)
    const height = Math.ceil(host.scrollHeight + CAPTURE_BUFFER)

    if (width <= 0 || height <= 0) {
      throw new Error('No se pudo calcular el tamaño de exportación del reporte.')
    }

    const canvas = await html2canvas(host, {
      backgroundColor: '#ffffff',
      scale: EXPORT_PIXEL_RATIO,
      useCORS: true,
      allowTaint: true,
      logging: false,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0,
    })

    return canvas.toDataURL('image/png', 1)
  } finally {
    cleanup()
  }
}

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
  const dataUrl = await capturarPngEscritorio(element)
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  link.click()
}

export const exportElementToPdf = async (element: HTMLElement, fileName: string) => {
  const imageData = await capturarPngEscritorio(element)

  const pdf = new jsPDF('l', 'mm', 'a4')
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()
  const margin = 10
  const maxWidth = pdfWidth - margin * 2
  const maxHeight = pdfHeight - margin * 2
  const img = new Image()
  img.src = imageData
  await new Promise((resolve) => {
    img.onload = resolve
  })

  const ratio = img.width / img.height
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
