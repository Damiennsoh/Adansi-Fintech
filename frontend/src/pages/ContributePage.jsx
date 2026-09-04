import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useContributions } from '../hooks/useContributions'
import { useAuthStore } from '../store/authStore'
import { ArrowLeft, Loader2, Wallet, Phone, CheckCircle2, CreditCard, Clock } from 'lucide-react'
import { formatCurrency } from '../lib/utils'
import USSDModal from '../components/USSDModal'
import NetworkSelector, { detectNetworkFromPhone } from '../components/NetworkSelector'
import api from '../lib/api'

const quickAmounts = [10, 50, 100, 200, 500, 1000]

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

export default function ContributePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { contribute } = useContributions()
  const [amount, setAmount] = useState('')
  const [network, setNetwork] = useState(detectNetworkFromPhone(user?.phone || ''))
  const [showUSSD, setShowUSSD] = useState(false)
  const [method, setMethod] = useState(user?.email && !user?.phone ? 'card' : 'momo')
  const [step, setStep] = useState('input')
  const [lastError, setLastError] = useState(null)

  const payerEmail = user?.email || `${(user?.id || 'user').slice(0, 8)}@adansi.app`
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_a1edd4233cb500a8b10d38357b594ced33e9c557'

  const openPaystackInline = async (init) => {
    const loaded = await loadPaystackSDK()
    const amountKobo = Math.round(parseFloat(amount) * 100)
    const ref = init.transaction_ref || init.reference || `ADNS-${Date.now()}`
    if (loaded && window.PaystackPop && publicKey && !publicKey.startsWith('your-')) {
      const handler = window.PaystackPop.setup({
        key: publicKey,
        email: payerEmail,
        amount: amountKobo,
        currency: 'GHS',
        ref,
        callback: async (response) => {
          setStep('verifying')
          try {
            const settle = await api.get(`/contributions/verify/paystack/${encodeURIComponent(response.reference || ref)}`)
            if (settle.data.status === 'processed' || settle.data.status === 'already_processed') {
              setStep('success')
              setTimeout(() => navigate(`/groups/${id}`), 2000)
            } else {
              setLastError(`Payment status: ${settle.data.status || 'unknown'}`)
              setStep('error')
            }
          } catch (err) {
            setLastError(err.response?.data?.detail || err.message || 'Verification failed')
            setStep('error')
          }
        },
        onClose: () => setStep('input'),
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
            setTimeout(() => navigate(`/groups/${id}`), 2000)
          } else if (attempts >= 24) {
            clearInterval(interval)
            setLastError('Payment could not be confirmed automatically. Refresh the group page.')
            setStep('error')
          }
        } catch {
          if (attempts >= 24) {
            clearInterval(interval)
            setLastError('Verification timed out. Check the group page later.')
            setStep('error')
          }
        }
      }, 5000)
      return
    }
    if (init.sandbox || init.status === 'completed') {
      setStep('success')
      setTimeout(() => navigate(`/groups/${id}`), 2000)
      return
    }
    setLastError('Paystack SDK not loaded and no hosted URL. Check internet connection.')
    setStep('error')
  }

  const handleContribute = async () => {
    setStep('processing')
    setLastError(null)
    try {
      if (method === 'card') {
        const { data: init } = await api.post('/contributions', {
          group_id: id,
          amount: parseFloat(amount),
          method: 'card',
          network,
        })
        if (init.sandbox || init.status === 'completed') {
          setStep('success')
          setTimeout(() => navigate(`/groups/${id}`), 2000)
          return
        }
        await openPaystackInline(init)
        return
      }
      await contribute.mutateAsync({ groupId: id, amount: parseFloat(amount), network })
      setStep('success')
      setTimeout(() => navigate(`/groups/${id}`), 2000)
    } catch (err) {
      setLastError(err.response?.data?.detail || 'Contribution failed. Please try again.')
      setStep('error')
    }
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Contribution Sent!</h2>
        <p className="text-gray-500 text-center">
          {method === 'card' ? 'Card payment settled.' : `Confirm the MoMo prompt on your ${network.toUpperCase()} wallet.`}
        </p>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10 text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Contribution failed</h2>
        <p className="text-gray-500 text-center mb-6">{lastError || 'Please try again.'}</p>
        <button onClick={() => setStep('input')} className="px-6 py-3 bg-adansi-primary text-adansi-secondary font-bold rounded-xl">
          Try Again
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
          <span>Confirming the transaction</span>
        </div>
      </div>
    )
  }

  if (step === 'processing') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 border-4 border-adansi-primary border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-gray-900 mb-2">Processing...</h2>
        <p className="text-gray-500 text-center text-sm">
          {method === 'card' ? 'Preparing card checkout…' : `Confirm the MoMo prompt on your phone`}
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-5 pt-8 pb-4 sticky top-0 z-30 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Contribute</h1>
        </div>
      </div>

      <div className="px-5 py-6 space-y-6">
        <div className="text-center">
          <p className="text-gray-500 text-sm mb-2">Enter Amount</p>
          <div className="flex items-center justify-center gap-1 max-w-full">
            <span className="text-xl sm:text-2xl text-gray-400 flex-shrink-0">GHS</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="text-3xl sm:text-5xl font-bold text-center w-full max-w-[12rem] bg-transparent focus:outline-none text-gray-900"
              autoFocus
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {quickAmounts.map(amt => (
            <button
              key={amt}
              type="button"
              onClick={() => setAmount(amt.toString())}
              className={`py-3 rounded-xl font-semibold text-sm transition-colors ${
                amount === amt.toString()
                  ? 'bg-adansi-primary text-adansi-secondary'
                  : 'bg-white border border-gray-200 text-gray-700'
              }`}
            >
              {formatCurrency(amt)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/5 p-1 border border-gray-100">
          <button
            type="button"
            onClick={() => setMethod('momo')}
            className={`py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${method === 'momo' ? 'bg-adansi-primary text-adansi-secondary' : 'bg-white text-gray-700 border border-gray-200'}`}
          >
            <Wallet className="w-4 h-4" />
            MoMo
          </button>
          <button
            type="button"
            onClick={() => setMethod('card')}
            className={`py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${method === 'card' ? 'bg-adansi-primary text-adansi-secondary' : 'bg-white text-gray-700 border border-gray-200'}`}
          >
            <CreditCard className="w-4 h-4" />
            Card
          </button>
        </div>

        {method === 'momo' && <NetworkSelector value={network} onChange={setNetwork} />}

        {method === 'card' ? (
          <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-3">
            <CreditCard className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">Secure Card Payment (Paystack test)</p>
              <p className="text-xs text-blue-700 mt-1">
                Pay with Visa / Mastercard. Use test card <code className="bg-blue-100 px-1 rounded">4084 0840 8408 4081</code> with any future expiry and CVV.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-3">
            <Wallet className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">Cross-Network MoMo</p>
              <p className="text-xs text-blue-700 mt-1">
                Payment request sent to your {network.toUpperCase()} wallet. Confirm with your MoMo PIN.
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleContribute}
          disabled={!amount || parseFloat(amount) <= 0 || contribute.isPending}
          className="w-full bg-adansi-primary text-adansi-secondary font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
        >
          {contribute.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : method === 'card' ? 'Pay with Card' : 'Contribute Now'}
        </button>

        <button
          type="button"
          onClick={() => setShowUSSD(true)}
          className="w-full flex items-center justify-center gap-2 py-3 text-gray-500 text-sm"
        >
          <Phone className="w-4 h-4" />
          Use USSD Instead
        </button>
      </div>

      <USSDModal isOpen={showUSSD} onClose={() => setShowUSSD(false)} />
    </div>
  )
}
