import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { useGroupStore } from '../store/groupStore'

function normalizeGroup(g) {
  if (!g) return g
  return {
    ...g,
    balance: g.balance ?? g.current_balance ?? 0,
    member_count: g.member_count ?? g.members?.length ?? 0,
  }
}

export function useGroups() {
  const queryClient = useQueryClient()
  const { setGroups } = useGroupStore()

  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data } = await api.get('/groups')
      const normalized = (Array.isArray(data) ? data : []).map(normalizeGroup)
      setGroups(normalized)
      return normalized
    },
  })

  const createGroup = useMutation({
    mutationFn: async (groupData) => {
      const { data } = await api.post('/groups', groupData)
      return normalizeGroup(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })

  const joinGroup = useMutation({
    mutationFn: async (code) => {
      const { data } = await api.post('/groups/join-by-code', { code })
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

  const groupQuery = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const { data } = await api.get(`/groups/${groupId}`)
      const normalized = normalizeGroup(data)
      setCurrentGroup(normalized)
      return normalized
    },
    enabled: !!groupId,
  })

  const transactionsQuery = useQuery({
    queryKey: ['transactions', groupId],
    queryFn: async () => {
      const { data } = await api.get(`/groups/${groupId}/contributions`)
      const items = data.contributions || data || []
      setTransactions(items)
      return items
    },
    enabled: !!groupId,
  })

  const auditQuery = useQuery({
    queryKey: ['audit', groupId],
    queryFn: async () => {
      const { data } = await api.get(`/groups/${groupId}/audit`)
      return data.events || []
    },
    enabled: !!groupId,
  })

  const joinRequestsQuery = useQuery({
    queryKey: ['join-requests', groupId],
    queryFn: async () => {
      const { data } = await api.get(`/groups/${groupId}/join-requests`)
      return data.requests || []
    },
    enabled: !!groupId,
    retry: false,
  })

  const pendingWithdrawalsQuery = useQuery({
    queryKey: ['pending-withdrawals', groupId],
    queryFn: async () => {
      const { data } = await api.get(`/withdrawals/group/${groupId}/pending`)
      return data.withdrawals || []
    },
    enabled: !!groupId,
    retry: false,
  })

  const reviewJoinRequest = useMutation({
    mutationFn: async ({ requestId, approved }) => {
      const { data } = await api.post(
        `/groups/${groupId}/join-requests/${requestId}/review`,
        null,
        { params: { approved } }
      )
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
      const { data } = await api.get(`/groups/${groupId}`)
      const members = (data.members || []).map((m) => ({
        ...m,
        name: m.full_name || m.name || 'Member',
      }))
      setMembers(members)
      return members
    },
    enabled: !!groupId,
  })

  const inviteMember = useMutation({
    mutationFn: async ({ groupId: gid, phone }) => {
      const { data } = await api.post(`/groups/${gid}/invite`, { phone })
      return data
    },
  })

  const updateMemberRole = useMutation({
    mutationFn: async ({ userId, role }) => {
      const { data } = await api.post(`/groups/${groupId}/members/${userId}/role`, null, { params: { role } })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] })
      queryClient.invalidateQueries({ queryKey: ['members', groupId] })
      queryClient.invalidateQueries({ queryKey: ['audit', groupId] })
    },
  })

  return {
    group: groupQuery.data,
    transactions: transactionsQuery.data || [],
    auditEvents: auditQuery.data || [],
    joinRequests: joinRequestsQuery.data || [],
    pendingWithdrawals: pendingWithdrawalsQuery.data || [],
    reviewJoinRequest,
    members: membersQuery.data || [],
    isLoading: groupQuery.isLoading,
    inviteMember,
    updateMemberRole,
  }
}
