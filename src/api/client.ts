import { CONFIG } from '../config'
import { getActive } from '../connections/store'
import { isDemoActive } from '../demo/connection'
import { DEMO_FIELDS, demoWorkItemDetail, demoWorkItemComments } from '../demo/dataset'
import { demoApplyMove } from '../demo/runtime'
import type { WorkItem, WorkItemDetail, WorkItemComment, WorkItemCommentsPage, WorkItemRelation, Iteration, Board, BacklogLevels, StateCategory, FieldMeta } from './types'

const V = 'api-version=7.1'

export class AuthError extends Error {}

const j = async (url: string, init?: RequestInit) => {
  const active = getActive()
  const headers = new Headers(init?.headers)
  if (active?.org) headers.set('X-ADO-Org', active.org)
  if (active?.pat) headers.set('X-ADO-PAT', active.pat) // '' → omit → proxy sends no auth (ADO 401)
  const r = await fetch(url, { ...init, headers })
  if (r.status === 401) throw new AuthError(`ADO 401 ${url}`)
  if (!r.ok) throw new Error(`ADO ${r.status} ${url}`)
  return r.json()
}

const splitTags = (t?: string): string[] => (t ? t.split(';').map((s) => s.trim()).filter(Boolean) : [])

const toItem = (w: any): WorkItem => ({
  id: w.id,
  rev: w.rev,
  type: w.fields['System.WorkItemType'],
  title: w.fields['System.Title'],
  state: w.fields['System.State'],
  boardColumn: w.fields['System.BoardColumn'] ?? null,
  assignedTo: w.fields['System.AssignedTo']
    ? {
        displayName: w.fields['System.AssignedTo'].displayName,
        uniqueName: w.fields['System.AssignedTo'].uniqueName,
      }
    : null,
  tags: splitTags(w.fields['System.Tags']),
  parent: w.fields['System.Parent'] ?? null,
  iterationPath: w.fields['System.IterationPath'],
})

/** Pulls the trailing numeric work-item id out of a relation `url` (e.g. `.../workItems/807119` -> 807119), when present. */
function relationIdFromUrl(url: string): number | null {
  const match = /\/(\d+)$/.exec(url)
  return match ? Number(match[1]) : null
}

function toDetail(w: any): WorkItemDetail {
  const relations: WorkItemRelation[] = (w.relations ?? []).map((r: any) => ({
    rel: r.rel,
    id: relationIdFromUrl(r.url ?? ''),
    url: r.url,
  }))
  // Carry the raw field map through untouched; which fields to render is
  // decided dynamically from the discovered field metadata (see
  // domain/detailFields + fetchFields), not hardcoded here.
  return { id: w.id, fields: w.fields ?? {}, relations }
}

export async function getWorkItemDetail(id: number): Promise<WorkItemDetail> {
  if (isDemoActive()) return demoWorkItemDetail(id)
  const d = await j(`${CONFIG.baseUrl}/${CONFIG.project}/_apis/wit/workitems/${id}?$expand=all&${V}`)
  return toDetail(d)
}

function toComment(c: any): WorkItemComment {
  return {
    id: c.id,
    text: c.text ?? '',
    createdBy: {
      displayName: c.createdBy?.displayName ?? '',
      uniqueName: c.createdBy?.uniqueName ?? '',
    },
    createdDate: c.createdDate ?? '',
    modifiedDate: c.modifiedDate,
  }
}

/**
 * One page of a work item's discussion comments, oldest→newest (ADO's default
 * ordering — we don't pass an `order` param, so we ship what ADO returns).
 * Paginated via `continuationToken`: pass the previous page's token to fetch the
 * next page; ADO omits it on the final page, so we pass `undefined` through
 * (never invent one) to stop pagination. Demo mode routes to the in-memory seed.
 */
