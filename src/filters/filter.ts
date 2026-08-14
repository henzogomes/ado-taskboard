// Client-side filtering: narrows an already-built board (Task 5's
// `SprintSection[]`) by developer / tag / state without re-fetching ADO.
// Pure and immutable — App.tsx recomputes `visible` on every filter change.

import type { WorkItem } from '../api/types'
import type { FlatColumn, Lane, SprintSection } from '../domain/board'

export interface Filters {
  devs: string[]
  tags: string[]
  states: string[]
  search: string
}

/**
 * True when `query` (already trimmed + lowercased) is a substring of the
 * item's title, `#<id>`/`<id>`, assignee displayName, or any tag.
 */
function matchesSearch(item: WorkItem, query: string): boolean {
  if (query === '') return true
  if (item.title.toLowerCase().includes(query)) return true
  if (String(item.id).includes(query) || `#${item.id}`.includes(query)) return true
  if (item.assignedTo && item.assignedTo.displayName.toLowerCase().includes(query)) return true
  if (item.tags.some((tag) => tag.toLowerCase().includes(query))) return true
  return false
}

/**
 * A work item (story or task) matches iff it satisfies every ACTIVE facet
 * (an empty facet array is match-all for that facet). `tags` is an ANY
 * match — the item needs at least one of the selected tags, not all.
 * A null `assignedTo` only survives when the `devs` facet is empty.
 * `search` is AND-ed with the facets: an empty search matches everything.
 */
function matches(item: WorkItem, f: Filters): boolean {
  if (f.devs.length > 0 && (!item.assignedTo || !f.devs.includes(item.assignedTo.displayName))) return false
  if (f.tags.length > 0 && !item.tags.some((tag) => f.tags.includes(tag))) return false
  if (f.states.length > 0 && !f.states.includes(item.state)) return false
  if (!matchesSearch(item, f.search.trim().toLowerCase())) return false
  return true
}

/**
 * Filters every column's tasks, dropping columns left with no survivors.
 * Preserves column order. Known limitation: this only ever sees tasks
 * `buildSections` managed to place in a column bucket — a task whose
 * `columnForItem` resolved to null is counted in the lane's `taskCount` but
 * never appears in `tasksByColumn`, so under ACTIVE filters it is invisible
 * to matching and can't survive (none exist on the real board today; see
 * the `applyFilters` no-op short-circuit below for why this doesn't break
 * the empty-filter case).
 */
function filterTasksByColumn(
  tasksByColumn: Record<string, WorkItem[]>,
  f: Filters,
): { tasksByColumn: Record<string, WorkItem[]>; taskCount: number } {
  const result: Record<string, WorkItem[]> = {}
  let taskCount = 0
  for (const [column, tasks] of Object.entries(tasksByColumn)) {
    const survivors = tasks.filter((task) => matches(task, f))
    if (survivors.length > 0) {
      result[column] = survivors
      taskCount += survivors.length
    }
  }
  return { tasksByColumn: result, taskCount }
}

/**
 * Keeps a lane if its story matches the active facets, OR it has ≥1
 * surviving task. A `noParentLane` (story === null) can only survive via
 * the second branch.
 */
function keepLane(originalStory: WorkItem | null, filtered: Lane, f: Filters): boolean {
  if (filtered.taskCount > 0) return true
  return originalStory !== null && matches(originalStory, f)
}

/**
 * Returns NEW sections narrowed to the tasks (and lanes) that match `f`.
 * Never mutates `sections`. Section/lane/column ordering is preserved;
 * `storyCount`/`taskCount` (section) and `taskCount` (lane) are recomputed
 * from the surviving items.
 *
 * Empty filters are guaranteed an exact no-op: `sections` is returned as-is
 * (same reference), with NO recomputation. This matters because a lane's
 * `taskCount` (set by `buildSections`) counts every task, including one
 * `columnForItem` couldn't bucket into `tasksByColumn` — recomputing counts
 * from surviving buckets would silently shrink such a lane, or drop a
 * `noParentLane` made only of unbucketed tasks, even with nothing filtered.
 */
export function applyFilters(sections: SprintSection[], f: Filters): SprintSection[] {
  if (f.devs.length === 0 && f.tags.length === 0 && f.states.length === 0 && f.search.trim() === '') return sections

  return sections.map((section) => {
    const lanes: Lane[] = []
    for (const lane of section.lanes) {
      const { tasksByColumn, taskCount } = filterTasksByColumn(lane.tasksByColumn, f)
      const filtered: Lane = { story: lane.story, tasksByColumn, taskCount }
      if (keepLane(lane.story, filtered, f)) lanes.push(filtered)
    }

    // noParentLane's story is always null, so `keepLane` only ever keeps it
    // via the taskCount>0 branch — which is exactly what a plain filtered
    // lane already is when it has zero survivors (empty tasksByColumn,
    // taskCount 0), so no separate empty-lane fallback is needed here.
    const noParentLane: Lane = { story: null, ...filterTasksByColumn(section.noParentLane.tasksByColumn, f) }

    const taskCount = lanes.reduce((sum, lane) => sum + lane.taskCount, 0) + noParentLane.taskCount

    return {
      iteration: section.iteration,
      lanes,
      noParentLane,
      storyCount: lanes.length,
      taskCount,
    }
  })
}

/**
 * Distinct, alphabetically sorted devs/tags/states across every work item
 * (stories AND tasks) in `sections` — used to populate the filter UI.
 */
export function collectFacets(sections: SprintSection[]): Filters {
  const devs = new Set<string>()
  const tags = new Set<string>()
  const states = new Set<string>()

  const visit = (item: WorkItem | null): void => {
    if (!item) return
    if (item.assignedTo) devs.add(item.assignedTo.displayName)
    for (const tag of item.tags) tags.add(tag)
    states.add(item.state)
  }

  for (const section of sections) {
    for (const lane of [...section.lanes, section.noParentLane]) {
      visit(lane.story)
      for (const tasks of Object.values(lane.tasksByColumn)) {
        for (const task of tasks) visit(task)
      }
    }
  }

  return {
    devs: [...devs].sort(),
    tags: [...tags].sort(),
    states: [...states].sort(),
    search: '',
  }
}

/**
 * Distinct, alphabetically sorted devs/tags/states across every card in a flat
 * (portfolio/requirement-flat) board view — the `collectFacets` analogue for
 * `FlatColumn[]`.
 */
export function collectFacetsFlat(flatColumns: FlatColumn[]): Filters {
  const devs = new Set<string>()
  const tags = new Set<string>()
  const states = new Set<string>()

  for (const { cards } of flatColumns) {
    for (const item of cards) {
      if (item.assignedTo) devs.add(item.assignedTo.displayName)
      for (const tag of item.tags) tags.add(tag)
      states.add(item.state)
    }
  }

  return { devs: [...devs].sort(), tags: [...tags].sort(), states: [...states].sort(), search: '' }
}

/**
 * Narrows each flat column's cards to those matching `f`, preserving column
 * order (columns may be left empty — the view decides visibility). Empty
 * filters are an exact no-op: `flatColumns` is returned by reference.
 */
export function applyFiltersFlat(flatColumns: FlatColumn[], f: Filters): FlatColumn[] {
  if (f.devs.length === 0 && f.tags.length === 0 && f.states.length === 0 && f.search.trim() === '') return flatColumns
  return flatColumns.map(({ column, cards }) => ({ column, cards: cards.filter((item) => matches(item, f)) }))
}
