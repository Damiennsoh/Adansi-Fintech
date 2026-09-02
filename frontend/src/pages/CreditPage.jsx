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

const partnerLenders = [
  { id: 1, name: 'Nsoatreman Rural Bank', maxLoan: 50000, rate: 12, minScore: 600, status: 'coming_soon' },
  { id: 2, name: 'Sinapi Aba Savings & Loans', maxLoan: 30000, rate: 15, minScore: 500, status: 'coming_soon' },
  { id: 3, name: 'Adansi Micro-Credit', maxLoan: 10000, rate: 10, minScore: 450, status: 'coming_soon' },
]

export default function CreditPage() {
  const { creditProfile, isLoading } = useCredit()
  const [showLoanForm, setShowLoanForm] = useState(false)
  const [loanAmount, setLoanAmount] = useState('')
  const [isVouched, setIsVouched] = useState(false)

  const tier = getCreditTier(creditProfile?.score || 0)
  const baseEligibility = creditProfile?.loan_eligibility || 2000
  const maxEligibleLoan = isVouched ? Math.round(baseEligibility * 1.25) : baseEligibility

  const handleApplyLoan = async (e) => {
    e.preventDefault()
    const rate = isVouched ? '3%' : '5%'
    alert(`Loan application for GHS ${loanAmount} submitted at ${rate}/month. Awaiting group member vouching confirmation.`)
    setShowLoanForm(false)
    setIsVouched(false)
    setLoanAmount('')
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-adansi-secondary px-5 pt-8 pb-6">
        <h1 className="text-xl font-bold text-white mb-6">Credit Score</h1>
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          <CreditScoreRing score={creditProfile?.score || 0} />
          <div className="w-full sm:flex-1 space-y-3 text-center sm:text-left">
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
                  <span className="font-medium text-gray-900">{creditProfile?.breakdown?.[factor.key]?.points ?? 0}/{creditProfile?.breakdown?.[factor.key]?.max_points ?? factor.weight * 10} pts</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-adansi-primary rounded-full h-2 transition-all"
                    style={{ width: `${Math.min(100, ((creditProfile?.breakdown?.[factor.key]?.points ?? 0) / (creditProfile?.breakdown?.[factor.key]?.max_points ?? factor.weight * 10)) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{factor.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Loan Eligibility */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <h2 className="font-bold text-gray-900">Micro-Loan</h2>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full w-fit">Backed by Group Treasury</span>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-500">Max Loan</p>
              <p className="text-sm font-bold text-gray-900">{formatCurrency(maxEligibleLoan)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-500">Rate</p>
              <p className="text-sm font-bold text-gray-900">5% / mo</p>
            </div>
            <div className="bg-adansi-primary/10 rounded-xl p-3">
              <p className="text-[10px] text-adansi-secondary font-medium">With Vouching</p>
              <p className="text-sm font-bold text-adansi-secondary">3% / mo</p>
            </div>
          </div>

          <button
            onClick={() => setShowLoanForm(true)}
            className="w-full bg-adansi-primary text-adansi-secondary font-bold py-3 rounded-xl active:scale-[0.98] transition-transform"
          >
            Apply for Micro-Loan
          </button>

          <div className="mt-3 flex items-start gap-2 text-xs text-gray-500">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>3+ group members vouching drops your rate to 3% and boosts limit by 25%.</p>
          </div>
        </div>

        {/* Partner Lenders (Mock for Demo) */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-900 mb-1">Partner Lenders</h2>
          <p className="text-xs text-gray-500 mb-4">Your social credit score unlocks loans from verified lenders</p>
          <div className="space-y-3">
            {partnerLenders.map((lender) => {
              const eligible = (creditProfile?.score || 0) >= lender.minScore
              return (
                <div key={lender.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                    <h3 className="font-bold text-gray-900 text-sm break-words min-w-0 flex-1">{lender.name}</h3>
                    {lender.status === 'coming_soon' && (
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">Coming Soon</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 break-words">Max: {formatCurrency(lender.maxLoan)} • {lender.rate}% / year • Min score: {lender.minScore}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${eligible ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {eligible ? 'Eligible' : `Requires ${lender.minScore}+`}
                    </span>
                    <button
                      disabled={!eligible}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-adansi-primary text-adansi-secondary disabled:opacity-40"
                    >
                      {eligible ? 'Apply' : 'Locked'}
                    </button>
                  </div>
                </div>
              )
            })}
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
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-sm p-6 animate-slide-up space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="text-lg font-bold text-gray-900">Apply for Micro-Loan</h3>
              <span className="text-xs bg-adansi-primary/20 text-adansi-secondary font-bold px-2 py-0.5 rounded-full w-fit">
                {isVouched ? '3% Monthly Rate' : '5% Monthly Rate'}
              </span>
            </div>

            <form onSubmit={handleApplyLoan} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (GHS)</label>
                <input
                  type="number"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  max={maxEligibleLoan}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-adansi-primary"
                  placeholder={`Max: GHS ${maxEligibleLoan}`}
                />
              </div>

              {/* Group Vouching Feature */}
              <div className="bg-adansi-secondary/5 border border-adansi-primary/30 rounded-xl p-3.5 space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isVouched}
                    onChange={(e) => setIsVouched(e.target.checked)}
                    className="w-4 h-4 text-adansi-primary rounded border-gray-300 focus:ring-adansi-primary"
                  />
                  <span className="text-xs font-bold text-gray-900">Request Group Vouching</span>
                </label>
                <p className="text-[11px] text-gray-600 pl-6 leading-tight">
                  3+ group members vouching drops interest from 5% to 3% and boosts your loan limit by +25%.
                </p>
                {isVouched && (
                  <div className="pt-2 text-xs text-green-700 font-semibold flex items-center gap-1 pl-6">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    3 Members Selected: Amina, Kofi, Yaw
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowLoanForm(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-adansi-primary text-adansi-secondary rounded-xl font-bold text-sm"
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
