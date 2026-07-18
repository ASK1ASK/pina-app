import { useRef } from 'react'
import { EditableText } from '../../components/EditableText'
import { stopNights, type Stop } from '../../lib/tripData'

function DaySquares({
  days,
  activeDay,
  onSelect,
}: {
  days: number[]
  activeDay: number
  onSelect: (day: number) => void
}) {
  if (days.length <= 1) return null
  return (
    <div className="flex shrink-0 gap-1.25">
      {[...days].reverse().map((day) => (
        <button
          key={day}
          type="button"
          className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-[7px] text-[11px] font-bold"
          style={day === activeDay ? { background: '#3a2a1c', color: '#fff' } : { background: 'var(--color-bg)', border: '1px solid var(--color-card-border)', color: '#a9906f' }}
          onClick={() => onSelect(day)}
        >
          {day}
        </button>
      ))}
    </div>
  )
}

export function StopDetailSheet({
  stop,
  onClose,
  onOpenSettings,
  activeStayDay,
  onSelectStayDay,
  onSaveStayName,
  onSaveStayLink,
  onAddStay,
  onRemoveStay,
  linkEditKey,
  onToggleLinkEdit,
  activeDayByCategory,
  onSelectCategoryDay,
  onToggleStar,
  onSaveItemLabel,
  onSaveItemLink,
  onRemoveItem,
  onAddItem,
  addingCategoryFor,
  onStartAddCategory,
  onAddCategory,
}: {
  stop: Stop
  onClose: () => void
  onOpenSettings: () => void
  activeStayDay: number | undefined
  onSelectStayDay: (day: number) => void
  onSaveStayName: (stayId: string, text: string) => void
  onSaveStayLink: (stayId: string, text: string) => void
  onAddStay: () => void
  onRemoveStay: (stayId: string) => void
  linkEditKey: string | null
  onToggleLinkEdit: (key: string | null) => void
  activeDayByCategory: Record<string, number>
  onSelectCategoryDay: (catId: string, day: number) => void
  onToggleStar: (catId: string, itemId: string) => void
  onSaveItemLabel: (catId: string, itemId: string, text: string) => void
  onSaveItemLink: (catId: string, itemId: string, text: string) => void
  onRemoveItem: (catId: string, itemId: string) => void
  onAddItem: (catId: string, text: string) => void
  addingCategoryFor: boolean
  onStartAddCategory: () => void
  onAddCategory: (text: string) => void
}) {
  const newItemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const newCategoryRef = useRef<HTMLDivElement>(null)

  const nights = stopNights(stop)
  const multiDay = nights.length > 1
  const stayActiveDay = activeStayDay ?? nights[nights.length - 1]
  const gradient = stop.gradient || 'linear-gradient(135deg,#ffb627,#ff8a5b)'
  const bg = stop.photo ? `url(${stop.photo}) center/cover no-repeat` : gradient

  const stays = (stop.stays || []).filter((s) => !multiDay || !s.day || s.day === stayActiveDay)

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="max-h-[85%] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[var(--color-bg)] shadow-[0_-20px_50px_-20px_rgba(0,0,0,.4)]" onClick={(e) => e.stopPropagation()}>
        <div className="relative h-35 overflow-hidden rounded-t-3xl" style={{ background: bg }}>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,transparent,rgba(20,12,8,.75))' }} />
          <button type="button" className="absolute right-3.5 top-3 text-lg text-white" onClick={onClose}>×</button>
          <button type="button" className="absolute right-11 top-3 flex h-7.5 w-7.5 items-center justify-center rounded-full border border-white/40 bg-white/22 text-sm text-white" onClick={onOpenSettings}>⚙️</button>
          <div className="absolute bottom-3 left-4.5 right-4.5 text-white">
            <div className="font-display text-xl font-bold">{stop.name}</div>
            <div className="text-[11.5px] font-semibold text-white/85">{stop.moodLine} · {stop.dates}</div>
          </div>
        </div>

        <div className="px-4.5 pb-6 pt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">🏨 Dove soggiornerete</div>
            <DaySquares days={nights} activeDay={stayActiveDay} onSelect={onSelectStayDay} />
          </div>
          {stays.map((stay) => {
            const key = 'stay:' + stay.id
            const editing = linkEditKey === key
            return (
              <div key={stay.id} className="mb-2.5 flex items-start gap-2">
                <div className="flex-1 rounded-2xl border border-[var(--color-card-border)] bg-white px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <EditableText
                      key={stay.id + stay.name}
                      initialText={stay.name || 'Nome del B&B/hotel/appartamento'}
                      className="flex-1 text-[13.5px] font-bold"
                      style={{ color: stay.name ? '#3a2a1c' : '#b39a78' }}
                      onFocus={(e) => { if (e.currentTarget.textContent?.trim() === 'Nome del B&B/hotel/appartamento') e.currentTarget.textContent = '' }}
                      onBlurText={(text) => onSaveStayName(stay.id, text)}
                    />
                    {stays.length > 1 && (
                      <button type="button" className="shrink-0 text-sm text-[#c2a97e]" onClick={() => onRemoveStay(stay.id)}>×</button>
                    )}
                  </div>
                  {!editing && stay.link && (
                    <a href={stay.link} target="_blank" rel="noreferrer" className="mt-0.5 block text-[11.5px] font-semibold text-[#8a6a3e] underline">🔗 Apri link</a>
                  )}
                  {editing && (
                    <EditableText
                      key={stay.id + 'link'}
                      initialText={stay.link || ''}
                      className="mt-1.5 border-b-[1.5px] border-[#ffb627] pb-0.5 text-[11.5px] font-semibold text-[var(--color-text)]"
                      onBlurText={(text) => { onSaveStayLink(stay.id, text); onToggleLinkEdit(null) }}
                    />
                  )}
                </div>
                <button type="button" className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full border border-[var(--color-card-border)] bg-white text-[13px] text-[var(--color-text)]" onClick={() => onToggleLinkEdit(editing ? null : key)}>📎</button>
              </div>
            )
          })}
          {multiDay ? (
            <button type="button" className="mb-5.5 w-full rounded-xl border-[1.5px] border-dashed border-[var(--color-add-border)] py-2 text-center text-[11.5px] font-bold text-[var(--color-add-text)]" onClick={onAddStay}>
              + Aggiungi un altro alloggio
            </button>
          ) : (
            <div className="mb-5.5" />
          )}

          {(stop.categories || []).map((cat) => {
            const catActiveDay = activeDayByCategory[cat.id] ?? nights[nights.length - 1]
            const items = (cat.items || []).filter((it) => !multiDay || !it.day || it.day === catActiveDay)
            const refKey = stop.id + ':' + cat.id
            return (
              <div key={cat.id} className="mb-5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">{cat.icon} {cat.label}</div>
                  <DaySquares days={nights} activeDay={catActiveDay} onSelect={(day) => onSelectCategoryDay(cat.id, day)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  {items.map((it) => {
                    const key = 'item:' + cat.id + ':' + it.id
                    const editing = linkEditKey === key
                    return (
                      <div key={it.id} className="flex items-start gap-2">
                        <div className="flex-1 rounded-xl border border-[var(--color-card-border)] bg-white px-2.75 py-2.25">
                          <div className="flex items-center gap-2">
                            <button type="button" className="shrink-0 text-sm" onClick={() => onToggleStar(cat.id, it.id)}>{it.starred ? '⭐' : '☆'}</button>
                            <EditableText
                              key={it.id + it.label}
                              initialText={it.label}
                              className="flex-1 text-[12.5px] font-semibold text-[var(--color-text)]"
                              onBlurText={(text) => onSaveItemLabel(cat.id, it.id, text)}
                            />
                            <button type="button" className="shrink-0 text-[13px] text-[#c2a97e]" onClick={() => onRemoveItem(cat.id, it.id)}>×</button>
                          </div>
                          {!editing && it.link && (
                            <a href={it.link} target="_blank" rel="noreferrer" className="mt-1 block pl-5.75 text-[11px] font-semibold text-[#8a6a3e] underline">🔗 Apri link</a>
                          )}
                          {editing && (
                            <EditableText
                              key={it.id + 'link'}
                              initialText={it.link || ''}
                              className="mt-1 border-b-[1.5px] border-[#ffb627] pb-0.5 pl-5.75 text-[11px] font-semibold text-[var(--color-text)]"
                              onBlurText={(text) => { onSaveItemLink(cat.id, it.id, text); onToggleLinkEdit(null) }}
                            />
                          )}
                        </div>
                        <button type="button" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--color-card-border)] bg-white text-xs text-[var(--color-text)]" onClick={() => onToggleLinkEdit(editing ? null : key)}>📎</button>
                      </div>
                    )
                  })}
                  <div className="flex items-center gap-2">
                    <EditableText
                      ref={(el) => { newItemRefs.current[refKey] = el }}
                      initialText=""
                      className="flex-1 rounded-full border-[1.5px] border-dashed border-[var(--color-add-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-text)]"
                      onEnter={() => {
                        const el = newItemRefs.current[refKey]
                        const text = el?.textContent?.trim() ?? ''
                        if (text) { onAddItem(cat.id, text); if (el) el.textContent = '' }
                      }}
                    />
                    <button
                      type="button"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-text-strong)] text-sm text-white"
                      onClick={() => {
                        const el = newItemRefs.current[refKey]
                        const text = el?.textContent?.trim() ?? ''
                        if (text) { onAddItem(cat.id, text); if (el) el.textContent = '' }
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {!addingCategoryFor ? (
            <button type="button" className="w-full rounded-2xl border-[1.5px] border-dashed border-[var(--color-add-border)] py-2.5 text-center text-xs font-bold text-[var(--color-add-text)]" onClick={onStartAddCategory}>
              + Nuova sezione
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <EditableText
                ref={newCategoryRef}
                initialText="🎁 emoji + nome sezione"
                className="flex-1 rounded-full border-[1.5px] border-dashed border-[var(--color-add-border)] px-3.5 py-2.25 text-xs font-semibold italic text-[var(--color-text-secondary)]"
                onFocus={(e) => { if (e.currentTarget.textContent?.trim() === '🎁 emoji + nome sezione') e.currentTarget.textContent = '' }}
                onEnter={() => {
                  const el = newCategoryRef.current
                  let text = el?.textContent?.trim() ?? ''
                  if (text === '🎁 emoji + nome sezione') text = ''
                  onAddCategory(text)
                }}
              />
              <button
                type="button"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-text-strong)] text-base text-white"
                onClick={() => {
                  const el = newCategoryRef.current
                  let text = el?.textContent?.trim() ?? ''
                  if (text === '🎁 emoji + nome sezione') text = ''
                  onAddCategory(text)
                }}
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
