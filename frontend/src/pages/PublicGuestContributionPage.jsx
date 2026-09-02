import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CreditCard, Users, Wallet, ShieldCheck, CheckCircle2, Loader2 } from 'lucide-react'
import api from '../lib/api'
import { formatCurrency } from '../lib/utils'

export default function PublicGuestContributionPage() {
  const { code } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState('')
  const [payerName, setPayerName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const normalizedCode = (code || '').trim()
        if (!normalizedCode) {
          throw new Error('Missing group code')
        }

        const directResponse = await api.get(`/groups/code/${encodeURIComponent(normalizedCode)}`)
        setGroup(directResponse.data)
        if (searchParams.get('name')) {
          setPayerName(searchParams.get('name'))
        }
        return
      } catch (directError) {
        try {
          const fallbackResponse = await api.get('/groups/search', {
            params: { query: code || searchParams.get('name') || '' },
          })
          const matches = Array.isArray(fallbackResponse.data) ? fallbackResponse.data : []
          const match = matches.find((item) => {
            const matchCode = String(item.code || '').toUpperCase()
            const requestedCode = String(code || '').toUpperCase()
            return matchCode === requestedCode || matchCode.includes(requestedCode)
          }) || matches[0]

          if (!match) {
            throw directError
          }

          setGroup(match)
          if (searchParams.get('name')) {
            setPayerName(searchParams.get('name'))
          }
        } catch (fallbackError) {
          setError('This group link is invalid or no longer available.')
        }
      } finally {
        setLoading(false)
      }
    }

    if (code) fetchGroup()
  }, [code, searchParams])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid amount.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const guestPayload = {
        group_id: group.id,
        amount: Number(amount),
        method: paymentMethod === 'card' ? 'card' : 'momo',
        network: paymentMethod === 'card' ? 'card' : 'mtn',
        payer_name: payerName || 'Guest Contributor',
      }

      const response = await api.post('/contributions/guest', guestPayload)

      alert(`Contribution received for ${group.name}. Ref: ${response.data.transaction_ref || 'N/A'}`)
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.detail || 'We could not process this contribution right now.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#edf5f2] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#f2c94c] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !group) {
    return (
      <div className="min-h-screen bg-[#edf5f2] px-5 py-8 flex items-center justify-center">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
          <p className="text-lg font-bold text-gray-900 mb-2">Guest contribution unavailable</p>
          <p className="text-sm text-gray-600 mb-5">{error || 'This group could not be loaded.'}</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-[#f2c94c] text-[#1b1d29] font-bold py-3 rounded-xl"
          >
            Go to Adansi
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#edf5f2] text-[#1b1d29]">
      <div className="max-w-md mx-auto px-4 py-5">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/login')}
            className="p-2 rounded-full bg-white shadow-sm border border-gray-200"
          >
            <ArrowLeft className="w-5 h-5 text-[#1b1d29]" />
          </button>
          <div className="text-center flex-1">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Guest contribution</p>
          </div>
          <div className="w-9" />
        </div>

        <div className="bg-[#f25d8e] rounded-[28px] p-5 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <p className="text-sm font-medium text-white/90">Group contribution</p>
          </div>

          <h1 className="text-2xl font-black tracking-tight">{group.name}</h1>
          <div className="mt-3 flex items-center justify-between text-sm text-white/80">
            <span>Code</span>
            <span className="font-bold tracking-[0.18em]">{group.code}</span>
          </div>

          <div className="mt-5 rounded-2xl bg-white/10 border border-white/20 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-white/70">Target</p>
            <p className="text-2xl font-black mt-1">{formatCurrency(group.target_amount || group.current_balance || 0)}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
            <label className="block text-sm font-semibold text-gray-800 mb-2">Your name</label>
            <input
              type="text"
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#f2c94c]"
              placeholder="Your name or payer name"
            />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
            <label className="block text-sm font-semibold text-gray-800 mb-2">Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">GH₵</span>
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-12 pr-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#f2c94c]"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-800 mb-3">Payment method</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${paymentMethod === 'card' ? 'border-[#f2c94c] bg-[#fff9e8] text-[#1b1d29]' : 'border-gray-200 bg-gray-50 text-gray-600'}`}
              >
                <CreditCard className="w-4 h-4" /> Card
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('momo')}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${paymentMethod === 'momo' ? 'border-[#f2c94c] bg-[#fff9e8] text-[#1b1d29]' : 'border-gray-200 bg-gray-50 text-gray-600'}`}
              >
                <Wallet className="w-4 h-4" /> MoMo
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 mt-0.5" />
            <span>This contribution will be recorded in the group activity and audit log, but it will not create a new member account.</span>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !amount || Number(amount) <= 0}
            className="w-full bg-[#f2c94c] text-[#1b1d29] font-black py-4 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            {submitting ? 'Processing...' : 'Pay contribution'}
          </button>
        </form>
      </div>
    </div>
  )
}