export async function getWorkItemComments(id: number, continuationToken?: string): Promise<WorkItemCommentsPage> {
  if (isDemoActive()) return demoWorkItemComments(id, continuationToken)
  // Comments live behind a preview api-version, distinct from the `V` constant.
  let url = `${CONFIG.baseUrl}/${CONFIG.project}/_apis/wit/workItems/${id}/comments?api-version=7.1-preview.4&$top=50`
  if (continuationToken !== undefined) url += `&continuationToken=${continuationToken}`
  const d = await j(url)
  return {
    comments: (d.comments ?? []).map(toComment),
    continuationToken: d.continuationToken,
    totalCount: d.totalCount,
  }
}

/**
 * The project's field catalog: reference name → display name + data type
 * (`html`, `plainText`, `string`, `dateTime`, …). Discovered once and cached
 * (TanStack, long stale) — the modal intersects an item's populated fields
 * with this to know which are rich text worth rendering.
 */
export async function fetchFields(): Promise<FieldMeta[]> {
  if (isDemoActive()) return DEMO_FIELDS
  const d = await j(`${CONFIG.baseUrl}/${CONFIG.project}/_apis/wit/fields?${V}`)
  return (d.value ?? []).map((f: any) => ({
    referenceName: f.referenceName,
    displayName: f.name,
    type: f.type,
  }))
}

export async function resolveTeam(): Promise<string> {
  if (CONFIG.team) return CONFIG.team
  const d = await j(`${CONFIG.baseUrl}/_apis/projects/${CONFIG.project}/teams?${V}`)
  return (d.value.find((t: any) => t.isDefault) ?? d.value[0]).name
}

export async function fetchIterations(team: string): Promise<Iteration[]> {
  const d = await j(
    `${CONFIG.baseUrl}/${CONFIG.project}/${encodeURIComponent(team)}/_apis/work/teamsettings/iterations?${V}`,
  )
  return d.value.map((i: any) => ({
    id: i.id,
    name: i.name,
    path: i.path,
    startDate: i.attributes?.startDate,
    finishDate: i.attributes?.finishDate,
    timeFrame: i.attributes?.timeFrame,
  }))
}

/**
 * Classification-node paths carry a structural `\Iteration\` segment (and a
 * leading `\`) that team-iteration paths (and `System.IterationPath` values,
 * and WIQL `UNDER` clauses) don't: `\PROJECT\Iteration\Sprint 4` ->
 * `PROJECT\Sprint 4`. Only the segment at index 1 is stripped — a sprint
 * whose name merely contains the word "Iteration" is left alone.
 */
export function normalizeIterationPath(nodePath: string): string {
  const stripped = nodePath.startsWith('\\') ? nodePath.slice(1) : nodePath
  const segments = stripped.split('\\')
  if (segments[1] === 'Iteration') segments.splice(1, 1)
  return segments.join('\\')
}

interface ClassificationNode {
  name: string
  identifier: string
  structureType: string
  path: string
  attributes?: { startDate?: string; finishDate?: string }
  children?: ClassificationNode[]
}

/** Recursively flattens a classification-node tree, dropping the root node. */
function flattenIterationNodes(node: ClassificationNode, isRoot: boolean): Iteration[] {
  const children = node.children ?? []
  const own: Iteration[] =
    !isRoot && node.structureType === 'iteration'
      ? [
          {
            id: node.identifier,
            name: node.name,
            path: normalizeIterationPath(node.path),
            startDate: node.attributes?.startDate,
            finishDate: node.attributes?.finishDate,
          },
        ]
      : []
  return [...own, ...children.flatMap((c) => flattenIterationNodes(c, false))]
}

/**
 * ALL of the project's iterations (sprints), regardless of which ones the
 * team has subscribed to via `teamsettings/iterations` — `fetchIterations`
 * (team-scoped) can't be trusted to be complete.
 */
export async function fetchProjectIterations(): Promise<Iteration[]> {
  const root: ClassificationNode = await j(
    `${CONFIG.baseUrl}/${CONFIG.project}/_apis/wit/classificationnodes/iterations?$depth=5&${V}`,
  )
  return flattenIterationNodes(root, true)
}

