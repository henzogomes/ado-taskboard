import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Card } from './Card'
import type { BoardColumn, WorkItem } from '../api/types'
import { StateCategoryContext } from '../theme/StateCategoryContext'

// CONFIG.* are live getters reading the active connection; mock getActive so the
// real getters resolve through this mutable connection (tests set `activeConn.me`).
const activeConn = { id: 'c1', label: 'L', org: 'o', project: 'p', me: '', pat: '' }
vi.mock('../connections/store', () => ({ getActive: () => activeConn }))

const task: WorkItem = {
  id: 819099,
  rev: 1,
  type: 'Task',
  title: 'Copilot ask endpoint',
  state: 'Closed',
  boardColumn: 'Resolved',
  assignedTo: { displayName: 'Jane Doe', uniqueName: 'h@x' },
  tags: ['agentic', 'BE Dev'],
  parent: 807119,
  iterationPath: 'P',
}

const columns: BoardColumn[] = [
  { name: 'colA', columnType: 'inProgress', isSplit: false, stateMappings: {} },
  { name: 'colB', columnType: 'inProgress', isSplit: false, stateMappings: {} },
  { name: 'colC', columnType: 'incoming', isSplit: false, stateMappings: {} },
]

describe('Card', () => {
  beforeEach(() => {
    activeConn.me =''
  })

  it('shows id as an ADO link, title, state, assignee, tags', () => {
    render(<Card item={task} />)
    const link = screen.getByRole('link', { name: /819099/ })
    expect(link).toHaveAttribute('href', expect.stringContaining('/_workitems/edit/819099'))
    expect(screen.getByText('Copilot ask endpoint')).toBeInTheDocument()
    expect(screen.getByText('Closed')).toBeInTheDocument()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('agentic')).toBeInTheDocument()
  })

  it('builds avatar initials from each word’s first alphanumeric (skips leading punctuation)', () => {
    render(<Card item={{ ...task, assignedTo: { displayName: '_Jane Doe.AZ', uniqueName: 'x@y' } }} />)
    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  it('renders no move trigger when board context props are absent', () => {
    render(<Card item={task} />)
    expect(screen.queryByRole('button', { name: 'Move…' })).not.toBeInTheDocument()
  })

  it('opens the move menu listing every column, marking the current one', async () => {
    const user = userEvent.setup()
    const onMoveCard = vi.fn()
    render(<Card item={task} columns={columns} currentColumn="colA" onMoveCard={onMoveCard} />)

    await user.click(screen.getByRole('button', { name: 'Move…' }))

    const items = screen.getAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual(['✓colA', 'colB', 'colC'])

    const currentItem = screen.getByRole('menuitem', { name: /colA/ })
    expect(currentItem).toHaveAttribute('aria-current', 'true')
  })

  it('calls onMoveCard with the card id and chosen column, then closes the menu', async () => {
    const user = userEvent.setup()
    const onMoveCard = vi.fn()
    render(<Card item={task} columns={columns} currentColumn="colA" onMoveCard={onMoveCard} />)

    await user.click(screen.getByRole('button', { name: 'Move…' }))
    await user.click(screen.getByRole('menuitem', { name: /colB/ }))

    expect(onMoveCard).toHaveBeenCalledTimes(1)
    expect(onMoveCard).toHaveBeenCalledWith(819099, 'colB')
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })

  it('does not call onMoveCard when clicking the current column', async () => {
    const user = userEvent.setup()
    const onMoveCard = vi.fn()
    render(<Card item={task} columns={columns} currentColumn="colA" onMoveCard={onMoveCard} />)

    await user.click(screen.getByRole('button', { name: 'Move…' }))
    await user.click(screen.getByRole('menuitem', { name: /colA/ }))

    expect(onMoveCard).not.toHaveBeenCalled()
  })

  it('accents the card when assignedTo.uniqueName matches CONFIG.me (case-insensitively)', () => {
    activeConn.me ='H@X'
    render(<Card item={task} />)
    expect(screen.getByText('Copilot ask endpoint').closest('div.rounded-md')).toHaveClass('ring-2')
  })

  it('does not accent the card when assignedTo differs from CONFIG.me', () => {
    activeConn.me ='someone-else@x'
    render(<Card item={task} />)
    expect(screen.getByText('Copilot ask endpoint').closest('div.rounded-md')).not.toHaveClass('ring-2')
  })

  it('does not accent the card when CONFIG.me is empty, even if assignedTo would match', () => {
    activeConn.me =''
    const unassignedMatch: WorkItem = { ...task, assignedTo: { displayName: 'Nobody', uniqueName: '' } }
    render(<Card item={unassignedMatch} />)
    expect(screen.getByText('Copilot ask endpoint').closest('div.rounded-md')).not.toHaveClass('ring-2')
  })

  it('does not accent the card when highlightMine is false, even if assignedTo matches CONFIG.me', () => {
    activeConn.me ='H@X'
    render(<Card item={task} highlightMine={false} />)
    expect(screen.getByText('Copilot ask endpoint').closest('div.rounded-md')).not.toHaveClass('ring-2')
  })

  it('calls onOpenCard with the item when the card body is clicked', async () => {
    const user = userEvent.setup()
    const onOpenCard = vi.fn()
    render(<Card item={task} onOpenCard={onOpenCard} />)

    await user.click(screen.getByText('Copilot ask endpoint'))

    expect(onOpenCard).toHaveBeenCalledTimes(1)
    expect(onOpenCard).toHaveBeenCalledWith(task)
  })

  it('does not call onOpenCard when clicking the #id link (stopPropagation)', async () => {
    const user = userEvent.setup()
    const onOpenCard = vi.fn()
    render(<Card item={task} onOpenCard={onOpenCard} />)

    await user.click(screen.getByRole('link', { name: /819099/ }))

    expect(onOpenCard).not.toHaveBeenCalled()
  })

  it('does not call onOpenCard when clicking the Move… trigger (stopPropagation)', async () => {
    const user = userEvent.setup()
    const onOpenCard = vi.fn()
    const onMoveCard = vi.fn()
    render(<Card item={task} columns={columns} currentColumn="colA" onMoveCard={onMoveCard} onOpenCard={onOpenCard} />)

    await user.click(screen.getByRole('button', { name: 'Move…' }))

    expect(onOpenCard).not.toHaveBeenCalled()
  })

  it('does not throw when clicking a bare card with no onOpenCard', async () => {
    const user = userEvent.setup()
    render(<Card item={task} />)

    await user.click(screen.getByText('Copilot ask endpoint'))

    expect(screen.getByText('Copilot ask endpoint')).toBeInTheDocument()
  })

  it('colors the left border from the live state-category map', () => {
    render(
      <StateCategoryContext.Provider value={{ Active: 'InProgress' }}>
        <Card item={{ ...task, state: 'Active' }} />
      </StateCategoryContext.Provider>,
    )
    expect(screen.getByText('Copilot ask endpoint').closest('div.rounded-md')).toHaveClass('border-l-state-inprogress')
  })

  it('falls back to the gray border for a state absent from the category map', () => {
    render(
      <StateCategoryContext.Provider value={{}}>
        <Card item={{ ...task, state: 'SomeCustomState' }} />
      </StateCategoryContext.Provider>,
    )
    expect(screen.getByText('Copilot ask endpoint').closest('div.rounded-md')).toHaveClass('border-l-content-subtle')
  })
})
