import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchFields } from '../api/client'
import { getActive } from '../connections/store'
import type { FieldMeta } from '../api/types'

export interface UseFieldMetaResult {
  /** Reference name → field metadata for the active project. */
  meta: Record<string, FieldMeta>
  isLoading: boolean
}

const EMPTY_META: Record<string, FieldMeta> = {}

/**
 * The active project's field catalog (reference name → display name + type),
 * discovered once via `fetchFields` and cached by TanStack Query with the
 * app's `staleTime: Infinity` default. Keyed by the active connection id so
 * switching projects refetches. Feeds the ticket modal's dynamic field
 * rendering (`richTextFields`).
 */
export function useFieldMeta(): UseFieldMetaResult {
  const activeId = getActive()?.id ?? 'none'
  const { data, isLoading } = useQuery({
    queryKey: ['fields', activeId],
    queryFn: fetchFields,
  })

  const meta = useMemo(() => {
    if (!data) return EMPTY_META
    return Object.fromEntries(data.map((f) => [f.referenceName, f]))
  }, [data])

  return { meta, isLoading }
}
