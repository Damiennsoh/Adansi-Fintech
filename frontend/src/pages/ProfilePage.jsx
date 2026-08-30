import { useAuth } from '../hooks/useAuth'
import { useAuthStore } from '../store/authStore'
import { User, Phone, Shield, LogOut, ChevronRight, CreditCard, Bell, HelpCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function ProfilePage() {
  const { user, logout } = useAuthStore()
  const { logout: authLogout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await authLogout()
    navigate('/login')
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  const menuItems = [
    ...(isAdmin ? [{ icon: Shield, label: 'Admin Dashboard', desc: 'Platform overview & analytics', action: () => navigate('/admin') }] : []),
    { icon: CreditCard, label: 'My Ghana Card', desc: user?.ghana_card_number ? user.ghana_card_number : 'Verify your identity', action: () => {} },
    { icon: Bell, label: 'Notifications', desc: 'Push & SMS preferences', action: () => {} },
    { icon: Shield, label: 'Security', desc: 'Change PIN, 2FA', action: () => {} },
    { icon: HelpCircle, label: 'Help & Support', desc: 'FAQ, contact us', action: () => {} },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-adansi-secondary px-5 pt-8 pb-6">
        <h1 className="text-xl font-bold text-white mb-6">Profile</h1>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-adansi-primary flex items-center justify-center text-adansi-secondary text-2xl font-bold">
            {(user?.full_name || user?.name || '?').charAt(0)}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{user?.full_name || user?.name || 'Member'}</h2>
            <div className="flex items-center gap-1 text-gray-400 text-sm">
              <Phone className="w-3.5 h-3.5" />
              {user?.phone || '+233...'}
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-6 space-y-4">
        {menuItems.map((item, i) => (
          <button
            key={i}
            onClick={item.action}
            className="w-full bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
              <item.icon className="w-5 h-5 text-gray-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-gray-900">{item.label}</p>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        ))}

        <button
          onClick={handleLogout}
          className="w-full bg-red-50 rounded-2xl p-4 flex items-center gap-4 border border-red-100 active:scale-[0.98] transition-transform mt-6"
        >
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <LogOut className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-medium text-red-600">Logout</p>
            <p className="text-xs text-red-400">Sign out of your account</p>
          </div>
        </button>
      </div>
    </div>
  )
}
