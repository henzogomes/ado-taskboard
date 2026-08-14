import { describe, it, expect } from 'vitest'
import { buildLevels, slug } from './level'
import type { BacklogLevels } from '../api/types'

const projectA: BacklogLevels = {
  requirement: { boardName: 'Stories', workItemTypes: ['User Story', 'Bug'] },
  task: { workItemTypes: ['Task'] },
  portfolios: [
    { name: 'Features', workItemTypes: ['Feature'] },
    { name: 'Epics', workItemTypes: ['Epic'] },
  ],
}

const projectB: BacklogLevels = {
  ...projectA,
  portfolios: [...projectA.portfolios, { name: 'Initiatives', workItemTypes: ['Initiative'] }],
}

describe('slug', () => {
  it('lowercases, hyphenates non-alphanumerics, and trims edges', () => {
    expect(slug('Product Backlog Items!')).toBe('product-backlog-items')
  })
})

describe('buildLevels', () => {
  it('builds ids and labels for Project A', () => {
    const v = buildLevels(projectA)
    expect(v.map((x) => x.id)).toEqual(['tasks', 'requirement', 'features', 'epics'])
    expect(v.map((x) => x.label)).toEqual(['Tasks', 'Stories', 'Features', 'Epics'])
  })

  it('shapes the tasks view (v[0])', () => {
    const v = buildLevels(projectA)
    expect(v[0]).toMatchObject({ kind: 'lanes', iterationScoped: true, boardName: 'Stories' })
  })

  it('shapes the requirement view (v[1])', () => {
    const v = buildLevels(projectA)
    expect(v[1]).toMatchObject({ kind: 'flat', iterationScoped: true, boardName: 'Stories' })
  })

  it('shapes a portfolio view (v[3])', () => {
    const v = buildLevels(projectA)
    expect(v[3]).toMatchObject({
      kind: 'flat',
      iterationScoped: false,
      boardName: 'Epics',
      types: ['Epic'],
    })
  })

  it('adds an extra portfolio level for Project B', () => {
    const v = buildLevels(projectB)
    expect(v.map((x) => x.id)).toEqual(['tasks', 'requirement', 'features', 'epics', 'initiatives'])
  })

  it('includes both story and task types in the tasks view', () => {
    const v = buildLevels(projectA)
    expect(v[0].types).toEqual(expect.arrayContaining(['User Story', 'Bug', 'Task']))
  })
})
