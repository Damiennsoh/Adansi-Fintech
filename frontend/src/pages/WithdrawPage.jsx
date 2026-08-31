import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWithdrawals } from '../hooks/useContributions'
import { useGroupDetail } from '../hooks/useGroups'
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '../lib/utils'
import NetworkSelector, { detectNetworkFromPhone } from '../components/NetworkSelector'

export default function WithdrawPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { group } = useGroupDetail(id)
  const { requestWithdrawal } = useWithdrawals()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [beneficiaryName, setBeneficiaryName] = useState('')
  const [beneficiaryPhone, setBeneficiaryPhone] = useState('')
  const [beneficiaryNetwork, setBeneficiaryNetwork] = useState('mtn')
  const [disbursementMethod, setDisbursementMethod] = useState('momo')
  const [bankAccount, setBankAccount] = useState('')
  const [step, setStep] = useState('input')

  const handlePhoneChange = (val) => {
    setBeneficiaryPhone(val)
    if (val.length >= 10) {
      setBeneficiaryNetwork(detectNetworkFromPhone(val.startsWith('+') ? val : `+233${val.replace(/^0/, '')}`))
    }
  }

  const handleWithdraw = async () => {
    setStep('processing')
    try {
      const phone = beneficiaryPhone.startsWith('+')
        ? beneficiaryPhone
        : `+233${beneficiaryPhone.replace(/^0/, '').replace(/\D/g, '')}`

      await requestWithdrawal.mutateAsync({
        groupId: id,
        amount: parseFloat(amount),
        reason,
        beneficiary_name: beneficiaryName,
        beneficiary_phone: phone,
        beneficiary_network: beneficiaryNetwork,
        disbursement_method: disbursementMethod,
        beneficiary_bank_account: disbursementMethod === 'bank_transfer' ? bankAccount : undefined,
      })
      setStep('success')
      setTimeout(() => navigate(`/groups/${id}`), 2500)
    } catch (err) {
      alert(err.response?.data?.detail || 'Withdrawal request failed. Please try again.')
      setStep('input')
    }
  }

  const balance = group?.balance ?? group?.current_balance ?? 0
  const previewPhone = beneficiaryPhone.startsWith('+')
    ? beneficiaryPhone
    : beneficiaryPhone ? `+233${beneficiaryPhone.replace(/^0/, '')}` : ''

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 bg-adansi-primary/20 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10 text-adansi-secondary" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Withdrawal Requested!</h2>
        <p className="text-gray-500 text-center text-sm max-w-xs">
          GHS {amount} will be sent to {beneficiaryName} ({previewPhone}) after treasury approval.
        </p>
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
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-white px-5 pt-8 pb-4 sticky top-0 z-30 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Request Withdrawal</h1>
        </div>
      </div>

      <div className="px-5 py-6 space-y-5">
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-sm text-gray-500">Available Balance</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(balance)}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Amount (GHS)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-4 bg-white border border-gray-200 rounded-xl text-xl sm:text-2xl font-bold focus:outline-none focus:border-adansi-primary focus:ring-2 focus:ring-adansi-primary/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Coffin deposit & hearse booking"
            rows={2}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-adansi-primary resize-none text-sm"
          />
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-4">
          <h3 className="font-bold text-gray-900 text-sm">Beneficiary (Direct Disbursement)</h3>
          <p className="text-xs text-gray-500 -mt-2">Funds go directly to the beneficiary — never to your wallet.</p>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Beneficiary Name</label>
            <input
              type="text"
              value={beneficiaryName}
              onChange={(e) => setBeneficiaryName(e.target.value)}
              placeholder="Nsawam Coffin Works"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-adansi-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Beneficiary Phone</label>
            <input
              type="tel"
              value={beneficiaryPhone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="024 000 0000"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-adansi-primary"
            />
          </div>

          <NetworkSelector
            value={beneficiaryNetwork}
            onChange={setBeneficiaryNetwork}
            label="Beneficiary Network"
          />

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Disbursement Method</label>
            <select
              value={disbursementMethod}
              onChange={(e) => setDisbursementMethod(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-adansi-primary"
            >
              <option value="momo">Mobile Money</option>
              <option value="bank_transfer">Bank Transfer</option>
            </select>
          </div>

          {disbursementMethod === 'bank_transfer' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Bank Account Number</label>
              <input
                type="text"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="Account number"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-adansi-primary"
              />
            </div>
          )}
        </div>

        {beneficiaryName && previewPhone && amount && (
          <div className="bg-adansi-secondary/5 border border-adansi-primary/20 rounded-xl p-3 text-xs text-gray-700">
            Preview: <strong>{formatCurrency(parseFloat(amount) || 0)}</strong> will be sent to{' '}
            <strong>{beneficiaryName}</strong> ({previewPhone}, {beneficiaryNetwork.toUpperCase()}) after approval.
          </div>
        )}

        <div className="bg-adansi-secondary/10 border border-adansi-primary/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-adansi-secondary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-adansi-secondary">Digital Treasury Rule Active</p>
            <p className="text-xs text-gray-700 mt-1">
              Rule: <span className="font-semibold">{
                group?.approval_rule === 'two_of_three_treasurers' ? '2 of 3 Treasurers must sign' :
                group?.approval_rule === 'majority_members' ? 'Majority (51%) of members' :
                group?.approval_rule === 'unanimous_members' ? 'All members must approve' :
                'Any 1 Treasurer can approve'
              }</span>
              {(group?.auto_approve_limit > 0) && parseFloat(amount) <= group.auto_approve_limit
                ? <span className="ml-1 text-green-700 font-semibold"> • Under auto-approve limit — instant disbursement</span>
                : <span> • Approval required before disbursement.</span>}
            </p>
          </div>
        </div>

        <button
          onClick={handleWithdraw}
          disabled={
            !amount || parseFloat(amount) <= 0 || parseFloat(amount) > balance ||
            !reason || reason.length < 5 || !beneficiaryName || !beneficiaryPhone ||
            requestWithdrawal.isPending
          }
          className="w-full bg-red-600 text-white font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
        >
          {requestWithdrawal.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Request Withdrawal'}
        </button>
      </div>
    </div>
  )
}
