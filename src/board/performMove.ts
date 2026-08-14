// Orchestrates a card's drop: the guarded, side-effecting flow that sits
// between dnd-kit's `onDragEnd` and the pure `moveCard` reducer. Pulled out
// of `App.tsx` so it's a plain async function tests can call directly with
// spies — no rendering, no simulated drag, no real ADO write (patchState is
// injected).

import type { Board, WorkItem } from '../api/types'
import type { SprintSection } from '../domain/board'
import { findCard, findCardColumn, moveCard, withUpdatedCard } from './dnd'

export type PerformMoveResult = 'noop' | 'ok' | 'failed'

export interface PerformMoveArgs {
  /** The CURRENT (unfiltered) sections — callers should read this from a ref, not a stale closure. */
  sections: SprintSection[]
  cardId: number
  toColumn: string
  board: Board
  applyLocal: (next: SprintSection[]) => void
  patchState: (id: number, state: string, boardColumn: string | null, rev: number) => Promise<WorkItem>
  refresh: () => void
  onToast: (message: string) => void
  /**
   * Serializes writes: a shared `{ current: boolean }` (typically a
   * `useRef(false)`) the caller holds across drops. While `true`, every
   * `performMove` call is ignored ('noop') so at most one optimistic move
   * — and its whole-board `undo` snapshot — is ever in flight. Without
   * this, a failed move's rollback would stomp a sibling move applied
   * while the first write was still pending.
   */
  pendingRef: { current: boolean }
}

/**
 * Moves `cardId` to `toColumn`, guarding against writes that would have no
 * effect and against overlapping writes, then applies optimistically and
 * rolls back on failure.
 *
 * Returns `'noop'` when: a write is already pending; the card can't be
 * found; the drop targets the card's current column (no-op reorder); the
 * destination column's mapped state equals the card's current state (e.g.
 * two columns that both map to `New` — nothing would actually change, and
 * a refresh would immediately undo the move); or `moveCard` itself can't
 * resolve the move (unknown column / no resolvable state).
 *
 * Returns `'ok'` after a successful optimistic apply + write + silent
 * refresh, or `'failed'` after a rolled-back write (with `onToast` called).
 */
export async function performMove(args: PerformMoveArgs): Promise<PerformMoveResult> {
  const { sections, cardId, toColumn, board, applyLocal, patchState, refresh, onToast, pendingRef } = args

  if (pendingRef.current) return 'noop' // a write is already in flight — ignore this drop

  const currentColumn = findCardColumn(sections, cardId)
  if (currentColumn === null) return 'noop' // unknown card
  if (currentColumn === toColumn) return 'noop' // dropped back on its own column — no-op

  const result = moveCard(sections, cardId, toColumn, board)
  if (!result) return 'noop' // unknown destination column, or no resolvable state

  const { next, undo, targetState } = result

  const card = findCard(sections, cardId)
  if (!card) return 'noop' // moveCard already validated existence; this is only for TypeScript's benefit

  // Two columns can map to the same state (e.g. New <-> Prioritized both
  // map to 'New'). That's not a real move — writing it would be a no-op
  // ADO PATCH that a refresh would immediately reflect as "no change", so
  // skip the write (and the optimistic apply) entirely.
  if (targetState === card.state) return 'noop'

  pendingRef.current = true
  applyLocal(next) // optimistic: card moves instantly

  try {
    const updated = await patchState(cardId, targetState, null, card.rev)
    // Reconcile the moved card's rev/state from the server's response
    // immediately, rather than waiting on the async refresh() below: a
    // second consecutive move on the same card can read `sections` before
    // refresh() lands, sending patchState's now-stale `rev` and getting
    // rejected with a 412 by ADO's optimistic-concurrency guard.
    applyLocal(withUpdatedCard(next, cardId, { rev: updated.rev, state: updated.state }))
    refresh() // reconcile the rest of the board, silently
    return 'ok'
  } catch (err) {
    applyLocal(undo) // roll back to the pre-move snapshot — safe because writes are serialized,
    // so no sibling move could have landed on top of it while this write was in flight
    const message = err instanceof Error ? err.message : String(err)
    onToast(`Couldn't move #${cardId} — ${message}`)
    return 'failed'
  } finally {
    pendingRef.current = false
  }
}
