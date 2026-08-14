import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildFlatColumns, buildSections, columnForItem, nonEmptyColumns, sectionColumns, visibleColumns } from './board'
import type { Board, Iteration, StateCategory, WorkItem } from '../api/types'

// Equivalent to the old baked STATE_CATEGORY constant (deleted in Task 5 —
// stateCategory is now always passed in, sourced live from `fetchStates`),
// so the MyProject-fixture tests below assert the exact same behavior as before.
const scStoryTypes = ['User Story']
const scStateCategory: Record<string, StateCategory> = {
  New: 'Proposed',
  'IN REFINEMENT': 'Proposed',
  'READY FOR DEVELOPMENT': 'Proposed',
  Active: 'InProgress',
  'IN DEVELOPMENT': 'InProgress',
  'READY FOR CODE REVIEW': 'InProgress',
  'IN CODE REVIEW': 'InProgress',
  BLOCKED: 'InProgress',
  'READY FOR REVIEW': 'InProgress',
  'IN REVIEW': 'InProgress',
  'READY FOR PO REVIEW': 'InProgress',
  'IN PO REVIEW': 'InProgress',
  'READY FOR RELEASE': 'InProgress',
  Closed: 'Completed',
  Removed: 'Removed',
  CANCELLED: 'Removed',
}

const board: Board = {
  columns: [
    { name: 'New', columnType: 'incoming', isSplit: false, stateMappings: { 'User Story': 'New', Task: 'New' } },
    {
      name: 'In Development',
      columnType: 'inProgress',
      isSplit: false,
      stateMappings: { 'User Story': 'Active', Task: 'Active' },
    },
    {
      name: 'Resolved',
      columnType: 'outgoing',
      isSplit: false,
      stateMappings: { 'User Story': 'Resolved', Task: 'Closed' },
    },
    { name: 'In Retest (deprecated)', columnType: 'inProgress', isSplit: false, stateMappings: {} },
  ],
}
const task = (id: number, state: string, parent: number | null, iter: string): WorkItem => ({
  id,
  rev: 1,
  type: 'Task',
  title: `t${id}`,
  state,
  boardColumn: null,
  assignedTo: null,
  tags: [],
  parent,
  iterationPath: iter,
})
const story = (id: number, iter: string): WorkItem => ({
  id,
  rev: 1,
  type: 'User Story',
  title: `s${id}`,
  state: 'Active',
  boardColumn: 'In Development',
  assignedTo: null,
  tags: [],
  parent: null,
  iterationPath: iter,
})
const iters: Iteration[] = [
  { id: '1', name: 'Sprint 1', path: 'P\\Sprint 1', startDate: '2026-01-01' },
  { id: '2', name: 'Sprint 2', path: 'P\\Sprint 2', startDate: '2026-02-01' },
]

describe('visibleColumns', () => {
  it('drops deprecated columns', () => {
    expect(visibleColumns(board).map((c) => c.name)).toEqual(['New', 'In Development', 'Resolved'])
  })
})

