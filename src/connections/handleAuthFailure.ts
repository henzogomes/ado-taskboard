import type { QueryClient } from '@tanstack/react-query'
import { getActive, removeConnection } from './store'
import { DEMO_CONNECTION_ID } from '../demo/connection'

/**
 * Handles a board-load 401: drops the failing ACTIVE connection and its cached
 * board so a stale board never renders. The store's `remove` reducer then
 * activates the next remaining connection (which loads normally) or clears
 * `activeId` → the login screen. No-op when there's no active connection or the
 * active one is the demo (which never 401s). Also drops the persisted board
 * cache so it can't rehydrate a stale board on reload.
 */
export function handleBoardAuthFailure(queryClient: QueryClient): void {
  const active = getActive()
  if (!active || active.id === DEMO_CONNECTION_ID) return
  queryClient.removeQueries({ queryKey: ['board', active.id] })
  localStorage.removeItem('ado-taskboard-cache')
  removeConnection(active.id)
}
