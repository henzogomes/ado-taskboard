import { describe, it, expect, vi } from 'vitest'
import { performFlatMove } from './performFlatMove'
import type { Board, WorkItem } from '../api/types'
import type { FlatColumn } from '../domain/board'

const epic = (id: number, over: Partial<WorkItem> = {}): WorkItem => ({
  id,
  type: 'Epic',
  title: `Epic ${id}`,
  state: 'Active',
  boardColumn: null,
  assignedTo: null,
  tags: [],
  parent: null,
  iterationPath: 'P',
  rev: 3,
  ...over,
})

// 'New' and 'Prioritized' both map to state 'New' (two columns, one state).
const board: Board = {
  columns: [
    { name: 'New', columnType: 'incoming', isSplit: false, stateMappings: { Feature: 'New' } },
    { name: 'Prioritized', columnType: 'incoming', isSplit: false, stateMappings: { Feature: 'New' } },
    { name: 'In Development', columnType: 'inProgress', isSplit: false, stateMappings: { Feature: 'Active' } },
    { name: 'Resolved', columnType: 'inProgress', isSplit: false, stateMappings: { Feature: 'Resolved' } },
  ],
}

function makeFlatColumns(): FlatColumn[] {
  return [
    { column: board.columns[0], cards: [epic(102, { state: 'New' })] },
    { column: board.columns[1], cards: [] },
    { column: board.columns[2], cards: [epic(101, { state: 'Active' })] },
    { column: board.columns[3], cards: [] },
  ]
}

function updatedItem(overrides: Partial<WorkItem>): WorkItem {
  return { ...epic(101), ...overrides }
}

type PatchStateFn = (id: number, state: string, boardColumn: string | null, rev: number) => Promise<WorkItem>

function makeHarness(patchStateImpl?: PatchStateFn) {
  return {
    flatColumns: makeFlatColumns(),
    applyLocalFlat: vi.fn<(next: FlatColumn[]) => void>(),
    patchState: vi.fn<PatchStateFn>(
      patchStateImpl ?? (() => Promise.resolve(updatedItem({ state: 'Resolved', rev: 4 }))),
    ),
    refresh: vi.fn<() => void>(),
    onToast: vi.fn<(message: string) => void>(),
    pendingRef: { current: false },
  }
}

function call(h: ReturnType<typeof makeHarness>, cardId: number, toColumn: string) {
  return performFlatMove({
    flatColumns: h.flatColumns,
    cardId,
    toColumn,
    board,
    applyLocalFlat: h.applyLocalFlat,
    patchState: h.patchState,
    refresh: h.refresh,
    onToast: h.onToast,
    pendingRef: h.pendingRef,
  })
}

describe('performFlatMove', () => {
  it('is a noop when dropped back on its own column (no write, no optimistic apply)', async () => {
    const h = makeHarness()
    const result = await call(h, 101, 'In Development')
    expect(result).toBe('noop')
    expect(h.patchState).not.toHaveBeenCalled()
    expect(h.applyLocalFlat).not.toHaveBeenCalled()
  })

  it('is a noop for an unknown card', async () => {
    const h = makeHarness()
    const result = await call(h, 999, 'Resolved')
    expect(result).toBe('noop')
    expect(h.patchState).not.toHaveBeenCalled()
    expect(h.applyLocalFlat).not.toHaveBeenCalled()
  })

  it('is a noop when the destination column maps to the same state as the current one', async () => {
    // card 102 sits in 'New' (state 'New'); 'Prioritized' also maps to 'New'.
    const h = makeHarness()
    const result = await call(h, 102, 'Prioritized')
    expect(result).toBe('noop')
    expect(h.patchState).not.toHaveBeenCalled()
    expect(h.applyLocalFlat).not.toHaveBeenCalled()
  })

  it('applies optimistically, writes, reconciles from the response, and refreshes on a successful move', async () => {
    const h = makeHarness(() => Promise.resolve(updatedItem({ state: 'Resolved', rev: 4 })))
    const result = await call(h, 101, 'Resolved')

    expect(result).toBe('ok')
    expect(h.applyLocalFlat).toHaveBeenCalledTimes(2)
    expect(h.patchState).toHaveBeenCalledWith(101, 'Resolved', null, 3)
    expect(h.refresh).toHaveBeenCalledTimes(1)
    expect(h.onToast).not.toHaveBeenCalled()
    expect(h.pendingRef.current).toBe(false)
  })

  it("reconciles the moved card with patchState's response so a second move sends the fresh rev", async () => {
    const h = makeHarness(() => Promise.resolve(updatedItem({ state: 'Resolved', rev: 4 })))
    await call(h, 101, 'Resolved')

    const reconciled = h.applyLocalFlat.mock.calls[1][0] as FlatColumn[]
    const moved = reconciled.find((c) => c.column.name === 'Resolved')?.cards.find((t) => t.id === 101)
    expect(moved?.rev).toBe(4)
    expect(moved?.state).toBe('Resolved')
  })

  it('rolls back and toasts on a failed write', async () => {
    const h = makeHarness(() => Promise.reject(new Error('412 Precondition Failed')))
    const result = await call(h, 101, 'Resolved')

    expect(result).toBe('failed')
    expect(h.applyLocalFlat).toHaveBeenCalledTimes(2)
    expect(h.applyLocalFlat).toHaveBeenNthCalledWith(2, h.flatColumns) // rollback === original snapshot
    expect(h.refresh).not.toHaveBeenCalled()
    expect(h.onToast).toHaveBeenCalledWith("Couldn't move #101 — 412 Precondition Failed")
    expect(h.pendingRef.current).toBe(false)
  })

  it('ignores a drop while a prior write is still pending', async () => {
    let resolvePatch!: (item: WorkItem) => void
    const h = makeHarness(
      () =>
        new Promise<WorkItem>((resolve) => {
          resolvePatch = resolve
        }),
    )

    const firstMove = call(h, 101, 'Resolved')
    expect(h.pendingRef.current).toBe(true)

    const secondResult = await call(h, 102, 'In Development')
    expect(secondResult).toBe('noop')
    expect(h.patchState).toHaveBeenCalledTimes(1)

    resolvePatch(updatedItem({ state: 'Resolved', rev: 4 }))
    await firstMove
  })
})
