import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent, PointerEvent } from 'react'
import { createPortal } from 'react-dom'

export interface DropdownItem {
  value: string
  label: string
  current?: boolean
  disabled?: boolean
  /** Optional emoji shown before the label (kept out of `label` so callers can sort/match on the clean text). */
  emoji?: string
}

/** A non-selectable section label rendered inline among the items (e.g. Light/Dark groups). */
export interface DropdownHeader {
  heading: string
}

export type DropdownEntry = DropdownItem | DropdownHeader

const isHeader = (e: DropdownEntry): e is DropdownHeader => 'heading' in e

export interface DropdownProps {
  /** Text shown on the trigger button. */
  buttonLabel: string
  /** Items, optionally interleaved with `{ heading }` section labels. */
  items: DropdownEntry[]
  onSelect: (value: string) => void
  ariaLabel?: string
  /**
   * Stop pointerdown/click on the trigger and menu from bubbling up. Needed
   * when the dropdown lives inside a draggable element (e.g. `MoveMenu`
   * inside a dnd-kit card) so opening it — or picking an option — doesn't
   * also start a drag or reach a parent click handler.
   */
  stopPropagation?: boolean
  /** Overrides the trigger button's className (lets callers tune width/style). */
  triggerClassName?: string
  /**
   * Called when an item becomes highlighted — mouse hover OR keyboard arrow
   * navigation — WITHOUT closing the menu. Used by the theme picker to PREVIEW
   * a theme live while browsing (see ThemePicker). Absent for normal dropdowns,
   * where highlighting is purely visual.
   */
  onHighlight?: (value: string) => void
  /**
   * Called when the menu closes WITHOUT a selection (Escape / outside-click /
   * page scroll). Lets a caller that previewed via `onHighlight` revert.
   */
  onCancel?: () => void
}

interface MenuPosition {
  top: number
  left: number
  /** Distance from the viewport's right edge to the trigger's right edge. */
  right: number
  width: number
  /**
   * Anchor the menu's RIGHT edge to the trigger (grows leftward) instead of its
   * left edge, when the trigger sits in the right half of the viewport — so a
   * menu wider than its trigger (e.g. the theme picker at the far-right of the
   * header) doesn't spill off the right edge of the screen.
   */
  alignRight: boolean
}

function stopEvent(event: PointerEvent | MouseEvent) {
  event.stopPropagation()
}

const DEFAULT_TRIGGER_CLASSNAME =
  'mt-1.5 flex w-full items-center justify-between rounded border border-line bg-surface px-1.5 py-0.5 text-xs text-content-muted hover:bg-surface-raised'

/**
 * Generic theme-styled dropdown: a trigger button + a portaled menu, positioned
 * from the trigger's `getBoundingClientRect()` (fixed position, so the board's
 * `overflow-auto` scroll containers never clip it), flipping upward when there
 * isn't room below. Keyboard-navigable (↑/↓/Home/End move a highlight, Enter
 * selects, Esc closes); highlighting also fires `onHighlight` for live preview.
 * Closes on select / outside-click / Escape / page scroll+resize (the menu's own
 * internal scroll is ignored).
 */
