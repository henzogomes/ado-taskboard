export interface Connection {
  id: string
  label: string
  org: string
  project: string
  team?: string
  me?: string
  /** '' = use the proxy's server-side env PAT (dual-mode). */
  pat: string
}
export interface Stored {
  connections: Connection[]
  activeId: string | null
}

const KEY = 'ado-taskboard-connections'
const EMPTY: Stored = { connections: [], activeId: null }

// ---- pure reducers ----
export function upsert(state: Stored, conn: Connection): Stored {
  const i = state.connections.findIndex((c) => c.id === conn.id)
  const connections = i === -1
    ? [...state.connections, conn]
    : state.connections.map((c) => (c.id === conn.id ? conn : c))
  return { ...state, connections }
}
export function remove(state: Stored, id: string): Stored {
  const connections = state.connections.filter((c) => c.id !== id)
  const activeId = state.activeId === id ? (connections[0]?.id ?? null) : state.activeId
  return { connections, activeId }
}
export function setActive(state: Stored, id: string): Stored {
  return { ...state, activeId: id }
}
export function clearAll(): Stored {
  return { connections: [], activeId: null }
}
export function redact(conn: Connection): Connection {
  return { ...conn, pat: conn.pat ? '***' : '' }
}

// ---- IO + subscribe ----
type Listener = () => void
const listeners = new Set<Listener>()
export function subscribe(cb: Listener): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
function emit() { listeners.forEach((l) => l()) }

// `load()` doubles as the `useSyncExternalStore` snapshot function
// (`useConnections.ts`), which requires a REFERENTIALLY STABLE return value
// across calls until something actually changes — React calls it on every
// render to check for tearing, and a fresh object each time (e.g. a raw
// JSON.parse per call) reads as "changed every render" and loops forever
// ("Maximum update depth exceeded"). So the parsed result is cached in
// memory; only `save()` (a real write) or a cross-tab `storage` event
// invalidates it.
let cache: Stored | null = null

function readFromStorage(): Stored {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.connections)) return EMPTY
    return {
      connections: parsed.connections.filter(
        (c: any) => c && typeof c.id === 'string' && typeof c.org === 'string' && typeof c.project === 'string',
      ),
      activeId: typeof parsed.activeId === 'string' ? parsed.activeId : null,
    }
  } catch {
    return EMPTY
  }
}

export function load(): Stored {
  if (cache === null) cache = readFromStorage()
  return cache
}
export function save(state: Stored): void {
  localStorage.setItem(KEY, JSON.stringify(state))
  cache = state
  emit()
}
export function getActive(): Connection | null {
  const s = load()
  return s.connections.find((c) => c.id === s.activeId) ?? null
}
export function listConnections(): Connection[] { return load().connections }
export function addConnection(conn: Connection): void {
  save(setActive(upsert(load(), conn), conn.id)) // add + activate
}
export function setActiveConnection(id: string): void { save(setActive(load(), id)) }
export function removeConnection(id: string): void { save(remove(load(), id)) }
export function logoutAll(): void { save(clearAll()) }

// cross-tab consistency — another tab wrote to the same key, so our cache is
// stale; invalidate it (next load() re-reads) before notifying subscribers.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      cache = null
      emit()
    }
  })
}
