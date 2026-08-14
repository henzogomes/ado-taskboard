import { SearchableDropdown } from './SearchableDropdown'
import type { DropdownItem } from './Dropdown'
import type { Iteration } from '../api/types'

export interface IterationPickerProps {
  iterations: Iteration[]
  value: string
  onChange: (value: string) => void
}

const TRIGGER_CLASSNAME =
  'flex items-center justify-between gap-2 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-content-muted hover:bg-surface-raised'

/**
 * Searchable dropdown with `current`, `all`, and one option per team
 * iteration (by name). Uses `SearchableDropdown` (not the plain `Dropdown`)
 * because a project's iteration count can grow into the dozens — a plain
 * unbounded menu becomes an unusable, unscrollable wall of items.
 */
export function IterationPicker({ iterations, value, onChange }: IterationPickerProps) {
  const items: DropdownItem[] = [
    { value: 'current', label: 'Current sprint' },
    { value: 'all', label: 'All sprints' },
    ...iterations.map((iteration) => ({ value: iteration.id, label: iteration.name })),
  ].map((item) => ({ ...item, current: item.value === value }))

  const buttonLabel = items.find((item) => item.current)?.label ?? 'Current sprint'

  return (
    <SearchableDropdown
      buttonLabel={buttonLabel}
      items={items}
      onSelect={onChange}
      ariaLabel="Iteration scope"
      triggerClassName={TRIGGER_CLASSNAME}
    />
  )
}
