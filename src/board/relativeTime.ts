// Pure, dependency-free relative-time formatter for comment timestamps. `now`
// is injected (defaulting to the current time only inside the function, never at
// module load) so the output is deterministically unit-testable.

const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const MINUTE = 60
const HOUR = MINUTE * 60
const DAY = HOUR * 24
const WEEK = DAY * 7
const MONTH = DAY * 30
const YEAR = DAY * 365

/** Humanizes an ISO 8601 instant relative to `now` (e.g. "3 hours ago"),
 *  picking the largest sensible unit from seconds up to years. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const deltaSeconds = (new Date(iso).getTime() - now.getTime()) / 1000
  const abs = Math.abs(deltaSeconds)

  if (abs < MINUTE) return RTF.format(Math.round(deltaSeconds), 'second')
  if (abs < HOUR) return RTF.format(Math.round(deltaSeconds / MINUTE), 'minute')
  if (abs < DAY) return RTF.format(Math.round(deltaSeconds / HOUR), 'hour')
  if (abs < WEEK) return RTF.format(Math.round(deltaSeconds / DAY), 'day')
  if (abs < MONTH) return RTF.format(Math.round(deltaSeconds / WEEK), 'week')
  if (abs < YEAR) return RTF.format(Math.round(deltaSeconds / MONTH), 'month')
  return RTF.format(Math.round(deltaSeconds / YEAR), 'year')
}
