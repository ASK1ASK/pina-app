import type { RefCallback } from 'react'
import { EditableText } from '../../components/EditableText'

export function ChecklistRow({
  itemRef,
  done,
  label,
  onToggle,
  onSaveLabel,
  onDelete,
  doneColor = '#d9481f',
  catTag,
  avatarColor,
  assigneeCode,
  onCycleAssignee,
}: {
  itemRef?: RefCallback<HTMLDivElement>
  done: boolean
  label: string
  onToggle: () => void
  onSaveLabel: (text: string) => void
  onDelete?: () => void
  doneColor?: string
  catTag?: string
  avatarColor?: string
  assigneeCode?: string
  onCycleAssignee?: () => void
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-[var(--color-cream-light)] px-3.5 py-2.75 last:border-b-0">
      <button
        type="button"
        className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={done ? { background: doneColor } : { border: '2px solid var(--color-sand)' }}
        onClick={onToggle}
      >
        {done ? '✓' : ''}
      </button>
      {catTag && (
        <span className="shrink-0 whitespace-nowrap rounded-full bg-[#fdeee0] px-1.75 py-0.75 text-[10.5px] font-bold text-[#c2793a]">{catTag}</span>
      )}
      <EditableText
        ref={itemRef}
        initialText={label}
        className="min-w-0 flex-1 text-[13px] font-semibold"
        style={done ? { color: '#b7a586', textDecoration: 'line-through' } : { color: 'var(--color-text)' }}
        onBlurText={onSaveLabel}
      />
      {avatarColor && (
        <button
          type="button"
          className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ background: avatarColor }}
          onClick={onCycleAssignee}
        >
          {assigneeCode}
        </button>
      )}
      {onDelete && (
        <button type="button" className="shrink-0 text-[15px] leading-none text-[#c2a97e]" onClick={onDelete}>×</button>
      )}
    </div>
  )
}
