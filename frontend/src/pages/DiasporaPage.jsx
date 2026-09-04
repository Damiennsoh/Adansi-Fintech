import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { useNavigate } from 'react-router-dom'
import { 
  Globe, ArrowLeft, Search, CreditCard, TrendingUp, 
  CheckCircle2, Loader2, AlertCircle, Clock, ExternalLink
} from 'lucide-react'
import { formatCurrency } from '../lib/utils'

const currencies = {
  USD: { flag: '🇺🇸' },
  GBP: { flag: '🇬🇧' },
  EUR: { flag: '🇪🇺' },
  CAD: { flag: '🇨🇦' },
}

const PAYSTACK_SDK_URL = 'https://js.paystack.co/v1/inline.js'

function loadPaystackSDK() {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.PaystackPop) return Promise.resolve(true)
  return new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${PAYSTACK_SDK_URL}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true })
      return
    }
    const s = document.createElement('script')
    s.src = PAYSTACK_SDK_URL
    s.async = true
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.head.appendChild(s)
  })
}

const getProviderInfoCached = () => {
  return api.get('/contributions/provider/info').catch(() => ({ data: {} }))
}

export default function DiasporaPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState('select') // select | amount | payment | verifying | success | error
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [amountGHS, setAmountGHS] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [payerName, setPayerName] = useState('')
  const [payerEmail, setPayerEmail] = useState('')
  const [searchCode, setSearchCode] = useState('')
  const [foundGroup, setFoundGroup] = useState(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [pendingContribution, setPendingContribution] = useState(null)
  const [lastError, setLastError] = useState(null)
  const [providerInfo, setProviderInfo] = useState(null)

  useEffect(() => {
    getProviderInfoCached().then(r => setProviderInfo(r?.data || {}))
  }, [])

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

  const publicKey =
    providerInfo?.paystack_public_key ||
    import.meta.env.VITE_PAYSTACK_PUBLIC_KEY ||
    'pk_test_a1edd4233cb500a8b10d38357b594ced33e9c557'

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

  const handleContribute = async () => {
    if (!selectedRate || rate <= 0 || !amountGHS || parseFloat(amountGHS) <= 0 || !payerName.trim()) return
    setLastError(null)
    setStep('payment')
    try {
      const { data } = await api.post('/contributions/guest', {
        group_id: selectedGroup.id,
        amount: parseFloat(total),
        method: 'card',
        network: 'mtn',
        payer_name: payerName.trim(),
        payer_email: payerEmail.trim() || `guest-${Date.now()}@adansi.app`,
      })
      setPendingContribution(data)
      await runPaystackCheckout(data)
    } catch (err) {
      setLastError(err.response?.data?.detail || err.message || 'Failed to initialize payment')
      setStep('error')
    }
  }

  const runPaystackCheckout = async (init) => {
    const loaded = await loadPaystackSDK()
    const amountKobo = Math.round(parseFloat(total) * 100)
    const ref = init.transaction_ref || `ADNS-${Date.now()}`
    const email = payerEmail.trim() || init?.payer_email || `guest-${Date.now()}@adansi.app`

    if (loaded && window.PaystackPop && publicKey && !publicKey.startsWith('your-')) {
      const handler = window.PaystackPop.setup({
        key: publicKey,
        email,
        amount: amountKobo,
        currency: 'GHS',
        ref,
        metadata: {
          custom_fields: [
            { display_name: 'Group', variable_name: 'group', value: selectedGroup?.name || '' },
            { display_name: 'Payer', variable_name: 'payer_name', value: payerName || '' },
          ],
        },
        callback: async (response) => {
          setStep('verifying')
          try {
            const settleRes = await api.get(`/contributions/verify/paystack/${encodeURIComponent(response.reference || ref)}`)
            if (settleRes.data.status === 'processed' || settleRes.data.status === 'already_processed') {
              setStep('success')
            } else {
              setLastError(`Payment status: ${settleRes.data.status || 'unknown'}`)
              setStep('error')
            }
          } catch (verifyErr) {
            setLastError(verifyErr.response?.data?.detail || verifyErr.message || 'Payment verification failed')
            setStep('error')
          }
        },
        onClose: () => {
          setStep('amount')
        },
      })
      handler.openIframe()
      return
    }

    if (init.authorization_url) {
      setStep('verifying')
      window.open(init.authorization_url, '_blank')
      let attempts = 0
      const interval = setInterval(async () => {
        attempts += 1
        try {
          const { data } = await api.get(`/contributions/verify/paystack/${encodeURIComponent(ref)}`)
          if (data.status === 'processed' || data.status === 'already_processed') {
            clearInterval(interval)
            setStep('success')
          } else if (attempts >= 24) {
            clearInterval(interval)
            setLastError('Payment could not be confirmed automatically. Please refresh the group page to check.')
            setStep('error')
          }
        } catch {
          if (attempts >= 24) {
            clearInterval(interval)
            setLastError('Verification timed out. The group page will reflect the payment once settled.')
            setStep('error')
          }
        }
      }, 5000)
      return
    }

    if (init.sandbox || init.status === 'completed') {
      setStep('success')
      return
    }
    setLastError('Paystack SDK not loaded and no hosted checkout URL. Please check your internet connection.')
    setStep('error')
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
          onClick={() => { setStep('select'); setAmountGHS(''); setFoundGroup(null); setSearchCode(''); setSelectedGroup(null) }}
          className="mt-8 px-6 py-3 bg-adansi-primary text-adansi-secondary font-bold rounded-xl"
        >
          Send Another
        </button>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-10 h-10 text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-500 text-center mb-6 max-w-sm">{lastError || 'Please try again.'}</p>
        <button onClick={() => setStep('amount')} className="px-6 py-3 bg-adansi-primary text-adansi-secondary font-bold rounded-xl">
          Try Again
        </button>
      </div>
    )
  }

  if (step === 'payment') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 border-4 border-adansi-primary border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-gray-900 mb-2">Preparing card checkout…</h2>
        <p className="text-gray-500 text-center text-sm">Opening the Paystack payment window</p>
        <button onClick={() => setStep('amount')} className="mt-6 text-sm text-gray-500 underline">
          Cancel
        </button>
      </div>
    )
  }

  if (step === 'verifying') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-gray-900 mb-2">Verifying payment…</h2>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="w-4 h-4" />
          <span>Confirming the transaction with Paystack</span>
        </div>
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
          {Object.keys(liveRates).length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400">Loading rates…</div>
          )}
        </div>

        {(providerInfo?.active_provider === 'paystack' || providerInfo === null) && (
          <div className="mt-4 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-[11px] text-gray-300 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-adansi-primary flex-shrink-0" />
            <span>
              Provider-agnostic payments in action. Your card contribution is routed through Paystack test mode today. Post-hackathon, Hubtel powers the MoMo settlement layer.
            </span>
          </div>
        )}
      </div>

      <div className="px-5 py-6 space-y-6">
        {step === 'select' && (
          <>
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
                  {liveRates[currency]?.flag} {foreignAmount} {currency} at live rate {rate.toFixed(4)}{ratesQuery.isFetching ? ' (refreshing...)' : ''}
                </p>
              )}
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Payer Name (visible to group)</label>
                <input
                  type="text"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  placeholder="Enter the name people should see"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-adansi-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Email (receipt + Paystack verification)</label>
                <input
                  type="email"
                  value={payerEmail}
                  onChange={(e) => setPayerEmail(e.target.value)}
                  placeholder="you@example.com"
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
                <p className="text-xs text-blue-700 mt-1">Pay with Visa, Mastercard, or PayPal via Paystack test mode. Use card <code className="bg-blue-100 px-1 rounded">4084 0840 8408 4081</code> for a successful test payment.</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              For diaspora users without a Ghana SIM, create an account using your email on the login page and keep the payer name here so the group can see who sent the contribution.
            </div>

            <button
              onClick={handleContribute}
              disabled={!selectedRate || rate <= 0 || !amountGHS || parseFloat(amountGHS) <= 0 || !payerName.trim()}
              className="w-full bg-adansi-primary text-adansi-secondary font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            >
              <CreditCard className="w-5 h-5" />
              Pay {currencies[currency]?.flag} {foreignAmount} {currency}
              <ExternalLink className="w-4 h-4 opacity-60" />
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
