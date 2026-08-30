import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, Copy, Share2, Phone, Wallet, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2 } from 'lucide-react'
import { useGroupDetail } from '../hooks/useGroups'
import { useRealtimeContributions } from '../hooks/useRealtime'
import { formatCurrency, formatRelativeTime, getGroupColor } from '../lib/utils'
import USSDModal from '../components/USSDModal'

export default function GroupDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { group, transactions, auditEvents, joinRequests, reviewJoinRequest, members, isLoading } = useGroupDetail(id)
  const [activeTab, setActiveTab] = useState('activity')
  const [showUSSD, setShowUSSD] = useState(false)
  const [copied, setCopied] = useState(false)

  useRealtimeContributions(id)

  const copyCode = () => {
    navigator.clipboard.writeText(group?.code || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareGroup = () => {
    const text = `Join my ${group?.type} group "${group?.name}" on Adansi. Code: ${group?.code}. Download Adansi or dial *422*1#`
    if (navigator.share) {
      navigator.share({ title: 'Join my Adansi group', text })
    } else {
      navigator.clipboard.writeText(text)
      alert('Invite text copied to clipboard!')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-adansi-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <p className="text-gray-500 mb-4">Group not found</p>
        <button onClick={() => navigate('/groups')} className="text-adansi-primary font-medium">
          Go back to groups
        </button>
      </div>
    )
  }

  const colorClass = getGroupColor(group.type)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className={`${colorClass} px-5 pt-8 pb-6 text-white`}>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/groups')} className="p-2 bg-white/20 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold flex-1 truncate">{group.name}</h1>
          <button onClick={shareGroup} className="p-2 bg-white/20 rounded-full">
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center mb-4">
          <p className="text-white/70 text-sm">Group Balance</p>
          <p className="text-4xl font-bold">{formatCurrency(group.balance || 0)}</p>
        </div>

        <div className="flex items-center justify-center gap-2 text-white/80 text-sm">
          <Users className="w-4 h-4" />
          <span>{members.length} members</span>
          <span className="mx-2">•</span>
          <span className="capitalize">{group.type}</span>
        </div>

        {/* Join Code */}
        <div className="mt-4 bg-white/20 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-white/70">Join Code</p>
            <p className="font-mono font-bold text-lg tracking-wider">{group.code}</p>
          </div>
          <button onClick={copyCode} className="p-2 bg-white/20 rounded-lg">
            {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-5 -mt-3">
        <div className="bg-white rounded-2xl shadow-sm p-4 flex gap-3">
          <button
            onClick={() => navigate(`/groups/${id}/contribute`)}
            className="flex-1 bg-adansi-primary text-adansi-secondary font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <ArrowDownLeft className="w-4 h-4" /> Contribute
          </button>
          <button
            onClick={() => navigate(`/groups/${id}/withdraw`)}
            className="flex-1 bg-red-50 text-red-600 font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <ArrowUpRight className="w-4 h-4" /> Withdraw
          </button>
          <button
            onClick={() => setShowUSSD(true)}
            className="px-4 bg-gray-100 rounded-xl flex items-center justify-center active:scale-[0.98] transition-transform"
          >
            <Phone className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 mt-6">
        <div className="flex bg-gray-100 rounded-xl p-1">
          {['activity', 'audit', 'members', ...(joinRequests.length ? ['requests'] : [])].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg capitalize transition-colors ${
                activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 mt-4">
        {activeTab === 'requests' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {joinRequests.map((request) => (
              <div key={request.id} className="flex items-center gap-3 p-4 border-b border-gray-50 last:border-0">
                <div className="w-10 h-10 rounded-full bg-adansi-primary/20 flex items-center justify-center"><Users className="w-5 h-5 text-adansi-secondary" /></div>
                <div className="flex-1"><p className="text-sm font-medium text-gray-900">New member request</p><p className="text-xs text-gray-500">{request.user_id} • {formatRelativeTime(request.created_at)}</p></div>
                <button disabled={reviewJoinRequest.isPending} onClick={() => reviewJoinRequest.mutate({ requestId: request.id, approved: false })} className="px-2 py-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-lg">Reject</button>
                <button disabled={reviewJoinRequest.isPending} onClick={() => reviewJoinRequest.mutate({ requestId: request.id, approved: true })} className="px-2 py-1.5 text-xs font-semibold text-adansi-secondary bg-adansi-primary rounded-lg">Approve</button>
              </div>
            ))}
          </div>
        ) : activeTab === 'activity' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {transactions.length === 0 ? (
              <div className="text-center py-8">
                <Wallet className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No transactions yet</p>
                <p className="text-gray-400 text-xs mt-1">Be the first to contribute!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {transactions.map((tx, i) => (
                  <div key={i} className="flex items-center gap-3 py-3 px-4">
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
                      <p className="font-medium text-gray-900 text-sm">
                        {tx.type === 'contribution' ? 'Contribution' : 'Withdrawal'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {tx.member_name || 'Unknown'} • {formatRelativeTime(tx.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold text-sm ${tx.type === 'contribution' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.type === 'contribution' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </p>
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${
                        tx.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                      }`}>
                        {tx.status === 'completed' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'audit' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {auditEvents.length === 0 ? <p className="p-8 text-center text-sm text-gray-500">No audit events yet.</p> : auditEvents.map((event) => (
              <div key={event.id} className="flex items-start gap-3 py-3 px-4 border-b border-gray-50 last:border-0">
                <div className="w-8 h-8 rounded-full bg-adansi-primary/20 flex items-center justify-center"><Clock className="w-4 h-4 text-adansi-secondary" /></div>
                <div className="flex-1"><p className="font-medium text-gray-900 text-sm">{event.event_type.replaceAll('_', ' ')}</p><p className="text-xs text-gray-500">{event.entity_type} • {formatRelativeTime(event.created_at)}</p></div>
                {event.amount != null && <span className="text-sm font-semibold">{formatCurrency(event.amount)}</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {members.map((member, i) => (
              <div key={i} className="flex items-center gap-3 py-3 px-4 border-b border-gray-50 last:border-0">
                <div className="w-10 h-10 rounded-full bg-adansi-secondary text-white flex items-center justify-center font-bold text-sm">
                  {member.name?.charAt(0) || '?'}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">{member.name || 'Unknown'}</p>
                  <p className="text-xs text-gray-500">{member.phone || ''}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
                  member.role === 'admin' ? 'bg-adansi-primary/20 text-adansi-secondary' : 'bg-gray-100 text-gray-600'
                }`}>
                  {member.role || 'member'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <USSDModal isOpen={showUSSD} onClose={() => setShowUSSD(false)} groupCode={group.code} />
    </div>
  )
}
