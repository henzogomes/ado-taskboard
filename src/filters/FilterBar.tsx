import { useEffect, useRef, useState } from 'react'
import type { Filters } from './filter'
import { MultiSelect } from '../board/MultiSelect'
import { InlineChips } from './InlineChips'

export interface FilterBarProps {
  /** Distinct values available to pick from — from `collectFacets(sections)`. */
  facets: Filters
  /** Currently active selection, one array per facet. */
  value: Filters
  onChange: (next: Filters) => void
}

/** Facets with at most this many options render inline; larger ones use the searchable dropdown. */
export const INLINE_FACET_MAX = 15

/** Delay (ms) before a keystroke in the search box propagates to the (expensive) filter. */
export const SEARCH_DEBOUNCE_MS = 250

type FacetKey = Exclude<keyof Filters, 'search'>

const GROUPS: { key: FacetKey; label: string }[] = [
  { key: 'tags', label: 'Tag' },
  { key: 'devs', label: 'Developer' },
  { key: 'states', label: 'State' },
]

/** One active selection across every facet, tagged with which facet it came from. */
interface ActiveChip {
  key: FacetKey
  label: string
  value: string
}

function collectActiveChips(value: Filters): ActiveChip[] {
  const chips: ActiveChip[] = []
  for (const { key, label } of GROUPS) {
    for (const option of value[key]) {
      chips.push({ key, label, value: option })
    }
  }
  return chips
}

/** Multi-select filter bar (devs / tags / states) + an active-chip row, controlled via `value`/`onChange`. */
export function FilterBar({ facets, value, onChange }: FilterBarProps) {
  const hasActiveFilters =
    value.devs.length > 0 || value.tags.length > 0 || value.states.length > 0 || value.search !== ''

  const activeChips = collectActiveChips(value)

  // Partition facets by how they render: small ones (<= INLINE_FACET_MAX) show
  // as inline chips and want a full-width row to spread; larger ones are compact
  // dropdowns that pack onto the top row next to search. GROUPS order is
  // preserved within each partition.
  const inlineGroups = GROUPS.filter(({ key }) => facets[key].length <= INLINE_FACET_MAX)
  const dropdownGroups = GROUPS.filter(({ key }) => facets[key].length > INLINE_FACET_MAX)

  // The search input stays instant (local state) while its propagation to the
  // expensive `applyFilters` is debounced. `value` is kept in a ref so the
  // debounced flush always merges onto the LATEST facets — a facet toggle (or
  // Clear) that lands mid-debounce is never clobbered by a stale search write.
  const [searchDraft, setSearchDraft] = useState(value.search)
  const valueRef = useRef(value)
  valueRef.current = value

  // Keep the draft in sync when `search` changes from outside (e.g. Clear resets
  // it to '') so the input reflects the real state.
  useEffect(() => {
    setSearchDraft(value.search)
  }, [value.search])

  const onSearchChange = (next: string) => {
    setSearchDraft(next)
  }

  useEffect(() => {
    if (searchDraft === valueRef.current.search) return
    const id = setTimeout(() => {
      onChange({ ...valueRef.current, search: searchDraft })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [searchDraft, onChange])

  return (
    <div className="flex flex-col gap-2 border-b border-line bg-surface px-4 py-2">
      {/* Compact row: search + every facet that renders as a dropdown (large
          facets). Fixed-width controls that pack together horizontally. Clear
          lives at the row's end (via ml-auto) rather than a standalone row above,
          so it appears/disappears in place without shifting the whole bar down. */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label="Search cards"
          placeholder="Search cards…"
          value={searchDraft}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-56 rounded border border-line bg-surface px-1.5 py-0.5 text-xs text-content placeholder-content-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-ring"
        />

        {dropdownGroups.map(({ key, label }) => (
          <MultiSelect
            key={key}
            label={label}
            options={facets[key]}
            selected={value[key]}
            onChange={(next) => onChange({ ...value, [key]: next })}
            ariaLabel={`${label} filter`}
            triggerClassName="flex w-56 items-center justify-between gap-1.5 rounded border border-line bg-surface px-1.5 py-0.5 text-xs text-content hover:bg-surface-raised"
          />
        ))}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => onChange({ devs: [], tags: [], states: [], search: '' })}
            className="ml-auto rounded-md border border-line px-2 py-1 text-xs font-medium text-content-muted hover:bg-surface-raised"
          >
            Clear
          </button>
        )}
      </div>

      {/* One full-width row per small facet, so its chips get room to spread. */}
      {inlineGroups.map(({ key, label }) => (
        <InlineChips
          key={key}
          label={label}
          options={facets[key]}
          selected={value[key]}
          onChange={(next) => onChange({ ...value, [key]: next })}
        />
      ))}

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map(({ key, label, value: option }) => (
            <span
              key={`${key}:${option}`}
              className="inline-flex items-center gap-1 rounded-full bg-accent py-1 pl-2.5 pr-1.5 text-xs font-medium text-accent-fg"
            >
              <span className="text-accent-fg">{label}:</span>
              {option}
              <button
                type="button"
                aria-label={`Remove ${option}`}
                onClick={() => onChange({ ...value, [key]: value[key].filter((v) => v !== option) })}
                className="ml-0.5 rounded-full text-accent-fg"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
