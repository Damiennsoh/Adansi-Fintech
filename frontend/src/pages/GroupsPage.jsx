import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Filter } from 'lucide-react'
import { useGroups } from '../hooks/useGroups'
import GroupCard from '../components/GroupCard'

export default function GroupsPage() {
  const { groups, isLoading } = useGroups()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const filteredGroups = groups.filter(group => {
    const matchesFilter = filter === 'all' || group.type === filter
    const matchesSearch = group.name.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'funeral', label: 'Funeral' },
    { key: 'wedding', label: 'Wedding' },
    { key: 'health', label: 'Health' },
    { key: 'savings', label: 'Savings' },
    { key: 'investment', label: 'Investment' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-5 pt-8 pb-4 sticky top-0 z-30 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">My Groups</h1>
          <Link
            to="/groups/create"
            className="w-10 h-10 bg-adansi-primary rounded-full flex items-center justify-center active:scale-90 transition-transform"
          >
            <Plus className="w-5 h-5 text-adansi-secondary" />
          </Link>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-adansi-primary/20"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f.key
                  ? 'bg-adansi-secondary text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="text-center py-12">
            <Filter className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No groups found</p>
          </div>
        ) : (
          filteredGroups.map(group => (
            <GroupCard key={group.id} group={group} />
          ))
        )}
      </div>
    </div>
  )
}
