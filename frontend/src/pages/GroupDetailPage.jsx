import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Users, Copy, Share2, Phone, Wallet, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2 } from 'lucide-react'
import { useGroupDetail } from '../hooks/useGroups'
import { useWithdrawals } from '../hooks/useContributions'
import { useRealtimeContributions } from '../hooks/useRealtime'
import { formatCurrency, formatRelativeTime, getGroupColor } from '../lib/utils'
import api from '../lib/api'
import USSDModal from '../components/USSDModal'

function ruleLabel(rule) {
  if (rule === 'two_of_three_treasurers') return '2 of 3 Treasurers'
  if (rule === 'majority_members') return 'Majority (51%)'
  if (rule === 'unanimous_members') return 'Unanimous'
  return 'Any 1 Treasurer'
}

export default function GroupDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') || 'activity'
  const { group, transactions, auditEvents, joinRequests, pendingWithdrawals, reviewJoinRequest, members, isLoading } = useGroupDetail(id)
  const { approveWithdrawal } = useWithdrawals()
  const [activeTab, setActiveTab] = useState(initialTab)
  const [showUSSD, setShowUSSD] = useState(false)
  const [copied, setCopied] = useState(false)

  const { data: memberLedger = [] } = useQuery({
    queryKey: ['group-ledger', id],
    queryFn: async () => {
      const { data } = await api.get(`/users/me/history/groups/${id}`)
      return data.entries || []
    },
    enabled: !!id,
  })

  useRealtimeContributions(id)

  const copyCode = () => {
    navigator.clipboard.writeText(group?.code || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareGroup = () => {
    const publicUrl = `${window.location.origin}/g/${group?.code}?name=${encodeURIComponent(group?.name || '')}`
    const text = `Contribute to ${group?.name} (${group?.code}) on Adansi. No account needed: ${publicUrl}`

    if (navigator.share) {
      navigator.share({
        title: `${group?.name} guest contribution link`,
        text,
        url: publicUrl,
      }).catch(() => {
        navigator.clipboard.writeText(publicUrl)
        alert('Public guest contribution link copied to clipboard.')
      })
      return
    }

    navigator.clipboard.writeText(publicUrl)
      .then(() => alert('Guest contribution link copied to clipboard!'))
      .catch(() => alert(`Share this guest page: ${publicUrl}`))
  }

  const handleApproveWithdrawal = async (withdrawalId, approved) => {
    try {
      const result = await approveWithdrawal.mutateAsync({ withdrawalId, approved })
      if (result.disbursed) {
        alert(`Withdrawal approved and disbursed to beneficiary. Ref: ${result.transaction_ref || 'N/A'}`)
      } else if (approved) {
        alert(`Signature recorded (${result.approvals_received}/${result.approvals_required})`)
      } else {
        alert('Withdrawal declined.')
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Action failed.')
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
  const balance = group.balance ?? group.current_balance ?? 0

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className={`${colorClass} px-5 pt-8 pb-6 text-white`}>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/groups')} className="p-2 bg-white/20 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold flex-1 truncate">{group.name}</h1>
        </div>

        <div className="text-center mb-4">
          <p className="text-white/70 text-sm">Group Balance</p>
          <p className="text-2xl sm:text-4xl font-bold break-words">{formatCurrency(balance)}</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-1 bg-black/20 text-adansi-primary text-xs px-3 py-2 rounded-xl w-full max-w-sm mx-auto mb-3 font-medium border border-adansi-primary/30 text-center">
          <span>Approval: {ruleLabel(group.approval_rule)}</span>
          <span className="hidden sm:inline">•</span>
          <span>Auto-approve: {formatCurrency(group.auto_approve_limit || 0)}</span>
        </div>

        <div className="mx-auto grid w-full max-w-sm grid-cols-2 gap-x-4 gap-y-2 text-left text-sm text-white/80">
          <span className="flex min-w-0 items-center gap-2"><Users className="h-4 w-4 shrink-0" /><span className="truncate">{members.length} members</span></span>
          <span className="truncate capitalize">Type: {group.type}</span>
          <span className="truncate">Frequency: {group.contribution_frequency || 'adhoc'}</span>
          {group.contribution_amount ? <span className="truncate">Planned: {formatCurrency(group.contribution_amount)}</span> : null}
        </div>

        <div className="mt-4 bg-white/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/70">Join Code</p>
              <p className="font-mono font-bold text-lg tracking-wider">{group.code}</p>
            </div>
            <button onClick={copyCode} className="p-2 bg-white/20 rounded-lg">
              {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>

          <button
            onClick={shareGroup}
            className="w-full flex items-center justify-center gap-2 bg-white/15 border border-white/20 text-white font-semibold py-2.5 rounded-xl text-sm"
          >
            <Share2 className="w-4 h-4" />
            Share guest contribution link
          </button>
          <p className="text-center text-xs leading-5 text-white/70">Send this link to people who want to contribute without creating an account.</p>
        </div>
      </div>

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

      {joinRequests.length > 0 && (
        <div className="px-5 mt-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 space-y-3">
            <span className="text-xs font-bold text-yellow-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-yellow-600" />
              {joinRequests.length} Pending Join Request{joinRequests.length > 1 ? 's' : ''}
            </span>
            {joinRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-yellow-100">
                <div>
                  <p className="text-sm font-bold text-gray-900">Member request</p>
                  <p className="text-xs text-gray-500">{formatRelativeTime(req.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={reviewJoinRequest.isPending}
                    onClick={() => reviewJoinRequest.mutate({ requestId: req.id, approved: true })}
                    className="px-3 py-1.5 bg-green-600 text-white font-bold text-xs rounded-lg"
                  >
                    Approve
                  </button>
                  <button
                    disabled={reviewJoinRequest.isPending}
                    onClick={() => reviewJoinRequest.mutate({ requestId: req.id, approved: false })}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 font-semibold text-xs rounded-lg"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingWithdrawals.length > 0 && (
        <div className="px-5 mt-4 space-y-3">
          {pendingWithdrawals.map((w) => (
            <div key={w.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <span className="text-xs font-bold text-gray-900">🛡️ Pending Withdrawal</span>
                <span className="text-[10px] bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded-full">
                  {w.approval_count} of {w.approval_required} signatures
                </span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900 break-words">{w.requester_name}</p>
                  <p className="text-xs text-gray-500 break-words">{w.reason}</p>
                  <p className="text-xs text-gray-500 mt-1 break-all">→ {w.beneficiary_name} ({w.beneficiary_phone})</p>
                </div>
                <p className="text-sm font-bold text-red-600 flex-shrink-0">-{formatCurrency(w.amount)}</p>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-adansi-primary rounded-full h-2 transition-all"
                  style={{ width: `${Math.min(100, (w.approval_count / w.approval_required) * 100)}%` }}
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  disabled={approveWithdrawal.isPending}
                  onClick={() => handleApproveWithdrawal(w.id, true)}
                  className="flex-1 py-2.5 bg-adansi-primary text-adansi-secondary font-bold text-xs rounded-xl"
                >
                  Approve & Sign
                </button>
                <button
                  disabled={approveWithdrawal.isPending}
                  onClick={() => handleApproveWithdrawal(w.id, false)}
                  className="sm:px-4 py-2.5 bg-gray-100 text-gray-600 font-semibold text-xs rounded-xl"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="px-5 mt-6">
        <div className="flex gap-1 overflow-x-auto bg-gray-100 rounded-xl p-1 scrollbar-hide">
          {['activity', 'audit', 'ledger', 'members', ...(joinRequests.length ? ['requests'] : [])].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 min-w-[4.5rem] px-3 py-2 text-xs sm:text-sm font-medium rounded-lg capitalize transition-colors whitespace-nowrap ${
                activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-4">
        {activeTab === 'requests' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {joinRequests.map((request) => (
              <div key={request.id} className="flex items-center gap-3 p-4 border-b border-gray-50 last:border-0">
                <div className="w-10 h-10 rounded-full bg-adansi-primary/20 flex items-center justify-center"><Users className="w-5 h-5 text-adansi-secondary" /></div>
                <div className="flex-1"><p className="text-sm font-medium text-gray-900">Join request</p><p className="text-xs text-gray-500">{formatRelativeTime(request.created_at)}</p></div>
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
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {transactions.map((tx, i) => (
                  <div key={tx.id || i} className="flex items-center gap-3 py-3 px-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-green-50`}>
                      <ArrowDownLeft className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">Contribution</p>
                      <p className="text-xs text-gray-500">{formatRelativeTime(tx.created_at)} • {tx.method || 'momo'} • {tx.contribution_frequency || group.contribution_frequency || 'adhoc'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm text-green-600">+{formatCurrency(tx.amount)}</p>
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600">
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
        ) : activeTab === 'ledger' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {memberLedger.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-500">No contribution or benefit history yet.</p>
            ) : memberLedger.map((entry) => {
              const isContribution = entry.type === 'contribution'
              return (
                <div key={`${entry.type}-${entry.id}`} className="flex items-center gap-3 py-3 px-4 border-b border-gray-50 last:border-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isContribution ? 'bg-green-50' : 'bg-red-50'}`}>
                    {isContribution ? <ArrowDownLeft className="w-5 h-5 text-green-600" /> : <ArrowUpRight className="w-5 h-5 text-red-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm capitalize">{isContribution ? 'Contribution' : 'Benefit / Withdrawal'}</p>
                    <p className="text-xs text-gray-500">{entry.contribution_frequency || group.contribution_frequency || 'adhoc'} • {entry.method || 'momo'} • {formatRelativeTime(entry.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold text-sm ${isContribution ? 'text-green-600' : 'text-red-600'}`}>
                      {isContribution ? '+' : '-'}{formatCurrency(entry.amount)}
                    </p>
                    <span className="text-[10px] text-gray-400">{entry.status}</span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {members.map((member, i) => (
              <div key={member.id || i} className="flex items-center gap-3 py-3 px-4 border-b border-gray-50 last:border-0">
                <div className="w-10 h-10 rounded-full bg-adansi-secondary text-white flex items-center justify-center font-bold text-sm">
                  {(member.name || member.full_name || '?').charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">{member.name || member.full_name || 'Member'}</p>
                  <p className="text-xs text-gray-500">{member.phone || ''}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
                  member.role === 'admin' || member.role === 'treasurer' ? 'bg-adansi-primary/20 text-adansi-secondary' : 'bg-gray-100 text-gray-600'
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
