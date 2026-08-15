import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePolling } from './usePolling';

beforeEach(() => {
  localStorage.clear();
});

describe('usePolling', () => {
  it('defaults to 0 (off) when nothing stored', () => {
    const { result } = renderHook(() => usePolling());
    expect(result.current.intervalMs).toBe(0);
  });

  it('sets an interval and persists it', () => {
    const { result } = renderHook(() => usePolling());
    act(() => result.current.setIntervalMs(60_000));
    expect(result.current.intervalMs).toBe(60_000);
    expect(localStorage.getItem('ado-taskboard-poll-interval')).toBe('60000');
  });

  it('falls back to 0 when localStorage has garbage', () => {
    localStorage.setItem('ado-taskboard-poll-interval', 'garbage');
    const { result } = renderHook(() => usePolling());
    expect(result.current.intervalMs).toBe(0);
  });

  it('falls back to 0 for an out-of-range value', () => {
    localStorage.setItem('ado-taskboard-poll-interval', '12345');
    const { result } = renderHook(() => usePolling());
    expect(result.current.intervalMs).toBe(0);
  });

  it('rehydrates a valid persisted interval', () => {
    localStorage.setItem('ado-taskboard-poll-interval', '300000');
    const { result } = renderHook(() => usePolling());
    expect(result.current.intervalMs).toBe(300_000);
  });
});
