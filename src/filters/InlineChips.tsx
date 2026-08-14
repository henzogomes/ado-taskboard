export interface InlineChipsProps {
  /** Text shown before the chips (e.g. "State"). */
  label: string
  /** Distinct values available to pick from — already the deduplicated set. */
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
}

function toggled(selected: string[], option: string): string[] {
  return selected.includes(option) ? selected.filter((v) => v !== option) : [...selected, option]
}

const ACTIVE_CHIP_CLASSNAME = 'rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-fg'
const INACTIVE_CHIP_CLASSNAME =
  'rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-content hover:bg-surface-raised'

/**
 * Inline toggle-chip control for a small facet: a label followed by a wrap of
 * chip buttons. Clicking a chip toggles its value in `selected` via `onChange`,
 * and `aria-pressed` reflects the current state. Restores the pre-#8 FilterBar
 * chip look (indigo-600 active / bordered inactive).
 */
export function InlineChips({ label, options, selected, onChange }: InlineChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">{label}</span>

      {options.length === 0 ? (
        <span className="text-xs text-content-subtle">none</span>
      ) : (
        options.map((option) => {
          const active = selected.includes(option)
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(toggled(selected, option))}
              className={active ? ACTIVE_CHIP_CLASSNAME : INACTIVE_CHIP_CLASSNAME}
            >
              {option}
            </button>
          )
        })
      )}
    </div>
  )
}
