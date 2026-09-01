import axios from 'axios'
import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

api.interceptors.request.use(
  async (config) => {
    // Always check localStorage first for local JWT tokens
    const token = localStorage.getItem('adansi_access_token')
    
    // Fall back to Supabase session if no local token
    if (!token && supabase) {
      const { data } = await supabase.auth.getSession()
      const supabaseToken = data.session?.access_token
      if (supabaseToken) {
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${supabaseToken}`
        console.log('API Request interceptor: Using Supabase token')
        return config
      }
    }
    
    console.log('API Request interceptor:', { url: config.url, hasToken: !!token, tokenPreview: token ? token.substring(0, 20) + '...' : 'none' })
    
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
    
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      const token = localStorage.getItem('adansi_access_token')
      if (token && token.startsWith('demo-')) {
        return Promise.reject(error)
      }

      try {
        const refreshToken = localStorage.getItem('adansi_refresh_token')
        if (!refreshToken || refreshToken.startsWith('demo-')) throw new Error('No refresh token available')

        const { data } = await axios.post(`${API_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        })

        const nextAccessToken = data.access_token || data.session?.access_token
        if (!nextAccessToken) throw new Error('Refresh response did not include an access token')

        localStorage.setItem('adansi_access_token', nextAccessToken)
        api.defaults.headers.common['Authorization'] = `Bearer ${nextAccessToken}`
        originalRequest.headers['Authorization'] = `Bearer ${nextAccessToken}`

        return api(originalRequest)
      } catch (refreshError) {
        localStorage.removeItem('adansi_access_token')
        localStorage.removeItem('adansi_refresh_token')
        localStorage.removeItem('adansi_user')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api
