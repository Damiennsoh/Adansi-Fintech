import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Users, Copy, Share2, Phone, Wallet, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, FileDown, Archive, RotateCcw, Loader2 } from 'lucide-react'
import { useGroupDetail } from '../hooks/useGroups'
import { useWithdrawals } from '../hooks/useContributions'
import { useRealtimeContributions } from '../hooks/useRealtime'
import { formatCurrency, formatGroupType, formatRelativeTime, getGroupColor } from '../lib/utils'
import api from '../lib/api'
import USSDModal from '../components/USSDModal'
import { useAuthStore } from '../store/authStore'

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
  const { user } = useAuthStore()
  const {
    group,
    transactions,
    auditEvents,
    joinRequests,
    pendingWithdrawals,
    reviewJoinRequest,
    members,
    updateMemberRole,
    archiveMember,
    unarchiveMember,
    groupLedger,
    isLoading
  } = useGroupDetail(id)
  const { approveWithdrawal } = useWithdrawals()
  const [activeTab, setActiveTab] = useState(initialTab)
  const [showUSSD, setShowUSSD] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Pagination states for 10 initially + View More
  const [activityLimit, setActivityLimit] = useState(10)
  const [auditLimit, setAuditLimit] = useState(10)

  // Sub-view toggle for members tab (active vs archived)
  const [memberSubTab, setMemberSubTab] = useState('active')

  const downloadStatement = async () => {
    try {
      setIsExporting(true)
      const response = await api.get(`/groups/${id}/ledger.pdf`, { responseType: 'blob' })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${group.code}-financial-statement.pdf`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download financial statement:', err)
      let errMsg = 'Failed to download financial statement.'
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text()
          const json = JSON.parse(text)
          errMsg = json.detail || errMsg
        } catch (_) {}
      } else if (err.response?.data?.detail) {
        errMsg = err.response.data.detail
      }
      alert(errMsg)
    } finally {
      setIsExporting(false)
    }
  }

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
  const balance = group?.balance ?? group?.current_balance ?? 0
  const userIdStr = String(user?.id || user?.user_id || '').toLowerCase()
  const allMembers = members.length > 0 ? members : (group?.members || [])
  const currentMember = allMembers.find((member) => {
    const memberUid = String(member.user_id || member.user?.id || member.id || '').toLowerCase()
    return memberUid && userIdStr && memberUid === userIdStr
  })
  const isGroupCreator = group?.created_by && userIdStr && String(group.created_by).toLowerCase() === userIdStr
  const canManageRoles = isGroupCreator || currentMember?.role === 'admin' || currentMember?.role === 'treasurer'

  const activeMembers = allMembers.filter((member) => !member.archived_at)
  const archivedMembers = allMembers.filter((member) => !!member.archived_at)

  const visibleTransactions = transactions.slice(0, activityLimit)
  const visibleAuditEvents = auditEvents.slice(0, auditLimit)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className={`${colorClass} px-5 pt-8 pb-6 text-white`}>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/groups')} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors">
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
          <span className="flex min-w-0 items-center gap-2"><Users className="h-4 w-4 shrink-0" /><span className="truncate">{activeMembers.length} active members</span></span>
          <span className="truncate">Type: {formatGroupType(group.type)}</span>
          <span className="truncate">Frequency: {group.contribution_frequency || 'adhoc'}</span>
          {group.target_amount ? <span className="truncate">Target: {formatCurrency(group.target_amount)}</span> : null}
          {group.contribution_amount ? <span className="truncate">Per contribution: {formatCurrency(group.contribution_amount)}</span> : null}
        </div>

        <div className="mt-4 bg-white/20 rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/70">Join Code</p>
              <p className="font-mono font-bold text-lg tracking-wider">{group.code}</p>
            </div>
            <button onClick={copyCode} className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
              {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>

          <button
            onClick={shareGroup}
            className="w-full flex items-center justify-center gap-2 bg-white/15 border border-white/20 text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-white/25 transition-colors"
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
            className="px-4 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center active:scale-[0.98] transition-transform"
            title="USSD Info"
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
                    className="px-3 py-1.5 bg-green-600 text-white font-bold text-xs rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    disabled={reviewJoinRequest.isPending}
                    onClick={() => reviewJoinRequest.mutate({ requestId: req.id, approved: false })}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 font-semibold text-xs rounded-lg hover:bg-gray-300 transition-colors"
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
                  className="flex-1 py-2.5 bg-adansi-primary text-adansi-secondary font-bold text-xs rounded-xl hover:bg-adansi-primary/90 transition-colors"
                >
                  Approve & Sign
                </button>
                <button
                  disabled={approveWithdrawal.isPending}
                  onClick={() => handleApproveWithdrawal(w.id, false)}
                  className="sm:px-4 py-2.5 bg-gray-100 text-gray-600 font-semibold text-xs rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main navigation tabs */}
      <div className="px-5 mt-6">
        <div className="flex gap-1 overflow-x-auto bg-gray-100 rounded-xl p-1 scrollbar-hide">
          {['activity', 'audit', 'ledger', 'members', ...(joinRequests.length ? ['requests'] : [])].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-[4.5rem] px-3 py-2 text-xs sm:text-sm font-medium rounded-lg capitalize transition-colors whitespace-nowrap text-center ${
                activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
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
                <div className="w-10 h-10 rounded-full bg-adansi-primary/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-adansi-secondary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Join request</p>
                  <p className="text-xs text-gray-500">{formatRelativeTime(request.created_at)}</p>
                </div>
                <button disabled={reviewJoinRequest.isPending} onClick={() => reviewJoinRequest.mutate({ requestId: request.id, approved: false })} className="px-2 py-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-lg">Reject</button>
                <button disabled={reviewJoinRequest.isPending} onClick={() => reviewJoinRequest.mutate({ requestId: request.id, approved: true })} className="px-2 py-1.5 text-xs font-semibold text-adansi-secondary bg-adansi-primary rounded-lg">Approve</button>
              </div>
            ))}
          </div>
        ) : activeTab === 'activity' ? (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {transactions.length === 0 ? (
                <div className="text-center py-8">
                  <Wallet className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No transactions yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {visibleTransactions.map((tx, i) => (
                    <div key={tx.id || i} className="flex items-center gap-3 py-3 px-4">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-50">
                        <ArrowDownLeft className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          Contribution {tx.contributor_name ? `by ${tx.contributor_name}` : ''}
                        </p>
                        <p className="text-xs text-gray-500">{formatRelativeTime(tx.created_at)} • {tx.method || 'momo'} • {tx.contribution_frequency || group.contribution_frequency || 'adhoc'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
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

            {/* Pagination / View More for Activity */}
            {transactions.length > activityLimit && (
              <button
                onClick={() => setActivityLimit((prev) => prev + 10)}
                className="w-full py-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              >
                View More Activity ({transactions.length - activityLimit} remaining)
              </button>
            )}
          </div>
        ) : activeTab === 'audit' ? (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {auditEvents.length === 0 ? (
                <p className="p-8 text-center text-sm text-gray-500">No audit events yet.</p>
              ) : (
                visibleAuditEvents.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 py-3 px-4 border-b border-gray-50 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-adansi-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-4 h-4 text-adansi-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm capitalize">{event.event_type.replaceAll('_', ' ')}</p>
                      <p className="text-xs text-gray-500 break-words">{event.entity_type} • {event.actor_name || 'System'} • {formatRelativeTime(event.created_at)}</p>
                    </div>
                    {event.amount != null && <span className="text-sm font-semibold text-gray-900 shrink-0">{formatCurrency(event.amount)}</span>}
                  </div>
                ))
              )}
            </div>

            {/* Pagination / View More for Audit Events */}
            {auditEvents.length > auditLimit && (
              <button
                onClick={() => setAuditLimit((prev) => prev + 10)}
                className="w-full py-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              >
                View More Audit Events ({auditEvents.length - auditLimit} remaining)
              </button>
            )}
          </div>
        ) : activeTab === 'ledger' ? (
          <div className="space-y-3">
            {/* Export financial statement button — admins and treasurers only */}
            {canManageRoles && (
              <button
                onClick={downloadStatement}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-adansi-secondary px-4 py-3 text-sm font-semibold text-white hover:bg-adansi-secondary/90 transition-colors shadow-sm disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating financial statement...
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4" /> Export financial statement (PDF)
                  </>
                )}
              </button>
            )}

            {/* Ledger summary totals */}
            {groupLedger.entries.length > 0 && (() => {
              const totalIn = groupLedger.entries.filter(e => e.type === 'contribution').reduce((s, e) => s + e.amount, 0)
              const totalOut = groupLedger.entries.filter(e => e.type === 'withdrawal').reduce((s, e) => s + e.amount, 0)
              return (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-medium tracking-wide">Total In</p>
                    <p className="text-sm font-bold text-green-600 mt-0.5">{formatCurrency(totalIn)}</p>
                  </div>
                  <div className="border-x border-gray-100">
                    <p className="text-[10px] text-gray-400 uppercase font-medium tracking-wide">Total Out</p>
                    <p className="text-sm font-bold text-red-500 mt-0.5">{formatCurrency(totalOut)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-medium tracking-wide">Net</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">{formatCurrency(totalIn - totalOut)}</p>
                  </div>
                </div>
              )
            })()}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {groupLedger.entries.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <Wallet className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-700 text-sm font-medium">No transactions yet</p>
                  <p className="text-gray-400 text-xs mt-1">Contributions and withdrawals will appear here once settled.</p>
                </div>
              ) : (
                groupLedger.entries.map((entry) => {
                  const isContribution = entry.type === 'contribution'
                  const displayMember = entry.member_name || 'Member'
                  const displayBeneficiary = entry.beneficiary_name
                  const isGuest = entry.is_guest === true

                  return (
                    <div key={`${entry.type}-${entry.id}`} className="flex items-center gap-3 py-3 px-4 border-b border-gray-50 last:border-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isContribution ? 'bg-green-50' : 'bg-red-50'}`}>
                        {isContribution ? <ArrowDownLeft className="w-5 h-5 text-green-600" /> : <ArrowUpRight className="w-5 h-5 text-red-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm truncate">
                            {isContribution ? (
                              <>
                                <span className="text-gray-500 font-normal">Contribution by </span>
                                <span className="font-bold text-gray-900">{displayMember}</span>
                              </>
                            ) : (
                              <>
                                <span className="text-gray-500 font-normal">Disbursement to </span>
                                <span className="font-bold text-gray-900">{displayBeneficiary || displayMember}</span>
                              </>
                            )}
                          </p>
                          {isGuest && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 whitespace-nowrap">
                              Guest
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {entry.contribution_frequency || group.contribution_frequency || 'adhoc'} • {entry.method || 'momo'} • {formatRelativeTime(entry.created_at)}
                        </p>
                        {!isContribution && displayBeneficiary && displayMember !== displayBeneficiary && (
                          <p className="text-[11px] text-gray-400 truncate">Requested by: {displayMember}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-semibold text-sm ${isContribution ? 'text-green-600' : 'text-red-600'}`}>
                          {isContribution ? '+' : '-'}{formatCurrency(entry.amount)}
                        </p>
                        <span className="text-[10px] text-gray-400 capitalize">{entry.status}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Members tab header / sub-view navigation */}
            <div className="flex items-center justify-between bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setMemberSubTab('active')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors text-center ${
                  memberSubTab === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Active Members ({activeMembers.length})
              </button>
              <button
                onClick={() => setMemberSubTab('archived')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors text-center ${
                  memberSubTab === 'archived' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Archived Members ({archivedMembers.length})
              </button>
            </div>

            {memberSubTab === 'active' ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
                {activeMembers.length === 0 ? (
                  <p className="p-8 text-center text-sm text-gray-500">No active members.</p>
                ) : (
                  activeMembers.map((member, i) => {
                    const memberUserId = member.user_id || member.id
                    const isSelf = memberUserId === user?.id || memberUserId === user?.user_id

                    return (
                      <div key={member.id || i} className="flex items-center gap-3 py-3 px-4">
                        <div className="w-10 h-10 rounded-full bg-adansi-secondary text-white flex items-center justify-center font-bold text-sm shrink-0">
                          {(member.name || member.full_name || '?').charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{member.name || member.full_name || 'Member'}</p>
                          <p className="text-xs text-gray-500 truncate">{member.phone || ''}</p>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${
                          member.role === 'admin' || member.role === 'treasurer' ? 'bg-adansi-primary/20 text-adansi-secondary' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {member.role || 'member'}
                        </span>

                        {canManageRoles && !isSelf && (
                          <select
                            value={member.role || 'member'}
                            disabled={updateMemberRole.isPending}
                            onChange={(event) => updateMemberRole.mutate({ userId: memberUserId, role: event.target.value })}
                            className="max-w-[7rem] rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 shrink-0"
                            aria-label={`Change role for ${member.name || member.full_name || 'member'}`}
                          >
                            <option value="member">Member</option>
                            <option value="treasurer">Treasurer</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}

                        {canManageRoles && !isSelf && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Archive ${member.name || 'this member'}? Their financial contribution history will be preserved for auditing.`)) {
                                archiveMember.mutate({ userId: memberUserId })
                              }
                            }}
                            disabled={archiveMember.isPending}
                            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600 transition-colors shrink-0"
                            title={`Archive ${member.name || 'member'}`}
                            aria-label={`Archive ${member.name || 'member'}`}
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
                {archivedMembers.length === 0 ? (
                  <div className="p-8 text-center">
                    <Users className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No archived members.</p>
                  </div>
                ) : (
                  archivedMembers.map((member, i) => {
                    const memberUserId = member.user_id || member.id

                    return (
                      <div key={member.id || i} className="flex items-center gap-3 py-3 px-4 bg-gray-50/50">
                        <div className="w-10 h-10 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center font-bold text-sm shrink-0">
                          {(member.name || member.full_name || '?').charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-700 text-sm truncate">{member.name || member.full_name || 'Member'}</p>
                          <p className="text-xs text-gray-400 truncate">{member.phone || ''} • Archived</p>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 shrink-0">
                          Archived
                        </span>

                        {canManageRoles && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Restore ${member.name || 'this member'} back to active group status?`)) {
                                unarchiveMember.mutate({ userId: memberUserId })
                              }
                            }}
                            disabled={unarchiveMember.isPending}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold hover:bg-green-100 transition-colors shrink-0"
                            title="Restore member"
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Restore
                          </button>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <USSDModal isOpen={showUSSD} onClose={() => setShowUSSD(false)} groupCode={group.code} />
    </div>
  )
}

