import { useEffect, useRef } from 'react'
import { EditableText } from '../../components/EditableText'
import type { StarredItemForDay } from '../../lib/tripData'
import { mealPresets } from './data'

function FieldBox({
  label,
  value,
  placeholder,
  onSave,
  mono,
}: {
  label: string
  value: string
  placeholder: string
  onSave: (text: string) => void
  mono?: boolean
}) {
  const filled = !!value
  return (
    <div className="rounded-2xl border border-[var(--color-card-border)] bg-white px-3 py-2.5">
      <div className="mb-1 text-[10.5px] font-bold text-[var(--color-eyebrow)]">{label}</div>
      <EditableText
        key={value}
        initialText={value || placeholder}
        className={`text-[11.5px] font-semibold ${mono ? 'font-mono' : ''}`}
        style={{ color: filled ? '#3a2a1c' : '#b39a78', fontStyle: filled ? 'normal' : 'italic' }}
        onFocus={(e) => { if (!filled) e.currentTarget.textContent = '' }}
        onBlurText={onSave}
      />
    </div>
  )
}

export function ScheduleItemSheet({
  item,
  onClose,
  onSaveIcon,
  onSaveName,
  onSetTime,
  onSaveMaps,
  onSaveLink,
  onSaveBooking,
  onSaveNotes,
  onAddChecklistItem,
  onToggleChecklistItem,
  onEditChecklistLabel,
  onRemoveChecklistItem,
  focusChecklistId,
}: {
  item: StarredItemForDay
  onClose: () => void
  onSaveIcon: (text: string) => void
  onSaveName: (text: string) => void
  onSetTime: (time: string) => void
  onSaveMaps: (text: string) => void
  onSaveLink: (text: string) => void
  onSaveBooking: (text: string) => void
  onSaveNotes: (text: string) => void
  onAddChecklistItem: () => void
  onToggleChecklistItem: (id: string) => void
  onEditChecklistLabel: (id: string, text: string) => void
  onRemoveChecklistItem: (id: string) => void
  focusChecklistId: string | null
}) {
  const checklistRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (!focusChecklistId) return
    const el = checklistRefs.current[focusChecklistId]
    if (!el) return
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, [focusChecklistId])

  const icon = item.icon || item.catIcon || '📌'

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-[rgba(30,20,10,.45)]" onClick={onClose}>
      <div className="max-h-[85%] w-full max-w-md overflow-y-auto rounded-t-[26px] bg-[var(--color-bg)] px-4.5 pb-7 pt-4.5 shadow-[0_-20px_40px_-10px_rgba(80,50,20,.35)]" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-[var(--color-sand)]" />
        <div className="mb-1 font-display text-[19px] font-bold text-[var(--color-text)]">{icon} {item.label}</div>

        <div className="mt-1.5 flex gap-2">
          <EditableText
            key={'icon-' + item.id}
            initialText={icon}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--color-card-border)] bg-white text-xl"
            onBlurText={onSaveIcon}
          />
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Nome dell'evento</div>
            <EditableText
              key={'name-' + item.id}
              initialText={item.label}
              className="rounded-xl border border-[var(--color-card-border)] bg-white px-3 py-2.5 text-sm font-bold text-[var(--color-text)]"
              onBlurText={onSaveName}
            />
          </div>
        </div>

        <div className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Orario</div>
        <input
          type="time"
          defaultValue={item.time}
          onChange={(e) => onSetTime(e.target.value)}
          className="mb-2.5 w-full rounded-[10px] border border-[var(--color-card-border)] bg-white px-2.5 py-2 text-[12.5px] font-bold text-[var(--color-text)]"
        />
        <div className="mb-4.5 flex flex-wrap gap-1.5">
          {mealPresets.map((p) => (
            <button
              key={p.label}
              type="button"
              className="whitespace-nowrap rounded-full px-3.25 py-1.75 text-[11.5px] font-bold"
              style={item.time === p.time ? { background: '#3a2a1c', color: '#fff' } : { background: '#fff', border: '1px solid var(--color-card-border)', color: '#3a2a1c' }}
              onClick={() => onSetTime(p.time)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mb-3.5 grid grid-cols-2 gap-2">
          <FieldBox label="📍 Maps" value={item.link} placeholder="Aggiungi link Maps" onSave={onSaveMaps} />
          <FieldBox label="🔗 Link" value={item.usefulLink} placeholder="Aggiungi link" onSave={onSaveLink} />
        </div>

        <div className="mb-3.5">
          <FieldBox label="🎫 Prenotazione" value={item.booking} placeholder="Aggiungi riferimento prenotazione" onSave={onSaveBooking} />
        </div>

        <div className="mb-1.5 flex items-center justify-between">
          <div className="text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Checklist attività</div>
          <button type="button" className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-card-border)] bg-white text-[13px] font-bold text-[var(--color-coral)]" onClick={onAddChecklistItem}>+</button>
        </div>
        <div className="mb-3.5 rounded-2xl border border-[var(--color-card-border)] bg-white px-3 py-2.5">
          {item.checklist.length === 0 ? (
            <div className="text-[11.5px] italic text-[var(--color-eyebrow)]">Nessuna voce. Aggiungine una con +.</div>
          ) : (
            <div className="flex flex-col gap-2.25">
              {item.checklist.map((c) => (
                <div key={c.id} className="flex items-center gap-2.25">
                  <button
                    type="button"
                    className="flex h-4.75 w-4.75 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white"
                    style={c.done ? { background: '#7a9d54' } : { background: 'var(--color-bg)', border: '1.5px solid var(--color-sand)' }}
                    onClick={() => onToggleChecklistItem(c.id)}
                  >
                    {c.done ? '✓' : ''}
                  </button>
                  <EditableText
                    ref={(el) => { checklistRefs.current[c.id] = el }}
                    initialText={c.label}
                    className="min-w-0 flex-1 text-[13px] font-semibold"
                    style={c.done ? { color: 'var(--color-text-secondary)', textDecoration: 'line-through' } : { color: 'var(--color-text)' }}
                    onBlurText={(text) => onEditChecklistLabel(c.id, text)}
                  />
                  <button type="button" className="shrink-0 text-[15px] text-[#c2a97e]" onClick={() => onRemoveChecklistItem(c.id)}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Note</div>
        <EditableText
          key={'notes-' + item.id}
          initialText={item.notes || 'Aggiungi una nota'}
          className="block min-h-14 rounded-2xl border border-[var(--color-card-border)] bg-white p-3 text-[11.5px] font-semibold"
          style={{ color: item.notes ? '#3a2a1c' : '#b39a78', fontStyle: item.notes ? 'normal' : 'italic' }}
          onFocus={(e) => { if (!item.notes) e.currentTarget.textContent = '' }}
          onBlurText={onSaveNotes}
        />
      </div>
    </div>
  )
}
