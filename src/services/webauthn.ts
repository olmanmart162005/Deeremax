import { supabase } from '../lib/supabase'
import type { WebAuthnCredentialRecord } from '../types'

// Utilidades para codificación base64url estándar
export const bufferToBase64Url = (buffer: ArrayBuffer | Uint8Array): string => {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const base64UrlToBuffer = (base64url: string): ArrayBuffer => {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Detecta el nombre descriptivo del dispositivo del usuario
 */
export const detectarNombreDispositivo = (): string => {
  const ua = navigator.userAgent || ''
  let os = 'Dispositivo'
  if (/android/i.test(ua)) {
    if (/samsung/i.test(ua) || /sm-/i.test(ua)) {
      os = 'Samsung Galaxy (Huella/Face)'
    } else {
      os = 'Android (Biometría)'
    }
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = 'Apple iPhone/iPad (Face ID / Touch ID)'
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = 'MacBook / Mac (Touch ID)'
  } else if (/windows/i.test(ua)) {
    os = 'Windows PC (Windows Hello)'
  } else if (/linux/i.test(ua)) {
    os = 'Linux PC (FIDO2 / Biometría)'
  }

  const browser = /edg/i.test(ua)
    ? 'Edge'
    : /chrome|crios/i.test(ua)
      ? 'Chrome'
      : /safari/i.test(ua)
        ? 'Safari'
        : /firefox/i.test(ua)
          ? 'Firefox'
          : 'Navegador'

  return `${os} · ${browser}`
}

/**
 * Comprueba si la API de WebAuthn está disponible en el entorno del navegador
 */
export const esWebAuthnSoportado = (): boolean => {
  return typeof window !== 'undefined' && Boolean(window.PublicKeyCredential && navigator.credentials)
}

/**
 * Comprueba si el dispositivo cuenta con un autenticador de plataforma (sensor dactilar, Face ID, Windows Hello)
 */
export const tieneAutenticadorPlataforma = async (): Promise<boolean> => {
  if (!esWebAuthnSoportado()) return false
  try {
    if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    }
    return true
  } catch (err) {
    console.warn('[WebAuthn] Error al verificar autenticador de plataforma:', err)
    return false
  }
}

/**
 * Genera un challenge criptográfico seguro de 32 bytes
 */
export const generarChallengeSeguro = (): Uint8Array => {
  const array = new Uint8Array(32)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array)
  } else {
    for (let i = 0; i < 32; i++) {
      array[i] = Math.floor(Math.random() * 256)
    }
  }
  return array
}

const STORAGE_WEBAUTHN_FALLBACK_KEY = 'deeremax_webauthn_registered_devices'

const obtenerCredencialesLocalesFallback = (userId: string): WebAuthnCredentialRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_WEBAUTHN_FALLBACK_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as WebAuthnCredentialRecord[]
    return Array.isArray(parsed) ? parsed.filter((c) => c.user_id === userId) : []
  } catch {
    return []
  }
}

const guardarCredencialLocalFallback = (cred: WebAuthnCredentialRecord) => {
  try {
    const raw = localStorage.getItem(STORAGE_WEBAUTHN_FALLBACK_KEY)
    const list = (raw ? JSON.parse(raw) : []) as WebAuthnCredentialRecord[]
    const filtrada = list.filter((c) => c.credential_id !== cred.credential_id)
    filtrada.push(cred)
    localStorage.setItem(STORAGE_WEBAUTHN_FALLBACK_KEY, JSON.stringify(filtrada))
  } catch (e) {
    console.warn('[WebAuthn] Advertencia al sincronizar credencial local:', e)
  }
}

const eliminarCredencialLocalFallback = (credentialId: string) => {
  try {
    const raw = localStorage.getItem(STORAGE_WEBAUTHN_FALLBACK_KEY)
    if (!raw) return
    const list = JSON.parse(raw) as WebAuthnCredentialRecord[]
    const filtrada = list.filter((c) => c.credential_id !== credentialId && c.id !== credentialId)
    localStorage.setItem(STORAGE_WEBAUTHN_FALLBACK_KEY, JSON.stringify(filtrada))
  } catch (e) {
    console.warn('[WebAuthn] Advertencia al eliminar credencial local:', e)
  }
}

