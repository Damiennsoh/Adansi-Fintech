import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { subscribeToTable } from '../lib/supabase'
import { useGroupStore } from '../store/groupStore'

export function useRealtimeContributions(groupId) {
  const { addTransaction, updateGroupBalance } = useGroupStore()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!groupId) return

    const unsubscribe = subscribeToTable('contributions', (payload) => {
      if (payload.new.group_id === groupId) {
        addTransaction(payload.new)
        updateGroupBalance(groupId, payload.new.new_balance)

        // Invalidate React Query caches so Ledger, Activity, and Audit tabs refresh
        queryClient.invalidateQueries({ queryKey: ['group-ledger', groupId] })
        queryClient.invalidateQueries({ queryKey: ['transactions', groupId] })
        queryClient.invalidateQueries({ queryKey: ['audit', groupId] })
        queryClient.invalidateQueries({ queryKey: ['group', groupId] })
      }
    })

    return () => unsubscribe()
  }, [groupId, queryClient])
}

export function useRealtimeNotifications(userId) {
  useEffect(() => {
    if (!userId) return

    const unsubscribe = subscribeToTable('notifications', (payload) => {
      if (payload.new.user_id === userId) {
        // Show browser notification or toast
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Adansi', {
            body: payload.new.message,
            icon: '/icons/icon-192x192.png',
          })
        }
      }
    })

    return () => unsubscribe()
  }, [userId])
}
