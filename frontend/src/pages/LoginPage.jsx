import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAuthStore } from '../store/authStore'
import { Phone, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [step, setStep] = useState('phone') // phone | pin
  const [pin, setPin] = useState('')
  const { sendOTP, loginWithPIN } = useAuth()
  const navigate = useNavigate()

  const handleSendOTP = async (e) => {
    e.preventDefault()
    if (!phone || phone.length < 10) return

    try {
      await sendOTP.mutateAsync(`+233${phone.replace(/^0/, '')}`)
      navigate('/verify-otp', { state: { phone: `+233${phone.replace(/^0/, '')}` } })
    } catch (err) {
      alert(err.message || 'Failed to send OTP. Please try again.')
    }
  }

  const handlePINLogin = async (e) => {
    e.preventDefault()
    try {
      await loginWithPIN.mutateAsync({ 
        phone: `+233${phone.replace(/^0/, '')}`, 
        pin 
      })
      navigate('/dashboard')
    } catch (err) {
      alert('Invalid PIN. Please try again.')
    }
  }

  const handleDemoLogin = () => {
    const { setUser, setTokens } = useAuthStore.getState()
    setUser({
      id: 'demo-user-123',
      phone: '+233240000000',
      full_name: 'Damien Nsoh (Demo User)',
      credit_score: 720,
      total_contributed: 1500.00,
      groups_count: 3,
      is_verified: true
    })
    setTokens('demo-access-token-xyz', 'demo-refresh-token-xyz')
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-adansi-secondary flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-adansi-primary rounded-2xl mx-auto flex items-center justify-center mb-4">
            <span className="text-3xl font-bold text-adansi-secondary">A</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome to Adansi</h1>
          <p className="text-gray-400 mt-2">The Collective Finance Protocol</p>
        </div>

        {step === 'phone' ? (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="024 000 0000"
                  className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-adansi-primary"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={sendOTP.isPending || phone.length < 9}
              className="w-full bg-adansi-primary text-adansi-secondary font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            >
              {sendOTP.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send OTP'}
            </button>

            <button
              type="button"
              onClick={() => setStep('pin')}
              className="w-full text-gray-400 text-sm py-2 hover:text-white transition-colors"
            >
              Already have a PIN? Login with PIN
            </button>
          </form>
        ) : (
          <form onSubmit={handlePINLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Enter PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white text-center text-2xl tracking-[0.5em] placeholder-gray-600 focus:outline-none focus:border-adansi-primary"
              />
            </div>

            <button
              type="submit"
              disabled={loginWithPIN.isPending || pin.length < 4}
              className="w-full bg-adansi-primary text-adansi-secondary font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            >
              {loginWithPIN.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Login'}
            </button>

            <div className="flex justify-between items-center text-xs">
              <button
                type="button"
                onClick={() => setStep('phone')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Back to phone login
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetPhone = phone ? `+233${phone.replace(/^0/, '')}` : '+233240000000'
                  sendOTP.mutate(targetPhone)
                  navigate('/verify-otp', { state: { phone: targetPhone, mode: 'reset' } })
                }}
                className="text-adansi-primary hover:underline transition-all"
              >
                Forgot PIN?
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-white/10 text-center">
          <button
            type="button"
            onClick={handleDemoLogin}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/20 text-adansi-primary font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
          >
            ⚡ Quick Demo Access (Explore All UI Features)
          </button>
        </div>
      </div>
    </div>
  )
}
