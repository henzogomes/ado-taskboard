import { useEffect, useState, useTransition } from 'react'
import type { SyntheticEvent } from 'react'
import type { Board, BoardColumn, WorkItem } from '../api/types'
import type { SprintSection as SprintSectionModel } from '../domain/board'
import { sectionColumns } from '../domain/board'
import { Lane } from './Lane'

export interface SprintSectionProps {
  section: SprintSectionModel
  /** `board.columns` is expected already visible-only (`visibleColumns`) — callers (App) filter once, upstream. */
  board: Board
  /** Same move path as drag, invoked instead by each card's status dropdown. */
  onMoveCard?: (cardId: number, toColumn: string) => void
  /** When true, render every column (even empty ones) instead of only non-empty ones. */
  showAll: boolean
  /** Whether cards should render the `isMine` accent. Threaded down to each `Lane`. */
  highlightMine?: boolean
  /** Opens the ticket detail modal for a card. Threaded down to each `Lane`. */
  onOpenCard?: (item: WorkItem) => void
  /** Controlled open-state of the `<details>`. */
  expanded: boolean
  /** Fired when the user flips the section open/closed. */
  onToggle: () => void
}

interface SectionBodyProps {
  section: SprintSectionModel
  board: Board
  showAll: boolean
  onMoveCard?: (cardId: number, toColumn: string) => void
  highlightMine?: boolean
  onOpenCard?: (item: WorkItem) => void
}

/**
 * The lane grid — the `<details>` body. Extracted so it can be mounted only
 * when the section is expanded (a collapsed sprint then has zero card DOM).
 * `columns`/`gridTemplateColumns` are computed here since they're only needed
 * while the body is on screen. Pure move of the former inline JSX.
 */
function SectionBody({ section, board, showAll, onMoveCard, highlightMine, onOpenCard }: SectionBodyProps) {
  const columns = sectionColumns(section, board.columns, showAll)
  // Fixed 14rem tracks (not `minmax(14rem, 1fr)`): with the section sized to its
  // content (min-w-max, so its border wraps every column), a `1fr` max track has
  // no definite width to resolve against and blows up to each column's unwrapped
  // content width. Fixed tracks keep every column a steady 14rem.
  const gridTemplateColumns = `14rem repeat(${columns.length}, 14rem)`

  return (
    <div className="px-2 pb-2">
      <div className="grid" style={{ gridTemplateColumns }}>
        <div className="sticky left-0 top-10 z-30 border-b border-r border-line bg-surface p-2 text-xs font-semibold uppercase tracking-wide text-content-muted">
          Story
        </div>
        {columns.map((column) => (
          <div
            key={column.name}
            className="sticky top-10 z-20 border-b border-r border-line bg-surface p-2 text-xs font-semibold uppercase tracking-wide text-content-muted"
          >
            {column.name}
          </div>
        ))}

        {section.lanes.map((lane) => (
          <Lane
            key={lane.story!.id}
            lane={lane}
            columns={columns}
            laneId={`${section.iteration.id}:story:${lane.story!.id}`}
            onMoveCard={onMoveCard}
            highlightMine={highlightMine}
            onOpenCard={onOpenCard}
          />
        ))}

        {section.noParentLane.taskCount > 0 && (
          <Lane
            lane={section.noParentLane}
            columns={columns}
            laneId={`${section.iteration.id}:noparent`}
            onMoveCard={onMoveCard}
            highlightMine={highlightMine}
            onOpenCard={onOpenCard}
          />
        )}
      </div>
    </div>
  )
}

/**
 * A cheap stand-in painted while the heavy `SectionBody` grid mounts, so the
 * expanded area gets height immediately (no layout jump) and the click doesn't
 * freeze the frame on a large sprint. Deliberately far cheaper than the grid:
 * a few muted, pulsing placeholder rows sized to the same column template — no
 * cards, no dnd hooks. Decorative and inert (`aria-hidden`).
 * Exported for isolated testing (the deferred swap commits synchronously in
 * jsdom, so the skeleton-first state isn't observable through the full render).
 */
export function SectionSkeleton({ columns }: { columns: BoardColumn[] }) {
  const gridTemplateColumns = `14rem repeat(${columns.length}, 14rem)`
  return (
    <div className="px-2 pb-2" data-testid="section-skeleton" aria-hidden="true">
      <div className="grid gap-px" style={{ gridTemplateColumns }}>
        {[0, 1, 2].map((row) => (
          <div key={row} className="contents">
            {[...Array(columns.length + 1)].map((_, col) => (
              <div key={col} className="p-2">
                <div className="h-16 animate-pulse rounded bg-surface-muted" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** A collapsible `<details>` per sprint: header with counts, body is the lane grid. */
export function SprintSection({ section, board, onMoveCard, showAll, highlightMine, onOpenCard, expanded, onToggle }: SprintSectionProps) {
  // Deferred mount: on expand, paint the lightweight skeleton this frame, then
  // promote to the real grid as a low-priority (transition) update so a large
  // section's mount doesn't block the click. Collapsing resets it, so the next
  // expand re-shows the skeleton.
  const [bodyReady, setBodyReady] = useState(false)
  const [, startTransition] = useTransition()
  useEffect(() => {
    if (!expanded) {
      setBodyReady(false)
      return
    }
    startTransition(() => setBodyReady(true))
  }, [expanded])

  // Native `<details>` fires `toggle` itself after mutating its own `open`
  // attribute. Only surface the change when the DOM open-state actually
  // diverges from the controlled `expanded` prop — otherwise a re-render that
  // re-asserts `open={expanded}` would echo back a redundant toggle (loop).
  const handleToggle = (e: SyntheticEvent<HTMLDetailsElement>) => {
    if (e.currentTarget.open !== expanded) onToggle()
  }

  return (
    <details
      // min-w-max: grow to the grid's full width when the board is wider than
      // the viewport, so the border + summary header wrap ALL columns (the last
      // column no longer spills past the rounded container on horizontal
      // scroll). Still fills the viewport when the board is narrower.
      className="group min-w-max rounded-lg border border-line bg-surface"
      open={expanded}
      onToggle={handleToggle}
    >
      <summary className="sticky top-0 z-40 flex h-10 cursor-pointer select-none list-none items-center gap-3 rounded-t-lg bg-surface-muted px-3 py-2 hover:bg-surface-raised [&::-webkit-details-marker]:hidden">
        <svg
          className="h-4 w-4 shrink-0 text-content-muted transition-transform group-open:rotate-90"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
        <span className="font-semibold text-content">{section.iteration.name}</span>
        <span className="rounded-full bg-accent-muted px-2 py-0.5 text-xs font-medium text-accent">
          {section.storyCount} stor{section.storyCount === 1 ? 'y' : 'ies'}
        </span>
        <span className="rounded-full bg-accent-muted px-2 py-0.5 text-xs font-medium text-accent">
          {section.taskCount} task{section.taskCount === 1 ? '' : 's'}
        </span>
      </summary>

      {expanded &&
        (bodyReady ? (
          <SectionBody
            section={section}
            board={board}
            showAll={showAll}
            onMoveCard={onMoveCard}
            highlightMine={highlightMine}
            onOpenCard={onOpenCard}
          />
        ) : (
          <SectionSkeleton columns={sectionColumns(section, board.columns, showAll)} />
        ))}
    </details>
  )
}
