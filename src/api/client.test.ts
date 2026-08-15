import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWorkItems, patchState, fetchProjectIterations, getWorkItemDetail, getWorkItemComments, fetchFields, resolveTeam, toBacklogLevels, mergeStates } from './client'
import * as store from '../connections/store'
import * as demoConnection from '../demo/connection'
import { AuthError } from './client'

const asResp = (json: unknown) => ({ ok: true, json: async () => json }) as Response

describe('api client', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('maps workitemsbatch fields to WorkItem[]', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        asResp({
          value: [
            {
              id: 819099,
              rev: 4,
              fields: {
                'System.WorkItemType': 'Task',
                'System.Title': 'x',
                'System.State': 'Closed',
                'System.BoardColumn': 'Resolved',
                'System.IterationPath': 'P\\Sprint 1',
                'System.Parent': 807119,
                'System.Tags': 'agentic; BE Dev',
                'System.AssignedTo': { displayName: 'Henzo Gomes', uniqueName: 'h@x' },
              },
            },
          ],
        }),
      ),
    )
    const items = await fetchWorkItems([819099])
    expect(items[0]).toMatchObject({
      id: 819099,
      type: 'Task',
      state: 'Closed',
      boardColumn: 'Resolved',
      parent: 807119,
      tags: ['agentic', 'BE Dev'],
      rev: 4,
      assignedTo: { displayName: 'Henzo Gomes', uniqueName: 'h@x' },
    })
  })

  it('returns items in original id order even when a later batch resolves first', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => i + 1)
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const { ids: batchIds } = JSON.parse(String(init?.body)) as { ids: number[] }
      // Delay the FIRST batch so the SECOND resolves first, proving order is
      // restored by Promise.all's input-order guarantee rather than timing.
      if (batchIds[0] === ids[0]) await new Promise((r) => setTimeout(r, 30))
      return asResp({
        value: batchIds.map((id) => ({
          id,
          rev: 1,
          fields: {
            'System.WorkItemType': 'Task',
            'System.Title': `task ${id}`,
            'System.State': 'New',
            'System.IterationPath': 'P\\Sprint 1',
          },
        })),
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const items = await fetchWorkItems(ids)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(items.map((it) => it.id)).toEqual(ids)
  })

  it('patchState PATCHes json-patch to the work item', async () => {
    const spy = vi.fn(async () =>
      asResp({
        id: 1,
        rev: 6,
        fields: {
          'System.State': 'Active',
          'System.WorkItemType': 'Task',
          'System.Title': 't',
          'System.IterationPath': 'P',
        },
      }),
    )
    vi.stubGlobal('fetch', spy)
    await patchState(1, 'Active', 'In Development', 5)
    const [url, opts] = spy.mock.calls[0] as unknown as [
      string,
      { method: string; headers: HeadersInit; body: string },
    ]
    expect(String(url)).toContain('/_apis/wit/workitems/1')
    expect(opts.method).toBe('PATCH')
    // `j` normalizes init.headers into a Headers instance, so read via the accessor.
    expect(new Headers(opts.headers).get('Content-Type')).toBe('application/json-patch+json')
    const body = JSON.parse(opts.body)
    expect(body).toEqual(
      expect.arrayContaining([
        { op: 'test', path: '/rev', value: 5 },
        { op: 'add', path: '/fields/System.State', value: 'Active' },
        { op: 'add', path: '/fields/System.BoardColumn', value: 'In Development' },
      ]),
    )
  })

  it('fetchProjectIterations flattens classification nodes, normalizes paths, and excludes the root', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        asResp({
          name: 'Contoso.MyProject',
          identifier: 'root-id',
          structureType: 'iteration',
          path: '\\Contoso.MyProject',
          children: [
            {
              name: 'Sprint 3',
              identifier: 'sprint-3-id',
              structureType: 'iteration',
              path: '\\Contoso.MyProject\\Iteration\\Sprint 3',
              attributes: { startDate: '2026-07-27T00:00:00Z', finishDate: '2026-08-07T00:00:00Z' },
            },
            {
              name: 'Sprint 4',
              identifier: 'sprint-4-id',
              structureType: 'iteration',
              path: '\\Contoso.MyProject\\Iteration\\Sprint 4',
              attributes: { startDate: '2026-08-10T00:00:00Z', finishDate: '2026-08-21T00:00:00Z' },
            },
          ],
        }),
      ),
    )
    const iterations = await fetchProjectIterations()
    expect(iterations).toEqual([
      {
        id: 'sprint-3-id',
        name: 'Sprint 3',
        path: 'Contoso.MyProject\\Sprint 3',
        startDate: '2026-07-27T00:00:00Z',
        finishDate: '2026-08-07T00:00:00Z',
      },
      {
        id: 'sprint-4-id',
        name: 'Sprint 4',
        path: 'Contoso.MyProject\\Sprint 4',
        startDate: '2026-08-10T00:00:00Z',
        finishDate: '2026-08-21T00:00:00Z',
      },
    ])
    expect(iterations.find((i) => i.id === 'root-id')).toBeUndefined()
  })

  it('getWorkItemDetail maps $expand=all fields + relations (numeric id parsed from url), via a relative /api/ado URL', async () => {
    const spy = vi.fn(async () =>
      asResp({
        id: 819099,
        fields: {
          'System.Description': '<p>desc</p>',
          'Microsoft.VSTS.Common.AcceptanceCriteria': '<p>AC</p>',
        },
        relations: [
          { rel: 'System.LinkTypes.Hierarchy-Reverse', url: 'https://dev.azure.com/org/proj/_apis/wit/workItems/807119' },
          { rel: 'ArtifactLink', url: 'vstfs:///Git/PullRequestId/abc' },
        ],
      }),
    )
    vi.stubGlobal('fetch', spy)

    const detail = await getWorkItemDetail(819099)

    const [url] = spy.mock.calls[0] as unknown as [string]
    expect(String(url)).toContain('/api/ado/')
    expect(String(url)).not.toContain('dev.azure.com')
    expect(String(url)).toContain('/_apis/wit/workitems/819099')
    expect(String(url)).toContain('$expand=all')

    expect(detail).toEqual({
      id: 819099,
      fields: {
        'System.Description': '<p>desc</p>',
        'Microsoft.VSTS.Common.AcceptanceCriteria': '<p>AC</p>',
      },
      relations: [
        {
          rel: 'System.LinkTypes.Hierarchy-Reverse',
          id: 807119,
          url: 'https://dev.azure.com/org/proj/_apis/wit/workItems/807119',
        },
        { rel: 'ArtifactLink', id: null, url: 'vstfs:///Git/PullRequestId/abc' },
      ],
    })
  })

  it('fetchFields maps _apis/wit/fields (referenceName/name→displayName/type), via a relative /api/ado URL', async () => {
    const spy = vi.fn(async () =>
      asResp({
        value: [
          { referenceName: 'System.Description', name: 'Description', type: 'html' },
          { referenceName: 'System.Title', name: 'Title', type: 'string' },
        ],
      }),
    )
    vi.stubGlobal('fetch', spy)

    const fields = await fetchFields()

    const [url] = spy.mock.calls[0] as unknown as [string]
    expect(String(url)).toContain('/api/ado/')
    expect(String(url)).not.toContain('dev.azure.com')
    expect(String(url)).toContain('/_apis/wit/fields')

    expect(fields).toEqual([
      { referenceName: 'System.Description', displayName: 'Description', type: 'html' },
      { referenceName: 'System.Title', displayName: 'Title', type: 'string' },
    ])
  })

  it('getWorkItemComments hits the preview comments endpoint with $top=50 and maps the response', async () => {
    const spy = vi.fn(async () =>
      asResp({
        totalCount: 2,
        count: 2,
        comments: [
          {
            id: 1,
            text: '<div>First</div>',
            createdBy: { displayName: 'Jane Doe', uniqueName: 'jane@x' },
            createdDate: '2025-07-01T09:00:00Z',
            modifiedDate: '2025-07-01T10:00:00Z',
          },
          {
            id: 2,
            text: '<div>Second</div>',
            createdBy: { displayName: 'John Roe', uniqueName: 'john@x' },
            createdDate: '2025-07-02T09:00:00Z',
          },
        ],
        continuationToken: 'tok-2',
      }),
    )
    vi.stubGlobal('fetch', spy)

    const page = await getWorkItemComments(819099)

    const [url] = spy.mock.calls[0] as unknown as [string]
    expect(String(url)).toContain('/api/ado/')
    expect(String(url)).toContain('/_apis/wit/workItems/819099/comments')
    expect(String(url)).toContain('api-version=7.1-preview.4')
    expect(String(url)).toContain('$top=50')
    expect(String(url)).not.toContain('continuationToken')

    expect(page).toEqual({
      totalCount: 2,
      continuationToken: 'tok-2',
      comments: [
        {
          id: 1,
          text: '<div>First</div>',
          createdBy: { displayName: 'Jane Doe', uniqueName: 'jane@x' },
          createdDate: '2025-07-01T09:00:00Z',
          modifiedDate: '2025-07-01T10:00:00Z',
        },
        {
          id: 2,
          text: '<div>Second</div>',
          createdBy: { displayName: 'John Roe', uniqueName: 'john@x' },
          createdDate: '2025-07-02T09:00:00Z',
          modifiedDate: undefined,
        },
      ],
    })
  })

  it('getWorkItemComments appends continuationToken when passed', async () => {
    const spy = vi.fn(async () => asResp({ totalCount: 0, comments: [] }))
    vi.stubGlobal('fetch', spy)

    await getWorkItemComments(1, 'tok-2')

    const [url] = spy.mock.calls[0] as unknown as [string]
    expect(String(url)).toContain('continuationToken=tok-2')
  })

  it('getWorkItemComments defends against missing fields and omits continuationToken on the final page', async () => {
    const spy = vi.fn(async () => asResp({ comments: [{ id: 5, createdDate: '2025-07-03T09:00:00Z' }] }))
    vi.stubGlobal('fetch', spy)

    const page = await getWorkItemComments(1)

    expect(page.continuationToken).toBeUndefined()
    expect(page.totalCount).toBeUndefined()
    expect(page.comments[0]).toEqual({
      id: 5,
      text: '',
      createdBy: { displayName: '', uniqueName: '' },
      createdDate: '2025-07-03T09:00:00Z',
      modifiedDate: undefined,
    })
  })

  it('getWorkItemComments routes to the demo dataset in demo mode (no fetch)', async () => {
    vi.spyOn(demoConnection, 'isDemoActive').mockReturnValue(true)
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)

    const page = await getWorkItemComments(101)

    expect(spy).not.toHaveBeenCalled()
    expect(page.totalCount).toBe(5)
    expect(page.comments.length).toBe(3) // demo page size
    expect(page.continuationToken).toBe('3')
  })
})

