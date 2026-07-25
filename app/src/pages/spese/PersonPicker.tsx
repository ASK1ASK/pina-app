export interface PickablePerson {
  id: string
  name: string
  color: string
  initial: string
}

export function PersonPicker({
  members,
  isSelected,
  onClick,
}: {
  members: PickablePerson[]
  isSelected: (id: string) => boolean
  onClick: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {members.map((person) => {
        const selected = isSelected(person.id)
        return (
          <button
            key={person.id}
            type="button"
            className="flex w-13 flex-col items-center"
            style={{ opacity: selected ? 1 : 0.5 }}
            onClick={() => onClick(person.id)}
          >
            <div
              className="flex h-8.5 w-8.5 items-center justify-center rounded-full text-[13px] font-bold text-white"
              style={{ background: person.color, boxShadow: selected ? '0 0 0 3px var(--color-bg), 0 0 0 5px #3a2a1c' : undefined }}
            >
              {person.initial}
            </div>
            <div className="mt-0.75 text-[9.5px] font-bold text-[#8a7256]">{person.name}</div>
          </button>
        )
      })}
    </div>
  )
}
