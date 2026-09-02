import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { useNavigate } from 'react-router-dom'
import { 
  Globe, ArrowLeft, Search, CreditCard, TrendingUp, 
  CheckCircle2, Loader2, AlertCircle, Clock
} from 'lucide-react'
import { formatCurrency } from '../lib/utils'

const currencies = {
  USD: { flag: 'US' },
  GBP: { flag: 'GB' },
  EUR: { flag: 'EU' },
  CAD: { flag: 'CA' },
}


export default function DiasporaPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState('select') // select | amount | payment | success
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [amountGHS, setAmountGHS] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [payerName, setPayerName] = useState('')
  const [searchCode, setSearchCode] = useState('')
  const [foundGroup, setFoundGroup] = useState(null)
  const [hasSearched, setHasSearched] = useState(false)
  const ratesQuery = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: async () => {
      const entries = await Promise.all(Object.keys(currencies).map(async (base) => {
        const { data } = await api.get(`/rates/${base}`)
        return [base, { ...currencies[base], rate: Number(data.rate), quoteId: data.quote_id, fetchedAt: data.fetched_at, expiresAt: data.expires_at, cached: data.cached }]
      }))
      return Object.fromEntries(entries)
    },
    staleTime: 10 * 60 * 1000,
  })
  const liveRates = ratesQuery.data || {}
  const selectedRate = liveRates[currency]
  const rate = selectedRate?.rate || 0
  const foreignAmount = amountGHS && rate > 0 ? (parseFloat(amountGHS) / rate).toFixed(2) : '0.00'
  const fee = amountGHS ? (parseFloat(amountGHS) * 0.01).toFixed(2) : '0.00'
  const total = amountGHS ? (parseFloat(amountGHS) + parseFloat(fee)).toFixed(2) : '0.00'

  const handleSearch = async () => {
    const query = searchCode.trim()
    if (!query) return

    setHasSearched(true)
    try {
      const { data } = await api.get('/groups/search', { params: { query } })
      const results = Array.isArray(data) ? data : []
      const match = results[0] || null

      if (match) {
        setFoundGroup({
          ...match,
          members: match.member_count ?? match.members ?? 0,
          balance: match.current_balance ?? match.balance ?? 0,
        })
        return
      }

      const fallback = await api.get(`/groups/code/${encodeURIComponent(query)}`)
      const group = fallback.data
      setFoundGroup({
        ...group,
        members: group.member_count ?? group.members ?? 0,
        balance: group.current_balance ?? group.balance ?? 0,
      })
    } catch {
      setFoundGroup(null)
    }
  }

  const handleContribute = () => {
    window.alert('Hubtel card checkout is not configured for this environment yet. No contribution was recorded.')
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Contribution Sent!</h2>
        <p className="text-gray-500 text-center mb-6">
          {currencies[currency].flag} {foreignAmount} {currency} → GHS {amountGHS}
        </p>
        <p className="text-sm text-gray-400 text-center">
          Your family will receive an SMS confirmation.
        </p>
        <button 
          onClick={() => { setStep('select'); setAmountGHS(''); setFoundGroup(null); setSearchCode('') }}
          className="mt-8 px-6 py-3 bg-adansi-primary text-adansi-secondary font-bold rounded-xl"
        >
          Send Another
        </button>
      </div>
    )
  }

  if (step === 'payment') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 border-4 border-adansi-primary border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-gray-900 mb-2">Processing Payment...</h2>
        <p className="text-gray-500 text-center text-sm">Please do not close this window</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-adansi-secondary px-5 pt-8 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Diaspora Bridge</h1>
            <p className="text-gray-400 text-xs">Send money home from anywhere</p>
          </div>
        </div>

        {/* Exchange Rate Ticker */}
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
          {Object.entries(liveRates).map(([curr, data]) => (
            <button
              key={curr}
              onClick={() => setCurrency(curr)}
              className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                currency === curr ? 'bg-adansi-primary text-adansi-secondary' : 'bg-white/10 text-white'
              }`}
            >
              <span className="mr-1">{data.flag}</span>
              1 {curr} = GHS {data.rate}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-6 space-y-6">
        {step === 'select' && (
          <>
            {/* Search by name or code */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-2">Find Group by Name or Code</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchCode}
                  onChange={(e) => { setSearchCode(e.target.value); setFoundGroup(null); setHasSearched(false) }}
                  placeholder="e.g. Family Circle or FNRL01"
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-adansi-primary"
                />
              </div>
              <button
                onClick={handleSearch}
                className="w-full mt-3 bg-adansi-secondary text-white font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-transform"
              >
                Find Group
              </button>

              {hasSearched && foundGroup === null && (
                <p className="text-red-500 text-xs mt-2 text-center">Group not found. Try the group name, code, or a close match.</p>
              )}

              {foundGroup && (
                <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center text-white font-bold">
                      {foundGroup.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-sm">{foundGroup.name}</p>
                      <p className="text-xs text-gray-500">{foundGroup.members} members • {formatCurrency(foundGroup.balance)} raised</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setSelectedGroup(foundGroup); setStep('amount') }}
                    className="w-full mt-3 bg-adansi-primary text-adansi-secondary font-bold py-2.5 rounded-xl text-sm"
                  >
                    Contribute to This Group
                  </button>
                </div>
              )}
            </div>

            {/* Popular Groups */}
            <div>
              <h3 className="font-bold text-gray-900 mb-3">Popular Groups</h3>
              <div className="space-y-3">
                {[].map(group => (
                  <button
                    key={group.id}
                    onClick={() => { setSelectedGroup(group); setStep('amount') }}
                    className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left active:scale-[0.98] transition-transform"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center text-white font-bold">
                        {group.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{group.name}</p>
                        <p className="text-xs text-gray-500">{group.members} members</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(group.balance)}</p>
                        <p className="text-[10px] text-gray-400">of {formatCurrency(group.target)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 'amount' && selectedGroup && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Contributing to</p>
              <p className="font-bold text-gray-900">{selectedGroup.name}</p>
            </div>

            <div className="text-center">
              <p className="text-gray-500 text-sm mb-2">Enter Amount in GHS</p>
              <div className="flex items-center justify-center gap-1">
                <span className="text-2xl text-gray-400">GHS</span>
                <input
                  type="number"
                  value={amountGHS}
                  onChange={(e) => setAmountGHS(e.target.value)}
                  placeholder="0.00"
                  className="text-5xl font-bold text-center w-48 bg-transparent focus:outline-none text-gray-900"
                  autoFocus
                />
              </div>
              {amountGHS && (
                <p className="text-sm text-gray-500 mt-2">
                  {liveRates[currency].flag} {foreignAmount} {currency} at live rate {rate.toFixed(4)}{ratesQuery.isFetching ? ' (refreshing...)' : ''}
                </p>
              )}
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Payer Name</label>
                <input
                  type="text"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  placeholder="Enter the name people should see"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-adansi-primary"
                />
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-medium">GHS {amountGHS || '0.00'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Service Fee (1%)</span>
                  <span className="font-medium">GHS {fee}</span>
                </div>
                <div className="border-t border-gray-100 pt-3 flex justify-between">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="font-bold text-gray-900">GHS {total}</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900">Secure Card Payment</p>
                <p className="text-xs text-blue-700 mt-1">Pay with Visa, Mastercard, or PayPal. Funds settle directly into the group MoMo wallet.</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              For diaspora users without a Ghana SIM, create an account using your email and keep the payer name here so the group can see who sent the contribution.
            </div>

            <button
              onClick={handleContribute}
                disabled={!selectedRate || rate <= 0 || !amountGHS || parseFloat(amountGHS) <= 0 || !payerName.trim()}
              className="w-full bg-adansi-primary text-adansi-secondary font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            >
              Pay {currencies[currency].flag} {foreignAmount} {currency}
            </button>

            <button
              onClick={() => setStep('select')}
              className="w-full text-gray-500 text-sm py-2"
            >
              Choose Different Group
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
