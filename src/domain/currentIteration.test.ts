import { describe, it, expect } from 'vitest'
import { currentIterationId } from './currentIteration'
import type { Iteration } from '../api/types'

const iter = (id: string, startDate?: string, finishDate?: string): Iteration => ({
  id,
  name: id,
  path: `P\\${id}`,
  startDate,
  finishDate,
})

describe('currentIterationId', () => {
  const iterations: Iteration[] = [
    iter('s1', '2026-06-29', '2026-07-10'),
    iter('s2', '2026-07-13', '2026-07-24'),
    iter('s3', '2026-07-27', '2026-08-07'),
    iter('s4', '2026-08-10', '2026-08-21'),
    iter('s5', '2026-08-24', '2026-09-04'),
  ]

  it('returns the iteration whose window contains today', () => {
    expect(currentIterationId(iterations, new Date('2026-08-12'))).toBe('s4')
  })

  it('falls back to the latest-started iteration when today is after all windows', () => {
    expect(currentIterationId(iterations, new Date('2026-09-10'))).toBe('s5')
  })

  it('returns null when today is before all windows', () => {
    expect(currentIterationId(iterations, new Date('2026-06-01'))).toBeNull()
  })

  it('returns null for an empty iteration list', () => {
    expect(currentIterationId([], new Date('2026-08-12'))).toBeNull()
  })

  it('skips iterations with no startDate when picking current', () => {
    const withGap: Iteration[] = [
      iter('s1', '2026-06-29', '2026-07-10'),
      iter('no-dates'),
      iter('s4', '2026-08-10', '2026-08-21'),
    ]
    expect(currentIterationId(withGap, new Date('2026-08-12'))).toBe('s4')
  })

  it('is inclusive of the start and finish date boundaries', () => {
    expect(currentIterationId(iterations, new Date('2026-08-10'))).toBe('s4')
    expect(currentIterationId(iterations, new Date('2026-08-21'))).toBe('s4')
  })
})
