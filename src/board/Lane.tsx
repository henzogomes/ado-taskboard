import { useDroppable } from '@dnd-kit/core'
import type { BoardColumn, WorkItem } from '../api/types'
import type { Lane as LaneModel } from '../domain/board'
import { Card } from './Card'

export interface LaneProps {
  lane: LaneModel
  columns: BoardColumn[]
  /** Unique per lane (see `SprintSection`) — combined with the column name to key each droppable cell. */
  laneId: string
  /** Same move path as drag, invoked instead by each card's status dropdown. */
  onMoveCard?: (cardId: number, toColumn: string) => void
  /** Whether cards should render the `isMine` accent. Threaded down to each `Card`. */
  highlightMine?: boolean
  /** Opens the ticket detail modal for a card. Threaded down to each `Card`. */
  onOpenCard?: (item: WorkItem) => void
}

interface ColumnCellProps {
  laneId: string
  column: BoardColumn
  columns: BoardColumn[]
  tasks: LaneModel['tasksByColumn'][string] | undefined
  onMoveCard?: (cardId: number, toColumn: string) => void
  highlightMine?: boolean
  onOpenCard?: (item: WorkItem) => void
}

/**
 * One lane×column cell — a dnd-kit droppable target. Its id is unique per
 * lane+column (so multiple lanes' same-named column cells don't collide as
 * drop targets); the handler in `Board` reads the column name back off
 * `data.column` rather than parsing the id.
 */
function ColumnCell({ laneId, column, columns, tasks, onMoveCard, highlightMine, onOpenCard }: ColumnCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${laneId}:${column.name}`,
    data: { column: column.name },
  })

  return (
    <div
      ref={setNodeRef}
      className={`flex min-w-56 flex-col gap-2 border-b border-r border-line p-2 ${
        isOver ? 'bg-accent-muted' : 'bg-surface-muted'
      }`}
    >
      {(tasks ?? []).map((task) => (
        <Card
          key={task.id}
          item={task}
          columns={columns}
          currentColumn={column.name}
          onMoveCard={onMoveCard}
          highlightMine={highlightMine}
          onOpenCard={onOpenCard}
        />
      ))}
    </div>
  )
}

/**
 * One board row: a fixed leftmost Story cell (the only place a story
 * renders — its title + state) followed by one cell per visible column
 * holding that lane's tasks. `lane.story === null` renders the
 * "(no parent story)" cell — used for the section's noParentLane.
 */
export function Lane({ lane, columns, laneId, onMoveCard, highlightMine, onOpenCard }: LaneProps) {
  return (
    <div className="contents">
      <div className="sticky left-0 z-10 flex min-w-56 flex-col gap-1 border-b border-r border-line bg-surface p-2">
        {lane.story ? (
          <>
            <div className="text-sm font-medium text-content">{lane.story.title}</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-content-muted">{lane.story.state}</span>
              <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-content-muted">
                #{lane.story.id}
              </span>
            </div>
          </>
        ) : (
          <div className="text-sm italic text-content-muted">(no parent story)</div>
        )}
        <span className="w-fit rounded-full bg-accent-muted px-1.5 py-0.5 text-[10px] font-medium text-accent">
          {lane.taskCount} task{lane.taskCount === 1 ? '' : 's'}
        </span>
      </div>

      {columns.map((column) => (
        <ColumnCell
          key={column.name}
          laneId={laneId}
          column={column}
          columns={columns}
          tasks={lane.tasksByColumn[column.name]}
          onMoveCard={onMoveCard}
          highlightMine={highlightMine}
          onOpenCard={onOpenCard}
        />
      ))}
    </div>
  )
}
