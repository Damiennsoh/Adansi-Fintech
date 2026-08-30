import { useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  LayoutDashboard, Users, Wallet, TrendingUp, Shield, 
  ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, 
  AlertTriangle, Search, Filter, ChevronDown, BarChart3
} from 'lucide-react'
import { formatCurrency, formatRelativeTime } from '../lib/utils'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

const mockStats = {
  totalUsers: 1247,
  totalGroups: 89,
  totalVolume: 2847500,
  activeAgents: 342,
  pendingVerifications: 12,
  avgCreditScore: 612,
}

const mockTransactions = [
  { id: 1, type: 'contribution', amount: 500, user: 'Amina Owusu', group: 'Funeral Fund', status: 'completed', time: '2026-08-29T12:30:00Z' },
  { id: 2, type: 'withdrawal', amount: 1200, user: 'Kofi Mensah', group: 'Wedding Fund', status: 'pending', time: '2026-08-29T11:15:00Z' },
  { id: 3, type: 'contribution', amount: 200, user: 'Grace Addo', group: 'Health Support', status: 'completed', time: '2026-08-29T10:00:00Z' },
  { id: 4, type: 'withdrawal', amount: 3500, user: 'Yaw Boateng', group: 'Investment Club', status: 'pending', time: '2026-08-28T16:45:00Z' },
  { id: 5, type: 'contribution', amount: 100, user: 'Efua Darko', group: 'Susu Group', status: 'completed', time: '2026-08-28T09:20:00Z' },
]

const mockAgents = [
  { id: 1, name: 'Agent Kwame', location: 'Accra Central', verifications: 45, status: 'active' },
  { id: 2, name: 'Agent Abena', location: 'Kumasi Market', verifications: 32, status: 'active' },
  { id: 3, name: 'Agent Kofi', location: 'Tamale Junction', verifications: 28, status: 'offline' },
]

const getStatCards = (stats) => [
  { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'bg-blue-50 text-blue-600', change: 'live' },
  { label: 'Active Groups', value: stats.totalGroups, icon: Wallet, color: 'bg-green-50 text-green-600', change: 'live' },
  { label: 'Transaction Volume', value: formatCurrency(stats.totalVolume), icon: TrendingUp, color: 'bg-purple-50 text-purple-600', change: 'live' },
  { label: 'Pending Contributions', value: stats.pendingVerifications, icon: Shield, color: 'bg-yellow-50 text-yellow-600', change: 'live' },
]

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const overviewQuery = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => (await api.get('/admin/overview')).data,
    retry: false,
  })
  const liveStats = overviewQuery.data?.stats || mockStats
  const liveTransactions = overviewQuery.data?.transactions || mockTransactions
  const statCards = getStatCards(liveStats)

  const tabs = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'transactions', label: 'Transactions', icon: Wallet },
    { key: 'agents', label: 'Agents', icon: Shield },
    { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-adansi-secondary px-5 pt-8 pb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
          <span className="text-xs bg-adansi-primary/20 text-adansi-primary px-2 py-1 rounded-full font-medium">
            MTN MoMo Lab
          </span>
        </div>
        <p className="text-gray-400 text-sm">Platform overview & agent management</p>
      </div>

      <div className="px-5 py-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {statCards.map((stat, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className={`w-8 h-8 rounded-lg ${stat.color} flex items-center justify-center`}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <span className={`text-[10px] font-bold ${stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                  {stat.change}
                </span>
              </div>
              <p className="text-xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Recent Transactions */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-sm">Recent Transactions</h3>
                <button onClick={() => setActiveTab('transactions')} className="text-xs text-adansi-primary font-medium">
                  View All
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {liveTransactions.slice(0, 3).map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 py-3 px-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      tx.type === 'contribution' ? 'bg-green-50' : 'bg-red-50'
                    }`}>
                      {tx.type === 'contribution' ? (
                        <ArrowDownLeft className="w-4 h-4 text-green-600" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{tx.user}</p>
                      <p className="text-[10px] text-gray-500">{tx.group}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${tx.type === 'contribution' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.type === 'contribution' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        tx.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                      }`}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Agent Status */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-sm">Agent Network</h3>
                <button onClick={() => setActiveTab('agents')} className="text-xs text-adansi-primary font-medium">
                  Manage
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {mockAgents.map(agent => (
                  <div key={agent.id} className="flex items-center gap-3 py-3 px-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      agent.status === 'active' ? 'bg-green-50' : 'bg-gray-100'
                    }`}>
                      <Shield className={`w-4 h-4 ${agent.status === 'active' ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{agent.name}</p>
                      <p className="text-[10px] text-gray-500">{agent.location} • {agent.verifications} verifications</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      agent.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {agent.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search transactions..."
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-adansi-primary/20"
                />
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {liveTransactions.map(tx => (
                <div key={tx.id} className="flex items-center gap-3 py-3 px-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    tx.type === 'contribution' ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    {tx.type === 'contribution' ? (
                      <ArrowDownLeft className="w-4 h-4 text-green-600" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{tx.user}</p>
                    <p className="text-[10px] text-gray-500">{tx.group} • {formatRelativeTime(tx.time)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${tx.type === 'contribution' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'contribution' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      tx.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                    }`}>
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'agents' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900">MTN MoMo Agent Network Analytics</p>
                <p className="text-xs text-blue-700 mt-1">Digital treasury signatories manage standard withdrawals. Agent verification is available for optional Phase 2 integrations.</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-sm">Agent Network Activity</h3>
                <span className="text-xs text-gray-500 font-medium">342 Registered Agents</span>
              </div>
              <div className="divide-y divide-gray-50">
                {mockAgents.map(agent => (
                  <div key={agent.id} className="flex items-center gap-3 py-3 px-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      agent.status === 'active' ? 'bg-green-50' : 'bg-gray-100'
                    }`}>
                      <Shield className={`w-5 h-5 ${agent.status === 'active' ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{agent.name}</p>
                      <p className="text-xs text-gray-500">{agent.location}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{agent.verifications}</p>
                      <p className="text-[10px] text-gray-500">verifications</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm mb-4">Transaction Volume (Last 7 Days)</h3>
              <div className="flex items-end gap-2 h-32">
                {[30, 45, 25, 60, 40, 75, 55].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className="w-full bg-adansi-primary/80 rounded-t-lg transition-all"
                      style={{ height: `${h}%` }}
                    />
                    <span className="text-[10px] text-gray-500">{['M','T','W','T','F','S','S'][i]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Avg Credit Score</p>
                <p className="text-2xl font-bold text-gray-900">{mockStats.avgCreditScore}</p>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                  <div className="bg-adansi-primary rounded-full h-1.5" style={{ width: '72%' }} />
                </div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Diaspora Users</p>
                <p className="text-2xl font-bold text-gray-900">234</p>
                <p className="text-[10px] text-green-600 mt-1">+18% this month</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
