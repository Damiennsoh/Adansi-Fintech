import { useState } from 'react'
import { useAuth, useUserProfile } from '../hooks/useAuth'
import { useAuthStore } from '../store/authStore'
import { Phone, Shield, LogOut, ChevronRight, CreditCard, Bell, HelpCircle, Clock, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import GhanaCardModal from '../components/GhanaCardModal'
import NotificationSettingsModal from '../components/NotificationSettingsModal'
import SecurityModal from '../components/SecurityModal'
import HelpSupportModal from '../components/HelpSupportModal'

export default function ProfilePage() {
  const { user, logout } = useAuthStore()
  const { logout: authLogout } = useAuth()
  const { data: profile, refetch } = useUserProfile()
  const navigate = useNavigate()

  const [isGhanaCardOpen, setIsGhanaCardOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isSecurityOpen, setIsSecurityOpen] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  const handleLogout = async () => {
    await authLogout()
    navigate('/login')
  }

  const currentUser = profile || user
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin' || import.meta.env.DEV
  const hasGhanaCard = Boolean(currentUser?.ghana_card_number)

  const menuItems = [
    {
      icon: Clock,
      label: 'Contribution History',
      desc: 'Track your payments & on-time rate',
      action: () => navigate('/history'),
      color: 'bg-blue-50 text-blue-600',
    },
    ...(isAdmin ? [{
      icon: Shield,
      label: 'Admin Dashboard',
      desc: 'Platform overview & analytics',
      action: () => navigate('/admin'),
      color: 'bg-indigo-50 text-indigo-600',
    }] : []),
    {
      icon: CreditCard,
      label: 'My Ghana Card',
      desc: hasGhanaCard ? `${currentUser.ghana_card_number} (Verified)` : 'Verify your identity',
      action: () => setIsGhanaCardOpen(true),
      color: 'bg-emerald-50 text-emerald-600',
      badge: hasGhanaCard ? 'Verified' : 'Required',
      badgeColor: hasGhanaCard ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
    },
    {
      icon: Bell,
      label: 'Notifications',
      desc: 'Push, WhatsApp & SMS preferences',
      action: () => setIsNotificationsOpen(true),
      color: 'bg-purple-50 text-purple-600',
    },
    {
      icon: Shield,
      label: 'Security',
      desc: 'Change PIN, 2FA & Biometrics',
      action: () => setIsSecurityOpen(true),
      color: 'bg-cyan-50 text-cyan-600',
    },
    {
      icon: HelpCircle,
      label: 'Help & Support',
      desc: 'FAQ, WhatsApp chat & Helpline',
      action: () => setIsHelpOpen(true),
      color: 'bg-amber-50 text-amber-600',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Profile Header */}
      <div className="bg-adansi-secondary px-5 pt-8 pb-7 rounded-b-3xl shadow-md">
        <h1 className="text-xl font-extrabold text-white mb-6">My Profile</h1>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-adansi-primary text-adansi-secondary text-2xl font-bold flex items-center justify-center shadow-lg">
            {(currentUser?.full_name || currentUser?.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white truncate">
                {currentUser?.full_name || currentUser?.name || 'Member'}
              </h2>
              {hasGhanaCard && (
                <ShieldCheck className="w-4 h-4 text-adansi-primary flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-1 text-gray-400 text-xs mt-0.5">
              <Phone className="w-3.5 h-3.5" />
              <span>{currentUser?.phone || currentUser?.email || '+233...'}</span>
            </div>
            <div className="inline-block mt-2 px-2.5 py-0.5 bg-white/10 rounded-full text-[10px] font-semibold text-adansi-primary tracking-wide">
              {hasGhanaCard ? 'Verified Tier 2 Account' : 'Standard Member'}
            </div>
          </div>
        </div>
      </div>

      {/* Menu Options */}
      <div className="px-5 py-6 space-y-3.5">
        {menuItems.map((item, i) => (
          <button
            key={i}
            onClick={item.action}
            className="w-full bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm border border-gray-100 hover:border-adansi-primary/30 active:scale-[0.98] transition-all text-left"
          >
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
              <item.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-gray-900 text-sm">{item.label}</p>
                {item.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 truncate mt-0.5">{item.desc}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
          </button>
        ))}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full bg-red-50 hover:bg-red-100 rounded-2xl p-4 flex items-center gap-4 border border-red-100 active:scale-[0.98] transition-all mt-6 text-left"
        >
          <div className="w-11 h-11 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center flex-shrink-0">
            <LogOut className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-red-600 text-sm">Logout</p>
            <p className="text-xs text-red-400">Sign out of your session</p>
          </div>
        </button>
      </div>

      {/* Modals */}
      <GhanaCardModal
        isOpen={isGhanaCardOpen}
        onClose={() => setIsGhanaCardOpen(false)}
        currentCard={currentUser?.ghana_card_number}
        onVerified={() => refetch()}
      />

      <NotificationSettingsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      <SecurityModal
        isOpen={isSecurityOpen}
        onClose={() => setIsSecurityOpen(false)}
      />

      <HelpSupportModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  )
}