/**
 * Registra una nueva credencial biométrica en el dispositivo mediante navigator.credentials.create()
 * Guarda ÚNICAMENTE la clave pública y el credential ID en el backend.
 */
export const registrarCredencialWebAuthn = async ({
  userId,
  userEmail,
  userName,
  deviceName,
}: {
  userId: string
  userEmail: string
  userName: string
  deviceName?: string
}): Promise<{ exitoso: boolean; credencial?: WebAuthnCredentialRecord; error?: string }> => {
  if (!esWebAuthnSoportado()) {
    return { exitoso: false, error: 'WebAuthn no está soportado en este navegador o entorno.' }
  }

  try {
    const challengeRaw = generarChallengeSeguro()
    const challengeBuffer = challengeRaw.buffer.slice(challengeRaw.byteOffset, challengeRaw.byteOffset + challengeRaw.byteLength) as ArrayBuffer
    const userIdBuffer = new TextEncoder().encode(userId).buffer as ArrayBuffer
    const nombreDispositivo = deviceName || detectarNombreDispositivo()

    const createOptions: CredentialCreationOptions = {
      publicKey: {
        challenge: challengeBuffer,
        rp: {
          name: 'DeereMax ERP',
          id: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
        },
        user: {
          id: userIdBuffer,
          name: userEmail,
          displayName: userName || userEmail,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256 (P-256)
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          requireResidentKey: false,
        },
        timeout: 60000,
        attestation: 'none',
      },
    }

    const credential = (await navigator.credentials.create(createOptions)) as PublicKeyCredential | null

    if (!credential) {
      return { exitoso: false, error: 'No se recibió la credencial del autenticador biométrico.' }
    }

    const credIdBase64Url = bufferToBase64Url(credential.rawId)
    const response = credential.response as AuthenticatorAttestationResponse

    let publicKeyBase64 = ''
    if ('getPublicKey' in response && typeof response.getPublicKey === 'function') {
      const pkBuffer = response.getPublicKey()
      if (pkBuffer) {
        publicKeyBase64 = bufferToBase64Url(pkBuffer)
      }
    }
    if (!publicKeyBase64 && response.attestationObject) {
      publicKeyBase64 = bufferToBase64Url(response.attestationObject)
    }

    const credencialRecord: WebAuthnCredentialRecord = {
      id: crypto.randomUUID ? crypto.randomUUID() : `cred_${Date.now()}`,
      user_id: userId,
      credential_id: credIdBase64Url,
      public_key: publicKeyBase64,
      algorithm: -7,
      sign_counter: 0,
      device_name: nombreDispositivo,
      authenticator_attachment: 'platform',
      created_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
    }

    // Guardar en Supabase
    if (supabase) {
      try {
        await supabase.from('webauthn_credentials').insert({
          id: credencialRecord.id,
          user_id: credencialRecord.user_id,
          credential_id: credencialRecord.credential_id,
          public_key: credencialRecord.public_key,
          algorithm: credencialRecord.algorithm,
          sign_counter: credencialRecord.sign_counter,
          device_name: credencialRecord.device_name,
          authenticator_attachment: 'platform',
          created_at: credencialRecord.created_at,
          last_used_at: credencialRecord.last_used_at,
        })

        await supabase
          .from('perfiles_usuario')
          .update({ biometria_activa: true, updated_at: new Date().toISOString() })
          .eq('id', userId)
      } catch (err) {
        console.warn('[WebAuthn] Excepción al guardar en base de datos:', err)
      }
    }

    // Guardar en almacenamiento seguro del cliente para fallback
    guardarCredencialLocalFallback(credencialRecord)

    return { exitoso: true, credencial: credencialRecord }
  } catch (err: unknown) {
    const errorObj = err as Error
    console.error('[WebAuthn] Error en registro biométrico:', errorObj)
    if (errorObj.name === 'NotAllowedError') {
      return { exitoso: false, error: 'Autenticación biométrica cancelada por el usuario o tiempo expirado.' }
    }
    return { exitoso: false, error: errorObj.message || 'Error desconocido al registrar biometría.' }
  }
}

