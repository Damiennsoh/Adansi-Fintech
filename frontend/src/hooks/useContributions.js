import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'

export function useContributions() {
  const queryClient = useQueryClient()

  const contribute = useMutation({
    mutationFn: async ({ groupId, amount, network = 'mtn', payerPhone, method = 'momo', payerName }) => {
      const { data } = await api.post('/contributions', {
        group_id: groupId,
        amount,
        network,
        method,
        payer_phone: payerPhone || undefined,
        payer_name: payerName || undefined,
      })
      return data
    },
    onSuccess: (_, variables) => {
      const groupId = variables.groupId
      queryClient.invalidateQueries({ queryKey: ['group', groupId] })
      queryClient.invalidateQueries({ queryKey: ['transactions', groupId] })
      queryClient.invalidateQueries({ queryKey: ['group-ledger', groupId] })
      queryClient.invalidateQueries({ queryKey: ['audit', groupId] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] })
      queryClient.invalidateQueries({ queryKey: ['historyTransactions'] })
      queryClient.invalidateQueries({ queryKey: ['historySummary'] })
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
      const groupId = variables.groupId
      queryClient.invalidateQueries({ queryKey: ['group', groupId] })
      queryClient.invalidateQueries({ queryKey: ['pending-withdrawals', groupId] })
      queryClient.invalidateQueries({ queryKey: ['group-ledger', groupId] })
      queryClient.invalidateQueries({ queryKey: ['audit', groupId] })
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] })
      queryClient.invalidateQueries({ queryKey: ['historyTransactions'] })
      queryClient.invalidateQueries({ queryKey: ['historySummary'] })
    },
  })

  const approveWithdrawal = useMutation({
    mutationFn: async ({ withdrawalId, approved }) => {
      const { data } = await api.post(`/withdrawals/${withdrawalId}/approve`, { approved })
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      queryClient.invalidateQueries({ queryKey: ['pending-withdrawals'] })
      queryClient.invalidateQueries({ queryKey: ['group-ledger'] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
      queryClient.invalidateQueries({ queryKey: ['group'] })
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] })
      queryClient.invalidateQueries({ queryKey: ['historyTransactions'] })
      queryClient.invalidateQueries({ queryKey: ['historySummary'] })
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
