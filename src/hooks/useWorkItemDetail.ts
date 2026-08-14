import { useQuery } from '@tanstack/react-query'
import { getWorkItemDetail } from '../api/client'
import type { WorkItemDetail } from '../api/types'

export interface UseWorkItemDetailResult {
  detail: WorkItemDetail | undefined
  isLoading: boolean
  error: Error | null
}

/**
 * Lazily fetches the full work-item detail (description, acceptance
 * criteria, relations) for the ticket modal's Tier 2. Cached via TanStack
 * Query with the app's `staleTime: Infinity` default (re-opening a ticket
 * already fetched is instant, no refetch).
 */
export function useWorkItemDetail(id: number | null): UseWorkItemDetailResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['workitem', id],
    queryFn: () => getWorkItemDetail(id!),
    enabled: id != null,
  })

  return {
    detail: data,
    isLoading,
    error: (error as Error) ?? null,
  }
}
