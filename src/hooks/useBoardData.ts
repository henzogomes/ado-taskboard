import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchBacklogs,
  fetchBoard,
  fetchProjectIterations,
  fetchStates,
  fetchWorkItems,
  queryWorkItemIds,
  resolveTeam,
} from '../api/client'
import type { BoardColumn, Iteration, StateCategory } from '../api/types'
import { CONFIG } from '../config'
import { getActive } from '../connections/store'
import { buildFlatColumns, buildSections, visibleColumns } from '../domain/board'
import type { FlatColumn, SprintSection } from '../domain/board'
import { buildLevels } from '../board/level'
import type { LevelView } from '../board/level'
import { currentIterationId } from '../domain/currentIteration'

/**
 * What slice of the board to load:
 *  - `'all'`     — every iteration in the project (no iteration filter).
 *  - `'current'` — the sprint containing today's date (`currentIterationId`,
 *    computed from iteration start/finish dates — NOT the ADO team
 *    timeframe, which only reflects sprints the team subscribed to).
 *  - `{ iterationId }` — one specific iteration, by its `Iteration.id`.
 */
export type BoardScope = 'all' | 'current' | { iterationId: string }

export interface UseBoardDataResult {
  /** The resolved level id (may differ from the requested one if it fell back). */
  levelId: string
  /** The resolved level view (null until the first load settles). */
  view: LevelView | null
  /** All discovered levels for the active project — drives the LevelPicker. */
  levels: LevelView[]
  /** Populated when `view.kind === 'lanes'` (the Tasks view); else empty. */
  sections: SprintSection[]
  /** Populated when `view.kind === 'flat'` (Stories/portfolio views); else empty. */
  flatColumns: FlatColumn[]
  columns: BoardColumn[]
  iterations: Iteration[]
  loading: boolean
  error: Error | null
  lastUpdated: Date | null
  refresh: () => void
  applyLocal: (next: SprintSection[]) => void
  stateCategory: Record<string, StateCategory>
}

function scopeKeyOf(scope: BoardScope): string {
  return typeof scope === 'string' ? scope : `iteration:${scope.iterationId}`
}

/**
 * Iteration paths (tree nodes) the WIQL query should be filtered under, for
 * the given scope. `'current'` is resolved by the caller via
 * `currentIterationId` (date-based — the ADO team timeframe can't be trusted
 * to include every project sprint) and passed in as `currentId`; if that's
 * `null` (e.g. today is before every iteration's start), this falls back to
 * the chronologically-last iteration rather than crashing or scoping to
 * nothing.
 */
function scopePaths(scope: BoardScope, iterations: Iteration[], currentId: string | null): string[] {
  if (scope === 'all') return []
  if (scope === 'current') {
    const id = currentId ?? iterations[iterations.length - 1]?.id
    const match = iterations.find((it) => it.id === id)
    return match ? [match.path] : []
  }
  const match = iterations.find((it) => it.id === scope.iterationId)
  return match ? [match.path] : []
}

