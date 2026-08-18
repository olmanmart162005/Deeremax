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
      resolve({ esValida: false, error: 'Por favor ingresa una URL válida.' })
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
          error: 'Tiempo de espera agotado al intentar cargar la imagen desde el enlace.',
        })
      }
    }, 7000)

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
          error: 'No se pudo cargar la imagen desde el enlace proporcionado. Verifica que sea un enlace público directo a una imagen (JPG, PNG, WebP, GIF).',
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
    <div className="dm-image-upload-field mb-4 w-full">
      {label ? (
        <label className="block text-xs font-bold text-[#334155] mb-2 uppercase tracking-wide">
          {label}
        </label>
      ) : null}

      <div className="dm-photo-card p-4 rounded-xl border border-slate-200/90 bg-white shadow-xs">
        {/* Cabecera con Avatar central y acciones rápidas */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 pb-4 border-b border-slate-100">
          <div className="relative flex-shrink-0">
            <Avatar
              src={value}
              name={nombreReferencia || (tipo === 'producer' ? 'Productor' : 'Usuario')}
              size="2xl"
              variant={tipo === 'producer' ? 'rounded' : 'circle'}
              type={tipo}
              border={true}
            />
            {estaCargando ? (
              <div className="absolute inset-0 bg-black/45 rounded-full flex items-center justify-center text-white backdrop-blur-[1px]">
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : null}
          </div>

          <div className="flex-1 text-center sm:text-left min-w-0">
            <h4 className="text-sm font-bold text-slate-800">
              {value ? 'Fotografía cargada' : 'Sin fotografía personalizada'}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {value
                ? 'Puedes reemplazarla seleccionando un archivo nuevo o pegando un enlace.'
                : 'Se mostrará el avatar corporativo con tus iniciales por defecto.'}
            </p>

            {value ? (
              <div className="mt-3 flex items-center justify-center sm:justify-start gap-2">
                <button
                  type="button"
                  className="danger text-xs py-1 px-2.5 h-7.5 flex items-center gap-1.5 font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                  onClick={eliminarFoto}
                  disabled={disabled || estaCargando}
                >
                  <Trash2 size={13} /> Eliminar fotografía
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Sección de las Dos Opciones: Archivo o Enlace */}
        <div className="mt-4 space-y-3">
          {/* Opción 1: Subir desde dispositivo */}
          <div>
            <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Camera size={13} className="text-emerald-700" />
              <span>Opción 1: Subir desde dispositivo</span>
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
              className={`dm-upload-dropzone flex items-center justify-between gap-3 p-3 rounded-lg border-2 border-dashed transition-all duration-200 ${
                arrastrando
                  ? 'border-emerald-600 bg-emerald-50/70 shadow-sm'
                  : 'border-slate-200 hover:border-emerald-500 bg-slate-50/50'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-100/70 text-emerald-800 flex items-center justify-center flex-shrink-0">
                  <UploadCloud size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">
                    {procesandoArchivo ? 'Optimizando imagen...' : 'Selecciona o arrastra una imagen'}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {helpText || 'JPG, PNG, WebP o GIF (máx. 5MB)'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="ghost text-xs py-1 px-3 h-8 flex items-center gap-1.5 font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-xs flex-shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || estaCargando}
              >
                {procesandoArchivo ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Camera size={13} />
                )}
                <span>Subir archivo</span>
              </button>
            </div>
          </div>

          {/* Separador elegante "o" */}
          <div className="relative flex items-center justify-center py-1">
            <div className="w-full border-t border-slate-200" />
            <span className="absolute px-3 bg-white text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              o
            </span>
          </div>

          {/* Opción 2: Pegar enlace de imagen */}
          <div>
            <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Link2 size={13} className="text-emerald-700" />
              <span>Opción 2: Pegar enlace de imagen (URL)</span>
            </div>

            <div className="flex items-center gap-2">
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
                className={`text-xs py-1 px-3 h-9 flex items-center gap-1.5 font-semibold rounded-lg transition-all flex-shrink-0 ${
                  urlAplicadaExito
                    ? 'bg-emerald-600 text-white'
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
                  <Check size={14} />
                )}
                <span>{validandoUrl ? 'Verificando...' : urlAplicadaExito ? '¡Aplicada!' : 'Aplicar URL'}</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 pl-1">
              Pega un enlace web público directo y haz clic en &quot;Aplicar URL&quot; para previsualizar.
            </p>
          </div>
        </div>
      </div>

      {/* Alertas de error con mensaje amigable */}
      {errorLocal ? (
        <div className="mt-2.5 p-2.5 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-700 font-medium animate-fadeIn">
          <AlertCircle size={15} className="text-rose-600 flex-shrink-0 mt-0.5" />
          <span>{errorLocal}</span>
        </div>
      ) : null}
    </div>
  )
}
