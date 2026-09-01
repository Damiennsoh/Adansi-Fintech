import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
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
    const formattedPhone = `+233${phone.replace(/^0/, '')}`
    console.log('PIN Login attempt:', { phone: formattedPhone, pin })
    try {
      await loginWithPIN.mutateAsync({ 
        phone: formattedPhone, 
        pin 
      })
      navigate('/dashboard')
    } catch (err) {
      console.error('PIN Login error:', err)
      alert('Invalid PIN. Please try again.')
    }
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
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Enter Your PIN (4-6 digits)</label>
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

      </div>
    </div>
  )
}
