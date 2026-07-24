import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BottomSheet } from '../components/BottomSheet'
import { EditableText } from '../components/EditableText'
import { useAuth } from '../lib/authContext'
import { supabase } from '../lib/supabase'
import {
  coverGradientById,
  coverPaletteDefs,
  identityColorDefs,
  inviteCode as computeInviteCode,
  moodGradients,
  saveStoredColorFor,
  slugify,
  vibeDefs,
} from '../lib/palette'
import {
  allMoodDefs,
  buildMonthDefs,
  initialOnboardingState,
  isoDate,
  moodLabelFor,
  preparingPhrases,
  type OnboardingState,
  type OnboardingStep,
} from './onboarding/state'

const WEEKDAY_LABELS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

const backBtnClass =
  'flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full border border-[var(--color-card-border)] bg-white text-[17px] text-[var(--color-text)]'

const primaryBtnClass =
  'block w-full rounded-full py-3.5 text-center text-[13.5px] font-bold text-white'
const primaryBtnStyle = { background: 'linear-gradient(135deg,#ff8a5b,#ff5f6d)' }

const secondaryBtnClass =
  'block w-full rounded-full border border-[var(--color-card-border)] bg-[var(--color-bg)] py-3 text-center text-[13.5px] font-bold text-[var(--color-text)]'

