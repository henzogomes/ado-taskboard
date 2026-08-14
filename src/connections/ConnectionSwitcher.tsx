import { useEffect, useRef, useState } from 'react'
import { Dropdown } from '../board/Dropdown'
import type { DropdownItem } from '../board/Dropdown'
import { LoginScreen } from './LoginScreen'
import { useConnections } from './useConnections'
import type { Connection } from './store'

const ADD = '__add__'
const EDIT = '__edit__'
const LOGOUT_ONE = '__logout_one__'
const LOGOUT_ALL = '__logout_all__'

interface ConnectionSwitcherProps {
  /** Called after "Log out of all" so `App` can clear the persisted query cache
   *  (kept a prop, not a `queryClient` import, to keep this component decoupled). */
  onLogoutAll: () => void
  /** Called after an edit that changed the ACTIVE connection's org or project —
   *  `useBoardData` keys by the (unchanged) active id, so the board would otherwise
   *  keep stale cache. `App` wires this to invalidate the board query + drop the
   *  persisted cache. Kept a prop (not a `queryClient` import) to stay decoupled. */
  onConnectionEdited?: () => void
}

/**
 * Header control: a `Dropdown` listing every stored connection (active marked),
 * plus "+ Add connection…" (opens `LoginScreen` as an overlay), "Log out of this
 * connection", and "Log out of all". Picking a connection switches the active one
 * — `useBoardData` keys by the active id, so the board refetches on switch.
 */
export function ConnectionSwitcher({ onLogoutAll, onConnectionEdited }: ConnectionSwitcherProps) {
  const { connections, active, setActive, remove, logoutAll, getActive } = useConnections()
  const [showAdd, setShowAdd] = useState(false)
  // The active connection captured when the edit overlay opened — its pre-edit
  // org/project, compared against the freshest store value on close to decide
  // whether the board must reload. Non-null iff the edit overlay is open.
  const [editing, setEditing] = useState<Connection | null>(null)

  // Close the add overlay once a new connection lands (addConnection activates
  // it, so the active id changes) — avoids threading an onSuccess through
  // LoginScreen just for this.
  const activeId = active?.id ?? null
  const prevActiveId = useRef(activeId)
  useEffect(() => {
    if (showAdd && activeId !== prevActiveId.current) setShowAdd(false)
    prevActiveId.current = activeId
  }, [activeId, showAdd])

  const items: DropdownItem[] = [
    ...connections.map((c) => ({ value: c.id, label: c.label, current: c.id === activeId })),
    { value: ADD, label: '+ Add connection…' },
    ...(active ? [{ value: EDIT, label: 'Edit this connection' }] : []),
    ...(active ? [{ value: LOGOUT_ONE, label: 'Log out of this connection' }] : []),
    { value: LOGOUT_ALL, label: 'Log out of all' },
  ]

  // Close the edit overlay; if the active connection's org/project changed while
  // it was open, the board's query key (which uses the unchanged active id) would
  // keep stale data — so tell App to reload. LoginScreen calls this same handler
  // both after a successful save AND on Cancel; a plain cancel leaves the stored
  // connection untouched, so the org/project comparison is a no-op and no reload
  // fires. Reads the FRESHEST connection via getActive() (the store was updated
  // synchronously on save), not the possibly-stale `active` from this render.
  function closeEdit() {
    const before = editing
    const current = getActive()
    if (
      before &&
      current &&
      current.id === before.id &&
      (current.org !== before.org || current.project !== before.project)
    ) {
      onConnectionEdited?.()
    }
    setEditing(null)
  }

  function onSelect(value: string) {
    if (value === ADD) {
      setShowAdd(true)
    } else if (value === EDIT) {
      if (active) setEditing(active)
    } else if (value === LOGOUT_ONE) {
      if (active) remove(active.id)
    } else if (value === LOGOUT_ALL) {
      if (!window.confirm('Log out of all connections? This removes every stored PAT.')) return
      logoutAll()
      onLogoutAll()
    } else {
      setActive(value)
    }
  }

  return (
    <>
      <Dropdown
        buttonLabel={active?.label ?? 'No connection'}
        items={items}
        onSelect={onSelect}
        ariaLabel="Connection"
        triggerClassName="flex items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-raised"
      />
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex w-full max-w-md flex-col">
            <LoginScreen onCancel={() => setShowAdd(false)} />
          </div>
        </div>
      )}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex w-full max-w-md flex-col">
            <LoginScreen editConnection={editing} onCancel={closeEdit} />
          </div>
        </div>
      )}
    </>
  )
}
