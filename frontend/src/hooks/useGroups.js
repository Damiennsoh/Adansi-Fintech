import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { useGroupStore } from '../store/groupStore'

const mockGroups = [
  {
    id: 'demo-group-1',
    name: 'Adansi Traders Susu',
    description: 'Weekly contribution group for Makola Market traders',
    type: 'susu',
    balance: 12500.00,
    target_amount: 20000.00,
    member_count: 12,
    cycle_period: 'weekly',
    recent_transactions: [
      { id: 'tx-1', type: 'contribution', amount: 200, member_name: 'Amina Owusu', status: 'completed', created_at: '2026-08-29T12:00:00Z' },
      { id: 'tx-2', type: 'contribution', amount: 300, member_name: 'Kofi Mensah', status: 'completed', created_at: '2026-08-28T14:30:00Z' }
    ]
  },
  {
    id: 'demo-group-2',
    name: 'Asante Welfare Fund',
    description: 'Emergency & funeral mutual aid circle',
    type: 'welfare',
    balance: 8400.00,
    target_amount: 10000.00,
    member_count: 8,
    cycle_period: 'monthly',
    recent_transactions: [
      { id: 'tx-3', type: 'contribution', amount: 500, member_name: 'Damien Nsoh', status: 'completed', created_at: '2026-08-25T09:15:00Z' }
    ]
  }
]

export function useGroups() {
  const queryClient = useQueryClient()
  const { setGroups } = useGroupStore()

  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/groups')
        if (Array.isArray(data) && data.length > 0) {
          setGroups(data)
          return data
        }
        setGroups(mockGroups)
        return mockGroups
      } catch (err) {
        setGroups(mockGroups)
        return mockGroups
      }
    },
  })

  const createGroup = useMutation({
    mutationFn: async (groupData) => {
      const { data } = await api.post('/groups', groupData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })

  const joinGroup = useMutation({
    mutationFn: async (code) => {
      const { data } = await api.post(`/groups/code/${code}/join`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })

  return {
    groups: groupsQuery.data || [],
    isLoading: groupsQuery.isLoading,
    createGroup,
    joinGroup,
  }
}

export function useGroupDetail(groupId) {
  const queryClient = useQueryClient()
  const { setCurrentGroup, setTransactions, setMembers } = useGroupStore()

  const defaultGroup = mockGroups.find(g => g.id === groupId) || mockGroups[0]

  const groupQuery = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/groups/${groupId}`)
        setCurrentGroup(data)
        return data
      } catch (err) {
        setCurrentGroup(defaultGroup)
        return defaultGroup
      }
    },
    enabled: !!groupId,
  })

  const transactionsQuery = useQuery({
    queryKey: ['transactions', groupId],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/groups/${groupId}/contributions`)
        setTransactions(data.contributions || data)
        return data.contributions || data
      } catch (err) {
        return defaultGroup.recent_transactions || []
      }
    },
    enabled: !!groupId,
  })

  const auditQuery = useQuery({
    queryKey: ['audit', groupId],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/groups/${groupId}/audit`)
        return data.events || []
      } catch (err) {
        return [
          { id: 'aud-1', event_type: 'group_created', entity_type: 'group', created_at: '2026-08-20T10:00:00Z' },
          { id: 'aud-2', event_type: 'member_joined', entity_type: 'user', created_at: '2026-08-22T14:30:00Z' },
          { id: 'aud-3', event_type: 'contribution_received', entity_type: 'contribution', amount: 500, created_at: '2026-08-25T09:15:00Z' },
          { id: 'aud-4', event_type: 'withdrawal_requested', entity_type: 'withdrawal', amount: 1500, created_at: '2026-08-29T16:00:00Z' },
        ]
      }
    },
    enabled: !!groupId,
  })

  const joinRequestsQuery = useQuery({
    queryKey: ['join-requests', groupId],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/groups/${groupId}/join-requests`)
        return data.requests || []
      } catch (err) {
        return []
      }
    },
    enabled: !!groupId,
    retry: false,
  })

  const reviewJoinRequest = useMutation({
    mutationFn: async ({ requestId, approved }) => {
      const { data } = await api.post(`/groups/${groupId}/join-requests/${requestId}/review`, null, { params: { approved } })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['join-requests', groupId] })
      queryClient.invalidateQueries({ queryKey: ['group', groupId] })
      queryClient.invalidateQueries({ queryKey: ['members', groupId] })
    },
  })

  const membersQuery = useQuery({
    queryKey: ['members', groupId],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/groups/${groupId}`)
        setMembers(data.members || [])
        return data.members || []
      } catch (err) {
        const demoMembers = [
          { name: 'Kofi Mensah (Creator)', phone: '+233 24 111 2222', role: 'admin', total_contributed: 2500 },
          { name: 'Amina Owusu', phone: '+233 20 333 4444', role: 'treasurer', total_contributed: 1800 },
          { name: 'Damien Nsoh', phone: '+233 27 555 6666', role: 'member', total_contributed: 1200 },
          { name: 'Yaw Addo', phone: '+233 54 777 8888', role: 'member', total_contributed: 900 },
        ]
        setMembers(demoMembers)
        return demoMembers
      }
    },
    enabled: !!groupId,
  })

  const inviteMember = useMutation({
    mutationFn: async ({ groupId, phone }) => {
      const { data } = await api.post(`/groups/${groupId}/invite`, { phone })
      return data
    },
  })

  return {
    group: groupQuery.data || defaultGroup,
    transactions: transactionsQuery.data || [],
    auditEvents: auditQuery.data || [],
    joinRequests: joinRequestsQuery.data || [],
    reviewJoinRequest,
    members: membersQuery.data || [],
    isLoading: groupQuery.isLoading,
    inviteMember,
  }
}
