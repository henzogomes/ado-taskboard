// The shape-agnostic heart of a card move: the guarded, side-effecting flow
// that sits between dnd-kit's `onDragEnd` (or a Move-menu pick) and a pure
// move reducer. Both the lane board (`SprintSection[]`, via `performMove`)
// and the flat board (`FlatColumn[]`, via `performFlatMove`) delegate here so
// the guards/rollback/serialization logic lives in exactly ONE place — the
// only difference between the two is the pure data-shape ops injected below.

import type { Board, WorkItem } from '../api/types'

export type PerformMoveResult = 'noop' | 'ok' | 'failed'

/**
 * The pure, shape-specific operations the core needs. `T` is the board data
 * shape (`SprintSection[]` or `FlatColumn[]`). Each implementation is the
 * matching pure reducer from `dnd.ts` / `flatDnd.ts`.
 */
export interface MoveOps<T> {
  /** Name of the column currently holding the card, or null if unknown. */
  findCardColumn: (data: T, cardId: number) => string | null
  /** The card itself (for its current `rev`/`state`), or null if unknown. */
  findCard: (data: T, cardId: number) => WorkItem | null
  /** Computes the move; null when it can't resolve (unknown column / no state). */
  moveCard: (data: T, cardId: number, toColumn: string, board: Board) => { next: T; undo: T; targetState: string } | null
  /** Reconciles the moved card's `rev`/`state` from the server response. */
  withUpdatedCard: (data: T, cardId: number, patch: Pick<WorkItem, 'rev' | 'state'>) => T
}

export interface PerformMoveCoreArgs<T> {
  /** The CURRENT (unfiltered) board data — callers should read this from a ref, not a stale closure. */
  data: T
  cardId: number
  toColumn: string
  board: Board
  applyLocal: (next: T) => void
  patchState: (id: number, state: string, boardColumn: string | null, rev: number) => Promise<WorkItem>
  refresh: () => void
  onToast: (message: string) => void
  /**
   * Serializes writes: a shared `{ current: boolean }` (typically a
   * `useRef(false)`) the caller holds across drops. While `true`, every move
   * call is ignored ('noop') so at most one optimistic move — and its
   * whole-board `undo` snapshot — is ever in flight. Lane and flat moves share
   * the SAME ref so they serialize against each other, not just among
   * themselves.
   */
  pendingRef: { current: boolean }
  /** The pure, shape-specific reducers for this board shape. */
  ops: MoveOps<T>
}

/**
 * Moves `cardId` to `toColumn`, guarding against writes that would have no
 * effect and against overlapping writes, then applies optimistically and
 * rolls back on failure.
 *
 * Returns `'noop'` when: a write is already pending; the card can't be found;
 * the drop targets the card's current column (no-op reorder); the destination
 * column's mapped state equals the card's current state (two columns mapping
 * to one state — nothing would change, and a refresh would immediately undo
 * the move); or the reducer itself can't resolve the move (unknown column / no
 * resolvable state).
 *
 * Returns `'ok'` after a successful optimistic apply + write + silent refresh,
 * or `'failed'` after a rolled-back write (with `onToast` called).
 */
export async function performMoveCore<T>(args: PerformMoveCoreArgs<T>): Promise<PerformMoveResult> {
  const { data, cardId, toColumn, board, applyLocal, patchState, refresh, onToast, pendingRef, ops } = args

  if (pendingRef.current) return 'noop' // a write is already in flight — ignore this drop

  const currentColumn = ops.findCardColumn(data, cardId)
  if (currentColumn === null) return 'noop' // unknown card
  if (currentColumn === toColumn) return 'noop' // dropped back on its own column — no-op

  const result = ops.moveCard(data, cardId, toColumn, board)
  if (!result) return 'noop' // unknown destination column, or no resolvable state

  const { next, undo, targetState } = result

  const card = ops.findCard(data, cardId)
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
    // second consecutive move on the same card can read `data` before
    // refresh() lands, sending patchState's now-stale `rev` and getting
    // rejected with a 412 by ADO's optimistic-concurrency guard.
    applyLocal(ops.withUpdatedCard(next, cardId, { rev: updated.rev, state: updated.state }))
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
