import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EditableText } from '../components/EditableText'
import { useAuth } from '../lib/authContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { isUuid } from '../lib/uuid'
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
import { identityColorDefs } from '../lib/palette'
import {
  fetchExpensesData,
  fetchTripMembers,
  leaveTrip,
  membriAttivi,
  removeTripMember,
  type RealMember,
} from './spese/supabaseSpese'
import { fetchTripMeta, type TripMeta } from './journey/supabaseJourney'
import { fetchMemories } from './memories/supabaseMemories'
import { fetchEmergencyContacts, persistEmergencyContacts, updateMemberIdentity } from './profilo/supabaseProfilo'
import { ProfileEntryRow } from './profilo/ProfileEntryRow'

export function Profilo() {
  const { tripId: routeTripId } = useParams()
  const isRealTrip = isUuid(routeTripId)
  const { session } = useAuth()
  const { showError } = useToast()

  const [loading, setLoading] = useState(isRealTrip)
  const [name, setName] = useState(isRealTrip ? '' : 'Andrea')
  const [myMemberId, setMyMemberId] = useState<string | null>(null)
  const [myColor, setMyColor] = useState('#ff8a5b')
  const [tripMeta, setTripMeta] = useState<TripMeta | null>(null)
  const [notificationsOn, setNotificationsOn] = useState(true)
  const [nameSettingsOpen, setNameSettingsOpen] = useState(false)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [hasLeft, setHasLeft] = useState(false)
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [crew, setCrew] = useState<RealMember[]>([])
  const [crewOpen, setCrewOpen] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removingBusy, setRemovingBusy] = useState(false)

  const [stops, setStops] = useState<Stop[]>([])
  const [memories, setMemories] = useState<MemoriesData | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [myRealSpend, setMyRealSpend] = useState(0)
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([])

  useEffect(() => {
    if (isRealTrip && routeTripId) {
      setLoading(true)
      Promise.all([
        fetchTripMeta(routeTripId),
        fetchTripMembers(routeTripId),
        fetchMemories(routeTripId),
        fetchExpensesData(routeTripId),
        fetchEmergencyContacts(routeTripId),
      ])
        .then(([meta, members, memData, expData, contacts]) => {
          setTripMeta(meta)
          setMemories({ days: memData.days, items: memData.items })
          setEmergencyContacts(contacts)
          setCrew(members)
          const me = members.find((m) => m.userId === session?.user?.id)
          setMyMemberId(me?.id ?? null)
          setName(me?.name || 'Viaggiatore')
          setMyColor(me?.color || '#ff8a5b')
          const myId = me?.id
          setMyRealSpend(myId ? expData.expenses.filter((e) => e.paidByMemberId === myId).reduce((a, e) => a + e.amount, 0) : 0)
        })
        .catch((err) => showError('Non siamo riusciti a caricare il profilo.', err))
        .finally(() => setLoading(false))
      if (session?.user?.id) {
        supabase
          .from('trip_members')
          .select('role')
          .eq('trip_id', routeTripId)
          .eq('user_id', session.user.id)
          .maybeSingle()
          .then(({ data }) => setIsOrganizer(data?.role === 'organizer'))
      }
      return
    }
    setStops(loadStops())
    setMemories(loadMemories())
    setExpenses(loadExpensesData().expenses)
    setEmergencyContacts(loadEmergencyContacts())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeTripId])

  function persistEmergency(next: EmergencyContact[]) {
    setEmergencyContacts(next)
    if (isRealTrip && routeTripId) {
      persistEmergencyContacts(routeTripId, next).catch((err) => showError('Non siamo riusciti a salvare i contatti.', err))
    } else {
      saveEmergencyContacts(next)
    }
  }

  // Il nome/colore qui sono per QUESTO viaggio (trip_members), non
  // dell'account: la stessa persona può chiamarsi ed essere colorata
  // diversamente in viaggi diversi.
  function saveName(text: string) {
    const next = text || name
    setName(next)
    if (isRealTrip && myMemberId) {
      updateMemberIdentity(myMemberId, { displayName: next }).catch((err) => showError('Non siamo riusciti a salvare il nome.', err))
    }
  }

  // Uscire davvero: prima il database, poi la schermata. Se la chiamata
  // fallisce non si mostra niente di rassicurante — il difetto di prima era
  // esattamente questo, una schermata che prometteva una cosa mai avvenuta.
  async function confermaUscita() {
    if (!isRealTrip || !routeTripId) return
    setLeaving(true)
    try {
      await leaveTrip(routeTripId)
      setLeaveConfirmOpen(false)
      setHasLeft(true)
    } catch (err) {
      showError('Non siamo riusciti a farti uscire dal viaggio.', err)
    } finally {
      setLeaving(false)
    }
  }

  async function confermaRimozione(memberId: string) {
    setRemovingBusy(true)
    try {
      await removeTripMember(memberId)
      setCrew((prima) =>
        prima.map((m) => (m.id === memberId ? { ...m, leftAt: new Date().toISOString(), userId: null } : m)),
      )
      setRemovingId(null)
    } catch (err) {
      showError('Non siamo riusciti a rimuovere questa persona.', err)
    } finally {
      setRemovingBusy(false)
    }
  }

  function saveColor(hex: string) {
    setMyColor(hex)
    if (isRealTrip && myMemberId) {
      updateMemberIdentity(myMemberId, { color: hex }).catch((err) => showError('Non siamo riusciti a salvare il colore.', err))
    }
  }

  const tripDays = isRealTrip
    ? tripMeta
      ? Math.round((tripMeta.endDate.getTime() - tripMeta.startDate.getTime()) / 86400000) + 1
      : 0
    : stops.length
      ? Math.max(...stops.map((s) => s.endDay || s.startDay || 1)) - Math.min(...stops.map((s) => s.startDay || 1)) + 1
      : 0
  const myMemoriesCount = memories ? memories.items.filter((it) => it.author === name).length : 0
  const mySpend = isRealTrip ? myRealSpend : expenses.filter((e) => e.paidBy === 'A').reduce((a, e) => a + e.amount, 0)
  const tripName = isRealTrip ? tripMeta?.name || 'il tuo viaggio' : 'Spain Roadtrip'
  const tripYearLabel = isRealTrip && tripMeta ? String(tripMeta.startDate.getFullYear()) : '2026'
  const recapHref = `/trip/${routeTripId ?? 'spain'}/recap`

  function copyShareLink() {
    const url = `${location.origin}${recapHref}`
    navigator.clipboard?.writeText(url).catch(() => {})
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 1600)
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-svh max-w-md items-center justify-center bg-[var(--color-cream)] text-sm font-semibold text-[var(--color-text-secondary)]">
        Caricamento...
      </div>
    )
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
        <div className="mb-1.5 font-display text-lg font-semibold">Hai lasciato {tripName}</div>
        <div className="mb-5 text-[12.5px] font-semibold leading-snug text-[var(--color-text-secondary)]">
          Il gruppo non ti vede più tra i partecipanti attivi.
          <br />
          Le spese che avevi registrato restano al loro posto.
          <br />
          Se cambi idea puoi rientrare con il codice del viaggio.
        </div>
        {/*
          ⚠️ QUESTO <a> VA LASCIATO <a>. Non convertirlo a <Link> per simmetria
          con gli altri ritorni alla Home di questa pagina: qui la ricarica
          completa e' voluta. Serve a ripartire da una Home pulita, senza il
          viaggio da cui si e' appena usciti; con un <Link> lo stato React
          resterebbe quello di prima e il viaggio lasciato comparirebbe ancora
          nell'elenco. Prima qui c'era "Torna al viaggio", che funzionava
          soltanto perche' non era mai successo niente.
        */}
        <a href="/" className="rounded-full px-5.5 py-3 text-[13px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#ff8a5b,#ff5f6d)' }}>
          Torna alla Home
        </a>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-svh max-w-md bg-[var(--color-cream)] px-4.5 pb-24 pt-8 text-[var(--color-text)]">
      <div className="mb-3.5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-1.5 font-display text-[19px] font-semibold italic text-[var(--color-coral)]">🦩 Piña</Link>
        {/*
          Profilo e' l'unica pagina di viaggio senza TripIdentityLink: questo
          pulsante e' la sua unica via d'uscita, quindi resta. E' navigazione
          normale, non il ritorno dopo l'uscita dal viaggio: <Link>, non <a>.
        */}
        <Link to="/" className="whitespace-nowrap rounded-xl border border-[var(--color-card-border)] bg-white px-3.5 py-1.75 text-xs font-bold text-[var(--color-text)]">🏠 Home</Link>
      </div>

      <div className="mb-1 font-display text-2xl font-semibold">Profilo</div>
      <div className="mb-4.5 text-[12.5px] font-semibold text-[var(--color-text-secondary)]">Il tuo passaporto di viaggio</div>

      <div className="mb-4.5 rounded-3xl border-2 border-dashed border-[#e6b96f] bg-[#fffaf0] p-5 shadow-[0_14px_30px_-18px_rgba(120,90,40,.4)]">
        <div className="mb-4 flex items-center gap-3.5">
          {isRealTrip ? (
            <div className="flex h-14.5 w-14.5 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white shadow-[0_6px_14px_-6px_rgba(217,72,31,.5)]" style={{ background: myColor }}>
              {(name || '?').slice(0, 1).toUpperCase()}
            </div>
          ) : (
            <div className="flex h-14.5 w-14.5 shrink-0 items-center justify-center rounded-full text-2xl shadow-[0_6px_14px_-6px_rgba(217,72,31,.5)]" style={{ background: 'linear-gradient(135deg,#ffb627,#ff5f6d)' }}>🦩📸</div>
          )}
          <div className="min-w-0 flex-1">
            <EditableText key={name} initialText={name || 'Il tuo nome'} className="font-display text-xl font-bold" onBlurText={saveName} />
            <div className="text-[11.5px] font-bold text-[var(--color-amber-text)]">Explorer · {tripName} {tripYearLabel}</div>
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
          <a href={recapHref} className="flex-1 rounded-full bg-[var(--color-bg)] py-2.5 text-center text-xs font-bold text-[var(--color-text)]">👀 Anteprima</a>
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
            <span className="text-xs text-[var(--color-text-secondary)]">{nameSettingsOpen ? '⌃' : '›'}</span>
          </button>
          {nameSettingsOpen && (
            <div className="px-3.5 pb-3.5 pl-10">
              <div className="mb-1.25 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--color-eyebrow)]">Il tuo nome nel viaggio</div>
              <EditableText key={'ns' + name} initialText={name || 'Il tuo nome'} className="rounded-[10px] bg-[var(--color-bg)] px-2.5 py-2 font-display text-base font-semibold" onBlurText={saveName} />
              <div className="mb-1.5 mt-3 text-[11px] font-semibold leading-snug text-[var(--color-text-secondary)]">Gli altri membri del gruppo vedranno questo nome (e questo colore) in questo viaggio — puoi usarne uno diverso in ogni viaggio.</div>
              {isRealTrip && (
                <div className="mt-2.5 flex flex-wrap gap-2.5">
                  {identityColorDefs.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="h-8 w-8 rounded-full"
                      style={{ background: c.hex, boxShadow: myColor === c.hex ? '0 0 0 2px var(--color-bg), 0 0 0 4px #3a2a1c' : undefined }}
                      onClick={() => saveColor(c.hex)}
                    />
                  ))}
                </div>
              )}
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
        {isRealTrip && isOrganizer && (
          <a href={`/onboarding?step=createTrip&trip=${routeTripId}`} className="flex w-full items-center gap-2.5 border-b border-[var(--color-cream-light)] px-3.5 py-3.25 text-left">
            <span className="text-base">⚙️</span>
            <span className="flex-1 text-[13px] font-semibold">Impostazioni viaggio</span>
            <span className="text-xs text-[var(--color-text-secondary)]">›</span>
          </a>
        )}
        {isRealTrip && isOrganizer && (
          <div className="border-b border-[var(--color-cream-light)]">
            <button type="button" className="flex w-full items-center gap-2.5 px-3.5 py-3.25 text-left" onClick={() => setCrewOpen((v) => !v)}>
              <span className="text-base">👥</span>
              <span className="flex-1 text-[13px] font-semibold">Gestisci la crew</span>
              <span className="text-xs text-[var(--color-text-secondary)]">{crewOpen ? '⌃' : '›'}</span>
            </button>
            {crewOpen && (
              <div className="px-3.5 pb-3.5 pl-10">
                <div className="mb-2.5 text-[11px] font-semibold leading-snug text-[var(--color-text-secondary)]">
                  Chi rimuovi non fa più parte dei partecipanti attivi, ma le sue spese e i suoi conti in sospeso restano.
                </div>
                <div className="flex flex-col gap-1.5">
                  {membriAttivi(crew)
                    .filter((m) => m.id !== myMemberId)
                    .map((m) => (
                      <div key={m.id}>
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: m.color }}>
                            {(m.name || '?').slice(0, 1).toUpperCase()}
                          </div>
                          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{m.name}</span>
                          <button
                            type="button"
                            className="shrink-0 text-[11.5px] font-bold text-[var(--color-coral-text)]"
                            onClick={() => setRemovingId(removingId === m.id ? null : m.id)}
                          >
                            {removingId === m.id ? 'Annulla' : 'Rimuovi'}
                          </button>
                        </div>
                        {removingId === m.id && (
                          <button
                            type="button"
                            disabled={removingBusy}
                            className="mt-1.5 w-full rounded-full bg-[var(--color-coral)] py-2 text-center text-[11.5px] font-bold text-white disabled:opacity-60"
                            onClick={() => confermaRimozione(m.id)}
                          >
                            {removingBusy ? 'Rimuovo...' : `Sì, rimuovi ${m.name}`}
                          </button>
                        )}
                      </div>
                    ))}
                  {membriAttivi(crew).filter((m) => m.id !== myMemberId).length === 0 && (
                    <div className="text-[11.5px] font-semibold text-[var(--color-text-secondary)]">Per ora sei l’unico nella crew.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        <div>
          <button type="button" className="flex w-full items-center gap-2.5 px-3.5 py-3.25 text-left" onClick={() => setLeaveConfirmOpen((v) => !v)}>
            <span className="text-base">🚪</span>
            <span className="flex-1 text-[13px] font-bold text-[var(--color-coral-text)]">Esci dal viaggio</span>
            <span className="text-xs text-[var(--color-text-secondary)]">{leaveConfirmOpen ? '⌃' : '›'}</span>
          </button>
          {leaveConfirmOpen && (
            <div className="px-3.5 pb-4 pl-10">
              {isOrganizer ? (
                // Se uscisse chi ha creato il viaggio, nessuno potrebbe piu'
                // generare inviti, modificarlo o eliminarlo. Il passaggio di
                // consegne e' un pezzo di prodotto che non c'e' ancora: meglio
                // una porta chiusa e spiegata che un viaggio orfano.
                <div className="text-xs font-semibold leading-snug text-[var(--color-text-secondary)]">
                  Sei tu che tieni in piedi {tripName}: se uscissi, nessuno potrebbe più invitare, modificare o eliminare il viaggio.
                  Puoi rimuovere qualcuno dalla crew qui sopra, oppure eliminare il viaggio dalle impostazioni.
                </div>
              ) : (
                <>
                  <div className="mb-2.5 text-xs font-semibold leading-snug text-[var(--color-text-secondary)]">
                    Sei sicuro? Non farai più parte dei partecipanti attivi a {tripName}. Le spese che hai registrato restano, e i conti aperti vanno chiusi comunque.
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="flex-1 rounded-full bg-[#f0e5d1] py-2.25 text-center text-xs font-bold text-[var(--color-text)]" onClick={() => setLeaveConfirmOpen(false)}>Annulla</button>
                    <button type="button" disabled={leaving} className="flex-1 rounded-full bg-[var(--color-coral)] py-2.25 text-center text-xs font-bold text-white disabled:opacity-60" onClick={confermaUscita}>
                      {leaving ? 'Esco...' : 'Sì, esci'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
