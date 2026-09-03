import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Phone, Mail, Loader2, UserRound, LockKeyhole } from 'lucide-react'
import api from '../lib/api'

export default function LoginPage() {
  const [mode, setMode] = useState('phone')
  const [phoneAction, setPhoneAction] = useState('otp')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
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
    const payload = mode === 'email'
      ? { email, pin }
      : { phone: `+233${phone.replace(/^0/, '')}`, pin }

    try {
      await loginWithPIN.mutateAsync(payload)
      navigate('/dashboard')
    } catch (err) {
      alert(err.response?.data?.detail || 'Invalid credentials. Please try again.')
    }
  }

  const handleEmailRegister = async (e) => {
    e.preventDefault()
    if (!email || !fullName || pin.length < 4) return

    try {
      const response = await api.post('/auth/register', {
        email: email.trim().toLowerCase(),
        full_name: fullName.trim(),
        pin,
      })
      alert(response.data?.message || 'Account created. Check your email to verify your account, then sign in.')
      setPin('')
    } catch (err) {
      alert(err.response?.data?.detail || 'We could not create your account. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-adansi-secondary flex flex-col items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-adansi-primary rounded-2xl mx-auto flex items-center justify-center mb-4">
            <span className="text-3xl font-bold text-adansi-secondary">A</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome to Adansi</h1>
          <p className="text-gray-400 mt-2">The Collective Finance Protocol</p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-xl bg-white/5 p-1 border border-white/10">
          <button
            type="button"
            onClick={() => setMode('phone')}
            className={`py-2.5 rounded-lg text-sm font-medium transition ${mode === 'phone' ? 'bg-adansi-primary text-adansi-secondary' : 'text-gray-300'}`}
          >
            Phone
          </button>
          <button
            type="button"
            onClick={() => setMode('email')}
            className={`py-2.5 rounded-lg text-sm font-medium transition ${mode === 'email' ? 'bg-adansi-primary text-adansi-secondary' : 'text-gray-300'}`}
          >
            Email
          </button>
        </div>

        {mode === 'phone' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/5 p-1 border border-white/10">
              <button
                type="button"
                onClick={() => setPhoneAction('otp')}
                className={`py-2.5 rounded-lg text-sm font-medium transition ${phoneAction === 'otp' ? 'bg-adansi-primary text-adansi-secondary' : 'text-gray-300'}`}
              >
                OTP login
              </button>
              <button
                type="button"
                onClick={() => setPhoneAction('pin')}
                className={`py-2.5 rounded-lg text-sm font-medium transition ${phoneAction === 'pin' ? 'bg-adansi-primary text-adansi-secondary' : 'text-gray-300'}`}
              >
                Login with PIN
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Use OTP for first-time access or if you do not have a PIN yet. Returning users can sign in faster with their PIN.
            </p>

            {phoneAction === 'otp' ? (
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
                  {sendOTP.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send verification code'}
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
                  <label className="block text-sm font-medium text-gray-300 mb-2">Enter your PIN</label>
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
                  disabled={loginWithPIN.isPending || pin.length < 4 || phone.length < 9}
                  className="w-full bg-adansi-primary text-adansi-secondary font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                >
                  {loginWithPIN.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Login'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const targetPhone = phone ? `+233${phone.replace(/^0/, '')}` : '+233240000000'
                    sendOTP.mutate(targetPhone)
                    navigate('/verify-otp', { state: { phone: targetPhone, mode: 'reset' } })
                  }}
                  className="w-full text-sm text-adansi-primary hover:underline"
                >
                  Forgot PIN?
                </button>
              </form>
            )}

          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-gray-300">
              Diaspora users can create an account with email and keep the payer name visible for group contributions.
            </div>

            <form onSubmit={handleEmailRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                <div className="relative">
                  <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ama Boateng"
                    className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-adansi-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-adansi-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Create PIN</label>
                <div className="relative">
                  <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••"
                    className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white text-center tracking-[0.4em] placeholder-gray-500 focus:outline-none focus:border-adansi-primary"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loginWithPIN.isPending || !email || !fullName || pin.length < 4}
                className="w-full bg-adansi-primary text-adansi-secondary font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              >
                {loginWithPIN.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Email Account'}
              </button>

              <button
                type="button"
                onClick={() => setMode('phone')}
                className="w-full text-gray-300 text-sm py-2 hover:text-white transition-colors"
              >
                Back to phone login
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
