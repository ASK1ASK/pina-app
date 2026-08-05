import { NavLink, useParams } from 'react-router-dom'

// Cinque, non sei: il profilo si raggiunge dal tondo in alto a destra, che a
// differenza di un'icona 👤 uguale per tutti mostra la tua iniziale e il tuo
// colore in questa crew. Su iPhone SE cinque schede prendono 75px l'una invece
// di 62, e le etichette da 9px smettono di stare strette.
const TABS = [
  { key: 'journey', label: 'Journey', icon: '🗺' },
  { key: 'today', label: 'Today', icon: '☀️' },
  { key: 'spese', label: 'Spese', icon: '💰' },
  { key: 'checklist', label: 'Checklist', icon: '🎒' },
  { key: 'memories', label: 'Memories', icon: '📸' },
] as const

export function BottomNav() {
  const { tripId } = useParams()

  // z-30: senza una priorita' esplicita la barra resta a livello "auto" e il
  // contenuto posizionato (le tappe di Journey usano z-[1]) le viene disegnato
  // sopra, coprendola e rendendola non cliccabile mentre si scorre. Sta sotto
  // i pannelli (z-40), che devono invece poterla coprire.
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 mx-auto flex max-w-md justify-around border-t border-[var(--color-card-border)] bg-[#fffaf0] px-1.5 pt-2.5"
      style={{ boxShadow: '0 -8px 20px -16px rgba(120,90,40,.3)', paddingBottom: 'calc(0.875rem + var(--safe-bottom))' }}
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.key}
          to={`/trip/${tripId}/${tab.key}`}
          className={({ isActive }) =>
            `flex flex-col items-center text-center ${
              isActive ? 'text-[var(--color-coral-text)]' : 'text-[var(--color-text-secondary)]'
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
