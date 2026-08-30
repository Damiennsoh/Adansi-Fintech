import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL
)?.trim()
const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_PUBLISHABLE_KEY
)?.trim()
const hasSupabaseConfig = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project.supabase.co') &&
    supabaseAnonKey !== 'your-anon-key'
)

// Keep the app bootable in previews where optional Supabase variables are not injected.
// Auth and realtime actions report the configuration issue only when explicitly used.
export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the frontend environment.'
    )
  }

  return supabase
}

export async function signInWithPhone(phone) {
  const { data, error } = await requireSupabase().auth.signInWithOtp({
    phone,
  })
  if (error) throw error
  return data
}

export async function verifyPhoneOTP(phone, token) {
  const { data, error } = await requireSupabase().auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  })
  if (error) throw error
  return data
}

export async function getCurrentUser() {
  const { data: { user } } = await requireSupabase().auth.getUser()
  return user
}

export async function signOut() {
  const { error } = await requireSupabase().auth.signOut()
  if (error) throw error
}

export function subscribeToTable(table, callback, filter = '*') {
  if (!supabase) return () => {}

  const channel = supabase
    .channel(`${table}_changes`)
    .on(
      'postgres_changes',
      { event: filter, schema: 'public', table },
      callback
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
