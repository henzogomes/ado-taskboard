import { describe, it, expect } from 'vitest'
import { moveCard, withUpdatedCard } from './dnd'
import type { Board, WorkItem } from '../api/types'
import type { Lane, SprintSection } from '../domain/board'

const task: WorkItem = {
  id: 101,
  type: 'Task',
  title: 'Do the thing',
  state: 'Active',
  boardColumn: null,
  assignedTo: null,
  tags: [],
  parent: 500,
  iterationPath: 'Proj\\Sprint 1',
  rev: 3,
}

const story: WorkItem = {
  id: 500,
  type: 'User Story',
  title: 'The story',
  state: 'Active',
  boardColumn: null,
  assignedTo: null,
  tags: [],
  parent: null,
  iterationPath: 'Proj\\Sprint 1',
  rev: 2,
}

function makeLane(): Lane {
  return {
    story,
    tasksByColumn: { 'In Development': [task] },
    taskCount: 1,
  }
}

function makeSection(lane: Lane): SprintSection {
  return {
    iteration: { id: 'it1', name: 'Sprint 1', path: 'Proj\\Sprint 1' },
    lanes: [lane],
    noParentLane: { story: null, tasksByColumn: {}, taskCount: 0 },
    storyCount: 1,
    taskCount: 1,
  }
}

// Real-board shape: no 'Task' key in stateMappings, only the board's own
// story type — deliberately NOT 'User Story', to prove the fallback reads
// from the board's own data rather than a hardcoded type name.
const board: Board = {
  columns: [
    {
      name: 'In Development',
      columnType: 'inProgress',
      isSplit: false,
      stateMappings: { 'Product Backlog Item': 'Active' },
    },
    {
      name: 'Resolved',
      columnType: 'inProgress',
      isSplit: false,
      stateMappings: { 'Product Backlog Item': 'Resolved' },
    },
    { name: 'New', columnType: 'incoming', isSplit: false, stateMappings: {} },
  ],
}

describe('moveCard', () => {
  it('moves a task from column A to column B within its lane', () => {
    const lane = makeLane()
    const section = makeSection(lane)
    const sections = [section]

    const result = moveCard(sections, 101, 'Resolved', board)

    expect(result).not.toBeNull()
    const { next, undo, targetState } = result!

    expect(targetState).toBe('Resolved')

    const movedLane = next[0].lanes[0]
    expect(movedLane.tasksByColumn['In Development']).toBeUndefined()
    expect(movedLane.tasksByColumn['Resolved']?.map((t) => t.id)).toEqual([101])
    expect(movedLane.tasksByColumn['Resolved']?.[0].state).toBe('Resolved')
    expect(movedLane.taskCount).toBe(lane.taskCount)

    // undo restores the original, untouched sections
    expect(undo).toBe(sections)
    expect(undo).toEqual([section])

    // input was never mutated
    expect(sections[0].lanes[0].tasksByColumn['In Development']).toEqual([task])
    expect(sections[0].lanes[0].tasksByColumn['Resolved']).toBeUndefined()
  })

  it('returns null for an unknown card id', () => {
    const sections = [makeSection(makeLane())]
    expect(moveCard(sections, 999999, 'Resolved', board)).toBeNull()
  })

  it('returns null when the destination column has no resolvable state', () => {
    const sections = [makeSection(makeLane())]
    expect(moveCard(sections, 101, 'New', board)).toBeNull()
  })

  it("resolves targetState via the column's own story-type mapping when there's no Task key (real-board shape), regardless of which story type the board uses", () => {
    const sections = [makeSection(makeLane())]
    const result = moveCard(sections, 101, 'Resolved', board)
    expect(result?.targetState).toBe('Resolved')
    expect(board.columns.find((c) => c.name === 'Resolved')?.stateMappings.Task).toBeUndefined()
    expect(board.columns.find((c) => c.name === 'Resolved')?.stateMappings['User Story']).toBeUndefined()
  })
})

describe('withUpdatedCard', () => {
  const otherTask: WorkItem = { ...task, id: 202, state: 'New' }

  function makeLaneWithTwoTasks(): Lane {
    return {
      story,
      tasksByColumn: { 'In Development': [task], New: [otherTask] },
      taskCount: 2,
    }
  }

  it("patches only the target card's rev/state, leaving everything else untouched", () => {
    const lane = makeLaneWithTwoTasks()
    const sections = [makeSection(lane)]

    const result = withUpdatedCard(sections, 101, { rev: 4, state: 'Resolved' })

    const movedCard = result[0].lanes[0].tasksByColumn['In Development']?.[0]
    expect(movedCard?.id).toBe(101)
    expect(movedCard?.rev).toBe(4)
    expect(movedCard?.state).toBe('Resolved')

    // The other card, in a different column of the same lane, is untouched.
    const untouchedCard = result[0].lanes[0].tasksByColumn['New']?.[0]
    expect(untouchedCard).toEqual(otherTask)

    // Input was never mutated.
    expect(sections[0].lanes[0].tasksByColumn['In Development']?.[0]).toEqual(task)
  })

  it('is immutable: unrelated sections/lanes are unaffected', () => {
    const sections = [makeSection(makeLaneWithTwoTasks())]
    const result = withUpdatedCard(sections, 999999, { rev: 99, state: 'Whatever' })

    expect(result).toEqual(sections) // no card matched — content unchanged
    expect(result).not.toBe(sections) // still a fresh array (per moveCard/dnd convention)
  })
})
