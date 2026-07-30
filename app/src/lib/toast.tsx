import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

// Prima di questo, quando una chiamata al server falliva l'errore finiva solo
// in console: per chi usa l'app sembrava semplicemente che il tocco non avesse
// fatto nulla. Qui c'e' un punto unico per dirlo, con un messaggio in italiano
// comprensibile, tenendo comunque il dettaglio tecnico nella console.

type Tone = 'error' | 'success'

interface Toast {
  id: number
  message: string
  tone: Tone
}

interface ToastApi {
  /** Messaggio di errore per l'utente; `cause` finisce in console per il debug. */
  showError: (message: string, cause?: unknown) => void
  showSuccess: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast va usato dentro <ToastProvider>')
  return ctx
}

const VISIBLE_MS = 5000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (message: string, tone: Tone) => {
      const id = Date.now() + Math.random()
      setToasts((list) => [...list, { id, message, tone }])
      window.setTimeout(() => dismiss(id), VISIBLE_MS)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      showError: (message, cause) => {
        if (cause !== undefined) console.error(message, cause)
        push(message, 'error')
      },
      showSuccess: (message) => push(message, 'success'),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-50 mx-auto flex max-w-md flex-col gap-2 px-4"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      >
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            className="pointer-events-auto flex w-full items-start gap-2.5 rounded-2xl px-4 py-3 text-left text-[12.5px] font-bold leading-snug text-white shadow-[0_14px_30px_-12px_rgba(0,0,0,.45)] animate-toast-in"
            style={{ background: t.tone === 'error' ? '#c2445a' : '#3f8f5f' }}
            onClick={() => dismiss(t.id)}
          >
            <span className="shrink-0 text-sm">{t.tone === 'error' ? '⚠️' : '✓'}</span>
            <span className="flex-1">{t.message}</span>
            <span className="shrink-0 text-white/60">×</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
