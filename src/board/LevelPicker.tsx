import { Dropdown } from './Dropdown'
import type { DropdownItem } from './Dropdown'
import type { LevelView } from './level'

export interface LevelPickerProps {
  levels: LevelView[]
  levelId: string
  onChange: (id: string) => void
}

const TRIGGER_CLASSNAME =
  'flex items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-raised'

/**
 * Level-toggle control (#3): a thin `Dropdown` wrapper listing every
 * discovered `LevelView` (Tasks, the requirement board, each portfolio
 * level). Styled to match `ConnectionSwitcher`'s dropdown.
 */
export function LevelPicker({ levels, levelId, onChange }: LevelPickerProps) {
  const items: DropdownItem[] = levels.map((v) => ({
    value: v.id,
    label: v.label,
    current: v.id === levelId,
  }))

  const buttonLabel = levels.find((v) => v.id === levelId)?.label ?? levels[0]?.label ?? ''

  return (
    <Dropdown
      buttonLabel={buttonLabel}
      items={items}
      onSelect={onChange}
      ariaLabel="Level"
      triggerClassName={TRIGGER_CLASSNAME}
    />
  )
}
