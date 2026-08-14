import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IterationPicker } from './IterationPicker'
import type { Iteration } from '../api/types'

const iterations: Iteration[] = [
  { id: 'iter-1', name: 'Sprint 1', path: 'P\\Sprint 1' },
  { id: 'iter-2', name: 'Sprint 2', path: 'P\\Sprint 2' },
]

function getTrigger() {
  // `aria-label="Iteration scope"` is the accessible name, so the button is
  // found by that; its visible label text is asserted separately.
  return screen.getByRole('button', { name: 'Iteration scope' })
}

describe('IterationPicker', () => {
  it('shows the current selection label on the trigger', () => {
    render(<IterationPicker iterations={iterations} value="current" onChange={vi.fn()} />)
    expect(getTrigger()).toHaveTextContent('Current sprint')
  })

  it('falls back to "Current sprint" on an unknown value', () => {
    render(<IterationPicker iterations={iterations} value="nope" onChange={vi.fn()} />)
    expect(getTrigger()).toHaveTextContent('Current sprint')
  })

  it('shows the matching iteration name on the trigger when value is an iteration id', () => {
    render(<IterationPicker iterations={iterations} value="iter-2" onChange={vi.fn()} />)
    expect(getTrigger()).toHaveTextContent('Sprint 2')
  })

  it('opens and lists Current sprint, All sprints, and each iteration, marking the current one', async () => {
    const user = userEvent.setup()
    render(<IterationPicker iterations={iterations} value="iter-1" onChange={vi.fn()} />)

    await user.click(getTrigger())

    const items = screen.getAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual(['Current sprint', 'All sprints', '✓Sprint 1', 'Sprint 2'])

    expect(screen.getByRole('menuitem', { name: /Sprint 1/ })).toHaveAttribute('aria-current', 'true')
  })

  it('calls onChange with the selected value and closes the menu', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<IterationPicker iterations={iterations} value="current" onChange={onChange} />)

    await user.click(getTrigger())
    await user.click(screen.getByRole('menuitem', { name: 'Sprint 2' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('iter-2')
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })

  it('calls onChange with "all" when All sprints is selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<IterationPicker iterations={iterations} value="current" onChange={onChange} />)

    await user.click(getTrigger())
    await user.click(screen.getByRole('menuitem', { name: 'All sprints' }))

    expect(onChange).toHaveBeenCalledWith('all')
  })

  it('provides a search box that narrows a long iteration list', async () => {
    const many: Iteration[] = Array.from({ length: 60 }, (_, i) => ({
      id: `iter-${i}`,
      name: `Sprint ${i}`,
      path: `P\\Sprint ${i}`,
    }))
    const user = userEvent.setup()
    render(<IterationPicker iterations={many} value="current" onChange={vi.fn()} />)

    await user.click(getTrigger())
    expect(screen.getByRole('searchbox')).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox'), 'Sprint 42')

    expect(screen.getByRole('menuitem', { name: 'Sprint 42' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Sprint 5' })).not.toBeInTheDocument()
  })
})
