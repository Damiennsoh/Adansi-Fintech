import { useEffect } from 'react'
import { subscribeToTable } from '../lib/supabase'
import { useGroupStore } from '../store/groupStore'

export function useRealtimeContributions(groupId) {
  const { addTransaction, updateGroupBalance } = useGroupStore()

  useEffect(() => {
    if (!groupId) return

    const unsubscribe = subscribeToTable('contributions', (payload) => {
      if (payload.new.group_id === groupId) {
        addTransaction(payload.new)
        updateGroupBalance(groupId, payload.new.new_balance)
      }
    })

    return () => unsubscribe()
  }, [groupId])
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
