import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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

export async function signInWithPhone(phone) {
  const { data, error } = await supabase.auth.signInWithOtp({
    phone,
  })
  if (error) throw error
  return data
}

export async function verifyPhoneOTP(phone, token) {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  })
  if (error) throw error
  return data
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function subscribeToTable(table, callback, filter = '*') {
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
