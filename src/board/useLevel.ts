import { useCallback, useEffect, useState } from 'react'
import type { LevelView } from './level'

const KEY = 'ado-taskboard-level'
const DEFAULT_ID = 'tasks'

function readStored(): string {
  return localStorage.getItem(KEY) || DEFAULT_ID
}

/**
 * Level-toggle state (#3): which `LevelView` (by id) is currently selected.
 * Persists under `ado-taskboard-level`, defaulting to `'tasks'`. Mirrors the
 * `useShowAllColumns` / `useTheme` read-then-persist-on-change pattern.
 *
 * `levels` may be empty on first render (before the backlog-levels data
 * loads) — the persisted/default id is returned as-is in that case, with no
 * validation against an empty list. Once `levels` arrives, a persisted id
 * that isn't one of them (e.g. from a project whose portfolios changed)
 * falls back to `'tasks'` (or `levels[0].id` if `'tasks'` itself isn't
 * present).
 */
export function useLevel(levels: LevelView[]) {
  const [levelId, setLevelId] = useState<string>(readStored)

  useEffect(() => {
    if (levels.length > 0 && !levels.some((v) => v.id === levelId)) {
      setLevelId(levels.some((v) => v.id === DEFAULT_ID) ? DEFAULT_ID : levels[0].id)
      return
    }
    localStorage.setItem(KEY, levelId)
  }, [levels, levelId])

  const setLevel = useCallback((id: string) => setLevelId(id), [])

  return { levelId, setLevel }
}
