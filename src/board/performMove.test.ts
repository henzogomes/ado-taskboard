import { describe, it, expect, vi } from 'vitest'
import { performMove } from './performMove'
import type { Board, WorkItem } from '../api/types'
import type { Lane, SprintSection } from '../domain/board'

const task: WorkItem = {
  id: 101,
  type: 'Task',
  title: 'Do the thing',
  state: 'Active',
  boardColumn: null,
  assignedTo: null,
  tags: [],
  parent: 500,
  iterationPath: 'Proj\\Sprint 1',
  rev: 3,
}

const story: WorkItem = {
  id: 500,
  type: 'User Story',
  title: 'The story',
  state: 'Active',
  boardColumn: null,
  assignedTo: null,
  tags: [],
  parent: null,
  iterationPath: 'Proj\\Sprint 1',
  rev: 2,
}

const newStateTask: WorkItem = { ...task, id: 102, state: 'New' }

function makeSection(): SprintSection {
  const lane: Lane = {
    story,
    tasksByColumn: {
      'In Development': [task],
      New: [newStateTask],
    },
    taskCount: 2,
  }
  return {
    iteration: { id: 'it1', name: 'Sprint 1', path: 'Proj\\Sprint 1' },
    lanes: [lane],
    noParentLane: { story: null, tasksByColumn: {}, taskCount: 0 },
    storyCount: 1,
    taskCount: 2,
  }
}

// Real-board-ish shape: 'New' and 'Prioritized' both map to state 'New'
// (a genuine case on the real board — two columns, one state).
const board: Board = {
  columns: [
    { name: 'New', columnType: 'incoming', isSplit: false, stateMappings: { 'User Story': 'New' } },
    { name: 'Prioritized', columnType: 'incoming', isSplit: false, stateMappings: { 'User Story': 'New' } },
    { name: 'In Development', columnType: 'inProgress', isSplit: false, stateMappings: { 'User Story': 'Active' } },
    { name: 'Resolved', columnType: 'inProgress', isSplit: false, stateMappings: { 'User Story': 'Resolved' } },
  ],
}

function updatedItem(overrides: Partial<WorkItem>): WorkItem {
  return { ...task, ...overrides }
}

type PatchStateFn = (id: number, state: string, boardColumn: string | null, rev: number) => Promise<WorkItem>

function makeHarness(patchStateImpl?: PatchStateFn) {
  return {
    sections: [makeSection()],
    applyLocal: vi.fn<(next: SprintSection[]) => void>(),
    patchState: vi.fn<PatchStateFn>(
      patchStateImpl ?? (() => Promise.resolve(updatedItem({ state: 'Resolved', rev: 4 }))),
    ),
    refresh: vi.fn<() => void>(),
    onToast: vi.fn<(message: string) => void>(),
    pendingRef: { current: false },
  }
}

