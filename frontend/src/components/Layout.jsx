import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 pb-safe overflow-x-hidden">
      <main className="max-w-lg mx-auto w-full min-w-0">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
