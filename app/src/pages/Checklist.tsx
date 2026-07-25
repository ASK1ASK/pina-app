import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { EditableText } from '../components/EditableText'
import { useAuth } from '../lib/authContext'
import { isUuid } from '../lib/uuid'
import {
  loadChecklistData,
  loadEssentialsData,
  loadStops,
  saveChecklistData,
  saveEssentialsData,
  saveStops,
  updateItem,
  people,
  personOrder,
  currentUser,
  type EssentialsCategory,
  type Stop,
} from '../lib/tripData'
import { fetchTripMembers, type RealMember } from './spese/supabaseSpese'
import { fetchStops, fetchTripMeta, persistStops as persistStopsRemote } from './journey/supabaseJourney'
import {
  fetchChecklist,
  fetchEssentials,
  fetchPersonalSections,
  persistChecklist,
  persistEssentials as persistEssentialsRemote,
  persistPersonalSections as persistPersonalSectionsRemote,
  seedEssentials,
} from './checklist/supabaseChecklist'
import { ChecklistRow } from './checklist/ChecklistRow'
import { defaultCategories, defaultPersonalSections } from './checklist/data'
import { EssentialsPanel } from './checklist/EssentialsPanel'

type Tab = 'condivisa' | 'valigia'
type ViewMode = 'categoria' | 'persona'

// Forma unificata: compatibile sia con il cast demo (PersonId) sia con i
// membri veri (id uuid da trip_members), stesso approccio usato in Spese.
interface UIChecklistItem {
  id: string
  label: string
  done: boolean
  assignee?: string
}
interface UIChecklistCategory {
  id: string
  emoji: string
  name: string
  items: UIChecklistItem[]
}
type UIPersonalSection = UIChecklistCategory

// Stessi 4 raggruppamenti del demo, ma senza voci finte dentro: per un
// viaggio vero danno una struttura pronta da riempire invece di un'area
// grigia senza nemmeno un modo per aggiungere qualcosa.
const EMPTY_ESSENTIALS_CATEGORIES: EssentialsCategory[] = [
  { id: 'doc', emoji: '🪪', name: 'Documenti', gradient: 'linear-gradient(135deg,#ff8a5b,#d9481f)', entries: [] },
  { id: 'stay', emoji: '🏕', name: 'Alloggi', gradient: 'linear-gradient(135deg,#ffb627,#d9481f)', entries: [] },
  { id: 'transport', emoji: '🚐', name: 'Trasporti', gradient: 'linear-gradient(135deg,#8fbf6b,#4f7a3a)', entries: [] },
  { id: 'bookings', emoji: '🎟', name: 'Prenotazioni', gradient: 'linear-gradient(135deg,#ffb627,#ff5f6d)', entries: [] },
]

