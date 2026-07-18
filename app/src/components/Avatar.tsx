const AVATAR_COLORS = [
  'var(--color-avatar-1)',
  'var(--color-avatar-2)',
  'var(--color-avatar-3)',
  'var(--color-avatar-4)',
  'var(--color-avatar-5)',
]

export function colorForPerson(personId: string) {
  let hash = 0
  for (let i = 0; i < personId.length; i++) {
    hash = (hash * 31 + personId.charCodeAt(i)) >>> 0
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export function Avatar({
  personId,
  initial,
  size = 22,
}: {
  personId: string
  initial: string
  size?: number
}) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold text-white shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: colorForPerson(personId),
      }}
    >
      {initial}
    </div>
  )
}
