// Mutable, in-memory runtime state for Demo mode.
//
// The board is cached by TanStack Query and a successful move calls `refresh()`
// (a refetch). If the demo board rebuilt from the STATIC dataset every time, the
// refetch would revert the move. So the demo work items live here as mutable
// state: `demoApplyMove` updates them in place, and `demoWorkItems()` (read by
// the demo board builder) reflects the move — it sticks, exactly like a real
// write would, but without any network.

import type { WorkItem } from '../api/types'
import { makeDemoWorkItems } from './dataset'

let items: WorkItem[] = makeDemoWorkItems()

/** The current (possibly moved) demo work items. */
export function demoWorkItems(): WorkItem[] {
  return items
}

/**
 * Applies a local, non-networked state move to the demo item `id`, mirroring
 * `patchState`'s contract: mutates the item's state + bumps its rev, and
 * returns the updated item so the optimistic apply can reconcile rev/state.
 * The new rev is derived from the caller-supplied `rev` (as ADO would), so
 * consecutive moves on the same card stay monotonic.
 */
export function demoApplyMove(id: number, state: string, rev: number): WorkItem {
  const item = items.find((i) => i.id === id)
  if (!item) {
    // Should not happen for a card the board rendered, but stay well-formed.
    return {
      id,
      type: 'Task',
      title: '',
      state,
      boardColumn: null,
      assignedTo: null,
      tags: [],
      parent: null,
      iterationPath: '',
      rev: rev + 1,
    }
  }
  item.state = state
  // Board column is recomputed from state by the domain builders (columnForItem)
  // for the lanes view, so clearing it keeps the item coherent for any view.
  item.boardColumn = null
  item.rev = rev + 1
  return { ...item }
}

/** Resets the demo items to their seeded state (used by tests for isolation). */
export function resetDemo(): void {
  items = makeDemoWorkItems()
}
