import { describe, it, expect } from 'vitest'
import { categoryColor, colorForState } from './stateColors'

describe('categoryColor', () => {
  it('maps each ADO category to its themed state token', () => {
    expect(categoryColor('Proposed').border).toBe('border-l-state-proposed')
    expect(categoryColor('InProgress').border).toBe('border-l-state-inprogress')
    expect(categoryColor('Resolved').border).toBe('border-l-state-resolved')
    expect(categoryColor('Completed').border).toBe('border-l-state-completed')
    expect(categoryColor('Removed').border).toBe('border-l-state-removed')
  })

  it('exposes accent + soft pill classes per category', () => {
    expect(categoryColor('InProgress').accent).toBe('border-t-state-inprogress')
    expect(categoryColor('InProgress').pill).toBe('bg-state-inprogress/15 text-state-inprogress')
  })

  it('falls back to a neutral token for unknown/undefined category', () => {
    expect(categoryColor(undefined).border).toBe('border-l-content-subtle')
    expect(categoryColor('Nonsense').border).toBe('border-l-content-subtle')
  })
})

describe('colorForState', () => {
  it('resolves a state name through the category map', () => {
    const cat = { Active: 'InProgress', Closed: 'Completed' }
    expect(colorForState('Active', cat).accent).toBe('border-t-state-inprogress')
    expect(colorForState('Closed', cat).border).toBe('border-l-state-completed')
  })

  it('neutrals a state absent from the map', () => {
    expect(colorForState('Whatever', {}).border).toBe('border-l-content-subtle')
  })
})
