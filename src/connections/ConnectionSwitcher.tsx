import { useEffect, useRef, useState } from 'react'
import { Dropdown } from '../board/Dropdown'
import type { DropdownItem } from '../board/Dropdown'
import { LoginScreen } from './LoginScreen'
import { useConnections } from './useConnections'

const ADD = '__add__'
const LOGOUT_ONE = '__logout_one__'
const LOGOUT_ALL = '__logout_all__'

interface ConnectionSwitcherProps {
  /** Called after "Log out of all" so `App` can clear the persisted query cache
   *  (kept a prop, not a `queryClient` import, to keep this component decoupled). */
  onLogoutAll: () => void
}

/**
 * Header control: a `Dropdown` listing every stored connection (active marked),
 * plus "+ Add connection…" (opens `LoginScreen` as an overlay), "Log out of this
 * connection", and "Log out of all". Picking a connection switches the active one
 * — `useBoardData` keys by the active id, so the board refetches on switch.
 */
export function ConnectionSwitcher({ onLogoutAll }: ConnectionSwitcherProps) {
  const { connections, active, setActive, remove, logoutAll } = useConnections()
  const [showAdd, setShowAdd] = useState(false)

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
    ...(active ? [{ value: LOGOUT_ONE, label: 'Log out of this connection' }] : []),
    { value: LOGOUT_ALL, label: 'Log out of all' },
  ]

  function onSelect(value: string) {
    if (value === ADD) {
      setShowAdd(true)
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
    </>
  )
}
