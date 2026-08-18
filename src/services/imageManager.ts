import { supabase } from '../lib/supabase'

export type ValidacionImagenResultado = {
  esValido: boolean
  error?: string
  tipoDetectado?: string
  width?: number
  height?: number
}

export type ImagenOptimizada = {
  blob: Blob
  dataUrl: string
  width: number
  height: number
  sizeBytes: number
  originalSizeBytes: number
}

export const STORAGE_BUCKET_AVATARS = 'avatars'
const MAX_TAMANO_ORIGINAL_BYTES = 8 * 1024 * 1024 // 8 MB límite inicial

const MIMES_PERMITIDOS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]

/**
 * Valida los magic bytes reales del archivo para asegurar que no sea un ejecutable o script renombrado.
 */
export const validarMagicBytes = async (file: File): Promise<{ esValido: boolean; formato?: string }> => {
  try {
    const buffer = await file.slice(0, 16).arrayBuffer()
    const bytes = new Uint8Array(buffer)

    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return { esValido: true, formato: 'image/jpeg' }
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      return { esValido: true, formato: 'image/png' }
    }

    // GIF: 47 49 46 38
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return { esValido: true, formato: 'image/gif' }
    }

    // WEBP: 52 49 46 46 ... 57 45 42 50 (RIFF .... WEBP)
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return { esValido: true, formato: 'image/webp' }
    }

    // SVG: <svg o <?xml
    const textoInicio = new TextDecoder().decode(bytes).trim().toLowerCase()
    if (textoInicio.startsWith('<svg') || textoInicio.startsWith('<?xml')) {
      return { esValido: true, formato: 'image/svg+xml' }
    }

    return { esValido: false }
  } catch (err) {
    console.error('[ImageManager] Error comprobando magic bytes:', err)
    return { esValido: false }
  }
}

/**
 * Valida de forma completa: tamaño, MIME type, Magic Bytes e integridad de renderizado.
 */
export const validarImagenArchivo = async (
  file: File,
  maxSizeBytes = MAX_TAMANO_ORIGINAL_BYTES,
): Promise<ValidacionImagenResultado> => {
  if (!file) {
    return { esValido: false, error: 'No se ha proporcionado ningún archivo.' }
  }

  if (file.size > maxSizeBytes) {
    const maxMB = Math.round(maxSizeBytes / (1024 * 1024))
    return {
      esValido: false,
      error: `El archivo supera el tamaño máximo permitido de ${maxMB} MB.`,
    }
  }

  if (!MIMES_PERMITIDOS.includes(file.type.toLowerCase())) {
    return {
      esValido: false,
      error: 'Formato no soportado. Formatos admitidos: JPG, PNG, WebP, GIF y SVG.',
    }
  }

  const comprobacionBytes = await validarMagicBytes(file)
  if (!comprobacionBytes.esValido) {
    return {
      esValido: false,
      error: 'El archivo seleccionado no es una imagen válida o está dañado.',
    }
  }

  // Verificar integridad de carga mediante un objeto Image en memoria
  try {
    const objectUrl = URL.createObjectURL(file)
    const dimensiones = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const w = img.naturalWidth
        const h = img.naturalHeight
        URL.revokeObjectURL(objectUrl)
        if (w > 0 && h > 0) {
          resolve({ width: w, height: h })
        } else {
          reject(new Error('Dimensiones no válidas'))
        }
      }
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Error cargando imagen'))
      }
      img.src = objectUrl
    })

    return {
      esValido: true,
      tipoDetectado: comprobacionBytes.formato,
      width: dimensiones.width,
      height: dimensiones.height,
    }
  } catch {
    return {
      esValido: false,
      error: 'No se pudo procesar la imagen. Comprueba que el archivo no esté corrupto.',
    }
  }
}

export type OpcionesOptimizacion = {
  maxDimension?: number
  calidad?: number
  formato?: 'image/webp' | 'image/jpeg' | 'image/png'
}

/**
 * Redimensiona y comprime una imagen en cliente utilizando Canvas de alta fidelidad.
 */
