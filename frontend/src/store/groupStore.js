import { create } from 'zustand'

export const useGroupStore = create((set, get) => ({
  groups: [],
  currentGroup: null,
  transactions: [],
  members: [],
  isLoading: false,

  setGroups: (groups) => set({ groups }),
  setCurrentGroup: (group) => set({ currentGroup: group }),
  setTransactions: (transactions) => set({ transactions }),
  setMembers: (members) => set({ members }),
  setLoading: (isLoading) => set({ isLoading }),

  addGroup: (group) => set((state) => ({ groups: [group, ...state.groups] })),
  updateGroupBalance: (groupId, newBalance) => set((state) => ({
    groups: state.groups.map(g => 
      g.id === groupId ? { ...g, balance: newBalance } : g
    ),
    currentGroup: state.currentGroup?.id === groupId 
      ? { ...state.currentGroup, balance: newBalance } 
      : state.currentGroup
  })),

  addTransaction: (transaction) => set((state) => ({
    transactions: [transaction, ...state.transactions]
  })),
}))