export function Dropdown({
  buttonLabel,
  items,
  onSelect,
  ariaLabel,
  stopPropagation = false,
  triggerClassName,
  onHighlight,
  onCancel,
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const [openUpward, setOpenUpward] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemEls = useRef<Array<HTMLDivElement | null>>([])

  /** `cancelled` = closed without a selection (Escape/outside/scroll) → revert any preview. */
  const close = (cancelled: boolean) => {
    setOpen(false)
    if (cancelled) onCancel?.()
  }

  // Indexes (into `items`) of the rows a user can land on — skips headings and disabled rows.
  const selectableIndexes = items
    .map((entry, i) => (!isHeader(entry) && !entry.disabled ? i : -1))
    .filter((i) => i >= 0)

  const highlight = (index: number, preview: boolean) => {
    if (index < 0) return
    setHighlighted(index)
    const el = itemEls.current[index]
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' })
    const entry = items[index]
    if (preview && entry && !isHeader(entry)) onHighlight?.(entry.value)
  }

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return

    // Rough estimate of the menu's rendered height, used only to decide
    // whether it should flip upward to stay in the viewport.
    const estimatedMenuHeight = items.length * 32 + 8
    const spaceBelow = window.innerHeight - rect.bottom
    const flipUp = spaceBelow < estimatedMenuHeight && rect.top > spaceBelow

    setOpenUpward(flipUp)
    setPosition({
      top: flipUp ? rect.top : rect.bottom,
      left: rect.left,
      right: window.innerWidth - rect.right,
      width: rect.width,
      alignRight: rect.left > window.innerWidth / 2,
    })
    // Start the highlight on the current item (no preview — opening changes nothing).
    const currentIdx = items.findIndex((entry) => !isHeader(entry) && entry.current)
    setHighlighted(currentIdx >= 0 ? currentIdx : (selectableIndexes[0] ?? -1))
    setOpen(true)
  }

  const handleTriggerClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) stopEvent(event)
    if (open) close(true) // toggling closed via the trigger reverts any preview
    else openMenu()
  }

  // Focus the menu on open so it receives arrow/Enter/Escape keys.
  useEffect(() => {
    if (open) menuRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return

    const handlePointerDownOutside = (event: globalThis.MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      close(true)
    }

    // A fixed-position menu drifts on page scroll/resize, so close it — but
    // NOT for the menu's OWN internal scroll (the theme list is long + scrollable).
    const handleScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return
      close(true)
    }
    const handleResize = () => close(true)

    document.addEventListener('mousedown', handlePointerDownOutside)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)

    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
    }
  }, [open])

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close(true)
      triggerRef.current?.focus()
      return
    }
    if (selectableIndexes.length === 0) return
    const pos = selectableIndexes.indexOf(highlighted)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      highlight(selectableIndexes[pos < 0 ? 0 : Math.min(pos + 1, selectableIndexes.length - 1)], true)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      highlight(selectableIndexes[pos < 0 ? selectableIndexes.length - 1 : Math.max(pos - 1, 0)], true)
    } else if (event.key === 'Home') {
      event.preventDefault()
      highlight(selectableIndexes[0], true)
    } else if (event.key === 'End') {
      event.preventDefault()
      highlight(selectableIndexes[selectableIndexes.length - 1], true)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const entry = items[highlighted]
      if (entry && !isHeader(entry) && !entry.disabled) {
        onSelect(entry.value)
        close(false) // commit
      }
    }
  }

  const handleItemClick = (event: MouseEvent, item: DropdownItem) => {
    if (stopPropagation) stopEvent(event)
    if (item.disabled) return
    onSelect(item.value)
    close(false) // commit
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onPointerDown={stopPropagation ? stopEvent : undefined}
        onClick={handleTriggerClick}
        className={triggerClassName ?? DEFAULT_TRIGGER_CLASSNAME}
      >
        <span>{buttonLabel}</span>
        <span aria-hidden="true" className="text-[10px] text-content-subtle">
          ▾
        </span>
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            tabIndex={-1}
            onKeyDown={handleMenuKeyDown}
            onPointerDown={stopPropagation ? stopEvent : undefined}
            onClick={stopPropagation ? stopEvent : undefined}
            style={{
              position: 'fixed',
              top: openUpward ? undefined : position.top,
              bottom: openUpward ? window.innerHeight - position.top : undefined,
              left: position.alignRight ? undefined : position.left,
              right: position.alignRight ? position.right : undefined,
              minWidth: position.width,
            }}
            className="z-50 mt-1 max-h-[70vh] overflow-y-auto rounded border border-line bg-surface py-1 text-sm shadow-lg outline-none"
          >
            {items.map((item, i) =>
              isHeader(item) ? (
                <div
                  key={`heading-${i}`}
                  role="presentation"
                  className={`px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-content-subtle ${
                    i === 0 ? '' : 'mt-1 border-t border-line-muted'
                  }`}
                >
                  {item.heading}
                </div>
              ) : (
                <div
                  key={item.value}
                  ref={(el) => {
                    itemEls.current[i] = el
                  }}
                  role="menuitem"
                  aria-current={item.current ? 'true' : undefined}
                  aria-disabled={item.disabled ? 'true' : undefined}
                  onClick={(event) => handleItemClick(event, item)}
                  onMouseEnter={() => !item.disabled && highlight(i, true)}
                  className={`flex items-center gap-1.5 px-3 py-1 ${
                    item.disabled
                      ? 'text-content-subtle'
                      : `cursor-pointer text-content-muted ${i === highlighted ? 'bg-surface-raised' : 'hover:bg-surface-raised'}`
                  }`}
                >
                  <span className="inline-block w-3 text-center">{item.current ? '✓' : ''}</span>
                  {item.emoji && <span aria-hidden="true">{item.emoji}</span>}
                  <span>{item.label}</span>
                </div>
              ),
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
