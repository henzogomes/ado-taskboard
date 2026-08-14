import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from './useTheme'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.className = ''
  delete document.documentElement.dataset.theme
})

describe('useTheme', () => {
  it('defaults to light and sets data-theme', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('setTheme selects a theme, sets data-theme + color-scheme, and persists id + appearance', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('dark'))
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(localStorage.getItem('ado-taskboard-theme')).toBe('dark')
    expect(localStorage.getItem('ado-taskboard-appearance')).toBe('dark')
  })

  it('reads the persisted id on boot', () => {
    localStorage.setItem('ado-taskboard-theme', 'dark')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('falls back to the first theme for an unknown stored id', () => {
    localStorage.setItem('ado-taskboard-theme', 'nope')
    renderHook(() => useTheme())
    // state keeps the raw stored id, but the applied theme falls back to light
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })
})
