import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExpandedSections } from './useExpandedSections';

const KEY = 'ado-taskboard-expanded-sections';

beforeEach(() => {
  localStorage.clear();
});

describe('useExpandedSections', () => {
  it('unstored: only defaultExpandedId is expanded, and nothing is written', () => {
    const { result } = renderHook(() => useExpandedSections('sprint-1'));
    expect(result.current.isExpanded('sprint-1')).toBe(true);
    expect(result.current.isExpanded('sprint-2')).toBe(false);
    expect(localStorage.getItem(KEY)).toBe(null);
  });

  it('unstored + null default: nothing is expanded', () => {
    const { result } = renderHook(() => useExpandedSections(null));
    expect(result.current.isExpanded('sprint-1')).toBe(false);
    expect(result.current.isExpanded('sprint-2')).toBe(false);
    expect(localStorage.getItem(KEY)).toBe(null);
  });

  it('toggle collapses the default and persists an array', () => {
    const { result } = renderHook(() => useExpandedSections('sprint-1'));
    act(() => result.current.toggle('sprint-1'));
    expect(result.current.isExpanded('sprint-1')).toBe(false);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual([]);
  });

  it('toggle again re-expands', () => {
    const { result } = renderHook(() => useExpandedSections('sprint-1'));
    act(() => result.current.toggle('sprint-1'));
    act(() => result.current.toggle('sprint-1'));
    expect(result.current.isExpanded('sprint-1')).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(['sprint-1']);
  });

  it('toggle expands an additional section, keeping the default', () => {
    const { result } = renderHook(() => useExpandedSections('sprint-1'));
    act(() => result.current.toggle('sprint-2'));
    expect(result.current.isExpanded('sprint-1')).toBe(true);
    expect(result.current.isExpanded('sprint-2')).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(['sprint-1', 'sprint-2']);
  });

  it('reads a stored array back on init (authoritative, ignoring default)', () => {
    localStorage.setItem(KEY, JSON.stringify(['sprint-3']));
    const { result } = renderHook(() => useExpandedSections('sprint-1'));
    expect(result.current.isExpanded('sprint-3')).toBe(true);
    expect(result.current.isExpanded('sprint-1')).toBe(false);
  });

  it('empty stored array collapses everything, including the default', () => {
    localStorage.setItem(KEY, JSON.stringify([]));
    const { result } = renderHook(() => useExpandedSections('sprint-1'));
    expect(result.current.isExpanded('sprint-1')).toBe(false);
  });

  it('corrupt JSON falls back to default (nothing stored)', () => {
    localStorage.setItem(KEY, 'not json {[');
    const { result } = renderHook(() => useExpandedSections('sprint-1'));
    expect(result.current.isExpanded('sprint-1')).toBe(true);
    expect(result.current.isExpanded('sprint-2')).toBe(false);
  });
});
