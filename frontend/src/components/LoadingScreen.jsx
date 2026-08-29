import { Loader2 } from 'lucide-react'

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-adansi-secondary flex flex-col items-center justify-center z-50">
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-adansi-primary/20 animate-pulse-ring absolute inset-0" />
        <div className="w-16 h-16 rounded-full bg-adansi-primary flex items-center justify-center relative z-10">
          <Loader2 className="w-8 h-8 text-adansi-secondary animate-spin" />
        </div>
      </div>
      <p className="mt-6 text-white font-medium">Loading Adansi...</p>
    </div>
  )
}
