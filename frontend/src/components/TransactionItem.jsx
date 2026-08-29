import { ArrowDownLeft, ArrowUpRight, Clock, CheckCircle2 } from 'lucide-react'
import { formatCurrency, formatRelativeTime } from '../lib/utils'

export default function TransactionItem({ transaction }) {
  const isContribution = transaction.type === 'contribution'

  const statusConfig = {
    pending: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    completed: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    failed: { icon: Clock, color: 'text-red-600', bg: 'bg-red-50' },
  }

  const config = statusConfig[transaction.status] || statusConfig.pending
  const StatusIcon = config.icon

  return (
    <div className="flex items-center gap-3 py-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isContribution ? 'bg-green-50' : 'bg-red-50'}`}>
        {isContribution ? (
          <ArrowDownLeft className="w-5 h-5 text-green-600" />
        ) : (
          <ArrowUpRight className="w-5 h-5 text-red-600" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">
          {isContribution ? 'Contribution' : 'Withdrawal'}
        </p>
        <p className="text-xs text-gray-500">{transaction.member_name || 'Unknown'} • {formatRelativeTime(transaction.created_at)}</p>
      </div>

      <div className="text-right">
        <p className={`font-semibold ${isContribution ? 'text-green-600' : 'text-red-600'}`}>
          {isContribution ? '+' : '-'}{formatCurrency(transaction.amount)}
        </p>
        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${config.bg} ${config.color}`}>
          <StatusIcon className="w-3 h-3" />
          {transaction.status}
        </div>
      </div>
    </div>
  )
}
