import { forwardRef, type CSSProperties, type FocusEvent, type KeyboardEvent } from 'react'

export const EditableText = forwardRef<
  HTMLDivElement,
  {
    initialText: string
    className?: string
    style?: CSSProperties
    onFocus?: (e: FocusEvent<HTMLDivElement>) => void
    onBlurText?: (text: string) => void
    onEnter?: () => void
  }
>(function EditableText({ initialText, className, style, onFocus, onBlurText, onEnter }, ref) {
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={className}
      style={{ outline: 'none', cursor: 'text', ...style }}
      onFocus={onFocus}
      onBlur={(e) => onBlurText?.(e.currentTarget.textContent?.trim() || '')}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (onEnter && e.key === 'Enter') {
          e.preventDefault()
          onEnter()
        }
      }}
    >
      {initialText}
    </div>
  )
})
