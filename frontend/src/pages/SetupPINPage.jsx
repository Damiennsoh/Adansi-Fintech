import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Loader2, ArrowLeft, Lock } from 'lucide-react'
import api from '../lib/api'

export default function SetupPINPage() {
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading, setLoading] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { setupPIN } = useAuth()
  const phone = location.state?.phone
  const isReset = location.state?.mode === 'reset'
  const otp = location.state?.otp

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
    if (pin.length < 4) {
      alert('PIN must be at least 4 digits')
      return
    }

    setLoading(true)
    try {
      if (isReset) {
        await api.post('/auth/reset-pin', {
          phone,
          otp: otp || '',
          new_pin: pin,
        })
        alert('PIN reset successful. Please login with your new PIN.')
        navigate('/login')
      } else {
        await setupPIN.mutateAsync({ phone, pin, otp })
        navigate('/dashboard')
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to set up PIN. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-adansi-secondary flex flex-col px-6 pt-12">
      <button onClick={() => navigate('/verify-otp', { state: { phone, mode: isReset ? 'reset' : undefined } })} className="text-gray-400 mb-8 flex items-center gap-2">
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      <div className="max-w-sm mx-auto w-full">
        <div className="text-center mb-8">
          <Lock className="w-12 h-12 text-adansi-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">{isReset ? 'Reset PIN' : 'Create PIN'}</h1>
          <p className="text-gray-400">{isReset ? 'Set a new 4-digit PIN' : 'Set a 4-digit PIN for quick login'}</p>
        </div>

        <form onSubmit={handleSetup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">New PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••"
              className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white text-center text-2xl tracking-[0.5em] placeholder-gray-600 focus:outline-none focus:border-adansi-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Confirm PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••"
              className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white text-center text-2xl tracking-[0.5em] placeholder-gray-600 focus:outline-none focus:border-adansi-primary"
            />
          </div>

          <button
            type="submit"
            disabled={loading || pin.length < 4 || confirmPin.length < 4}
            className="w-full bg-adansi-primary text-adansi-secondary font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : isReset ? 'Reset PIN' : 'Create PIN'}
          </button>
        </form>
      </div>
    </div>
  )
}
