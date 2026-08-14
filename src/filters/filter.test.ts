import { describe, expect, it } from 'vitest'
import { applyFilters, applyFiltersFlat, collectFacets, collectFacetsFlat } from './filter'
import type { Filters } from './filter'
import type { FlatColumn, Lane, SprintSection } from '../domain/board'
import type { BoardColumn, Iteration, WorkItem } from '../api/types'

const iteration: Iteration = { id: '1', name: 'Sprint 1', path: 'P\\Sprint 1', startDate: '2026-01-01' }

const identity = (displayName: string) => ({ displayName, uniqueName: `${displayName.toLowerCase()}@example.com` })

const item = (overrides: Partial<WorkItem> & { id: number }): WorkItem => ({
  rev: 1,
  type: 'Task',
  title: `t${overrides.id}`,
  state: 'Active',
  boardColumn: null,
  assignedTo: null,
  tags: [],
  parent: null,
  iterationPath: 'P\\Sprint 1',
  ...overrides,
})

/**
 * One section: a story lane with two tasks by different devs (one Active,
 * one Closed, different tags), plus a no-parent lane with one unassigned
 * task. Mirrors the shape `buildSections` produces (Task 5).
 */
function buildFixture(): SprintSection {
  const story = item({
    id: 1,
    type: 'User Story',
    state: 'Active',
    assignedTo: identity('Story Owner'),
    tags: ['story-tag'],
  })
  const taskAlice = item({ id: 2, parent: 1, state: 'Active', assignedTo: identity('Alice'), tags: ['frontend'] })
  const taskBob = item({ id: 3, parent: 1, state: 'Closed', assignedTo: identity('Bob'), tags: ['backend'] })
  const noParentTask = item({ id: 4, parent: null, state: 'New', assignedTo: null, tags: ['frontend'] })

  const lane: Lane = {
    story,
    tasksByColumn: { 'In Development': [taskAlice], Resolved: [taskBob] },
    taskCount: 2,
  }
  const noParentLane: Lane = {
    story: null,
    tasksByColumn: { New: [noParentTask] },
    taskCount: 1,
  }

  return {
    iteration,
    lanes: [lane],
    noParentLane,
    storyCount: 1,
    taskCount: 3,
  }
}

const emptyFilters: Filters = { devs: [], tags: [], states: [], search: '' }

