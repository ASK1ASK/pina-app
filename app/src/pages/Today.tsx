import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { EditableText } from '../components/EditableText'
import { moodGradients } from '../lib/palette'
import { loadLinks, loadStops, starredItemsForDay, updateItem, type LinkEntry, type Stop, type StopItem } from '../lib/tripData'
import { ScheduleItemSheet } from './today/ScheduleItemSheet'
import {
  buildDays,
  loadScheduleOrder,
  saveScheduleOrder,
  statusMeta,
  statusOrder,
  toMinutes,
  type Day,
  type DayStatus,
} from './today/data'

type SheetMode = 'schedule' | 'list' | 'addExpense' | null
interface ScheduleTarget { stopId: string; catId: string; itemId: string }

const days: Day[] = buildDays()

export function Today() {
  const [dayIndex, setDayIndex] = useState(2)
  const [now, setNow] = useState(new Date())
  const [sheetMode, setSheetMode] = useState<SheetMode>(null)
  const [sheetTarget, setSheetTarget] = useState<ScheduleTarget | null>(null)
  const [listType, setListType] = useState<'tickets' | 'links' | null>(null)
  const [dayStatus, setDayStatus] = useState<Record<number, DayStatus>>({ 0: 'done', 1: 'done', 2: 'inprogress', 3: 'ready' })
  const [checklistDone, setChecklistDone] = useState<Record<number, Record<number, boolean>>>({})
  const [extraChecklist, setExtraChecklist] = useState<Record<number, string[]>>({})
  const [checklistLabels, setChecklistLabels] = useState<Record<number, Record<number, string>>>({})
  const [focusChecklistKey, setFocusChecklistKey] = useState<string | null>(null)
  const [stops, setStops] = useState<Stop[]>([])
  const [scheduleOrder, setScheduleOrder] = useState<Record<string, string[]>>({})
  const [focusActivityChecklistId, setFocusActivityChecklistId] = useState<string | null>(null)
  const [tripLinks, setTripLinks] = useState<LinkEntry[]>([])

  const checklistRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    setScheduleOrder(loadScheduleOrder())
    setStops(loadStops())
    setTripLinks(loadLinks())
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!focusChecklistKey) return
    const el = checklistRefs.current[focusChecklistKey]
    if (el) {
      el.focus()
      const range = document.createRange()
      range.selectNodeContents(el)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    setFocusChecklistKey(null)
  }, [focusChecklistKey])

  const day = days[dayIndex]

  function persistStops(next: Stop[]) {
    setStops(next)
  }

  function updateSheetItem(patch: Partial<StopItem>) {
    if (!sheetTarget) return
    const next = updateItem(stops, sheetTarget.stopId, sheetTarget.catId, sheetTarget.itemId, patch)
    persistStops(next)
  }

  const dayKey = String(day.dayOfMonth)
  const starred = stops.length ? starredItemsForDay(stops, day.dayOfMonth) : []
  const savedOrder = scheduleOrder[dayKey] || []

  const ordered = useMemo(() => {
    let arr = [...starred].sort((a, b) => {
      const ta = toMinutes(a.time), tb = toMinutes(b.time)
      if (ta === null && tb === null) return 0
      if (ta === null) return 1
      if (tb === null) return -1
      return ta - tb
    })
    if (savedOrder.length) {
      arr = [...arr].sort((a, b) => {
        const ia = savedOrder.indexOf(a.id), ib = savedOrder.indexOf(b.id)
        const ra = ia === -1 ? 9999 : ia, rb = ib === -1 ? 9999 : ib
        return ra - rb
      })
    }
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starred, savedOrder.join(',')])

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  let currentIndex = -1
  ordered.forEach((it, i) => {
    const t = toMinutes(it.time)
    if (t !== null && t <= nowMinutes) currentIndex = i
  })
  const nextIndex = currentIndex + 1 < ordered.length ? currentIndex + 1 : -1
  const hasSchedule = ordered.length > 0

  function moveScheduleItem(idx: number, dir: 1 | -1) {
    const ids = ordered.map((o) => o.id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= ids.length) return
    const next = [...ids]
    ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
    const order = { ...scheduleOrder, [dayKey]: next }
    saveScheduleOrder(order)
    setScheduleOrder(order)
  }

  const meta = statusMeta[dayStatus[dayIndex] || 'planned']

  const checklistDoneMap = checklistDone[dayIndex] || {}
  const checklistLabelMap = checklistLabels[dayIndex] || {}
  const fullChecklist = [...day.checklist, ...(extraChecklist[dayIndex] || []).map((label) => ({ label, done: false }))]

  const expenseTotal = day.expenses.reduce((sum, e) => sum + e.amount, 0)
  const currentTimeLabel = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  const isEndOfDay = hasSchedule && currentIndex >= ordered.length - 1

  function cycleStatus() {
    setDayStatus((s) => {
      const current = s[dayIndex] || 'planned'
      const idx = statusOrder.indexOf(current)
      return { ...s, [dayIndex]: statusOrder[(idx + 1) % statusOrder.length] }
    })
  }

  function toggleChecklist(idx: number) {
    setChecklistDone((s) => ({ ...s, [dayIndex]: { ...(s[dayIndex] || {}), [idx]: !(s[dayIndex]?.[idx]) } }))
  }
  function addChecklistItem() {
    setExtraChecklist((s) => {
      const list = [...(s[dayIndex] || []), 'Nuovo elemento']
      const newIndex = day.checklist.length + list.length - 1
      setFocusChecklistKey(`${dayIndex}:${newIndex}`)
      return { ...s, [dayIndex]: list }
    })
  }
  function updateChecklistLabel(idx: number, text: string) {
    setChecklistLabels((s) => ({ ...s, [dayIndex]: { ...(s[dayIndex] || {}), [idx]: text } }))
  }

  const sheetItem = sheetMode === 'schedule' && sheetTarget
    ? starredItemsForDay(stops, day.dayOfMonth).find((s) => s.stopId === sheetTarget.stopId && s.catId === sheetTarget.catId && s.id === sheetTarget.itemId) || null
    : null

  function closeSheet() {
    setSheetMode(null)
    setSheetTarget(null)
  }

  function setScheduleTime(newTime: string) {
    if (!sheetTarget) return
    updateSheetItem({ time: newTime })
    const withTime = updateItem(stops, sheetTarget.stopId, sheetTarget.catId, sheetTarget.itemId, { time: newTime })
    const starredNow = starredItemsForDay(withTime, day.dayOfMonth)
    let order = (scheduleOrder[dayKey] || []).filter((id) => id !== sheetTarget.itemId && starredNow.some((s) => s.id === id))
    const known = new Set(order)
    const missing = starredNow
      .filter((s) => s.id !== sheetTarget.itemId && !known.has(s.id))
      .sort((a, b) => (toMinutes(a.time) ?? 9999) - (toMinutes(b.time) ?? 9999))
      .map((s) => s.id)
    order = [...order, ...missing]
    const newMinutes = toMinutes(newTime)
    let insertAt = order.length
    if (newMinutes !== null) {
      for (let i = 0; i < order.length; i++) {
        const other = starredNow.find((s) => s.id === order[i])
        const otherMinutes = other ? toMinutes(other.time) : null
        if (otherMinutes === null || newMinutes < (otherMinutes as number)) { insertAt = i; break }
      }
    }
    order.splice(insertAt, 0, sheetTarget.itemId)
    const next = { ...scheduleOrder, [dayKey]: order }
    saveScheduleOrder(next)
    setScheduleOrder(next)
  }

  const listItems: { emoji: string; label: string; url: string }[] =
    sheetMode === 'list'
      ? listType === 'tickets'
        ? day.tickets
        : [...day.usefulLinks, ...tripLinks.map((l) => ({ emoji: l.emoji, label: l.label, url: l.url }))]
      : []
  const listTitle = listType === 'tickets' ? 'Biglietti e Ticket' : 'Link utili'

  return (
    <div className="mx-auto min-h-svh max-w-md bg-[var(--color-cream)] px-4 pb-24 pt-8 text-[var(--color-text)]">
      <div className="mb-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-1.5 font-display text-[19px] font-semibold italic text-[var(--color-coral)]">🦩 Piña</Link>
        <Link to="/" className="whitespace-nowrap rounded-xl border border-[var(--color-card-border)] bg-white px-3.5 py-1.75 text-xs font-bold text-[var(--color-text)]">🏠 Home</Link>
      </div>

      <div className="mb-3.5 flex items-center justify-center gap-3.5">
        <button
          type="button"
          disabled={dayIndex === 0}
          className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full border border-[var(--color-sand)] bg-white text-sm text-[#8a6a3e]"
          style={{ opacity: dayIndex === 0 ? 0.35 : 1 }}
          onClick={() => setDayIndex((i) => Math.max(0, i - 1))}
        >‹</button>
        <div className="text-xs font-bold tracking-[.02em] text-[var(--color-text-secondary)]">Giorno {day.dayOfMonth - 14 + 1}</div>
        <button
          type="button"
          disabled={dayIndex === days.length - 1}
          className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full border border-[var(--color-sand)] bg-white text-sm text-[#8a6a3e]"
          style={{ opacity: dayIndex === days.length - 1 ? 0.35 : 1 }}
          onClick={() => setDayIndex((i) => Math.min(days.length - 1, i + 1))}
        >›</button>
      </div>

      <div className="mb-4 rounded-[26px] p-5 text-white shadow-[0_18px_36px_-18px_rgba(80,50,20,.4)]" style={{ background: moodGradients[day.moodId] || moodGradients.fiesta }}>
        <div className="mb-1 text-xs font-bold text-white/85">{day.mood}</div>
        <div className="flex items-baseline justify-between">
          <div className="font-display text-[26px] font-bold uppercase">{day.city}</div>
          <button type="button" className="inline-flex shrink-0 items-center gap-1.25 whitespace-nowrap rounded-full border border-white/35 bg-white/22 px-2.75 py-1.25 text-[11px] font-bold" onClick={cycleStatus}>
            {meta.icon} {meta.label}
          </button>
        </div>
        <div className="text-xs font-semibold text-white/85">{day.dateLabel}</div>
      </div>

      <div className="mb-3 rounded-[20px] border border-[var(--color-card-border)] bg-white p-3.5 shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
        <div className="mb-2.5 flex items-baseline justify-between">
          <div className="text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Programma di oggi</div>
          <div className="text-[10.5px] font-bold text-[#c2a97e]">ora {currentTimeLabel}</div>
        </div>
        {hasSchedule ? (
          <div className="flex flex-col gap-1.5">
            {ordered.map((it, i) => {
              const hasTime = !!it.time
              const isPast = hasTime && i < currentIndex
              const isCurrent = hasTime && i === currentIndex
              const isNext = hasTime && i === nextIndex
              const canUp = i > 0
              const canDown = i < ordered.length - 1
              const open = () => { setSheetMode('schedule'); setSheetTarget({ stopId: it.stopId, catId: it.catId, itemId: it.id }) }
              return (
                <div
                  key={it.id}
                  className="flex items-center gap-2"
                  style={{
                    opacity: isPast ? 0.5 : 1,
                    background: isCurrent ? '#fff4e6' : undefined,
                    borderRadius: isCurrent ? 12 : undefined,
                    padding: isCurrent ? '6px 8px' : undefined,
                    margin: isCurrent ? '0 -8px' : undefined,
                  }}
                >
                  <div className="flex w-3.75 shrink-0 flex-col">
                    <button type="button" disabled={!canUp} className="h-2.75 text-center text-[9px] leading-[9px]" style={{ color: canUp ? '#a9906f' : '#e6d5b3' }} onClick={() => moveScheduleItem(i, -1)}>▴</button>
                    <button type="button" disabled={!canDown} className="h-2.75 text-center text-[9px] leading-[9px]" style={{ color: canDown ? '#a9906f' : '#e6d5b3' }} onClick={() => moveScheduleItem(i, 1)}>▾</button>
                  </div>
                  <button type="button" className="w-9 shrink-0 cursor-pointer text-left text-[11px] font-bold" style={{ color: isCurrent ? '#d9481f' : '#a9906f' }} onClick={open}>
                    {hasTime ? it.time : 'Orario'}
                  </button>
                  <button type="button" className="w-5 shrink-0 text-center text-[15px]" onClick={open}>{it.icon || it.catIcon || '📌'}</button>
                  <button type="button" className="min-w-0 flex-1 truncate text-left text-[13px]" style={{ fontWeight: isCurrent || isNext ? 700 : 600 }} onClick={open}>{it.label}</button>
                  {(isCurrent || isNext) && (
                    <button type="button" className="shrink-0 rounded-full bg-[#fde3d0] px-1.75 py-0.75 text-[9.5px] font-bold text-[var(--color-coral)]" onClick={open}>
                      {isCurrent ? 'ORA' : 'PROSSIMO'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="py-3.5 text-center">
            <div className="mb-2 text-[12.5px] font-semibold text-[var(--color-text-secondary)]">Nessuna attività con la stellina per oggi.</div>
            <Link to="/trip/spain/journey" className="text-xs font-bold text-[var(--color-coral)]">⭐ Aggiungi stelline su Journey</Link>
          </div>
        )}
      </div>

      <div className="mb-3 rounded-[20px] border border-[var(--color-card-border)] bg-white p-3.5 shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
        <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Dove dormi stanotte</div>
        <Link to="/trip/spain/checklist" className="mb-3.5 flex items-center gap-2.5">
          <span className="shrink-0 text-[22px]">🏨</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">{day.stayName}</div>
            <div className="text-[11.5px] font-semibold text-[var(--color-text-secondary)]">{day.stayLabel}</div>
          </div>
        </Link>
        <div className="flex gap-2">
          <a href={day.stayLink} target="_blank" rel="noreferrer" className="flex-1 rounded-[10px] bg-[var(--color-bg)] py-2 text-center text-[11px] font-bold text-[var(--color-text)]">📍 Mappa</a>
          <a href="tel:+34600000000" className="flex-1 rounded-[10px] bg-[var(--color-bg)] py-2 text-center text-[11px] font-bold text-[var(--color-text)]">📞 Chiama</a>
        </div>
      </div>

      <div className="mb-3 rounded-[20px] border border-[var(--color-card-border)] bg-white p-3.5 shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Checklist di oggi</div>
          <button type="button" className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-[var(--color-bg)] text-sm font-bold text-[var(--color-coral)]" onClick={addChecklistItem}>+</button>
        </div>
        <div className="flex flex-col gap-2.25">
          {fullChecklist.map((c, i) => {
            const done = checklistDoneMap[i] !== undefined ? checklistDoneMap[i] : c.done
            const label = checklistLabelMap[i] !== undefined ? checklistLabelMap[i] : c.label
            return (
              <div key={i} className="flex items-center gap-2.5">
                <button
                  type="button"
                  className="flex h-4.75 w-4.75 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white"
                  style={done ? { background: '#7a9d54' } : { background: '#fff', border: '1.5px solid var(--color-sand)' }}
                  onClick={() => toggleChecklist(i)}
                >
                  {done ? '✓' : ''}
                </button>
                <EditableText
                  ref={(el) => { checklistRefs.current[`${dayIndex}:${i}`] = el }}
                  initialText={label}
                  className="min-w-0 flex-1 text-[13px] font-semibold"
                  style={done ? { color: 'var(--color-text-secondary)', textDecoration: 'line-through' } : undefined}
                  onBlurText={(text) => updateChecklistLabel(i, text)}
                />
              </div>
            )
          })}
        </div>
      </div>

      <div className="mb-3 rounded-[20px] border border-[var(--color-card-border)] bg-white p-3.5 shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
        <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Link e biglietti di oggi</div>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" className="rounded-2xl bg-[var(--color-bg)] px-2 py-3 text-center" onClick={() => { setSheetMode('list'); setListType('tickets') }}>
            <div className="mb-1 text-xl">🎫</div>
            <div className="text-[11px] font-bold">Biglietti e Ticket</div>
          </button>
          <button type="button" className="rounded-2xl bg-[var(--color-bg)] px-2 py-3 text-center" onClick={() => { setSheetMode('list'); setListType('links') }}>
            <div className="mb-1 text-xl">🔗</div>
            <div className="text-[11px] font-bold">Link utili</div>
          </button>
          <Link to="/trip/spain/checklist" className="rounded-2xl bg-[var(--color-bg)] px-2 py-3 text-center text-[var(--color-text)]">
            <div className="mb-1 text-xl">🎒</div>
            <div className="text-[11px] font-bold">Checklist</div>
          </Link>
        </div>
      </div>

      <div className="mb-3 flex items-center rounded-[20px] border border-[var(--color-card-border)] bg-white px-2 py-4 shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
        <div className="flex-1 text-center">
          <div className="mb-2.25 text-[10px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Spese di oggi</div>
          <div className="flex justify-center gap-1.25">
            {day.expenses.map((e, i) => (
              <div key={i} className="flex h-5.5 w-5.5 items-center justify-center rounded-full text-[9.5px] font-bold text-white" style={{ background: e.color }}>{e.initial}</div>
            ))}
          </div>
        </div>
        <div className="mx-2 w-0.5 self-stretch bg-[var(--color-sand)]" />
        <div className="flex-1 text-center">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Totale</div>
          <div className="font-display text-[22px] font-bold">{expenseTotal}€</div>
        </div>
        <div className="mx-2 w-0.5 self-stretch bg-[var(--color-sand)]" />
        <div className="flex-1 text-center">
          <div className="mb-2.25 text-[10px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Aggiungi</div>
          <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#fdece0] text-lg font-bold text-[var(--color-coral)]" onClick={() => setSheetMode('addExpense')}>+</button>
        </div>
      </div>

      <div className="rounded-[20px] border border-[var(--color-card-border)] bg-white p-3.5 shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
        <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Ricordi di oggi</div>
        {isEndOfDay && (
          <div className="mb-2.5 flex items-center gap-2.5 rounded-2xl bg-[#fff4e6] p-3">
            <div className="text-xl">🌙</div>
            <div className="flex-1 text-[13px] font-bold">Com'è andata oggi?</div>
          </div>
        )}
        <div className="mb-2.5 grid grid-cols-4 gap-1.25">
          {day.memoryPhotos.map((seed, i) => (
            <div key={i} className="aspect-square rounded-lg bg-[#e8dcc3] bg-cover" style={{ backgroundImage: `url(https://picsum.photos/seed/${seed}/160/160)` }} />
          ))}
        </div>
        <Link to="/trip/spain/memories" className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-coral)]">+ Aggiungi ricordi</Link>
      </div>

      {sheetMode === 'schedule' && sheetItem && (
        <ScheduleItemSheet
          item={sheetItem}
          onClose={closeSheet}
          onSaveIcon={(text) => updateSheetItem({ icon: text })}
          onSaveName={(text) => { if (text) updateSheetItem({ label: text }) }}
          onSetTime={setScheduleTime}
          onSaveMaps={(text) => updateSheetItem({ link: text })}
          onSaveLink={(text) => updateSheetItem({ usefulLink: text })}
          onSaveBooking={(text) => updateSheetItem({ booking: text })}
          onSaveNotes={(text) => updateSheetItem({ notes: text })}
          onAddChecklistItem={() => {
            const id = 'ac' + Date.now()
            const list = [...(sheetItem.checklist || []), { id, label: 'Nuova voce', done: false }]
            updateSheetItem({ checklist: list })
            setFocusActivityChecklistId(id)
          }}
          onToggleChecklistItem={(id) => {
            const list = (sheetItem.checklist || []).map((c) => (c.id !== id ? c : { ...c, done: !c.done }))
            updateSheetItem({ checklist: list })
          }}
          onEditChecklistLabel={(id, text) => {
            const list = (sheetItem.checklist || []).map((c) => (c.id !== id ? c : { ...c, label: text || c.label }))
            updateSheetItem({ checklist: list })
          }}
          onRemoveChecklistItem={(id) => {
            const list = (sheetItem.checklist || []).filter((c) => c.id !== id)
            updateSheetItem({ checklist: list })
          }}
          focusChecklistId={focusActivityChecklistId}
        />
      )}

      {sheetMode === 'list' && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-[rgba(30,20,10,.45)]" onClick={closeSheet}>
          <div className="max-h-[85%] w-full max-w-md overflow-y-auto rounded-t-[26px] bg-[var(--color-bg)] px-4.5 pb-7 pt-4.5 shadow-[0_-20px_40px_-10px_rgba(80,50,20,.35)]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-[var(--color-sand)]" />
            <div className="mb-3 font-display text-[19px] font-bold text-[var(--color-text)]">{listTitle}</div>
            <div className="flex flex-col gap-2">
              {listItems.map((li, i) => (
                <a key={i} href={li.url} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-2xl bg-white p-3 text-[var(--color-text)]">
                  <div className="text-lg">{li.emoji}</div>
                  <div className="text-[13px] font-bold">{li.label}</div>
                </a>
              ))}
              {listItems.length === 0 && (
                <div className="py-2.5 text-center text-[12.5px] text-[var(--color-text-secondary)]">Nessun elemento per oggi.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {sheetMode === 'addExpense' && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-[rgba(30,20,10,.45)]" onClick={closeSheet}>
          <div className="w-full max-w-md rounded-t-[26px] bg-[var(--color-bg)] px-4.5 pb-7 pt-4.5 shadow-[0_-20px_40px_-10px_rgba(80,50,20,.35)]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-[var(--color-sand)]" />
            <div className="mb-1 font-display text-[19px] font-bold text-[var(--color-text)]">💶 Aggiungi spesa</div>
            <div className="mb-3 text-[12.5px] font-semibold italic text-[#8a6a3e]">Il form per aggiungere una spesa arriverà qui a breve.</div>
            <div className="rounded-2xl bg-white p-4 text-center">
              <div className="mb-2 text-[28px]">🚧</div>
              <div className="text-[12.5px] text-[#8a6a3e]">Presto potrai registrare una spesa direttamente da qui.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
