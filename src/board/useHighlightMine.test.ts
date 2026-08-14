import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHighlightMine } from './useHighlightMine';

beforeEach(() => {
  localStorage.clear();
});

describe('useHighlightMine', () => {
  it('defaults to true when nothing stored', () => {
    const { result } = renderHook(() => useHighlightMine());
    expect(result.current.highlightMine).toBe(true);
  });

  it('toggles to false and persists', () => {
    const { result } = renderHook(() => useHighlightMine());
    act(() => result.current.toggle());
    expect(result.current.highlightMine).toBe(false);
    expect(localStorage.getItem('ado-taskboard-highlight-mine')).toBe('0');
  });

  it('defaults to false when localStorage has garbage', () => {
    localStorage.setItem('ado-taskboard-highlight-mine', 'garbage');
    const { result } = renderHook(() => useHighlightMine());
    expect(result.current.highlightMine).toBe(false);
  });

  it('rehydrates true from a persisted value', () => {
    localStorage.setItem('ado-taskboard-highlight-mine', '1');
    const { result } = renderHook(() => useHighlightMine());
    expect(result.current.highlightMine).toBe(true);
  });

  it('rehydrates false from an explicitly stored false value (stored-off stays off)', () => {
    localStorage.setItem('ado-taskboard-highlight-mine', '0');
    const { result } = renderHook(() => useHighlightMine());
    expect(result.current.highlightMine).toBe(false);
  });
});
