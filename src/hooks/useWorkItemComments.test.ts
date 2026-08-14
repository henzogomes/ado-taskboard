import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WorkItemCommentsPage } from '../api/types'

vi.mock('../api/client', () => ({
  getWorkItemComments: vi.fn(),
}))

import { createElement, type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getWorkItemComments } from '../api/client'
import { useWorkItemComments } from './useWorkItemComments'

const mockedGet = vi.mocked(getWorkItemComments)

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

const author = { displayName: 'Jane Doe', uniqueName: 'jane@x' }
const comment = (id: number): WorkItemCommentsPage['comments'][number] => ({
  id,
  text: `<div>Comment ${id}</div>`,
  createdBy: author,
  createdDate: '2025-07-01T09:00:00Z',
})

describe('useWorkItemComments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads the first page and reports hasNextPage when a continuationToken comes back', async () => {
    mockedGet.mockResolvedValue({ comments: [comment(1), comment(2)], continuationToken: 'tok-2', totalCount: 4 })

    const { result } = renderHook(() => useWorkItemComments(101), { wrapper: createWrapper() })
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.comments.map((c) => c.id)).toEqual([1, 2])
    expect(result.current.hasNextPage).toBe(true)
    expect(result.current.totalCount).toBe(4)
    expect(result.current.error).toBeNull()
    expect(mockedGet).toHaveBeenCalledWith(101, undefined)
  })

  it('fetchNextPage appends and flattens the second page, then stops when no token', async () => {
    mockedGet
      .mockResolvedValueOnce({ comments: [comment(1), comment(2)], continuationToken: 'tok-2', totalCount: 4 })
      .mockResolvedValueOnce({ comments: [comment(3), comment(4)], continuationToken: undefined, totalCount: 4 })

    const { result } = renderHook(() => useWorkItemComments(101), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    result.current.fetchNextPage()
    await waitFor(() => expect(result.current.comments.length).toBe(4))

    expect(result.current.comments.map((c) => c.id)).toEqual([1, 2, 3, 4])
    expect(result.current.hasNextPage).toBe(false)
    expect(mockedGet).toHaveBeenLastCalledWith(101, 'tok-2')
  })

  it('is disabled and fetches nothing when id is null', async () => {
    const { result } = renderHook(() => useWorkItemComments(null), { wrapper: createWrapper() })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.comments).toEqual([])
    expect(mockedGet).not.toHaveBeenCalled()
  })
})
