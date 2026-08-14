import { describe, it, expect } from 'vitest'
import { sanitizeOrg } from './sanitize'

describe('sanitizeOrg', () => {
  it('accepts a valid org slug', () => {
    expect(sanitizeOrg('contoso')).toBe('contoso')
    expect(sanitizeOrg('My-Org.2')).toBe('My-Org.2')
  })
  it('rejects path-escape / host-injection attempts', () => {
    expect(sanitizeOrg('../evil')).toBe('')
    expect(sanitizeOrg('a/b')).toBe('')
    expect(sanitizeOrg('evil.com/x')).toBe('')
    expect(sanitizeOrg('org?x=1')).toBe('')
    expect(sanitizeOrg('org with space')).toBe('')
  })
  it('rejects empty / non-string', () => {
    expect(sanitizeOrg('')).toBe('')
    expect(sanitizeOrg(undefined)).toBe('')
    expect(sanitizeOrg(['a'])).toBe('')
  })
})
