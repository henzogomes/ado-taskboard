import { DndContext, PointerSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import type { Board as BoardModel, BoardColumn, WorkItem } from '../api/types'
import type { FlatColumn } from '../domain/board'
import { Card } from './Card'

export interface FlatBoardProps {
  /** One entry per board column, with the cards placed in it (from `buildFlatColumns`). */
  flatColumns: FlatColumn[]
  /** The board config — its columns drive each card's Move menu option list. Optional so bare test renders still pass. */
  board?: BoardModel
  /** When true, render every column (even empty ones); otherwise only non-empty ones. */
  showAll: boolean
  /** Whether cards render the `isMine` accent. */
  highlightMine?: boolean
  /** Opens the ticket detail modal for a card. */
  onOpenCard?: (item: WorkItem) => void
  /**
   * Called when a card is dropped on a different column. `toColumn` is read off
   * the droppable's `data.column`. The caller (`App`) owns the actual move via
   * `performFlatMove`. Omit to render the board read-only (no drag, no menu).
   */
  onDropCard?: (cardId: number, toColumn: string) => void
  /** Same move path as `onDropCard`, invoked instead by each card's Move menu (no drag involved). */
  onMoveCard?: (cardId: number, toColumn: string) => void
}

interface FlatColumnCellProps {
  column: BoardColumn
  cards: WorkItem[]
  allColumns: BoardColumn[]
  highlightMine?: boolean
  onOpenCard?: (item: WorkItem) => void
  onMoveCard?: (cardId: number, toColumn: string) => void
  /** Move enabled: when false the cell is a plain container and cards render read-only. */
  movable: boolean
}

/**
 * One flat column — a dnd-kit droppable target when moves are enabled. The
 * column name is read back off `data.column` by `FlatBoard`'s `onDragEnd`
 * (mirroring `Lane`'s `ColumnCell`).
 */
function FlatColumnCell({ column, cards, allColumns, highlightMine, onOpenCard, onMoveCard, movable }: FlatColumnCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.name,
    data: { column: column.name },
    disabled: !movable,
  })

  return (
    <div key={column.name} className="flex min-w-56 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between rounded-md border border-line bg-surface px-2 py-1.5">
        <span className="truncate text-xs font-semibold uppercase tracking-wide text-content-muted">
          {column.name}
        </span>
        <span className="ml-2 shrink-0 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-content-muted">
          {cards.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-8 flex-col gap-2 rounded-md ${isOver ? 'bg-accent-muted' : ''}`}
      >
        {cards.map((item) => (
          <Card
            key={item.id}
            item={item}
            columns={movable ? allColumns : undefined}
            currentColumn={movable ? column.name : undefined}
            readOnly={!movable}
            highlightMine={highlightMine}
            onOpenCard={onOpenCard}
            onMoveCard={onMoveCard}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * A single flat Kanban (columns × cards) for a non-lane level — the requirement
 * board shown flat, or a portfolio level (Features/Epics/Initiatives). When
 * `onDropCard`/`onMoveCard` + `board` are supplied, cards are draggable and
 * carry a Move menu (writing the new state back via `performFlatMove`); without
 * them the board renders read-only. Columns fill the viewport width and scroll
 * when they overflow, matching the lane board's fill behavior.
 */
export function FlatBoard({ flatColumns, board, showAll, highlightMine, onOpenCard, onDropCard, onMoveCard }: FlatBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const visible = showAll ? flatColumns : flatColumns.filter((c) => c.cards.length > 0)
  const total = flatColumns.reduce((n, c) => n + c.cards.length, 0)

  // Moves need a drop handler AND the board (for each card's Move-menu options).
  const movable = onDropCard !== undefined && board !== undefined
  const allColumns = board?.columns ?? []

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const toColumn = over.data.current?.column as string | undefined
    if (!toColumn) return
    onDropCard?.(active.id as number, toColumn)
  }

  if (total === 0) {
    return <p className="text-sm text-content-muted">No work items found for this level.</p>
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {visible.map(({ column, cards }) => (
          <FlatColumnCell
            key={column.name}
            column={column}
            cards={cards}
            allColumns={allColumns}
            highlightMine={highlightMine}
            onOpenCard={onOpenCard}
            onMoveCard={onMoveCard}
            movable={movable}
          />
        ))}
      </div>
    </DndContext>
  )
}
