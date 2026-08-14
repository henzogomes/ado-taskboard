import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FlatBoard } from './FlatBoard'
import type { Board, BoardColumn, WorkItem } from '../api/types'
import type { FlatColumn } from '../domain/board'

const col = (name: string, stateMappings: Record<string, string> = {}): BoardColumn => ({
  name,
  columnType: 'inProgress',
  isSplit: false,
  stateMappings,
})
const item = (id: number, over: Partial<WorkItem> = {}): WorkItem => ({
  id,
  type: 'Epic',
  title: `Item ${id}`,
  state: 'New',
  boardColumn: null,
  assignedTo: null,
  tags: [],
  parent: null,
  iterationPath: 'P',
  rev: 1,
  ...over,
})

// Column names deliberately differ from any card state ('New') so header text
// doesn't collide with the state pill each card renders.
const flatColumns: FlatColumn[] = [
  { column: col('Backlog'), cards: [item(1), item(2)] },
  { column: col('Shipped'), cards: [] },
]

describe('FlatBoard', () => {
  it('renders a column per non-empty entry with its cards (showAll off hides empty columns)', () => {
    render(<FlatBoard flatColumns={flatColumns} showAll={false} />)
    expect(screen.getByText('Backlog')).toBeInTheDocument()
    expect(screen.queryByText('Shipped')).not.toBeInTheDocument()
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 2')).toBeInTheDocument()
  })

  it('renders empty columns when showAll is on', () => {
    render(<FlatBoard flatColumns={flatColumns} showAll />)
    expect(screen.getByText('Shipped')).toBeInTheDocument()
  })

  it('opens a card on click (read-only cards are still clickable)', async () => {
    const onOpenCard = vi.fn()
    const user = userEvent.setup()
    render(<FlatBoard flatColumns={flatColumns} showAll={false} onOpenCard={onOpenCard} />)
    await user.click(screen.getByText('Item 1'))
    expect(onOpenCard).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
  })

  it('shows a friendly empty state when the level has no items', () => {
    render(<FlatBoard flatColumns={[{ column: col('New'), cards: [] }]} showAll={false} />)
    expect(screen.getByText(/no work items/i)).toBeInTheDocument()
  })

  it('renders no Move menu when read-only (no board / no drop handler)', () => {
    render(<FlatBoard flatColumns={flatColumns} showAll={false} />)
    expect(screen.queryByRole('button', { name: 'Move…' })).not.toBeInTheDocument()
  })

  it('renders a Move menu and routes a pick through onMoveCard when movable', async () => {
    const board: Board = {
      columns: [col('Backlog', { Epic: 'New' }), col('Shipped', { Epic: 'Done' })],
    }
    const onMoveCard = vi.fn()
    const user = userEvent.setup()
    render(
      <FlatBoard
        flatColumns={flatColumns}
        board={board}
        showAll
        onDropCard={vi.fn()}
        onMoveCard={onMoveCard}
      />,
    )

    // Each movable card carries a "Move…" trigger (exact name — the draggable
    // card itself is role="button" via dnd-kit's attributes, so a loose match
    // would grab the card, not the menu trigger); open the first and pick a column.
    const triggers = screen.getAllByRole('button', { name: 'Move…' })
    expect(triggers.length).toBe(2) // one per card in the Backlog column
    await user.click(triggers[0])
    await user.click(screen.getByRole('menuitem', { name: /Shipped/ }))

    expect(onMoveCard).toHaveBeenCalledWith(1, 'Shipped')
  })
})
