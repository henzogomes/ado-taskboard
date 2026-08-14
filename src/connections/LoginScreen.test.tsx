import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginScreen } from './LoginScreen'
import * as store from './store'

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
