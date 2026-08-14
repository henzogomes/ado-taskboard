// Builds the demo board by feeding the synthetic dataset through the EXACT same
// domain builders the live path uses (`buildLevels`, `buildSections`,
// `buildFlatColumns`, `visibleColumns`) — so demo mode renders through the real
// pipeline, no bespoke fake rendering. Pure + synchronous: no network, no PAT.

import type { WorkItem } from '../api/types'
import { buildLevels } from '../board/level'
import { buildFlatColumns, buildSections, visibleColumns } from '../domain/board'
import { currentIterationId } from '../domain/currentIteration'
import type { BoardData, BoardScope } from '../hooks/useBoardData'
import { DEMO_BACKLOGS, DEMO_BOARD, DEMO_ITERATIONS, DEMO_STATE_CATEGORY } from './dataset'
import { demoWorkItems } from './runtime'

/** True when `itemPath` is the iteration path itself or a descendant of it. */
function isUnderPath(itemPath: string, iterationPath: string): boolean {
  return itemPath === iterationPath || itemPath.startsWith(`${iterationPath}\\`)
}

/**
 * Assembles the demo `BoardData` for the requested scope + level, mirroring
 * `loadBoardData`'s build phase but drawing every input from the in-memory demo
 * dataset (and applying the iteration-scope filter locally, in place of the
 * server-side WIQL filter).
 */
export function buildDemoBoardData(scope: BoardScope, levelId: string): BoardData {
  const backlogs = DEMO_BACKLOGS
  const board = DEMO_BOARD
  const iterations = DEMO_ITERATIONS
  const stateCategory = DEMO_STATE_CATEGORY

  const levels = buildLevels(backlogs)
  const view = levels.find((v) => v.id === levelId) ?? levels[0]

  const currentId = scope === 'current' ? currentIterationId(iterations, new Date()) : null
  const scopedIterationId = scope === 'current' ? currentId : typeof scope === 'string' ? null : scope.iterationId
  const scopedIteration = scopedIterationId ? iterations.find((it) => it.id === scopedIterationId) : undefined

  const inScope = (item: WorkItem): boolean => {
    // Portfolio views span sprints; requirement views under `'all'` (or an
    // unresolvable scope) aren't filtered either.
    if (!view.iterationScoped || scope === 'all' || !scopedIteration) return true
    return isUnderPath(item.iterationPath, scopedIteration.path)
  }

  const typeSet = new Set(view.types)
  const items = demoWorkItems().filter((item) => typeSet.has(item.type) && inScope(item))

  const base = {
    levelId: view.id,
    view,
    levels,
    columns: visibleColumns(board),
    iterations,
    stateCategory,
  }

  if (view.kind === 'lanes') {
    const storyTypes = backlogs.requirement.workItemTypes
    const taskTypes = backlogs.task.workItemTypes
    const storySet = new Set(storyTypes)
    const taskSet = new Set(taskTypes)
    const stories = items.filter((item) => storySet.has(item.type))
    const tasks = items.filter((item) => taskSet.has(item.type))
    const sections = buildSections(stories, tasks, iterations, board, storyTypes, stateCategory)
    return { ...base, sections, flatColumns: [] }
  }

  const flatColumns = buildFlatColumns(items, board, view.types, stateCategory)
  return { ...base, sections: [], flatColumns }
}
