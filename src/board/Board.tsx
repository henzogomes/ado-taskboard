import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import type { Board as BoardModel, WorkItem } from '../api/types'
import type { SprintSection as SprintSectionModel } from '../domain/board'
import { SprintSection } from './SprintSection'

export interface BoardProps {
  sections: SprintSectionModel[]
  board: BoardModel
  /**
   * Called when a card is dropped on a different column cell. `toColumn` is
   * read off the droppable's `data.column` (set by `Lane`'s `ColumnCell`),
   * not parsed from the drop target's id. The caller (`App`) owns the
   * actual move: resolving state via `moveCard`, the optimistic
   * `applyLocal`, the `patchState` write, and rollback on failure.
   */
  onDropCard?: (cardId: number, toColumn: string) => void
  /** Same move path as `onDropCard`, invoked instead by each card's status dropdown (no drag involved). */
  onMoveCard?: (cardId: number, toColumn: string) => void
  /** When true, every section renders every column (even empty ones) instead of only non-empty ones. */
  showAll: boolean
  /** Whether cards should render the `isMine` accent. Threaded down to each `SprintSection`. */
  highlightMine?: boolean
  /** Opens the ticket detail modal for a card. Threaded down to each `SprintSection`. */
  onOpenCard?: (item: WorkItem) => void
  /** Whether the section for a given iteration id is currently expanded. */
  isExpanded: (id: string) => boolean
  /** Flips a section's expand/collapse state by iteration id. */
  onToggleSection: (id: string) => void
}

/** Renders every sprint section, each a collapsible group of story lanes, inside one dnd-kit drag context. */
export function Board({ sections, board, onDropCard, onMoveCard, showAll, highlightMine, onOpenCard, isExpanded, onToggleSection }: BoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const toColumn = over.data.current?.column as string | undefined
    if (!toColumn) return
    onDropCard?.(active.id as number, toColumn)
  }

  if (sections.length === 0) {
    return <p className="text-sm text-content-muted">No work items found for this scope.</p>
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-4">
        {sections.map((section) => (
          <SprintSection
            key={section.iteration.id}
            section={section}
            board={board}
            onMoveCard={onMoveCard}
            showAll={showAll}
            highlightMine={highlightMine}
            onOpenCard={onOpenCard}
            expanded={isExpanded(section.iteration.id)}
            onToggle={() => onToggleSection(section.iteration.id)}
          />
        ))}
      </div>
    </DndContext>
  )
}
