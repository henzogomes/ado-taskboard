import { describe, it, expect, beforeEach, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { handleBoardAuthFailure } from './handleAuthFailure'
import { save, load } from './store'
import type { Connection } from './store'
import { DEMO_CONNECTION } from '../demo/connection'

const conn = (id: string, over: Partial<Connection> = {}): Connection => ({
  id, label: `L${id}`, org: 'o', project: 'p', pat: 'secret', ...over,
})

describe('handleBoardAuthFailure', () => {
  beforeEach(() => {
    localStorage.clear()
    // The store caches its parsed state in-module; reset it to the cleared
    // localStorage so each case starts from a known store.
    save({ connections: [], activeId: null })
    localStorage.clear()
  })

  it('drops the failing active connection, swaps to the next one, and clears the persisted cache', () => {
    save({ connections: [conn('A'), conn('B')], activeId: 'A' })
    localStorage.setItem('ado-taskboard-cache', 'x')
    const qc = new QueryClient()
    const removeQueries = vi.spyOn(qc, 'removeQueries')

    handleBoardAuthFailure(qc)

    const after = load()
    expect(after.connections.map((c) => c.id)).toEqual(['B'])
    expect(after.activeId).toBe('B')
    expect(localStorage.getItem('ado-taskboard-cache')).toBeNull()
    expect(removeQueries).toHaveBeenCalledWith({ queryKey: ['board', 'A'] })
  })

  it('drops to the login state (empty store, null active) when the last connection fails', () => {
    save({ connections: [conn('A')], activeId: 'A' })
    localStorage.setItem('ado-taskboard-cache', 'x')

    handleBoardAuthFailure(new QueryClient())

    const after = load()
    expect(after.connections).toEqual([])
    expect(after.activeId).toBeNull()
    expect(localStorage.getItem('ado-taskboard-cache')).toBeNull()
  })

  it('is a no-op when the demo connection is active (demo never 401s)', () => {
    save({ connections: [DEMO_CONNECTION], activeId: DEMO_CONNECTION.id })
    localStorage.setItem('ado-taskboard-cache', 'x')
    const qc = new QueryClient()
    const removeQueries = vi.spyOn(qc, 'removeQueries')

    handleBoardAuthFailure(qc)

    const after = load()
    expect(after.connections.map((c) => c.id)).toEqual([DEMO_CONNECTION.id])
    expect(after.activeId).toBe(DEMO_CONNECTION.id)
    expect(localStorage.getItem('ado-taskboard-cache')).toBe('x')
    expect(removeQueries).not.toHaveBeenCalled()
  })

  it('is a no-op when there is no active connection', () => {
    save({ connections: [conn('A')], activeId: null })
    localStorage.setItem('ado-taskboard-cache', 'x')
    const qc = new QueryClient()
    const removeQueries = vi.spyOn(qc, 'removeQueries')

    handleBoardAuthFailure(qc)

    const after = load()
    expect(after.connections.map((c) => c.id)).toEqual(['A'])
    expect(after.activeId).toBeNull()
    expect(localStorage.getItem('ado-taskboard-cache')).toBe('x')
    expect(removeQueries).not.toHaveBeenCalled()
  })
})