export const optimizarImagen = async (
  file: File,
  opciones?: OpcionesOptimizacion,
): Promise<ImagenOptimizada> => {
  const maxDimension = opciones?.maxDimension ?? 512
  const calidad = opciones?.calidad ?? 0.85
  const formatoPreferido = opciones?.formato ?? 'image/webp'

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      let { naturalWidth: width, naturalHeight: height } = img

      // Calcular proporción manteniendo aspecto
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height * maxDimension) / width)
          width = maxDimension
        } else {
          width = Math.round((width * maxDimension) / height)
          height = maxDimension
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('No se pudo inicializar el contexto de renderizado de imagen'))
        return
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // Dibujar imagen escalada
      ctx.drawImage(img, 0, 0, width, height)

      // Convertir a Blob
      const intentarFormato = (mime: string) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const reader = new FileReader()
              reader.onloadend = () => {
                const dataUrl = reader.result as string
                resolve({
                  blob,
                  dataUrl,
                  width,
                  height,
                  sizeBytes: blob.size,
                  originalSizeBytes: file.size,
                })
              }
              reader.readAsDataURL(blob)
            } else if (mime !== 'image/jpeg') {
              // Fallback a JPEG si WebP no genera blob
              intentarFormato('image/jpeg')
            } else {
              reject(new Error('Error al generar blob de la imagen'))
            }
          },
          mime,
          calidad,
        )
      }

      intentarFormato(formatoPreferido)
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Error al cargar la imagen para optimización'))
    }

    img.src = objectUrl
  })
}

/**
 * Sube una imagen optimizada a Supabase Storage en el bucket 'avatars'.
 * Si el bucket o storage no estuviese accesible, devuelve fallback seguro con la dataUrl optimizada.
 */
export const subirImagenASupabase = async ({
  blob,
  dataUrl,
  carpeta,
  idEntidad,
}: {
  blob: Blob
  dataUrl: string
  carpeta: 'usuarios' | 'productores'
  idEntidad: string
}): Promise<{ url: string; guardadoEnStorage: boolean; error?: string }> => {
  if (!supabase) {
    return { url: dataUrl, guardadoEnStorage: false }
  }

  const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp'
  const cleanId = idEntidad.replace(/[^a-zA-Z0-9_-]/g, '_')
  const timestamp = Date.now()
  const filePath = `${carpeta}/${cleanId}/${timestamp}.${extension}`

  try {
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET_AVATARS)
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: true,
        contentType: blob.type,
      })

    if (uploadError) {
      console.warn('[ImageManager] Subida a Supabase Storage falló (usando fallback seguro):', uploadError.message)
      return {
        url: dataUrl,
        guardadoEnStorage: false,
        error: uploadError.message,
      }
    }

    if (uploadData?.path) {
      const { data: publicData } = supabase.storage
        .from(STORAGE_BUCKET_AVATARS)
        .getPublicUrl(uploadData.path)

      if (publicData?.publicUrl) {
        return {
          url: publicData.publicUrl,
          guardadoEnStorage: true,
        }
      }
    }

    return { url: dataUrl, guardadoEnStorage: false }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Error desconocido al subir a Storage'
    console.warn('[ImageManager] Excepción al interactuar con Storage:', errorMsg)
    return { url: dataUrl, guardadoEnStorage: false, error: errorMsg }
  }
}

/**
 * Elimina una imagen de Supabase Storage si corresponde a una URL del bucket.
 */
export const eliminarImagenDeSupabase = async (url: string | null | undefined): Promise<boolean> => {
  if (!url || !supabase || !url.includes(STORAGE_BUCKET_AVATARS)) {
    return false
  }

  try {
    const indiceBucket = url.indexOf(STORAGE_BUCKET_AVATARS)
    if (indiceBucket === -1) return false

    const fragmento = url.substring(indiceBucket + STORAGE_BUCKET_AVATARS.length + 1).split('?')[0]
    if (!fragmento) return false

    const { error } = await supabase.storage.from(STORAGE_BUCKET_AVATARS).remove([fragmento])
    if (error) {
      console.warn('[ImageManager] No se pudo eliminar archivo de Storage:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('[ImageManager] Excepción al eliminar de Storage:', err)
    return false
  }
}
