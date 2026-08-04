import { useRef } from 'react'
import { isDocumentUrl } from '../lib/mediaUpload'

// Allegare e riaprire un documento: stesso comando negli Essentials e sotto
// l'alloggio di una tappa. Tenuto in un posto solo perche' sono due punti che
// devono comportarsi allo stesso modo — soprattutto la dimensione del
// bersaglio, che prima era 10px e si prendeva solo per fortuna.

/** Il minimo per un dito su un telefono. */
const ALTEZZA_TOCCO = 'h-11'

/** Che tipo di documento e', da scrivere sull'anteprima: "PDF", "DOCX", ... */
function etichettaDocumento(url: string): string {
  if (url.startsWith('data:')) return url.startsWith('data:application/pdf') ? 'PDF' : 'FILE'
  const estensione = url.split('?')[0].split('.').pop()?.toUpperCase() ?? ''
  return estensione && estensione.length <= 4 ? estensione : 'FILE'
}

export function AttachmentControl({
  attachment,
  link,
  uploading,
  etichettaVuoto = '📎 QR/PDF',
  onAttach,
  onRemove,
}: {
  /** Il valore salvato: percorso nel magazzino o vecchio allegato come testo. */
  attachment: string | null | undefined
  /** L'indirizzo con cui aprirlo davvero; vuoto se la firma non e' ancora arrivata. */
  link: string
  uploading: boolean
  etichettaVuoto?: string
  onAttach: (file: File) => void
  onRemove: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  const input = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*,application/pdf"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0]
        if (f) onAttach(f)
        e.target.value = ''
      }}
    />
  )

  if (!attachment) {
    return (
      <>
        <button
          type="button"
          disabled={uploading}
          className={`flex ${ALTEZZA_TOCCO} shrink-0 items-center rounded-xl border border-dashed border-[var(--color-sand)] px-3 text-[11px] font-bold text-[var(--color-add-text)] disabled:opacity-60`}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? 'Carico…' : etichettaVuoto}
        </button>
        {input}
      </>
    )
  }

  // Un PDF non puo' essere disegnato come immagine di sfondo: veniva fuori un
  // quadratino grigio vuoto mentre il pulsante prometteva "QR/PDF".
  const documento = isDocumentUrl(attachment)

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        aria-label={documento ? 'Apri il documento allegato' : 'Apri l’immagine allegata'}
        title={link ? undefined : 'Sto preparando l’allegato...'}
        disabled={!link}
        className={`flex ${ALTEZZA_TOCCO} items-center gap-1.5 rounded-xl border border-[var(--color-card-border)] bg-white px-2 disabled:opacity-50`}
        onClick={() => link && window.open(link, '_blank', 'noopener')}
      >
        {documento ? (
          <>
            <span className="text-base leading-none">📄</span>
            <span className="text-[9.5px] font-bold tracking-wide text-[var(--color-add-text)]">
              {etichettaDocumento(attachment)}
            </span>
          </>
        ) : link ? (
          <span className="h-8 w-8 rounded-md bg-cover bg-center" style={{ backgroundImage: `url(${link})` }} />
        ) : (
          <span className="h-8 w-8 rounded-md bg-[var(--color-sand)]" />
        )}
      </button>
      <button
        type="button"
        aria-label="Togli l’allegato"
        className={`flex ${ALTEZZA_TOCCO} w-7 items-center justify-center text-sm text-[#c2a97e]`}
        onClick={onRemove}
      >
        ×
      </button>
      {input}
    </div>
  )
}