export function Checklist() {
  const { tripId: routeTripId } = useParams()
  const isRealTrip = isUuid(routeTripId)
  const { session } = useAuth()

  const [tab, setTab] = useState<Tab>('condivisa')
  const [viewMode, setViewMode] = useState<ViewMode>('categoria')
  const [loading, setLoading] = useState(isRealTrip)
  const [categories, setCategories] = useState<UIChecklistCategory[]>(isRealTrip ? [] : defaultCategories)
  const [personalSections, setPersonalSections] = useState<UIPersonalSection[]>(isRealTrip ? [] : defaultPersonalSections)
  const [stops, setStops] = useState<Stop[]>([])
  const [essentialsCategories, setEssentialsCategories] = useState<EssentialsCategory[]>(isRealTrip ? EMPTY_ESSENTIALS_CATEGORIES : [])
  const [activeEssentialId, setActiveEssentialId] = useState<string | null>(null)
  const [focusItemId, setFocusItemId] = useState<string | null>(null)
  const [realMembers, setRealMembers] = useState<RealMember[]>([])
  const [daysUntilStart, setDaysUntilStart] = useState<number | null>(null)
  const [tripStartDate, setTripStartDate] = useState<Date | null>(null)
  const loaded = useRef(false)
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const members = isRealTrip
    ? realMembers.map((m) => ({ id: m.id, name: m.name, color: m.color }))
    : personOrder.map((code) => ({ id: code, name: people[code].name, color: people[code].color }))
  const membersById: Record<string, { name: string; color: string }> = Object.fromEntries(members.map((m) => [m.id, m]))
  const memberIds = members.map((m) => m.id)
  const activeUser = isRealTrip ? (realMembers.find((m) => m.userId === session?.user?.id)?.id ?? memberIds[0] ?? '') : currentUser
  // Per il demo l'id E' gia' l'iniziale (codici 'A'/'L'/...); per i membri
  // veri (uuid) mostriamo l'iniziale del nome invece dell'id per intero.
  function initialFor(id: string): string {
    if (!isRealTrip) return id
    return membersById[id]?.name.slice(0, 1).toUpperCase() || '?'
  }

  useEffect(() => {
    if (isRealTrip && routeTripId) {
      setLoading(true)
      Promise.all([fetchTripMembers(routeTripId), fetchChecklist(routeTripId), fetchStops(routeTripId), fetchTripMeta(routeTripId), fetchEssentials(routeTripId)]).then(
        async ([fetchedMembers, fetchedChecklist, fetchedStops, meta, fetchedEssentials]) => {
          setRealMembers(fetchedMembers)
          setCategories(fetchedChecklist)
          setStops(fetchedStops)
          if (meta) {
            const days = Math.ceil((meta.startDate.getTime() - Date.now()) / 86400000)
            setDaysUntilStart(days)
            setTripStartDate(meta.startDate)
          }
          if (fetchedEssentials.length) {
            setEssentialsCategories(fetchedEssentials)
          } else {
            // Il seed richiede di essere gia' membro del viaggio (RLS): se il
            // viaggio non esiste o non siamo ancora membri, non blocchiamo
            // il resto della pagina per questo.
            try {
              setEssentialsCategories(await seedEssentials(routeTripId))
            } catch (err) {
              console.error('Errore creazione essentials', err)
            }
          }

          const me = fetchedMembers.find((m) => m.userId === session?.user?.id)
          const myMemberId = me?.id ?? fetchedMembers[0]?.id ?? null
          if (myMemberId) setPersonalSections(await fetchPersonalSections(routeTripId, myMemberId))

          loaded.current = true
          setLoading(false)
        },
      )
      return
    }
    const saved = loadChecklistData()
    if (saved) {
      setCategories(saved.categories)
      setPersonalSections(saved.personalSections)
    }
    setStops(loadStops())
    setEssentialsCategories(loadEssentialsData().categories)
    loaded.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeTripId])

  useEffect(() => {
    if (!loaded.current) return
    if (isRealTrip && routeTripId) {
      persistChecklist(routeTripId, categories).catch((err) => console.error('Errore salvataggio checklist', err))
      if (activeUser) {
        persistPersonalSectionsRemote(routeTripId, activeUser, personalSections).catch((err) => console.error('Errore salvataggio valigia', err))
      }
    } else {
      saveChecklistData({ categories, personalSections } as never)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, personalSections])

  useEffect(() => {
    if (!focusItemId) return
    const el = itemRefs.current[focusItemId]
    if (el) {
      el.focus()
      const range = document.createRange()
      range.selectNodeContents(el)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    setFocusItemId(null)
  }, [focusItemId])

  function persistStops(next: Stop[]) {
    setStops(next)
    if (isRealTrip && routeTripId && tripStartDate) {
      persistStopsRemote(routeTripId, next, tripStartDate.getFullYear(), tripStartDate.getMonth()).catch((err) => console.error('Errore salvataggio tappe', err))
    } else if (!isRealTrip) {
      saveStops(next)
    }
  }

  function persistEssentials(next: EssentialsCategory[]) {
    setEssentialsCategories(next)
    if (isRealTrip && routeTripId) {
      persistEssentialsRemote(routeTripId, next).catch((err) => console.error('Errore salvataggio essentials', err))
    } else {
      saveEssentialsData({ categories: next })
    }
  }

  // ---- shared checklist mutations ----
  function toggleItem(catId: string, itemId: string) {
    setCategories((cs) => cs.map((c) => (c.id !== catId ? c : { ...c, items: c.items.map((it) => (it.id !== itemId ? it : { ...it, done: !it.done })) })))
  }
  function deleteItem(catId: string, itemId: string) {
    setCategories((cs) => cs.map((c) => (c.id !== catId ? c : { ...c, items: c.items.filter((it) => it.id !== itemId) })))
  }
  function updateItemLabel(catId: string, itemId: string, label: string) {
    setCategories((cs) => cs.map((c) => (c.id !== catId ? c : { ...c, items: c.items.map((it) => (it.id !== itemId ? it : { ...it, label: label || it.label })) })))
  }
  function cycleAssignee(catId: string, itemId: string) {
    setCategories((cs) =>
      cs.map((c) =>
        c.id !== catId
          ? c
          : {
              ...c,
              items: c.items.map((it) => {
                if (it.id !== itemId) return it
                const idx = memberIds.indexOf(it.assignee || activeUser)
                const next = memberIds[(idx + 1) % memberIds.length]
                return { ...it, assignee: next }
              }),
            },
      ),
    )
  }
  function addItemToCategory(catId: string) {
    const id = 'i' + Date.now()
    setFocusItemId(id)
    setCategories((cs) => cs.map((c) => (c.id !== catId ? c : { ...c, items: [...c.items, { id, label: 'Nuova voce', done: false, assignee: activeUser }] })))
  }
  function addCategory() {
    const id = 'c' + Date.now()
    setFocusItemId(id)
    setCategories((cs) => [...cs, { id, emoji: '📌', name: 'Nuova sezione', items: [] }])
  }
  function updateCategoryName(catId: string, name: string) {
    setCategories((cs) => cs.map((c) => (c.id !== catId ? c : { ...c, name: name || c.name })))
  }
  function updateCategoryEmoji(catId: string, emoji: string) {
    setCategories((cs) => cs.map((c) => (c.id !== catId ? c : { ...c, emoji: emoji || c.emoji })))
  }

  // ---- personal checklist mutations ----
  function togglePersonalItem(sectionId: string, itemId: string) {
    setPersonalSections((ss) => ss.map((s) => (s.id !== sectionId ? s : { ...s, items: s.items.map((it) => (it.id !== itemId ? it : { ...it, done: !it.done })) })))
  }
  function deletePersonalItem(sectionId: string, itemId: string) {
    setPersonalSections((ss) => ss.map((s) => (s.id !== sectionId ? s : { ...s, items: s.items.filter((it) => it.id !== itemId) })))
  }
  function updatePersonalItemLabel(sectionId: string, itemId: string, label: string) {
    setPersonalSections((ss) => ss.map((s) => (s.id !== sectionId ? s : { ...s, items: s.items.map((it) => (it.id !== itemId ? it : { ...it, label: label || it.label })) })))
  }
  function addPersonalItem(sectionId: string) {
    const id = 'pi' + Date.now()
    setFocusItemId(id)
    setPersonalSections((ss) => ss.map((s) => (s.id !== sectionId ? s : { ...s, items: [...s.items, { id, label: 'Nuova voce', done: false }] })))
  }
  function addPersonalSection() {
    const id = 'ps' + Date.now()
    setFocusItemId(id)
    setPersonalSections((ss) => [...ss, { id, emoji: '📦', name: 'Nuova sezione', items: [] }])
  }
  function updatePersonalSectionName(sectionId: string, name: string) {
    setPersonalSections((ss) => ss.map((s) => (s.id !== sectionId ? s : { ...s, name: name || s.name })))
  }
  function updatePersonalSectionEmoji(sectionId: string, emoji: string) {
    setPersonalSections((ss) => ss.map((s) => (s.id !== sectionId ? s : { ...s, emoji: emoji || s.emoji })))
  }

  // ---- essentials mutations ----
  function saveEssentialField(catId: string, entryId: string, field: 'title' | 'subtitle' | 'href', text: string) {
    persistEssentials(
      essentialsCategories.map((c) =>
        c.id !== catId ? c : { ...c, entries: c.entries.map((e) => (e.id !== entryId ? e : { ...e, [field]: text || (e as unknown as Record<string, string>)[field] })) },
      ),
    )
  }
  function attachEssential(catId: string, entryId: string, file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      persistEssentials(essentialsCategories.map((c) => (c.id !== catId ? c : { ...c, entries: c.entries.map((e) => (e.id !== entryId ? e : { ...e, attachment: reader.result as string })) })))
    }
    reader.readAsDataURL(file)
  }
  function removeEssentialAttachment(catId: string, entryId: string) {
    persistEssentials(essentialsCategories.map((c) => (c.id !== catId ? c : { ...c, entries: c.entries.map((e) => (e.id !== entryId ? e : { ...e, attachment: null })) })))
  }
  function deleteEssentialEntry(catId: string, entryId: string) {
    persistEssentials(essentialsCategories.map((c) => (c.id !== catId ? c : { ...c, entries: c.entries.filter((e) => e.id !== entryId) })))
  }
  function addEssentialEntry(catId: string) {
    persistEssentials(essentialsCategories.map((c) => (c.id !== catId ? c : { ...c, entries: [...c.entries, { id: 'ee' + Date.now(), title: 'Nuova voce', subtitle: 'Aggiungi dettagli', tag: '', href: '' }] })))
  }

  // ---- activity (Journey starred-item sub-checklist) mutations ----
  function toggleActivityChecklistItem(stopId: string, catId: string, itemId: string, checklistId: string) {
    const stop = stops.find((s) => s.id === stopId)
    const cat = stop?.categories.find((c) => c.id === catId)
    const item = cat?.items.find((i) => i.id === itemId)
    if (!item) return
    const list = (item.checklist || []).map((c) => (c.id !== checklistId ? c : { ...c, done: !c.done }))
    persistStops(updateItem(stops, stopId, catId, itemId, { checklist: list }))
  }
  function updateActivityChecklistLabel(stopId: string, catId: string, itemId: string, checklistId: string, label: string) {
    const stop = stops.find((s) => s.id === stopId)
    const cat = stop?.categories.find((c) => c.id === catId)
    const item = cat?.items.find((i) => i.id === itemId)
    if (!item) return
    const list = (item.checklist || []).map((c) => (c.id !== checklistId ? c : { ...c, label: label || c.label }))
    persistStops(updateItem(stops, stopId, catId, itemId, { checklist: list }))
  }

  // ---- derived data ----
  const activityGroups = stops.flatMap((stop) =>
    stop.categories.flatMap((cat) =>
      cat.items
        .filter((item) => item.checklist && item.checklist.length > 0)
        .map((item) => {
          const done = (item.checklist || []).filter((c) => c.done).length
          return {
            key: `${stop.id}:${cat.id}:${item.id}`,
            icon: cat.icon,
            title: `${item.label} · ${stop.name}`,
            countLabel: `${done}/${item.checklist!.length}`,
            items: (item.checklist || []).map((c) => ({
              ...c,
              toggle: () => toggleActivityChecklistItem(stop.id, cat.id, item.id, c.id),
              save: (text: string) => updateActivityChecklistLabel(stop.id, cat.id, item.id, c.id, text),
            })),
          }
        }),
    ),
  )

  const flat = categories.flatMap((c) => c.items.map((it) => ({ ...it, catEmoji: c.emoji, catName: c.name, catId: c.id })))
  const totalItems = flat.length
  const doneItems = flat.filter((i) => i.done).length
  const percent = totalItems ? Math.round((doneItems / totalItems) * 100) : 0
  const assignedToYou = flat.filter((i) => i.assignee === activeUser).length

  const personGroups = memberIds
    .map((id) => {
      const person = membersById[id]
      const items = flat.filter((i) => i.assignee === id)
      const done = items.filter((i) => i.done).length
      return { code: id, name: person?.name || '?', color: person?.color || '#c2a97e', countLabel: `${done}/${items.length}`, items }
    })
    .filter((g) => g.items.length > 0)

  const mySharedItems = flat.filter((i) => i.assignee === activeUser)
  const mySharedDone = mySharedItems.filter((i) => i.done).length

  const personalTotal = mySharedItems.length + personalSections.reduce((a, s) => a + s.items.length, 0)
  const personalDone = mySharedDone + personalSections.reduce((a, s) => a + s.items.filter((i) => i.done).length, 0)
  const personalPercent = personalTotal ? Math.round((personalDone / personalTotal) * 100) : 0

  const showCelebrateCondivisa = totalItems > 0 && doneItems === totalItems
  const showCelebrateValigia = personalTotal > 0 && personalDone === personalTotal

  const tabBtnClass = (active: boolean) =>
    `flex-1 rounded-[11px] py-2.25 text-center text-[12.5px] font-bold ${active ? 'bg-white text-[var(--color-text)] shadow-[0_4px_10px_-6px_rgba(120,90,40,.4)]' : 'text-[var(--color-text-secondary)]'}`
  const viewBtnClass = (active: boolean) =>
    `flex-1 rounded-[10px] py-2 text-center text-xs font-bold ${active ? 'bg-white text-[var(--color-text)] shadow-[0_3px_8px_-5px_rgba(120,90,40,.4)]' : 'text-[var(--color-text-secondary)]'}`

  const countdownLabel = !isRealTrip
    ? '🧳 Si parte tra 12 giorni'
    : daysUntilStart === null
      ? '🧳 Checklist del viaggio'
      : daysUntilStart > 0
        ? `🧳 Si parte tra ${daysUntilStart} giorn${daysUntilStart === 1 ? 'o' : 'i'}`
        : '🧳 Siete in viaggio'

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
        <a href="/" className="flex items-center gap-1.5 font-display text-[19px] font-semibold italic text-[var(--color-coral)]">🦩 Piña</a>
        <a href="/" className="whitespace-nowrap rounded-xl border border-[var(--color-card-border)] bg-white px-3.5 py-1.75 text-xs font-bold text-[var(--color-text)]">🏠 Home</a>
      </div>

      <div className="mb-4 font-display text-2xl font-semibold">Checklist</div>

      <div className="mb-4.5 flex gap-1 rounded-[13px] bg-[#f0e5d1] p-1">
        <button type="button" className={tabBtnClass(tab === 'condivisa')} onClick={() => setTab('condivisa')}>Condivisa</button>
        <button type="button" className={tabBtnClass(tab === 'valigia')} onClick={() => setTab('valigia')}>La mia valigia</button>
      </div>

      {tab === 'condivisa' ? (
        <div>
          <div className="mb-3.5 rounded-[26px] p-5 text-white shadow-[0_18px_36px_-18px_rgba(217,72,31,.45)]" style={{ background: 'linear-gradient(135deg,#ff8a5b,#d9481f)' }}>
            <div className="mb-1 text-xs font-bold text-white/85">{countdownLabel}</div>
            <div className="mb-2.5 font-display text-xl font-bold leading-tight">Essentials del viaggio</div>
            <div className="text-xs font-bold">{percent}% completato · {assignedToYou} assegnate a te</div>
          </div>

          <div className="mx-0.5 mb-2.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">📎 Riferimenti</div>
          <EssentialsPanel
            categories={essentialsCategories}
            activeId={activeEssentialId}
            onSetActive={(id) => setActiveEssentialId((cur) => (cur === id ? null : id))}
            onSaveField={saveEssentialField}
            onAttach={attachEssential}
            onRemoveAttachment={removeEssentialAttachment}
            onDeleteEntry={deleteEssentialEntry}
            onAddEntry={addEssentialEntry}
          />

          {activityGroups.length > 0 && (
            <div className="mb-4">
              <div className="mx-0.5 mb-2.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Attività</div>
              {activityGroups.map((ag) => (
                <div key={ag.key} className="mb-3 overflow-hidden rounded-[20px] border border-[var(--color-card-border)] bg-white shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
                  <div className="flex items-center gap-2.5 px-3.5 py-3.25">
                    <span className="text-lg">{ag.icon}</span>
                    <span className="flex-1 text-[14.5px] font-bold">{ag.title}</span>
                    <span className="text-[11.5px] font-bold text-[var(--color-eyebrow)]">{ag.countLabel}</span>
                  </div>
                  <div className="border-t border-dashed border-[var(--color-card-border)]">
                    {ag.items.map((it) => (
                      <ChecklistRow key={it.id} done={it.done} label={it.label} onToggle={it.toggle} onSaveLabel={it.save} doneColor="#2a8fd8" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mb-4 flex gap-1 rounded-[13px] bg-[#f0e5d1] p-1">
            <button type="button" className={viewBtnClass(viewMode === 'categoria')} onClick={() => setViewMode('categoria')}>Per categoria</button>
            <button type="button" className={viewBtnClass(viewMode === 'persona')} onClick={() => setViewMode('persona')}>Per persona</button>
          </div>

          <div className="mx-0.5 mb-2.5 mt-4.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">✅ Da fare</div>

          {viewMode === 'categoria' ? (
            <div>
              {categories.length === 0 && (
                <div className="mb-3 rounded-[22px] border-[1.5px] border-dashed border-[var(--color-empty-border)] px-5 py-7 text-center">
                  <div className="mb-1 font-display text-base font-semibold">Nessuna sezione ancora</div>
                  <div className="text-xs font-semibold text-[var(--color-text-secondary)]">Aggiungine una qui sotto per iniziare a organizzarvi</div>
                </div>
              )}
              {categories.map((cat) => {
                const done = cat.items.filter((i) => i.done).length
                return (
                  <div key={cat.id} className="mb-3 overflow-hidden rounded-[20px] border border-[var(--color-card-border)] bg-white shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
                    <div className="flex items-center gap-2.5 px-3.5 py-3.25">
                      <EditableText
                        key={'emoji-' + cat.emoji}
                        initialText={cat.emoji}
                        className="text-lg"
                        onBlurText={(text) => updateCategoryEmoji(cat.id, text)}
                      />
                      <EditableText
                        ref={(el) => { itemRefs.current[cat.id] = el }}
                        key={'name-' + cat.name}
                        initialText={cat.name}
                        className="flex-1 text-[14.5px] font-bold"
                        onBlurText={(text) => updateCategoryName(cat.id, text)}
                      />
                      <span className="text-[11.5px] font-bold text-[var(--color-eyebrow)]">{done}/{cat.items.length}</span>
                      <button type="button" className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fdeee0] text-[15px] font-bold text-[var(--color-coral)]" onClick={() => addItemToCategory(cat.id)}>+</button>
                    </div>
                    <div className="border-t border-dashed border-[var(--color-card-border)]">
                      {cat.items.map((it) => (
                        <ChecklistRow
                          key={it.id}
                          itemRef={(el) => { itemRefs.current[it.id] = el }}
                          done={it.done}
                          label={it.label}
                          onToggle={() => toggleItem(cat.id, it.id)}
                          onSaveLabel={(text) => updateItemLabel(cat.id, it.id, text)}
                          onDelete={() => deleteItem(cat.id, it.id)}
                          avatarColor={membersById[it.assignee || activeUser]?.color || '#c2a97e'}
                          assigneeCode={initialFor(it.assignee || activeUser)}
                          onCycleAssignee={() => cycleAssignee(cat.id, it.id)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
              <button type="button" className="mb-3 w-full rounded-2xl border-[1.5px] border-dashed border-[var(--color-add-border)] py-3 text-center text-[12.5px] font-bold text-[var(--color-add-text)]" onClick={addCategory}>
                + Aggiungi sezione
              </button>
            </div>
          ) : (
            <div>
              {personGroups.map((grp) => (
                <div key={grp.code} className="mb-3 overflow-hidden rounded-[20px] border border-[var(--color-card-border)] bg-white shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
                  <div className="flex items-center gap-2.5 bg-[var(--color-bg)] px-3.5 py-3.25">
                    <div className="flex h-7.5 w-7.5 items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ background: grp.color }}>{initialFor(grp.code)}</div>
                    <span className="flex-1 text-[14.5px] font-bold">{grp.name}</span>
                    <span className="text-[11.5px] font-bold text-[var(--color-eyebrow)]">{grp.countLabel}</span>
                  </div>
                  <div>
                    {grp.items.map((it) => (
                      <ChecklistRow
                        key={it.id}
                        itemRef={(el) => { itemRefs.current[it.id] = el }}
                        done={it.done}
                        label={it.label}
                        onToggle={() => toggleItem(it.catId, it.id)}
                        onSaveLabel={(text) => updateItemLabel(it.catId, it.id, text)}
                        onDelete={() => deleteItem(it.catId, it.id)}
                        catTag={`${it.catEmoji} ${it.catName}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {showCelebrateCondivisa && (
            <div className="mt-1.5 rounded-[20px] border-[1.5px] border-[var(--color-add-border)] bg-[#fffaf0] p-5 text-center">
              <div
                className="mx-auto mb-2.5 flex h-21 w-21 items-center justify-center rounded-full text-center font-mono text-[8.5px] font-semibold text-[var(--color-add-text)]"
                style={{ background: 'repeating-linear-gradient(45deg,#ffe6cf,#ffe6cf 6px,#fff1e0 6px,#fff1e0 12px)' }}
              >
                fenicottero con zaino
              </div>
              <div className="mb-0.75 font-display text-base font-semibold">Tutto pronto!</div>
              <div className="text-xs font-semibold text-[var(--color-text-secondary)]">Si parte 🎉</div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-4.5 rounded-[26px] p-5 text-white shadow-[0_18px_36px_-18px_rgba(40,150,180,.45)]" style={{ background: 'linear-gradient(135deg,#2fbfae,#2a8fd8)' }}>
            <div className="mb-1 text-xs font-bold text-white/85">🎒 La tua valigia</div>
            <div className="mb-3.5 font-display text-[22px] font-bold leading-tight">{personalDone} di {personalTotal} pronte</div>
            <div className="mb-1.75 h-2 overflow-hidden rounded-full bg-white/28">
              <div className="h-full rounded-full bg-white" style={{ width: `${personalPercent}%` }} />
            </div>
            <div className="text-xs font-bold">{personalPercent}% completato</div>
          </div>

          <div className="mx-0.5 mb-3 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Il tuo condiviso</div>
          <div className="mb-4.5 overflow-hidden rounded-[20px] border border-[var(--color-card-border)] bg-white shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
            <div className="flex items-center gap-2.5 px-3.5 py-3.25">
              <span className="text-lg">🔗</span>
              <span className="flex-1 text-[14.5px] font-bold">Dalla checklist condivisa</span>
              <span className="text-[11.5px] font-bold text-[var(--color-eyebrow)]">{mySharedDone}/{mySharedItems.length}</span>
            </div>
            <div className="border-t border-dashed border-[var(--color-card-border)]">
              {mySharedItems.map((it) => (
                <ChecklistRow
                  key={it.id}
                  done={it.done}
                  label={it.label}
                  onToggle={() => toggleItem(it.catId, it.id)}
                  onSaveLabel={(text) => updateItemLabel(it.catId, it.id, text)}
                  onDelete={() => deleteItem(it.catId, it.id)}
                  catTag={`${it.catEmoji} ${it.catName}`}
                />
              ))}
            </div>
          </div>

          <div className="mx-0.5 mb-3 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">La tua valigia</div>
          {personalSections.length === 0 && (
            <div className="mb-3 rounded-[22px] border-[1.5px] border-dashed border-[var(--color-empty-border)] px-5 py-7 text-center">
              <div className="mb-1 font-display text-base font-semibold">Valigia ancora da fare</div>
              <div className="text-xs font-semibold text-[var(--color-text-secondary)]">Aggiungi una sezione qui sotto (es. Documenti, Vestiti)</div>
            </div>
          )}
          {personalSections.map((sec) => {
            const done = sec.items.filter((i) => i.done).length
            return (
              <div key={sec.id} className="mb-3 overflow-hidden rounded-[20px] border border-[var(--color-card-border)] bg-white shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
                <div className="flex items-center gap-2.5 px-3.5 py-3.25">
                  <EditableText key={'e' + sec.emoji} initialText={sec.emoji} className="text-lg" onBlurText={(text) => updatePersonalSectionEmoji(sec.id, text)} />
                  <EditableText
                    ref={(el) => { itemRefs.current[sec.id] = el }}
                    key={'n' + sec.name}
                    initialText={sec.name}
                    className="flex-1 text-[14.5px] font-bold"
                    onBlurText={(text) => updatePersonalSectionName(sec.id, text)}
                  />
                  <span className="text-[11.5px] font-bold text-[var(--color-eyebrow)]">{done}/{sec.items.length}</span>
                  <button type="button" className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fdeee0] text-[15px] font-bold text-[var(--color-coral)]" onClick={() => addPersonalItem(sec.id)}>+</button>
                </div>
                <div className="border-t border-dashed border-[var(--color-card-border)]">
                  {sec.items.map((it) => (
                    <ChecklistRow
                      key={it.id}
                      itemRef={(el) => { itemRefs.current[it.id] = el }}
                      done={it.done}
                      label={it.label}
                      onToggle={() => togglePersonalItem(sec.id, it.id)}
                      onSaveLabel={(text) => updatePersonalItemLabel(sec.id, it.id, text)}
                      onDelete={() => deletePersonalItem(sec.id, it.id)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
          <button type="button" className="mb-3 w-full rounded-2xl border-[1.5px] border-dashed border-[var(--color-add-border)] py-3 text-center text-[12.5px] font-bold text-[var(--color-add-text)]" onClick={addPersonalSection}>
            + Aggiungi sezione
          </button>

          {showCelebrateValigia && (
            <div className="mt-1.5 rounded-[20px] border-[1.5px] border-[var(--color-add-border)] bg-[#fffaf0] p-5 text-center">
              <div
                className="mx-auto mb-2.5 flex h-21 w-21 items-center justify-center rounded-full text-center font-mono text-[8.5px] font-semibold text-[var(--color-add-text)]"
                style={{ background: 'repeating-linear-gradient(45deg,#ffe6cf,#ffe6cf 6px,#fff1e0 6px,#fff1e0 12px)' }}
              >
                fenicottero con valigia
              </div>
              <div className="mb-0.75 font-display text-base font-semibold">Valigia pronta!</div>
              <div className="text-xs font-semibold text-[var(--color-text-secondary)]">Non manca niente 🎒</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
