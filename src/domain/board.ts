// Domain transforms: raw work items + board config -> the rendered board
// structure (visible columns, task->column placement, sprint-section ->
// story-lane grouping). Tasks 7-9 (rendering, filters, drag-drop) build
// directly on these functions.

import type { Board, BoardColumn, Iteration, StateCategory, WorkItem } from '../api/types'

/** Drops columns whose name reads as retired (none on the real board today). */
export function visibleColumns(board: Board): BoardColumn[] {
  return board.columns.filter((c) => !/deprecated/i.test(c.name))
}

/**
 * Resolves the column a work item should render in. Originally written for
 * tasks (the doc below keeps that as the motivating example), but the logic
 * is generic over item type — it's used identically for stories/epics too
 * (see #3's level toggle).
 *
 * Three tiers, tried in order, each a superset of the last — this reconciles
 * the plan's synthetic-board tests (which give columns a `Task` key in
 * `stateMappings`) with the real board (which has none — see
 * docs/task-column-mapping.md):
 *
 *   Tier 0 — explicit mapping for this item's type, when the board has one:
 *            a column whose `stateMappings[item.type] === item.state`.
 *   Tier 1 — exact state-name match against ANY of the board's story types
 *            (the real board's Task and story states share early-lifecycle
 *            names like `New`, `IN REFINEMENT`, `READY FOR DEVELOPMENT`).
 *   Tier 2 — state-category fallback, via the passed `stateCategory` map
 *            (see `fetchStates` in `api/client.ts` — the live source of that
 *            map, since it's not baked into this module).
 *
 * Returns null when none of the tiers resolve a column.
 */
export function columnForItem(
  item: WorkItem,
  board: Board,
  itemTypes: string[],
  stateCategory: Record<string, StateCategory>,
): string | null {
  for (const c of board.columns) {
    if (c.stateMappings[item.type] === item.state) return c.name
  }

  for (const c of board.columns) {
    if (itemTypes.some((t) => c.stateMappings[t] === item.state)) return c.name
  }

  // Category fallback. Documented limitation: on the real board, the
  // InProgress category spans 6 columns (Active, Ready for Review, In
  // Review, Ready for PO Review, In PO Review, Ready for Release), so any
  // Task state without an exact-name match above — e.g. 'IN CODE REVIEW' or
  // 'READY FOR CODE REVIEW' — collapses onto the first InProgress column in
  // board order ('Active'), even though a human reading the board might
  // expect 'IN CODE REVIEW' to align with 'In Review'. This is a real,
  // unavoidable ambiguity of bucket-by-category, not a bug — see
  // docs/task-column-mapping.md section 3.
  const category = stateCategory[item.state]
  if (category) {
    for (const c of board.columns) {
      const rep = itemTypes.map((t) => c.stateMappings[t]).find(Boolean)
      if (rep && stateCategory[rep] === category) return c.name
    }
  }

  return null
}

export interface Lane {
  story: WorkItem | null
  tasksByColumn: Record<string, WorkItem[]>
  taskCount: number
}

export interface SprintSection {
  iteration: Iteration
  lanes: Lane[]
  noParentLane: Lane
  storyCount: number
  taskCount: number
}

/** Last path segment, e.g. 'Proj\\Sprint 3' -> 'Sprint 3'. */
function leafOf(path: string): string {
  const idx = path.lastIndexOf('\\')
  return idx === -1 ? path : path.slice(idx + 1)
}

/**
 * Matches an iteration path to a known team iteration by comparing leaf
 * segments (and, as a fallback, the iteration's display name — the two
 * coincide in every captured case). When nothing matches — the fixture data
 * has stories/tasks parked on sprints outside the team's configured
 * iterations (e.g. a bare project-root path, or a sprint the team iteration
 * list doesn't carry) — synthesize a placeholder iteration (no startDate, so
 * it sorts last) rather than silently dropping the work item's section.
 */
function resolveIteration(path: string, iterations: Iteration[]): Iteration {
  const leaf = leafOf(path)
  const match = iterations.find((it) => leafOf(it.path) === leaf || it.name === leaf)
  if (match) return match
  return { id: `unscheduled:${leaf}`, name: leaf, path }
}

function emptyLane(story: WorkItem | null): Lane {
  return { story, tasksByColumn: {}, taskCount: 0 }
}

/**
 * Adds `task` to `lane`, always counting it, and — when `columnForItem`
 * resolves a column — bucketing it there. A null mapping still counts
 * toward `taskCount` (the task is "in" this lane) but isn't placed in any
 * column bucket; callers that need to know how many tasks came back
 * unmapped can call `columnForItem` directly (see board.test.ts's fixture
 * regression test).
 */
function placeTask(
  lane: Lane,
  task: WorkItem,
  board: Board,
  storyTypes: string[],
  stateCategory: Record<string, StateCategory>,
): void {
  lane.taskCount += 1
  const column = columnForItem(task, board, storyTypes, stateCategory)
  if (column === null) return
  ;(lane.tasksByColumn[column] ??= []).push(task)
}

