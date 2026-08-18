import React, { useRef, useState, useEffect } from 'react'
import {
  Camera,
  Trash2,
  UploadCloud,
  AlertCircle,
  Loader2,
  Link2,
  Check,
  X,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import { Avatar } from './Avatar'
import {
  validarImagenArchivo,
  optimizarImagen,
  type ImagenOptimizada,
} from '../services/imageManager'

export interface ImageUploadFieldProps {
  label?: string
  value?: string | null
  nombreReferencia?: string
  tipo?: 'user' | 'producer'
  onChange: (data: { url: string | null; blob?: Blob | null; optimizada?: ImagenOptimizada | null }) => void
  onError?: (mensaje: string) => void
  disabled?: boolean
  maxDimension?: number
  helpText?: string
}

/**
 * Valida si una URL remota carga efectivamente una imagen en el navegador.
 */
const validarUrlImagenRemota = (url: string): Promise<{ esValida: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const trimmed = url.trim()
    if (!trimmed) {
      resolve({ esValida: false, error: 'Por favor ingresa un enlace de imagen válido.' })
      return
    }

    if (!/^https?:\/\/.+/i.test(trimmed)) {
      resolve({
        esValida: false,
        error: 'El enlace debe comenzar con http:// o https://',
      })
      return
    }

    let finalizado = false
    const img = new Image()

    const timeout = setTimeout(() => {
      if (!finalizado) {
        finalizado = true
        img.src = ''
        resolve({
          esValida: false,
          error: 'El servidor de la imagen tardó demasiado en responder.',
        })
      }
    }, 8000)

    img.onload = () => {
      if (!finalizado) {
        finalizado = true
        clearTimeout(timeout)
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          resolve({ esValida: true })
        } else {
          resolve({
            esValida: false,
            error: 'El enlace no contiene una imagen visible válida.',
          })
        }
      }
    }

    img.onerror = () => {
      if (!finalizado) {
        finalizado = true
        clearTimeout(timeout)
        resolve({
          esValida: false,
          error: 'No se pudo cargar la imagen desde este enlace. Asegúrate de que sea un enlace público directo a un archivo de imagen (JPG, PNG, WebP o GIF).',
        })
      }
    }

    img.src = trimmed
  })
}

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  label = 'Fotografía de perfil',
  value,
  nombreReferencia = '',
  tipo = 'user',
  onChange,
  onError,
  disabled = false,
  maxDimension = 512,
  helpText,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [urlInput, setUrlInput] = useState('')
  const [procesandoArchivo, setProcesandoArchivo] = useState(false)
  const [validandoUrl, setValidandoUrl] = useState(false)
  const [errorLocal, setErrorLocal] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [urlAplicadaExito, setUrlAplicadaExito] = useState(false)

  // Sincronizar campo de URL si el valor externo es una URL HTTP(S) remota
  useEffect(() => {
    if (value && /^https?:\/\//i.test(value)) {
      setUrlInput(value)
    } else if (!value) {
      setUrlInput('')
    }
  }, [value])

  const manejarArchivo = async (file: File) => {
    setErrorLocal(null)
    setUrlAplicadaExito(false)
    setProcesandoArchivo(true)

    try {
      // 1. Validar archivo (MIME, Magic Bytes, Integridad, Tamaño)
      const validacion = await validarImagenArchivo(file)
      if (!validacion.esValido) {
        const errorMsg = validacion.error || 'Archivo de imagen no válido.'
        setErrorLocal(errorMsg)
        onError?.(errorMsg)
        setProcesandoArchivo(false)
        return
      }

      // 2. Optimizar / Comprimir en Canvas en alta fidelidad
      const optimizada = await optimizarImagen(file, {
        maxDimension: tipo === 'producer' ? 800 : maxDimension,
        calidad: 0.85,
        formato: 'image/webp',
      })

      // 3. Notificar al componente padre con la dataUrl optimizada y el blob
      onChange({
        url: optimizada.dataUrl,
        blob: optimizada.blob,
        optimizada,
      })
      setUrlInput('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ocurrió un error al procesar la imagen.'
      setErrorLocal(msg)
      onError?.(msg)
    } finally {
      setProcesandoArchivo(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void manejarArchivo(file)
    }
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled && !procesandoArchivo && !validandoUrl) {
      setArrastrando(true)
    }
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setArrastrando(false)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setArrastrando(false)
    if (disabled || procesandoArchivo || validandoUrl) return

    const file = e.dataTransfer.files?.[0]
    if (file) {
      void manejarArchivo(file)
    }
  }

  const aplicarUrlImagen = async () => {
    const urlLimpia = urlInput.trim()
    if (!urlLimpia) {
      setErrorLocal('Por favor ingresa un enlace de imagen.')
      return
    }

    setErrorLocal(null)
    setValidandoUrl(true)
    setUrlAplicadaExito(false)

    try {
      const resultado = await validarUrlImagenRemota(urlLimpia)
      if (!resultado.esValida) {
        const errorMsg = resultado.error || 'El enlace no corresponde a una imagen accesible.'
        setErrorLocal(errorMsg)
        onError?.(errorMsg)
        return
      }

      // URL válida: aplicar de inmediato a la previsualización
      onChange({
        url: urlLimpia,
        blob: null,
        optimizada: null,
      })
      setUrlAplicadaExito(true)
      setTimeout(() => setUrlAplicadaExito(false), 2500)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al validar el enlace de la imagen.'
      setErrorLocal(msg)
      onError?.(msg)
    } finally {
      setValidandoUrl(false)
    }
  }

  const eliminarFoto = () => {
    setErrorLocal(null)
    setUrlInput('')
    setUrlAplicadaExito(false)
    onChange({ url: null, blob: null, optimizada: null })
  }

  const estaCargando = procesandoArchivo || validandoUrl

  return (
    <div className="dm-image-upload-field mb-5 w-full">
      {label ? (
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Camera size={14} className="text-emerald-700" />
            <span>{label}</span>
          </label>
          <span className="text-[11px] text-slate-400 font-medium">
            {tipo === 'user' ? 'Avatar de usuario' : 'Logotipo de proveedor'}
          </span>
        </div>
      ) : null}

      {/* Contenedor Principal de la Tarjeta Hero */}
      <div className="dm-photo-hero-card rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/70 to-white p-5 shadow-sm">
        
        {/* Zona Central de la Fotografía con Avatar Grande y Superposición */}
        <div className="flex flex-col items-center justify-center text-center pb-5 border-b border-slate-100">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="p-1 rounded-full bg-white shadow-md ring-4 ring-emerald-600/10 transition-all duration-300 group-hover:ring-emerald-600/25 group-hover:shadow-lg">
              <Avatar
                src={value}
                name={nombreReferencia || (tipo === 'producer' ? 'Productor' : 'Usuario')}
                size="3xl"
                variant={tipo === 'producer' ? 'rounded' : 'circle'}
                type={tipo}
                border={false}
              />
            </div>

            {/* Capa de Hover: Cambiar foto */}
            <div className="absolute inset-1 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col items-center justify-center backdrop-blur-[2px]">
              <Camera size={22} className="mb-0.5" />
              <span className="text-[10px] font-bold tracking-wide">Cambiar</span>
            </div>

            {/* Botón Flotante de Cámara en la Esquina */}
            <button
              type="button"
              className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white shadow-md flex items-center justify-center ring-2 ring-white transition-transform hover:scale-110 active:scale-95"
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
              title="Seleccionar fotografía desde tu equipo"
              disabled={disabled || estaCargando}
            >
              <Camera size={14} />
            </button>

            {/* Indicador de Carga */}
            {estaCargando ? (
              <div className="absolute inset-0 rounded-full bg-slate-900/60 flex items-center justify-center text-white backdrop-blur-[1px] z-10">
                <Loader2 size={28} className="animate-spin text-emerald-400" />
              </div>
            ) : null}
          </div>

          {/* Información del Estado y Botón de Eliminar */}
          <div className="mt-3.5 flex flex-col items-center">
            {value ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100/70 border border-emerald-300/80 text-[11px] font-bold text-emerald-800">
                <Sparkles size={12} className="text-emerald-700" />
                <span>Fotografía personalizada activa</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-600">
                <span>Avatar corporativo con iniciales</span>
              </div>
            )}

            <p className="text-xs text-slate-500 mt-1.5 max-w-sm">
              {value
                ? 'Puedes reemplazar tu foto subiendo un archivo o pegando una nueva URL.'
                : 'Sube una imagen desde tu dispositivo o pega un enlace para personalizar.'}
            </p>

            {value ? (
              <button
                type="button"
                className="mt-2 text-xs py-1 px-3 h-7 flex items-center gap-1.5 font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 rounded-lg transition-colors shadow-2xs"
                onClick={eliminarFoto}
                disabled={disabled || estaCargando}
              >
                <Trash2 size={13} />
                <span>Eliminar fotografía</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Sección de las Dos Alternativas */}
        <div className="mt-4 pt-1 space-y-3.5">
          
          {/* OPCIÓN 1: Subir desde dispositivo */}
          <div className="dm-upload-option-card p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center text-[11px] font-black border border-emerald-200">
                  1
                </span>
                <span>Subir desde dispositivo</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                JPG, PNG, WebP o GIF (máx. 5MB)
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={onFileSelect}
              disabled={disabled || estaCargando}
            />

            <div
              className={`dm-dropzone-box flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-lg border-2 border-dashed transition-all duration-200 ${
                arrastrando
                  ? 'border-emerald-600 bg-emerald-50/80 shadow-sm'
                  : 'border-slate-200 hover:border-emerald-500 bg-slate-50/60'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <div className="flex items-center gap-2.5 min-w-0 text-center sm:text-left">
                <div className="w-8 h-8 rounded-lg bg-emerald-600/10 text-emerald-700 flex items-center justify-center flex-shrink-0">
                  <UploadCloud size={17} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">
                    {procesandoArchivo ? 'Optimizando imagen...' : 'Arrastra una imagen aquí o elígela de tu equipo'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {helpText || 'Redimensionada y comprimida automáticamente'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="btn-upload-file text-xs py-1.5 px-3.5 h-8 flex items-center gap-1.5 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition-all flex-shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || estaCargando}
              >
                {procesandoArchivo ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Camera size={13} />
                )}
                <span>Seleccionar archivo</span>
              </button>
            </div>
          </div>

          {/* Separador Visual Profesional */}
          <div className="relative flex items-center justify-center py-0.5">
            <div className="w-full border-t border-slate-200/90" />
            <span className="absolute px-3 bg-white text-[11px] font-extrabold text-slate-400 uppercase tracking-widest border border-slate-200/60 rounded-full py-0.5 shadow-2xs">
              o bien
            </span>
          </div>

          {/* OPCIÓN 2: Pegar enlace de imagen */}
          <div className="dm-upload-option-card p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center text-[11px] font-black border border-emerald-200">
                  2
                </span>
                <span>Pegar enlace de imagen (URL)</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                Enlace web directo
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="field-shell flex-1 mb-0 relative">
                <Link2 size={15} className="text-slate-400 flex-shrink-0" />
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value)
                    if (errorLocal) setErrorLocal(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void aplicarUrlImagen()
                    }
                  }}
                  placeholder="https://ejemplo.com/fotografia.jpg"
                  disabled={disabled || estaCargando}
                  className="text-xs pr-7"
                />
                {urlInput ? (
                  <button
                    type="button"
                    onClick={() => {
                      setUrlInput('')
                      setErrorLocal(null)
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    title="Limpiar enlace"
                  >
                    <X size={13} />
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                className={`text-xs py-1.5 px-3.5 h-9 flex items-center justify-center gap-1.5 font-bold rounded-lg transition-all flex-shrink-0 ${
                  urlAplicadaExito
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs'
                }`}
                onClick={() => void aplicarUrlImagen()}
                disabled={disabled || estaCargando || !urlInput.trim()}
              >
                {validandoUrl ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : urlAplicadaExito ? (
                  <Check size={14} />
                ) : (
                  <ExternalLink size={14} />
                )}
                <span>{validandoUrl ? 'Verificando...' : urlAplicadaExito ? '¡Enlace aplicado!' : 'Aplicar enlace'}</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 pl-0.5">
              Pega cualquier URL pública directa y haz clic en <strong>&quot;Aplicar enlace&quot;</strong> para cargar la vista previa.
            </p>
          </div>

        </div>

      </div>

      {/* Alertas de error con mensaje amigable */}
      {errorLocal ? (
        <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 font-medium animate-fadeIn shadow-2xs">
          <AlertCircle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">{errorLocal}</div>
          <button
            type="button"
            className="text-rose-400 hover:text-rose-600"
            onClick={() => setErrorLocal(null)}
          >
            <X size={14} />
          </button>
        </div>
      ) : null}
    </div>
  )
}
