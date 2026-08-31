import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'

export function useContributions() {
  const queryClient = useQueryClient()

  const contribute = useMutation({
    mutationFn: async ({ groupId, amount, network = 'mtn' }) => {
      const { data } = await api.post('/contributions', { group_id: groupId, amount, network })
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['group', variables.groupId] })
      queryClient.invalidateQueries({ queryKey: ['transactions', variables.groupId] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })

  const verifyContribution = useMutation({
    mutationFn: async (contributionId) => {
      const { data } = await api.post(`/contributions/${contributionId}/verify`)
      return data
    },
  })

  return { contribute, verifyContribution }
}

export function useWithdrawals() {
  const queryClient = useQueryClient()

  const requestWithdrawal = useMutation({
    mutationFn: async ({
      groupId, amount, reason,
      beneficiary_name, beneficiary_phone, beneficiary_network,
      disbursement_method, beneficiary_bank_account,
    }) => {
      const { data } = await api.post('/withdrawals', {
        group_id: groupId,
        amount,
        reason,
        beneficiary_name,
        beneficiary_phone,
        beneficiary_network,
        disbursement_method,
        beneficiary_bank_account,
      })
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['group', variables.groupId] })
      queryClient.invalidateQueries({ queryKey: ['pending-withdrawals', variables.groupId] })
    },
  })

  const approveWithdrawal = useMutation({
    mutationFn: async ({ withdrawalId, approved }) => {
      const { data } = await api.post(`/withdrawals/${withdrawalId}/approve`, { approved })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      queryClient.invalidateQueries({ queryKey: ['pending-withdrawals'] })
    },
  })

  return { requestWithdrawal, approveWithdrawal }
}

export function useCredit() {
  const queryClient = useQueryClient()

  const creditProfile = useQuery({
    queryKey: ['creditProfile'],
    queryFn: async () => {
      const { data } = await api.get('/credit/me')
      return data
    },
  })

  const applyLoan = useMutation({
    mutationFn: async (loanData) => {
      const { data } = await api.post('/credit/loans/apply', loanData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditProfile'] })
    },
  })

  const repayLoan = useMutation({
    mutationFn: async ({ loanId, amount }) => {
      const { data } = await api.post(`/credit/loans/${loanId}/repay`, { amount })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditProfile'] })
    },
  })

  return {
    creditProfile: creditProfile.data,
    isLoading: creditProfile.isLoading,
    applyLoan,
    repayLoan,
  }
}
