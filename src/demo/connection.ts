// The Demo-mode sentinel connection + the active-demo predicate.
//
// Demo mode is modeled as an ordinary stored `Connection` with a fixed,
// well-known id, so it flows through the exact same `getActive()` / login-gate
// machinery as a real connection (no parallel "mode" flag to keep in sync).
// The loaders (`src/api/client.ts`, `src/hooks/useBoardData.ts`) branch on
// `isDemoActive()` to serve synthetic, in-memory data instead of hitting the
// proxy — no network, no PAT.

import type { Connection } from '../connections/store'
import { getActive } from '../connections/store'

/** The fixed id of the demo connection — the single source of "is this demo?". */
export const DEMO_CONNECTION_ID = 'demo'

/**
 * The synthetic connection that backs Demo mode. Everything here is generic and
 * fake: no real org/project/person. `me` names one of the demo assignees so the
 * "Highlight mine" toggle is exercisable; `pat: ''` matches the dual-mode shape
 * of a real seed, but no request ever leaves the browser in demo mode.
 */
export const DEMO_CONNECTION: Connection = {
  id: DEMO_CONNECTION_ID,
  label: 'Demo data',
  org: 'demo-org',
  project: 'Demo Project',
  team: 'Demo Team',
  me: 'alex.rivera@demo',
  pat: '',
}

/** True when the active connection is the demo sentinel. */
export function isDemoActive(): boolean {
  return getActive()?.id === DEMO_CONNECTION_ID
}
