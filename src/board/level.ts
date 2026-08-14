import type { BacklogLevels } from '../api/types'

/**
 * One selectable backlog-level view in the level toggle (#3): a lane-grouped
 * "Tasks" view, a flat requirement (story) view, and one flat view per
 * portfolio level (Features/Epics/Initiatives/…) — all discovered from ADO,
 * nothing hardcoded project-specific.
 */
export interface LevelView {
  /** 'tasks' | 'requirement' | slug(portfolio name) */
  id: string
  /** 'Tasks', then the ADO level name ('Stories', 'Features', …) */
  label: string
  kind: 'lanes' | 'flat'
  /** The requirement board for tasks+requirement; the portfolio's own board otherwise. */
  boardName: string
  /** Work-item types to query for this view. */
  types: string[]
  /** True for requirement-level views; false for portfolios. */
  iterationScoped: boolean
}

/** Lowercase, hyphenate non-alphanumerics, trim leading/trailing hyphens. */
export const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * Build the set of level views from the discovered backlog levels — always
 * `tasks` (lanes, requirement board, requirement+task types) then
 * `requirement` (flat, requirement board, requirement types only), then one
 * flat view per portfolio level in the order ADO returns them.
 */
export function buildLevels(b: BacklogLevels): LevelView[] {
  const req = b.requirement
  return [
    {
      id: 'tasks',
      label: 'Tasks',
      kind: 'lanes',
      boardName: req.boardName,
      types: [...req.workItemTypes, ...b.task.workItemTypes],
      iterationScoped: true,
    },
    {
      id: 'requirement',
      label: req.boardName,
      kind: 'flat',
      boardName: req.boardName,
      types: req.workItemTypes,
      iterationScoped: true,
    },
    ...b.portfolios.map((p) => ({
      id: slug(p.name),
      label: p.name,
      kind: 'flat' as const,
      boardName: p.name,
      types: p.workItemTypes,
      iterationScoped: false,
    })),
  ]
}
