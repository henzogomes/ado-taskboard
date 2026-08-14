// Orchestrates a LANE card's drop: the guarded, side-effecting flow that sits
// between dnd-kit's `onDragEnd` and the pure `moveCard` reducer. Pulled out
// of `App.tsx` so it's a plain async function tests can call directly with
// spies — no rendering, no simulated drag, no real ADO write (patchState is
// injected). All the guard/rollback/serialization logic lives in the shared
// `performMoveCore`; this file just binds it to the `SprintSection[]` reducers
// (its flat sibling is `performFlatMove`).

import type { Board, WorkItem } from '../api/types'
import type { SprintSection } from '../domain/board'
import { findCard, findCardColumn, moveCard, withUpdatedCard } from './dnd'
import { performMoveCore } from './performMoveCore'
import type { MoveOps, PerformMoveResult } from './performMoveCore'

export type { PerformMoveResult }

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
  /** Shared serialize-guard — see `performMoveCore`'s `pendingRef`. */
  pendingRef: { current: boolean }
}

const sprintOps: MoveOps<SprintSection[]> = {
  findCardColumn,
  findCard,
  moveCard,
  withUpdatedCard,
}

/** Lane-board move: thin binding of the shared core to the `SprintSection[]` reducers. */
export function performMove(args: PerformMoveArgs): Promise<PerformMoveResult> {
  const { sections, ...rest } = args
  return performMoveCore({ ...rest, data: sections, ops: sprintOps })
}
