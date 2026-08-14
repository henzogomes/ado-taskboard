import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetActive } = vi.hoisted(() => ({
  mockGetActive: vi.fn<() => { id: string } | null>(() => null),
}))

const iterationsFixture = [
  { id: 'sprint-2', name: 'Sprint 2', path: 'P\\Sprint 2', startDate: '2026-02-01T00:00:00Z', timeFrame: 'future' },
  { id: 'sprint-1', name: 'Sprint 1', path: 'P\\Sprint 1', startDate: '2026-01-01T00:00:00Z', timeFrame: 'past' },
]

const backlogsFixture = {
  requirement: { boardName: 'Stories', workItemTypes: ['User Story', 'Bug'] },
  task: { workItemTypes: ['Task'] },
  portfolios: [] as { name: string; workItemTypes: string[] }[],
}
const backlogsWithEpics = {
  ...backlogsFixture,
  portfolios: [{ name: 'Epics', workItemTypes: ['Epic'] }],
}

vi.mock('../api/client', () => ({
  resolveTeam: vi.fn(async () => 'T'),
  fetchBacklogs: vi.fn(async () => backlogsFixture),
  fetchBoard: vi.fn(async () => ({ columns: [] })),
  fetchProjectIterations: vi.fn(async () => iterationsFixture),
  fetchStates: vi.fn(async () => ({ New: 'Proposed' })),
  queryWorkItemIds: vi.fn(async () => []),
  fetchWorkItems: vi.fn(async () => []),
  patchState: vi.fn(async () => ({})),
}))

vi.mock('../connections/store', () => ({
  getActive: mockGetActive,
}))

import { createElement, type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fetchBacklogs, fetchBoard, queryWorkItemIds } from '../api/client'
import { useBoardData } from './useBoardData'

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  })
}

function wrapperFor(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

function createWrapper() {
  return wrapperFor(createClient())
}

describe('useBoardData', () => {
  beforeEach(() => {
    // Default to an active connection so the query is enabled; the no-active
    // cases below override this with `null` to exercise the disabled path.
    mockGetActive.mockReturnValue({ id: 'conn' })
    vi.mocked(fetchBacklogs).mockResolvedValue(backlogsFixture)
  })

  it('loads and sets lastUpdated', async () => {
    const { result } = renderHook(() => useBoardData('all', 'tasks'), { wrapper: createWrapper() })
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.lastUpdated).toBeInstanceOf(Date)
    expect(result.current.error).toBeNull()
    expect(result.current.sections).toEqual([])
    expect(result.current.columns).toEqual([])
  })

  it('exposes the full, chronologically-sorted iteration list independent of sections', async () => {
    const { result } = renderHook(() => useBoardData('all', 'tasks'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.sections).toEqual([])
    expect(result.current.iterations.map((it) => it.id)).toEqual(['sprint-1', 'sprint-2'])
  })

  it('builds the WIQL from the discovered story + task types, and fetches the discovered board', async () => {
    const { result } = renderHook(() => useBoardData('all', 'tasks'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    const wiql = vi.mocked(queryWorkItemIds).mock.calls.at(-1)?.[0] as string
    expect(wiql).toContain("[System.WorkItemType] IN ('User Story', 'Bug', 'Task')")

    expect(vi.mocked(fetchBoard)).toHaveBeenCalledWith('T', 'Stories')
    expect(result.current.stateCategory).toEqual({ New: 'Proposed' })
  })

  it('exposes the discovered levels and resolves the requested view', async () => {
    vi.mocked(fetchBacklogs).mockResolvedValue(backlogsWithEpics)
    const { result } = renderHook(() => useBoardData('all', 'tasks'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.levels.map((v) => v.id)).toEqual(['tasks', 'requirement', 'epics'])
    expect(result.current.view?.kind).toBe('lanes')
    expect(result.current.levelId).toBe('tasks')
  })

  it("the requirement (flat) view queries only story types and yields flatColumns", async () => {
    const { result } = renderHook(() => useBoardData('all', 'requirement'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.view?.kind).toBe('flat')
    expect(result.current.sections).toEqual([])
    expect(result.current.flatColumns).toEqual([]) // empty board fixture → no columns
    const wiql = vi.mocked(queryWorkItemIds).mock.calls.at(-1)?.[0] as string
    expect(wiql).toContain("IN ('User Story', 'Bug')")
    expect(wiql).not.toContain('Task')
  })

  it('a portfolio (flat) view is NOT iteration-scoped, even under a current scope', async () => {
    vi.mocked(fetchBacklogs).mockResolvedValue(backlogsWithEpics)
    const { result } = renderHook(() => useBoardData('current', 'epics'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.view?.kind).toBe('flat')
    expect(result.current.view?.iterationScoped).toBe(false)
    expect(vi.mocked(fetchBoard)).toHaveBeenCalledWith('T', 'Epics')
    const wiql = vi.mocked(queryWorkItemIds).mock.calls.at(-1)?.[0] as string
    expect(wiql).toContain("IN ('Epic')")
    expect(wiql).not.toContain('UNDER') // no iteration-path filter for portfolios
  })

  it('falls back to the first level when the requested one is not in this project', async () => {
    // persisted 'epics' but this project has no portfolios → resolves to 'tasks'
    const { result } = renderHook(() => useBoardData('all', 'epics'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.levelId).toBe('tasks')
    expect(result.current.view?.kind).toBe('lanes')
  })

  it('scopes the cache by the active connection id and level, so distinct entries', async () => {
    const queryClient = createClient()
    const wrapper = wrapperFor(queryClient)

    mockGetActive.mockReturnValue({ id: 'conn-a' })
    const a = renderHook(() => useBoardData('all', 'tasks'), { wrapper })
    await waitFor(() => expect(a.result.current.loading).toBe(false))

    mockGetActive.mockReturnValue({ id: 'conn-b' })
    const b = renderHook(() => useBoardData('all', 'tasks'), { wrapper })
    await waitFor(() => expect(b.result.current.loading).toBe(false))

    const keys = queryClient
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey)
    expect(keys).toContainEqual(['board', 'conn-a', 'all', 'tasks'])
    expect(keys).toContainEqual(['board', 'conn-b', 'all', 'tasks'])
  })

  it("uses 'none' as the id segment when no connection is active", async () => {
    mockGetActive.mockReturnValue(null)
    const queryClient = createClient()
    const wrapper = wrapperFor(queryClient)

    renderHook(() => useBoardData('all', 'tasks'), { wrapper })

    const keys = queryClient
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey)
    expect(keys).toContainEqual(['board', 'none', 'all', 'tasks'])
  })

  it('disables the query when there is no active connection (never fetches)', async () => {
    mockGetActive.mockReturnValue(null)
    const queryClient = createClient()
    const wrapper = wrapperFor(queryClient)
    const backlogsCallsBefore = vi.mocked(fetchBacklogs).mock.calls.length

    const { result } = renderHook(() => useBoardData('all', 'tasks'), { wrapper })

    // A disabled query stays pending but idle — it must never hit the network.
    await waitFor(() => {
      const query = queryClient.getQueryCache().find({ queryKey: ['board', 'none', 'all', 'tasks'] })
      expect(query?.state.fetchStatus).toBe('idle')
    })
    expect(result.current.loading).toBe(true)
    expect(vi.mocked(fetchBacklogs).mock.calls.length).toBe(backlogsCallsBefore)
  })
})
