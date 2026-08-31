import { Link, useLocation } from 'react-router-dom'
import { Home, Users, TrendingUp, User, Globe, ShoppingBag } from 'lucide-react'
import { cn } from '../lib/utils'

const navItems = [
  { path: '/dashboard', label: 'Home', icon: Home },
  { path: '/groups', label: 'Groups', icon: Users },
  { path: '/diaspora', label: 'Diaspora', icon: Globe },
  { path: '/marketplace', label: 'Market', icon: ShoppingBag },
  { path: '/profile', label: 'Profile', icon: User },
]

export default function BottomNav() {
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-bottom">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center w-full h-full space-y-0.5 transition-colors',
                isActive ? 'text-adansi-primary' : 'text-gray-400'
              )}
            >
              <item.icon className={cn('w-5 h-5', isActive && 'stroke-[2.5px]')} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
