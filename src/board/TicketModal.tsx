import { useEffect, useRef } from 'react'
import type { MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import DOMPurify from 'dompurify'
import type { WorkItem } from '../api/types'
import { adoWorkItemUrl, initialsOf } from './cardUtils'
import { useWorkItemDetail } from '../hooks/useWorkItemDetail'
import { useFieldMeta } from '../hooks/useFieldMeta'
import { richTextFields } from '../domain/detailFields'
import { relationLabel } from './relationLabel'
import { useStateColor } from '../theme/StateCategoryContext'

export interface TicketModalProps {
  item: WorkItem | null
  onClose: () => void
}

/** The last `\`-separated segment of an iteration path, e.g. `Sample Sprint 4`. */
function iterationLeaf(iterationPath: string): string {
  const segments = iterationPath.split('\\')
  return segments[segments.length - 1] || iterationPath
}

// Shared prose spacing for sanitized description/AC HTML. No
// `@tailwindcss/typography` plugin is installed, so spacing is applied via
// arbitrary child variants instead.
const PROSE_CLASS =
  'break-words [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 ' +
  '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 ' +
  '[&_a]:break-words [&_a]:text-link [&_a]:underline [&_strong]:font-semibold ' +
  '[&_code]:break-words [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words'

/**
 * Two-tier ticket detail: Tier 1 renders instantly from the already-cached
 * `item` (id/title/state/type/assignee/tags/parent/iteration); Tier 2 lazily
 * fetches the full detail (description/acceptance criteria/relations) via
 * `useWorkItemDetail`, cached by TanStack Query so re-opening is instant.
 *
 * ADO's description/AC fields are raw HTML — always sanitized with DOMPurify
 * before `dangerouslySetInnerHTML`; the raw string is never rendered.
 *
 * Portaled to `document.body` (same pattern as `MoveMenu`) so it overlays
 * everything regardless of the board's scroll containers.
 */
export function TicketModal({ item, onClose }: TicketModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const { detail, isLoading, error } = useWorkItemDetail(item?.id ?? null)
  const { meta, isLoading: metaLoading } = useFieldMeta()
  const color = useStateColor(item?.state ?? '')

  // Which fields to show is discovered, not hardcoded: the populated rich-text
  // fields for this item's type (intersecting its raw fields with the field
  // catalog). Both the item detail and the field catalog must be loaded before
  // we can decide, so the skeleton waits on both.
  const loading = isLoading || metaLoading
  const fields = detail ? richTextFields(detail.fields, meta) : []

  useEffect(() => {
    if (!item) return

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocusedRef.current?.focus()
    }
  }, [item, onClose])

  if (!item) return null

  const stopPropagation = (event: MouseEvent) => event.stopPropagation()

  return createPortal(
    <div
      data-testid="ticket-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Ticket #${item.id}: ${item.title}`}
        tabIndex={-1}
        onClick={stopPropagation}
        className={`flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border-t-4 bg-surface shadow-xl ${color.accent}`}
      >
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-surface px-4 py-3">
            <div className="flex items-center gap-2">
              <a
                href={adoWorkItemUrl(item.id)}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-sm text-link hover:underline"
              >
                #{item.id}
              </a>
              <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-content-muted">
                {item.type}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <a
                href={adoWorkItemUrl(item.id)}
                target="_blank"
                rel="noreferrer"
                className="rounded border border-line px-2 py-1 text-xs font-medium text-content-muted hover:bg-surface-raised"
              >
                Open in Azure DevOps ↗
              </a>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="rounded p-1 text-lg leading-none text-content-muted hover:bg-surface-raised"
              >
                ×
              </button>
            </div>
          </div>

          <div className="px-4 py-3">
            <h2 className="text-lg font-semibold text-content">{item.title}</h2>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${color.pill}`}
              >
                {item.state}
              </span>
              {item.assignedTo && (
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-content-muted">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-muted text-[9px] font-semibold text-accent"
                  >
                    {initialsOf(item.assignedTo.displayName)}
                  </span>
                  {item.assignedTo.displayName}
                </span>
              )}
              {item.parent != null && (
                <a
                  href={adoWorkItemUrl(item.parent)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-content-muted hover:underline"
                >
                  Parent #{item.parent}
                </a>
              )}
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-content-muted">
                {iterationLeaf(item.iterationPath)}
              </span>
            </div>

            {item.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
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

            <div className="mt-4 border-t border-line pt-3">
              <h3 className="text-sm font-semibold text-content-muted">Details</h3>

              {loading && (
                <div role="status" aria-label="Loading details…" className="mt-2 space-y-2">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-surface-muted" />
                  <div className="h-3 w-full animate-pulse rounded bg-surface-muted" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-surface-muted" />
                </div>
              )}
              {error && !loading && (
                <p className="mt-1 text-sm text-danger">Couldn't load details.</p>
              )}

              {detail && !loading && (
                <>
                  {fields.length === 0 ? (
                    <p className="mt-2 text-sm italic text-content-subtle">No details.</p>
                  ) : (
                    fields.map((field) => (
                      <div key={field.referenceName}>
                        <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-content-muted first:mt-2">
                          {field.displayName}
                        </h4>
                        <div
                          className={`mt-1 rounded-md border border-line bg-surface-muted p-3 text-sm text-content ${PROSE_CLASS}`}
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(field.html) }}
                        />
                      </div>
                    ))
                  )}

                  {detail.relations.length > 0 && (
                    <div>
                      <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-content-muted">
                        Relations
                      </h4>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {detail.relations.map((relation, index) => (
                          <span
                            key={`${relation.rel}-${index}`}
                            className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-xs text-content-muted"
                          >
                            <span className="text-content-muted">{relationLabel(relation.rel)}</span>
                            {relation.id != null ? (
                              <a
                                href={adoWorkItemUrl(relation.id)}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-link hover:underline"
                              >
                                #{relation.id}
                              </a>
                            ) : (
                              <a
                                href={relation.url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-link hover:underline"
                              >
                                link
                              </a>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
