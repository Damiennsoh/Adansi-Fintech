import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import LoadingScreen from './LoadingScreen'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return children
}
