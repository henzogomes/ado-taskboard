// Pure drag-and-drop move reducer. No React, no fetch — just sections in,
// sections out. `Board.tsx`/`App.tsx` wire this to dnd-kit and to the
// optimistic-write flow (applyLocal + patchState + rollback).

import type { Board, BoardColumn, WorkItem } from '../api/types'
import type { Lane, SprintSection } from '../domain/board'

export interface MoveResult {
  next: SprintSection[]
  undo: SprintSection[]
  targetState: string
}

/** Finds a task by id across every lane (including each section's noParentLane). */
export function findCard(sections: SprintSection[], cardId: number): WorkItem | null {
  for (const section of sections) {
    for (const lane of [...section.lanes, section.noParentLane]) {
      for (const tasks of Object.values(lane.tasksByColumn)) {
        const found = tasks.find((t) => t.id === cardId)
        if (found) return found
      }
    }
  }
  return null
}

/**
 * Finds the name of the column that currently holds `cardId` (the bucket
 * key in some lane's `tasksByColumn`), across every lane/section. Used by
 * `performMove`'s same-position guard — dropping a card back on its own
 * column must be a no-op, not a write.
 */
export function findCardColumn(sections: SprintSection[], cardId: number): string | null {
  for (const section of sections) {
    for (const lane of [...section.lanes, section.noParentLane]) {
      for (const [column, tasks] of Object.entries(lane.tasksByColumn)) {
        if (tasks.some((t) => t.id === cardId)) return column
      }
    }
  }
  return null
}

/**
 * Resolves the state a card adopts when dropped on `column`. Prefers an
 * exact mapping for the card's own type; the real board has no `Task` key
 * in `stateMappings`, so a Task dropped on a column falls back to whatever
 * story-type mapping that column does carry — consistent with
 * `columnForItem`'s reverse-mapping tiers in `domain/board.ts`, without
 * hardcoding which story type the board uses.
 */
export function resolveTargetState(column: BoardColumn, cardType: string): string | null {
  return column.stateMappings[cardType] ?? Object.values(column.stateMappings).find(Boolean) ?? null
}

/**
 * Removes `cardId` from `lane` (wherever it currently sits) and, if it was
 * found there, inserts `updatedCard` into `toColumn`'s bucket. Lanes that
 * don't hold the card are returned unchanged (same reference) — only the
 * affected lane is rebuilt, and only with new arrays/objects, never by
 * mutating `lane` itself.
 */
function removeAndMaybeInsert(lane: Lane, cardId: number, toColumn: string, updatedCard: WorkItem): Lane {
  const hasCard = Object.values(lane.tasksByColumn).some((tasks) => tasks.some((t) => t.id === cardId))
  if (!hasCard) return lane

  const tasksByColumn: Record<string, WorkItem[]> = {}
  for (const [column, tasks] of Object.entries(lane.tasksByColumn)) {
    const filtered = tasks.filter((t) => t.id !== cardId)
    if (filtered.length > 0) tasksByColumn[column] = filtered
  }
  tasksByColumn[toColumn] = [...(tasksByColumn[toColumn] ?? []), updatedCard]

  // Moving within a lane never changes how many tasks the lane holds.
  return { ...lane, tasksByColumn, taskCount: lane.taskCount }
}

/**
 * Moves `cardId` to `toColumn`, in whichever lane it's currently in.
 *
 * Returns `null` when the card can't be found, when `toColumn` isn't a
 * known column, or when that column has no resolvable state for the card's
 * type (nothing to move to). Never mutates `sections` — `undo` is simply
 * the original array, safe to hand back to `applyLocal` on rollback.
 */
export function moveCard(
  sections: SprintSection[],
  cardId: number,
  toColumn: string,
  board: Board,
): MoveResult | null {
  const card = findCard(sections, cardId)
  if (!card) return null

  const destColumn = board.columns.find((c) => c.name === toColumn)
  if (!destColumn) return null

  const targetState = resolveTargetState(destColumn, card.type)
  if (!targetState) return null

  const updatedCard: WorkItem = { ...card, state: targetState }

  const next = sections.map((section) => ({
    ...section,
    lanes: section.lanes.map((lane) => removeAndMaybeInsert(lane, cardId, toColumn, updatedCard)),
    noParentLane: removeAndMaybeInsert(section.noParentLane, cardId, toColumn, updatedCard),
  }))

  return { next, undo: sections, targetState }
}

/**
 * Patches `cardId`'s fields (wherever it sits in `lane`'s columns) with
 * `patch`, returning a new `Lane`. Lanes that don't hold the card are
 * returned unchanged (same reference) — only the affected lane is rebuilt,
 * and only with new arrays/objects, never by mutating `lane` itself.
 */
function patchLaneCard(lane: Lane, cardId: number, patch: Pick<WorkItem, 'rev' | 'state'>): Lane {
  const hasCard = Object.values(lane.tasksByColumn).some((tasks) => tasks.some((t) => t.id === cardId))
  if (!hasCard) return lane

  const tasksByColumn: Record<string, WorkItem[]> = {}
  for (const [column, tasks] of Object.entries(lane.tasksByColumn)) {
    tasksByColumn[column] = tasks.map((t) => (t.id === cardId ? { ...t, ...patch } : t))
  }
  return { ...lane, tasksByColumn }
}

/**
 * Returns a new `sections` array with `cardId`'s `rev` and `state` patched
 * to the given values, wherever the card currently sits. Used right after a
 * successful `patchState` write to reconcile the moved card with the
 * server's authoritative response (fresh `rev`) — without waiting on the
 * async `refresh()`, whose result may not land before the next drop reads
 * `sections` and sends a now-stale `rev`, causing ADO's optimistic-
 * concurrency guard to reject the PATCH with a 412.
 *
 * Never mutates `sections`; every other card, lane, and section is
 * untouched (only the branch containing `cardId` is rebuilt).
 */
export function withUpdatedCard(
  sections: SprintSection[],
  cardId: number,
  patch: Pick<WorkItem, 'rev' | 'state'>,
): SprintSection[] {
  return sections.map((section) => ({
    ...section,
    lanes: section.lanes.map((lane) => patchLaneCard(lane, cardId, patch)),
    noParentLane: patchLaneCard(section.noParentLane, cardId, patch),
  }))
}
