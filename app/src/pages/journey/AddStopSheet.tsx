import { useRef } from 'react'
import { BottomSheet } from '../../components/BottomSheet'
import { EditableText } from '../../components/EditableText'
import { stopMoodDefs } from './helpers'

export interface AddStopDraft {
  name: string
  startDay: number | null
  endDay: number | null
  moodId: string | null
  photo: string | null
  error: string | null
}

export function AddStopSheet({
  editing,
  draft,
  tripStartDay,
  tripEndDay,
  onChangeName,
  onSelectDay,
  onSelectMood,
  onOpenUpload,
  onSave,
  onClose,
}: {
  editing: boolean
  draft: AddStopDraft
  tripStartDay: number
  tripEndDay: number
  onChangeName: (text: string) => void
  onSelectDay: (day: number) => void
  onSelectMood: (id: string) => void
  onOpenUpload: () => void
  onSave: () => void
  onClose: () => void
}) {
  const nameRef = useRef<HTMLDivElement>(null)

  const datesLabel = draft.startDay
    ? draft.endDay && draft.endDay !== draft.startDay
      ? `${draft.startDay} → ${draft.endDay} agosto`
      : `${draft.startDay} agosto`
    : 'Scegli le date (dentro il viaggio)'

  const dayChips = Array.from({ length: tripEndDay - tripStartDay + 1 }, (_, i) => tripStartDay + i)

  const activeMood = stopMoodDefs.find((m) => m.id === draft.moodId) || stopMoodDefs[0]
  const coverPreview = draft.photo ? `url(${draft.photo}) center/cover no-repeat` : activeMood.gradient

  return (
    <BottomSheet onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <div className="font-display text-lg font-bold text-[var(--color-text)]">
          {editing ? 'Modifica tappa' : 'Nuova tappa'}
        </div>
        <button type="button" className="text-base text-[#c2a97e]" onClick={onClose}>×</button>
      </div>

      <div className="mb-2 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Nome del luogo</div>
      <EditableText
        key={editing ? draft.name : 'new'}
        ref={nameRef}
        initialText={draft.name || 'Nome del luogo'}
        className="rounded-2xl border border-[var(--color-card-border)] bg-white px-3.5 py-3 font-display text-[17px]"
        style={{ color: draft.name ? '#3a2a1c' : '#b39a78', fontWeight: draft.name ? 700 : 600 }}
        onFocus={(e) => { if (!draft.name) e.currentTarget.textContent = '' }}
        onBlurText={onChangeName}
      />

      <div className="mb-2 mt-4.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Quando</div>
      <div className="mb-2.5 text-[11.5px] font-semibold text-[#8a7256]">{datesLabel}</div>
      <div className="mb-1 flex gap-1.5 overflow-x-auto pb-1">
        {dayChips.map((day) => {
          const inRange = draft.startDay && draft.endDay && day >= draft.startDay && day <= draft.endDay
          const isEdge = day === draft.startDay || day === draft.endDay
          return (
            <button
              key={day}
              type="button"
              className="w-8 shrink-0 rounded-lg py-1.5 text-center text-xs font-bold text-[var(--color-text)]"
              style={
                isEdge
                  ? { background: '#d9481f', color: '#fff' }
                  : inRange
                    ? { background: '#fde3d0', color: '#b8703a' }
                    : { background: '#fff', border: '1px solid var(--color-card-border)' }
              }
              onClick={() => onSelectDay(day)}
            >
              {day}
            </button>
          )
        })}
      </div>

      <div className="mb-2 mt-4.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Mood</div>
      <div className="flex flex-wrap gap-2">
        {stopMoodDefs.map((m) => (
          <button
            key={m.id}
            type="button"
            className="shrink-0 whitespace-nowrap rounded-full px-3.25 py-2 text-xs font-bold"
            style={draft.moodId === m.id ? { background: '#3a2a1c', color: '#fff' } : { background: '#fff', border: '1px solid var(--color-card-border)', color: '#3a2a1c' }}
            onClick={() => onSelectMood(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mb-2 mt-4.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Copertina</div>
      <div className="mb-2 flex items-center gap-3">
        <div className="h-11 w-11 shrink-0 rounded-xl" style={{ background: coverPreview }} />
        <button type="button" className="rounded-full border border-[var(--color-card-border)] bg-white px-3.5 py-2.25 text-xs font-bold text-[var(--color-text)]" onClick={onOpenUpload}>
          📷 Carica foto
        </button>
        <div className="flex-1 text-[10.5px] font-semibold leading-snug text-[var(--color-text-secondary)]">
          Senza foto usiamo il colore del mood
        </div>
      </div>

      {draft.error && (
        <div className="mb-1 mt-2.5 text-[11.5px] font-bold text-[#a3392a]">⚠️ {draft.error}</div>
      )}

      <button type="button" className="mt-4 w-full rounded-full py-3.5 text-center text-[13.5px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#ff8a5b,#ff5f6d)' }} onClick={onSave}>
        {editing ? 'Salva modifiche' : '+ Aggiungi tappa e continua'}
      </button>
      <button type="button" className="mt-2.5 w-full text-center text-xs font-bold text-[var(--color-text-secondary)]" onClick={onClose}>
        Fatto, chiudi
      </button>
    </BottomSheet>
  )
}
