import { useInfiniteQuery } from '@tanstack/react-query'
import { getWorkItemComments } from '../api/client'
import type { WorkItemComment } from '../api/types'

export interface UseWorkItemCommentsResult {
  /** All loaded comments, flattened across fetched pages (oldest→newest). */
  comments: WorkItemComment[]
  isLoading: boolean
  error: Error | null
  hasNextPage: boolean
  fetchNextPage: () => void
  isFetchingNextPage: boolean
  /** Total comment count reported by ADO on the first page, when present. */
  totalCount: number | undefined
}

/**
 * Lazily fetches a work item's discussion comments for the ticket modal,
 * paginated with TanStack Query's `useInfiniteQuery` (ADO's `continuationToken`
 * drives the "Load more" affordance). Cached via TanStack with the app's
 * `staleTime: Infinity` default (re-opening a ticket already fetched is instant,
 * no refetch). Disabled until an id is supplied.
 */
export function useWorkItemComments(id: number | null): UseWorkItemCommentsResult {
  const { data, isLoading, error, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['workitem-comments', id],
    queryFn: ({ pageParam }) => getWorkItemComments(id!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.continuationToken, // undefined stops pagination
    enabled: id != null,
  })

  return {
    comments: data?.pages.flatMap((p) => p.comments) ?? [],
    isLoading,
    error: (error as Error) ?? null,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    totalCount: data?.pages[0]?.totalCount,
  }
}