describe('columnForItem', () => {
  it('maps a Closed task to the Resolved column via stateMappings', () => {
    expect(columnForItem(task(1, 'Closed', 1, 'P\\Sprint 1'), board, scStoryTypes, scStateCategory)).toBe('Resolved')
  })

  it('documents the real-board limitation: InProgress-category Task states collapse onto the first InProgress column', () => {
    // Real-shaped board (see docs/task-column-mapping.md):
    // no column carries a `Task` key in stateMappings, so Tier 0 always
    // misses for Task items. 'IN CODE REVIEW' has no exact-name match in
    // any column's `User Story` mapping either (Tier 1 misses too), so it
    // falls to the Tier 2 category fallback, which picks the FIRST
    // InProgress-category column in board order — 'Active' — even though a
    // human would expect it to align with 'In Review'. Pinned here so the
    // limitation is documented, not silently hidden.
    const realShapedBoard: Board = {
      columns: [
        { name: 'New', columnType: 'incoming', isSplit: false, stateMappings: { 'User Story': 'New', Bug: 'New' } },
        {
          name: 'Prioritized',
          columnType: 'inProgress',
          isSplit: false,
          stateMappings: { 'User Story': 'New', Bug: 'New' },
        },
        {
          name: 'In Refinement',
          columnType: 'inProgress',
          isSplit: false,
          stateMappings: { 'User Story': 'IN REFINEMENT', Bug: 'IN REFINEMENT' },
        },
        {
          name: 'Ready for Agent',
          columnType: 'inProgress',
          isSplit: false,
          stateMappings: { 'User Story': 'READY FOR DEVELOPMENT', Bug: 'New' },
        },
        {
          name: 'Active',
          columnType: 'inProgress',
          isSplit: false,
          stateMappings: { 'User Story': 'Active', Bug: 'Active' },
        },
        {
          name: 'Ready for Review',
          columnType: 'inProgress',
          isSplit: false,
          stateMappings: { 'User Story': 'READY FOR REVIEW', Bug: 'READY FOR REVIEW' },
        },
        {
          name: 'In Review',
          columnType: 'inProgress',
          isSplit: false,
          stateMappings: { 'User Story': 'IN REVIEW', Bug: 'IN REVIEW' },
        },
        {
          name: 'Ready for PO Review',
          columnType: 'inProgress',
          isSplit: false,
          stateMappings: { 'User Story': 'READY FOR PO REVIEW', Bug: 'READY FOR PO REVIEW' },
        },
        {
          name: 'In PO Review',
          columnType: 'inProgress',
          isSplit: false,
          stateMappings: { 'User Story': 'IN PO REVIEW', Bug: 'IN PO REVIEW' },
        },
        {
          name: 'Ready for Release',
          columnType: 'inProgress',
          isSplit: false,
          stateMappings: { 'User Story': 'READY FOR RELEASE', Bug: 'READY FOR RELEASE' },
        },
        {
          name: 'Closed',
          columnType: 'outgoing',
          isSplit: false,
          stateMappings: { 'User Story': 'Closed', Bug: 'Closed' },
        },
      ],
    }
    const codeReviewTask = task(819971, 'IN CODE REVIEW', 818300, 'P\\Sprint 1')
    expect(columnForItem(codeReviewTask, realShapedBoard, scStoryTypes, scStateCategory)).toBe('Active')
  })

  it('returns null when no tier resolves a column', () => {
    const noMappingsBoard: Board = { columns: [{ name: 'X', columnType: 'incoming', isSplit: false, stateMappings: {} }] }
    expect(columnForItem(task(1, 'Whatever', null, 'P\\Sprint 1'), noMappingsBoard, scStoryTypes, scStateCategory)).toBeNull()
  })

  const glbBoard: Board = {
    columns: [
      { name: 'New', columnType: 'incoming', isSplit: false, stateMappings: { 'User Story': 'New', Bug: 'New' } },
      { name: 'Active', columnType: 'inProgress', isSplit: false, stateMappings: { 'User Story': 'Active', Bug: 'Active' } },
      { name: 'Review', columnType: 'inProgress', isSplit: false, stateMappings: { 'User Story': 'New', Bug: 'New' } },
      { name: 'Closed', columnType: 'outgoing', isSplit: false, stateMappings: { 'User Story': 'Closed', Bug: 'Closed' } },
    ],
  }
  const glbStoryTypes = ['User Story', 'Bug']
  const glbCat: Record<string, StateCategory> = {
    New: 'Proposed',
    Active: 'InProgress',
    Closed: 'Completed',
  }
  const glbTask = (state: string): WorkItem => ({
    id: 1,
    rev: 1,
    type: 'Task',
    title: 't',
    state,
    boardColumn: null,
    assignedTo: null,
    tags: [],
    parent: null,
    iterationPath: 'P\\S1',
  })

  it('Tier-1: matches a task state against any story-type mapping', () => {
    expect(columnForItem(glbTask('Active'), glbBoard, glbStoryTypes, glbCat)).toBe('Active')
  })

  it('Tier-2: category fallback via the passed state map (position-only Review collapses onto Active)', () => {
    // 'Blocked' has no exact mapping; category InProgress → first InProgress column
    const cat: Record<string, StateCategory> = { ...glbCat, Blocked: 'InProgress' }
    expect(columnForItem({ ...glbTask('Blocked') }, glbBoard, glbStoryTypes, cat)).toBe('Active')
  })

  it('Tier-0: resolves a non-task item type (a User Story) via stateMappings for its own type', () => {
    // Proves the mapper is generic over item type, not task-specific: the
    // `board` fixture's Resolved column maps `'User Story': 'Resolved'`
    // directly (Tier 0), same tier a Task hits via its own `Task` key.
    const resolvedStory: WorkItem = { ...story(2, 'P\\Sprint 1'), state: 'Resolved' }
    expect(columnForItem(resolvedStory, board, scStoryTypes, scStateCategory)).toBe('Resolved')
  })
})

