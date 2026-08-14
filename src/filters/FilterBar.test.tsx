import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterBar, INLINE_FACET_MAX, SEARCH_DEBOUNCE_MS } from './FilterBar'
import type { Filters } from './filter'

const facets: Filters = {
  devs: ['Alice', 'Bob'],
  tags: ['bug', 'feature'],
  states: ['Active', 'Closed'],
  search: '',
}

function emptyValue(): Filters {
  return { devs: [], tags: [], states: [], search: '' }
}

/** A facet larger than the inline threshold — forces the MultiSelect dropdown branch. */
function manyDevs(): string[] {
  return Array.from({ length: INLINE_FACET_MAX + 1 }, (_, i) => `Dev ${i + 1}`)
}

describe('FilterBar', () => {
  it('renders the search box and each facet inline for small facets', () => {
    render(<FilterBar facets={facets} value={emptyValue()} onChange={vi.fn()} />)

    // Small facets (<= INLINE_FACET_MAX) render their options as inline chip buttons.
    expect(screen.getByRole('button', { name: 'Alice' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'bug' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Active' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search cards…')).toBeInTheDocument()
  })

  it('a small facet renders inline chips: clicking one calls onChange with it added', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<FilterBar facets={facets} value={emptyValue()} onChange={onChange} />)

    const chip = screen.getByRole('button', { name: 'Alice' })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    await user.click(chip)

    expect(onChange).toHaveBeenCalledWith({ ...emptyValue(), devs: ['Alice'] })
  })

  it('partitions by size: small facets render as inline chips, large ones as compact dropdowns, side by side', () => {
    // Tag small (chips), Developer large (dropdown), State small (chips).
    const mixed: Filters = { ...facets, devs: manyDevs() }
    render(<FilterBar facets={mixed} value={emptyValue()} onChange={vi.fn()} />)

    // Small facets present as inline chip buttons…
    expect(screen.getByRole('button', { name: 'bug' })).toBeInTheDocument() // Tag
    expect(screen.getByRole('button', { name: 'Active' })).toBeInTheDocument() // State
    // …the large one as a dropdown trigger, its options hidden until opened.
    expect(screen.getByRole('button', { name: 'Developer filter' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dev 1' })).not.toBeInTheDocument()
  })

  it('a large facet (> INLINE_FACET_MAX) renders the MultiSelect trigger, not inline chips', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const bigFacets: Filters = { ...facets, devs: manyDevs() }
    render(<FilterBar facets={bigFacets} value={emptyValue()} onChange={onChange} />)

    // The dropdown trigger is present; its options are hidden until opened, so
    // no inline chip button exists for a dev value.
    const trigger = screen.getByRole('button', { name: 'Developer filter' })
    expect(trigger).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dev 1' })).not.toBeInTheDocument()

    await user.click(trigger)
    await user.click(screen.getByRole('checkbox', { name: 'Dev 1' }))

    expect(onChange).toHaveBeenCalledWith({ ...emptyValue(), devs: ['Dev 1'] })
  })

  it('shows a selected value as a removable active chip', () => {
    const value: Filters = { ...emptyValue(), devs: ['Alice'] }
    render(<FilterBar facets={facets} value={value} onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: /Alice.*Remove|Remove.*Alice/ })).toBeInTheDocument()
  })

  it('clicking the × on an active chip calls onChange removing just that value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const value: Filters = { devs: ['Alice', 'Bob'], tags: ['bug'], states: [], search: '' }
    render(<FilterBar facets={facets} value={value} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /Remove Alice/ }))

    expect(onChange).toHaveBeenCalledWith({ devs: ['Bob'], tags: ['bug'], states: [], search: '' })
  })

  it('does not render the active-selections row when nothing is selected', () => {
    render(<FilterBar facets={facets} value={emptyValue()} onChange={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
  })

  it('Clear resets all facets and search', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const value: Filters = { devs: ['Alice'], tags: ['bug'], states: ['Active'], search: 'foo' }
    render(<FilterBar facets={facets} value={value} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Clear' }))

    expect(onChange).toHaveBeenCalledWith({ devs: [], tags: [], states: [], search: '' })
  })

  it('debounces search: input updates instantly but onChange fires only after the delay', () => {
    vi.useFakeTimers()
    try {
      const onChange = vi.fn()
      render(<FilterBar facets={facets} value={emptyValue()} onChange={onChange} />)

      const box = screen.getByPlaceholderText('Search cards…') as HTMLInputElement

      // Simulate three quick keystrokes (fireEvent is synchronous — no user-event
      // timer coordination needed).
      fireEvent.change(box, { target: { value: 'a' } })
      fireEvent.change(box, { target: { value: 'ab' } })
      fireEvent.change(box, { target: { value: 'abc' } })

      // Field reflects the keystrokes immediately…
      expect(box.value).toBe('abc')
      // …but the expensive filter hasn't been told yet.
      expect(onChange).not.toHaveBeenCalled()

      // Not yet at the threshold.
      act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1))
      expect(onChange).not.toHaveBeenCalled()

      // Crossing it fires exactly one propagation with the final text.
      act(() => vi.advanceTimersByTime(1))
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith({ ...emptyValue(), search: 'abc' })
    } finally {
      vi.useRealTimers()
    }
  })
})