export async function fetchBoard(team: string, boardName: string): Promise<Board> {
  const d = await j(
    `${CONFIG.baseUrl}/${CONFIG.project}/${encodeURIComponent(team)}/_apis/work/boards/${encodeURIComponent(boardName)}?${V}`,
  )
  return {
    columns: d.columns.map((c: any) => ({
      name: c.name,
      columnType: c.columnType,
      isSplit: c.isSplit,
      stateMappings: c.stateMappings ?? {},
    })),
  }
}

export async function queryWorkItemIds(wiql: string): Promise<number[]> {
  const d = await j(`${CONFIG.baseUrl}/${CONFIG.project}/_apis/wit/wiql?${V}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: wiql }),
  })
  return (d.workItems ?? []).map((w: any) => w.id)
}

export async function fetchWorkItems(ids: number[]): Promise<WorkItem[]> {
  if (!ids.length) return []
  const out: WorkItem[] = []
  for (let i = 0; i < ids.length; i += 200) {
    const d = await j(`${CONFIG.baseUrl}/${CONFIG.project}/_apis/wit/workitemsbatch?${V}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: ids.slice(i, i + 200),
        fields: [
          'System.Id',
          'System.WorkItemType',
          'System.Title',
          'System.State',
          'System.BoardColumn',
          'System.AssignedTo',
          'System.Tags',
          'System.Parent',
          'System.IterationPath',
        ],
      }),
    })
    out.push(...d.value.map(toItem))
  }
  return out
}

export function toBacklogLevels(raw: any): BacklogLevels {
  const levels: any[] = raw?.value ?? []
  const names = (l: any): string[] => (l?.workItemTypes ?? []).map((t: any) => t.name)
  const req = levels.find((l) => l.type === 'requirement')
  if (!req) throw new Error('No requirement backlog level found for this team')
  const task = levels.find((l) => l.type === 'task')
  return {
    requirement: { boardName: req.name, workItemTypes: names(req) },
    task: { workItemTypes: names(task) },
    portfolios: levels.filter((l) => l.type === 'portfolio').map((l) => ({ name: l.name, workItemTypes: names(l) })),
  }
}

export async function fetchBacklogs(team: string): Promise<BacklogLevels> {
  const d = await j(`${CONFIG.baseUrl}/${CONFIG.project}/${encodeURIComponent(team)}/_apis/work/backlogs?${V}`)
  return toBacklogLevels(d)
}

export function mergeStates(payloads: any[]): Record<string, StateCategory> {
  const map: Record<string, StateCategory> = {}
  for (const p of payloads) {
    for (const s of p?.value ?? []) {
      const prev = map[s.name]
      // First writer wins, except a Removed entry yields to any non-Removed category.
      if (prev === undefined || (prev === 'Removed' && s.category !== 'Removed')) {
        map[s.name] = s.category
      }
    }
  }
  return map
}

export async function fetchStates(types: string[]): Promise<Record<string, StateCategory>> {
  const payloads = await Promise.all(
    types.map((t) => j(`${CONFIG.baseUrl}/${CONFIG.project}/_apis/wit/workitemtypes/${encodeURIComponent(t)}/states?${V}`)),
  )
  return mergeStates(payloads)
}

export async function patchState(
  id: number,
  state: string,
  boardColumn: string | null,
  rev: number,
): Promise<WorkItem> {
  // Demo mode: mutate the in-memory item and resolve locally — nothing leaves
  // the browser, and the optimistic move sticks across the follow-up refresh.
  if (isDemoActive()) return demoApplyMove(id, state, rev)
  const ops: any[] = [
    { op: 'test', path: '/rev', value: rev },
    { op: 'add', path: '/fields/System.State', value: state },
  ]
  if (boardColumn) ops.push({ op: 'add', path: '/fields/System.BoardColumn', value: boardColumn })
  const d = await j(`${CONFIG.baseUrl}/${CONFIG.project}/_apis/wit/workitems/${id}?${V}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json-patch+json' },
    body: JSON.stringify(ops),
  })
  return toItem(d)
}
