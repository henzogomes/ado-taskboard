import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { patchState } from './api/client'
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
import { DEMO_CONNECTION, DEMO_CONNECTION_ID } from './demo/connection'
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
  const { connections, active, add, remove } = useConnections()

  // First-run seed: with no stored connections, auto-seed the synthetic
  // `DEMO_CONNECTION` and activate it, so the app opens on a working demo board
  // instead of the login wall. Synchronous — no network, no spinner. Guarded by
  // a ref so it runs at most once (a ref, not state, so it never re-renders):
  // after the user leaves demo ("Connect your ADO"), the list is empty again but
  // this must NOT re-seed — it falls through to the login screen instead.
  const seededRef = useRef(false)
  useEffect(() => {
    if (seededRef.current) return
    seededRef.current = true
    if (connections.length === 0) add(DEMO_CONNECTION)
  }, [connections.length, add])

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

  const isDemo = active?.id === DEMO_CONNECTION_ID
  const isFlat = view?.kind === 'flat'
  // Portfolio views span sprints, so the iteration picker is hidden for them.
  const showIterationPicker = view?.iterationScoped ?? true

  const { showAll, toggle: toggleShowAll } = useShowAllColumns()
  const { highlightMine, toggle: toggleHighlightMine } = useHighlightMine()

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
  // the board (keeping the theme toggle available). On the very first run the
  // demo connection is seeded synchronously, so this only shows after the user
  // explicitly leaves demo ("Connect your ADO") or logs out.
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
          {error && (
            <p className="mb-3 rounded-md border border-danger bg-danger-muted px-3 py-2 text-sm text-danger">
              Failed to load board: {error.message}
            </p>
          )}
          {loading ? (
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

        <TicketModal item={openItem} onClose={() => setOpenItem(null)} />
      </div>
    </StateCategoryContext.Provider>
  )
}

export default App
