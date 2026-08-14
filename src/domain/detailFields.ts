// Domain: selects which fetched fields the ticket modal should render, given
// the item's raw field map (?$expand=all) and the discovered per-field
// metadata (_apis/wit/fields). Everything dynamic — no hardcoded field set.

import type { DetailField, FieldMeta } from '../api/types'

/** Common rich-text fields shown first (in this order) when present; every
 * other html field follows, sorted by display name. Presentation only — not a
 * project-specific field whitelist. */
const PRIORITY = [
  'System.Description',
  'Microsoft.VSTS.Common.AcceptanceCriteria',
  'Microsoft.VSTS.TCM.ReproSteps',
  'Microsoft.VSTS.TCM.SystemInfo',
]

/** Tags that carry meaning even with no text (so an image/list/link-only field
 * still counts as populated). */
const MEANINGFUL_EMPTY_TAGS = /<(img|table|ul|ol|li|a|pre|code|blockquote)\b/i

/**
 * True when the html carries real content: any visible text after stripping
 * tags/`&nbsp;`/whitespace, OR a meaningful embedded element (image, list,
 * link, table, code). A `<div><br></div>` / `<p>&nbsp;</p>` reads as empty.
 */
export function htmlHasContent(html: string): boolean {
  const text = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, '')
    .replace(/\s+/g, '')
  return text.length > 0 || MEANINGFUL_EMPTY_TAGS.test(html)
}

/**
 * The populated rich-text (html) fields to render for a work item: the item's
 * fields whose discovered `type === 'html'` and whose value is a non-blank
 * string. Ordered by the common-fields priority list, then alphabetically by
 * display name. Fields with no metadata (unknown reference name) are skipped.
 */
export function richTextFields(
  fields: Record<string, unknown>,
  meta: Record<string, FieldMeta>,
): DetailField[] {
  const out: DetailField[] = []
  for (const [referenceName, value] of Object.entries(fields)) {
    const m = meta[referenceName]
    if (!m || m.type !== 'html') continue
    if (typeof value !== 'string' || !htmlHasContent(value)) continue
    out.push({ referenceName, displayName: m.displayName, html: value })
  }

  const rank = (referenceName: string): number => {
    const i = PRIORITY.indexOf(referenceName)
    return i === -1 ? PRIORITY.length : i
  }
  return out.sort((a, b) => {
    const ra = rank(a.referenceName)
    const rb = rank(b.referenceName)
    return ra !== rb ? ra - rb : a.displayName.localeCompare(b.displayName)
  })
}
