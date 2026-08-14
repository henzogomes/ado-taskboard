import { Dropdown } from './Dropdown'
import type { BoardColumn } from '../api/types'

export interface MoveMenuProps {
  columns: BoardColumn[]
  currentColumn: string
  onMove: (toColumn: string) => void
}

/**
 * Theme-styled replacement for a native `<select>` "Move to column" control.
 * Thin wrapper around the shared `Dropdown`, with `stopPropagation` because
 * the whole card has dnd-kit's drag `listeners` spread on it — pointer/click
 * events on the trigger and menu must never bubble up to it — otherwise
 * opening the menu (or picking an option) would start a drag, and it'd also
 * reach a future card-click handler (planned ticket modal).
 */
export function MoveMenu({ columns, currentColumn, onMove }: MoveMenuProps) {
  return (
    <Dropdown
      buttonLabel="Move…"
      items={columns.map((column) => ({
        value: column.name,
        label: column.name,
        current: column.name === currentColumn,
        disabled: column.name === currentColumn,
      }))}
      onSelect={onMove}
      stopPropagation
    />
  )
}
