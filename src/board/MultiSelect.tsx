import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'

export interface MultiSelectProps {
  /** Text shown on the trigger button (e.g. "Developer"). */
  label: string
  /** Distinct values available to pick from — already the deduplicated set. */
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
  ariaLabel?: string
  /** Overrides the trigger button's className (lets callers tune width/style). */
  triggerClassName?: string
}

interface PopoverPosition {
  top: number
  left: number
  width: number
}

function toggled(selected: string[], option: string): string[] {
  return selected.includes(option) ? selected.filter((v) => v !== option) : [...selected, option]
}

const TRIGGER_CLASSNAME =
  'mt-1.5 flex w-full items-center justify-between gap-1.5 rounded border border-line bg-surface px-1.5 py-0.5 text-xs text-content-muted hover:bg-surface-raised'

/**
 * Searchable multi-select popover: a trigger button with a count badge, and a
 * portaled popover (search input + scrollable checkbox list) positioned from
 * the trigger's `getBoundingClientRect()`. Positioning / flip-up / close-on-
 * (outside-mousedown, Escape, scroll, resize) machinery mirrors `Dropdown`,
 * but toggling an option keeps the popover open (unlike `Dropdown`, which
 * closes on select) since picking several values is the whole point.
 */
export function MultiSelect({ label, options, selected, onChange, ariaLabel, triggerClassName }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<PopoverPosition | null>(null)
  const [openUpward, setOpenUpward] = useState(false)
  const [query, setQuery] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const close = () => setOpen(false)

  const openPopover = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return

    // Rough estimate of the popover's rendered height (search input + up to
    // a handful of visible rows before the list scrolls), used only to decide
    // whether it should flip upward to stay in the viewport.
    const estimatedPopoverHeight = Math.min(options.length, 8) * 28 + 48
    const spaceBelow = window.innerHeight - rect.bottom
    const flipUp = spaceBelow < estimatedPopoverHeight && rect.top > spaceBelow

    setOpenUpward(flipUp)
    setPosition({
      top: flipUp ? rect.top : rect.bottom,
      left: rect.left,
      width: rect.width,
    })
    setQuery('')
    setOpen(true)
  }

  const handleTriggerClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (open) {
      close()
    } else {
      openPopover()
    }
  }

  useEffect(() => {
    if (!open) return

    // Autofocus the search input once the popover has mounted.
    searchRef.current?.focus()

    const handlePointerDownOutside = (event: globalThis.MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      close()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }

    // A fixed-position popover drifts out of place when an ANCESTOR scrolls, so
    // close on those. But scrolling the popover's OWN option list must NOT close
    // it — ignore scroll events that originate inside the popover.
    const handleScroll = (event: Event) => {
      if (popoverRef.current?.contains(event.target as Node)) return
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

  const filteredOptions = options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={handleTriggerClick}
        className={triggerClassName ?? TRIGGER_CLASSNAME}
      >
        <span className="flex items-center gap-1.5">
          <span>{label}</span>
          {selected.length > 0 && (
            <span className="inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-fg">
              {selected.length}
            </span>
          )}
        </span>
        <span aria-hidden="true" className="text-[10px] text-content-subtle">
          ▾
        </span>
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={ariaLabel ?? `${label} options`}
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
              placeholder={`Search ${label.toLowerCase()}…`}
              className="m-1.5 rounded border border-line bg-surface px-2 py-1 text-xs text-content-muted placeholder-content-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-ring"
            />

            <div className="max-h-64 overflow-y-auto px-1 pb-1">
              {filteredOptions.length === 0 ? (
                <div className="px-2 py-1 text-xs text-content-subtle">none</div>
              ) : (
                filteredOptions.map((option) => {
                  const checked = selected.includes(option)
                  return (
                    <label
                      key={option}
                      className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs text-content-muted hover:bg-surface-raised"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onChange(toggled(selected, option))}
                        className="h-3 w-3 rounded border-line text-accent accent-accent focus:ring-accent-ring"
                      />
                      <span>{option}</span>
                    </label>
                  )
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
