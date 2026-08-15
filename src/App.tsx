import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AuthError, patchState } from './api/client'
import { handleBoardAuthFailure } from './connections/handleAuthFailure'
import type { WorkItem } from './api/types'
import { Board } from './board/Board'
import { FlatBoard } from './board/FlatBoard'
import { IterationPicker } from './board/IterationPicker'
import { LevelPicker } from './board/LevelPicker'
import { useLevel } from './board/useLevel'
import type { LevelView } from './board/level'
import { performMove } from './board/performMove'
import { performFlatMove } from './board/performFlatMove'
import { Toast } from './board/Toast'
import { TicketModal } from './board/TicketModal'
import { ThemePicker } from './theme/ThemePicker'
import { StateCategoryContext } from './theme/StateCategoryContext'
import { useShowAllColumns } from './board/useShowAllColumns'
import { useHighlightMine } from './board/useHighlightMine'
import { usePolling } from './board/usePolling'
import { useExpandedSections } from './board/useExpandedSections'
import { currentIterationId } from './domain/currentIteration'
import { useBoardData } from './hooks/useBoardData'
import type { BoardScope } from './hooks/useBoardData'
import { FilterBar } from './filters/FilterBar'
import { applyFilters, applyFiltersFlat, collectFacets, collectFacetsFlat } from './filters/filter'
import type { Filters } from './filters/filter'
import { CONFIG } from './config'
import { useConnections } from './connections/useConnections'
import { LoginScreen } from './connections/LoginScreen'
import { ConnectionSwitcher } from './connections/ConnectionSwitcher'
import { DEMO_CONNECTION_ID } from './demo/connection'
import { DemoBanner } from './demo/DemoBanner'

function pickerValueToScope(value: string): BoardScope {
  if (value === 'all' || value === 'current') return value
  return { iterationId: value }
}

function scopeToPickerValue(scope: BoardScope): string {
  return typeof scope === 'string' ? scope : scope.iterationId
}

interface DropToast {
  message: string
}

