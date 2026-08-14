import { useDraggable } from '@dnd-kit/core'
import { useEffect, useRef } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import type { BoardColumn, WorkItem } from '../api/types'
import { CONFIG } from '../config'
import { MoveMenu } from './MoveMenu'
import { useStateColor } from '../theme/StateCategoryContext'

/** Human ADO work-item URL, built from non-secret CONFIG (org/project only). */
export function adoWorkItemUrl(id: number): string {
  return `https://dev.azure.com/${CONFIG.org}/${encodeURIComponent(CONFIG.project)}/_workitems/edit/${id}`
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part.match(/[A-Za-z0-9]/)?.[0]) // first alphanumeric — skips leading `_`/punctuation
    .filter((c): c is string => Boolean(c))
    .slice(0, 2)
    .map((c) => c.toUpperCase())
    .join('')
}

export interface CardProps {
  item: WorkItem
  /** All board columns — used to build the Move menu's option list. Optional so `Card.test.tsx`'s bare render still passes (no menu rendered). */
  columns?: BoardColumn[]
  /** The column this card currently renders in — marked as current (non-actionable) in the Move menu. */
  currentColumn?: string
  /** Same move path as drag-and-drop (`App`'s `handleDropCard` → `performMove`), invoked directly instead of via a drop event. */
  onMoveCard?: (cardId: number, toColumn: string) => void
  /** Whether the `isMine` accent should render. Defaults to `true` when omitted, so the bare `<Card item=…/>` and existing accent tests still behave. */
  highlightMine?: boolean
  /** Opens the ticket detail modal for this card. Optional so the bare `<Card item=…/>` test still passes with no-op click. */
  onOpenCard?: (item: WorkItem) => void
  /**
   * Read-only render: no drag listeners and no Move menu — the card is only
   * clickable (opens the modal). Used by `FlatBoard`, where portfolio-level
   * items aren't moved (their move-write path is a separate, later change).
   */
  readOnly?: boolean
}

/**
 * Draggable via dnd-kit: `id` is the work item's numeric id (what `Board`'s
 * `onDragEnd` reads off `active.id`), and `data.item` carries the item
 * itself so the drop handler knows the card's current `rev`/`type` without
 * a second lookup.
 */
export function Card({ item, columns, currentColumn, onMoveCard, highlightMine = true, onOpenCard, readOnly = false }: CardProps) {
  const borderClass = useStateColor(item.state).border
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { item },
  })

  // dnd-kit's PointerSensor has a 4px activation constraint, so a plain click
  // (no drag) fires `onClick` normally. A completed drag can still leave a
  // stray mouseup click behind; `wasDraggedRef` is set while `isDragging` is
  // true (so it's already true when that trailing click arrives, and the click
  // is swallowed below). It's then auto-cleared ~200ms after the drag ends —
  // NOT on the next click — so touch drags (which fire no trailing click)
  // can't leave the flag stuck and silently swallow a later tap.
  const wasDraggedRef = useRef(false)
  useEffect(() => {
    if (isDragging) {
      wasDraggedRef.current = true
      return
    }
    if (wasDraggedRef.current) {
      const timer = setTimeout(() => {
        wasDraggedRef.current = false
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [isDragging])

  const handleCardClick = () => {
    if (wasDraggedRef.current) return // stray click immediately after a drag — ignore
    onOpenCard?.(item)
  }

  const style: CSSProperties | undefined = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  const showMoveMenu = !readOnly && columns !== undefined && currentColumn !== undefined && onMoveCard !== undefined
  // Read-only cards attach no drag listeners; they're click-only (open modal).
  const dragProps = readOnly ? {} : { ...listeners, ...attributes }

  const isMine = CONFIG.me !== '' && item.assignedTo?.uniqueName?.toLowerCase() === CONFIG.me.toLowerCase()

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...dragProps}
      onClick={handleCardClick}
      className={`rounded-md border border-line border-l-4 bg-surface p-2 text-sm shadow-sm ${borderClass} ${isDragging ? 'relative z-20 cursor-grabbing opacity-60 shadow-lg' : readOnly ? 'cursor-pointer' : 'cursor-grab'} ${isMine && highlightMine ? 'ring-2 ring-accent-ring bg-accent-muted' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <a
          href={adoWorkItemUrl(item.id)}
          target="_blank"
          rel="noreferrer"
          onClick={(event: MouseEvent) => event.stopPropagation()}
          className="font-mono text-xs text-link hover:underline"
        >
          #{item.id}
        </a>
        <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-content-muted">
          {item.state}
        </span>
      </div>

      <div className="mt-1 text-[13px] font-normal leading-snug text-content">{item.title}</div>

      {item.assignedTo && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-content-muted">
          <span
            aria-hidden="true"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-muted text-[10px] font-semibold text-accent"
          >
            {initialsOf(item.assignedTo.displayName)}
          </span>
          <span>{item.assignedTo.displayName}</span>
        </div>
      )}

      {item.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-tag px-2 py-0.5 text-[10px] font-medium text-tag-fg"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {showMoveMenu && (
        <MoveMenu
          columns={columns!}
          currentColumn={currentColumn!}
          onMove={(name) => onMoveCard!(item.id, name)}
        />
      )}
    </div>
  )
}
