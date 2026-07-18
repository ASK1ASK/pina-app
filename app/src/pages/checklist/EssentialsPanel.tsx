import { useRef } from 'react'
import { EditableText } from '../../components/EditableText'
import type { EssentialsCategory, EssentialsEntry } from '../../lib/tripData'

function EntryRow({
  entry,
  onSaveTitle,
  onSaveSubtitle,
  onSaveHref,
  onAttach,
  onRemoveAttachment,
  onDelete,
}: {
  entry: EssentialsEntry
  onSaveTitle: (text: string) => void
  onSaveSubtitle: (text: string) => void
  onSaveHref: (text: string) => void
  onAttach: (file: File) => void
  onRemoveAttachment: () => void
  onDelete: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const hrefDisplay = entry.href || 'Aggiungi link (tocca)'

  return (
    <div className="flex items-center gap-2 border-b border-dashed border-[var(--color-card-border)] pb-2.25 last:border-b-0">
      <div className="min-w-0 flex-1">
        <EditableText
          key={'t' + entry.title}
          initialText={entry.title}
          className="text-[12.5px] font-bold"
          onBlurText={onSaveTitle}
        />
        <EditableText
          key={'s' + entry.subtitle}
          initialText={entry.subtitle}
          className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]"
          onBlurText={onSaveSubtitle}
        />
        <div className="mt-1.25 flex items-center gap-1.5">
          <EditableText
            key={'h' + entry.href}
            initialText={hrefDisplay ? `🔗 ${hrefDisplay}` : '🔗'}
            className="flex-1 text-[10.5px] text-[#2a8fd8]"
            onBlurText={(text) => onSaveHref(text.replace(/^🔗\s*/, ''))}
          />
          {entry.attachment ? (
            <>
              <button
                type="button"
                className="h-6 w-6 shrink-0 rounded-md bg-cover bg-center"
                style={{ backgroundImage: `url(${entry.attachment})` }}
                onClick={() => window.open(entry.attachment as string, '_blank')}
              />
              <button type="button" className="shrink-0 text-xs text-[#c2a97e]" onClick={onRemoveAttachment}>×</button>
            </>
          ) : (
            <button
              type="button"
              className="shrink-0 rounded-lg border border-dashed border-[var(--color-sand)] px-1.5 py-0.75 text-[10px] font-bold text-[var(--color-add-text)]"
              onClick={() => fileRef.current?.click()}
            >
              📎 QR/PDF
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onAttach(f); e.target.value = '' }}
          />
        </div>
      </div>
      {entry.tag && <span className="shrink-0 text-[10.5px] font-bold text-[var(--color-coral)]">{entry.tag}</span>}
      {entry.href && (
        <button type="button" className="shrink-0 text-sm" onClick={() => window.open(entry.href, '_blank')}>↗</button>
      )}
      <button type="button" className="shrink-0 text-sm text-[#c2a97e]" onClick={onDelete}>×</button>
    </div>
  )
}

export function EssentialsPanel({
  categories,
  activeId,
  onSetActive,
  onSaveField,
  onAttach,
  onRemoveAttachment,
  onDeleteEntry,
  onAddEntry,
}: {
  categories: EssentialsCategory[]
  activeId: string | null
  onSetActive: (id: string) => void
  onSaveField: (catId: string, entryId: string, field: 'title' | 'subtitle' | 'href', text: string) => void
  onAttach: (catId: string, entryId: string, file: File) => void
  onRemoveAttachment: (catId: string, entryId: string) => void
  onDeleteEntry: (catId: string, entryId: string) => void
  onAddEntry: (catId: string) => void
}) {
  const active = categories.find((c) => c.id === activeId)

  return (
    <>
      <div className="mb-3.5 grid grid-cols-2 gap-2.5">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className="rounded-[20px] bg-white p-3.5 text-left shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]"
            style={{ border: activeId === cat.id ? '1.5px solid #2a8fd8' : '1px solid var(--color-card-border)' }}
            onClick={() => onSetActive(cat.id)}
          >
            <div className="mb-1.5 text-2xl">{cat.emoji}</div>
            <div className="mb-0.5 font-display text-sm font-semibold">{cat.name}</div>
            <div className="text-[11px] font-semibold text-[var(--color-text-secondary)]">{cat.entries.length} salvati</div>
          </button>
        ))}
      </div>

      {active && (
        <div className="mb-4.5 overflow-hidden rounded-[22px] shadow-[0_12px_26px_-16px_rgba(120,90,40,.35)]">
          <div className="flex items-center gap-2.5 px-4 py-4 text-white" style={{ background: active.gradient }}>
            <span className="text-xl">{active.emoji}</span>
            <span className="flex-1 font-display text-base font-semibold">{active.name}</span>
            <button type="button" className="flex h-6.5 w-6.5 items-center justify-center rounded-full bg-white/25 text-sm text-white" onClick={() => onSetActive(active.id)}>✕</button>
          </div>
          <div className="flex flex-col gap-2.5 bg-white px-4 py-3.5">
            {active.entries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                onSaveTitle={(text) => onSaveField(active.id, entry.id, 'title', text)}
                onSaveSubtitle={(text) => onSaveField(active.id, entry.id, 'subtitle', text)}
                onSaveHref={(text) => onSaveField(active.id, entry.id, 'href', text)}
                onAttach={(file) => onAttach(active.id, entry.id, file)}
                onRemoveAttachment={() => onRemoveAttachment(active.id, entry.id)}
                onDelete={() => onDeleteEntry(active.id, entry.id)}
              />
            ))}
            <button
              type="button"
              className="rounded-xl border-[1.5px] border-dashed border-[var(--color-add-border)] py-2.25 text-center text-xs font-bold text-[var(--color-add-text)]"
              onClick={() => onAddEntry(active.id)}
            >
              + Aggiungi voce
            </button>
          </div>
        </div>
      )}
    </>
  )
}
