// Humanizes ADO's raw link-type identifiers (e.g.
// `System.LinkTypes.Hierarchy-Reverse`) into short, readable relation labels
// (e.g. `Parent`) for the ticket modal's relation chips.

const KNOWN_RELATION_LABELS: Record<string, string> = {
  'System.LinkTypes.Hierarchy-Reverse': 'Parent',
  'System.LinkTypes.Hierarchy-Forward': 'Child',
  'System.LinkTypes.Related': 'Related',
  'System.LinkTypes.Dependency-Forward': 'Successor',
  'System.LinkTypes.Dependency-Reverse': 'Predecessor',
  'System.LinkTypes.Duplicate-Forward': 'Duplicate',
  'System.LinkTypes.Duplicate-Reverse': 'Duplicate',
  AttachedFile: 'Attachment',
  Hyperlink: 'Hyperlink',
  ArtifactLink: 'Link',
}

/**
 * Pure map from a raw ADO relation `rel` string to a short human label.
 * Known link types resolve via `KNOWN_RELATION_LABELS`; anything else falls
 * back to stripping a `System.LinkTypes.`/`Microsoft.VSTS.Common.` prefix,
 * dropping a trailing `-Forward`/`-Reverse`, turning `-`/`.` into spaces, and
 * Title Casing the leading letter of each word.
 */
export function relationLabel(rel: string): string {
  const known = KNOWN_RELATION_LABELS[rel]
  if (known) return known

  const withoutPrefix = rel.replace(/^System\.LinkTypes\./, '').replace(/^Microsoft\.VSTS\.Common\./, '')
  const withoutDirection = withoutPrefix.replace(/-(Forward|Reverse)$/, '')
  const spaced = withoutDirection.replace(/[-.]/g, ' ')

  return spaced
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
