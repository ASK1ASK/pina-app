import { people, personOrder, type PersonId } from '../../lib/tripData'

export function PersonPicker({
  isSelected,
  onClick,
}: {
  isSelected: (code: PersonId) => boolean
  onClick: (code: PersonId) => void
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {personOrder.map((code) => {
        const person = people[code]
        const selected = isSelected(code)
        return (
          <button
            key={code}
            type="button"
            className="flex w-13 flex-col items-center"
            style={{ opacity: selected ? 1 : 0.5 }}
            onClick={() => onClick(code)}
          >
            <div
              className="flex h-8.5 w-8.5 items-center justify-center rounded-full text-[13px] font-bold text-white"
              style={{ background: person.color, boxShadow: selected ? '0 0 0 3px var(--color-bg), 0 0 0 5px #3a2a1c' : undefined }}
            >
              {code}
            </div>
            <div className="mt-0.75 text-[9.5px] font-bold text-[#8a7256]">{person.name}</div>
          </button>
        )
      })}
    </div>
  )
}
