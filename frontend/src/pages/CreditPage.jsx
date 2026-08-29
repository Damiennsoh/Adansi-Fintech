import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCredit } from '../hooks/useContributions'
import { TrendingUp, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, Shield, AlertCircle } from 'lucide-react'
import CreditScoreRing from '../components/CreditScoreRing'
import { formatCurrency, getCreditTier } from '../lib/utils'

const scoreFactors = [
  { key: 'consistency', label: 'Consistency', weight: 35, desc: 'Regular contributions over time' },
  { key: 'volume', label: 'Volume', weight: 25, desc: 'Total amount contributed' },
  { key: 'diversity', label: 'Diversity', weight: 15, desc: 'Number of different groups' },
  { key: 'tenure', label: 'Tenure', weight: 10, desc: 'How long you have been active' },
  { key: 'standing', label: 'Standing', weight: 10, desc: 'Group role & reliability' },
  { key: 'behavior', label: 'Behavior', weight: 5, desc: 'Repayment & approval history' },
]

export default function CreditPage() {
  const { creditProfile, isLoading } = useCredit()
  const [showLoanForm, setShowLoanForm] = useState(false)
  const [loanAmount, setLoanAmount] = useState('')

  const tier = getCreditTier(creditProfile?.score || 0)

  const handleApplyLoan = async (e) => {
    e.preventDefault()
    // Would call applyLoan mutation here
    alert(`Loan application for GHS ${loanAmount} submitted!`)
    setShowLoanForm(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-adansi-secondary px-5 pt-8 pb-6">
        <h1 className="text-xl font-bold text-white mb-6">Credit Score</h1>
        <div className="flex items-center gap-6">
          <CreditScoreRing score={creditProfile?.score || 0} />
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-gray-400 text-xs">Loan Eligibility</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(creditProfile?.loan_eligibility || 0)}</p>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${tier.bg} ${tier.color} text-xs font-bold`}>
              <Shield className="w-3 h-3" />
              {tier.tier} Tier
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-6 space-y-6">
        {/* Score Breakdown */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-900 mb-4">Score Breakdown</h2>
          <div className="space-y-4">
            {scoreFactors.map(factor => (
              <div key={factor.key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{factor.label}</span>
                  <span className="font-medium text-gray-900">{factor.weight}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-adansi-primary rounded-full h-2 transition-all"
                    style={{ width: `${factor.weight}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{factor.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Loan Eligibility */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Quick Loan</h2>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Mock for Demo</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Max Loan</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(creditProfile?.loan_eligibility || 0)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Interest Rate</p>
              <p className="text-lg font-bold text-gray-900">{creditProfile?.interest_rate || 5}%</p>
            </div>
          </div>

          <button
            onClick={() => setShowLoanForm(true)}
            className="w-full bg-adansi-primary text-adansi-secondary font-bold py-3 rounded-xl active:scale-[0.98] transition-transform"
          >
            Apply for Loan
          </button>

          <div className="mt-3 flex items-start gap-2 text-xs text-gray-500">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>Loans are backed by your group. Members can vouch to reduce your rate.</p>
          </div>
        </div>

        {/* Loan History */}
        <div>
          <h2 className="font-bold text-gray-900 mb-3">Loan History</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            {(creditProfile?.loans || []).length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No loans yet</p>
                <p className="text-gray-400 text-xs mt-1">Keep contributing to unlock loans</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {(creditProfile?.loans || []).map((loan, i) => (
                  <div key={i} className="flex items-center gap-3 py-3 px-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      loan.status === 'active' ? 'bg-blue-50' : 'bg-green-50'
                    }`}>
                      {loan.status === 'active' ? (
                        <Clock className="w-5 h-5 text-blue-600" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{formatCurrency(loan.amount)}</p>
                      <p className="text-xs text-gray-500">{loan.purpose || 'Personal'}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
                      loan.status === 'active' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                    }`}>
                      {loan.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loan Form Modal */}
      {showLoanForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-sm p-6 animate-slide-up">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Apply for Loan</h3>
            <form onSubmit={handleApplyLoan} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (GHS)</label>
                <input
                  type="number"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  max={creditProfile?.loan_eligibility || 0}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-adansi-primary"
                  placeholder={`Max: ${creditProfile?.loan_eligibility || 0}`}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowLoanForm(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-adansi-primary text-adansi-secondary rounded-xl font-bold"
                >
                  Apply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
