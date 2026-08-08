import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EditableText } from '../components/EditableText'
import { TripIdentityLink } from '../components/TripIdentityLink'
import { useAuth } from '../lib/authContext'
import { uploadTripMedia } from '../lib/mediaUpload'
import { useToast } from '../lib/toast'
import { useTripTableSync } from '../lib/useTripRealtime'
import { isUuid } from '../lib/uuid'
import { loadMemories, saveMemories, type MemoryDay, type MemoryItem } from '../lib/tripData'
import { fetchTripMembers, membriAttivi } from './spese/supabaseSpese'
import {
  createMemory,
  deleteMemory,
  fetchMemories,
  getOrCreateTodayMemoryDay,
  toggleMemoryFavorite,
  updateMemoryCaption,
} from './memories/supabaseMemories'

const DEMO_PEOPLE = ['Andrea', 'Luca', 'Marco', 'Sara', 'Giulia']
const MEMORIES_TABLES = ['memory_days', 'memories']

interface ViewerState {
  ids: string[]
  index: number
}

export function Memories() {
  const { tripId: routeTripId } = useParams()
  const isRealTrip = isUuid(routeTripId)
  const { session } = useAuth()
  const { showError } = useToast()

  const [loading, setLoading] = useState(isRealTrip)
  const [uploading, setUploading] = useState(false)
  const [days, setDays] = useState<MemoryDay[]>([])
  const [items, setItems] = useState<MemoryItem[]>([])
  const [filter, setFilter] = useState<string | null>(null)
  const [viewer, setViewer] = useState<ViewerState | null>(null)
  const [daEliminare, setDaEliminare] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null)
  const [currentMemberName, setCurrentMemberName] = useState('Tu')
  const [people, setPeople] = useState<string[]>(isRealTrip ? [] : DEMO_PEOPLE)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRealTrip && routeTripId) {
      setLoading(true)
      Promise.all([fetchMemories(routeTripId), fetchTripMembers(routeTripId)])
        .then(([data, members]) => {
          setDays(data.days)
          setItems(data.items)
          setPeople(membriAttivi(members).map((m) => m.name))
          const me = members.find((m) => m.userId === session?.user?.id)
          setCurrentMemberId(me?.id ?? null)
          setCurrentMemberName(me?.name ?? 'Tu')
        })
        .catch((err) => showError('Non siamo riusciti a caricare i ricordi.', err))
        .finally(() => setLoading(false))
      return
    }
    const data = loadMemories()
    setDays(data.days)
    setItems(data.items)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeTripId])

  async function refetchReal() {
    if (!routeTripId) return
    const data = await fetchMemories(routeTripId)
    setDays(data.days)
    setItems(data.items)
  }

  // Aggiornamenti live: nuovi ricordi/giorni caricati da altri membri
  // compaiono da soli mentre siamo sulla schermata.
  useTripTableSync(isRealTrip ? routeTripId ?? null : null, MEMORIES_TABLES, refetchReal)

  function persistDemo(nextItems: MemoryItem[]) {
    setItems(nextItems)
    saveMemories({ days, items: nextItems })
  }

  function openViewer(ids: string[], index: number) {
    setViewer({ ids, index })
  }
  function closeViewer() {
    setViewer(null)
    setFilter(null)
  }

  function toggleFavorite(id: string) {
    const next = !items.find((it) => it.id === id)?.isFavorite
    if (isRealTrip) {
      setItems((its) => its.map((it) => (it.id !== id ? it : { ...it, isFavorite: next })))
      toggleMemoryFavorite(id, next).catch((err) => showError('Non siamo riusciti ad aggiornare il preferito.', err))
    } else {
      persistDemo(items.map((it) => (it.id !== id ? it : { ...it, isFavorite: !it.isFavorite })))
    }
  }
  function updateCaption(id: string, caption: string) {
    if (!caption) return
    if (isRealTrip) {
      setItems((its) => its.map((it) => (it.id !== id ? it : { ...it, caption })))
      updateMemoryCaption(id, caption).catch((err) => showError('Non siamo riusciti a salvare la didascalia.', err))
    } else {
      persistDemo(items.map((it) => (it.id !== id ? it : { ...it, caption: caption || it.caption })))
    }
  }

  // Una foto caricata per sbaglio restava lì per sempre, per chiunque. La
  // conferma c'è perché il cestino sta nel visualizzatore a fianco di ✕, e
  // perché quello che sparisce è di tutta la crew.
  async function eliminaRicordo() {
    if (!daEliminare) return
    const id = daEliminare

    if (isRealTrip) {
      setEliminando(true)
      try {
        // Toglie la riga E il file dal magazzino: senza il secondo pezzo
        // resterebbe un file che nessuno può più vedere né cancellare.
        await deleteMemory(id)
      } catch (err) {
        showError('Non siamo riusciti a eliminare il ricordo.', err)
        setEliminando(false)
        return
      }
      setItems((its) => its.filter((it) => it.id !== id))
      setEliminando(false)
    } else {
      persistDemo(items.filter((it) => it.id !== id))
    }

    setDaEliminare(null)
    // Il visualizzatore lavora su un elenco di identificativi fissato quando si
    // è aperto: se non lo si aggiorna, si ritrova a puntare a un ricordo che non
    // c'è più. Tolta l'ultima foto della raccolta, si chiude come farebbe la ✕.
    const rimasti = viewer ? viewer.ids.filter((x) => x !== id) : []
    if (rimasti.length === 0) closeViewer()
    else setViewer((v) => (v ? { ids: rimasti, index: Math.min(v.index, rimasti.length - 1) } : v))
  }

  async function onFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const isVideo = file.type.startsWith('video')

    // Viaggio vero: il file va nello storage e nel database finisce solo il
    // percorso. Prima veniva convertito in testo e salvato dentro il database,
    // che si sarebbe riempito dopo poche decine di foto.
    if (isRealTrip && routeTripId) {
      setUploading(true)
      try {
        const percorso = await uploadTripMedia(routeTripId, file)
        const dayId = await getOrCreateTodayMemoryDay(routeTripId, 'Oggi')
        const item = await createMemory({ tripId: routeTripId, dayId, url: percorso, isVideo, authorMemberId: currentMemberId, authorName: currentMemberName })
        setItems((its) => [item, ...its])
        setDays((ds) => (ds.some((d) => d.id === dayId) ? ds : [...ds, { id: dayId, label: 'Oggi', dateLabel: 'Oggi', cover: '', isToday: true }]))
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Non siamo riusciti a caricare il ricordo. Riprova.', err)
      } finally {
        setUploading(false)
      }
      return
    }

    // Viaggio demo: resta su localStorage, dove non esiste uno storage.
    const reader = new FileReader()
    reader.onload = () => {
      const id = 'i' + Date.now()
      const todayDay = days.find((d) => d.isToday) || days[0]
      if (!todayDay) return
      persistDemo([{ id, dayId: todayDay.id, url: reader.result as string, isVideo, isFavorite: false, caption: 'Nuovo ricordo', author: 'Tu' }, ...items])
    }
    reader.readAsDataURL(file)
  }

  function exportAll() {
    items.forEach((it, i) => {
      setTimeout(() => {
        const a = document.createElement('a')
        a.href = it.url
        a.download = `pina-ricordo-${it.id}.jpg`
        document.body.appendChild(a)
        a.click()
        a.remove()
      }, i * 250)
    })
  }

  const personCover = (name: string) => items.find((it) => it.author === name)

  const dayStories = [
    {
      id: 'favorites',
      label: 'Preferiti',
      special: true,
      cover: null as string | null,
      active: filter === 'favorites',
      onClick: () => { setFilter('favorites'); openViewer(items.filter((it) => it.isFavorite).map((it) => it.id), 0) },
    },
    ...days.map((d) => ({
      id: d.id,
      label: d.label,
      special: false,
      cover: d.cover,
      active: filter === d.id,
      onClick: () => { setFilter(d.id); openViewer(items.filter((it) => it.dayId === d.id).map((it) => it.id), 0) },
    })),
  ]

  // La striscia mostra chi c'e' adesso, piu' chiunque abbia gia' caricato
  // qualcosa: chi ha lasciato il viaggio sparisce dalla crew ma le sue foto no,
  // e senza il suo nome qui non ci sarebbe piu' modo di sfogliarle.
  const personeConStorie = Array.from(
    new Set([...people, ...items.map((it) => it.author).filter((a): a is string => !!a)]),
  )

  const personStories = personeConStorie.map((name) => {
    const cover = personCover(name)
    return {
      id: 'person:' + name,
      label: name,
      cover: cover?.url ?? null,
      active: filter === 'person:' + name,
      onClick: () => { setFilter('person:' + name); openViewer(items.filter((it) => it.author === name).map((it) => it.id), 0) },
    }
  })

  const visibleDays = [...days]
    .sort((a, b) => (b.isToday ? 1 : 0) - (a.isToday ? 1 : 0))
    .map((d) => ({
      id: d.id,
      headerLabel: d.isToday ? `Oggi · ${d.label}` : `${d.label} · ${d.dateLabel}`,
      items: items.filter((it) => it.dayId === d.id),
      dayIds: items.filter((it) => it.dayId === d.id).map((it) => it.id),
    }))
    .filter((d) => d.items.length > 0)

  const currentItem = viewer ? items.find((it) => it.id === viewer.ids[viewer.index]) : null

  if (loading) {
    return (
      <div className="mx-auto flex min-h-svh max-w-md items-center justify-center bg-[var(--color-cream)] text-sm font-semibold text-[var(--color-text-secondary)]">
        Caricamento...
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-svh max-w-md bg-[var(--color-cream)] px-4.5 pb-24 pt-8 text-[var(--color-text)]">
      <div className="mb-3.5 flex items-center justify-between">
        <Link to="/" className="font-display text-[19px] font-semibold italic text-[var(--color-coral)]">🦩 Piña</Link>
        <TripIdentityLink />
      </div>

      <div className="mb-1 flex items-baseline justify-between">
        <div className="font-display text-2xl font-semibold">Memories</div>
        <button type="button" className="whitespace-nowrap text-[11px] font-bold text-[var(--color-coral-text)]" onClick={exportAll}>⬇ Esporta tutto</button>
      </div>
      <div className="mb-4 text-[12.5px] font-semibold text-[var(--color-text-secondary)]">I ricordi del gruppo, tappa per tappa</div>

      {items.length === 0 ? (
        <div className="mb-4.5 rounded-[22px] border-[1.5px] border-dashed border-[var(--color-empty-border)] px-5 py-10 text-center">
          <div
            className="mx-auto mb-3.5 flex h-21 w-21 items-center justify-center rounded-full text-center font-mono text-[8.5px] font-semibold text-[var(--color-add-text)]"
            style={{ background: 'repeating-linear-gradient(45deg,#ffe6cf,#ffe6cf 6px,#fff1e0 6px,#fff1e0 12px)' }}
          >
            fenicottero fotocamera
          </div>
          <div className="mb-1.5 font-display text-base font-semibold">Ancora nessun ricordo</div>
          <div className="mb-4.5 text-[12.5px] font-semibold leading-snug text-[var(--color-text-secondary)]">
            Aggiungi i tuoi ricordi per<br />condividere il tuo viaggio
          </div>
          <div className="flex justify-center gap-2.5">
            <button type="button" className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#ff8a5b,#ff5f6d)' }} onClick={() => cameraInputRef.current?.click()}>📷 Scatta</button>
            <button type="button" className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#2fbfae,#2a8fd8)' }} onClick={() => galleryInputRef.current?.click()}>🖼 Carica</button>
          </div>
        </div>
      ) : (
        <div>
          <div className="mx-0.5 mb-2 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Giorni</div>
          <div className="-mx-4.5 mb-4 flex gap-3.5 overflow-x-auto px-4.5 pb-1">
            {dayStories.map((story) => (
              <button key={story.id} type="button" className="flex w-16 shrink-0 flex-col items-center gap-1.25" onClick={story.onClick}>
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full p-0.75"
                  style={{ background: story.active ? (story.special ? 'linear-gradient(135deg,#ffb627,#d9481f)' : 'linear-gradient(135deg,#ff8a5b,#ff5f6d)') : 'var(--color-sand)' }}
                >
                  {story.special ? (
                    <div
                      className="flex h-full w-full items-center justify-center rounded-full border-2 border-[var(--color-bg)] text-center font-mono text-[6.5px] font-semibold text-[var(--color-add-text)]"
                      style={{ background: 'repeating-linear-gradient(45deg,#ffe6cf,#ffe6cf 5px,#fff1e0 5px,#fff1e0 10px)' }}
                    >
                      fenicottero fotocamera
                    </div>
                  ) : (
                    <div className="h-full w-full rounded-full border-2 border-[var(--color-bg)] bg-cover bg-center" style={{ backgroundImage: story.cover ? `url(${story.cover})` : undefined }} />
                  )}
                </div>
                <div className="text-center text-[10.5px] font-bold">{story.label}</div>
              </button>
            ))}
          </div>

          <div className="mx-0.5 mb-2 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Persone</div>
          <div className="-mx-4.5 mb-5 flex gap-3.5 overflow-x-auto px-4.5 pb-1">
            {personStories.map((story) => (
              <button key={story.id} type="button" className="flex w-16 shrink-0 flex-col items-center gap-1.25" onClick={story.onClick}>
                <div className="flex h-16 w-16 items-center justify-center rounded-full p-0.75" style={{ background: story.active ? 'linear-gradient(135deg,#3ddbc5,#7a9d54)' : 'var(--color-sand)' }}>
                  <div className="h-full w-full rounded-full border-2 border-[var(--color-bg)] bg-cover bg-center" style={{ backgroundImage: story.cover ? `url(${story.cover})` : undefined }} />
                </div>
                <div className="text-center text-[10.5px] font-bold">{story.label}</div>
              </button>
            ))}
          </div>

          {visibleDays.map((day) => (
            <div key={day.id}>
              <div className="mx-0.5 mb-2.5 text-xs font-bold text-[var(--color-eyebrow)]">{day.headerLabel}</div>
              <div className="mb-4.5 grid grid-cols-3 gap-1">
                {day.items.map((item, idx) => (
                  <button key={item.id} type="button" className="relative aspect-square overflow-hidden rounded-[10px]" onClick={() => openViewer(day.dayIds, idx)}>
                    <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${item.url})` }} />
                    {item.isVideo && <div className="absolute bottom-1 left-1.5 text-[13px] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,.5)]">▶</div>}
                    {item.isFavorite && <div className="absolute right-1.5 top-1 text-xs drop-shadow-[0_1px_3px_rgba(0,0,0,.5)]">⭐</div>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="fixed right-5 z-20 flex flex-col items-end gap-3" style={{ bottom: 'calc(6.125rem + var(--safe-bottom))' }}>
        {uploading && (
          <div className="rounded-full bg-[var(--color-text-strong)] px-3.5 py-2 text-[11.5px] font-bold text-white shadow-[0_10px_20px_-10px_rgba(0,0,0,.5)]">
            Caricamento in corso...
          </div>
        )}
        <button type="button" disabled={uploading} className="flex h-13 w-13 items-center justify-center rounded-full text-xl text-white shadow-[0_12px_24px_-8px_rgba(255,90,60,.55)] disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#ff8a5b,#ff5f6d)' }} onClick={() => cameraInputRef.current?.click()}>📷</button>
        <button type="button" disabled={uploading} className="flex h-13 w-13 items-center justify-center rounded-full text-xl text-white shadow-[0_12px_24px_-8px_rgba(40,150,180,.55)] disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#2fbfae,#2a8fd8)' }} onClick={() => galleryInputRef.current?.click()}>🖼</button>
      </div>
      <input ref={cameraInputRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={onFileSelected} />
      <input ref={galleryInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={onFileSelected} />

      {viewer && currentItem && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4.5 pb-17.5 pt-14">
          <div className="relative flex h-130 w-full max-w-80 flex-col overflow-hidden rounded-[26px] bg-black shadow-[0_30px_60px_-20px_rgba(0,0,0,.55)]">
            <div className="flex gap-1 px-3 pt-2.5">
              {viewer.ids.map((id, i) => (
                <div key={id} className="h-0.75 flex-1 rounded" style={{ background: i <= viewer.index ? '#fff' : 'rgba(255,255,255,.35)' }} />
              ))}
            </div>
            <div className="relative flex-1">
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${currentItem.url})` }} />
              <button type="button" className="absolute right-4 top-3.5 flex h-7.5 w-7.5 items-center justify-center rounded-full bg-black/40 text-sm text-white" onClick={closeViewer}>✕</button>
              <button type="button" aria-label="Elimina ricordo" className="absolute right-13 top-3.5 flex h-7.5 w-7.5 items-center justify-center rounded-full bg-black/40 text-xs text-white" onClick={() => setDaEliminare(currentItem.id)}>🗑</button>
              <button type="button" className="absolute left-4 top-3.5 flex h-7.5 w-7.5 items-center justify-center rounded-full bg-black/40 text-sm text-white" onClick={() => toggleFavorite(currentItem.id)}>{currentItem.isFavorite ? '⭐' : '☆'}</button>
              {viewer.index > 0 && (
                <button type="button" className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-base text-white" onClick={() => setViewer((v) => (v ? { ...v, index: Math.max(0, v.index - 1) } : v))}>‹</button>
              )}
              {viewer.index < viewer.ids.length - 1 && (
                <button type="button" className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-base text-white" onClick={() => setViewer((v) => (v ? { ...v, index: Math.min(v.ids.length - 1, v.index + 1) } : v))}>›</button>
              )}
            </div>
            <div className="bg-[var(--color-bg)] px-4 pb-4.5 pt-3.5">
              <EditableText
                key={currentItem.id + currentItem.caption}
                initialText={currentItem.caption}
                className="mb-0.75 font-display text-[15px] font-semibold text-[var(--color-text)]"
                onBlurText={(text) => updateCaption(currentItem.id, text)}
              />
              <div className="text-[11px] font-semibold text-[var(--color-text-secondary)]">Caricata da {currentItem.author}</div>
            </div>
          </div>
        </div>
      )}

      {/* Stessa finestra dell'eliminazione di un viaggio e di un movimento di
          spesa: quando l'app chiede "sei sicuro" lo fa sempre nello stesso
          modo. z-50 perché deve stare sopra il visualizzatore, che è a z-40. */}
      {daEliminare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8" onClick={() => !eliminando && setDaEliminare(null)}>
          <div className="rounded-[22px] bg-white p-6 text-center shadow-[0_30px_60px_-20px_rgba(0,0,0,.5)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2.5 text-3xl">⚠️</div>
            <div className="mb-2 font-display text-[17px] font-bold text-[var(--color-text)]">Eliminare questo ricordo?</div>
            <div className="mb-5 text-xs font-semibold leading-snug text-[var(--color-text-secondary)]">
              Sparisce per tutta la crew. L'azione non si può annullare.
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                className="flex-1 rounded-full border border-[var(--color-card-border)] bg-white py-3 text-center text-xs font-bold text-[var(--color-text)] disabled:opacity-60"
                disabled={eliminando}
                onClick={() => setDaEliminare(null)}
              >
                Annulla
              </button>
              <button
                type="button"
                className="flex-1 rounded-full bg-[#c2445a] py-3 text-center text-xs font-bold text-white disabled:opacity-60"
                disabled={eliminando}
                onClick={eliminaRicordo}
              >
                {eliminando ? 'Eliminazione...' : 'Elimina'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
