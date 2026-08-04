import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AccountSheet } from '../components/AccountSheet'
import { Avatar } from '../components/Avatar'
import { ColorPickerSheet, UploadMenuSheet } from '../components/CoverPickerSheets'
import { inizialeAccount, nomeBreve } from '../lib/accountIdentity'
import { useAuth } from '../lib/authContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import {
  coverGradientById,
  loadStoredColors,
  saveStoredColorFor,
  slugify,
  type CoverColorId,
} from '../lib/palette'
import { updateTripCover } from './journey/supabaseJourney'

type JourneyStatus = 'live' | 'planned' | 'completed' | 'demo'

interface JourneyDef {
  id: string
  name: string
  sub: string
  status: JourneyStatus
  href: string
  photo?: string
  coverColorId?: CoverColorId
  isReal: boolean
}

// Il viaggio dimostrativo resta come riferimento/test, ma non è un viaggio
// reale: non ha una riga su Supabase, va rimosso dai flussi che ci provano.
const DEMO_JOURNEY: JourneyDef = {
  id: 'spain',
  name: 'Spain Roadtrip',
  sub: '14 → 26 agosto · 5 Crew',
  status: 'demo',
  href: '/trip/spain/journey',
  isReal: false,
}

const statusMeta: Record<JourneyStatus, string> = {
  live: '🟢 Live',
  planned: '📅 Planned',
  completed: '✅ Completed',
  demo: '🧪 Demo',
}

// Stato derivato dalle date: vissuto, in corso, o ancora da vivere/in creazione.
function tripStatus(startDate: string | null, endDate: string | null): JourneyStatus {
  if (!startDate || !endDate) return 'planned'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (today > end) return 'completed'
  if (today >= start && today <= end) return 'live'
  return 'planned'
}