const escapeWiqlLiteral = (s: string): string => s.replace(/'/g, "''")

/** Chronological order (earliest first); iterations without a startDate sink to the end. */
function sortIterationsChronologically(iterations: Iteration[]): Iteration[] {
  const startTime = (it: Iteration): number => (it.startDate ? Date.parse(it.startDate) : Number.POSITIVE_INFINITY)
  return [...iterations].sort((a, b) => startTime(a) - startTime(b))
}

/**
 * Selects the discovered story + task work-item types for the project,
 * optionally narrowed to one or more iteration-path subtrees. Stories and
 * Tasks are queried together (rather than stories-then-children) so orphaned
 * tasks whose parent lies outside the scope still surface into `noParentLane`.
 */
function buildWiql(project: string, paths: string[], types: string[]): string {
  const typeList = types.map((t) => `'${escapeWiqlLiteral(t)}'`).join(', ')
  const base = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${escapeWiqlLiteral(project)}' AND [System.WorkItemType] IN (${typeList})`
  if (paths.length === 0) return `${base} ORDER BY [System.Id]`
  const iterationClause = paths.map((p) => `[System.IterationPath] UNDER '${escapeWiqlLiteral(p)}'`).join(' OR ')
  return `${base} AND (${iterationClause}) ORDER BY [System.Id]`
}

interface BoardData {
  levelId: string
  view: LevelView
  levels: LevelView[]
  sections: SprintSection[]
  flatColumns: FlatColumn[]
  columns: BoardColumn[]
  iterations: Iteration[]
  stateCategory: Record<string, StateCategory>
}

// Stable empty fallbacks: returning a fresh `[]`/`{}` each render would make the
// hook's array/object results change reference every render, which thrashes
// consumers that use them as effect/memo deps (e.g. App feeds `levels` into an
// effect). Same referential-stability discipline as the connections store.
const EMPTY_LEVELS: LevelView[] = []
const EMPTY_SECTIONS: SprintSection[] = []
const EMPTY_FLAT: FlatColumn[] = []
const EMPTY_COLUMNS: BoardColumn[] = []
const EMPTY_ITERATIONS: Iteration[] = []
const EMPTY_STATE_CATEGORY: Record<string, StateCategory> = {}

/**
 * Loads the board: resolves the team, fetches the board config + iterations
 * in parallel, queries + fetches the in-scope work items, and builds the
 * sprint-section structure `Board`/`SprintSection`/`Lane` render.
 *
 * `iterations` is the project's *full*, unscoped iteration list (chronological,
 * earliest first) — independent of `sections`, which only ever contains
 * iterations that ended up with a story or orphan task. Consumers like
 * `IterationPicker` should enumerate sprints from `iterations`, not by
 * mapping over `sections`, so an iteration with zero work items can still
 * appear as a pickable option.
 */
async function loadBoardData(scope: BoardScope, levelId: string): Promise<BoardData> {
  const team = await resolveTeam()
  const backlogs = await fetchBacklogs(team)
  const levels = buildLevels(backlogs)
  // Resolve the requested level; fall back to the first (Tasks) if it isn't in
  // this project's discovered levels (e.g. a persisted 'initiatives' after
  // switching to a project that has none).
  const view = levels.find((v) => v.id === levelId) ?? levels[0]

  // Requirement-level views (Tasks, Stories) can honor a per-connection board
  // override; portfolio views use their own discovered board name.
  const boardName = view.iterationScoped ? CONFIG.board || view.boardName : view.boardName

  const [board, fetchedIterations, stateCategory] = await Promise.all([
    fetchBoard(team, boardName),
    fetchProjectIterations(),
    fetchStates(view.types),
  ])
  const sortedIterations = sortIterationsChronologically(fetchedIterations)
  const currentId = scope === 'current' ? currentIterationId(sortedIterations, new Date()) : null
  // Portfolio views span sprints (not iteration-scoped) → no path filter.
  const paths = view.iterationScoped ? scopePaths(scope, sortedIterations, currentId) : []
  const wiql = buildWiql(CONFIG.project, paths, view.types)
  const ids = await queryWorkItemIds(wiql)
  const items = await fetchWorkItems(ids)

  const base = {
    levelId: view.id,
    view,
    levels,
    columns: visibleColumns(board),
    // The full iteration list (unscoped by `scope`) so IterationPicker can
    // always enumerate every sprint — including ones with zero work items.
    iterations: sortedIterations,
    stateCategory,
  }

  if (view.kind === 'lanes') {
    // Tasks view: split the queried items into stories + tasks and build the
    // sprint-section/lane structure. `view.types` already unions both.
    const storyTypes = backlogs.requirement.workItemTypes
    const taskTypes = backlogs.task.workItemTypes
    const storySet = new Set(storyTypes)
    const taskSet = new Set(taskTypes)
    const stories = items.filter((item) => storySet.has(item.type))
    const tasks = items.filter((item) => taskSet.has(item.type))
    const sections = buildSections(stories, tasks, sortedIterations, board, storyTypes, stateCategory)
    return { ...base, sections, flatColumns: [] }
  }

  // Flat view (Stories-as-flat or a portfolio level): one Kanban of the level's
  // own items across the board's columns.
  const flatColumns = buildFlatColumns(items, board, view.types, stateCategory)
  return { ...base, sections: [], flatColumns }
}

/**
 * `applyLocal` lets a caller (Task 9's drag-and-drop) swap in an optimistic
 * `SprintSection[]` without a full refetch (via `queryClient.setQueryData`);
 * `refresh()` re-runs the load, bypassing `staleTime` (via `refetch()`).
 */
export function useBoardData(scope: BoardScope, levelId: string): UseBoardDataResult {
  const queryClient = useQueryClient()
  const scopeKey = scopeKeyOf(scope)
  // Scope the cache by the active connection's id (never the PAT/org) so
  // switching connections yields a fresh query rather than serving another
  // connection's cached board. `levelId` is part of the key so each level is
  // cached independently and switching levels refetches.
  const activeId = getActive()?.id ?? 'none'
  const queryKey = ['board', activeId, scopeKey, levelId]

  const { data, isPending, error, dataUpdatedAt, refetch } = useQuery({
    queryKey,
    queryFn: () => loadBoardData(scope, levelId),
  })

  const refresh = useCallback(() => {
    void refetch()
  }, [refetch])

  const applyLocal = useCallback(
    (next: SprintSection[]) => {
      queryClient.setQueryData<BoardData>(['board', activeId, scopeKey, levelId], (old) =>
        old ? { ...old, sections: next } : old,
      )
    },
    [queryClient, activeId, scopeKey, levelId],
  )

  return {
    levelId: data?.levelId ?? levelId,
    view: data?.view ?? null,
    levels: data?.levels ?? EMPTY_LEVELS,
    sections: data?.sections ?? EMPTY_SECTIONS,
    flatColumns: data?.flatColumns ?? EMPTY_FLAT,
    columns: data?.columns ?? EMPTY_COLUMNS,
    iterations: data?.iterations ?? EMPTY_ITERATIONS,
    loading: isPending,
    error: (error as Error) ?? null,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    refresh,
    applyLocal,
    stateCategory: data?.stateCategory ?? EMPTY_STATE_CATEGORY,
  }
}