const RAW_BACKLOGS = {
  value: [
    { name: 'Tasks', type: 'task', workItemTypes: [{ name: 'Task' }] },
    { name: 'Stories', type: 'requirement', workItemTypes: [{ name: 'User Story' }, { name: 'Bug' }, { name: 'Spike' }] },
    { name: 'Features', type: 'portfolio', workItemTypes: [{ name: 'Feature' }, { name: 'Enabler Feature' }] },
    { name: 'Epics', type: 'portfolio', workItemTypes: [{ name: 'Epic' }] },
  ],
}

describe('toBacklogLevels', () => {
  it('splits levels by their type discriminator', () => {
    const b = toBacklogLevels(RAW_BACKLOGS)
    expect(b.requirement).toEqual({ boardName: 'Stories', workItemTypes: ['User Story', 'Bug', 'Spike'] })
    expect(b.task.workItemTypes).toEqual(['Task'])
    expect(b.portfolios.map((p) => p.name)).toEqual(['Features', 'Epics'])
  })

  it('throws when no requirement level exists', () => {
    expect(() => toBacklogLevels({ value: [{ name: 'Tasks', type: 'task', workItemTypes: [] }] })).toThrow(/requirement/i)
  })
})

describe('mergeStates', () => {
  it('merges states across types into one name→category map', () => {
    const us = { value: [{ name: 'New', category: 'Proposed' }, { name: 'Active', category: 'InProgress' }, { name: 'Closed', category: 'Completed' }] }
    const task = { value: [{ name: 'New', category: 'Proposed' }, { name: 'Removed', category: 'Removed' }] }
    const m = mergeStates([us, task])
    expect(m['New']).toBe('Proposed')
    expect(m['Active']).toBe('InProgress')
    expect(m['Removed']).toBe('Removed')
  })

  it('prefers a non-Removed category on a name collision', () => {
    const a = { value: [{ name: 'Duplicate', category: 'Removed' }] }
    const b = { value: [{ name: 'Duplicate', category: 'InProgress' }] }
    expect(mergeStates([a, b])['Duplicate']).toBe('InProgress')
    expect(mergeStates([b, a])['Duplicate']).toBe('InProgress')
  })
})

