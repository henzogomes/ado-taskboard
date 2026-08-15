import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchStates } from '../api/client'
import { getActive } from '../connections/store'
import type { StateCategory } from '../api/types'

export interface UseWorkItemTypeStatesResult {
  /** State name → category for the given work-item type. */
  states: Record<string, StateCategory>
  isLoading: boolean
}

const EMPTY_STATES: Record<string, StateCategory> = {}

/**
 * The state→category map for a single work-item type, discovered from ADO via
 * `fetchStates` (never hardcoded). Keyed by the active connection id and the
 * type so switching projects/types refetches. Disabled until a type is
 * supplied. Used by the ticket modal's quick actions to find the type's
 * "Completed" (close) and "Proposed" (reopen) states.
 */
export function useWorkItemTypeStates(type: string | null): UseWorkItemTypeStatesResult {
  const activeId = getActive()?.id ?? 'none'
  const { data, isLoading } = useQuery({
    queryKey: ['states', activeId, type],
    queryFn: () => fetchStates(type ? [type] : []),
    enabled: type != null,
  })

  const states = useMemo(() => data ?? EMPTY_STATES, [data])

  return { states, isLoading }
}
