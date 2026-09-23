import { CheckCircle2, AlertCircle, X } from 'lucide-react'
import { useToastStore } from '../store/toastStore'

export default function ToastViewport() {
  const { toasts, dismissToast } = useToastStore()

  if (!toasts.length) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[80] flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg ${
            toast.type === 'error'
              ? 'border-red-100 bg-white text-red-800'
              : 'border-adansi-primary/30 bg-white text-gray-900'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
          )}
          <p className="flex-1 text-sm font-medium leading-5">{toast.message}</p>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