describe('j header injection (via a client call)', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.restoreAllMocks())

  it('attaches X-ADO-Org and X-ADO-PAT from the active connection', async () => {
    vi.spyOn(store, 'getActive').mockReturnValue({ id: '1', label: 'x', org: 'contoso', project: 'P', pat: 'tok' })
    const fetchMock = vi.fn(async () => asResp({ value: [] }))
    vi.stubGlobal('fetch', fetchMock)
    // resolveTeam issues a proxy GET when team is unset (mocked getActive has no team).
    await resolveTeam().catch(() => {})
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
    const headers = new Headers(init.headers)
    expect(headers.get('X-ADO-Org')).toBe('contoso')
    expect(headers.get('X-ADO-PAT')).toBe('tok')
  })

  it('omits X-ADO-PAT when the connection pat is empty (e.g. the demo sentinel)', async () => {
    vi.spyOn(store, 'getActive').mockReturnValue({ id: '1', label: 'x', org: 'contoso', project: 'P', pat: '' })
    const fetchMock = vi.fn(async () => asResp({ value: [] }))
    vi.stubGlobal('fetch', fetchMock)
    await resolveTeam().catch(() => {})
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
    const headers = new Headers(init.headers)
    expect(headers.has('X-ADO-PAT')).toBe(false)
  })

  it('throws AuthError on 401', async () => {
    vi.spyOn(store, 'getActive').mockReturnValue({ id: '1', label: 'x', org: 'o', project: 'P', pat: 'bad' })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }) as Response))
    await expect(getWorkItemDetail(1)).rejects.toBeInstanceOf(AuthError)
  })
})
