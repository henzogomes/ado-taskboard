// Typed shapes mapped from raw ADO REST responses.

export interface Identity {
  displayName: string
  uniqueName: string
}

export interface WorkItem {
  id: number
  type: string
  title: string
  state: string
  boardColumn: string | null
  assignedTo: Identity | null
  tags: string[]
  parent: number | null
  iterationPath: string
  rev: number
}

export interface Iteration {
  id: string
  name: string
  path: string
  startDate?: string
  finishDate?: string
  timeFrame?: string
}

export interface BoardColumn {
  name: string
  columnType: string
  isSplit: boolean
  stateMappings: Record<string, string>
}

export interface Board {
  columns: BoardColumn[]
}

export interface WorkItemRelation {
  rel: string
  id: number | null
  url: string
}

export interface WorkItemDetail {
  id: number
  /** Raw ADO field map (reference name → value) from `?$expand=all`; only
   * fields with a value for this item are present. */
  fields: Record<string, unknown>
  relations: WorkItemRelation[]
}

/** Metadata for one ADO field, from `_apis/wit/fields`. */
export interface FieldMeta {
  referenceName: string
  displayName: string
  /** ADO field data type: 'html', 'plainText', 'string', 'dateTime', … */
  type: string
}

/** A populated rich-text field resolved for rendering in the ticket modal. */
export interface DetailField {
  referenceName: string
  displayName: string
  html: string
}

export type StateCategory = 'Proposed' | 'InProgress' | 'Resolved' | 'Completed' | 'Removed' | (string & {})

export interface BacklogLevels {
  /** The `requirement`-category backlog level: the story board. */
  requirement: { boardName: string; workItemTypes: string[] }
  /** The `task`-category level: child (leaf) types. */
  task: { workItemTypes: string[] }
  /** `portfolio`-category levels (Epics/Features/Initiatives) — exposed for the #3 toggle. */
  portfolios: { name: string; workItemTypes: string[] }[]
}
