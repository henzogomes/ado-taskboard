import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLevel } from './useLevel'
import { buildLevels } from './level'
import type { BacklogLevels } from '../api/types'

const projectA: BacklogLevels = {
  requirement: { boardName: 'Stories', workItemTypes: ['User Story', 'Bug'] },
  task: { workItemTypes: ['Task'] },
  portfolios: [
    { name: 'Features', workItemTypes: ['Feature'] },
    { name: 'Epics', workItemTypes: ['Epic'] },
  ],
}

const levelsA = buildLevels(projectA)

beforeEach(() => {
  localStorage.clear()
})

describe('useLevel', () => {
  it('defaults to tasks when nothing stored', () => {
    const { result } = renderHook(() => useLevel(levelsA))
    expect(result.current.levelId).toBe('tasks')
  })

  it('setLevel updates state and persists', () => {
    const { result } = renderHook(() => useLevel(levelsA))
    act(() => result.current.setLevel('epics'))
    expect(result.current.levelId).toBe('epics')
    expect(localStorage.getItem('ado-taskboard-level')).toBe('epics')
  })

  it('falls back to tasks when the persisted id is not in the current levels', () => {
    localStorage.setItem('ado-taskboard-level', 'initiatives')
    const { result } = renderHook(() => useLevel(levelsA))
    expect(result.current.levelId).toBe('tasks')
  })

  it('does not crash when levels is empty on first render', () => {
    const { result } = renderHook(() => useLevel([]))
    expect(result.current.levelId).toBe('tasks')
  })
})