describe('buildSections', () => {
  it('groups stories by their iteration, newest first, with child tasks under their lane', () => {
    const s1 = story(10, 'P\\Sprint 1')
    const s2 = story(20, 'P\\Sprint 2')
    const sections = buildSections([s1, s2], [task(11, 'Closed', 10, 'P\\Sprint 1')], iters, board, scStoryTypes, scStateCategory)
    expect(sections.map((s) => s.iteration.name)).toEqual(['Sprint 2', 'Sprint 1']) // newest first
    const sprint1 = sections.find((s) => s.iteration.name === 'Sprint 1')!
    expect(sprint1.lanes[0].tasksByColumn['Resolved'].map((t) => t.id)).toEqual([11])
    expect(sprint1.storyCount).toBe(1)
    expect(sprint1.taskCount).toBe(1)
  })

  it('puts a parentless/out-of-scope task into the (no parent story) lane', () => {
    const s1 = story(10, 'P\\Sprint 1')
    const sections = buildSections([s1], [task(99, 'Active', null, 'P\\Sprint 1')], iters, board, scStoryTypes, scStateCategory)
    const sprint1 = sections.find((s) => s.iteration.name === 'Sprint 1')!
    expect(sprint1.noParentLane.tasksByColumn['In Development'].map((t) => t.id)).toEqual([99])
  })

  it('puts a task whose parent id is not among the given stories into the no-parent lane', () => {
    const s1 = story(10, 'P\\Sprint 1')
    const sections = buildSections([s1], [task(99, 'Active', 12345, 'P\\Sprint 1')], iters, board, scStoryTypes, scStateCategory)
    const sprint1 = sections.find((s) => s.iteration.name === 'Sprint 1')!
    expect(sprint1.noParentLane.tasksByColumn['In Development'].map((t) => t.id)).toEqual([99])
    expect(sprint1.lanes[0].taskCount).toBe(0)
  })

  it('synthesizes a placeholder (undated) section for stories whose iteration matches no known iteration, sorted last', () => {
    const known = story(10, 'P\\Sprint 1')
    const unknown = story(30, 'P\\Sprint 9')
    const sections = buildSections([known, unknown], [], iters, board, scStoryTypes, scStateCategory)
    expect(sections.map((s) => s.iteration.name)).toEqual(['Sprint 1', 'Sprint 9'])
    expect(sections.at(-1)!.iteration.startDate).toBeUndefined()
  })
})

describe('nonEmptyColumns', () => {
  it('keeps only columns holding at least one task in this section', () => {
    const s1 = story(10, 'P\\Sprint 1')
    const sections = buildSections([s1], [task(11, 'Closed', 10, 'P\\Sprint 1')], iters, board, scStoryTypes, scStateCategory)
    const sprint1 = sections.find((s) => s.iteration.name === 'Sprint 1')!
    expect(nonEmptyColumns(sprint1, visibleColumns(board)).map((c) => c.name)).toEqual(['Resolved'])
  })
})

describe('sectionColumns', () => {
  it('showAll=false matches nonEmptyColumns (drops empty columns)', () => {
    const s1 = story(10, 'P\\Sprint 1')
    const sections = buildSections([s1], [task(11, 'Closed', 10, 'P\\Sprint 1')], iters, board, scStoryTypes, scStateCategory)
    const sprint1 = sections.find((s) => s.iteration.name === 'Sprint 1')!
    const cols = visibleColumns(board)
    expect(sectionColumns(sprint1, cols, false)).toEqual(nonEmptyColumns(sprint1, cols))
    expect(sectionColumns(sprint1, cols, false).map((c) => c.name)).toEqual(['Resolved'])
  })

  it('showAll=true returns every given column unchanged, order preserved', () => {
    const s1 = story(10, 'P\\Sprint 1')
    const sections = buildSections([s1], [task(11, 'Closed', 10, 'P\\Sprint 1')], iters, board, scStoryTypes, scStateCategory)
    const sprint1 = sections.find((s) => s.iteration.name === 'Sprint 1')!
    const cols = visibleColumns(board)
    expect(sectionColumns(sprint1, cols, true)).toEqual(cols)
    expect(sectionColumns(sprint1, cols, true).map((c) => c.name)).toEqual(['New', 'In Development', 'Resolved'])
  })
})

