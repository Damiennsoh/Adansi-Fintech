import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { User, CreditCard, ArrowRight, ShieldCheck } from 'lucide-react'
import api from '../lib/api'

export default function ProfileSetupPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const phone = location.state?.phone || localStorage.getItem('adansi_phone') || '+233241234567'

  const [fullName, setFullName] = useState('')
  const [ghanaCard, setGhanaCard] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!fullName.trim()) return

    setLoading(true)
    try {
      await api.patch('/auth/profile', null, {
        params: {
          phone,
          full_name: fullName,
          ghana_card_number: ghanaCard || null
        }
      })
    } catch {
      // Save locally if offline or demo
      localStorage.setItem('adansi_user_name', fullName)
    } finally {
      setLoading(false)
      navigate('/setup-pin', { state: { phone, fullName } })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between px-6 py-8">
      <div>
        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 bg-adansi-primary rounded-xl flex items-center justify-center font-bold text-adansi-secondary text-xl">
            A
          </div>
          <span className="font-bold text-gray-900 text-lg">ADANSI</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tell Us Your Name</h1>
          <p className="text-sm text-gray-500">
            This name will be visible to your group treasury members so they know who contributed or requested funds.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Amina Owusu"
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-adansi-primary focus:ring-2 focus:ring-adansi-primary/20"
                required
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Ghana Card Number <span className="text-gray-400 font-normal">(Optional for MVP)</span>
            </label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={ghanaCard}
                onChange={(e) => setGhanaCard(e.target.value.toUpperCase())}
                placeholder="GHA-724109823-1"
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm uppercase focus:outline-none focus:border-adansi-primary focus:ring-2 focus:ring-adansi-primary/20"
              />
            </div>
          </div>

          <div className="bg-adansi-secondary/5 border border-adansi-primary/20 rounded-xl p-3.5 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-adansi-secondary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600">
              Your name build trust in your group. Money is disbursed directly to named beneficiaries.
            </p>
          </div>

          <button
            type="submit"
            disabled={!fullName.trim() || loading}
            className="w-full mt-6 bg-adansi-primary text-adansi-secondary font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            {loading ? 'Saving...' : 'Continue to Set PIN'}
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </div>

      <p className="text-xs text-gray-400 text-center">Step 3 of 4 • Profile Setup</p>
    </div>
  )
}