/**
 * Groups stories into sprint sections (newest iteration first) and places
 * every task into its parent story's lane — or, when its parent isn't among
 * the given stories (parent === null, or parent belongs to a story outside
 * this call's scope), into that section's `noParentLane`, grouped by the
 * task's own iteration.
 */
export function buildSections(
  stories: WorkItem[],
  tasks: WorkItem[],
  iterations: Iteration[],
  board: Board,
  storyTypes: string[],
  stateCategory: Record<string, StateCategory>,
): SprintSection[] {
  interface Group {
    iteration: Iteration
    storyIds: number[]
  }

  const groups = new Map<string, Group>()
  const laneByStoryId = new Map<number, Lane>()
  const groupKeyByStoryId = new Map<number, string>()

  const groupFor = (path: string): Group => {
    const iteration = resolveIteration(path, iterations)
    let group = groups.get(iteration.id)
    if (!group) {
      group = { iteration, storyIds: [] }
      groups.set(iteration.id, group)
    }
    return group
  }

  for (const story of stories) {
    const group = groupFor(story.iterationPath)
    group.storyIds.push(story.id)
    groupKeyByStoryId.set(story.id, group.iteration.id)
    laneByStoryId.set(story.id, emptyLane(story))
  }

  const noParentLaneByGroupKey = new Map<string, Lane>()
  const noParentLaneFor = (path: string): Lane => {
    const group = groupFor(path)
    let lane = noParentLaneByGroupKey.get(group.iteration.id)
    if (!lane) {
      lane = emptyLane(null)
      noParentLaneByGroupKey.set(group.iteration.id, lane)
    }
    return lane
  }

  for (const task of tasks) {
    const parentGroupKey = task.parent !== null ? groupKeyByStoryId.get(task.parent) : undefined
    if (task.parent !== null && parentGroupKey !== undefined) {
      placeTask(laneByStoryId.get(task.parent)!, task, board, storyTypes, stateCategory)
    } else {
      placeTask(noParentLaneFor(task.iterationPath), task, board, storyTypes, stateCategory)
    }
  }

  const sections: SprintSection[] = [...groups.values()].map((group) => {
    const lanes = group.storyIds.map((id) => laneByStoryId.get(id)!)
    const noParentLane = noParentLaneByGroupKey.get(group.iteration.id) ?? emptyLane(null)
    const taskCount = lanes.reduce((sum, l) => sum + l.taskCount, 0) + noParentLane.taskCount
    return {
      iteration: group.iteration,
      lanes,
      noParentLane,
      storyCount: lanes.length,
      taskCount,
    }
  })

  const startTime = (iteration: Iteration): number =>
    iteration.startDate ? Date.parse(iteration.startDate) : Number.NEGATIVE_INFINITY

  sections.sort((a, b) => {
    const at = startTime(a.iteration)
    const bt = startTime(b.iteration)
    if (at === Number.NEGATIVE_INFINITY && bt === Number.NEGATIVE_INFINITY) return 0
    return bt - at // descending (newest first); no-startDate sinks to the bottom
  })

  return sections
}

/** Columns that hold at least one task in this section, across every lane. */
export function nonEmptyColumns(section: SprintSection, columns: BoardColumn[]): BoardColumn[] {
  const lanes = [...section.lanes, section.noParentLane]
  return columns.filter((c) => lanes.some((l) => (l.tasksByColumn[c.name]?.length ?? 0) > 0))
}

/**
 * The columns a section should render: every given column when `showAll` is
 * on (the "show all columns" toggle — see `useShowAllColumns`), or just the
 * non-empty ones (today's default) otherwise.
 */
export function sectionColumns(section: SprintSection, columns: BoardColumn[], showAll: boolean): BoardColumn[] {
  return showAll ? columns : nonEmptyColumns(section, columns)
}

/** One column of a flat (non-lane) board view: a column and the cards in it. */
export interface FlatColumn {
  column: BoardColumn
  cards: WorkItem[]
}

/**
 * Places `items` directly into the board's visible columns, flat (no
 * story/task lane grouping) — the shape needed for a portfolio-level board
 * (Epics/Features), where there's no parent-story lane to nest under.
 *
 * Prefers the item's own `boardColumn` (its actual position on the ADO
 * board) when it names a visible column; falls back to `columnForItem`'s
 * three-tier resolution otherwise (e.g. `boardColumn` is null, or names a
 * column that isn't currently visible).
 */
export function buildFlatColumns(
  items: WorkItem[],
  board: Board,
  itemTypes: string[],
  stateCategory: Record<string, StateCategory>,
): FlatColumn[] {
  const cols = visibleColumns(board)
  const buckets = new Map<string, WorkItem[]>(cols.map((c) => [c.name, []]))
  for (const item of items) {
    const name = item.boardColumn && buckets.has(item.boardColumn) ? item.boardColumn : columnForItem(item, board, itemTypes, stateCategory)
    if (name && buckets.has(name)) buckets.get(name)!.push(item)
  }
  return cols.map((column) => ({ column, cards: buckets.get(column.name) ?? [] }))
}
