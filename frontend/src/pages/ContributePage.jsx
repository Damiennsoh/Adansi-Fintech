import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useContributions } from '../hooks/useContributions'
import { ArrowLeft, Loader2, Wallet, Phone, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '../lib/utils'
import USSDModal from '../components/USSDModal'

const quickAmounts = [10, 50, 100, 200, 500, 1000]

export default function ContributePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { contribute } = useContributions()
  const [amount, setAmount] = useState('')
  const [showUSSD, setShowUSSD] = useState(false)
  const [step, setStep] = useState('input') // input | confirm | processing | success

  const handleContribute = async () => {
    setStep('processing')
    try {
      await contribute.mutateAsync({ groupId: id, amount: parseFloat(amount) })
      setStep('success')
      setTimeout(() => navigate(`/groups/${id}`), 2000)
    } catch (err) {
      alert('Contribution failed. Please try again.')
      setStep('input')
    }
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Contribution Sent!</h2>
        <p className="text-gray-500 text-center">You will receive an SMS confirmation shortly.</p>
      </div>
    )
  }

  if (step === 'processing') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 border-4 border-adansi-primary border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-gray-900 mb-2">Processing...</h2>
        <p className="text-gray-500 text-center text-sm">Confirm the MoMo prompt on your phone</p>
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
          <div className="flex items-center justify-center gap-1">
            <span className="text-2xl text-gray-400">GHS</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="text-5xl font-bold text-center w-48 bg-transparent focus:outline-none text-gray-900"
              autoFocus
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {quickAmounts.map(amt => (
            <button
              key={amt}
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

        <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-3">
          <Wallet className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900">MoMo Payment</p>
            <p className="text-xs text-blue-700 mt-1">
              You will receive a prompt on your phone to confirm payment with your MoMo PIN.
            </p>
          </div>
        </div>

        <button
          onClick={handleContribute}
          disabled={!amount || parseFloat(amount) <= 0 || contribute.isPending}
          className="w-full bg-adansi-primary text-adansi-secondary font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
        >
          {contribute.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Contribute Now'}
        </button>

        <button
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
