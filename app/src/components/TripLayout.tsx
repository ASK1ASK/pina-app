import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export function TripLayout() {
  return (
    <div className="mx-auto min-h-svh max-w-md bg-[var(--color-cream)]" style={{ paddingBottom: 'calc(6rem + var(--safe-bottom))' }}>
      <Outlet />
      <BottomNav />
    </div>
  )
}
