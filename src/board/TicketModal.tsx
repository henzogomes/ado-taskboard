import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import DOMPurify from 'dompurify'
import type { WorkItem } from '../api/types'
import type { FieldPatch } from '../api/client'
import { patchFields } from '../api/client'
import { isDemoActive } from '../demo/connection'
import { adoWorkItemUrl, initialsOf } from './cardUtils'
import { useWorkItemDetail } from '../hooks/useWorkItemDetail'
import { useWorkItemComments } from '../hooks/useWorkItemComments'
import { useFieldMeta } from '../hooks/useFieldMeta'
import { richTextFields } from '../domain/detailFields'
import { relationLabel } from './relationLabel'
import { relativeTime } from './relativeTime'
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
  const {
    comments,
    isLoading: commentsLoading,
    error: commentsError,
    hasNextPage: hasMoreComments,
    fetchNextPage: fetchMoreComments,
    isFetchingNextPage: fetchingMoreComments,
  } = useWorkItemComments(item?.id ?? null)
  const { meta, isLoading: metaLoading } = useFieldMeta()
  const color = useStateColor(item?.state ?? '')
  const queryClient = useQueryClient()
  const editable = !isDemoActive()

  // Local edit state, reset per item (App keys the modal on the item id). The
  // `rev` is bumped from each patchFields response so consecutive saves send
  // the correct optimistic-concurrency guard.
  const [title, setTitle] = useState(item?.title ?? '')
  const [tags, setTags] = useState<string[]>(item?.tags ?? [])
  const [rev, setRev] = useState(item?.rev ?? 0)

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  const [newTag, setNewTag] = useState('')

  const [editingField, setEditingField] = useState<string | null>(null)
  const [fieldDraft, setFieldDraft] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const runSave = async (patches: FieldPatch[], onSuccess?: (updated: WorkItem) => void) => {
    if (!item) return
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await patchFields(item.id, rev, patches)
      setRev(updated.rev)
      onSuccess?.(updated)
      queryClient.invalidateQueries({ queryKey: ['board'] })
      queryClient.invalidateQueries({ queryKey: ['workitem', item.id] })
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const startEditTitle = () => {
    setTitleDraft(title)
    setEditingTitle(true)
  }
  const cancelEditTitle = () => {
    setEditingTitle(false)
    setTitleDraft('')
  }
  const saveTitle = () => {
    void runSave([{ path: '/fields/System.Title', value: titleDraft }], (u) => setTitle(u.title))
    setEditingTitle(false)
  }

  const addTag = () => {
    const tag = newTag.trim()
    if (!tag || tags.includes(tag)) return
    const next = [...tags, tag]
    void runSave([{ path: '/fields/System.Tags', value: next.join('; ') }], (u) => setTags(u.tags))
    setNewTag('')
  }
  const removeTag = (tag: string) => {
    const next = tags.filter((t) => t !== tag)
    void runSave([{ path: '/fields/System.Tags', value: next.join('; ') }], (u) => setTags(u.tags))
  }

  const startEditField = (referenceName: string, html: string) => {
    setEditingField(referenceName)
    setFieldDraft(html)
  }
  const cancelEditField = () => {
    setEditingField(null)
    setFieldDraft('')
  }
  const saveField = (referenceName: string) => {
    void runSave([{ path: `/fields/${referenceName}`, value: DOMPurify.sanitize(fieldDraft) }])
    setEditingField(null)
    setFieldDraft('')
  }

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
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  aria-label="Title"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  className="flex-1 rounded border border-line bg-surface px-2 py-1 text-lg font-semibold text-content"
                />
                <button
                  type="button"
                  onClick={saveTitle}
                  disabled={saving}
                  className="rounded border border-line px-2 py-1 text-xs font-medium text-content-muted hover:bg-surface-raised disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={cancelEditTitle}
                  className="rounded border border-line px-2 py-1 text-xs font-medium text-content-muted hover:bg-surface-raised"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-content">{title}</h2>
                {editable && (
                  <button
                    type="button"
                    aria-label="Edit title"
                    onClick={startEditTitle}
                    className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-content-muted hover:bg-surface-raised"
                  >
                    Edit
                  </button>
                )}
              </div>
            )}

            {saveError && (
              <p role="alert" className="mt-2 text-sm text-danger">
                {saveError}
              </p>
            )}

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

            {(tags.length > 0 || editable) && (
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-tag px-2 py-0.5 text-[10px] font-medium text-tag-fg"
                  >
                    <span>{tag}</span>
                    {editable && (
                      <button
                        type="button"
                        aria-label={`Remove tag ${tag}`}
                        onClick={() => removeTag(tag)}
                        disabled={saving}
                        className="leading-none text-tag-fg/70 hover:text-tag-fg disabled:opacity-60"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {editable && (
                  <span className="inline-flex items-center gap-1">
                    <input
                      aria-label="Add tag"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      disabled={saving}
                      className="w-24 rounded border border-line bg-surface px-2 py-0.5 text-[11px] text-content disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      disabled={saving}
                      className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-content-muted hover:bg-surface-raised disabled:opacity-60"
                    >
                      Add
                    </button>
                  </span>
                )}
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
                    fields.map((field) => {
                      const isEditing = editingField === field.referenceName
                      return (
                        <div key={field.referenceName}>
                          <div className="mt-3 flex items-center gap-2 first:mt-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-content-muted">
                              {field.displayName}
                            </h4>
                            {editable && !isEditing && (
                              <button
                                type="button"
                                aria-label={`Edit ${field.displayName}`}
                                onClick={() => startEditField(field.referenceName, field.html)}
                                className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-content-muted hover:bg-surface-raised"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                          {isEditing ? (
                            <div className="mt-1">
                              <textarea
                                aria-label={field.displayName}
                                value={fieldDraft}
                                onChange={(e) => setFieldDraft(e.target.value)}
                                rows={6}
                                className={`w-full rounded-md border border-line bg-surface-muted p-3 text-sm text-content ${PROSE_CLASS}`}
                              />
                              <div className="mt-1 flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => saveField(field.referenceName)}
                                  disabled={saving}
                                  className="rounded border border-line px-2 py-1 text-xs font-medium text-content-muted hover:bg-surface-raised disabled:opacity-60"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditField}
                                  className="rounded border border-line px-2 py-1 text-xs font-medium text-content-muted hover:bg-surface-raised"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`mt-1 rounded-md border border-line bg-surface-muted p-3 text-sm text-content ${PROSE_CLASS}`}
                              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(field.html) }}
                            />
                          )}
                        </div>
                      )
                    })
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

            <div data-testid="ticket-comments" className="mt-4 border-t border-line pt-3">
              <h3 className="text-sm font-semibold text-content-muted">Comments</h3>

              {commentsLoading && (
                <div role="status" aria-label="Loading comments…" className="mt-2 space-y-2">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-surface-muted" />
                  <div className="h-3 w-full animate-pulse rounded bg-surface-muted" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-surface-muted" />
                </div>
              )}
              {commentsError && !commentsLoading && (
                <p className="mt-1 text-sm text-danger">Couldn't load comments.</p>
              )}

              {!commentsLoading && !commentsError && (
                <>
                  {comments.length === 0 ? (
                    <p className="mt-2 text-sm italic text-content-subtle">No comments.</p>
                  ) : (
                    <ul className="mt-2 space-y-3">
                      {comments.map((comment) => (
                        <li key={comment.id}>
                          <div className="flex items-center gap-1.5 text-xs text-content-muted">
                            <span
                              aria-hidden="true"
                              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-muted text-[9px] font-semibold text-accent"
                            >
                              {initialsOf(comment.createdBy.displayName)}
                            </span>
                            <span className="font-medium text-content">{comment.createdBy.displayName}</span>
                            <span className="text-content-subtle">{relativeTime(comment.createdDate)}</span>
                          </div>
                          <div
                            className={`mt-1 text-sm text-content ${PROSE_CLASS}`}
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.text) }}
                          />
                        </li>
                      ))}
                    </ul>
                  )}

                  {hasMoreComments && (
                    <button
                      type="button"
                      onClick={() => fetchMoreComments()}
                      disabled={fetchingMoreComments}
                      className="mt-3 rounded border border-line px-2 py-1 text-xs font-medium text-content-muted hover:bg-surface-raised disabled:opacity-60"
                    >
                      {fetchingMoreComments ? 'Loading…' : 'Load more comments'}
                    </button>
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
