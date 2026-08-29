import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import LoadingScreen from './components/LoadingScreen'

// Pages
import LoginPage from './pages/LoginPage'
import VerifyOTPPage from './pages/VerifyOTPPage'
import SetupPINPage from './pages/SetupPINPage'
import DashboardPage from './pages/DashboardPage'
import GroupsPage from './pages/GroupsPage'
import GroupDetailPage from './pages/GroupDetailPage'
import CreateGroupPage from './pages/CreateGroupPage'
import JoinGroupPage from './pages/JoinGroupPage'
import ContributePage from './pages/ContributePage'
import WithdrawPage from './pages/WithdrawPage'
import CreditPage from './pages/CreditPage'
import ProfilePage from './pages/ProfilePage'
import NotificationsPage from './pages/NotificationsPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import DiasporaPage from './pages/DiasporaPage'
import MarketplacePage from './pages/MarketplacePage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function AppInitializer({ children }) {
  const { initAuth, isLoading } = useAuthStore()

  useEffect(() => {
    initAuth()
  }, [])

  if (isLoading) return <LoadingScreen />
  return children
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppInitializer>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/verify-otp" element={<VerifyOTPPage />} />
            <Route path="/setup-pin" element={<SetupPINPage />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/groups" element={<GroupsPage />} />
              <Route path="/groups/create" element={<CreateGroupPage />} />
              <Route path="/groups/join" element={<JoinGroupPage />} />
              <Route path="/groups/:id" element={<GroupDetailPage />} />
              <Route path="/groups/:id/contribute" element={<ContributePage />} />
              <Route path="/groups/:id/withdraw" element={<WithdrawPage />} />
              <Route path="/credit" element={<CreditPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/diaspora" element={<DiasporaPage />} />
              <Route path="/marketplace" element={<MarketplacePage />} />
              <Route path="/admin" element={<AdminDashboardPage />} />
            </Route>

            {/* Redirect root */}
            <Route path="/" element={<LoginPage />} />
          </Routes>
        </AppInitializer>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
