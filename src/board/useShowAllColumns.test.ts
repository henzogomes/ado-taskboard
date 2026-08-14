import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShowAllColumns } from './useShowAllColumns';

beforeEach(() => {
  localStorage.clear();
});

describe('useShowAllColumns', () => {
  it('defaults to true when nothing stored', () => {
    const { result } = renderHook(() => useShowAllColumns());
    expect(result.current.showAll).toBe(true);
  });

  it('toggles to false and persists', () => {
    const { result } = renderHook(() => useShowAllColumns());
    act(() => result.current.toggle());
    expect(result.current.showAll).toBe(false);
    expect(localStorage.getItem('ado-taskboard-show-all-columns')).toBe('0');
  });

  it('defaults to false when localStorage has garbage', () => {
    localStorage.setItem('ado-taskboard-show-all-columns', 'garbage');
    const { result } = renderHook(() => useShowAllColumns());
    expect(result.current.showAll).toBe(false);
  });

  it('rehydrates true from a persisted value', () => {
    localStorage.setItem('ado-taskboard-show-all-columns', '1');
    const { result } = renderHook(() => useShowAllColumns());
    expect(result.current.showAll).toBe(true);
  });

  it('rehydrates false from an explicitly stored false value', () => {
    localStorage.setItem('ado-taskboard-show-all-columns', '0');
    const { result } = renderHook(() => useShowAllColumns());
    expect(result.current.showAll).toBe(false);
  });
});
