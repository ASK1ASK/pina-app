import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ColorPickerSheet, UploadMenuSheet } from '../components/CoverPickerSheets'
import { useAuth } from '../lib/authContext'
import { isUuid } from '../lib/uuid'
import { useTripRealtime } from '../lib/useTripRealtime'
import {
  coverGradientById,
  loadStoredColors,
  loadStoredPhotos,
  saveStoredColorFor,
  saveStoredPhotoFor,
  slugify,
  type CoverColorId,
} from '../lib/palette'
import { loadStops, saveStops, stopNights, type Stop } from '../lib/tripData'
import { AddStopSheet, type AddStopDraft } from './journey/AddStopSheet'
import { computeStopKind, computeTripPhase, stopMoodDefs, thingsSummary } from './journey/helpers'
import { StopDetailSheet } from './journey/StopDetailSheet'
import { fetchStops, fetchTripMeta, persistStops, updateTripCover, type TripMeta } from './journey/supabaseJourney'

const TRIP_NAME = 'Spain Roadtrip'
const TRIP_YEAR = 2026
const TRIP_MONTH = 7 // agosto (0-indexed)
const TRIP_START = new Date(TRIP_YEAR, TRIP_MONTH, 14)
const TRIP_END = new Date(TRIP_YEAR, TRIP_MONTH, 26)
const FRIENDS_COUNT = 5

interface ActivityEntry {
  person: string
  action: string
  time: string
}

const initialActivity: ActivityEntry[] = [
  { person: 'Giulia', action: 'ha aggiunto Rototom Sunsplash', time: '2 min fa' },
  { person: 'Marco', action: 'ha cambiato le date di Valencia', time: '1 h fa' },
  { person: 'Andrea', action: 'ha spostato Malaga dopo Rototom', time: 'ieri' },
]

const emptyDraft: AddStopDraft = { name: '', startDay: null, endDay: null, moodId: null, photo: null, error: null }

