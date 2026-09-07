import { useState, useEffect } from 'react'
import { X, Settings, Loader2, Save } from 'lucide-react'
import api from '../lib/api'

export default function GroupSettingsModal({ isOpen, onClose, group, onSaved }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('savings')
  const [targetAmount, setTargetAmount] = useState('')
  const [contributionAmount, setContributionAmount] = useState('')
  const [contributionFrequency, setContributionFrequency] = useState('monthly')
  const [approvalRule, setApprovalRule] = useState('any_1_treasurer')
  const [autoApproveLimit, setAutoApproveLimit] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  useEffect(() => {
    if (group) {
      setName(group.name || '')
      setType(group.type || 'savings')
      setTargetAmount(group.target_amount ? String(group.target_amount) : '')
      setContributionAmount(group.contribution_amount ? String(group.contribution_amount) : '')
      setContributionFrequency(group.contribution_frequency || 'monthly')
      setApprovalRule(group.approval_rule || 'any_1_treasurer')
      setAutoApproveLimit(group.auto_approve_limit !== undefined ? String(group.auto_approve_limit) : '0')
    }
  }, [group, isOpen])

  if (!isOpen || !group) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      const payload = {
        name,
        type,
        target_amount: targetAmount ? parseFloat(targetAmount) : null,
        contribution_amount: contributionAmount ? parseFloat(contributionAmount) : null,
        contribution_frequency: contributionFrequency,
        approval_rule: approvalRule,
        auto_approve_limit: autoApproveLimit ? parseFloat(autoApproveLimit) : 0,
      }

      const response = await api.put(`/groups/${group.id}`, payload)
      if (onSaved) onSaved(response.data)
      onClose()
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to update group settings.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-slide-up">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-gray-100">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-adansi-primary/20 flex items-center justify-center">
              <Settings className="w-5 h-5 text-adansi-secondary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Group Settings</h3>
              <p className="text-xs text-gray-500">Update governance rules, target goals, and contribution rules</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-red-600">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Group Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-adansi-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Group Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-adansi-primary capitalize"
              >
                <option value="wedding">Wedding</option>
                <option value="funeral">Funeral</option>
                <option value="susu">Susu</option>
                <option value="savings">Savings</option>
                <option value="investment">Investment</option>
                <option value="health">Health</option>
                <option value="school">School</option>
                <option value="business">Business</option>
                <option value="welfare">Welfare</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Fund Target (GHS)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 5000"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-adansi-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Per Person Amount (GHS)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 100"
                value={contributionAmount}
                onChange={(e) => setContributionAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-adansi-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Contribution Frequency</label>
              <select
                value={contributionFrequency}
                onChange={(e) => setContributionFrequency(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-adansi-primary capitalize"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="adhoc">Adhoc / Flexible</option>
              </select>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Withdrawal Governance Rules</h4>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Signatory Requirement</label>
              <select
                value={approvalRule}
                onChange={(e) => setApprovalRule(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-adansi-primary"
              >
                <option value="any_1_treasurer">Any 1 Treasurer / Admin</option>
                <option value="two_of_three_treasurers">2 of 3 Treasurers</option>
                <option value="majority_members">Majority of Group Members</option>
                <option value="unanimous_members">Unanimous (100% of Members)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Instant Auto-Approve Limit (GHS)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0 for all manual approval"
                value={autoApproveLimit}
                onChange={(e) => setAutoApproveLimit(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-adansi-primary"
              />
              <p className="text-[11px] text-gray-500 mt-1">Withdrawals under this limit disburse automatically without requiring signatory approval.</p>
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-xl bg-adansi-secondary text-white font-semibold text-sm hover:bg-adansi-secondary/90 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Settings
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
