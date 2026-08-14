// Pure drag-and-drop move reducer for the FLAT (portfolio / Stories-as-flat)
// board — the `FlatColumn[]` sibling of `dnd.ts`'s `SprintSection[]` helpers.
// No React, no fetch — just flat columns in, flat columns out. `FlatBoard.tsx`/
// `App.tsx` wire this to dnd-kit and to the optimistic-write flow
// (applyLocalFlat + patchState + rollback), through `performFlatMove`.

import type { Board, WorkItem } from '../api/types'
import type { FlatColumn } from '../domain/board'
import { resolveTargetState } from './dnd'

export interface FlatMoveResult {
  next: FlatColumn[]
  undo: FlatColumn[]
  targetState: string
}

/** Finds a card by id across every flat column. */
export function findFlatCard(flatColumns: FlatColumn[], cardId: number): WorkItem | null {
  for (const { cards } of flatColumns) {
    const found = cards.find((c) => c.id === cardId)
    if (found) return found
  }
  return null
}

/**
 * Finds the name of the flat column that currently holds `cardId`. Used by
 * `performFlatMove`'s same-column guard — dropping a card back on its own
 * column must be a no-op, not a write.
 */
export function findFlatCardColumn(flatColumns: FlatColumn[], cardId: number): string | null {
  for (const { column, cards } of flatColumns) {
    if (cards.some((c) => c.id === cardId)) return column.name
  }
  return null
}

/**
 * Moves `cardId` to the flat column named `toColumn`, adopting that column's
 * resolved state for the card's type (via the shared `resolveTargetState`).
 *
 * Returns `null` when the card can't be found, when `toColumn` isn't a known
 * board column, when that column has no resolvable state for the card's type,
 * or when there's no flat-column bucket named `toColumn` to insert into (which
 * would otherwise drop the card). Never mutates `flatColumns` — `undo` is the
 * original array, safe to hand back to `applyLocalFlat` on rollback.
 */
export function moveFlatCard(
  flatColumns: FlatColumn[],
  cardId: number,
  toColumn: string,
  board: Board,
): FlatMoveResult | null {
  const card = findFlatCard(flatColumns, cardId)
  if (!card) return null

  const destColumn = board.columns.find((c) => c.name === toColumn)
  if (!destColumn) return null

  const targetState = resolveTargetState(destColumn, card.type)
  if (!targetState) return null

  // Guard against a target that has no bucket in this flat view — inserting
  // nowhere would silently drop the card.
  if (!flatColumns.some((fc) => fc.column.name === toColumn)) return null

  const updatedCard: WorkItem = { ...card, state: targetState }

  const next = flatColumns.map((fc) => {
    const withoutCard = fc.cards.filter((c) => c.id !== cardId)
    if (fc.column.name === toColumn) {
      return { ...fc, cards: [...withoutCard, updatedCard] }
    }
    // Only rebuild columns that actually held the card (otherwise keep the
    // same reference), mirroring dnd.ts's per-lane immutability discipline.
    return withoutCard.length === fc.cards.length ? fc : { ...fc, cards: withoutCard }
  })

  return { next, undo: flatColumns, targetState }
}

/**
 * Returns a new `flatColumns` array with `cardId`'s `rev` and `state` patched,
 * wherever the card sits. Used right after a successful `patchState` write to
 * reconcile the moved card with the server's authoritative response (fresh
 * `rev`) — same rationale as `dnd.ts`'s `withUpdatedCard`. Never mutates
 * `flatColumns`; always returns a fresh array.
 */
export function withUpdatedFlatCard(
  flatColumns: FlatColumn[],
  cardId: number,
  patch: Pick<WorkItem, 'rev' | 'state'>,
): FlatColumn[] {
  return flatColumns.map((fc) => {
    if (!fc.cards.some((c) => c.id === cardId)) return fc
    return { ...fc, cards: fc.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)) }
  })
}