export function Journey() {
  const { tripId: routeTripId } = useParams()
  const isRealTrip = isUuid(routeTripId)
  const { user } = useAuth()

  const [stops, setStops] = useState<Stop[]>([])
  const [editMode, setEditMode] = useState(false)
  const [coverColorId, setCoverColorId] = useState<CoverColorId>('fiesta')
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null)
  const [coverPickerOpen, setCoverPickerOpen] = useState(false)
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false)
  const [uploadTarget, setUploadTarget] = useState<'tripCover' | 'newStop'>('tripCover')

  const [addStopOpen, setAddStopOpen] = useState(false)
  const [editingStopId, setEditingStopId] = useState<string | null>(null)
  const [draft, setDraft] = useState<AddStopDraft>(emptyDraft)

  const [activityExpanded, setActivityExpanded] = useState(false)
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>(initialActivity)

  const [stopDetailId, setStopDetailId] = useState<string | null>(null)
  const [addingCategoryFor, setAddingCategoryFor] = useState<string | null>(null)
  const [linkEditKey, setLinkEditKey] = useState<string | null>(null)
  const [activeDayByCategory, setActiveDayByCategory] = useState<Record<string, number>>({})
  const [activeDayForStay, setActiveDayForStay] = useState<Record<string, number>>({})

  const [tripMeta, setTripMeta] = useState<TripMeta | null>(null)
  const [loading, setLoading] = useState(isRealTrip)

  useEffect(() => {
    if (isRealTrip && routeTripId) {
      setLoading(true)
      Promise.all([fetchTripMeta(routeTripId), fetchStops(routeTripId)]).then(([meta, fetchedStops]) => {
        setTripMeta(meta)
        setStops(fetchedStops)
        if (meta) {
          setCoverColorId((meta.coverColorId as CoverColorId) || 'fiesta')
          setCoverPhoto(meta.coverPhotoUrl)
        }
        setLoading(false)
      })
      return
    }
    setStops(loadStops())
    const colors = loadStoredColors()
    const photos = loadStoredPhotos()
    const slug = slugify(TRIP_NAME)
    setCoverColorId((colors[slug] as CoverColorId) || 'fiesta')
    setCoverPhoto(photos[slug] || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeTripId])

  // Aggiornamenti live da altri membri (dati viaggio + chi è online ora),
  // solo per i viaggi reali. Su un cambio arrivato da un altro utente
  // ricarichiamo solo i metadati del viaggio (leggeri), non l'intero Journey.
  const { online } = useTripRealtime(isRealTrip ? routeTripId ?? null : null, {
    userId: user?.id ?? null,
    displayName: user?.email ? user.email.split('@')[0] : 'Viaggiatore',
    onTripChange: () => {
      if (!routeTripId) return
      fetchTripMeta(routeTripId).then((meta) => {
        if (!meta) return
        setTripMeta(meta)
        setCoverColorId((meta.coverColorId as CoverColorId) || 'fiesta')
        setCoverPhoto(meta.coverPhotoUrl)
      })
    },
    onMembersChange: () => {
      if (!routeTripId) return
      fetchTripMeta(routeTripId).then((meta) => meta && setTripMeta(meta))
    },
  })

  const tripName = isRealTrip && tripMeta ? tripMeta.name : TRIP_NAME
  const tripStartDate = isRealTrip && tripMeta ? tripMeta.startDate : TRIP_START
  const tripEndDate = isRealTrip && tripMeta ? tripMeta.endDate : TRIP_END
  const friendsCount = isRealTrip && tripMeta ? tripMeta.membersCount : FRIENDS_COUNT
  const refYear = isRealTrip && tripMeta ? tripMeta.startDate.getFullYear() : TRIP_YEAR
  const refMonth = isRealTrip && tripMeta ? tripMeta.startDate.getMonth() : TRIP_MONTH
  const monthLabel = tripStartDate.toLocaleDateString('it-IT', { month: 'long' })

  function persist(next: Stop[]) {
    setStops(next)
    if (isRealTrip && tripMeta) {
      persistStops(tripMeta.id, next, refYear, refMonth).catch((err) => console.error('Errore salvataggio tappe', err))
    } else {
      saveStops(next)
    }
  }

  function logActivity(action: string) {
    setActivityLog((log) => [{ person: 'Tu', action, time: 'adesso' }, ...log].slice(0, 5))
  }

  function updateStop(stopId: string, fn: (s: Stop) => Stop) {
    persist(stops.map((s) => (s.id !== stopId ? s : fn(s))))
  }

  const trip = computeTripPhase(tripStartDate, tripEndDate)
  const isPre = trip.phase === 'pre'
  const isTripDone = trip.phase === 'done'
  const todayStop = stops.find((s) => computeStopKind(s, isPre, refYear, refMonth) === 'today')

  const statusPillLabel = isPre
    ? `🗓 Si parte tra ${trip.daysUntil} giorn${trip.daysUntil === 1 ? 'o' : 'i'}`
    : isTripDone
      ? '🎉 Viaggio concluso'
      : `☀️ Oggi siete a ${todayStop ? todayStop.name : '...'}`

  const progressPct = isPre ? 0 : isTripDone ? 100 : Math.round(((trip.currentDay ?? 0) / trip.totalDays) * 100)
  const progressLabel = isPre
    ? `0% · Manca${trip.daysUntil === 1 ? '' : 'no'} ${trip.daysUntil} giorni alla partenza`
    : isTripDone
      ? '100% completato'
      : `${progressPct}% completato`

  const dayBoxValue = isPre ? `-${trip.daysUntil}` : `${trip.currentDay}/${trip.totalDays}`
  const dayBoxLabel = isPre ? 'al via' : 'giorno'

  const tripDatesLabel = `${tripStartDate.toLocaleDateString('it-IT', { day: 'numeric' })} → ${tripEndDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`

  const heroBackground = coverPhoto ? `url(${coverPhoto}) center/cover no-repeat` : coverGradientById[coverColorId] || coverGradientById.fiesta

  function selectCoverColor(id: CoverColorId) {
    setCoverColorId(id)
    setCoverPhoto(null)
    setCoverPickerOpen(false)
    if (isRealTrip && tripMeta) {
      updateTripCover(tripMeta.id, { coverColorId: id, coverPhotoUrl: null })
    } else {
      saveStoredColorFor(TRIP_NAME, id)
      saveStoredPhotoFor(TRIP_NAME, null)
    }
  }

  function onFileChosen(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      if (uploadTarget === 'newStop') {
        setDraft((d) => ({ ...d, photo: reader.result as string }))
        setUploadMenuOpen(false)
      } else {
        setCoverPhoto(reader.result as string)
        if (isRealTrip && tripMeta) {
          updateTripCover(tripMeta.id, { coverPhotoUrl: reader.result as string })
        } else {
          saveStoredPhotoFor(TRIP_NAME, reader.result as string)
        }
        setUploadMenuOpen(false)
        setCoverPickerOpen(false)
      }
    }
    reader.readAsDataURL(file)
  }

  function removeStop(id: string) {
    const stop = stops.find((s) => s.id === id)
    persist(stops.filter((s) => s.id !== id))
    if (stop) logActivity(`ha rimosso ${stop.name}`)
  }

  function moveStop(id: string, dir: 1 | -1) {
    const idx = stops.findIndex((s) => s.id === id)
    const swapIdx = idx + dir
    if (idx < 0 || swapIdx < 0 || swapIdx >= stops.length) return
    const next = [...stops]
    ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
    persist(next)
  }

  function openAddStopSheet() {
    setEditingStopId(null)
    setDraft(emptyDraft)
    setAddStopOpen(true)
  }

  function openStopSettings(stopId: string) {
    const stop = stops.find((s) => s.id === stopId)
    if (!stop) return
    const mood = stopMoodDefs.find((m) => m.label === stop.moodLine)
    setEditingStopId(stopId)
    setDraft({
      name: stop.name,
      startDay: stop.startDay,
      endDay: stop.endDay,
      moodId: mood ? mood.id : null,
      photo: stop.photo || null,
      error: null,
    })
    setStopDetailId(null)
    setAddStopOpen(true)
  }

  function closeAddStopSheet() {
    setAddStopOpen(false)
    setEditingStopId(null)
    setDraft(emptyDraft)
  }

  function saveNewStop() {
    if (!draft.name || !draft.startDay) {
      setDraft((d) => ({ ...d, error: 'Inserisci almeno il nome e la data della tappa.' }))
      return
    }
    const mood = stopMoodDefs.find((m) => m.id === draft.moodId) || stopMoodDefs[0]
    const startDay = draft.startDay
    const endDay = draft.endDay || draft.startDay
    const dates = endDay !== startDay ? `${startDay} → ${endDay} ${monthLabel}` : `${startDay} ${monthLabel}`

    if (editingStopId) {
      const next = stops
        .map((st) =>
          st.id !== editingStopId
            ? st
            : { ...st, name: draft.name, startDay, endDay, moodLine: mood.label, dates, photo: draft.photo ?? undefined, gradient: mood.gradient },
        )
        .sort((a, b) => (a.startDay || 0) - (b.startDay || 0))
      persist(next)
      logActivity(`ha modificato ${draft.name}`)
    } else {
      const id = 'stop' + Date.now()
      const newStop: Stop = {
        id,
        name: draft.name,
        startDay,
        endDay,
        moodLine: mood.label,
        dates,
        photo: draft.photo ?? undefined,
        gradient: mood.gradient,
        stays: [{ id: 'stay' + Date.now(), name: '', link: '', days: stopNights({ startDay, endDay }) }],
        categories: [
          { id: 'food', icon: '🍽', label: 'Dove mangiare', items: [] },
          { id: 'nightlife', icon: '🍻', label: 'Bar & Nightlife', items: [] },
          { id: 'places', icon: '📍', label: 'Luoghi da visitare', items: [] },
          { id: 'activities', icon: '🎫', label: 'Attività & Esperienze', items: [] },
        ],
      }
      const next = [...stops, newStop].sort((a, b) => (a.startDay || 0) - (b.startDay || 0))
      persist(next)
      logActivity(`ha aggiunto ${draft.name}`)
      setEditMode(true)
    }
    setAddStopOpen(false)
    setEditingStopId(null)
    setDraft(emptyDraft)
  }

  const detailStop = stopDetailId ? stops.find((s) => s.id === stopDetailId) ?? null : null

  return (
    <div className="mx-auto min-h-svh max-w-md bg-[var(--color-cream)] px-4.5 pb-24 pt-8 text-[var(--color-text)]">
      <div className="mb-3.5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-1.5 font-display text-[19px] font-semibold italic text-[var(--color-coral)]">
          🦩 Piña
        </Link>
        <Link to="/" className="whitespace-nowrap rounded-xl border border-[var(--color-card-border)] bg-white px-3.5 py-1.75 text-xs font-bold text-[var(--color-text)]">
          🏠 Home
        </Link>
      </div>

      {online.length > 0 && (
        <div className="mb-3.5 flex items-center gap-1.5">
          <div className="flex -space-x-2">
            {online.slice(0, 5).map((m) => (
              <div
                key={m.userId}
                title={m.name}
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--color-cream)] bg-[var(--color-coral)] text-[10px] font-bold uppercase text-white"
              >
                {m.name.slice(0, 1)}
              </div>
            ))}
          </div>
          <span className="text-[11px] font-semibold text-[var(--color-text-secondary)]">
            {online.length === 1 ? 'online ora' : `${online.length} online ora`}
          </span>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-sm font-semibold text-[var(--color-text-secondary)]">Caricamento viaggio...</div>
      ) : stops.length > 0 ? (
        <>
          <div className="mb-4">
            <div className="inline-flex items-center gap-1.75 whitespace-nowrap rounded-full border border-[#f0dfc0] bg-white px-3.5 py-2 text-[12.5px] font-semibold text-[#8a6a3e]">
              {statusPillLabel}
            </div>
          </div>

          <div className="relative mb-7 overflow-hidden rounded-[28px] text-white shadow-[0_18px_36px_-16px_rgba(255,110,70,.45)]">
            <div className="absolute inset-0" style={{ background: heroBackground }} />
            <div className="absolute inset-x-0 bottom-0 top-[38%]" style={{ background: 'linear-gradient(180deg,transparent,rgba(20,12,8,.82) 55%)' }} />
            <button type="button" className="absolute right-3.5 top-3.5 z-10 flex h-7.5 w-7.5 items-center justify-center rounded-full bg-black/28 text-sm" onClick={() => setCoverPickerOpen(true)}>🎨</button>
            <div className="relative z-[1] flex flex-col justify-end px-5 pb-5.5 pt-4.5">
              <div className="mb-1 font-display text-[26px] font-bold leading-tight">{tripName}</div>
              <div className="mb-4 text-[13px] font-semibold text-white/88">{tripDatesLabel}</div>
              <div className="mb-2 h-2 overflow-hidden rounded-full bg-white/28">
                <div className="h-full rounded-full bg-white" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="mb-4 text-xs font-bold">{progressLabel}</div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="text-center">
                  <div className="font-display text-[22px] font-bold leading-none">{dayBoxValue}</div>
                  <div className="mt-1 text-[11px] font-bold text-white">{dayBoxLabel}</div>
                </div>
                <div className="text-center">
                  <div className="font-display text-[22px] font-bold leading-none">{stops.length}</div>
                  <div className="mt-1 text-[11px] font-bold text-white">tappe</div>
                </div>
                <div className="text-center">
                  <div className="font-display text-[22px] font-bold leading-none">{friendsCount}</div>
                  <div className="mt-1 text-[11px] font-bold text-white">amici</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-0.5 mb-3.5 flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Le tappe</div>
            <button type="button" className="whitespace-nowrap text-[11.5px] font-bold text-[var(--color-coral)]" onClick={() => setEditMode((v) => !v)}>
              {editMode ? 'Fatto' : 'Modifica'}
            </button>
          </div>

          <div className="relative flex flex-col gap-4">
            <div className="absolute bottom-2 left-5.5 top-2 z-0 w-0.5 bg-[#ecdfc4]" />
            {stops.map((stop, idx) => {
              const kind = computeStopKind(stop, isPre, TRIP_YEAR, TRIP_MONTH)
              const isFirst = idx === 0
              const isLast = idx === stops.length - 1
              const dotColor = kind === 'today' ? '#ff6b5b' : '#ecdfc4'
              return (
                <div key={stop.id} className="relative z-[1] flex items-start gap-3">
                  <div className="flex w-11 shrink-0 flex-col items-center gap-0.75 pt-0.5">
                    {editMode && (
                      <button type="button" className="text-[10px] leading-none" style={{ color: isFirst ? '#e0d3b8' : '#b8703a' }} disabled={isFirst} onClick={() => moveStop(stop.id, -1)}>▲</button>
                    )}
                    <div className="h-3.5 w-3.5 rounded-full border-[3px] border-[var(--color-bg)]" style={{ background: dotColor, boxShadow: `0 0 0 1.5px ${dotColor}` }} />
                    {editMode && (
                      <button type="button" className="text-[10px] leading-none" style={{ color: isLast ? '#e0d3b8' : '#b8703a' }} disabled={isLast} onClick={() => moveStop(stop.id, 1)}>▼</button>
                    )}
                  </div>

                  {kind === 'done' && (
                    <div className="flex flex-1 cursor-pointer items-center gap-2.5 rounded-[22px] border border-[var(--color-card-border)] bg-white p-2.5 opacity-55 shadow-[0_10px_22px_-14px_rgba(120,90,40,.3)]" onClick={() => setStopDetailId(stop.id)}>
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[10px]" style={{ backgroundImage: stop.photo ? `url(${stop.photo})` : undefined, background: stop.photo ? undefined : stop.gradient, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'grayscale(.3)' }} />
                      <div className="flex-1">
                        <div className="font-display text-[14.5px] font-semibold">{stop.name}</div>
                        <div className="text-[10.5px] font-semibold text-[var(--color-text-secondary)]">{stop.moodLine} · {stop.dates}</div>
                      </div>
                      <span className="text-xs">✓</span>
                      {editMode && (
                        <button type="button" className="text-[15px] text-[#c2a97e]" onClick={(e) => { e.stopPropagation(); removeStop(stop.id) }}>×</button>
                      )}
                    </div>
                  )}

                  {kind === 'today' && (
                    <div className="flex-1 cursor-pointer overflow-hidden rounded-[22px] border border-[var(--color-card-border)] bg-white shadow-[0_10px_22px_-14px_rgba(120,90,40,.3)]" onClick={() => setStopDetailId(stop.id)}>
                      <div className="relative h-42">
                        <div className="absolute inset-0" style={{ backgroundImage: stop.photo ? `url(${stop.photo})` : undefined, background: stop.photo ? undefined : stop.gradient, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                        <div className="absolute inset-x-0 bottom-0 h-[55%]" style={{ background: 'linear-gradient(180deg,transparent,rgba(40,20,10,.75))' }} />
                        <span className="absolute left-3 top-3 rounded-full border border-white/30 bg-black/28 px-2.5 py-1.25 text-[11.5px] font-bold text-white">{stop.moodLine}</span>
                        {editMode && (
                          <button type="button" className="absolute right-3 top-2.5 flex h-5.5 w-5.5 items-center justify-center rounded-full bg-black/35 text-[13px] text-white" onClick={(e) => { e.stopPropagation(); removeStop(stop.id) }}>×</button>
                        )}
                        <div className="absolute bottom-3 left-3.5 right-3.5">
                          <div className="font-display text-2xl font-semibold text-white">{stop.name}</div>
                          <div className="text-[11.5px] font-semibold text-white/85">{stop.dates}</div>
                        </div>
                      </div>
                      <div className="px-4 pb-3.5 pt-3">
                        <span className="text-[11.5px] font-bold text-[#8a7256]">{thingsSummary(stop)}</span>
                      </div>
                    </div>
                  )}

                  {kind === 'future' && (
                    <div
                      className="flex-1 cursor-pointer rounded-[22px] bg-white shadow-[0_10px_22px_-14px_rgba(120,90,40,.3)]"
                      style={{ border: stop.highlight ? '1.5px solid #ffb627' : '1px solid var(--color-card-border)' }}
                      onClick={() => setStopDetailId(stop.id)}
                    >
                      <div className="flex gap-3 p-2.5">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[14px]" style={{ backgroundImage: stop.photo ? `url(${stop.photo})` : undefined, background: stop.photo ? undefined : stop.gradient, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                        <div className="min-w-0 flex-1 py-0.5">
                          <div className="flex items-center justify-between">
                            <div className="mb-0.5 text-[11px] font-bold text-[#c2793a]">{stop.moodLine}</div>
                            {editMode && (
                              <button type="button" className="text-[15px] text-[#c2a97e]" onClick={(e) => { e.stopPropagation(); removeStop(stop.id) }}>×</button>
                            )}
                          </div>
                          <div className="font-display text-[17px] font-semibold">{stop.name}</div>
                          <div className="text-[11.5px] font-semibold text-[var(--color-text-secondary)]">{stop.dates}</div>
                        </div>
                      </div>
                      <div className="px-2.5 pb-2.5 pl-21.5">
                        <span className="text-[10.5px] font-bold text-[#8a7256]">{thingsSummary(stop)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {editMode && (
              <div className="relative z-[1] flex items-start gap-3">
                <div className="w-11 shrink-0" />
                <button type="button" className="flex-1 rounded-2xl border-[1.5px] border-dashed border-[var(--color-add-border)] p-3 text-center text-[12.5px] font-bold text-[var(--color-add-text)]" onClick={openAddStopSheet}>
                  + Aggiungi tappa
                </button>
              </div>
            )}
          </div>

          <div className="mt-5.5 rounded-[20px] border border-[var(--color-card-border)] bg-white p-3.5 shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
            <button type="button" className="flex w-full items-center justify-between" onClick={() => setActivityExpanded((v) => !v)}>
              <div className="text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Attività recenti · {activityLog.length}</div>
              <span className="text-[11px] font-bold text-[var(--color-coral)]">{activityExpanded ? 'Chiudi ⌃' : 'Apri ⌄'}</span>
            </button>
            {activityExpanded && (
              <div className="mt-3 flex flex-col gap-2.25">
                {activityLog.map((a, i) => (
                  <div key={i} className="flex items-baseline gap-1.5 text-[12.5px]">
                    <span className="shrink-0 font-bold">{a.person}</span>
                    <span className="flex-1 text-[#8a7256]">{a.action}</span>
                    <span className="shrink-0 text-[11px] text-[#c2a97e]">{a.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-[28px] px-6.5 py-9 text-center text-white shadow-[0_18px_36px_-16px_rgba(255,150,60,.45)]" style={{ background: 'linear-gradient(135deg,#ffb627,#ff8a5b)' }}>
          <div className="mb-3.5 text-[44px]">🦩</div>
          <div className="mb-2 font-display text-[22px] font-bold">Il viaggio non è ancora iniziato</div>
          <div className="mb-6 text-[12.5px] font-semibold leading-relaxed text-white/90">Costruite insieme le tappe, giorno per giorno</div>
          <button type="button" className="inline-block rounded-full bg-white px-6 py-3.25 text-[13px] font-bold text-[var(--color-text)]" onClick={openAddStopSheet}>
            + Aggiungi la prima tappa
          </button>
        </div>
      )}

      {coverPickerOpen && !uploadMenuOpen && (
        <ColorPickerSheet
          selectedId={coverPhoto ? '' : coverColorId}
          onSelect={selectCoverColor}
          onOpenUpload={() => { setUploadTarget('tripCover'); setUploadMenuOpen(true) }}
          onClose={() => setCoverPickerOpen(false)}
        />
      )}
      {uploadMenuOpen && (
        <UploadMenuSheet
          onPickCamera={onFileChosen}
          onPickLibrary={onFileChosen}
          onPickFile={onFileChosen}
          onClose={() => setUploadMenuOpen(false)}
        />
      )}

      {addStopOpen && !uploadMenuOpen && (
        <AddStopSheet
          editing={!!editingStopId}
          draft={draft}
          tripStartDay={tripStartDate.getDate()}
          tripEndDay={tripEndDate.getDate()}
          onChangeName={(text) => setDraft((d) => ({ ...d, name: text }))}
          onSelectDay={(day) =>
            setDraft((d) => {
              if (d.startDay && d.endDay) return { ...d, startDay: day, endDay: null }
              if (d.startDay && !d.endDay) return day >= d.startDay ? { ...d, endDay: day } : { ...d, startDay: day, endDay: null }
              return { ...d, startDay: day, endDay: null }
            })
          }
          onSelectMood={(id) => setDraft((d) => ({ ...d, moodId: id }))}
          onOpenUpload={() => { setUploadTarget('newStop'); setUploadMenuOpen(true) }}
          onSave={saveNewStop}
          onClose={closeAddStopSheet}
        />
      )}

      {detailStop && (
        <StopDetailSheet
          stop={detailStop}
          onClose={() => setStopDetailId(null)}
          onOpenSettings={() => openStopSettings(detailStop.id)}
          activeStayDay={activeDayForStay[detailStop.id]}
          onSelectStayDay={(day) => setActiveDayForStay((m) => ({ ...m, [detailStop.id]: day }))}
          onSaveStayName={(stayId, text) => updateStop(detailStop.id, (st) => ({ ...st, stays: st.stays.map((s) => (s.id !== stayId ? s : { ...s, name: text })) }))}
          onSaveStayLink={(stayId, text) => updateStop(detailStop.id, (st) => ({ ...st, stays: st.stays.map((s) => (s.id !== stayId ? s : { ...s, link: text })) }))}
          onAddStay={() => {
            const nights = stopNights(detailStop)
            const activeDay = activeDayForStay[detailStop.id] || nights[nights.length - 1]
            updateStop(detailStop.id, (st) => ({ ...st, stays: [...(st.stays || []), { id: 'stay' + Date.now(), name: '', link: '', day: activeDay }] }))
          }}
          onRemoveStay={(stayId) => updateStop(detailStop.id, (st) => ({ ...st, stays: (st.stays || []).filter((s) => s.id !== stayId) }))}
          linkEditKey={linkEditKey}
          onToggleLinkEdit={setLinkEditKey}
          activeDayByCategory={Object.fromEntries(
            Object.entries(activeDayByCategory)
              .filter(([k]) => k.startsWith(detailStop.id + ':'))
              .map(([k, v]) => [k.split(':')[1], v]),
          )}
          onSelectCategoryDay={(catId, day) => setActiveDayByCategory((m) => ({ ...m, [detailStop.id + ':' + catId]: day }))}
          onToggleStar={(catId, itemId) =>
            updateStop(detailStop.id, (st) => ({
              ...st,
              categories: st.categories.map((c) => (c.id !== catId ? c : { ...c, items: c.items.map((it) => (it.id !== itemId ? it : { ...it, starred: !it.starred })) })),
            }))
          }
          onSaveItemLabel={(catId, itemId, text) =>
            updateStop(detailStop.id, (st) => ({
              ...st,
              categories: st.categories.map((c) => (c.id !== catId ? c : { ...c, items: c.items.map((it) => (it.id !== itemId ? it : { ...it, label: text || it.label })) })),
            }))
          }
          onSaveItemLink={(catId, itemId, text) =>
            updateStop(detailStop.id, (st) => ({
              ...st,
              categories: st.categories.map((c) => (c.id !== catId ? c : { ...c, items: c.items.map((it) => (it.id !== itemId ? it : { ...it, link: text })) })),
            }))
          }
          onRemoveItem={(catId, itemId) =>
            updateStop(detailStop.id, (st) => ({
              ...st,
              categories: st.categories.map((c) => (c.id !== catId ? c : { ...c, items: c.items.filter((it) => it.id !== itemId) })),
            }))
          }
          onAddItem={(catId, text) => {
            const nights = stopNights(detailStop)
            const activeDay = activeDayByCategory[detailStop.id + ':' + catId] || nights[nights.length - 1]
            updateStop(detailStop.id, (st) => ({
              ...st,
              categories: st.categories.map((c) => (c.id !== catId ? c : { ...c, items: [...c.items, { id: 'it' + Date.now(), label: text, link: '', starred: false, day: activeDay }] })),
            }))
            logActivity(`ha aggiunto "${text}" a ${detailStop.name}`)
          }}
          addingCategoryFor={addingCategoryFor === detailStop.id}
          onStartAddCategory={() => setAddingCategoryFor(detailStop.id)}
          onAddCategory={(text) => {
            if (!text) { setAddingCategoryFor(null); return }
            const parts = text.split(' ')
            const icon = parts.length > 1 ? parts[0] : '📌'
            const label = parts.length > 1 ? parts.slice(1).join(' ') : text
            updateStop(detailStop.id, (st) => ({ ...st, categories: [...(st.categories || []), { id: 'cat' + Date.now(), icon, label, items: [] }] }))
            setAddingCategoryFor(null)
          }}
        />
      )}
    </div>
  )
}
