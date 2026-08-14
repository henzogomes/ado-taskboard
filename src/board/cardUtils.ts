import { CONFIG } from '../config'

/** Human ADO work-item URL, built from non-secret CONFIG (org/project only). */
export function adoWorkItemUrl(id: number): string {
  return `https://dev.azure.com/${CONFIG.org}/${encodeURIComponent(CONFIG.project)}/_workitems/edit/${id}`
}

/** Up to two uppercase initials from a display name (skips leading `_`/punctuation). */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part.match(/[A-Za-z0-9]/)?.[0]) // first alphanumeric — skips leading `_`/punctuation
    .filter((c): c is string => Boolean(c))
    .slice(0, 2)
    .map((c) => c.toUpperCase())
    .join('')
}
