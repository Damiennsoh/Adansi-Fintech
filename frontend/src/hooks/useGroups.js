import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { useGroupStore } from '../store/groupStore'

export function useGroups() {
  const queryClient = useQueryClient()
  const { setGroups } = useGroupStore()

  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data } = await api.get('/groups')
      setGroups(data)
      return data
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

  const groupQuery = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const { data } = await api.get(`/groups/${groupId}`)
      setCurrentGroup(data)
      return data
    },
    enabled: !!groupId,
  })

  const transactionsQuery = useQuery({
    queryKey: ['transactions', groupId],
    queryFn: async () => {
      const { data } = await api.get(`/groups/${groupId}/contributions`)
      setTransactions(data)
      return data
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

  const membersQuery = useQuery({
    queryKey: ['members', groupId],
    queryFn: async () => {
      const { data } = await api.get(`/groups/${groupId}`)
      setMembers(data.members || [])
      return data.members || []
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
    group: groupQuery.data,
    transactions: transactionsQuery.data?.contributions || transactionsQuery.data || [],
    auditEvents: auditQuery.data || [],
    members: membersQuery.data || [],
    isLoading: groupQuery.isLoading,
    inviteMember,
  }
}