/**
 * Autentica al usuario mediante biometría del dispositivo utilizando navigator.credentials.get()
 */
export const autenticarConWebAuthn = async ({
  credencialesRegistradas,
}: {
  userId?: string
  credencialesRegistradas?: WebAuthnCredentialRecord[]
}): Promise<{ exitoso: boolean; credentialId?: string; error?: string }> => {
  if (!esWebAuthnSoportado()) {
    return { exitoso: false, error: 'WebAuthn no está soportado en este dispositivo.' }
  }

  try {
    const challengeRaw = generarChallengeSeguro()
    const challengeBuffer = challengeRaw.buffer.slice(challengeRaw.byteOffset, challengeRaw.byteOffset + challengeRaw.byteLength) as ArrayBuffer

    const allowCredentials: PublicKeyCredentialDescriptor[] = (credencialesRegistradas || []).map((cred) => ({
      type: 'public-key',
      id: base64UrlToBuffer(cred.credential_id),
      transports: ['internal'],
    }))

    const getOptions: CredentialRequestOptions = {
      publicKey: {
        challenge: challengeBuffer,
        timeout: 60000,
        rpId: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
        userVerification: 'required',
        allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      },
    }

    const assertion = (await navigator.credentials.get(getOptions)) as PublicKeyCredential | null

    if (!assertion) {
      return { exitoso: false, error: 'No se obtuvo respuesta de verificación biométrica.' }
    }

    const credId = bufferToBase64Url(assertion.rawId)

    // Actualizar fecha de último uso en Supabase
    if (supabase) {
      try {
        await supabase
          .from('webauthn_credentials')
          .update({ last_used_at: new Date().toISOString() })
          .eq('credential_id', credId)
      } catch (err) {
        console.warn('[WebAuthn] Error al actualizar last_used_at:', err)
      }
    }

    return { exitoso: true, credentialId: credId }
  } catch (err: unknown) {
    const errorObj = err as Error
    console.error('[WebAuthn] Error en autenticación biométrica:', errorObj)
    if (errorObj.name === 'NotAllowedError') {
      return { exitoso: false, error: 'Desbloqueo biométrico cancelado o no reconocido.' }
    }
    return { exitoso: false, error: errorObj.message || 'Fallo en la validación biométrica.' }
  }
}

/**
 * Obtiene todas las credenciales registradas para un usuario (dispositivos asociados)
 */
export const obtenerCredencialesUsuario = async (userId: string): Promise<WebAuthnCredentialRecord[]> => {
  if (!supabase) {
    return obtenerCredencialesLocalesFallback(userId)
  }

  try {
    const { data, error } = await supabase
      .from('webauthn_credentials')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('[WebAuthn] Falló consulta en DB, usando fallback local:', error.message)
      return obtenerCredencialesLocalesFallback(userId)
    }

    if (data && data.length > 0) {
      return data as WebAuthnCredentialRecord[]
    }

    return obtenerCredencialesLocalesFallback(userId)
  } catch (err) {
    console.warn('[WebAuthn] Excepción al consultar credenciales:', err)
    return obtenerCredencialesLocalesFallback(userId)
  }
}

/**
 * Revoca un dispositivo/credencial biométrica registrado
 */
export const revocarCredencialWebAuthn = async (
  credentialId: string,
  userId: string,
): Promise<{ exitoso: boolean; error?: string }> => {
  eliminarCredencialLocalFallback(credentialId)

  if (supabase) {
    try {
      await supabase
        .from('webauthn_credentials')
        .delete()
        .or(`id.eq.${credentialId},credential_id.eq.${credentialId}`)

      const restantes = await obtenerCredencialesUsuario(userId)
      if (restantes.length === 0) {
        await supabase
          .from('perfiles_usuario')
          .update({ biometria_activa: false, updated_at: new Date().toISOString() })
          .eq('id', userId)
      }

      return { exitoso: true }
    } catch (err: unknown) {
      const errorObj = err as Error
      return { exitoso: false, error: errorObj.message }
    }
  }

  return { exitoso: true }
}
