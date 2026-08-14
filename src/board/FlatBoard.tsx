import { DndContext } from '@dnd-kit/core'
import type { WorkItem } from '../api/types'
import type { FlatColumn } from '../domain/board'
import { Card } from './Card'

export interface FlatBoardProps {
  /** One entry per board column, with the cards placed in it (from `buildFlatColumns`). */
  flatColumns: FlatColumn[]
  /** When true, render every column (even empty ones); otherwise only non-empty ones. */
  showAll: boolean
  /** Whether cards render the `isMine` accent. */
  highlightMine?: boolean
  /** Opens the ticket detail modal for a card. */
  onOpenCard?: (item: WorkItem) => void
}

/**
 * A single flat Kanban (columns × cards) for a non-lane level — the requirement
 * board shown flat, or a portfolio level (Features/Epics/Initiatives). Cards are
 * READ-ONLY here: they open the detail modal but aren't moved (the flat
 * move-write path is a separate, later change), so there are no droppables. The
 * empty `DndContext` just satisfies `Card`'s `useDraggable` hook.
 */
export function FlatBoard({ flatColumns, showAll, highlightMine, onOpenCard }: FlatBoardProps) {
  const visible = showAll ? flatColumns : flatColumns.filter((c) => c.cards.length > 0)
  const total = flatColumns.reduce((n, c) => n + c.cards.length, 0)

  if (total === 0) {
    return <p className="text-sm text-content-muted">No work items found for this level.</p>
  }

  return (
    <DndContext>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {visible.map(({ column, cards }) => (
          <div key={column.name} className="flex min-w-56 max-w-72 flex-1 flex-col gap-2">
            <div className="flex items-center justify-between rounded-md border border-line bg-surface px-2 py-1.5">
              <span className="truncate text-xs font-semibold uppercase tracking-wide text-content-muted">
                {column.name}
              </span>
              <span className="ml-2 shrink-0 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-content-muted">
                {cards.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {cards.map((item) => (
                <Card key={item.id} item={item} readOnly highlightMine={highlightMine} onOpenCard={onOpenCard} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </DndContext>
  )
}
