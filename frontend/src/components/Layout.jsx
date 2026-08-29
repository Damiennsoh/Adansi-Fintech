import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <main className="max-w-lg mx-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