export function Onboarding() {
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const monthDefs = useMemo(buildMonthDefs, [])
  const { session } = useAuth()

  const [state, setState] = useState<OnboardingState>(() => initialOnboardingState(search))
  const patch = (p: Partial<OnboardingState> | ((s: OnboardingState) => Partial<OnboardingState>)) =>
    setState((s) => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }))

  const [authEmail, setAuthEmail] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [authStatus, setAuthStatus] = useState<'idle' | 'sending' | 'verifying' | 'error'>('idle')
  const [authError, setAuthError] = useState<string | null>(null)

  // Una volta autenticati, prosegui automaticamente.
  useEffect(() => {
    if (session && state.step === 'login') {
      if (state.loginIntent === 'access') navigate('/')
      else goStep('createTrip')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  // Suggerisce un nome di partenza per l'organizzatore (dal prefisso della mail),
  // ma resta modificabile: la lasciamo vuota finché non sappiamo chi è.
  useEffect(() => {
    if (session?.user?.email && !state.identityName) {
      const guess = session.user.email.split('@')[0]
      patch({ identityName: guess.charAt(0).toUpperCase() + guess.slice(1) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  async function sendAuthCode() {
    if (!authEmail || !authEmail.includes('@')) {
      setAuthError('Inserisci un indirizzo email valido.')
      setAuthStatus('error')
      return
    }
    setAuthStatus('sending')
    setAuthError(null)
    const { error } = await supabase.auth.signInWithOtp({ email: authEmail })
    if (error) {
      setAuthError(error.message)
      setAuthStatus('error')
    } else {
      setCodeSent(true)
      setAuthStatus('idle')
    }
  }

  async function verifyAuthCode() {
    if (!authCode || authCode.trim().length < 4) {
      setAuthError('Inserisci il codice ricevuto via email.')
      setAuthStatus('error')
      return
    }
    setAuthStatus('verifying')
    setAuthError(null)
    const { error } = await supabase.auth.verifyOtp({ email: authEmail, token: authCode.trim(), type: 'email' })
    if (error) {
      setAuthError(error.message)
      setAuthStatus('error')
    }
    // in caso di successo, onAuthStateChange aggiorna la sessione e l'effect sopra avanza da solo
  }

  // Una volta creato davvero su Supabase, l'id reale del viaggio (usato per il routing
  // al posto dello slug locale, che serve solo come fallback per il viaggio demo).
  const [realTripId, setRealTripId] = useState<string | null>(null)
  const [createTripError, setCreateTripError] = useState<string | null>(null)
  const [creatingTrip, setCreatingTrip] = useState(false)

  async function createTripInSupabase(): Promise<string | null> {
    if (!session?.user) {
      setCreateTripError('Devi accedere per creare un viaggio.')
      return null
    }
    if (!state.tripName || !state.startDay) {
      setCreateTripError('Inserisci almeno il nome e la data del viaggio.')
      return null
    }
    setCreatingTrip(true)
    setCreateTripError(null)

    const activeMonth = monthDefs[state.monthIndex] ?? monthDefs[1]
    const startDateStr = isoDate(activeMonth.year, activeMonth.month, state.startDay)
    const endDateStr = isoDate(activeMonth.year, activeMonth.month, state.endDay || state.startDay)
    const organizerName = state.identityName.trim() || (session.user.email ? session.user.email.split('@')[0] : 'Organizzatore')

    // Viaggio + membership organizzatore (+ partecipanti) creati insieme, in
    // un'unica funzione lato database (vedi 0002_create_trip_with_members.sql):
    // creandoli con due insert separati dal client, nell'istante fra i due
    // l'organizzatore non è ancora membro del viaggio appena creato, e la RLS
    // rifiuta la richiesta come se la policy fosse sbagliata.
    const { data: trip, error: tripError } = await supabase.rpc('create_trip_with_members', {
      p_name: state.tripName,
      p_start_date: startDateStr,
      p_end_date: endDateStr,
      p_cover_color_id: state.coverColorId,
      p_organizer_display_name: organizerName,
      p_participant_names: state.participants,
    })

    if (tripError || !trip) {
      setCreateTripError(tripError?.message || 'Errore durante la creazione del viaggio.')
      setCreatingTrip(false)
      return null
    }

    setRealTripId(trip.id)
    setCreatingTrip(false)
    return trip.id
  }

  const tripNameRef = useRef<HTMLDivElement>(null)
  const newMoodRef = useRef<HTMLDivElement>(null)
  const newParticipantRef = useRef<HTMLDivElement>(null)
  const joinLinkRef = useRef<HTMLDivElement>(null)
  const joinCodeRef = useRef<HTMLDivElement>(null)
  const cameraFileRef = useRef<HTMLInputElement>(null)
  const libraryFileRef = useRef<HTMLInputElement>(null)
  const fileFileRef = useRef<HTMLInputElement>(null)
  const prepIntervalRef = useRef<number | undefined>(undefined)

  // auto-advance splash -> welcome
  useEffect(() => {
    const t = setTimeout(() => {
      setState((s) => (s.step === 'splash' ? { ...s, step: 'welcome' } : s))
    }, 1800)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => () => window.clearInterval(prepIntervalRef.current), [])

  const goStep = (step: OnboardingStep) => patch({ step })
  const tripId = () => realTripId || slugify(state.tripName) || 'demo'

  const activeMonth = monthDefs[state.monthIndex] ?? monthDefs[1]
  const tripDates =
    state.startDay && state.endDay
      ? `${state.startDay} → ${state.endDay} ${activeMonth.short}`
      : state.startDay
        ? `${state.startDay} ${activeMonth.short} → ?`
        : 'Scegli le date'

  const primaryMood = state.moodIds[0] || 'fiesta'
  const coverGradient =
    coverGradientById[state.coverColorId] || moodGradients[primaryMood] || moodGradients.fiesta

  const crewTotal = (state.crew ? state.crew.length : state.participants.length) + 1
  const joinedCount = state.crew ? state.crew.filter((c) => c.status === 'joined').length + 1 : 1
  const allJoined = !!state.crew && state.crew.length > 0 && state.crew.every((c) => c.status === 'joined')

  function selectDay(day: number) {
    patch((s) => {
      if (s.startDay && s.endDay) return { startDay: day, endDay: null }
      if (s.startDay && !s.endDay) {
        return day >= s.startDay ? { endDay: day } : { startDay: day, endDay: null }
      }
      return { startDay: day, endDay: null }
    })
  }

  function toggleMood(id: string) {
    patch((s) => ({
      moodIds: s.moodIds.includes(id) ? s.moodIds.filter((m) => m !== id) : [...s.moodIds, id],
    }))
  }

  function addCustomMood() {
    const el = newMoodRef.current
    let text = el ? el.textContent?.trim() ?? '' : ''
    if (text === '😍 emoji + nome del mood') text = ''
    if (!text) {
      patch({ addingMood: false })
      return
    }
    const id = 'custom' + Date.now()
    patch((s) => ({ customMoods: [...s.customMoods, { id, label: text }], moodIds: [...s.moodIds, id], addingMood: false }))
  }

  function removeCustomMood(id: string) {
    patch((s) => ({ customMoods: s.customMoods.filter((m) => m.id !== id), moodIds: s.moodIds.filter((m) => m !== id) }))
  }

  function addParticipant() {
    const el = newParticipantRef.current
    const name = el ? el.textContent?.trim() ?? '' : ''
    if (name) {
      patch((s) => ({ participants: [...s.participants, name] }))
      if (el) el.textContent = ''
    }
  }

  function goPreparing() {
    patch({ step: 'preparing', preparingIndex: 0 })
    let i = 0
    prepIntervalRef.current = window.setInterval(() => {
      i++
      if (i >= preparingPhrases.length) {
        window.clearInterval(prepIntervalRef.current)
        patch({ step: 'cover' })
      } else {
        patch({ preparingIndex: i })
      }
    }, 550)
  }

  async function saveCreateTrip() {
    if (state.editReturnStep) {
      patch((s) => ({ step: s.editReturnStep as OnboardingStep, editReturnStep: null }))
      return
    }
    const id = await createTripInSupabase()
    if (id) goPreparing()
  }

  function buildCrew() {
    patch((s) => ({ crew: s.participants.map((name) => ({ name, status: 'pending' as const })) }))
  }

  function goCrewForming() {
    if (!state.crew) buildCrew()
    patch({ step: 'crewForming' })
  }

  function onCoverFileChosen(file: File) {
    const reader = new FileReader()
    reader.onload = () =>
      patch({ coverPhoto: reader.result as string, uploadMenuOpen: false, coverPickerOpen: false })
    reader.readAsDataURL(file)
  }

  function copyLink() {
    const url = `https://pina.app/join/${slugify(state.tripName)}`
    navigator.clipboard?.writeText(url).catch(() => {})
    patch({ linkCopied: true })
    setTimeout(() => patch({ linkCopied: false }), 1600)
  }

  function copyCode() {
    navigator.clipboard?.writeText(computeInviteCode(slugify(state.tripName))).catch(() => {})
    patch({ codeCopied: true })
    setTimeout(() => patch({ codeCopied: false }), 1600)
  }

  function confirmJoinLink() {
    const text = joinLinkRef.current?.textContent?.trim() ?? ''
    if (!text || text === 'https://pina.app/join/...' || !text.includes('pina.app/join/')) {
      patch({ joinError: "Problemi di accesso: link non valido o incompleto. Controlla di averlo copiato per intero o contatta l'assistenza." })
      return
    }
    patch({ joinError: null, step: 'join' })
  }

  function confirmJoinCode() {
    const text = joinCodeRef.current?.textContent?.trim() ?? ''
    if (!text || text === 'PINA-XXXXX' || !/^PINA-[A-Z0-9]{4,6}$/i.test(text)) {
      patch({ joinError: 'Problemi di accesso: il codice non è valido. Verifica con chi te lo ha condiviso o contatta l\'assistenza.' })
      return
    }
    patch({ joinError: null, step: 'join' })
  }

  // ---------- shared bits ----------
  const coverSheets = (
    <>
      {state.coverPickerOpen && !state.uploadMenuOpen && (
        <BottomSheet onClose={() => patch({ coverPickerOpen: false })}>
          <div className="mb-4 font-display text-[17px] font-bold text-[var(--color-text)]">Scegli un colore</div>
          <div className="grid grid-cols-5 gap-3">
            {coverPaletteDefs.map((p) => (
              <button
                key={p.id}
                type="button"
                className="aspect-square w-full rounded-full"
                style={{
                  background: p.gradient,
                  boxShadow: state.coverColorId === p.id ? '0 0 0 3px var(--color-bg), 0 0 0 5px #3a2a1c' : undefined,
                }}
                onClick={() => {
                  patch({ coverColorId: p.id, coverPickerOpen: false, coverPhoto: null })
                  saveStoredColorFor(state.tripName, p.id)
                }}
              />
            ))}
            <button
              type="button"
              className="aspect-square w-full rounded-full border-[1.5px] border-dashed border-[var(--color-add-border)] bg-white text-lg font-bold text-[var(--color-add-text)]"
              onClick={() => patch({ uploadMenuOpen: true })}
            >
              +
            </button>
          </div>
        </BottomSheet>
      )}

      {state.uploadMenuOpen && (
        <BottomSheet zIndex={41} onClose={() => patch({ uploadMenuOpen: false })}>
          <div className="mb-3.5 font-display text-base font-bold text-[var(--color-text)]">Carica una copertina</div>
          <div className="flex flex-col gap-2">
            <button type="button" className="flex items-center gap-2.5 rounded-2xl border border-[var(--color-card-border)] bg-white px-3.5 py-3.5 text-left" onClick={() => cameraFileRef.current?.click()}>
              <span className="text-base">📷</span><span className="text-[13px] font-bold text-[var(--color-text)]">Scatta foto</span>
            </button>
            <button type="button" className="flex items-center gap-2.5 rounded-2xl border border-[var(--color-card-border)] bg-white px-3.5 py-3.5 text-left" onClick={() => libraryFileRef.current?.click()}>
              <span className="text-base">🖼</span><span className="text-[13px] font-bold text-[var(--color-text)]">Carica dalla libreria</span>
            </button>
            <button type="button" className="flex items-center gap-2.5 rounded-2xl border border-[var(--color-card-border)] bg-white px-3.5 py-3.5 text-left" onClick={() => fileFileRef.current?.click()}>
              <span className="text-base">📁</span><span className="text-[13px] font-bold text-[var(--color-text)]">Carica da file</span>
            </button>
          </div>
          <button type="button" className="mt-3.5 w-full text-center text-xs font-bold text-[var(--color-text-secondary)]" onClick={() => patch({ uploadMenuOpen: false })}>
            Annulla
          </button>
          <input ref={cameraFileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onCoverFileChosen(f); e.target.value = '' }} />
          <input ref={libraryFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onCoverFileChosen(f); e.target.value = '' }} />
          <input ref={fileFileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onCoverFileChosen(f); e.target.value = '' }} />
        </BottomSheet>
      )}

      {state.deleteConfirmOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-8">
          <div className="rounded-[22px] bg-white p-6 text-center shadow-[0_30px_60px_-20px_rgba(0,0,0,.5)]">
            <div className="mb-2.5 text-3xl">⚠️</div>
            <div className="mb-2 font-display text-[17px] font-bold text-[var(--color-text)]">
              Sei sicuro di voler eliminare {state.tripName}?
            </div>
            <div className="mb-5 text-xs font-semibold text-[var(--color-text-secondary)]">L'azione non si può annullare</div>
            <div className="flex gap-2.5">
              <button type="button" className={`flex-1 ${secondaryBtnClass}`} onClick={() => patch({ deleteConfirmOpen: false })}>Annulla</button>
              <button type="button" className="flex-1 rounded-full bg-[#c2445a] py-3 text-center text-xs font-bold text-white" onClick={() => { patch({ deleteConfirmOpen: false }); navigate('/') }}>Elimina</button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  // ---------- step renders ----------
  let body: React.ReactNode = null

  if (state.step === 'splash') {
    body = (
      <div
        className="flex h-full min-h-svh flex-col items-center justify-center gap-2.5"
        style={{ background: 'linear-gradient(135deg,#ffb627,#ff5f6d)' }}
        onClick={() => goStep('welcome')}
      >
        <div className="text-5xl">🦩</div>
        <div className="font-display text-3xl font-bold italic text-white">Piña</div>
        <div className="text-[13px] font-bold tracking-[.04em] text-white/90">Travel together</div>
      </div>
    )
  } else if (state.step === 'welcome') {
    body = (
      <div className="flex min-h-svh flex-col">
        <div
          className="relative h-[52svh] shrink-0"
          style={{
            background:
              'radial-gradient(rgba(255,255,255,.16) 1.5px, transparent 1.5px), linear-gradient(135deg,#ffb627,#ff5f6d)',
            backgroundSize: '16px 16px, 100% 100%',
          }}
        >
          <button type="button" className="absolute left-3.5 top-3.5 flex h-8.5 w-8.5 items-center justify-center rounded-full bg-white/85 text-[17px] text-[var(--color-text)]" onClick={() => navigate('/')}>‹</button>
          <div className="absolute bottom-3 left-3.5 flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl shadow-[0_8px_16px_-6px_rgba(0,0,0,.35)]">🦩</div>
        </div>
        <div className="flex flex-1 flex-col justify-between px-6 py-6">
          <div>
            <div className="mb-2.5 font-display text-2xl font-bold leading-tight text-[var(--color-text)]">
              Vivere viaggi indimenticabili, insieme.
            </div>
            <div className="text-[12.5px] font-semibold leading-relaxed text-[var(--color-text-secondary)]">
              Un unico spazio condiviso con la vostra crew: pianificazione, spese, ricordi.
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <button type="button" className={primaryBtnClass} style={primaryBtnStyle} onClick={() => patch({ step: 'login', loginIntent: 'create' })}>Crea un viaggio</button>
            <button type="button" className={secondaryBtnClass} onClick={() => goStep('joinCode')}>Unisciti a un viaggio</button>
            <button type="button" className="py-2 text-center text-xs font-bold text-[var(--color-coral)]" onClick={() => patch({ step: 'login', loginIntent: 'access' })}>I tuoi viaggi / Accedi</button>
          </div>
        </div>
      </div>
    )
  } else if (state.step === 'login') {
    const loginTitle = state.loginIntent === 'access' ? 'Accedi ai tuoi viaggi' : 'Inizia il tuo viaggio'
    const disabledCls = 'flex items-center justify-center gap-2 rounded-full border border-[var(--color-card-border)] bg-[var(--color-bg)] py-3 text-[13px] font-bold text-[var(--color-text-secondary)] opacity-50'
    const selectedCls = 'flex items-center justify-center gap-2 rounded-full border-[1.5px] border-[var(--color-text-strong)] bg-white py-3 text-[13px] font-bold text-[var(--color-text)]'
    body = (
      <div className="relative min-h-svh px-7 pb-10 pt-25">
        <button type="button" className={`${backBtnClass} absolute left-5.5 top-14.5`} onClick={() => goStep('welcome')}>‹</button>
        <div className="mb-2 text-center font-display text-xl font-semibold italic text-[var(--color-coral)]">🦩 Piña</div>
        <div className="mb-1 text-center font-display text-[19px] font-semibold text-[var(--color-text)]">{loginTitle}</div>
        <div className="mb-6 text-center text-[11px] font-semibold text-[var(--color-text-secondary)]">Per ora solo via email</div>
        <div className="flex flex-col gap-2.5">
          <button type="button" className={disabledCls} disabled><span>🔵</span> Continua con Google</button>
          <button type="button" className={disabledCls} disabled><span>🍎</span> Continua con Apple</button>
          <div className={selectedCls}>✉️ Continua con Email</div>

          {codeSent ? (
            <>
              <div className="text-center text-[11.5px] font-semibold text-[var(--color-text-secondary)]">
                Codice inviato a <strong>{authEmail}</strong>. Controlla anche lo spam.
              </div>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Codice"
                maxLength={10}
                value={authCode}
                onChange={(e) => { setAuthCode(e.target.value.replace(/\D/g, '')); setAuthError(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') verifyAuthCode() }}
                className="rounded-full border-[1.5px] border-[var(--color-card-border)] bg-white px-4 py-2.75 text-center font-display text-lg font-bold tracking-[.2em] text-[var(--color-text)] outline-none focus:border-[var(--color-mango)]"
              />
              {authStatus === 'error' && authError && (
                <div className="text-center text-[11.5px] font-semibold text-[#c2445a]">{authError}</div>
              )}
              <button
                type="button"
                className="shrink-0 whitespace-nowrap rounded-full bg-[var(--color-text-strong)] px-4.5 py-2.75 text-xs font-bold text-white disabled:opacity-60"
                disabled={authStatus === 'verifying'}
                onClick={verifyAuthCode}
              >
                {authStatus === 'verifying' ? 'Verifica...' : 'Conferma codice'}
              </button>
              <button type="button" className="py-1 text-center text-[11px] font-bold text-[var(--color-text-secondary)]" onClick={sendAuthCode}>
                Rimanda codice
              </button>
            </>
          ) : (
            <>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tuamail@esempio.com"
                value={authEmail}
                onChange={(e) => { setAuthEmail(e.target.value); setAuthStatus('idle'); setAuthError(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') sendAuthCode() }}
                className="rounded-full border-[1.5px] border-[var(--color-card-border)] bg-white px-4 py-2.75 text-[13px] font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-mango)]"
              />
              {authStatus === 'error' && authError && (
                <div className="text-center text-[11.5px] font-semibold text-[#c2445a]">{authError}</div>
              )}
              <button
                type="button"
                className="shrink-0 whitespace-nowrap rounded-full bg-[var(--color-text-strong)] px-4.5 py-2.75 text-xs font-bold text-white disabled:opacity-60"
                disabled={authStatus === 'sending'}
                onClick={sendAuthCode}
              >
                {authStatus === 'sending' ? 'Invio...' : 'Invia codice'}
              </button>
            </>
          )}
        </div>
      </div>
    )
  } else if (state.step === 'createTrip') {
    const moods = allMoodDefs(state.customMoods)
    const blanks = Array.from({ length: activeMonth.leadingBlanks }, (_, i) => <div key={`b${i}`} />)
    const days = Array.from({ length: activeMonth.days }, (_, i) => {
      const day = i + 1
      const inRange = state.startDay && state.endDay && day >= state.startDay && day <= state.endDay
      const isEdge = day === state.startDay || day === state.endDay
      return (
        <button
          key={day}
          type="button"
          className="rounded-lg py-1.5 text-center text-xs font-bold text-[var(--color-text)]"
          style={isEdge ? { background: '#d9481f', color: '#fff' } : inRange ? { background: '#fde3d0', color: '#b8703a' } : undefined}
          onClick={() => selectDay(day)}
        >
          {day}
        </button>
      )
    })

    body = (
      <div className="min-h-svh overflow-y-auto px-5.5 pb-8 pt-14.5">
        <div className="mb-5.5 flex items-center gap-2.5">
          <button type="button" className={backBtnClass} onClick={() => patch((s) => ({ step: s.editReturnStep || 'login', editReturnStep: null }))}>‹</button>
          <div className="font-display text-[19px] font-semibold text-[var(--color-text)]">
            {state.editReturnStep ? 'Modifica il viaggio' : 'Crea il tuo viaggio'}
          </div>
        </div>

        {!state.editReturnStep && (
          <>
            <div className="mb-2 font-display text-lg font-semibold text-[var(--color-text)]">Come ti chiami?</div>
            <EditableText
              key={`identity-${state.step}`}
              initialText={state.identityName || 'Il tuo nome'}
              className="mb-6.5 rounded-2xl border border-[var(--color-card-border)] bg-white px-4 py-3.5 font-display text-lg"
              style={{ color: state.identityName ? '#3a2a1c' : '#b39a78', fontWeight: state.identityName ? 700 : 600 }}
              onFocus={(e) => { if (!state.identityName) e.currentTarget.textContent = '' }}
              onBlurText={(text) => patch({ identityName: text })}
            />
          </>
        )}

        <EditableText
          key={`name-${state.step}`}
          ref={tripNameRef}
          initialText={state.tripName || 'Il nome del tuo viaggio...'}
          className="mb-6.5 rounded-2xl border border-[var(--color-card-border)] bg-white px-4 py-3.5 font-display text-2xl"
          style={{ color: state.tripName ? '#3a2a1c' : '#b39a78', fontWeight: state.tripName ? 700 : 600 }}
          onFocus={(e) => { if (!state.tripName) e.currentTarget.textContent = '' }}
          onBlurText={(text) => patch({ tripName: text })}
        />

        <div className="mb-3 font-display text-lg font-semibold text-[var(--color-text)]">Quando partiamo?</div>
        <div className="mb-6.5 rounded-2xl border border-[var(--color-card-border)] bg-white p-3.5 shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <button type="button" className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-[var(--color-bg)] text-[13px] text-[var(--color-text)]" onClick={() => patch((s) => ({ monthIndex: Math.max(0, s.monthIndex - 1), startDay: null, endDay: null }))}>‹</button>
            <span className="whitespace-nowrap text-xs font-bold text-[var(--color-text)]">{activeMonth.label}</span>
            <button type="button" className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-[var(--color-bg)] text-[13px] text-[var(--color-text)]" onClick={() => patch((s) => ({ monthIndex: Math.min(monthDefs.length - 1, s.monthIndex + 1), startDay: null, endDay: null }))}>›</button>
          </div>
          <div className="mb-2 whitespace-nowrap text-center text-[11px] font-bold text-[var(--color-coral)]">{tripDates}</div>
          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((wd, i) => (
              <div key={i} className="text-center text-[9.5px] font-bold text-[#c2a97e]">{wd}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">{blanks}{days}</div>
        </div>

        <div className="mb-1 font-display text-lg font-semibold text-[var(--color-text)]">Che tipo di viaggio sarà?</div>
        <div className="mb-3 text-[11.5px] font-semibold text-[var(--color-text-secondary)]">Scegline quante vuoi</div>
        <div className="mb-3 flex flex-wrap gap-2">
          {moods.map((m) => {
            const active = state.moodIds.includes(m.id)
            return (
              <button
                key={m.id}
                type="button"
                className="shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-bold"
                style={active ? { background: '#3a2a1c', color: '#fff' } : { background: '#fff', border: '1px solid var(--color-card-border)', color: '#3a2a1c' }}
                onClick={() => toggleMood(m.id)}
              >
                {m.label}
                {m.custom && (
                  <span className="ml-1.5 opacity-60" onClick={(e) => { e.stopPropagation(); removeCustomMood(m.id) }}>×</span>
                )}
              </button>
            )
          })}
          {!state.addingMood && (
            <button type="button" className="shrink-0 whitespace-nowrap rounded-full border-[1.5px] border-dashed border-[var(--color-add-border)] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[var(--color-add-text)]" onClick={() => patch({ addingMood: true })}>
              + Aggiungi
            </button>
          )}
        </div>
        {state.addingMood ? (
          <div className="mb-6.5 flex items-center gap-2">
            <EditableText
              ref={newMoodRef}
              initialText="😍 emoji + nome del mood"
              className="flex-1 rounded-full border-[1.5px] border-dashed border-[var(--color-add-border)] px-3.5 py-2 text-[12.5px] font-semibold italic text-[var(--color-text-secondary)]"
              onFocus={(e) => { if (e.currentTarget.textContent?.trim() === '😍 emoji + nome del mood') e.currentTarget.textContent = '' }}
              onEnter={addCustomMood}
            />
            <button type="button" className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-[var(--color-text-strong)] text-base text-white" onClick={addCustomMood}>+</button>
          </div>
        ) : (
          <div className="mb-3.5" />
        )}

        <div className="mb-1 font-display text-lg font-semibold text-[var(--color-text)]">Chi viene con te?</div>
        <div className="mb-3 text-[11.5px] font-semibold text-[var(--color-text-secondary)]">Aggiungi i nomi della tua crew</div>
        <div className="mb-2 flex flex-wrap gap-2">
          {state.participants.map((name, i) => (
            <div key={i} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--color-card-border)] bg-white py-1.75 pl-3 pr-1.75 text-[12.5px] font-bold text-[var(--color-text)]">
              {name}
              <button type="button" className="flex h-4 w-4 items-center justify-center rounded-full bg-[#f0e5d1] text-[11px] text-[var(--color-text-secondary)]" onClick={() => patch((s) => ({ participants: s.participants.filter((_, idx) => idx !== i) }))}>×</button>
            </div>
          ))}
        </div>
        <div className="mb-7 flex items-center gap-2">
          <EditableText
            ref={newParticipantRef}
            initialText=""
            className="flex-1 rounded-full border-[1.5px] border-dashed border-[var(--color-add-border)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--color-text)]"
            onEnter={addParticipant}
          />
          <button type="button" className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-[var(--color-text-strong)] text-base text-white" onClick={addParticipant}>+</button>
        </div>

        {state.editReturnStep && (
          <>
            <button type="button" className="mb-3.5 flex w-full items-center gap-3 rounded-2xl border border-[var(--color-card-border)] bg-white px-4 py-3.5 shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]" onClick={() => patch({ coverPickerOpen: true })}>
              <div className="h-8.5 w-8.5 shrink-0 rounded-full" style={{ background: state.coverPhoto ? undefined : coverGradientById[state.coverColorId] || coverGradientById.fiesta, backgroundImage: state.coverPhoto ? `url(${state.coverPhoto})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }} />
              <div className="flex-1 text-left text-[13.5px] font-bold text-[var(--color-text)]">Scegli la tua copertina</div>
              <span className="text-[15px] text-[#c2a97e]">›</span>
            </button>
            <button type="button" className="mb-2.5 w-full text-center text-[12.5px] font-bold text-[#c2445a]" onClick={() => patch({ deleteConfirmOpen: true })}>🗑 Elimina viaggio</button>
          </>
        )}

        {createTripError && (
          <div className="mb-2.5 text-center text-[12px] font-semibold text-[#c2445a]">{createTripError}</div>
        )}
        <button type="button" className={`${primaryBtnClass} disabled:opacity-60`} style={primaryBtnStyle} disabled={creatingTrip} onClick={saveCreateTrip}>
          {creatingTrip ? 'Creazione...' : state.editReturnStep ? 'Salva modifiche' : 'Crea il viaggio'}
        </button>

        {coverSheets}
      </div>
    )
  } else if (state.step === 'preparing') {
    body = (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4" style={{ background: coverGradient }}>
        <div className="text-[44px]">🦩</div>
        <div className="font-display text-base font-semibold text-white">{preparingPhrases[state.preparingIndex]}</div>
      </div>
    )
  } else if (state.step === 'cover') {
    const selectedMoodChips = state.moodIds.map((id) => moodLabelFor(id, state.customMoods)).filter(Boolean) as string[]
    body = (
      <div
        className="relative flex min-h-svh flex-col items-center justify-center overflow-y-auto p-8 text-center"
        style={{
          background:
            `radial-gradient(rgba(255,255,255,.14) 1.5px, transparent 1.5px), ${coverGradient}`,
          backgroundSize: '16px 16px, 100% 100%',
        }}
      >
        {state.recapMode && (
          <button type="button" className="absolute left-3.5 top-3.5 flex h-8.5 w-8.5 items-center justify-center rounded-full bg-white/85 text-[17px] text-[var(--color-text)]" onClick={() => navigate('/')}>‹</button>
        )}
        <div className="mb-4.5 text-[15px] font-bold uppercase tracking-[.06em] text-white/85">
          {state.recapMode ? 'Il tuo viaggio' : 'Il viaggio è pronto'}
        </div>
        <div className="mb-3.5 text-5xl">🦩</div>
        <div className="mb-2.5 font-display text-3xl font-bold leading-tight text-white">{state.tripName}</div>
        <div className="mb-3.5 text-[13.5px] font-bold text-white/92">{tripDates}</div>
        <div className="mb-5.5 flex flex-wrap justify-center gap-1.5">
          {selectedMoodChips.map((label, i) => (
            <span key={i} className="rounded-full border border-white/40 bg-white/22 px-2.75 py-1.25 text-[11.5px] font-bold text-white">{label}</span>
          ))}
        </div>
        <div className="mb-4.5 text-[12.5px] font-bold text-white/90">Crew {joinedCount}/{crewTotal}</div>

        {state.recapMode ? (
          <div className="flex w-full flex-col gap-2.5">
            <button type="button" className="w-full rounded-full bg-white py-3.5 text-center text-[13.5px] font-bold text-[var(--color-text)]" onClick={() => navigate(`/trip/${tripId()}/journey`)}>Vai al viaggio →</button>
            <div className="flex gap-2.5">
              <button type="button" className="flex-1 rounded-full border border-white/40 bg-white/18 py-3 text-center text-[12.5px] font-bold text-white" onClick={() => goStep('invite')}>Invita crew</button>
              <button type="button" className="flex-1 rounded-full border border-white/40 bg-white/18 py-3 text-center text-[12.5px] font-bold text-white" onClick={() => patch({ step: 'createTrip', editReturnStep: 'cover' })}>Impostazioni</button>
            </div>
          </div>
        ) : (
          <button type="button" className="mt-2 rounded-full bg-white px-7.5 py-3.5 text-[13.5px] font-bold text-[var(--color-text)]" onClick={() => goStep('invite')}>Condividi con la crew</button>
        )}
      </div>
    )
  } else if (state.step === 'invite') {
    body = (
      <div className="min-h-svh overflow-y-auto px-5.5 pb-8 pt-14.5">
        <div className="mb-1 font-display text-xl font-semibold text-[var(--color-text)]">Invita la crew</div>
        <div className="mb-5 text-xs font-semibold text-[var(--color-text-secondary)]">Tre modi per unirsi, stessa destinazione</div>

        <div className="mb-5.5 rounded-3xl p-5.5 text-white shadow-[0_18px_36px_-18px_rgba(255,110,70,.45)]" style={{ background: coverGradient }}>
          <div className="mb-2 text-2xl">🦩</div>
          <div className="font-display text-xl font-bold">{state.tripName}</div>
          <div className="mt-0.5 text-xs font-semibold text-white/85">{tripDates} · {crewTotal} Crew</div>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-card-border)] bg-white p-3.5 shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
            <span className="text-xl">🔗</span>
            <div className="flex-1"><div className="text-[13.5px] font-bold">Link di invito</div><div className="text-[11px] font-semibold text-[var(--color-text-secondary)]">Perfetto per WhatsApp o Telegram</div></div>
            <button type="button" className="rounded-full bg-[var(--color-bg)] px-3.5 py-2 text-[11.5px] font-bold text-[var(--color-text)]" onClick={copyLink}>{state.linkCopied ? 'Copiato ✓' : 'Copia'}</button>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-card-border)] bg-white p-3.5 shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
            <div className="h-10 w-10 shrink-0 rounded-[10px] border border-[var(--color-card-border)] bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(`https://pina.app/join/${slugify(state.tripName)}`)})` }} />
            <div className="flex-1"><div className="text-[13.5px] font-bold">Codice QR</div><div className="text-[11px] font-semibold text-[var(--color-text-secondary)]">Comodo quando siete già insieme</div></div>
            <button type="button" className="rounded-full bg-[var(--color-bg)] px-3.5 py-2 text-[11.5px] font-bold text-[var(--color-text)]" onClick={() => patch({ qrOpen: true })}>Mostra</button>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-card-border)] bg-white p-3.5 shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
            <span className="text-xl">🔑</span>
            <div className="flex-1"><div className="text-[13.5px] font-bold">Codice</div><div className="font-display text-sm font-semibold tracking-[.03em] text-[var(--color-coral)]">{computeInviteCode(slugify(state.tripName))}</div></div>
            <button type="button" className="rounded-full bg-[var(--color-bg)] px-3.5 py-2 text-[11.5px] font-bold text-[var(--color-text)]" onClick={copyCode}>{state.codeCopied ? 'Copiato ✓' : 'Copia'}</button>
          </div>
        </div>

        <button type="button" className="mt-6.5 w-full rounded-full py-3.25 text-center text-[13px] font-bold text-white" style={primaryBtnStyle} onClick={goCrewForming}>Continua</button>

        {state.qrOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-10" onClick={() => patch({ qrOpen: false })}>
            <div className="rounded-3xl bg-white p-6.5 text-center shadow-[0_30px_60px_-20px_rgba(0,0,0,.5)]">
              <div className="mb-3.5 h-45 w-45 rounded-xl bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(`https://pina.app/join/${slugify(state.tripName)}`)})` }} />
              <div className="font-display text-base font-bold text-[var(--color-text)]">{state.tripName}</div>
              <div className="text-[11.5px] font-semibold text-[var(--color-text-secondary)]">Inquadra per unirti</div>
            </div>
          </div>
        )}
      </div>
    )
  } else if (state.step === 'crewForming') {
    body = (
      <div className="min-h-svh overflow-y-auto px-5.5 pb-8 pt-14.5">
        <div className="mb-1 font-display text-xl font-semibold text-[var(--color-text)]">La crew si sta formando</div>
        <div className="mb-5.5 text-[12.5px] font-semibold text-[var(--color-text-secondary)]">{joinedCount} di {crewTotal} già a bordo · tocca per simulare l'arrivo</div>

        <div className="mb-5.5 flex flex-col gap-2">
          <div className="flex items-center gap-2.5 rounded-2xl border-[1.5px] border-[#ffb627] bg-white px-3.5 py-3 shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
            <span className="text-lg">✅</span>
            <span className="flex-1 text-[13.5px] font-bold text-[var(--color-text)]">{state.identityName}</span>
            <span className="text-[11px] font-bold text-[var(--color-coral)]">Tu · organizzatore</span>
          </div>
          {(state.crew ?? []).map((c, i) => (
            <div key={i} className="flex cursor-pointer items-center gap-2.5 rounded-2xl border border-[var(--color-card-border)] bg-white px-3.5 py-3 shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]" onClick={() => patch((s) => ({ crew: (s.crew ?? []).map((m, idx) => idx !== i ? m : { ...m, status: m.status === 'joined' ? 'pending' : 'joined' }) }))}>
              <span className="text-lg">{c.status === 'joined' ? '✅' : '⏳'}</span>
              <span className="flex-1 text-[13.5px] font-bold text-[var(--color-text)]">{c.name}</span>
              <span className="text-[11px] font-bold" style={{ color: c.status === 'joined' ? '#4f8f4f' : '#c2a97e' }}>{c.status === 'joined' ? 'A bordo' : 'In attesa'}</span>
              <button type="button" className="flex h-5 w-5 items-center justify-center rounded-full text-[15px] text-[#c2a97e]" onClick={(e) => { e.stopPropagation(); patch((s) => ({ crew: (s.crew ?? []).filter((_, idx) => idx !== i) })) }}>×</button>
            </div>
          ))}
        </div>

        <button type="button" className="mb-2.5 w-full rounded-full py-3.5 text-center text-[13.5px] font-bold text-white" style={primaryBtnStyle} onClick={() => goStep('ritual')}>Vai al tuo viaggio →</button>
        {!allJoined && (
          <div className="text-center text-[11.5px] font-semibold text-[var(--color-text-secondary)]">Puoi proseguire anche se qualcuno non si è ancora unito</div>
        )}
      </div>
    )
  } else if (state.step === 'ritual') {
    body = (
      <div className="flex min-h-svh flex-col items-center justify-center p-8.5 text-center" style={{ background: coverGradient }}>
        <div className="mb-4 text-[44px]">🦩</div>
        <div className="mb-2 text-[12.5px] font-bold uppercase tracking-[.05em] text-white/85">
          {allJoined ? 'La crew è al completo' : "Si parte con chi c'è già"}
        </div>
        <div className="mb-2.5 font-display text-[27px] font-bold leading-snug text-white">{state.tripName}<br />si parte tra 12 giorni</div>
        <button type="button" className="mt-6 rounded-full bg-white px-10 py-3.75 text-sm font-bold text-[var(--color-text)]" onClick={() => navigate(`/trip/${tripId()}/journey`)}>Let's go 👇</button>
      </div>
    )
  } else if (state.step === 'joinCode') {
    body = (
      <div className="min-h-svh overflow-y-auto px-5.5 pb-8 pt-14.5">
        <div className="mb-1.5 flex items-center gap-2.5">
          <button type="button" className={backBtnClass} onClick={() => goStep('welcome')}>‹</button>
          <div className="font-display text-[19px] font-semibold text-[var(--color-text)]">Unisciti a un viaggio</div>
        </div>
        <div className="mb-5.5 ml-11 text-xs font-semibold text-[var(--color-text-secondary)]">Tre modi per raggiungere la tua crew</div>

        {state.joinError && (
          <div className="mb-4.5 flex items-start gap-2.5 rounded-2xl border border-[#f0b8ab] bg-[#fdeceb] px-3.5 py-3">
            <span className="text-base">⚠️</span>
            <div className="flex-1 text-xs font-semibold leading-snug text-[#a3392a]">{state.joinError}</div>
            <button type="button" className="shrink-0 text-[13px] text-[#a3392a]" onClick={() => patch({ joinError: null })}>×</button>
          </div>
        )}

        <div className="mb-3.5 rounded-3xl border border-[var(--color-card-border)] bg-white p-4 shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
          <div className="mb-2.5 flex items-center gap-2"><span className="text-[17px]">🔗</span><span className="text-[13.5px] font-bold text-[var(--color-text)]">Hai un link di invito?</span></div>
          <EditableText ref={joinLinkRef} initialText="https://pina.app/join/..." className="mb-2.5 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-bg)] px-3.5 py-2.75 text-[12.5px] font-semibold text-[var(--color-text-secondary)]" onFocus={(e) => { if (e.currentTarget.textContent?.trim() === 'https://pina.app/join/...') { e.currentTarget.textContent = ''; e.currentTarget.style.color = '#3a2a1c' } }} />
          <button type="button" className="w-full rounded-full bg-[var(--color-text-strong)] py-2.75 text-center text-[12.5px] font-bold text-white" onClick={confirmJoinLink}>Conferma</button>
        </div>

        <div className="mb-3.5 rounded-3xl border border-[var(--color-card-border)] bg-white p-4 shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
          <div className="mb-2.5 flex items-center gap-2"><span className="text-[17px]">🔑</span><span className="text-[13.5px] font-bold text-[var(--color-text)]">Hai un codice dalla crew?</span></div>
          <EditableText ref={joinCodeRef} initialText="PINA-XXXXX" className="mb-2.5 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-bg)] px-3.5 py-2.75 text-center font-display text-base font-bold tracking-[.04em] text-[var(--color-text-secondary)]" onFocus={(e) => { if (e.currentTarget.textContent?.trim() === 'PINA-XXXXX') { e.currentTarget.textContent = ''; e.currentTarget.style.color = '#3a2a1c' } }} />
          <button type="button" className="w-full rounded-full bg-[var(--color-text-strong)] py-2.75 text-center text-[12.5px] font-bold text-white" onClick={confirmJoinCode}>Conferma</button>
        </div>

        <div className="rounded-3xl border border-[var(--color-card-border)] bg-white p-4 shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
          <div className="mb-2.5 flex items-center gap-2"><span className="text-[17px]">📷</span><span className="text-[13.5px] font-bold text-[var(--color-text)]">Inquadra il QR code</span></div>
          <div className="mb-2.5 text-[11.5px] font-semibold text-[var(--color-text-secondary)]">Comodo quando siete già insieme</div>
          <button type="button" className="w-full rounded-full border border-[var(--color-card-border)] bg-[var(--color-bg)] py-2.75 text-center text-[12.5px] font-bold text-[var(--color-text)]" onClick={() => patch({ cameraOpen: true, joinError: null })}>Apri fotocamera</button>
        </div>

        {state.cameraOpen && (
          <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-[#0c0805] p-7.5">
            <button type="button" className="absolute left-3.5 top-3.5 flex h-8.5 w-8.5 items-center justify-center rounded-full bg-white/15 text-[17px] text-white" onClick={() => patch({ cameraOpen: false })}>‹</button>
            <div className="relative mb-5.5 h-55 w-55 rounded-3xl border-[3px] border-white/70" />
            <div className="mb-6 text-[12.5px] font-semibold text-white/75">Inquadra il QR code del viaggio</div>
            <button type="button" className="rounded-full bg-white px-6.5 py-3 text-[12.5px] font-bold text-[var(--color-text)]" onClick={() => { patch({ cameraOpen: false }); goStep('join') }}>Simula scansione</button>
          </div>
        )}
      </div>
    )
  } else if (state.step === 'join') {
    body = (
      <div className="flex min-h-svh flex-col items-center overflow-y-auto px-6.5 pb-8 pt-14.5 text-center">
        <div className="mb-3.5 text-[34px]">🦩</div>
        <div className="mb-1.5 text-[12.5px] font-bold text-[var(--color-text-secondary)]">Sei stato invitato a</div>
        <div className="mb-2.5 font-display text-2xl font-bold text-[var(--color-text)]">{state.tripName || 'Spain Roadtrip'}</div>
        <div className="mb-5.5 text-[12.5px] font-semibold text-[var(--color-text-secondary)]">{tripDates}</div>

        <div className="mb-6.5 w-full rounded-3xl border border-[var(--color-card-border)] bg-white p-4 text-left shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
          <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Ti unirai a questa crew</div>
          {state.participants.map((name, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5"><span className="text-[15px]">✅</span><span className="text-[13px] font-bold text-[var(--color-text)]">{name}</span></div>
          ))}
          <div className="flex items-center gap-2 py-1.5"><span className="text-[15px]">🆕</span><span className="text-[13px] font-bold text-[var(--color-coral)]">Tu</span></div>
        </div>

        <button type="button" className="w-full rounded-full py-3.5 text-[13.5px] font-bold text-white" style={primaryBtnStyle} onClick={() => goStep('whoAreYou')}>Unisciti al viaggio</button>
      </div>
    )
  } else if (state.step === 'whoAreYou') {
    const activeColor = identityColorDefs.find((c) => c.id === state.identityColorId) ?? identityColorDefs[0]
    body = (
      <div className="min-h-svh overflow-y-auto px-5.5 pb-8 pt-14.5">
        <div className="mb-1 font-display text-xl font-semibold text-[var(--color-text)]">Scegli la tua identità di viaggio</div>
        <div className="mb-6 text-xs font-semibold text-[var(--color-text-secondary)]">Così la crew saprà sempre che sei tu</div>

        <div className="mb-5.5 flex flex-col items-center">
          <div className="mb-3 flex h-19 w-19 items-center justify-center rounded-full text-3xl shadow-[0_10px_20px_-8px_rgba(0,0,0,.25)]" style={{ background: activeColor.hex }}>{state.identityEmoji}</div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Come ti chiami</div>
          <EditableText
            key="identity-name"
            initialText={state.identityName}
            className="text-center font-display text-lg font-bold text-[var(--color-text)]"
            onBlurText={(text) => patch({ identityName: text || state.identityName })}
          />
        </div>

        <div className="mb-2 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Colore</div>
        <div className="mb-5.5 flex gap-2.5">
          {identityColorDefs.map((c) => (
            <button key={c.id} type="button" className="h-9.5 w-9.5 rounded-full" style={{ background: c.hex, boxShadow: state.identityColorId === c.id ? `0 0 0 3px var(--color-bg), 0 0 0 5px ${c.hex}` : undefined }} onClick={() => patch({ identityColorId: c.id })} />
          ))}
        </div>

        <div className="mb-2 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Qual è la tua vibe?</div>
        <div className="mb-7 flex flex-wrap gap-2">
          {vibeDefs.map((v) => (
            <button key={v.id} type="button" className="shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-bold" style={state.vibe === v.id ? { background: '#3a2a1c', color: '#fff' } : { background: '#fff', border: '1px solid var(--color-card-border)', color: '#3a2a1c' }} onClick={() => patch({ vibe: v.id, identityEmoji: v.emoji })}>
              {v.emoji} {v.label}
            </button>
          ))}
        </div>

        <button type="button" className={primaryBtnClass} style={primaryBtnStyle} onClick={() => goStep('enteredGuest')}>Entra nel viaggio</button>
      </div>
    )
  } else if (state.step === 'enteredGuest') {
    body = (
      <div className="flex min-h-svh flex-col items-center justify-center px-7.5 py-10 text-center">
        <div className="mb-6.5 inline-flex items-center gap-2 rounded-full border border-[#f0dfc0] bg-[#fffaf0] px-4 py-2.25 text-[12.5px] font-bold text-[#8a6a3e]">🦩 {state.identityName} si è unito al viaggio</div>
        <div className="mb-3.5 text-4xl">👋</div>
        <div className="mb-2 font-display text-[22px] font-bold text-[var(--color-text)]">Benvenuto nella crew</div>
        <div className="mb-7.5 text-[12.5px] font-semibold text-[var(--color-text-secondary)]">{joinedCount}/{crewTotal} in viaggio</div>
        <button type="button" className="rounded-full px-7.5 py-3.5 text-[13.5px] font-bold text-white" style={primaryBtnStyle} onClick={() => navigate(`/trip/${tripId()}/today`)}>Vai al viaggio</button>
      </div>
    )
  }

  return <div className="mx-auto min-h-svh max-w-md bg-[var(--color-bg)]">{body}</div>
}
