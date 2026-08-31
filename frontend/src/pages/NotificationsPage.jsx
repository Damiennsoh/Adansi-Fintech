import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Bell, CheckCircle2, ArrowDownLeft, ArrowUpRight, Info } from 'lucide-react'
import { formatRelativeTime } from '../lib/utils'
import api from '../lib/api'

const iconMap = {
  contribution: { icon: ArrowDownLeft, color: 'bg-green-50 text-green-600' },
  withdrawal: { icon: ArrowUpRight, color: 'bg-red-50 text-red-600' },
  approval: { icon: CheckCircle2, color: 'bg-blue-50 text-blue-600' },
  credit: { icon: Bell, color: 'bg-purple-50 text-purple-600' },
  info: { icon: Info, color: 'bg-gray-50 text-gray-600' },
}

function mapNotification(n) {
  const type = n.type || 'info'
  return {
    id: n.id,
    type,
    title: n.title || type,
    message: n.body || n.message || '',
    time: n.created_at,
    read: n.read ?? false,
  }
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: notifs = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get('/users/me/notifications')
      return (data.notifications || []).map(mapNotification)
    },
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      await Promise.all(
        notifs.filter((n) => !n.read).map((n) =>
          api.put(`/users/me/notifications/${n.id}/read`)
        )
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-5 pt-8 pb-4 sticky top-0 z-30 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
          </div>
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending || notifs.every((n) => n.read)}
            className="text-sm text-adansi-primary font-medium disabled:opacity-50"
          >
            Mark all read
          </button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        {isLoading ? (
          <p className="text-center text-sm text-gray-500 py-8">Loading...</p>
        ) : notifs.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-8">No notifications yet.</p>
        ) : (
          notifs.map((n) => {
            const config = iconMap[n.type] || iconMap.info
            const Icon = config.icon
            return (
              <div
                key={n.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border ${
                  n.read ? 'border-gray-100' : 'border-adansi-primary/30 bg-adansi-primary/5'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${config.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-gray-900 text-sm">{n.title}</p>
                      <span className="text-[10px] text-gray-400">{formatRelativeTime(n.time)}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                  </div>
                  {!n.read && <div className="w-2 h-2 bg-adansi-primary rounded-full flex-shrink-0 mt-2" />}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
