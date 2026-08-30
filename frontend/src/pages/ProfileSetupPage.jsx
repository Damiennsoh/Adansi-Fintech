import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../lib/api'
import { User, CreditCard, ArrowRight, ShieldCheck } from 'lucide-react'

export default function ProfileSetupPage() {
  const [fullName, setFullName] = useState('')
  const [ghanaCardNumber, setGhanaCardNumber] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { setUser } = useAuthStore()
  const phone = location.state?.phone || '+233240000000'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!fullName.trim()) return

    setIsSubmitting(true)
    try {
      let userData = {
        id: 'user-' + Date.now(),
        phone,
        full_name: fullName.trim(),
        ghana_card_number: ghanaCardNumber.trim() || null,
        role: 'user',
        credit_score: 400
      }

      try {
        const { data } = await api.patch('/auth/profile', {
          phone,
          full_name: fullName.trim(),
          ghana_card_number: ghanaCardNumber.trim() || null
        })
        if (data?.user) userData = data.user
      } catch (err) {
        console.warn('API profile update fallback:', err)
      }

      setUser(userData)
      navigate('/setup-pin', { state: { phone, fullName: fullName.trim() } })
    } catch (err) {
      alert('Failed to save profile. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-adansi-secondary flex flex-col justify-center px-6 py-12">
      <div className="max-w-sm mx-auto w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-adansi-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-adansi-primary/30">
            <ShieldCheck className="w-8 h-8 text-adansi-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Complete Profile</h1>
          <p className="text-gray-400 text-sm">Tell us your name so group members can identify your contributions</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Full Name <span className="text-adansi-primary">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Amina Owusu"
                required
                className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-adansi-primary text-base"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Ghana Card Number <span className="text-gray-500 text-xs">(Optional)</span>
            </label>
            <div className="relative">
              <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={ghanaCardNumber}
                onChange={(e) => setGhanaCardNumber(e.target.value.toUpperCase())}
                placeholder="GHA-712345678-9"
                className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-adansi-primary text-base"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Unlocks higher loan eligibility tiers</p>
          </div>

          <button
            type="submit"
            disabled={!fullName.trim() || isSubmitting}
            className="w-full bg-adansi-primary text-adansi-secondary font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 mt-4"
          >
            {isSubmitting ? 'Saving...' : (
              <>
                <span>Continue to Set PIN</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
