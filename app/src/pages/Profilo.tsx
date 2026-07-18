import { useEffect, useState } from 'react'
import { EditableText } from '../components/EditableText'
import {
  loadEmergencyContacts,
  loadExpensesData,
  loadMemories,
  loadStops,
  saveEmergencyContacts,
  type EmergencyContact,
  type Expense,
  type MemoriesData,
  type Stop,
} from '../lib/tripData'
import { ProfileEntryRow } from './profilo/ProfileEntryRow'

interface PaymentEntry {
  id: string
  title: string
  subtitle: string
  href: string
  masked?: boolean
  revealed?: boolean
}

const defaultPayments: PaymentEntry[] = [
  { id: 'pay1', title: 'Carte utilizzate', subtitle: 'Revolut', href: '' },
  { id: 'pay2', title: 'Contanti disponibili', subtitle: '68€ con te', href: '' },
  { id: 'pay3', title: 'Cambio valuta', subtitle: 'EUR · nessun cambio necessario', href: '' },
  { id: 'pay4', title: 'PIN carta personale', subtitle: '4471', href: '', masked: true, revealed: false },
]

export function Profilo() {
  const [name, setName] = useState('Andrea')
  const [notificationsOn, setNotificationsOn] = useState(true)
  const [nameSettingsOpen, setNameSettingsOpen] = useState(false)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [hasLeft, setHasLeft] = useState(false)
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [paymentsOpen, setPaymentsOpen] = useState(false)
  const [payments, setPayments] = useState<PaymentEntry[]>(defaultPayments)
  const [shareCopied, setShareCopied] = useState(false)

  const [stops, setStops] = useState<Stop[]>([])
  const [memories, setMemories] = useState<MemoriesData | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([])

  useEffect(() => {
    setStops(loadStops())
    setMemories(loadMemories())
    setExpenses(loadExpensesData().expenses)
    setEmergencyContacts(loadEmergencyContacts())
  }, [])

  function persistEmergency(next: EmergencyContact[]) {
    setEmergencyContacts(next)
    saveEmergencyContacts(next)
  }

  const tripDays = stops.length
    ? Math.max(...stops.map((s) => s.endDay || s.startDay || 1)) - Math.min(...stops.map((s) => s.startDay || 1)) + 1
    : 0
  const myMemoriesCount = memories ? memories.items.filter((it) => it.author === name).length : 0
  const mySpend = expenses.filter((e) => e.paidBy === 'A').reduce((a, e) => a + e.amount, 0)

  function copyShareLink() {
    const url = `${location.origin}/trip/spain/recap`
    navigator.clipboard?.writeText(url).catch(() => {})
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 1600)
  }

  if (hasLeft) {
    return (
      <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center px-8 text-center text-[var(--color-text)]">
        <div
          className="mb-4 flex h-22 w-22 items-center justify-center rounded-full text-center font-mono text-[8.5px] font-semibold text-[var(--color-add-text)]"
          style={{ background: 'repeating-linear-gradient(45deg,#ffe6cf,#ffe6cf 6px,#fff1e0 6px,#fff1e0 12px)' }}
        >
          fenicottero valigia
        </div>
        <div className="mb-1.5 font-display text-lg font-semibold">Hai lasciato Spain Roadtrip</div>
        <div className="mb-5 text-[12.5px] font-semibold leading-snug text-[var(--color-text-secondary)]">
          Il gruppo non ti vedrà più tra i<br />partecipanti attivi al viaggio
        </div>
        <button type="button" className="rounded-full px-5.5 py-3 text-[13px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#ff8a5b,#ff5f6d)' }} onClick={() => setHasLeft(false)}>
          Torna al viaggio
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-svh max-w-md bg-[var(--color-cream)] px-4.5 pb-24 pt-8 text-[var(--color-text)]">
      <div className="mb-3.5 flex items-center justify-between">
        <a href="/" className="flex items-center gap-1.5 font-display text-[19px] font-semibold italic text-[var(--color-coral)]">🦩 Piña</a>
        <a href="/" className="whitespace-nowrap rounded-xl border border-[var(--color-card-border)] bg-white px-3.5 py-1.75 text-xs font-bold text-[var(--color-text)]">🏠 Home</a>
      </div>

      <div className="mb-1 font-display text-2xl font-semibold">Profilo</div>
      <div className="mb-4.5 text-[12.5px] font-semibold text-[var(--color-text-secondary)]">Il tuo passaporto di viaggio</div>

      <div className="mb-4.5 rounded-3xl border-2 border-dashed border-[#e6b96f] bg-[#fffaf0] p-5 shadow-[0_14px_30px_-18px_rgba(120,90,40,.4)]">
        <div className="mb-4 flex items-center gap-3.5">
          <div className="flex h-14.5 w-14.5 shrink-0 items-center justify-center rounded-full text-2xl shadow-[0_6px_14px_-6px_rgba(217,72,31,.5)]" style={{ background: 'linear-gradient(135deg,#ffb627,#ff5f6d)' }}>🦩📸</div>
          <div className="min-w-0 flex-1">
            <EditableText key={name} initialText={name} className="font-display text-xl font-bold" onBlurText={(text) => setName(text || name)} />
            <div className="text-[11.5px] font-bold text-[#c2793a]">Explorer · Spain Roadtrip 2026</div>
          </div>
        </div>
        <div className="mb-3.5 border-t-[1.5px] border-dashed border-[#e6b96f]" />
        <div className="grid grid-cols-3 gap-x-2 gap-y-3">
          <div className="font-display text-base font-semibold">🌍 {tripDays > 0 ? `${tripDays} giorni` : '—'}</div>
          <div className="font-display text-base font-semibold">📸 {memories ? `${myMemoriesCount} ricordi` : '—'}</div>
          <div className="font-display text-base font-semibold">💰 {mySpend}€</div>
        </div>
      </div>

      <div className="mx-0.5 mb-2.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Essentials personali</div>

      <div className="mb-3 overflow-hidden rounded-[22px] shadow-[0_10px_22px_-16px_rgba(120,90,40,.25)]">
        <button type="button" className="flex w-full items-center gap-2.5 p-4 text-left text-white" style={{ background: 'linear-gradient(135deg,#ff5f6d,#c2445a)' }} onClick={() => setEmergencyOpen((v) => !v)}>
          <span className="text-xl">📞</span>
          <div className="flex-1">
            <div className="font-display text-base font-semibold">Contatti di emergenza</div>
            <div className="text-[11px] font-semibold text-white/85">{emergencyContacts.length} voci · condivisi con la crew</div>
          </div>
          <span className="text-[13px]">{emergencyOpen ? '⌃' : '⌄'}</span>
        </button>
        {emergencyOpen && (
          <div className="flex flex-col gap-2.5 bg-white px-4 py-3.5">
            {emergencyContacts.map((en) => (
              <ProfileEntryRow
                key={en.id}
                title={en.title}
                subtitle={en.subtitle}
                href={en.href}
                onSaveTitle={(text) => persistEmergency(emergencyContacts.map((e) => (e.id !== en.id ? e : { ...e, title: text || e.title })))}
                onSaveSubtitle={(text) => persistEmergency(emergencyContacts.map((e) => (e.id !== en.id ? e : { ...e, subtitle: text || e.subtitle })))}
                onDelete={() => persistEmergency(emergencyContacts.filter((e) => e.id !== en.id))}
              />
            ))}
            <button
              type="button"
              className="rounded-xl border-[1.5px] border-dashed border-[var(--color-add-border)] py-2.25 text-center text-xs font-bold text-[var(--color-add-text)]"
              onClick={() => persistEmergency([...emergencyContacts, { id: 'em' + Date.now(), title: 'Nuovo contatto', subtitle: 'Aggiungi numero', href: '' }])}
            >
              + Aggiungi voce
            </button>
          </div>
        )}
      </div>

      <div className="mb-4.5 overflow-hidden rounded-[22px] shadow-[0_10px_22px_-16px_rgba(120,90,40,.25)]">
        <button type="button" className="flex w-full items-center gap-2.5 p-4 text-left text-white" style={{ background: 'linear-gradient(135deg,#e8b74e,#b8792e)' }} onClick={() => setPaymentsOpen((v) => !v)}>
          <span className="text-xl">💳</span>
          <div className="flex-1">
            <div className="font-display text-base font-semibold">Pagamenti</div>
            <div className="text-[11px] font-semibold text-white/85">{payments.length} voci · solo tuoi</div>
          </div>
          <span className="text-[13px]">{paymentsOpen ? '⌃' : '⌄'}</span>
        </button>
        {paymentsOpen && (
          <div className="flex flex-col gap-2.5 bg-white px-4 py-3.5">
            {payments.map((en) => (
              <ProfileEntryRow
                key={en.id}
                title={en.title}
                subtitle={en.subtitle}
                masked={en.masked}
                revealed={en.revealed}
                onSaveTitle={(text) => setPayments((ps) => ps.map((p) => (p.id !== en.id ? p : { ...p, title: text || p.title })))}
                onSaveSubtitle={(text) => setPayments((ps) => ps.map((p) => (p.id !== en.id ? p : { ...p, subtitle: text || p.subtitle })))}
                onToggleReveal={() => setPayments((ps) => ps.map((p) => (p.id !== en.id ? p : { ...p, revealed: !p.revealed })))}
                onDelete={() => setPayments((ps) => ps.filter((p) => p.id !== en.id))}
              />
            ))}
            <button
              type="button"
              className="rounded-xl border-[1.5px] border-dashed border-[var(--color-add-border)] py-2.25 text-center text-xs font-bold text-[var(--color-add-text)]"
              onClick={() => setPayments((ps) => [...ps, { id: 'pay' + Date.now(), title: 'Nuova voce', subtitle: 'Aggiungi dettagli', href: '' }])}
            >
              + Aggiungi voce
            </button>
          </div>
        )}
      </div>

      <div className="mx-0.5 mb-2.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Condividi il viaggio</div>
      <div className="mb-5.5 rounded-[20px] border border-[var(--color-card-border)] bg-white p-4 shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
        <div className="mb-2.5 flex items-center gap-2.5">
          <span className="text-xl">🔗</span>
          <div className="flex-1">
            <div className="text-[13.5px] font-bold">Racconto del viaggio</div>
            <div className="text-[11.5px] font-semibold text-[var(--color-text-secondary)]">
              Un link di sola lettura con Journey, Today e Checklist — perfetto da mandare a chi vuole rifare un viaggio così
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <a href="/trip/spain/recap" className="flex-1 rounded-full bg-[var(--color-bg)] py-2.5 text-center text-xs font-bold text-[var(--color-text)]">👀 Anteprima</a>
          <button type="button" className="flex-1 rounded-full py-2.5 text-center text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#ff8a5b,#ff5f6d)' }} onClick={copyShareLink}>
            {shareCopied ? 'Copiato ✓' : 'Copia link'}
          </button>
        </div>
      </div>

      <div className="mx-0.5 mb-2.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Impostazioni</div>
      <div className="overflow-hidden rounded-[18px] border border-[var(--color-card-border)] bg-white shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
        <div className="border-b border-[var(--color-cream-light)]">
          <button type="button" className="flex w-full items-center gap-2.5 px-3.5 py-3.25 text-left" onClick={() => setNameSettingsOpen((v) => !v)}>
            <span className="text-base">👤</span>
            <span className="flex-1 text-[13px] font-semibold">Nome e preferenze</span>
            <span className="text-xs text-[#c2a97e]">{nameSettingsOpen ? '⌃' : '›'}</span>
          </button>
          {nameSettingsOpen && (
            <div className="px-3.5 pb-3.5 pl-10">
              <div className="mb-1.25 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--color-eyebrow)]">Il tuo nome nel viaggio</div>
              <EditableText key={'ns' + name} initialText={name} className="rounded-[10px] bg-[var(--color-bg)] px-2.5 py-2 font-display text-base font-semibold" onBlurText={(text) => setName(text || name)} />
              <div className="mt-1.5 text-[11px] font-semibold leading-snug text-[var(--color-text-secondary)]">Gli altri membri del gruppo vedranno questo nome nel viaggio.</div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2.5 border-b border-[var(--color-cream-light)] px-3.5 py-3.25">
          <span className="text-base">🔔</span>
          <span className="flex-1 text-[13px] font-semibold">Notifiche</span>
          <button
            type="button"
            className="flex h-6 w-10 items-center rounded-full p-0.5"
            style={{ background: notificationsOn ? '#d9481f' : 'var(--color-sand)' }}
            onClick={() => setNotificationsOn((v) => !v)}
          >
            <div className="h-5 w-5 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,.2)] transition-transform" style={{ transform: `translateX(${notificationsOn ? 16 : 0}px)` }} />
          </button>
        </div>
        <div>
          <button type="button" className="flex w-full items-center gap-2.5 px-3.5 py-3.25 text-left" onClick={() => setLeaveConfirmOpen((v) => !v)}>
            <span className="text-base">🚪</span>
            <span className="flex-1 text-[13px] font-bold text-[var(--color-coral)]">Esci dal viaggio</span>
            <span className="text-xs text-[#c2a97e]">{leaveConfirmOpen ? '⌃' : '›'}</span>
          </button>
          {leaveConfirmOpen && (
            <div className="px-3.5 pb-4 pl-10">
              <div className="mb-2.5 text-xs font-semibold leading-snug text-[var(--color-text-secondary)]">Sei sicuro? Non farai più parte dei partecipanti attivi a Spain Roadtrip.</div>
              <div className="flex gap-2">
                <button type="button" className="flex-1 rounded-full bg-[#f0e5d1] py-2.25 text-center text-xs font-bold text-[var(--color-text)]" onClick={() => setLeaveConfirmOpen(false)}>Annulla</button>
                <button type="button" className="flex-1 rounded-full bg-[var(--color-coral)] py-2.25 text-center text-xs font-bold text-white" onClick={() => { setHasLeft(true); setLeaveConfirmOpen(false) }}>Sì, esci</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
