import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Loader2, ArrowLeft } from 'lucide-react'

export default function VerifyOTPPage() {
  const [otp, setOtp] = useState('')
  const [isNewUser, setIsNewUser] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { verifyOTP } = useAuth()
  const phone = location.state?.phone

  if (!phone) {
    navigate('/login')
    return null
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    try {
      await verifyOTP.mutateAsync({ phone, otp, pin: isNewUser ? undefined : undefined })

      if (isNewUser) {
        navigate('/setup-pin', { state: { phone } })
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      alert('Invalid OTP. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-adansi-secondary flex flex-col px-6 pt-12">
      <button onClick={() => navigate('/login')} className="text-gray-400 mb-8 flex items-center gap-2">
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      <div className="max-w-sm mx-auto w-full">
        <h1 className="text-2xl font-bold text-white mb-2">Verify OTP</h1>
        <p className="text-gray-400 mb-8">Enter the 6-digit code sent to {phone}</p>

        <form onSubmit={handleVerify} className="space-y-6">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white text-center text-3xl tracking-[0.3em] placeholder-gray-600 focus:outline-none focus:border-adansi-primary"
            autoFocus
          />

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="newUser"
              checked={isNewUser}
              onChange={(e) => setIsNewUser(e.target.checked)}
              className="w-5 h-5 rounded border-gray-500 bg-white/10 text-adansi-primary"
            />
            <label htmlFor="newUser" className="text-gray-300 text-sm">I am a new user</label>
          </div>

          <button
            type="submit"
            disabled={verifyOTP.isPending || otp.length !== 6}
            className="w-full bg-adansi-primary text-adansi-secondary font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            {verifyOTP.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify'}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-6">
          Did not receive it? <button className="text-adansi-primary font-medium">Resend</button>
        </p>
      </div>
    </div>
  )
}
