// Orchestrates a FLAT card's drop (portfolio / Stories-as-flat views): the
// `FlatColumn[]` sibling of `performMove`. Same guarded flow — it just binds
// the shared `performMoveCore` to the `flatDnd.ts` reducers. Kept as a plain
// async function tests can drive with spies (no rendering, no real ADO write).

import type { Board, WorkItem } from '../api/types'
import type { FlatColumn } from '../domain/board'
import { findFlatCard, findFlatCardColumn, moveFlatCard, withUpdatedFlatCard } from './flatDnd'
import { performMoveCore } from './performMoveCore'
import type { MoveOps, PerformMoveResult } from './performMoveCore'

export type { PerformMoveResult }

export interface PerformFlatMoveArgs {
  /** The CURRENT (unfiltered) flat columns — callers should read this from a ref, not a stale closure. */
  flatColumns: FlatColumn[]
  cardId: number
  toColumn: string
  board: Board
  applyLocalFlat: (next: FlatColumn[]) => void
  patchState: (id: number, state: string, boardColumn: string | null, rev: number) => Promise<WorkItem>
  refresh: () => void
  onToast: (message: string) => void
  /** Shared serialize-guard — the SAME ref the lane board uses, so moves serialize across both views. */
  pendingRef: { current: boolean }
}

const flatOps: MoveOps<FlatColumn[]> = {
  findCardColumn: findFlatCardColumn,
  findCard: findFlatCard,
  moveCard: moveFlatCard,
  withUpdatedCard: withUpdatedFlatCard,
}

/** Flat-board move: thin binding of the shared core to the `FlatColumn[]` reducers. */
export function performFlatMove(args: PerformFlatMoveArgs): Promise<PerformMoveResult> {
  const { flatColumns, applyLocalFlat, ...rest } = args
  return performMoveCore({ ...rest, data: flatColumns, applyLocal: applyLocalFlat, ops: flatOps })
}
