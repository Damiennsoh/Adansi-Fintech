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
      const { session } = await verifyPhoneOTP(phone, otp)

      const { data: userData } = await api.get('/users/me')
      setUser(userData)
      setTokens(session.access_token, session.refresh_token)
      return userData
    },
  })

  const loginWithPIN = useMutation({
    mutationFn: async ({ phone, pin }) => {
      const { data } = await api.post('/auth/login', { phone, pin })
      setUser(data.user)
      setTokens(data.access_token, data.refresh_token)
      return data.user
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
