// src/config.ts — non-secret, client-safe. Values resolve from the ACTIVE
// runtime connection (localStorage), not build-time env. Read at call time
// (every existing CONFIG.* read is inside a function), so switching the
// active connection changes these with no reload.
import { getActive } from './connections/store'

export const CONFIG = {
  get org() { return getActive()?.org ?? '' },
  get project() { return getActive()?.project ?? '' },
  get team() { return getActive()?.team ?? '' },
  get me() { return getActive()?.me ?? '' },
  /** Discovered from the requirement backlog level; '' = always discover. */
  board: '',
  baseUrl: '/api/ado',
}