function App() {
  const queryClient = useQueryClient()
  const { active, remove } = useConnections()

  // No auto-seed: on first run (no stored connection) the app shows the login
  // screen, where the user enters org/project/PAT — the browser connection is the
  // sole source of truth, nothing is presented until they choose it. The
  // synthetic demo board is opt-in from there via LoginScreen's "View demo".

  const [scope, setScope] = useState<BoardScope>('current')

  // Level state ↔ board data form a cycle: `levelId` drives the query, but the
  // discovered `levels` come back FROM the query. Break it by holding the
  // discovered levels in state and feeding them into `useLevel` (which persists
  // the choice and, once levels are known, falls a stale id back to Tasks).
  const [discoveredLevels, setDiscoveredLevels] = useState<LevelView[]>([])
  const { levelId, setLevel } = useLevel(discoveredLevels)

  const {
    sections,
    flatColumns,
    columns,
    iterations,
    view,
    levels,
    loading,
    error,
    lastUpdated,
    refresh,
    applyLocal,
    applyLocalFlat,
    stateCategory,
  } = useBoardData(scope, levelId)

  useEffect(() => {
    // Only sync once real levels have loaded (always ≥ Tasks+Stories) — avoids
    // churning `useLevel` with the pre-load empty list.
    if (levels.length > 0) setDiscoveredLevels(levels)
  }, [levels])

  // A board-load 401 (blank/expired PAT) means the active connection can't
  // authenticate. Drop it and its cached board rather than paint a stale board:
  // the store then activates the next connection (which loads normally) or falls
  // to the login screen. `error` is cast to `Error` by the hook, but the thrown
  // instance is still an `AuthError`, so `instanceof` holds.
  const authError = error instanceof AuthError
  useEffect(() => {
    // Depend on the boolean, not the error object, so this fires once per
    // auth-error episode. After the removal, `active`/the query key change and a
    // fresh query runs — if THAT also 401s, a new episode cascades until a
    // working connection or the login screen. That cascade is intended.
    if (authError) handleBoardAuthFailure(queryClient)
  }, [authError, queryClient])

  const isDemo = active?.id === DEMO_CONNECTION_ID
  const isFlat = view?.kind === 'flat'
  // Portfolio views span sprints, so the iteration picker is hidden for them.
  const showIterationPicker = view?.iterationScoped ?? true

  const { showAll, toggle: toggleShowAll } = useShowAllColumns()
  const { highlightMine, toggle: toggleHighlightMine } = useHighlightMine()
  const { intervalMs, setIntervalMs, options: pollOptions } = usePolling()

  const defaultExpandedId = useMemo(() => currentIterationId(iterations, new Date()), [iterations])
  const { isExpanded, toggle: toggleSection } = useExpandedSections(defaultExpandedId)

  const [filters, setFilters] = useState<Filters>({ devs: [], tags: [], states: [], search: '' })
  const facets = useMemo(
    () => (isFlat ? collectFacetsFlat(flatColumns) : collectFacets(sections)),
    [isFlat, flatColumns, sections],
  )
  const visible = useMemo(() => applyFilters(sections, filters), [sections, filters])
  const visibleFlat = useMemo(() => applyFiltersFlat(flatColumns, filters), [flatColumns, filters])

  const [dropToast, setDropToast] = useState<DropToast | null>(null)
  const [openItem, setOpenItem] = useState<WorkItem | null>(null)

  // Drag-and-drop must operate on the *current, unfiltered* sections — the
  // filtered `visible` list can be missing lanes/tasks a filter is hiding,
  // and optimistically applying a reduced view via `applyLocal` would drop
  // that data from state. A ref (rather than closing over `sections`)
  // guards against `onDropCard` being called with a stale snapshot.
  const sectionsRef = useRef(sections)
  useEffect(() => {
    sectionsRef.current = sections
  }, [sections])

  // Same discipline for the flat (portfolio / Stories) move path: operate on
  // the current, unfiltered `flatColumns` via a ref, never the filtered
  // `visibleFlat` (a filter could be hiding cards an optimistic apply would
  // then drop from the cache).
  const flatColumnsRef = useRef(flatColumns)
  useEffect(() => {
    flatColumnsRef.current = flatColumns
  }, [flatColumns])

  // Serializes writes: while a move's patchState is in flight, any further
  // drop is ignored ('noop') rather than starting a second optimistic move.
  // This keeps the whole-board `undo` snapshot performMove takes safe to
  // apply on failure — with only one write ever in flight, no sibling move
  // could have landed on the board in the meantime for that rollback to stomp.
  const pendingRef = useRef(false)

  // Background auto-refresh (opt-in via the header select; off by default so the
  // board stays staleTime: Infinity unless the user asks for a cadence). Skips a
  // tick while a write is in flight so a refetch never lands on top of an
  // optimistic move and clobber its undo snapshot.
  useEffect(() => {
    if (intervalMs === 0) return
    const id = setInterval(() => {
      if (pendingRef.current) return
      void refresh()
    }, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, refresh])

  const handleDropCard = useCallback(
    (cardId: number, toColumn: string) => {
      void performMove({
        sections: sectionsRef.current,
        cardId,
        toColumn,
        board: { columns },
        applyLocal,
        patchState,
        refresh,
        onToast: (message) => setDropToast({ message }),
        pendingRef,
      })
    },
    [columns, applyLocal, refresh],
  )

  // Flat-view move: mirrors `handleDropCard` but on the `FlatColumn[]` shape,
  // sharing the SAME `pendingRef` so a lane move and a flat move can never be
  // in flight at once (and one view's rollback can't stomp the other).
  const handleFlatMove = useCallback(
    (cardId: number, toColumn: string) => {
      void performFlatMove({
        flatColumns: flatColumnsRef.current,
        cardId,
        toColumn,
        board: { columns },
        applyLocalFlat,
        patchState,
        refresh,
        onToast: (message) => setDropToast({ message }),
        pendingRef,
      })
    },
    [columns, applyLocalFlat, refresh],
  )

  // Login gate: with no active connection, render the login screen instead of
  // the board (keeping the theme toggle available). This is the first-run
  // experience now — the user enters org/project/PAT here, or opts into the
  // synthetic demo via "View demo"; it also shows after leaving demo
  // ("Connect your ADO") or logging out.
  if (active === null) {
    return (
      <div className="flex h-screen flex-col bg-app text-content">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
          <h1 className="text-lg font-semibold">ADO Taskboard</h1>
          <div className="ml-auto">
            <ThemePicker />
          </div>
        </header>
        <LoginScreen />
      </div>
    )
  }

  return (
    <StateCategoryContext.Provider value={stateCategory}>
      <div className="flex h-screen flex-col bg-app text-content">
        <header className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-3">
          <h1 className="text-lg font-semibold">ADO Taskboard</h1>

          <ConnectionSwitcher
            onLogoutAll={() => {
              queryClient.clear()
              localStorage.removeItem('ado-taskboard-cache')
            }}
            onConnectionEdited={() => {
              // The active connection's org/project changed but its id (the board
              // query key) didn't — invalidate the board query to force a reload
              // and drop the persisted cache so it can't rehydrate stale.
              queryClient.invalidateQueries({ queryKey: ['board'] })
              localStorage.removeItem('ado-taskboard-cache')
            }}
          />

          <LevelPicker levels={levels} levelId={levelId} onChange={setLevel} />

          {showIterationPicker && (
            <IterationPicker
              iterations={iterations}
              value={scopeToPickerValue(scope)}
              onChange={(value) => setScope(pickerValueToScope(value))}
            />
          )}

          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-raised disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>

          <span className="text-xs text-content-muted">
            {lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : 'Not loaded yet'}
          </span>

          <label className="flex items-center gap-1.5 text-sm text-content">
            <span className="text-xs text-content-muted">Auto-refresh</span>
            <select
              aria-label="Auto-refresh"
              value={intervalMs}
              onChange={(e) => setIntervalMs(Number(e.target.value))}
              className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-content"
            >
              {pollOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="ml-auto flex items-center gap-1.5 text-sm text-content">
            <input
              type="checkbox"
              checked={showAll}
              onChange={toggleShowAll}
              className="h-4 w-4 rounded border-line text-accent accent-accent focus:ring-accent-ring"
            />
            All columns
          </label>

          {CONFIG.me !== '' && (
            <label className="flex items-center gap-1.5 text-sm text-content">
              <input
                type="checkbox"
                checked={highlightMine}
                onChange={toggleHighlightMine}
                className="h-4 w-4 rounded border-line text-accent accent-accent focus:ring-accent-ring"
              />
              Highlight mine
            </label>
          )}

          <ThemePicker />
        </header>

        {isDemo && (
          <DemoBanner
            onConnect={() => {
              queryClient.clear()
              localStorage.removeItem('ado-taskboard-cache')
              remove(DEMO_CONNECTION_ID)
            }}
          />
        )}

        <FilterBar facets={facets} value={filters} onChange={setFilters} />

        <main className="flex-1 overflow-auto">
          {error && !authError && (
            <p className="mb-3 rounded-md border border-danger bg-danger-muted px-3 py-2 text-sm text-danger">
              Failed to load board: {error.message}
            </p>
          )}
          {loading || authError ? (
            <div className="flex items-center gap-2 text-sm text-content-muted">
              <span
                aria-hidden="true"
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent"
              />
              Loading board…
            </div>
          ) : isFlat ? (
            <FlatBoard
              flatColumns={visibleFlat}
              board={{ columns }}
              showAll={showAll}
              highlightMine={highlightMine}
              onOpenCard={setOpenItem}
              onDropCard={handleFlatMove}
              onMoveCard={handleFlatMove}
            />
          ) : (
            <Board
              sections={visible}
              board={{ columns }}
              onDropCard={handleDropCard}
              onMoveCard={handleDropCard}
              showAll={showAll}
              highlightMine={highlightMine}
              onOpenCard={setOpenItem}
              isExpanded={isExpanded}
              onToggleSection={toggleSection}
            />
          )}
        </main>

        {dropToast && (
          <Toast message={dropToast.message} onDismiss={() => setDropToast(null)} />
        )}

        <TicketModal key={openItem?.id ?? 'none'} item={openItem} onClose={() => setOpenItem(null)} />
      </div>
    </StateCategoryContext.Provider>
  )
}

export default App
