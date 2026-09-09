import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Bell, TrendingUp, Wallet, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useGroups } from '../hooks/useGroups'
import { useUserProfile } from '../hooks/useAuth'
import { useCredit } from '../hooks/useContributions'
import { useRealtimeNotifications } from '../hooks/useRealtime'
import GroupCard from '../components/GroupCard'
import TransactionItem from '../components/TransactionItem'
import CreditScoreRing from '../components/CreditScoreRing'
import { formatCurrency } from '../lib/utils'

export default function DashboardPage() {
  const { groups, isLoading } = useGroups()
  const { data: profile } = useUserProfile()
  const { creditProfile } = useCredit()
  const [showBalance, setShowBalance] = useState(true)

  useRealtimeNotifications(profile?.id)

  const totalBalance = groups.reduce((sum, g) => sum + (g.balance ?? g.current_balance ?? 0), 0)
  const recentTransactions = groups.flatMap(g => g.recent_transactions || []).slice(0, 5)
  const score = creditProfile?.score ?? creditProfile?.credit_score ?? profile?.credit_score ?? 0
  const loanEligibleAmount = creditProfile?.max_loan_amount ?? creditProfile?.loan_eligibility ?? 0
  const unreadCount = profile?.unread_notifications ?? 0

  const userGreeting = profile?.full_name
    ? profile.full_name.split(' ')[0]
    : 'Member'

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-adansi-secondary px-5 pt-7 pb-6 rounded-b-3xl shadow-md">
        {/* User Greeting Bar */}
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-white/10">
          <Link to="/profile" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-full bg-adansi-primary/20 border border-adansi-primary/40 flex items-center justify-center text-adansi-primary font-bold text-base group-hover:scale-105 transition-transform">
              {(profile?.full_name || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-white text-sm font-semibold">Hello, {userGreeting} 👋</span>
                {profile?.is_verified && (
                  <ShieldCheck className="w-3.5 h-3.5 text-adansi-primary" />
                )}
              </div>
              <p className="text-[11px] text-gray-400">
                {profile?.ghana_card_number ? 'Verified Account' : 'Standard Member'}
              </p>
            </div>
          </Link>

          <Link
            to="/notifications"
            className="relative p-2.5 bg-white/10 hover:bg-white/15 rounded-full transition-colors active:scale-95"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-sm">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        </div>

        {/* Balance Display */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Total Group Balance</p>
            <button
              onClick={() => setShowBalance(!showBalance)}
              className="text-gray-400 hover:text-white transition-colors p-0.5"
              aria-label={showBalance ? 'Hide balance' : 'Show balance'}
            >
              {showBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight break-words">
            {showBalance ? formatCurrency(totalBalance) : '••••••••'}
          </h1>
        </div>

        <div className="flex gap-3">
          <Link
            to="/groups/create"
            className="flex-1 bg-adansi-primary text-adansi-secondary font-bold py-3 rounded-xl text-center text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-transform"
          >
            <Plus className="w-4 h-4" /> Create Group
          </Link>
          <Link
            to="/groups/join"
            className="flex-1 bg-white/10 hover:bg-white/15 text-white font-semibold py-3 rounded-xl text-center text-sm active:scale-[0.98] transition-transform"
          >
            Join Group
          </Link>
        </div>
      </div>

      <div className="px-5 py-6 space-y-6">
        {/* Credit Score Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-adansi-primary" />
              Credit Score
            </h2>
            <Link to="/credit" className="text-sm text-adansi-primary font-medium">View Details</Link>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-shrink-0">
              <CreditScoreRing score={score} />
            </div>
            <div className="w-full sm:flex-1 space-y-2 text-center sm:text-left">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">Loan Eligibility</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(loanEligibleAmount)}
              </p>
              <p className="text-xs text-gray-500">
                Keep contributing to increase your score
              </p>
            </div>
          </div>
        </div>

        {/* My Groups */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">My Groups</h2>
            <Link to="/groups" className="text-sm text-adansi-primary font-medium">See All</Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-gray-300">
              <p className="text-gray-500">No groups yet</p>
              <Link to="/groups/create" className="text-adansi-primary font-medium text-sm mt-1 inline-block">
                Create your first group
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.slice(0, 3).map(group => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="font-bold text-gray-900 mb-4">Recent Activity</h2>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            {recentTransactions.length === 0 ? (
              <p className="text-center text-gray-500 py-4 text-sm">No recent transactions</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentTransactions.map((tx, i) => (
                  <TransactionItem key={i} transaction={tx} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
