import { describe, it, expect, beforeEach } from 'vitest'
import { buildDemoBoardData } from './board'
import { resetDemo } from './runtime'

describe('buildDemoBoardData', () => {
  beforeEach(() => resetDemo())

  it('tasks (lanes) view: builds sprint sections with lanes, tasks placed in columns, and an orphan lane', () => {
    const data = buildDemoBoardData('all', 'tasks')
    expect(data.view.kind).toBe('lanes')
    expect(data.columns.map((c) => c.name)).toEqual(['New', 'Active', 'In Review', 'Resolved', 'Closed'])

    // Every seeded sprint shows as a section.
    expect(data.sections.map((s) => s.iteration.name).sort()).toEqual(['Sprint 1', 'Sprint 2', 'Sprint 3'])

    // Tasks land in more than one column (state → column via columnForItem).
    const allBuckets = data.sections.flatMap((s) => [...s.lanes, s.noParentLane]).flatMap((l) => Object.keys(l.tasksByColumn))
    expect(new Set(allBuckets).size).toBeGreaterThanOrEqual(2)

    // The orphan task surfaces in some section's noParentLane.
    const orphanCount = data.sections.reduce((n, s) => n + s.noParentLane.taskCount, 0)
    expect(orphanCount).toBeGreaterThanOrEqual(1)
  })

  it("current scope narrows the lanes view to the date-derived current sprint (Sprint 2)", () => {
    const data = buildDemoBoardData('current', 'tasks')
    expect(data.sections.map((s) => s.iteration.name)).toEqual(['Sprint 2'])
  })

  it('a specific iteration scope narrows to that sprint only', () => {
    const data = buildDemoBoardData({ iterationId: 'sprint-1' }, 'tasks')
    expect(data.sections.map((s) => s.iteration.name)).toEqual(['Sprint 1'])
  })

  it('requirement (flat) view yields story cards in columns, no tasks and no lanes', () => {
    const data = buildDemoBoardData('all', 'requirement')
    expect(data.view.kind).toBe('flat')
    expect(data.sections).toEqual([])
    const cards = data.flatColumns.flatMap((c) => c.cards)
    expect(cards.length).toBeGreaterThan(0)
    expect(cards.every((c) => c.type === 'User Story' || c.type === 'Bug')).toBe(true)
  })

  it('a portfolio (Features) view is not iteration-scoped: cards appear even under a current scope', () => {
    const data = buildDemoBoardData('current', 'features')
    expect(data.view.kind).toBe('flat')
    expect(data.view.iterationScoped).toBe(false)
    const cards = data.flatColumns.flatMap((c) => c.cards)
    expect(cards.length).toBeGreaterThan(0)
    expect(cards.every((c) => c.type === 'Feature')).toBe(true)
  })

  it('an unknown levelId falls back to the first level (tasks)', () => {
    const data = buildDemoBoardData('all', 'does-not-exist')
    expect(data.levelId).toBe('tasks')
    expect(data.view.kind).toBe('lanes')
  })
})
