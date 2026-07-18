import type { ReactNode } from 'react'

export function BottomSheet({
  onClose,
  children,
  zIndex = 40,
}: {
  onClose: () => void
  children: ReactNode
  zIndex?: number
}) {
  return (
    <div
      className="fixed inset-0 flex items-end justify-center bg-black/60"
      style={{ zIndex }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-[var(--color-bg)] p-5 shadow-[0_-20px_50px_-20px_rgba(0,0,0,.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