describe('performMove', () => {
  it('is a noop when dropped back on its own column (no write, no optimistic apply)', async () => {
    const h = makeHarness()

    const result = await performMove({
      sections: h.sections,
      cardId: 101,
      toColumn: 'In Development',
      board,
      applyLocal: h.applyLocal,
      patchState: h.patchState,
      refresh: h.refresh,
      onToast: h.onToast,
      pendingRef: h.pendingRef,
    })

    expect(result).toBe('noop')
    expect(h.patchState).not.toHaveBeenCalled()
    expect(h.applyLocal).not.toHaveBeenCalled()
  })

  it('is a noop when the destination column maps to the same state as the current one', async () => {
    // task 102 sits in 'New' (state 'New'); 'Prioritized' also maps to 'New' —
    // a different column, but no real state change.
    const h = makeHarness()

    const result = await performMove({
      sections: h.sections,
      cardId: 102,
      toColumn: 'Prioritized',
      board,
      applyLocal: h.applyLocal,
      patchState: h.patchState,
      refresh: h.refresh,
      onToast: h.onToast,
      pendingRef: h.pendingRef,
    })

    expect(result).toBe('noop')
    expect(h.patchState).not.toHaveBeenCalled()
    expect(h.applyLocal).not.toHaveBeenCalled()
  })

  it('applies optimistically, writes, reconciles from the response, and refreshes on a successful move', async () => {
    const h = makeHarness(() => Promise.resolve(updatedItem({ state: 'Resolved', rev: 4 })))

    const result = await performMove({
      sections: h.sections,
      cardId: 101,
      toColumn: 'Resolved',
      board,
      applyLocal: h.applyLocal,
      patchState: h.patchState,
      refresh: h.refresh,
      onToast: h.onToast,
      pendingRef: h.pendingRef,
    })

    expect(result).toBe('ok')
    // Called twice: once optimistically (before the write), once to
    // reconcile the moved card's rev/state from patchState's response.
    expect(h.applyLocal).toHaveBeenCalledTimes(2)
    expect(h.patchState).toHaveBeenCalledWith(101, 'Resolved', null, task.rev)
    expect(h.refresh).toHaveBeenCalledTimes(1)
    expect(h.onToast).not.toHaveBeenCalled()
    expect(h.pendingRef.current).toBe(false) // cleared in finally
  })

  it('reconciles the moved card with patchState\'s response so a second move sends the fresh rev', async () => {
    const h = makeHarness(() => Promise.resolve(updatedItem({ state: 'Resolved', rev: 4 })))

    await performMove({
      sections: h.sections,
      cardId: 101,
      toColumn: 'Resolved',
      board,
      applyLocal: h.applyLocal,
      patchState: h.patchState,
      refresh: h.refresh,
      onToast: h.onToast,
      pendingRef: h.pendingRef,
    })

    // The final applyLocal call (the reconcile, after the optimistic one)
    // must carry the server's fresh rev/state for card 101 — this is what
    // the next move reads via sectionsRef, avoiding a stale-rev 412.
    const reconciledSections = h.applyLocal.mock.calls[1][0] as SprintSection[]
    const movedCard = reconciledSections[0].lanes[0].tasksByColumn['Resolved']?.find((t) => t.id === 101)
    expect(movedCard?.rev).toBe(4)
    expect(movedCard?.state).toBe('Resolved')

    // The other card in the lane is untouched.
    const otherCard = reconciledSections[0].lanes[0].tasksByColumn['New']?.find((t) => t.id === 102)
    expect(otherCard?.rev).toBe(newStateTask.rev)
  })

  it('rolls back and toasts on a failed write', async () => {
    const h = makeHarness(() => Promise.reject(new Error('412 Precondition Failed')))

    const result = await performMove({
      sections: h.sections,
      cardId: 101,
      toColumn: 'Resolved',
      board,
      applyLocal: h.applyLocal,
      patchState: h.patchState,
      refresh: h.refresh,
      onToast: h.onToast,
      pendingRef: h.pendingRef,
    })

    expect(result).toBe('failed')
    expect(h.applyLocal).toHaveBeenCalledTimes(2)
    expect(h.applyLocal).toHaveBeenNthCalledWith(2, h.sections) // rollback === the original snapshot
    expect(h.refresh).not.toHaveBeenCalled()
    expect(h.onToast).toHaveBeenCalledWith("Couldn't move #101 — 412 Precondition Failed")
    expect(h.pendingRef.current).toBe(false) // cleared in finally even on failure
  })

  it('ignores a drop while a prior write is still pending', async () => {
    let resolvePatch!: (item: WorkItem) => void
    const h = makeHarness(
      () =>
        new Promise<WorkItem>((resolve) => {
          resolvePatch = resolve
        }),
    )

    // Fire the first move but don't await it yet — its synchronous portion
    // (guards + applyLocal + setting pendingRef) runs eagerly before the
    // first `await patchState(...)` suspends it.
    const firstMove = performMove({
      sections: h.sections,
      cardId: 101,
      toColumn: 'Resolved',
      board,
      applyLocal: h.applyLocal,
      patchState: h.patchState,
      refresh: h.refresh,
      onToast: h.onToast,
      pendingRef: h.pendingRef,
    })

    expect(h.pendingRef.current).toBe(true) // the first move already marked pending

    const secondResult = await performMove({
      sections: h.sections,
      cardId: 102,
      toColumn: 'Resolved',
      board,
      applyLocal: h.applyLocal,
      patchState: h.patchState,
      refresh: h.refresh,
      onToast: h.onToast,
      pendingRef: h.pendingRef,
    })

    expect(secondResult).toBe('noop')
    expect(h.patchState).toHaveBeenCalledTimes(1) // only the first move's call

    resolvePatch(updatedItem({ state: 'Resolved', rev: 4 }))
    await firstMove
  })
})
