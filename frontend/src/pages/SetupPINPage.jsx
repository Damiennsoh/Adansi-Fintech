import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Loader2, ArrowLeft, Lock } from 'lucide-react'

export default function SetupPINPage() {
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const { verifyOTP } = useAuth()
  const phone = location.state?.phone

  if (!phone) {
    navigate('/login')
    return null
  }

  const handleSetup = async (e) => {
    e.preventDefault()
    if (pin !== confirmPin) {
      alert('PINs do not match')
      return
    }

    try {
      await verifyOTP.mutateAsync({ phone, otp: location.state?.otp || '', pin })
      navigate('/dashboard')
    } catch (err) {
      alert('Failed to set up PIN. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-adansi-secondary flex flex-col px-6 pt-12">
      <button onClick={() => navigate('/verify-otp')} className="text-gray-400 mb-8 flex items-center gap-2">
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      <div className="max-w-sm mx-auto w-full">
        <div className="text-center mb-8">
          <Lock className="w-12 h-12 text-adansi-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Create PIN</h1>
          <p className="text-gray-400">Set a 4-digit PIN for quick login</p>
        </div>

        <form onSubmit={handleSetup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">New PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white text-center text-2xl tracking-[0.5em] placeholder-gray-600 focus:outline-none focus:border-adansi-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Confirm PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white text-center text-2xl tracking-[0.5em] placeholder-gray-600 focus:outline-none focus:border-adansi-primary"
            />
          </div>

          <button
            type="submit"
            disabled={verifyOTP.isPending || pin.length !== 4 || confirmPin.length !== 4}
            className="w-full bg-adansi-primary text-adansi-secondary font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            {verifyOTP.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create PIN'}
          </button>
        </form>
      </div>
    </div>
  )
}
