import { describe, it, expect, beforeEach, vi } from 'vitest'
import { upsert, remove, setActive, clearAll, redact } from './store'
import type { Stored, Connection } from './store'

const conn = (id: string, over: Partial<Connection> = {}): Connection => ({
  id, label: `L${id}`, org: 'o', project: 'p', pat: 'secret', ...over,
})
const empty: Stored = { connections: [], activeId: null }
const conn0Stored: Stored = { connections: [conn('x')], activeId: 'x' }

describe('upsert', () => {
  it('adds a new connection and does not change activeId', () => {
    const s = upsert(empty, conn('a'))
    expect(s.connections.map((c) => c.id)).toEqual(['a'])
    expect(s.activeId).toBeNull()
  })
  it('replaces an existing connection by id (no duplicate)', () => {
    const s0 = upsert(empty, conn('a', { label: 'old' }))
    const s1 = upsert(s0, conn('a', { label: 'new' }))
    expect(s1.connections).toHaveLength(1)
    expect(s1.connections[0].label).toBe('new')
  })
})

describe('remove', () => {
  it('drops the connection', () => {
    const s = remove(upsert(empty, conn('a')), 'a')
    expect(s.connections).toEqual([])
  })
  it('reassigns active to the first remaining when the active one is removed', () => {
    let s: Stored = upsert(upsert(empty, conn('a')), conn('b'))
    s = setActive(s, 'a')
    s = remove(s, 'a')
    expect(s.activeId).toBe('b')
  })
  it('active → null when the last connection is removed', () => {
    let s = setActive(upsert(empty, conn('a')), 'a')
    s = remove(s, 'a')
    expect(s.activeId).toBeNull()
  })
  it('leaves active untouched when a non-active one is removed', () => {
    let s: Stored = upsert(upsert(empty, conn('a')), conn('b'))
    s = setActive(s, 'a')
    s = remove(s, 'b')
    expect(s.activeId).toBe('a')
  })
})

describe('setActive / clearAll', () => {
  it('setActive sets the id', () => {
    const s = setActive(upsert(empty, conn('a')), 'a')
    expect(s.activeId).toBe('a')
  })
  it('clearAll empties everything', () => {
    expect(clearAll()).toEqual({ connections: [], activeId: null })
  })
})

describe('redact', () => {
  it('masks a present PAT and keeps empty as empty', () => {
    expect(redact(conn('a')).pat).toBe('***')
    expect(redact(conn('a', { pat: '' })).pat).toBe('')
  })
})

describe('updateConnection', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('updates an existing connection by id and preserves the active id', async () => {
    const { save, updateConnection, load } = await import('./store')
    save({ connections: [conn('a', { label: 'old', me: '' }), conn('b')], activeId: 'a' })

    updateConnection(conn('a', { label: 'new', me: 'me@demo', org: 'o2', project: 'p2' }))

    const after = load()
    expect(after.activeId).toBe('a')
    expect(after.connections).toHaveLength(2)
    const updated = after.connections.find((c) => c.id === 'a')!
    expect(updated.label).toBe('new')
    expect(updated.me).toBe('me@demo')
    expect(updated.org).toBe('o2')
    expect(updated.project).toBe('p2')
    // The other connection is untouched.
    expect(after.connections.find((c) => c.id === 'b')!.label).toBe('Lb')
  })

  it('does not change the active id even when a non-active connection is edited', async () => {
    const { save, updateConnection, load } = await import('./store')
    save({ connections: [conn('a'), conn('b')], activeId: 'b' })

    updateConnection(conn('a', { label: 'edited' }))

    expect(load().activeId).toBe('b')
  })
})

// Regression coverage for a real bug caught live in the browser: load() used
// to re-parse localStorage on every call, returning a fresh object reference
// each time. useConnections.ts passes load as useSyncExternalStore's
// getSnapshot, which compares snapshots by reference — a fresh reference on
// every render read as "changed every render" and looped ("Maximum update
// depth exceeded"). `cache` is module-level, so each case re-imports the
// module fresh via vi.resetModules() rather than relying on shared state.
describe('load() snapshot stability (useSyncExternalStore contract)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('returns the same reference across calls with no intervening save()', async () => {
    const { load } = await import('./store')
    expect(load()).toBe(load())
  })

  it('save() swaps the reference so subscribers see a real change', async () => {
    const { load, save, clearAll: clear } = await import('./store')
    const before = load()
    save(clear())
    expect(load()).not.toBe(before)
  })

  it('a cross-tab storage event invalidates the cache so the next load() re-reads', async () => {
    const { load } = await import('./store')
    const before = load() // localStorage is empty here → the shared EMPTY singleton
    // Simulate another tab writing a real connection directly, bypassing this
    // module's save() (as a genuinely different tab's own module instance would).
    localStorage.setItem('ado-taskboard-connections', JSON.stringify(conn0Stored))
    window.dispatchEvent(new StorageEvent('storage', { key: 'ado-taskboard-connections' }))
    const after = load()
    expect(after).not.toBe(before)
    expect(after.connections).toHaveLength(1)
  })
})
