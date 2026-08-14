import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthError } from './api/client'
import type { UseBoardDataResult } from './hooks/useBoardData'
import { save, load } from './connections/store'
import type { Connection } from './connections/store'

// The board hook is stubbed to report a 401 (AuthError) with an otherwise empty
// board, so the test drives ONLY App's auth-failure wiring, not a real load.
const { mockUseBoardData } = vi.hoisted(() => ({ mockUseBoardData: vi.fn() }))
vi.mock('./hooks/useBoardData', () => ({ useBoardData: mockUseBoardData }))

import App from './App'

const authErrorResult: UseBoardDataResult = {
  levelId: 'tasks',
  view: null,
  levels: [],
  sections: [],
  flatColumns: [],
  columns: [],
  iterations: [],
  loading: false,
  error: new AuthError('ADO 401 https://example/_apis/board'),
  lastUpdated: null,
  refresh: vi.fn(),
  applyLocal: vi.fn(),
  applyLocalFlat: vi.fn(),
  stateCategory: {},
}

const conn = (id: string, over: Partial<Connection> = {}): Connection => ({
  id, label: `L${id}`, org: 'o', project: 'p', pat: '', ...over,
})

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}

describe('App — board-load 401 handling', () => {
  beforeEach(() => {
    localStorage.clear()
    save({ connections: [], activeId: null })
    localStorage.clear()
    mockUseBoardData.mockReturnValue(authErrorResult)
  })

  it('drops the failing active connection and falls to the login screen without painting a stale board', async () => {
    save({ connections: [conn('A')], activeId: 'A' })

    renderApp()

    // The effect drops the failing connection → empty store → login screen.
    await waitFor(() => expect(screen.getByText('Connect to Azure DevOps')).toBeInTheDocument())
    expect(load().connections).toEqual([])
    expect(load().activeId).toBeNull()
    // No stale board and no red error banner leaked through during the logout.
    expect(screen.queryByText(/Failed to load board/)).not.toBeInTheDocument()
  })
})
