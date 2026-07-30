import html2canvas from 'html2canvas'

const CAPTURE_BUFFER = 16
const DEFAULT_SCALE = 3

/**
 * Filter function to ignore action buttons and elements marked with `print-hidden` or `acciones-linea`.
 */
const filterExportElements = (node: Node): boolean => {
  if (node instanceof HTMLElement) {
    if (
      node.classList.contains('print-hidden') ||
      node.classList.contains('acciones-linea') ||
      node.classList.contains('acciones-reporte-zona') ||
      node.tagName === 'BUTTON'
    ) {
      return false
    }
  }
  return true
}

/**
 * Wait for all images inside the element to finish loading before taking the screenshot.
 */
const esperarImagenes = async (element: HTMLElement): Promise<void> => {
  const imagenes = Array.from(element.querySelectorAll('img'))
  await Promise.all(
    imagenes.map((img) => {
      if (img.complete && img.naturalWidth !== 0) return Promise.resolve()
      return new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true })
        img.addEventListener('error', () => resolve(), { once: true })
      })
    }),
  )
}

/**
 * Wait for fonts to be ready and browser paint cycles to complete.
 */
const esperarRender = async (): Promise<void> => {
  if ('fonts' in document) {
    try {
      await (document as Document & { fonts: FontFaceSet }).fonts.ready
    } catch {
      // Ignore font loading errors
    }
  }
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

interface ExportOptions {
  scale?: number
  format?: 'natural' | 'a4-landscape'
}

interface ClonExportacion {
  host: HTMLDivElement
  clone: HTMLElement
  cleanup: () => void
}

/**
 * Creates a clone of the given DOM element in an off-screen container.
 */
const crearClonExportacion = (
  element: HTMLElement,
  exportFormat: 'natural' | 'a4-landscape' = 'natural',
): ClonExportacion => {
  const isA4 = exportFormat === 'a4-landscape'

  const host = document.createElement('div')
  host.style.position = 'absolute'
  host.style.left = '-99999px'
  host.style.top = '0'
  host.style.background = '#ffffff'
  host.style.boxSizing = 'border-box'
  host.style.pointerEvents = 'none'
  host.style.zIndex = '-9999'

  if (isA4) {
    host.style.width = '1123px'
    host.style.padding = '24px'
    host.style.overflow = 'visible'
    host.style.display = 'block'
  } else {
    host.style.padding = '28px'
    host.style.overflow = 'visible'
    host.style.width = 'max-content'
    host.style.minWidth = 'fit-content'
  }

  const clone = element.cloneNode(true) as HTMLElement
  clone.removeAttribute('id')
  clone.style.height = 'auto'
  clone.style.maxHeight = 'none'
  clone.style.overflow = 'visible'
  clone.style.transform = 'none'
  clone.style.boxSizing = 'border-box'

  if (isA4) {
    clone.style.width = '100%'
    clone.style.maxWidth = '100%'
    clone.style.margin = '0 auto'
  } else {
    clone.style.width = 'max-content'
    clone.style.minWidth = 'fit-content'
    clone.style.maxWidth = 'none'
    clone.style.margin = '0'
  }

  // Recursively reset scroll/overflow/max-width constraints on all nodes
  const nodos = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))]
  nodos.forEach((node) => {
    const computed = window.getComputedStyle(node)

    if (
      computed.overflow !== 'visible' ||
      computed.overflowX !== 'visible' ||
      computed.overflowY !== 'visible'
    ) {
      node.style.overflow = 'visible'
      node.style.overflowX = 'visible'
      node.style.overflowY = 'visible'
    }

    if (computed.maxWidth !== 'none' && (!isA4 || !node.classList.contains('hoja-reporte'))) {
      node.style.maxWidth = 'none'
    }

    if (computed.maxHeight !== 'none') {
      node.style.maxHeight = 'none'
    }

    if (computed.transform && computed.transform !== 'none') {
      node.style.transform = 'none'
    }

    node.style.transition = 'none'
    node.style.animation = 'none'

    // Specific adjustments for tables & wrapper containers
    if (
      node.classList.contains('tabla-excel-wrap') ||
      node.classList.contains('tabla-excel-container') ||
      node.classList.contains('tabla-wrapper') ||
      node.tagName === 'TABLE'
    ) {
      node.style.overflow = 'visible'
      node.style.minWidth = '0'
      node.scrollLeft = 0
      if (isA4) {
        node.style.width = '100%'
        node.style.maxWidth = '100%'
      } else {
        node.style.width = 'max-content'
        node.style.maxWidth = 'none'
      }
    }

    if (node.tagName === 'TABLE' || node.classList.contains('tabla-excel')) {
      node.style.minWidth = '100%'
      if (isA4) {
        node.style.width = '100%'
        node.style.maxWidth = '100%'
        node.style.tableLayout = 'auto'
      } else {
        node.style.width = 'max-content'
        node.style.maxWidth = 'none'
      }
    }

    if (node.classList.contains('cabecera-hoja')) {
      node.style.display = 'flex'
      node.style.flexDirection = 'row'
      node.style.alignItems = 'center'
      node.style.textAlign = 'left'
      node.style.gap = '16px'
    }

    if (node.classList.contains('hoja-reporte') || node.classList.contains('reporte-empaque')) {
      node.style.overflow = 'visible'
      node.style.boxSizing = 'border-box'
      if (isA4) {
        node.style.width = '100%'
        node.style.minWidth = '0'
        node.style.maxWidth = '100%'
        node.style.padding = '20px'
      } else {
        node.style.width = 'max-content'
        node.style.minWidth = 'fit-content'
        node.style.maxWidth = 'none'
      }
    }
  })

  host.appendChild(clone)

  const bottomSpacer = document.createElement('div')
  bottomSpacer.style.height = '16px'
  bottomSpacer.style.width = '100%'
  host.appendChild(bottomSpacer)

  document.body.appendChild(host)

  return {
    host,
    clone,
    cleanup: () => {
      if (host.parentNode) {
        host.parentNode.removeChild(host)
      }
    },
  }
}

