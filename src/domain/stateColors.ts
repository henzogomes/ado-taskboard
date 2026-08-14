import type { StateCategory } from '../api/types'

export interface StateColor {
  /** Card left border. */
  border: string
  /** Modal top accent. */
  accent: string
  /** Combined bg+text for the modal state pill (soft themed tint). */
  pill: string
}

// State-category colors come from the theme tokens (`--state-*`), so each theme
// recolors state borders/pills in its own palette. The pill uses a translucent
// tint of the same token (`/15`), which works because the tokens are
// channel-based (see tailwind.config.ts).
const PALETTE: Record<string, StateColor> = {
  Proposed: { border: 'border-l-state-proposed', accent: 'border-t-state-proposed', pill: 'bg-state-proposed/15 text-state-proposed' },
  InProgress: { border: 'border-l-state-inprogress', accent: 'border-t-state-inprogress', pill: 'bg-state-inprogress/15 text-state-inprogress' },
  Resolved: { border: 'border-l-state-resolved', accent: 'border-t-state-resolved', pill: 'bg-state-resolved/15 text-state-resolved' },
  Completed: { border: 'border-l-state-completed', accent: 'border-t-state-completed', pill: 'bg-state-completed/15 text-state-completed' },
  Removed: { border: 'border-l-state-removed', accent: 'border-t-state-removed', pill: 'bg-state-removed/15 text-state-removed' },
}

const NEUTRAL: StateColor = {
  border: 'border-l-content-subtle',
  accent: 'border-t-content-subtle',
  pill: 'bg-content-subtle/15 text-content-muted',
}

export function categoryColor(category: string | undefined): StateColor {
  return (category !== undefined && PALETTE[category]) || NEUTRAL
}

export function colorForState(state: string, stateCategory: Record<string, StateCategory>): StateColor {
  return categoryColor(stateCategory[state])
}