describe('applyFilters', () => {
  it('with empty Filters, returns sections equivalent to input (all tasks survive)', () => {
    const sections = [buildFixture()]
    const result = applyFilters(sections, emptyFilters)

    expect(result).toBe(sections) // identity no-op, not just equivalent values
    expect(result[0].storyCount).toBe(1)
    expect(result[0].taskCount).toBe(3)
    expect(result[0].lanes[0].taskCount).toBe(2)
    expect(result[0].lanes[0].tasksByColumn['In Development'].map((t) => t.id)).toEqual([2])
    expect(result[0].lanes[0].tasksByColumn['Resolved'].map((t) => t.id)).toEqual([3])
    expect(result[0].noParentLane.taskCount).toBe(1)
    expect(result[0].noParentLane.tasksByColumn['New'].map((t) => t.id)).toEqual([4])
  })

  it('with empty Filters, is an exact no-op even when a lane taskCount counts a task that never made it into any column bucket', () => {
    // Simulates `buildSections`' documented edge: a task whose `columnForItem`
    // resolved to null is counted in `taskCount` but absent from
    // `tasksByColumn`. A naive recompute-from-buckets would shrink this
    // lane's count (and drop a noParentLane made only of such tasks) even
    // though nothing is being filtered — the early-return guard must
    // prevent that.
    const story = item({ id: 1, type: 'User Story', assignedTo: identity('Story Owner'), tags: ['story-tag'] })
    const taskA = item({ id: 2, parent: 1, assignedTo: identity('Alice'), tags: ['frontend'] })
    const lane: Lane = {
      story,
      tasksByColumn: { 'In Development': [taskA] }, // only 1 task bucketed...
      taskCount: 2, // ...but the domain layer counted 2 (1 unmapped)
    }
    const noParentLane: Lane = {
      story: null,
      tasksByColumn: {}, // entirely unmapped
      taskCount: 1,
    }
    const section: SprintSection = { iteration, lanes: [lane], noParentLane, storyCount: 1, taskCount: 3 }
    const sections = [section]

    const result = applyFilters(sections, emptyFilters)

    expect(result).toBe(sections)
    expect(result[0].lanes[0].taskCount).toBe(2)
    expect(result[0].noParentLane.taskCount).toBe(1)
    expect(result[0].taskCount).toBe(3)
  })

  it('filtering by one dev keeps only that dev tasks; a non-matching, now-empty lane is dropped; counts recompute', () => {
    const sections = [buildFixture()]
    const result = applyFilters(sections, { devs: ['Alice'], tags: [], states: [], search: '' })

    // The story lane survives (Alice's task survives), but Bob's task is gone.
    expect(result[0].lanes).toHaveLength(1)
    expect(result[0].lanes[0].taskCount).toBe(1)
    expect(result[0].lanes[0].tasksByColumn['In Development'].map((t) => t.id)).toEqual([2])
    expect(result[0].lanes[0].tasksByColumn['Resolved']).toBeUndefined()

    // The no-parent task has no assignee -> dropped when a devs facet is active.
    expect(result[0].noParentLane.taskCount).toBe(0)
    expect(result[0].noParentLane.tasksByColumn['New']).toBeUndefined()

    expect(result[0].storyCount).toBe(1)
    expect(result[0].taskCount).toBe(1)
  })

  it('keeps a lane whose story matches the filter, even when zero of its tasks survive', () => {
    // Distinct from the dev-filter test above: here NO task matches (Alice
    // and Bob are filtered out), but the STORY's own assignee does, so the
    // lane must be kept via the "story matches" OR-branch, not the
    // "has a surviving task" branch.
    const sections = [buildFixture()]
    const result = applyFilters(sections, { devs: ['Story Owner'], tags: [], states: [], search: '' })

    expect(result[0].lanes).toHaveLength(1)
    expect(result[0].lanes[0].taskCount).toBe(0)
    expect(result[0].lanes[0].tasksByColumn).toEqual({})
    expect(result[0].storyCount).toBe(1)
    expect(result[0].taskCount).toBe(0)
  })

  it('dropping the only surviving task from a lane whose story does not match drops the lane', () => {
    // Filter to a dev with no matching story and no matching task at all.
    const sections = [buildFixture()]
    const result = applyFilters(sections, { devs: ['Nobody'], tags: [], states: [], search: '' })

    expect(result[0].lanes).toHaveLength(0)
    expect(result[0].storyCount).toBe(0)
    expect(result[0].noParentLane.taskCount).toBe(0)
    expect(result[0].taskCount).toBe(0)
  })

  it('filtering by a tag keeps only tasks having that tag', () => {
    const sections = [buildFixture()]
    const result = applyFilters(sections, { devs: [], tags: ['backend'], states: [], search: '' })

    expect(result[0].lanes[0].taskCount).toBe(1)
    expect(result[0].lanes[0].tasksByColumn['Resolved'].map((t) => t.id)).toEqual([3])
    expect(result[0].lanes[0].tasksByColumn['In Development']).toBeUndefined()
    expect(result[0].noParentLane.taskCount).toBe(0)
  })

  it('filtering by a state keeps only tasks in that state', () => {
    const sections = [buildFixture()]
    const result = applyFilters(sections, { devs: [], tags: [], states: ['Closed'], search: '' })

    expect(result[0].lanes[0].taskCount).toBe(1)
    expect(result[0].lanes[0].tasksByColumn['Resolved'].map((t) => t.id)).toEqual([3])
    expect(result[0].lanes[0].tasksByColumn['In Development']).toBeUndefined()
  })

  it('a task with null assignee survives when the devs facet is empty, and is dropped when it is active', () => {
    const sections = [buildFixture()]

    const withoutDevFilter = applyFilters(sections, emptyFilters)
    expect(withoutDevFilter[0].noParentLane.tasksByColumn['New']?.map((t) => t.id)).toEqual([4])

    const withDevFilter = applyFilters(sections, { devs: ['Alice'], tags: [], states: [], search: '' })
    expect(withDevFilter[0].noParentLane.tasksByColumn['New']).toBeUndefined()
  })

  it('does not mutate the input sections', () => {
    const sections = [buildFixture()]
    applyFilters(sections, { devs: ['Alice'], tags: [], states: [], search: '' })

    expect(sections[0].taskCount).toBe(3)
    expect(sections[0].storyCount).toBe(1)
    expect(sections[0].lanes[0].taskCount).toBe(2)
    expect(sections[0].lanes[0].tasksByColumn['Resolved'].map((t) => t.id)).toEqual([3])
    expect(sections[0].noParentLane.taskCount).toBe(1)
  })
})

/**
 * A section built with distinctive titles/ids/assignees/tags, purpose-built
 * to exercise each search-match branch in isolation:
 * - taskLogin (id 819099): title 'Fix login bug', assignee Alice, tag frontend
 * - taskDocs (id 200): title 'Update docs', assignee Bob, tag backend
 */
function buildSearchFixture(): SprintSection {
  const story = item({
    id: 100,
    type: 'User Story',
    title: 'Story Title',
    assignedTo: identity('Story Owner'),
    tags: ['story-tag'],
  })
  const taskLogin = item({ id: 819099, parent: 100, title: 'Fix login bug', assignedTo: identity('Alice'), tags: ['frontend'] })
  const taskDocs = item({ id: 200, parent: 100, title: 'Update docs', assignedTo: identity('Bob'), tags: ['backend'] })

  const lane: Lane = {
    story,
    tasksByColumn: { 'In Development': [taskLogin, taskDocs] },
    taskCount: 2,
  }
  const noParentLane: Lane = { story: null, tasksByColumn: {}, taskCount: 0 }

  return { iteration, lanes: [lane], noParentLane, storyCount: 1, taskCount: 2 }
}

