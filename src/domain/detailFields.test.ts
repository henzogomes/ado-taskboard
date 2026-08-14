import { describe, it, expect } from 'vitest'
import { richTextFields, htmlHasContent } from './detailFields'
import type { FieldMeta } from '../api/types'

const meta = (
  entries: [string, string, string][],
): Record<string, FieldMeta> =>
  Object.fromEntries(
    entries.map(([referenceName, displayName, type]) => [referenceName, { referenceName, displayName, type }]),
  )

const AGILE_META = meta([
  ['System.Description', 'Description', 'html'],
  ['Microsoft.VSTS.Common.AcceptanceCriteria', 'Acceptance Criteria', 'html'],
  ['Microsoft.VSTS.TCM.ReproSteps', 'Repro Steps', 'html'],
  ['Microsoft.VSTS.TCM.SystemInfo', 'System Info', 'html'],
  ['Custom.Notes', 'Notes', 'html'],
  ['System.Title', 'Title', 'string'],
  ['System.State', 'State', 'string'],
])

describe('htmlHasContent', () => {
  it('is false for tags/whitespace/&nbsp;/<br> only', () => {
    expect(htmlHasContent('')).toBe(false)
    expect(htmlHasContent('   ')).toBe(false)
    expect(htmlHasContent('<div><br></div>')).toBe(false)
    expect(htmlHasContent('<p>&nbsp;</p>')).toBe(false)
    expect(htmlHasContent('<div></div>')).toBe(false)
  })

  it('is true for real text', () => {
    expect(htmlHasContent('<p>Hello</p>')).toBe(true)
  })

  it('is true for image/list/link/table/pre even without text', () => {
    expect(htmlHasContent('<img src="x">')).toBe(true)
    expect(htmlHasContent('<ul><li></li></ul>')).toBe(true)
    expect(htmlHasContent('<table><tr><td></td></tr></table>')).toBe(true)
  })
})

describe('richTextFields', () => {
  it('keeps only html-typed, non-blank fields', () => {
    const fields = {
      'System.Description': '<p>The description</p>',
      'System.Title': 'A title', // non-html — excluded
      'System.State': 'Active', // non-html — excluded
      'Custom.Notes': '<div><br></div>', // blank — excluded
      'Custom.Unknown': '<p>no meta</p>', // no meta — excluded
    }
    const out = richTextFields(fields, AGILE_META)
    expect(out.map((f) => f.referenceName)).toEqual(['System.Description'])
    expect(out[0]).toEqual({
      referenceName: 'System.Description',
      displayName: 'Description',
      html: '<p>The description</p>',
    })
  })

  it('orders by priority (Description, AC, Repro, SystemInfo) then alphabetically', () => {
    const fields = {
      'Custom.Notes': '<p>notes</p>',
      'Microsoft.VSTS.TCM.ReproSteps': '<p>repro</p>',
      'System.Description': '<p>desc</p>',
      'Microsoft.VSTS.Common.AcceptanceCriteria': '<p>ac</p>',
    }
    const out = richTextFields(fields, AGILE_META)
    expect(out.map((f) => f.displayName)).toEqual([
      'Description',
      'Acceptance Criteria',
      'Repro Steps',
      'Notes',
    ])
  })

  it('renders a Bug shape (Repro Steps, no Description/AC) without phantom sections', () => {
    const fields = { 'Microsoft.VSTS.TCM.ReproSteps': '<p>Steps to reproduce</p>' }
    const out = richTextFields(fields, AGILE_META)
    expect(out.map((f) => f.displayName)).toEqual(['Repro Steps'])
  })

  it('is empty when nothing is populated', () => {
    expect(richTextFields({}, AGILE_META)).toEqual([])
    expect(richTextFields({ 'System.State': 'Active' }, AGILE_META)).toEqual([])
  })
})
