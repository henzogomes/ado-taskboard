import { describe, it, expect } from 'vitest'
import { relativeTime } from './relativeTime'

const NOW = new Date('2025-07-15T12:00:00Z')
const ago = (seconds: number): string => new Date(NOW.getTime() - seconds * 1000).toISOString()

describe('relativeTime', () => {
  it('formats seconds', () => {
    expect(relativeTime(ago(5), NOW)).toBe('5 seconds ago')
  })

  it('formats minutes', () => {
    expect(relativeTime(ago(3 * 60), NOW)).toBe('3 minutes ago')
  })

  it('formats hours', () => {
    expect(relativeTime(ago(5 * 3600), NOW)).toBe('5 hours ago')
  })

  it('formats days', () => {
    expect(relativeTime(ago(2 * 86400), NOW)).toBe('2 days ago')
  })

  it('formats weeks', () => {
    expect(relativeTime(ago(2 * 7 * 86400), NOW)).toBe('2 weeks ago')
  })

  it('formats months', () => {
    expect(relativeTime(ago(3 * 30 * 86400), NOW)).toBe('3 months ago')
  })

  it('formats years', () => {
    expect(relativeTime(ago(2 * 365 * 86400), NOW)).toBe('2 years ago')
  })

  it('handles a future instant', () => {
    const future = new Date(NOW.getTime() + 3 * 3600 * 1000).toISOString()
    expect(relativeTime(future, NOW)).toBe('in 3 hours')
  })
})