/**
 * Core unified function to capture any HTML element into a high-resolution PNG HTMLCanvasElement.
 */
export const capturarElementoPngCanvas = async (
  element: HTMLElement,
  options: ExportOptions = {},
): Promise<HTMLCanvasElement> => {
  const exportFormat = options.format ?? 'natural'
  const { host, clone, cleanup } = crearClonExportacion(element, exportFormat)

  try {
    await esperarImagenes(clone)
    await esperarRender()

    const cloneRect = clone.getBoundingClientRect()
    const hostRect = host.getBoundingClientRect()

    const realWidth = Math.max(
      host.scrollWidth,
      host.offsetWidth,
      clone.scrollWidth,
      clone.offsetWidth,
      Math.ceil(hostRect.width),
      Math.ceil(cloneRect.width),
    )

    const realHeight = Math.max(
      host.scrollHeight,
      host.offsetHeight,
      clone.scrollHeight,
      clone.offsetHeight,
      Math.ceil(hostRect.height),
      Math.ceil(cloneRect.height),
    )

    const width = Math.ceil(realWidth + CAPTURE_BUFFER)
    const height = Math.ceil(realHeight + CAPTURE_BUFFER)

    if (width <= 0 || height <= 0) {
      throw new Error('No se pudo determinar las dimensiones del elemento para exportar.')
    }

    const scaleFactor = Math.max(DEFAULT_SCALE, options.scale ?? DEFAULT_SCALE)

    const canvas = await html2canvas(host, {
      backgroundColor: '#ffffff',
      scale: scaleFactor,
      useCORS: true,
      allowTaint: true,
      logging: false,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0,
      ignoreElements: (node) => !filterExportElements(node),
    })

    return canvas
  } finally {
    cleanup()
  }
}

/**
 * Universal function to export any element as PNG image.
 */
export const exportElementToPng = async (
  element: HTMLElement,
  fileName: string,
  options: ExportOptions = {},
): Promise<void> => {
  const canvas = await capturarElementoPngCanvas(element, options)
  const dataUrl = canvas.toDataURL('image/png', 1.0)
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName.endsWith('.png') ? fileName : `${fileName}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
