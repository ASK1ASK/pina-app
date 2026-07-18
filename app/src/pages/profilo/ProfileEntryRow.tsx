import { EditableText } from '../../components/EditableText'

export function ProfileEntryRow({
  title,
  subtitle,
  href,
  masked,
  revealed,
  onSaveTitle,
  onSaveSubtitle,
  onToggleReveal,
  onDelete,
}: {
  title: string
  subtitle: string
  href?: string
  masked?: boolean
  revealed?: boolean
  onSaveTitle: (text: string) => void
  onSaveSubtitle: (text: string) => void
  onToggleReveal?: () => void
  onDelete: () => void
}) {
  const displaySubtitle = masked && !revealed ? '••••••' : subtitle

  return (
    <div className="flex items-center gap-2 border-b border-dashed border-[var(--color-card-border)] pb-2.25 last:border-b-0">
      <div className="min-w-0 flex-1">
        <EditableText key={'t' + title} initialText={title} className="text-[12.5px] font-bold" onBlurText={onSaveTitle} />
        <EditableText key={'s' + displaySubtitle} initialText={displaySubtitle} className="mt-0.25 text-[11px] text-[var(--color-text-secondary)]" onBlurText={onSaveSubtitle} />
      </div>
      {masked && (
        <button type="button" className="shrink-0 text-[13px]" onClick={onToggleReveal}>{revealed ? '🙈' : '👁'}</button>
      )}
      {href && (
        <button type="button" className="shrink-0 text-sm" onClick={() => window.open(href, '_blank')}>↗</button>
      )}
      <button type="button" className="shrink-0 text-sm text-[#c2a97e]" onClick={onDelete}>×</button>
    </div>
  )
}
