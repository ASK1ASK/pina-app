export function PagePlaceholder({ title, emoji }: { title: string; emoji: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 pt-24 text-center">
      <div
        className="mb-3 flex h-16 w-16 items-center justify-center rounded-full text-2xl"
        style={{
          background:
            'repeating-linear-gradient(45deg, #ffe6cf, #ffe6cf 6px, #fff1e0 6px, #fff1e0 12px)',
        }}
      >
        {emoji}
      </div>
      <h1 className="font-display text-lg font-semibold text-[var(--color-text)]">{title}</h1>
      <p className="mt-1 text-xs font-semibold text-[var(--color-text-secondary)]">
        Da ricreare a partire dal design di riferimento
      </p>
    </div>
  )
}
