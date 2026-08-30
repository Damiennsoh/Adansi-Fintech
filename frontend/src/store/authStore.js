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

    if (token.startsWith('demo-')) {
      const demoUser = savedUser || {
        id: 'demo-user-123',
        phone: '+233240000000',
        full_name: 'Damien Nsoh (Demo User)',
        credit_score: 720,
        total_contributed: 1500.00,
        groups_count: 3,
        is_verified: true
      }
      set({ user: demoUser, isAuthenticated: true, isLoading: false, token })
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
        if (savedUser) {
          set({ user: savedUser, isAuthenticated: true, isLoading: false, token })
        } else {
          set({ isLoading: false, isAuthenticated: false, user: null })
        }
      }
    } catch {
      if (savedUser) {
        set({ user: savedUser, isAuthenticated: true, isLoading: false, token })
      } else {
        set({ isLoading: false, isAuthenticated: false, user: null })
      }
    }
  }
}))
