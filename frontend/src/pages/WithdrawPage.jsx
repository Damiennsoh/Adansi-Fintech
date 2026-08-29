import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWithdrawals } from '../hooks/useContributions'
import { useGroupDetail } from '../hooks/useGroups'
import { ArrowLeft, Loader2, Wallet, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '../lib/utils'

export default function WithdrawPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { group } = useGroupDetail(id)
  const { requestWithdrawal } = useWithdrawals()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [step, setStep] = useState('input') // input | confirm | processing | success

  const handleWithdraw = async () => {
    setStep('processing')
    try {
      await requestWithdrawal.mutateAsync({ groupId: id, amount: parseFloat(amount), reason })
      setStep('success')
      setTimeout(() => navigate(`/groups/${id}`), 2000)
    } catch (err) {
      alert('Withdrawal request failed. Please try again.')
      setStep('input')
    }
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Request Sent!</h2>
        <p className="text-gray-500 text-center">Group members will be notified to approve.</p>
      </div>
    )
  }

  if (step === 'processing') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 border-4 border-adansi-primary border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-gray-900 mb-2">Submitting...</h2>
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
          <h1 className="text-xl font-bold text-gray-900">Request Withdrawal</h1>
        </div>
      </div>

      <div className="px-5 py-6 space-y-6">
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-sm text-gray-500">Available Balance</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(group?.balance || 0)}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Amount (GHS)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-4 bg-white border border-gray-200 rounded-xl text-2xl font-bold focus:outline-none focus:border-adansi-primary focus:ring-2 focus:ring-adansi-primary/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you withdrawing this money?"
            rows={3}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-adansi-primary focus:ring-2 focus:ring-adansi-primary/20 resize-none"
          />
        </div>

        <div className="bg-yellow-50 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-900">Approval Required</p>
            <p className="text-xs text-yellow-700 mt-1">
              All group members must approve this withdrawal before funds are released. Large withdrawals (&gt;GHS 500) require agent verification.
            </p>
          </div>
        </div>

        <button
          onClick={handleWithdraw}
          disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > (group?.balance || 0) || requestWithdrawal.isPending}
          className="w-full bg-red-600 text-white font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
        >
          {requestWithdrawal.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Request Withdrawal'}
        </button>
      </div>
    </div>
  )
}
