import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { signInWithPhone, verifyPhoneOTP, signOut as supabaseSignOut } from '../lib/supabase'
import api from '../lib/api'

export function useAuth() {
  const { setUser, setTokens, setPhone, logout: storeLogout, user, isAuthenticated } = useAuthStore()
  const queryClient = useQueryClient()

  const sendOTP = useMutation({
    mutationFn: async (phone) => {
      await signInWithPhone(phone)
      setPhone(phone)
      return phone
    },
  })

  const verifyOTP = useMutation({
    mutationFn: async ({ phone, otp, pin }) => {
      const res = await verifyPhoneOTP(phone, otp)
      const session = res.session
      if (!session?.access_token) {
        throw new Error('Authentication did not return a session')
      }

      setTokens(session.access_token, session.refresh_token)
      const { data: userData } = await api.get('/users/me')
      setUser(userData)
      return userData
    },
  })

  const loginWithPIN = useMutation({
    mutationFn: async ({ phone, pin }) => {
      console.log('useAuth loginWithPIN called with:', { phone, pin })
      const { data } = await api.post('/auth/login', { phone, pin })
      console.log('Login response:', data)
      if (data.access_token) {
        setTokens(data.access_token, data.refresh_token)
      }
      const { data: userData } = await api.get('/users/me')
      console.log('User data:', userData)
      setUser(userData)
      return userData
    },
  })

  const setupPIN = useMutation({
    mutationFn: async ({ phone, pin }) => {
      const { data } = await api.post('/auth/setup-pin', { phone, pin })
      if (data.access_token) {
        setTokens(data.access_token, data.refresh_token)
      }
      const { data: userData } = await api.get('/users/me')
      setUser(userData)
      return data
    },
  })

  const resetPIN = useMutation({
    mutationFn: async ({ phone, otp, new_pin }) => {
      const { data } = await api.post('/auth/reset-pin', { phone, otp, new_pin })
      return data
    },
  })

  const logout = async () => {
    await supabaseSignOut()
    storeLogout()
    queryClient.clear()
  }

  return {
    user,
    isAuthenticated,
    sendOTP,
    verifyOTP,
    loginWithPIN,
    setupPIN,
    resetPIN,
    logout,
  }
}

export function useUserProfile() {
  return useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const { data } = await api.get('/users/me')
      return data
    },
    enabled: !!localStorage.getItem('adansi_access_token'),
  })
}
