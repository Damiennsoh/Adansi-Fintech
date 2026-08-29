import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGroups } from '../hooks/useGroups'
import { ArrowLeft, Loader2, Users, Target, Calendar } from 'lucide-react'

const groupTypes = [
  { key: 'funeral', label: 'Funeral', desc: 'Funeral contributions & expenses', color: 'bg-purple-500' },
  { key: 'wedding', label: 'Wedding', desc: 'Wedding contributions & planning', color: 'bg-pink-500' },
  { key: 'health', label: 'Health', desc: 'Medical bills & health support', color: 'bg-green-500' },
  { key: 'savings', label: 'Savings', desc: 'Rotating savings (Susu)', color: 'bg-blue-500' },
  { key: 'investment', label: 'Investment', desc: 'Group investment pool', color: 'bg-orange-500' },
]

export default function CreateGroupPage() {
  const navigate = useNavigate()
  const { createGroup } = useGroups()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '',
    type: 'savings',
    target_amount: '',
    contribution_amount: '',
    frequency: 'monthly',
    description: '',
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = await createGroup.mutateAsync({
        ...form,
        target_amount: parseFloat(form.target_amount) || 0,
        contribution_amount: parseFloat(form.contribution_amount) || 0,
      })
      navigate(`/groups/${data.id}`)
    } catch (err) {
      alert('Failed to create group. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-5 pt-8 pb-4 sticky top-0 z-30 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Create Group</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-5 py-6 space-y-6">
        {/* Step 1: Basic Info */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Group Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., Auntie Esi Funeral Fund"
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-adansi-primary focus:ring-2 focus:ring-adansi-primary/20"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Group Type</label>
          <div className="grid grid-cols-1 gap-2">
            {groupTypes.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setForm({ ...form, type: t.key })}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                  form.type === t.key
                    ? 'border-adansi-primary bg-adansi-primary/5'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg ${t.color} flex items-center justify-center text-white`}>
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{t.label}</p>
                  <p className="text-xs text-gray-500">{t.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Target Amount (GHS)</label>
          <div className="relative">
            <Target className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="number"
              value={form.target_amount}
              onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
              placeholder="5000"
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-adansi-primary focus:ring-2 focus:ring-adansi-primary/20"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Optional — leave empty for no target</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contribution (GHS)</label>
            <input
              type="number"
              value={form.contribution_amount}
              onChange={(e) => setForm({ ...form, contribution_amount: e.target.value })}
              placeholder="50"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-adansi-primary focus:ring-2 focus:ring-adansi-primary/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-adansi-primary appearance-none"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="one_time">One-time</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What is this group for?"
            rows={3}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-adansi-primary focus:ring-2 focus:ring-adansi-primary/20 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={createGroup.isPending || !form.name}
          className="w-full bg-adansi-primary text-adansi-secondary font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
        >
          {createGroup.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Group'}
        </button>
      </form>
    </div>
  )
}
