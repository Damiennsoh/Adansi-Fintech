import { create } from 'zustand'

export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  phone: null,

  setUser: (user) => {
    if (user) {
      localStorage.setItem('adansi_user', JSON.stringify(user))
    } else {
      localStorage.removeItem('adansi_user')
    }
    set({ user, isAuthenticated: !!user, isLoading: false })
  },
  setTokens: (token, refreshToken) => {
    localStorage.setItem('adansi_access_token', token)
    localStorage.setItem('adansi_refresh_token', refreshToken)
    set({ token, refreshToken })
  },
  setPhone: (phone) => set({ phone }),

  logout: () => {
    localStorage.removeItem('adansi_access_token')
    localStorage.removeItem('adansi_refresh_token')
    localStorage.removeItem('adansi_user')
    set({ user: null, token: null, refreshToken: null, isAuthenticated: false, phone: null })
  },

  initAuth: async () => {
    const token = localStorage.getItem('adansi_access_token')
    const savedUserRaw = localStorage.getItem('adansi_user')
    let savedUser = null
    if (savedUserRaw) {
      try { savedUser = JSON.parse(savedUserRaw) } catch (e) {}
    }

    if (!token) {
      set({ isLoading: false, isAuthenticated: false, user: null })
      return
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        const user = await response.json()
        localStorage.setItem('adansi_user', JSON.stringify(user))
        set({ user, isAuthenticated: true, isLoading: false, token })
      } else {
        localStorage.removeItem('adansi_access_token')
        localStorage.removeItem('adansi_refresh_token')
        localStorage.removeItem('adansi_user')
        set({ isLoading: false, isAuthenticated: false, user: null, token: null })
      }
    } catch {
      set({ isLoading: false, isAuthenticated: false, user: null, token: null })
    }
  }
}))
