import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginScreen } from './LoginScreen'
import * as store from './store'
import type { Connection } from './store'

async function fillAndSubmit() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/organization/i), 'contoso')
  await user.type(screen.getByLabelText(/project/i), 'MyProject')
  await user.type(screen.getByLabelText(/personal access token/i), 'tok123')
  await user.click(screen.getByRole('button', { name: /add connection/i }))
  return user
}

function mockFetch(response: Partial<Response> & { status: number; ok?: boolean }) {
  return vi.fn().mockResolvedValue({
    ok: response.ok ?? (response.status >= 200 && response.status < 300),
    status: response.status,
    json: async () => ({}),
  } as Response)
}

describe('LoginScreen', () => {
  let addSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    addSpy = vi.spyOn(store, 'addConnection').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('validates via the proxy and adds the connection on a 200', async () => {
    vi.stubGlobal('fetch', mockFetch({ status: 200 }))
    render(<LoginScreen />)

    await fillAndSubmit()

    await waitFor(() => expect(addSpy).toHaveBeenCalledTimes(1))
    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        org: 'contoso',
        project: 'MyProject',
        pat: 'tok123',
        label: 'contoso / MyProject',
      }),
    )
    // The validate call went through the proxy with the entered headers.
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/ado/_apis/projects/MyProject')
    expect(new Headers(init.headers).get('X-ADO-Org')).toBe('contoso')
    expect(new Headers(init.headers).get('X-ADO-PAT')).toBe('tok123')
  })

  it('shows a PAT error and does not add on a 401', async () => {
    vi.stubGlobal('fetch', mockFetch({ status: 401 }))
    render(<LoginScreen />)

    await fillAndSubmit()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/rejected/i)
    expect(addSpy).not.toHaveBeenCalled()
  })

  it('shows a "project not found" error on a 404', async () => {
    vi.stubGlobal('fetch', mockFetch({ status: 404 }))
    render(<LoginScreen />)

    await fillAndSubmit()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/project not found/i)
    expect(addSpy).not.toHaveBeenCalled()
  })

  it('shows a proxy-unreachable error when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    render(<LoginScreen />)

    await fillAndSubmit()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/reach the proxy/i)
    expect(addSpy).not.toHaveBeenCalled()
  })
})

describe('LoginScreen — edit mode', () => {
  let addSpy: ReturnType<typeof vi.spyOn>
  let updateSpy: ReturnType<typeof vi.spyOn>

  const existing: Connection = {
    id: 'conn-1',
    label: 'Old label',
    org: 'contoso',
    project: 'MyProject',
    team: 'MyTeam',
    me: 'me@demo',
    pat: 'tok123',
  }

  beforeEach(() => {
    addSpy = vi.spyOn(store, 'addConnection').mockImplementation(() => {})
    updateSpy = vi.spyOn(store, 'updateConnection').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('pre-fills the form from editConnection (including the PAT) and hides "View demo"', () => {
    render(<LoginScreen editConnection={existing} onCancel={vi.fn()} />)

    expect(screen.getByRole('heading', { name: /edit connection/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/label/i)).toHaveValue('Old label')
    expect(screen.getByLabelText(/organization/i)).toHaveValue('contoso')
    expect(screen.getByLabelText(/project/i)).toHaveValue('MyProject')
    expect(screen.getByLabelText(/team/i)).toHaveValue('MyTeam')
    expect(screen.getByLabelText(/^me/i)).toHaveValue('me@demo')
    expect(screen.getByLabelText(/personal access token/i)).toHaveValue('tok123')
    expect(screen.queryByRole('button', { name: /view demo/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })

  it('on Save validates then calls updateConnection (not addConnection), keeping the same id, and closes', async () => {
    vi.stubGlobal('fetch', mockFetch({ status: 200 }))
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<LoginScreen editConnection={existing} onCancel={onCancel} />)

    // Edit a field, then save.
    const meInput = screen.getByLabelText(/^me/i)
    await user.clear(meInput)
    await user.type(meInput, 'new@demo')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1))
    expect(addSpy).not.toHaveBeenCalled()
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'conn-1',
        org: 'contoso',
        project: 'MyProject',
        me: 'new@demo',
        pat: 'tok123',
      }),
    )
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1))
  })
})
