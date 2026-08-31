import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { TrendingUp, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import api from '../lib/api'
import { formatCurrency, formatRelativeTime } from '../lib/utils'

export default function ContributionHistoryPage() {
  const summaryQuery = useQuery({
    queryKey: ['historySummary'],
    queryFn: async () => {
      const { data } = await api.get('/users/me/history/summary')
      return data
    },
  })

  const groupsQuery = useQuery({
    queryKey: ['historyGroups'],
    queryFn: async () => {
      const { data } = await api.get('/users/me/history/groups')
      return data.groups || []
    },
  })

  const historyQuery = useQuery({
    queryKey: ['historyTransactions'],
    queryFn: async () => {
      const { data } = await api.get('/users/me/history')
      return data.contributions || []
    },
  })

  const summary = summaryQuery.data || {}
  const groups = groupsQuery.data || []
  const transactions = historyQuery.data || []

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-adansi-secondary px-5 pt-8 pb-6">
        <h1 className="text-xl font-bold text-white mb-6">Contribution History</h1>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-xs text-gray-400">All-Time Total</p>
            <p className="text-lg font-bold text-white">{formatCurrency(summary.all_time_total || 0)}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-xs text-gray-400">On-Time Rate</p>
            <p className="text-lg font-bold text-adansi-primary">{summary.on_time_rate ?? 0}%</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-xs text-gray-400">Groups</p>
            <p className="text-lg font-bold text-white">{summary.groups_count ?? 0}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-xs text-gray-400">Current Streak</p>
            <p className="text-lg font-bold text-white">{summary.current_streak_weeks ?? 0} wks</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-6 space-y-6">
        <div>
          <h2 className="font-bold text-gray-900 mb-3">By Group</h2>
          <div className="space-y-3">
            {groups.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No group contributions yet.</p>
            ) : (
              groups.map((g) => (
                <div key={g.group_id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-gray-900">{g.group_name}</h3>
                    <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                      {g.on_time_rate}% on-time
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    You: {formatCurrency(g.user_total)} / Group: {formatCurrency(g.group_total)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{g.contribution_count} contributions</p>
                  <Link
                    to={`/groups/${g.group_id}?tab=audit`}
                    className="text-xs text-adansi-secondary font-semibold mt-2 inline-block"
                  >
                    View full audit →
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="font-bold text-gray-900 mb-3">Recent Activity</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
            {transactions.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No transactions yet</p>
              </div>
            ) : (
              transactions.slice(0, 30).map((tx) => (
                <div key={`${tx.type}-${tx.id}`} className="flex items-center gap-3 py-3 px-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    tx.type === 'contribution' ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    {tx.type === 'contribution' ? (
                      <ArrowDownLeft className="w-5 h-5 text-green-600" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm capitalize">{tx.type}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {tx.group_name} • {formatRelativeTime(tx.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold text-sm ${tx.type === 'contribution' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'contribution' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </p>
                    <span className="text-[10px] text-gray-400">{tx.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
