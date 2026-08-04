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

/**
 * Il tondo con l'iniziale.
 *
 * `color` va passato quando la persona un colore ce l'ha davvero: dentro un
 * viaggio e' quello scelto nella crew (trip_members.color), e deve essere lo
 * stesso che vedono gli altri. Quando manca — sulla Home, dove un viaggio non
 * c'e' — si ricade su un colore calcolato dall'id: sempre lo stesso per la
 * stessa persona, e non c'e' niente da salvare da nessuna parte.
 */
export function Avatar({
  personId,
  initial,
  size = 22,
  color,
}: {
  personId: string
  initial: string
  size?: number
  color?: string
}) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold text-white shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: color || colorForPerson(personId),
      }}
    >
      {initial}
    </div>
  )
}
