import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as store from '../connections/store'
import { fetchFields, getWorkItemDetail, patchState } from '../api/client'
import { DEMO_CONNECTION, isDemoActive } from './connection'
import { buildDemoBoardData } from './board'
import { demoWorkItems, resetDemo } from './runtime'

describe('demo mode short-circuits the network', () => {
  beforeEach(() => {
    resetDemo()
    vi.restoreAllMocks()
    // Active connection is the demo sentinel.
    vi.spyOn(store, 'getActive').mockReturnValue(DEMO_CONNECTION)
  })
  afterEach(() => vi.restoreAllMocks())

  it('isDemoActive() is true when the demo connection is active', () => {
    expect(isDemoActive()).toBe(true)
  })

  it('getWorkItemDetail resolves from synthetic data without any fetch', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const detail = await getWorkItemDetail(101)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(detail.id).toBe(101)
    expect(detail.fields['System.Description']).toBeTruthy()
  })

  it('fetchFields resolves the synthetic catalog without any fetch', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const fields = await fetchFields()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(fields.some((f) => f.referenceName === 'System.Description')).toBe(true)
  })

  it('patchState mutates in-memory state (no fetch) and the move sticks on rebuild', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const before = demoWorkItems().find((i) => i.id === 202)!
    const beforeRev = before.rev
    expect(before.state).toBe('To Do')

    const updated = await patchState(202, 'In Progress', null, beforeRev)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(updated.state).toBe('In Progress')
    expect(updated.rev).toBe(beforeRev + 1)

    // A rebuild (what refresh() triggers) reflects the move rather than reverting it.
    const data = buildDemoBoardData('current', 'tasks')
    const placed = data.sections
      .flatMap((s) => s.lanes)
      .flatMap((l) => Object.entries(l.tasksByColumn))
      .find(([, cards]) => cards.some((c) => c.id === 202))
    expect(placed?.[0]).toBe('Active') // 'In Progress' → Active column
  })
})
