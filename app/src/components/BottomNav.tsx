import { NavLink, useParams } from 'react-router-dom'

const TABS = [
  { key: 'journey', label: 'Journey', icon: '🗺' },
  { key: 'today', label: 'Today', icon: '☀️' },
  { key: 'spese', label: 'Spese', icon: '💰' },
  { key: 'checklist', label: 'Checklist', icon: '🎒' },
  { key: 'memories', label: 'Memories', icon: '📸' },
  { key: 'profilo', label: 'Profilo', icon: '👤' },
] as const

export function BottomNav() {
  const { tripId } = useParams()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 mx-auto flex max-w-md justify-around border-t border-[var(--color-card-border)] bg-[#fffaf0] px-1.5 pb-3.5 pt-2.5"
      style={{ boxShadow: '0 -8px 20px -16px rgba(120,90,40,.3)' }}
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.key}
          to={`/trip/${tripId}/${tab.key}`}
          className={({ isActive }) =>
            `flex flex-col items-center text-center ${
              isActive ? 'text-[var(--color-coral)]' : 'text-[#c2a97e]'
            }`
          }
        >
          <div className="text-lg">{tab.icon}</div>
          <div className="mt-0.5 text-[9px] font-bold">{tab.label}</div>
        </NavLink>
      ))}
    </nav>
  )
}
