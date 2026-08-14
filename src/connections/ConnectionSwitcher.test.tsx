import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConnectionSwitcher } from './ConnectionSwitcher'
import * as store from './store'
import type { Connection, Stored } from './store'

const conns: Connection[] = [
  { id: 'a', label: 'Org A / P1', org: 'orgA', project: 'P1', pat: '' },
  { id: 'b', label: 'Org B / P2', org: 'orgB', project: 'P2', pat: 'x' },
]

function withStore(activeId: string) {
  const stored: Stored = { connections: conns, activeId }
  vi.spyOn(store, 'load').mockReturnValue(stored)
  vi.spyOn(store, 'subscribe').mockReturnValue(() => {})
}

describe('ConnectionSwitcher', () => {
  beforeEach(() => {
    vi.spyOn(store, 'setActiveConnection').mockImplementation(() => {})
    vi.spyOn(store, 'logoutAll').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('renders one item per connection and marks the active one', async () => {
    withStore('a')
    const user = userEvent.setup()
    render(<ConnectionSwitcher onLogoutAll={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /connection/i }))

    expect(screen.getByRole('menuitem', { name: /Org A \/ P1/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('menuitem', { name: /Org B \/ P2/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Add connection/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Log out of all/ })).toBeInTheDocument()
  })

  it('calls setActive when another connection is picked', async () => {
    withStore('a')
    const user = userEvent.setup()
    render(<ConnectionSwitcher onLogoutAll={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /connection/i }))
    await user.click(screen.getByRole('menuitem', { name: /Org B \/ P2/ }))

    expect(store.setActiveConnection).toHaveBeenCalledWith('b')
  })

  it('logs out of all after confirming, and invokes the onLogoutAll cache-clear callback', async () => {
    withStore('a')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onLogoutAll = vi.fn()
    const user = userEvent.setup()
    render(<ConnectionSwitcher onLogoutAll={onLogoutAll} />)

    await user.click(screen.getByRole('button', { name: /connection/i }))
    await user.click(screen.getByRole('menuitem', { name: /Log out of all/ }))

    expect(window.confirm).toHaveBeenCalledTimes(1)
    expect(store.logoutAll).toHaveBeenCalledTimes(1)
    expect(onLogoutAll).toHaveBeenCalledTimes(1)
  })

  it('does not log out when the confirm dialog is dismissed', async () => {
    withStore('a')
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onLogoutAll = vi.fn()
    const user = userEvent.setup()
    render(<ConnectionSwitcher onLogoutAll={onLogoutAll} />)

    await user.click(screen.getByRole('button', { name: /connection/i }))
    await user.click(screen.getByRole('menuitem', { name: /Log out of all/ }))

    expect(store.logoutAll).not.toHaveBeenCalled()
    expect(onLogoutAll).not.toHaveBeenCalled()
  })

  it('shows "Edit this connection" when there is an active connection', async () => {
    withStore('a')
    const user = userEvent.setup()
    render(<ConnectionSwitcher onLogoutAll={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /connection/i }))

    expect(screen.getByRole('menuitem', { name: /Edit this connection/ })).toBeInTheDocument()
  })

  it('hides "Edit this connection" when there is no active connection', async () => {
    // No active id → the active-only items (Edit / Log out of this) are absent.
    const stored: Stored = { connections: conns, activeId: '' }
    vi.spyOn(store, 'load').mockReturnValue(stored)
    vi.spyOn(store, 'subscribe').mockReturnValue(() => {})
    const user = userEvent.setup()
    render(<ConnectionSwitcher onLogoutAll={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /connection/i }))

    expect(screen.queryByRole('menuitem', { name: /Edit this connection/ })).not.toBeInTheDocument()
  })

  it('opens the edit overlay pre-filled from the active connection when "Edit this connection" is picked', async () => {
    withStore('b')
    const user = userEvent.setup()
    render(<ConnectionSwitcher onLogoutAll={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /connection/i }))
    await user.click(screen.getByRole('menuitem', { name: /Edit this connection/ }))

    // The edit LoginScreen overlay is shown, pre-filled from connection 'b'.
    expect(screen.getByRole('heading', { name: /edit connection/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/organization/i)).toHaveValue('orgB')
    expect(screen.getByLabelText(/project/i)).toHaveValue('P2')
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })
})
