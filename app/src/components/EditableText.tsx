import { forwardRef, type CSSProperties, type FocusEvent, type KeyboardEvent } from 'react'

export const EditableText = forwardRef<
  HTMLDivElement,
  {
    initialText: string
    className?: string
    style?: CSSProperties
    /**
     * L'invito da mostrare quando il campo e' vuoto.
     *
     * Non e' contenuto: e' disegnato dal CSS (`[data-placeholder]:empty::before`
     * in index.css) e non finisce mai in quello che viene salvato. Prima l'invito
     * era scritto dentro il campo come testo vero, e andava cancellato a mano
     * prima di poter scrivere il proprio — vedi COLLAUDO #19 e #27.
     */
    placeholder?: string
    /**
     * Che tastiera far uscire sul telefono. `url` per i campi che aspettano un
     * indirizzo: mette "/" e ".com" sotto il dito ed evita la maiuscola
     * automatica a inizio riga.
     */
    inputMode?: 'text' | 'url' | 'email' | 'numeric' | 'tel'
    onFocus?: (e: FocusEvent<HTMLDivElement>) => void
    onBlurText?: (text: string) => void
    onEnter?: () => void
  }
>(function EditableText({ initialText, className, style, placeholder, inputMode, onFocus, onBlurText, onEnter }, ref) {
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={className}
      style={{ outline: 'none', cursor: 'text', ...style }}
      data-placeholder={placeholder}
      inputMode={inputMode}
      // Su un campo che aspetta un indirizzo, il telefono non deve
      // "correggere" quello che si incolla ne' metterci la maiuscola.
      autoCorrect={inputMode === 'url' ? 'off' : undefined}
      autoCapitalize={inputMode === 'url' ? 'none' : undefined}
      spellCheck={inputMode === 'url' ? false : undefined}
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
