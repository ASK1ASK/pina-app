import { useRef } from 'react'
import { BottomSheet } from './BottomSheet'
import { coverPaletteDefs, type CoverColorId } from '../lib/palette'

export function ColorPickerSheet({
  selectedId,
  onSelect,
  onOpenUpload,
  onClose,
}: {
  selectedId: string
  onSelect: (id: CoverColorId) => void
  onOpenUpload: () => void
  onClose: () => void
}) {
  return (
    <BottomSheet onClose={onClose}>
      <div className="mb-4 font-display text-[17px] font-bold text-[var(--color-text)]">Scegli un colore</div>
      <div className="grid grid-cols-5 gap-3">
        {coverPaletteDefs.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-label={p.id}
            className="aspect-square w-full rounded-full"
            style={{
              background: p.gradient,
              boxShadow: selectedId === p.id ? '0 0 0 3px var(--color-bg), 0 0 0 5px #3a2a1c' : undefined,
            }}
            onClick={() => onSelect(p.id)}
          />
        ))}
        <button
          type="button"
          className="aspect-square w-full rounded-full border-[1.5px] border-dashed border-[var(--color-add-border)] bg-white text-lg font-bold text-[var(--color-add-text)]"
          onClick={onOpenUpload}
        >
          +
        </button>
      </div>
    </BottomSheet>
  )
}

export function UploadMenuSheet({
  onPickCamera,
  onPickLibrary,
  onPickFile,
  onClose,
}: {
  onPickCamera: (file: File) => void
  onPickLibrary: (file: File) => void
  onPickFile: (file: File) => void
  onClose: () => void
}) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <BottomSheet onClose={onClose} zIndex={41}>
      <div className="mb-3.5 font-display text-base font-bold text-[var(--color-text)]">Carica una copertina</div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-2xl border border-[var(--color-card-border)] bg-white px-3.5 py-3.5 text-left"
          onClick={() => cameraRef.current?.click()}
        >
          <span className="text-base">📷</span>
          <span className="text-[13px] font-bold text-[var(--color-text)]">Scatta foto</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-2xl border border-[var(--color-card-border)] bg-white px-3.5 py-3.5 text-left"
          onClick={() => libraryRef.current?.click()}
        >
          <span className="text-base">🖼</span>
          <span className="text-[13px] font-bold text-[var(--color-text)]">Carica dalla libreria</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-2xl border border-[var(--color-card-border)] bg-white px-3.5 py-3.5 text-left"
          onClick={() => fileRef.current?.click()}
        >
          <span className="text-base">📁</span>
          <span className="text-[13px] font-bold text-[var(--color-text)]">Carica da file</span>
        </button>
      </div>
      <button
        type="button"
        className="mt-3.5 w-full text-center text-xs font-bold text-[var(--color-text-secondary)]"
        onClick={onClose}
      >
        Annulla
      </button>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onPickCamera(file)
          e.target.value = ''
        }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onPickLibrary(file)
          e.target.value = ''
        }}
      />
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onPickFile(file)
          e.target.value = ''
        }}
      />
    </BottomSheet>
  )
}
