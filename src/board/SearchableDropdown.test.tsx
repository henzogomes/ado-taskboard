import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchableDropdown } from './SearchableDropdown'
import type { DropdownItem } from './Dropdown'

const items: DropdownItem[] = [
  { value: 'a', label: 'Alice' },
  { value: 'b', label: 'Bob', current: true },
  { value: 'c', label: 'Charlie' },
]

function getTrigger(name: RegExp | string = 'Pick') {
  return screen.getByRole('button', { name })
}

describe('SearchableDropdown', () => {
  it('renders the trigger with the given label and no popover until opened', () => {
    render(<SearchableDropdown buttonLabel="Pick" items={items} onSelect={vi.fn()} ariaLabel="Pick" />)

    expect(getTrigger()).toHaveTextContent('Pick')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens a dialog with a search box and every item, marking the current one', async () => {
    const user = userEvent.setup()
    render(<SearchableDropdown buttonLabel="Pick" items={items} onSelect={vi.fn()} ariaLabel="Pick" />)

    await user.click(getTrigger())

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
    for (const item of items) {
      // The current item's accessible name is prefixed with the rendered "✓"
      // (a decorative but un-hidden span, matching Dropdown's own convention).
      expect(screen.getByRole('menuitem', { name: new RegExp(item.label) })).toBeInTheDocument()
    }
    expect(screen.getByRole('menuitem', { name: /Bob/ })).toHaveAttribute('aria-current', 'true')
  })

  it('narrows the list when typing in the search input, case-insensitively', async () => {
    const user = userEvent.setup()
    render(<SearchableDropdown buttonLabel="Pick" items={items} onSelect={vi.fn()} ariaLabel="Pick" />)

    await user.click(getTrigger())
    await user.type(screen.getByRole('searchbox'), 'ali')

    expect(screen.getByRole('menuitem', { name: 'Alice' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Bob' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Charlie' })).not.toBeInTheDocument()
  })

  it('shows a muted "none" when the search matches nothing', async () => {
    const user = userEvent.setup()
    render(<SearchableDropdown buttonLabel="Pick" items={items} onSelect={vi.fn()} ariaLabel="Pick" />)

    await user.click(getTrigger())
    await user.type(screen.getByRole('searchbox'), 'zzz')

    expect(screen.getByText('none')).toBeInTheDocument()
  })

  it('calls onSelect with the item value and closes the dialog on click', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<SearchableDropdown buttonLabel="Pick" items={items} onSelect={onSelect} ariaLabel="Pick" />)

    await user.click(getTrigger())
    await user.click(screen.getByRole('menuitem', { name: 'Charlie' }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('c')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not call onSelect for a disabled item', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const withDisabled: DropdownItem[] = [...items, { value: 'd', label: 'Dave', disabled: true }]
    render(<SearchableDropdown buttonLabel="Pick" items={withDisabled} onSelect={onSelect} ariaLabel="Pick" />)

    await user.click(getTrigger())
    await user.click(screen.getByRole('menuitem', { name: 'Dave' }))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(<SearchableDropdown buttonLabel="Pick" items={items} onSelect={vi.fn()} ariaLabel="Pick" />)

    await user.click(getTrigger())
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes on outside mousedown', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <SearchableDropdown buttonLabel="Pick" items={items} onSelect={vi.fn()} ariaLabel="Pick" />
        <div data-testid="outside">outside</div>
      </div>,
    )

    await user.click(getTrigger())
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByTestId('outside'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('applies a custom triggerClassName when provided', () => {
    render(
      <SearchableDropdown
        buttonLabel="Pick"
        items={items}
        onSelect={vi.fn()}
        ariaLabel="Pick"
        triggerClassName="w-40 custom"
      />,
    )

    const trigger = getTrigger()
    expect(trigger).toHaveClass('w-40', 'custom')
  })
})
