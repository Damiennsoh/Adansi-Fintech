import { create } from 'zustand'

export const useToastStore = create((set, get) => ({
  toasts: [],
  showToast: (message, type = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }))
    window.setTimeout(() => get().dismissToast(id), 4000)
    return id
  },
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
  },
}))
