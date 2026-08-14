import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DropdownItem } from './Dropdown'

export interface SearchableDropdownProps {
  /** Text shown on the trigger button. */
  buttonLabel: string
  items: DropdownItem[]
  onSelect: (value: string) => void
  ariaLabel?: string
  /** Overrides the trigger button's className (lets callers tune width/style). */
  triggerClassName?: string
}

interface DialogPosition {
  top: number
  left: number
  width: number
}

const DEFAULT_TRIGGER_CLASSNAME =
  'flex items-center justify-between gap-2 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-content-muted hover:bg-surface-raised'

/**
 * Single-select `Dropdown` drop-in with a search box and a scrollable
 * (max-height) list — for pickers whose item count can grow unbounded (e.g.
 * a project with dozens of iterations), where `Dropdown`'s plain unbounded
 * menu becomes unusable. Positioning/portal/flip-up/close-on-outside-click
 * machinery mirrors `MultiSelect`; selection behavior (closes on pick, single
 * value) mirrors `Dropdown`.
 */
export function SearchableDropdown({ buttonLabel, items, onSelect, ariaLabel, triggerClassName }: SearchableDropdownProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<DialogPosition | null>(null)
  const [openUpward, setOpenUpward] = useState(false)
  const [query, setQuery] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const close = () => setOpen(false)

  const openDialog = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return

    // Rough estimate of the dialog's rendered height (search input + up to a
    // handful of visible rows before the list scrolls), used only to decide
    // whether it should flip upward to stay in the viewport.
    const estimatedHeight = Math.min(items.length, 8) * 28 + 48
    const spaceBelow = window.innerHeight - rect.bottom
    const flipUp = spaceBelow < estimatedHeight && rect.top > spaceBelow

    setOpenUpward(flipUp)
    setPosition({
      top: flipUp ? rect.top : rect.bottom,
      left: rect.left,
      width: rect.width,
    })
    setQuery('')
    setOpen(true)
  }

  const handleTriggerClick = () => {
    if (open) {
      close()
    } else {
      openDialog()
    }
  }

  useEffect(() => {
    if (!open) return

    searchRef.current?.focus()

    const handlePointerDownOutside = (event: globalThis.MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (dialogRef.current?.contains(target)) return
      close()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }

    // A fixed-position dialog drifts out of place when an ANCESTOR scrolls, so
    // close on those. But scrolling the dialog's OWN option list must NOT
    // close it — ignore scroll events that originate inside the dialog.
    const handleScroll = (event: Event) => {
      if (dialogRef.current?.contains(event.target as Node)) return
      close()
    }
    const handleResize = () => close()

    document.addEventListener('mousedown', handlePointerDownOutside)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)

    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
    }
  }, [open])

  const handleItemClick = (item: DropdownItem) => {
    if (item.disabled) return
    onSelect(item.value)
    close()
  }

  const filteredItems = items.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
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
            ref={dialogRef}
            role="dialog"
            aria-label={ariaLabel ?? `${buttonLabel} options`}
            style={{
              position: 'fixed',
              top: openUpward ? undefined : position.top,
              bottom: openUpward ? window.innerHeight - position.top : undefined,
              left: position.left,
              minWidth: Math.max(position.width, 208),
            }}
            className="z-50 mt-1 flex max-h-80 flex-col rounded border border-line bg-surface shadow-lg"
          >
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search…"
              className="m-1.5 rounded border border-line bg-surface px-2 py-1 text-xs text-content-muted placeholder-content-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-ring"
            />

            <div className="max-h-64 overflow-y-auto px-1 pb-1">
              {filteredItems.length === 0 ? (
                <div className="px-2 py-1 text-xs text-content-subtle">none</div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.value}
                    role="menuitem"
                    aria-current={item.current ? 'true' : undefined}
                    aria-disabled={item.disabled ? 'true' : undefined}
                    onClick={() => handleItemClick(item)}
                    className={
                      item.disabled
                        ? 'flex items-center gap-1.5 rounded px-2 py-1 text-xs text-content-subtle'
                        : 'flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs text-content-muted hover:bg-surface-raised'
                    }
                  >
                    <span className="inline-block w-3 text-center">{item.current ? '✓' : ''}</span>
                    <span>{item.label}</span>
                  </div>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