describe('buildFlatColumns', () => {
  it("prefers the item's own boardColumn when it names a visible column, else falls back to columnForItem", () => {
    // `placed` has an explicit boardColumn ('Resolved') that wins outright,
    // regardless of its state. `unplaced` has no boardColumn, so it falls
    // back to columnForItem, which resolves 'New' via Tier 0 (the `board`
    // fixture's New column maps `Task: 'New'`).
    const placed: WorkItem = { ...task(201, 'Whatever', null, 'P\\Sprint 1'), boardColumn: 'Resolved' }
    const unplaced = task(202, 'New', null, 'P\\Sprint 1')
    const result = buildFlatColumns([placed, unplaced], board, scStoryTypes, scStateCategory)
    const byName = new Map(result.map((r) => [r.column.name, r.cards.map((c) => c.id)]))
    expect(byName.get('Resolved')).toEqual([201])
    expect(byName.get('New')).toEqual([202])
  })

  it('returns every visible column, in board order, even when empty', () => {
    const result = buildFlatColumns([], board, scStoryTypes, scStateCategory)
    expect(result.map((r) => r.column.name)).toEqual(['New', 'In Development', 'Resolved'])
    expect(result.every((r) => r.cards.length === 0)).toBe(true)
  })
})

// --- Fixture-backed regression test -----------------------------------
// Loads the real captured fixtures (a partial 200/351 WIQL sample — see
// docs/task-column-mapping.md section 4) and runs the
// full pipeline over them. This does NOT assert exact per-story totals
// (the sample may be missing a story's later-created tasks); it guards
// only that the real shapes don't throw and that every task is accounted
// for exactly once, either placed in a column bucket or counted as a
// (observed, not forced) null mapping.

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'api', '__fixtures__')

function readFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf-8')) as T
}

function mapBoardFixture(raw: any): Board {
  return {
    columns: raw.columns.map((c: any) => ({
      name: c.name,
      columnType: c.columnType,
      isSplit: c.isSplit ?? false,
      stateMappings: c.stateMappings ?? {},
    })),
  }
}

function mapIterationsFixture(raw: any): Iteration[] {
  return raw.value.map((i: any) => ({
    id: i.id,
    name: i.name,
    path: i.path,
    startDate: i.attributes?.startDate,
    finishDate: i.attributes?.finishDate,
    timeFrame: i.attributes?.timeFrame,
  }))
}

function mapWorkItemsFixture(raw: any): WorkItem[] {
  return raw.value.map((w: any) => ({
    id: w.id,
    rev: w.rev,
    type: w.fields['System.WorkItemType'],
    title: w.fields['System.Title'],
    state: w.fields['System.State'],
    boardColumn: w.fields['System.BoardColumn'] ?? null,
    assignedTo: w.fields['System.AssignedTo']
      ? {
          displayName: w.fields['System.AssignedTo'].displayName,
          uniqueName: w.fields['System.AssignedTo'].uniqueName,
        }
      : null,
    tags: w.fields['System.Tags']
      ? w.fields['System.Tags']
          .split(';')
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [],
    parent: w.fields['System.Parent'] ?? null,
    iterationPath: w.fields['System.IterationPath'],
  }))
}

describe('fixture regression (real captured data)', () => {
  const realBoard = mapBoardFixture(readFixture('board.json'))
  const realIterations = mapIterationsFixture(readFixture('iterations.json'))
  const realItems = mapWorkItemsFixture(readFixture('workitems.json'))
  const realStories = realItems.filter((i) => i.type === 'User Story')
  const realTasks = realItems.filter((i) => i.type === 'Task')

  it('runs buildSections over the full fixture without throwing', () => {
    expect(() => buildSections(realStories, realTasks, realIterations, realBoard, scStoryTypes, scStateCategory)).not.toThrow()
  })

  it('accounts for every task exactly once — placed in a column bucket, or a documented null mapping', () => {
    const sections = buildSections(realStories, realTasks, realIterations, realBoard, scStoryTypes, scStateCategory)

    const nullMapped = realTasks.filter((t) => columnForItem(t, realBoard, scStoryTypes, scStateCategory) === null)

    let placedCount = 0
    const placedIds: number[] = []
    for (const section of sections) {
      for (const lane of [...section.lanes, section.noParentLane]) {
        for (const ids of Object.values(lane.tasksByColumn)) {
          placedCount += ids.length
          placedIds.push(...ids.map((t) => t.id))
        }
      }
    }

    // No task placed twice.
    expect(new Set(placedIds).size).toBe(placedIds.length)
    // Every task is either placed, or is one of the (observed) null mappings.
    expect(placedCount + nullMapped.length).toBe(realTasks.length)
    // sum of per-section taskCount equals the total tasks (each task counted
    // exactly once toward its lane, whether or not it got a column).
    expect(sections.reduce((sum, s) => sum + s.taskCount, 0)).toBe(realTasks.length)

    // Observed, not forced: as of this fixture capture, every real task
    // resolves to a column (0 null) — see task-5-report.md for the figure.
    expect(nullMapped.length).toBe(0)
  })
})
