import { describe, it, expect } from 'vitest'
import { findFlatCard, findFlatCardColumn, moveFlatCard, withUpdatedFlatCard } from './flatDnd'
import type { Board, WorkItem } from '../api/types'
import type { FlatColumn } from '../domain/board'

const epic = (id: number, over: Partial<WorkItem> = {}): WorkItem => ({
  id,
  type: 'Epic',
  title: `Epic ${id}`,
  state: 'New',
  boardColumn: null,
  assignedTo: null,
  tags: [],
  parent: null,
  iterationPath: 'P',
  rev: 1,
  ...over,
})

// Real-board shape: no 'Epic' key in stateMappings, only the board's own
// portfolio type — deliberately NOT 'Epic', to prove the fallback reads from
// the board's own data rather than a hardcoded type name.
const board: Board = {
  columns: [
    { name: 'New', columnType: 'incoming', isSplit: false, stateMappings: {} },
    {
      name: 'In Development',
      columnType: 'inProgress',
      isSplit: false,
      stateMappings: { Feature: 'Active' },
    },
    {
      name: 'Resolved',
      columnType: 'inProgress',
      isSplit: false,
      stateMappings: { Feature: 'Resolved' },
    },
  ],
}

function makeFlatColumns(): FlatColumn[] {
  return [
    { column: board.columns[1], cards: [epic(1, { state: 'Active' })] },
    { column: board.columns[2], cards: [epic(2, { state: 'Resolved' })] },
  ]
}

describe('findFlatCardColumn', () => {
  it('returns the name of the column holding the card', () => {
    expect(findFlatCardColumn(makeFlatColumns(), 1)).toBe('In Development')
    expect(findFlatCardColumn(makeFlatColumns(), 2)).toBe('Resolved')
  })

  it('returns null for an unknown card', () => {
    expect(findFlatCardColumn(makeFlatColumns(), 999)).toBeNull()
  })
})

describe('findFlatCard', () => {
  it('returns the work item wherever it sits', () => {
    expect(findFlatCard(makeFlatColumns(), 1)?.id).toBe(1)
    expect(findFlatCard(makeFlatColumns(), 999)).toBeNull()
  })
})

describe('moveFlatCard', () => {
  it('moves a card from column A to column B, adopting the target state', () => {
    const flatColumns = makeFlatColumns()

    const result = moveFlatCard(flatColumns, 1, 'Resolved', board)

    expect(result).not.toBeNull()
    const { next, undo, targetState } = result!

    expect(targetState).toBe('Resolved')

    // gone from In Development, present (with new state) in Resolved
    expect(next.find((c) => c.column.name === 'In Development')?.cards.map((t) => t.id)).toEqual([])
    const dest = next.find((c) => c.column.name === 'Resolved')
    expect(dest?.cards.map((t) => t.id)).toEqual([2, 1])
    expect(dest?.cards.find((t) => t.id === 1)?.state).toBe('Resolved')

    // undo restores the original, untouched flatColumns
    expect(undo).toBe(flatColumns)

    // input was never mutated
    expect(flatColumns.find((c) => c.column.name === 'In Development')?.cards.map((t) => t.id)).toEqual([1])
    expect(flatColumns.find((c) => c.column.name === 'Resolved')?.cards.map((t) => t.id)).toEqual([2])
  })

  it('returns null for an unknown card id', () => {
    expect(moveFlatCard(makeFlatColumns(), 999, 'Resolved', board)).toBeNull()
  })

  it('returns null when the destination column is not a known board column', () => {
    expect(moveFlatCard(makeFlatColumns(), 1, 'Nonexistent', board)).toBeNull()
  })

  it('returns null when the destination column has no resolvable state', () => {
    // 'New' has empty stateMappings → resolveTargetState yields null.
    expect(moveFlatCard(makeFlatColumns(), 1, 'New', board)).toBeNull()
  })

  it("resolves targetState via the column's own portfolio-type mapping when there's no Epic key, regardless of which type the board uses", () => {
    const result = moveFlatCard(makeFlatColumns(), 1, 'Resolved', board)
    expect(result?.targetState).toBe('Resolved')
    expect(board.columns.find((c) => c.name === 'Resolved')?.stateMappings.Epic).toBeUndefined()
  })
})

describe('withUpdatedFlatCard', () => {
  it("patches only the target card's rev/state, leaving everything else untouched", () => {
    const flatColumns = makeFlatColumns()

    const result = withUpdatedFlatCard(flatColumns, 1, { rev: 5, state: 'Resolved' })

    const moved = result.find((c) => c.column.name === 'In Development')?.cards.find((t) => t.id === 1)
    expect(moved?.rev).toBe(5)
    expect(moved?.state).toBe('Resolved')

    // The other card, in a different column, is untouched.
    const other = result.find((c) => c.column.name === 'Resolved')?.cards.find((t) => t.id === 2)
    expect(other?.rev).toBe(1)

    // Input was never mutated.
    expect(flatColumns.find((c) => c.column.name === 'In Development')?.cards[0].rev).toBe(1)
  })

  it('is immutable: returns a fresh array even when no card matched', () => {
    const flatColumns = makeFlatColumns()
    const result = withUpdatedFlatCard(flatColumns, 999, { rev: 99, state: 'Whatever' })
    expect(result).toEqual(flatColumns)
    expect(result).not.toBe(flatColumns)
  })
})