function formatTripRange(startDate: string | null, endDate: string | null): string {
  if (!startDate || !endDate) return 'Date da definire'
  const start = new Date(startDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
  const end = new Date(endDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
  return `${start} → ${end}`
}

const statusOrder: Record<JourneyStatus, number> = { live: 0, planned: 1, completed: 2, demo: 3 }

export function Home() {
  const { session, loading: authLoading, signOut } = useAuth()
  const { showError } = useToast()
  const isLoggedIn = !!session?.user
  // Il nome vero dell'account, non il pezzo di indirizzo prima della chiocciola.
  const userName = nomeBreve(session?.user)

  const [journeyColors, setJourneyColors] = useState<Record<string, CoverColorId>>({
    spain: 'fiesta',
  })
  const [customPhotos, setCustomPhotos] = useState<Record<string, string>>({})
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false)
  const [demoDismissed, setDemoDismissed] = useState(() => {
    try {
      return localStorage.getItem('pina-demo-dismissed') === '1'
    } catch {
      return false
    }
  })
  const [realTrips, setRealTrips] = useState<JourneyDef[]>([])
  const [loadingTrips, setLoadingTrips] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  function dismissDemo() {
    setDemoDismissed(true)
    try {
      localStorage.setItem('pina-demo-dismissed', '1')
    } catch {
      // localStorage non disponibile: la card demo ricomparirà al prossimo giro, non è grave.
    }
  }

  // Colore del viaggio demo (unico che vive ancora in localStorage).
  useEffect(() => {
    const stored = loadStoredColors()
    const slug = slugify(DEMO_JOURNEY.name)
    if (stored[slug]) setJourneyColors((prev) => ({ ...prev, [DEMO_JOURNEY.id]: stored[slug] as CoverColorId }))
  }, [])

  // I viaggi veri: quelli in cui l'utente ha una riga trip_members (li ha
  // creati come organizzatore, o vi è stato aggiunto ed è entrato davvero) —
  // vissuti, in corso o ancora da vivere, tutti insieme, ordinati per stato.
  useEffect(() => {
    if (!session?.user) {
      setRealTrips([])
      return
    }
    let cancelled = false
    setLoadingTrips(true)
    supabase
      .from('trip_members')
      .select('trip_id')
      .eq('user_id', session.user.id)
      .then(async ({ data: memberships }) => {
        const tripIds = Array.from(new Set((memberships || []).map((m) => m.trip_id)))
        if (!tripIds.length) {
          if (!cancelled) {
            setRealTrips([])
            setLoadingTrips(false)
          }
          return
        }
        const [{ data: trips }, { data: allMembers }] = await Promise.all([
          supabase.from('trips').select('*').in('id', tripIds),
          // Tutta la crew, non solo chi si e' unito dall'app: il conteggio deve
          // corrispondere alle persone che si vedono in Spese/Checklist. Chi ha
          // lasciato il viaggio pero' non e' piu' un partecipante: resta nella
          // storia delle spese, non in "· 5 Crew".
          supabase.from('trip_members').select('trip_id').in('trip_id', tripIds).is('left_at', null),
        ])
        if (cancelled) return

        const crewCounts: Record<string, number> = {}
        ;(allMembers || []).forEach((m) => {
          crewCounts[m.trip_id] = (crewCounts[m.trip_id] || 0) + 1
        })

        const defs: JourneyDef[] = (trips || [])
          .map((t) => ({
            id: t.id,
            name: t.name,
            sub: `${formatTripRange(t.start_date, t.end_date)} · ${crewCounts[t.id] || 1} Crew`,
            status: tripStatus(t.start_date, t.end_date),
            href: `/trip/${t.id}/journey`,
            photo: t.cover_photo_url ?? undefined,
            coverColorId: (t.cover_color_id as CoverColorId) || 'fiesta',
            isReal: true,
          }))
          .sort((a, b) => statusOrder[a.status] - statusOrder[b.status])

        setJourneyColors((prev) => {
          const merged = { ...prev }
          defs.forEach((d) => {
            if (d.coverColorId) merged[d.id] = d.coverColorId
          })
          return merged
        })
        setRealTrips(defs)
        setLoadingTrips(false)
      })
    return () => {
      cancelled = true
    }
  }, [session])

  const visibleJourneys = demoDismissed ? realTrips : [...realTrips, DEMO_JOURNEY]
  const hasJourneys = visibleJourneys.length > 0

  function selectColor(id: CoverColorId) {
    if (!pickerFor) return
    setJourneyColors((prev) => ({ ...prev, [pickerFor]: id }))
    if (pickerFor === DEMO_JOURNEY.id) {
      saveStoredColorFor(DEMO_JOURNEY.name, id)
    } else {
      updateTripCover(pickerFor, { coverColorId: id }).catch((err) => showError('Non siamo riusciti a salvare la copertina.', err))
    }
    setPickerFor(null)
  }

  function onCoverFileChosen(file: File) {
    if (!pickerFor) return
    const target = pickerFor
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setCustomPhotos((prev) => ({ ...prev, [target]: dataUrl }))
      setUploadMenuOpen(false)
      setPickerFor(null)
      if (target !== DEMO_JOURNEY.id) {
        updateTripCover(target, { coverPhotoUrl: dataUrl }).catch((err) => showError('Non siamo riusciti a salvare la copertina.', err))
      }
    }
    reader.readAsDataURL(file)
  }

  if (authLoading) {
    return (
      <div className="mx-auto flex min-h-svh max-w-md items-center justify-center bg-[var(--color-cream)]">
        <div className="text-sm font-semibold text-[var(--color-text-secondary)]">Caricamento...</div>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-svh max-w-md bg-[var(--color-cream)] px-4.5 pb-10 pt-8 text-[var(--color-text)]">
      <div className="mb-4.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-display text-[19px] font-semibold italic text-[var(--color-coral)]">
          🦩 Piña
        </div>
        {/*
          Il tondo dice chi sei su questo telefono, e apre il livello ACCOUNT.
          Prima era un fenicottero uguale per chiunque, e portava al profilo del
          PRIMO viaggio della lista — uno a caso, non quello che stavi guardando.
          Il profilo di un viaggio si raggiunge da dentro quel viaggio.
        */}
        {isLoggedIn && session?.user && (
          <button
            type="button"
            aria-label="Il tuo account"
            className="rounded-full"
            onClick={() => setAccountOpen(true)}
          >
            <Avatar personId={session.user.id} initial={inizialeAccount(session.user)} size={32} />
          </button>
        )}
      </div>

      <div className="mb-0.5 font-display text-2xl font-semibold">{isLoggedIn ? `Ciao, ${userName}` : 'Benvenuto su Piña'}</div>
      <div className="mb-5.5 text-xs font-semibold text-[var(--color-text-secondary)]">Le tue avventure</div>

      {loadingTrips ? (
        <div className="py-10 text-center text-sm font-semibold text-[var(--color-text-secondary)]">Caricamento viaggi...</div>
      ) : hasJourneys ? (
        <>
          <div className="flex flex-col gap-3">
            {visibleJourneys.map((j) => {
              const customPhoto = customPhotos[j.id]
              const hasPhoto = !!j.photo || !!customPhoto
              const photo = customPhoto || j.photo
              const gradient = hasPhoto
                ? 'linear-gradient(135deg,#7a9d54,#4f8f4f)'
                : coverGradientById[journeyColors[j.id]] || coverGradientById.fiesta

              return (
                <div
                  key={j.id}
                  className="relative h-28 overflow-hidden rounded-[22px] shadow-[0_10px_22px_-14px_rgba(120,90,40,.3)]"
                >
                  <Link to={j.href} className="absolute inset-0 block">
                    <div className="absolute inset-0" style={{ background: gradient }} />
                    {hasPhoto && photo && (
                      <div
                        className="absolute inset-0 bg-cover bg-center opacity-55"
                        style={{ backgroundImage: `url(${photo})` }}
                      />
                    )}
                    <div className="relative z-10 flex h-full flex-col justify-between px-4 py-3.5 text-white">
                      <div className="flex items-start justify-between">
                        <div className="font-display text-[19px] font-bold leading-tight">{j.name}</div>
                        <span className="shrink-0 rounded-full bg-black/28 px-2.5 py-1 text-[10.5px] font-bold">
                          {statusMeta[j.status]}
                        </span>
                      </div>
                      <div className="text-[11.5px] font-semibold text-white/85">{j.sub}</div>
                    </div>
                  </Link>
                  {!hasPhoto && (
                    <button
                      type="button"
                      className="absolute bottom-2.5 right-2.5 z-20 flex h-6.5 w-6.5 items-center justify-center rounded-full bg-black/28 text-[13px] text-white"
                      onClick={() => setPickerFor(j.id)}
                    >
                      🎨
                    </button>
                  )}
                  {j.status === 'demo' && (
                    <button
                      type="button"
                      aria-label="Rimuovi il viaggio demo"
                      className="absolute right-2.5 top-2.5 z-20 flex h-5.5 w-5.5 items-center justify-center rounded-full bg-black/28 text-[11px] text-white"
                      onClick={() => dismissDemo()}
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <Link
            to="/guida"
            className="mt-3.5 flex items-center gap-3 rounded-[18px] bg-[#1e2a4a] px-4 py-3.5 text-white shadow-[0_10px_22px_-14px_rgba(30,42,74,.5)]"
          >
            <span className="shrink-0 text-xl">🧭</span>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 font-display text-[14.5px] font-semibold leading-tight">
                La tua guida a Piña
              </div>
              <div className="text-[11px] font-semibold text-white/65">
                Scopri come viaggiare insieme con Piña
              </div>
            </div>
            <span className="shrink-0 text-base text-white/50">›</span>
          </Link>

          <Link
            to="/onboarding?step=createTrip"
            className="mt-3.5 block rounded-full border-[1.5px] border-dashed border-[var(--color-add-border)] py-3.5 text-center text-[13px] font-bold text-[var(--color-add-text)]"
          >
            + Crea viaggio
          </Link>

          <Link
            to="/onboarding?step=joinCode"
            className="mt-2.5 block text-center text-[12.5px] font-bold text-[var(--color-coral)]"
          >
            Hai un codice? Unisciti a un viaggio
          </Link>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <Link
            to="/onboarding?step=createTrip"
            className="block rounded-[22px] px-5 py-5.5 text-white shadow-[0_14px_28px_-16px_rgba(255,150,60,.45)]"
            style={{ background: 'linear-gradient(135deg,#ffb627,#ff8a5b)' }}
          >
            <div className="mb-2 text-2xl">🦩</div>
            <div className="mb-1 font-display text-[17px] font-bold">Un nuovo viaggio nel cassetto?</div>
            <div className="text-xs font-semibold text-white/90">Tira fuori Piña.</div>
          </Link>
          <Link
            to="/onboarding?step=createTrip"
            className="block rounded-[22px] px-5 py-5.5 text-white shadow-[0_14px_28px_-16px_rgba(50,140,170,.4)]"
            style={{ background: 'linear-gradient(135deg,#2fbfae,#2a8fd8)' }}
          >
            <div className="mb-2 text-2xl">🗺</div>
            <div className="mb-1 font-display text-[17px] font-bold">Disegna la mappa, invita chi vuoi.</div>
            <div className="text-xs font-semibold text-white/90">Parti con Piña.</div>
          </Link>
          <Link
            to="/onboarding?step=createTrip"
            className="block rounded-[22px] px-5 py-5.5 text-white shadow-[0_14px_28px_-16px_rgba(80,120,60,.4)]"
            style={{ background: 'linear-gradient(135deg,#7a9d54,#4f8f4f)' }}
          >
            <div className="mb-2 text-2xl">🌅</div>
            <div className="mb-1 font-display text-[17px] font-bold">Pronti a esplorare?</div>
            <div className="text-xs font-semibold text-white/90">La tua nuova avventura inizia da qui.</div>
          </Link>

          <Link
            to="/onboarding?step=joinCode"
            className="block text-center text-[12.5px] font-bold text-[var(--color-coral)]"
          >
            Hai un codice? Unisciti a un viaggio
          </Link>
        </div>
      )}

      {!isLoggedIn && (
        <Link
          to="/onboarding?step=login&intent=access"
          className="mt-6 block rounded-full border border-[var(--color-card-border)] bg-white py-3.5 text-center text-[13px] font-bold text-[var(--color-text)]"
        >
          Hai già un account? Accedi
        </Link>
      )}

      {accountOpen && session?.user && (
        <AccountSheet user={session.user} onSignOut={signOut} onClose={() => setAccountOpen(false)} />
      )}

      {pickerFor && !uploadMenuOpen && (
        <ColorPickerSheet
          selectedId={journeyColors[pickerFor]}
          onSelect={selectColor}
          onOpenUpload={() => setUploadMenuOpen(true)}
          onClose={() => setPickerFor(null)}
        />
      )}

      {uploadMenuOpen && pickerFor && (
        <UploadMenuSheet
          onPickCamera={onCoverFileChosen}
          onPickLibrary={onCoverFileChosen}
          onPickFile={onCoverFileChosen}
          onClose={() => setUploadMenuOpen(false)}
        />
      )}
    </div>
  )
}
