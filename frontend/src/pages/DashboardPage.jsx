import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Bell, TrendingUp, Wallet } from 'lucide-react'
import { useGroups } from '../hooks/useGroups'
import { useUserProfile } from '../hooks/useAuth'
import { useRealtimeNotifications } from '../hooks/useRealtime'
import GroupCard from '../components/GroupCard'
import TransactionItem from '../components/TransactionItem'
import CreditScoreRing from '../components/CreditScoreRing'
import { formatCurrency } from '../lib/utils'

export default function DashboardPage() {
  const { groups, isLoading } = useGroups()
  const { data: profile } = useUserProfile()
  const [showUSSD, setShowUSSD] = useState(false)

  useRealtimeNotifications(profile?.id)

  const totalBalance = groups.reduce((sum, g) => sum + (g.balance ?? g.current_balance ?? 0), 0)
  const recentTransactions = groups.flatMap(g => g.recent_transactions || []).slice(0, 5)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-adansi-secondary px-5 pt-8 pb-6 rounded-b-3xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-gray-400 text-sm">Total Balance</p>
            <h1 className="text-3xl font-bold text-white">{formatCurrency(totalBalance)}</h1>
          </div>
          <Link to="/notifications" className="relative p-2 bg-white/10 rounded-full">
            <Bell className="w-5 h-5 text-white" />
            {profile?.unread_notifications > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
                {profile.unread_notifications}
              </span>
            )}
          </Link>
        </div>

        <div className="flex gap-3">
          <Link
            to="/groups/create"
            className="flex-1 bg-adansi-primary text-adansi-secondary font-semibold py-3 rounded-xl text-center text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <Plus className="w-4 h-4" /> Create Group
          </Link>
          <Link
            to="/groups/join"
            className="flex-1 bg-white/10 text-white font-semibold py-3 rounded-xl text-center text-sm active:scale-[0.98] transition-transform"
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
              <CreditScoreRing score={profile?.credit_score || 0} />
            </div>
            <div className="w-full sm:flex-1 space-y-2 text-center sm:text-left">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">Loan Eligibility</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(profile?.loan_eligibility || 0)}
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
