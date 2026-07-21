import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const publishableFromEnv = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
const anonFromEnv = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const supabasePublishableKey = publishableFromEnv || anonFromEnv

export const supabaseConfigError = !supabaseUrl || !supabasePublishableKey
  ? 'Faltan variables de Supabase: VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY (o VITE_SUPABASE_ANON_KEY).'
  : null

if (supabaseConfigError) {
  console.error('Configuracion de Supabase incompleta', {
    hasUrl: Boolean(supabaseUrl),
    hasPublishableKey: Boolean(supabasePublishableKey),
  })
}

if (publishableFromEnv && anonFromEnv && publishableFromEnv !== anonFromEnv) {
  console.warn(
    '[Supabase] VITE_SUPABASE_PUBLISHABLE_KEY y VITE_SUPABASE_ANON_KEY son diferentes. Revisa que ambos pertenezcan al mismo proyecto.',
  )
}

try {
  const host = new URL(supabaseUrl).host
  const proyecto = host.split('.')[0]
  console.info('[Supabase] Proyecto activo:', proyecto)
} catch {
  console.warn('[Supabase] URL invalida en VITE_SUPABASE_URL')
}

export const supabase = supabaseConfigError
  ? (null as unknown as ReturnType<typeof createClient>)
  : createClient(supabaseUrl, supabasePublishableKey as string)
