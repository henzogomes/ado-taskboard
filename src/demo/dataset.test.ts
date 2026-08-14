import { describe, it, expect } from 'vitest'
import { buildLevels } from '../board/level'
import {
  DEMO_BACKLOGS,
  DEMO_DETAILS,
  DEMO_FIELDS,
  demoWorkItemDetail,
  makeDemoWorkItems,
} from './dataset'

describe('demo dataset', () => {
  it('yields the discovered levels: Tasks, Stories, then the portfolio levels', () => {
    const levels = buildLevels(DEMO_BACKLOGS)
    expect(levels.map((v) => v.id)).toEqual(['tasks', 'requirement', 'features', 'epics'])
    expect(levels[0].kind).toBe('lanes')
    expect(levels[1].kind).toBe('flat')
    // Portfolio views are not iteration-scoped.
    expect(levels[2].iterationScoped).toBe(false)
    expect(levels[3].iterationScoped).toBe(false)
  })

  it('produces stories with child tasks across multiple states and sprints', () => {
    const items = makeDemoWorkItems()
    const stories = items.filter((i) => i.type === 'User Story' || i.type === 'Bug')
    const tasks = items.filter((i) => i.type === 'Task')
    expect(stories.length).toBeGreaterThanOrEqual(4)
    expect(tasks.length).toBeGreaterThanOrEqual(6)

    // Child tasks span at least three distinct states (→ multiple columns).
    const taskStates = new Set(tasks.map((t) => t.state))
    expect(taskStates.size).toBeGreaterThanOrEqual(3)

    // Work spans all three sprints.
    const sprints = new Set(items.map((i) => i.iterationPath))
    expect(sprints).toContain('Demo Project\\Sprint 1')
    expect(sprints).toContain('Demo Project\\Sprint 2')
    expect(sprints).toContain('Demo Project\\Sprint 3')

    // At least one orphan task (no parent) to exercise the "No parent" lane.
    expect(tasks.some((t) => t.parent === null)).toBe(true)

    // At least one portfolio item.
    expect(items.some((i) => i.type === 'Feature')).toBe(true)
    expect(items.some((i) => i.type === 'Epic')).toBe(true)
  })

  it('returns a fresh, independently-mutable array each call', () => {
    const a = makeDemoWorkItems()
    const b = makeDemoWorkItems()
    expect(a).not.toBe(b)
    a[0].state = 'MUTATED'
    expect(b[0].state).not.toBe('MUTATED')
  })

  it('seeds rich detail (Description / Acceptance Criteria / Repro Steps) for some items', () => {
    expect(DEMO_DETAILS[101].fields['System.Description']).toBeTruthy()
    expect(DEMO_DETAILS[101].fields['Microsoft.VSTS.Common.AcceptanceCriteria']).toBeTruthy()
    expect(DEMO_DETAILS[103].fields['Microsoft.VSTS.TCM.ReproSteps']).toBeTruthy()
    // The catalog covers those rich-text fields.
    const html = DEMO_FIELDS.filter((f) => f.type === 'html').map((f) => f.referenceName)
    expect(html).toContain('System.Description')
    expect(html).toContain('Microsoft.VSTS.Common.AcceptanceCriteria')
    expect(html).toContain('Microsoft.VSTS.TCM.ReproSteps')
  })

  it('falls back to an empty (well-formed) detail for an unseeded id', () => {
    const d = demoWorkItemDetail(999)
    expect(d).toEqual({ id: 999, fields: {}, relations: [] })
  })
})
