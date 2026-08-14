// Domain: picks the "current" iteration from dates rather than the ADO team
// timeframe (the team we query can't be trusted to have every sprint
// subscribed).

import type { Iteration } from '../api/types'

/** Truncates an ISO datetime to a date-only epoch-day number (UTC), avoiding TZ drift. */
function toDateOnly(iso: string): number {
  const d = new Date(iso)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/**
 * Returns the `id` of the iteration whose `[startDate, finishDate]` window
 * contains `today` (inclusive, date-only compare). If none matches, falls
 * back to the latest-started iteration with `startDate <= today`. If there's
 * no such iteration either (or the list is empty), returns `null`.
 * Iterations with no `startDate` are ignored entirely.
 */
export function currentIterationId(iterations: Iteration[], today: Date): string | null {
  const todayOnly = toDateOnly(today.toISOString())

  const dated = iterations.filter((it): it is Iteration & { startDate: string } => Boolean(it.startDate))

  const within = dated.find((it) => {
    const start = toDateOnly(it.startDate)
    const finish = it.finishDate ? toDateOnly(it.finishDate) : start
    return start <= todayOnly && todayOnly <= finish
  })
  if (within) return within.id

  const started = dated.filter((it) => toDateOnly(it.startDate) <= todayOnly)
  if (started.length === 0) return null

  const latest = started.reduce((best, it) => (toDateOnly(it.startDate) > toDateOnly(best.startDate) ? it : best))
  return latest.id
}
