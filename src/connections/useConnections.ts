import { useSyncExternalStore } from 'react'
import {
  subscribe,
  load,
  getActive,
  addConnection,
  setActiveConnection,
  removeConnection,
  logoutAll,
} from './store'
import type { Connection } from './store'

/**
 * React binding over the `store` module: re-renders on any connection change
 * (add / switch / remove / logout) via `useSyncExternalStore(subscribe, load)`.
 * `active` is derived from `activeId`; the imperative mutators are re-exported
 * so consumers don't import the store directly.
 */
export function useConnections() {
  const stored = useSyncExternalStore(subscribe, load, load)
  const active: Connection | null = stored.connections.find((c) => c.id === stored.activeId) ?? null
  return {
    connections: stored.connections,
    active,
    add: addConnection,
    setActive: setActiveConnection,
    remove: removeConnection,
    logoutAll,
    getActive,
  }
}