describe('applyFilters search', () => {
  it('matches by title substring, case-insensitively', () => {
    const sections = [buildSearchFixture()]
    const result = applyFilters(sections, { devs: [], tags: [], states: [], search: 'LOGIN' })

    expect(result[0].lanes[0].tasksByColumn['In Development'].map((t) => t.id)).toEqual([819099])
    expect(result[0].lanes[0].taskCount).toBe(1)
    expect(result[0].taskCount).toBe(1)
    expect(result[0].storyCount).toBe(1)
  })

  it('matches by id substring', () => {
    const sections = [buildSearchFixture()]
    const result = applyFilters(sections, { devs: [], tags: [], states: [], search: '819' })

    expect(result[0].lanes[0].tasksByColumn['In Development'].map((t) => t.id)).toEqual([819099])
  })

  it('matches by assignee displayName', () => {
    const sections = [buildSearchFixture()]
    const result = applyFilters(sections, { devs: [], tags: [], states: [], search: 'alice' })

    expect(result[0].lanes[0].tasksByColumn['In Development'].map((t) => t.id)).toEqual([819099])
  })

  it('matches by tag', () => {
    const sections = [buildSearchFixture()]
    const result = applyFilters(sections, { devs: [], tags: [], states: [], search: 'frontend' })

    expect(result[0].lanes[0].tasksByColumn['In Development'].map((t) => t.id)).toEqual([819099])
  })

  it('empty search is a no-op (identity), even alongside the existing empty-filters fast path', () => {
    const sections = [buildSearchFixture()]
    const result = applyFilters(sections, { devs: [], tags: [], states: [], search: '' })

    expect(result).toBe(sections)
    expect(result[0].taskCount).toBe(2)
  })

  it('search is AND-ed with an active facet: dev + search must both match', () => {
    const sections = [buildSearchFixture()]

    // Alice's task also matches the search -> survives.
    const bothMatch = applyFilters(sections, { devs: ['Alice'], tags: [], states: [], search: 'login' })
    expect(bothMatch[0].lanes[0].tasksByColumn['In Development'].map((t) => t.id)).toEqual([819099])
    expect(bothMatch[0].taskCount).toBe(1)

    // Bob doesn't match the 'login' search, and the story (Story Owner) doesn't
    // match the 'Bob' dev facet either -> the lane has no survivors at all.
    const neitherMatch = applyFilters(sections, { devs: ['Bob'], tags: [], states: [], search: 'login' })
    expect(neitherMatch[0].lanes).toHaveLength(0)
    expect(neitherMatch[0].taskCount).toBe(0)
  })
})

describe('collectFacets', () => {
  it('returns distinct sorted devs/tags/states across stories and tasks', () => {
    const sections = [buildFixture()]
    const facets = collectFacets(sections)

    expect(facets.devs).toEqual(['Alice', 'Bob', 'Story Owner'])
    expect(facets.tags).toEqual(['backend', 'frontend', 'story-tag'])
    expect(facets.states).toEqual(['Active', 'Closed', 'New'])
  })
})

const col = (name: string): BoardColumn => ({ name, columnType: 'inProgress', isSplit: false, stateMappings: {} })

function buildFlatFixture(): FlatColumn[] {
  return [
    {
      column: col('New'),
      cards: [
        item({ id: 10, type: 'Epic', state: 'New', assignedTo: identity('Alice'), tags: ['platform'] }),
        item({ id: 11, type: 'Epic', state: 'New', assignedTo: identity('Bob'), tags: ['mobile'] }),
      ],
    },
    {
      column: col('Active'),
      cards: [item({ id: 12, type: 'Epic', state: 'Active', assignedTo: identity('Alice'), tags: ['platform'] })],
    },
  ]
}

describe('collectFacetsFlat', () => {
  it('returns distinct sorted devs/tags/states across every card', () => {
    const facets = collectFacetsFlat(buildFlatFixture())
    expect(facets.devs).toEqual(['Alice', 'Bob'])
    expect(facets.tags).toEqual(['mobile', 'platform'])
    expect(facets.states).toEqual(['Active', 'New'])
  })
})

describe('applyFiltersFlat', () => {
  const empty: Filters = { devs: [], tags: [], states: [], search: '' }

  it('is an exact no-op (same reference) when no filters are active', () => {
    const flat = buildFlatFixture()
    expect(applyFiltersFlat(flat, empty)).toBe(flat)
  })

  it('narrows each column to matching cards, preserving column order', () => {
    const flat = buildFlatFixture()
    const result = applyFiltersFlat(flat, { ...empty, devs: ['Alice'] })
    expect(result.map((c) => c.column.name)).toEqual(['New', 'Active'])
    expect(result[0].cards.map((c) => c.id)).toEqual([10])
    expect(result[1].cards.map((c) => c.id)).toEqual([12])
  })

  it('applies the search term to card fields', () => {
    const flat = buildFlatFixture()
    const result = applyFiltersFlat(flat, { ...empty, search: 'mobile' })
    expect(result[0].cards.map((c) => c.id)).toEqual([11])
    expect(result[1].cards).toEqual([])
  })
})
