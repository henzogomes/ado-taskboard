/** Accept only ADO org slugs (path segment). Host is never client-supplied. */
export function sanitizeOrg(v: unknown): string {
  return typeof v === 'string' && /^[A-Za-z0-9._-]+$/.test(v) ? v : ''
}
