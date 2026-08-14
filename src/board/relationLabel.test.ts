import { describe, expect, it } from 'vitest'
import { relationLabel } from './relationLabel'

describe('relationLabel', () => {
  it.each([
    ['System.LinkTypes.Hierarchy-Reverse', 'Parent'],
    ['System.LinkTypes.Hierarchy-Forward', 'Child'],
    ['System.LinkTypes.Related', 'Related'],
    ['System.LinkTypes.Dependency-Forward', 'Successor'],
    ['System.LinkTypes.Dependency-Reverse', 'Predecessor'],
    ['System.LinkTypes.Duplicate-Forward', 'Duplicate'],
    ['System.LinkTypes.Duplicate-Reverse', 'Duplicate'],
    ['AttachedFile', 'Attachment'],
    ['Hyperlink', 'Hyperlink'],
    ['ArtifactLink', 'Link'],
  ])('maps %s to %s', (rel, expected) => {
    expect(relationLabel(rel)).toBe(expected)
  })

  it('falls back for an unknown System.LinkTypes value: strips prefix, drops direction suffix, Title Cases', () => {
    expect(relationLabel('System.LinkTypes.TestedBy-Forward')).toBe('TestedBy')
  })

  it('falls back for an unknown Microsoft.VSTS.Common value with dashes turned into spaces', () => {
    expect(relationLabel('Microsoft.VSTS.Common.Some-Other-Kind')).toBe('Some Other Kind')
  })

  it('falls back for a totally unknown value with dots turned into spaces', () => {
    expect(relationLabel('Some.Unknown.Value')).toBe('Some Unknown Value')
  })
})
