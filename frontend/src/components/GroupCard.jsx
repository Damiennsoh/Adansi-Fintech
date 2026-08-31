import { Users, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatCurrency, getGroupColor } from '../lib/utils'

export default function GroupCard({ group }) {
  return (
    <Link
      to={`/groups/${group.id}`}
      className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`w-12 h-12 flex-shrink-0 rounded-xl ${getGroupColor(group.type)} flex items-center justify-center text-white font-bold text-lg`}>
            {group.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="font-semibold text-gray-900 break-words">{group.name}</h3>
              {group.code && (
                <span className="font-mono text-[10px] bg-adansi-secondary/10 text-adansi-secondary font-bold px-1.5 py-0.5 rounded border border-adansi-secondary/20 flex-shrink-0">
                  {group.code}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500 capitalize">{group.type} Group</span>
          </div>
        </div>
        <ArrowUpRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">Balance</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(group.balance || 0)}</p>
        </div>
        <div className="flex items-center gap-1 text-gray-500">
          <Users className="w-4 h-4" />
          <span className="text-sm">{group.member_count || 0}</span>
        </div>
      </div>

      {group.target_amount > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500">Progress</span>
            <span className="font-medium">
              {Math.round(((group.balance || 0) / group.target_amount) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-adansi-primary rounded-full h-2 transition-all"
              style={{ width: `${Math.min(((group.balance || 0) / group.target_amount) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}
    </Link>
  )
}
