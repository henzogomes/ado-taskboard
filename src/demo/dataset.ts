// Synthetic, in-memory demo dataset — the SAME raw shapes the live load path
// consumes (WorkItem / Board / Iteration / BacklogLevels / per-state category /
// FieldMeta / per-item detail), so demo mode exercises the real domain builders
// and rendering path rather than a bespoke fake board.
//
// DATA SAFETY (public repo): everything here is invented. Generic people
// ("Alex Rivera", "Dev One", …), a "Demo Project", made-up story/task titles.
// No real org, client, person, id, or token anywhere.

import type {
  BacklogLevels,
  Board,
  FieldMeta,
  Identity,
  Iteration,
  StateCategory,
  WorkItem,
  WorkItemComment,
  WorkItemCommentsPage,
  WorkItemDetail,
} from '../api/types'

const PROJECT = 'Demo Project'
const path = (sprint: string): string => `${PROJECT}\\${sprint}`

// ---- people (synthetic) ----
const ALEX: Identity = { displayName: 'Alex Rivera', uniqueName: 'alex.rivera@demo' }
const DEV_ONE: Identity = { displayName: 'Dev One', uniqueName: 'dev.one@demo' }
const SAM: Identity = { displayName: 'Sam Lee', uniqueName: 'sam.lee@demo' }
const JORDAN: Identity = { displayName: 'Jordan Kim', uniqueName: 'jordan.kim@demo' }

// ---- iterations (chronological, earliest first — matches loadBoardData) ----
// Sprint 2 spans into the far future so it is always the date-derived "current"
// sprint, keeping demo output stable over time (same trick as the e2e fixture).
export const DEMO_ITERATIONS: Iteration[] = [
  { id: 'sprint-1', name: 'Sprint 1', path: path('Sprint 1'), startDate: '2025-01-01T00:00:00Z', finishDate: '2025-06-30T00:00:00Z' },
  { id: 'sprint-2', name: 'Sprint 2', path: path('Sprint 2'), startDate: '2025-07-01T00:00:00Z', finishDate: '2099-12-31T00:00:00Z' },
  { id: 'sprint-3', name: 'Sprint 3', path: path('Sprint 3'), startDate: '2100-01-01T00:00:00Z', finishDate: '2100-06-30T00:00:00Z' },
]

// ---- backlog levels (requirement + task + two portfolio levels) ----
export const DEMO_BACKLOGS: BacklogLevels = {
  requirement: { boardName: 'Stories', workItemTypes: ['User Story', 'Bug'] },
  task: { workItemTypes: ['Task'] },
  portfolios: [
    { name: 'Features', workItemTypes: ['Feature'] },
    { name: 'Epics', workItemTypes: ['Epic'] },
  ],
}

// ---- board (one board serves every demo view) ----
// stateMappings per type let `columnForItem`'s Tier-0/Tier-1 resolve cards into
// distinct columns. The "Resolved" column holds no Task mapping, so it stays
// empty in the Tasks view unless "All columns" is on — exercising that toggle.
export const DEMO_BOARD: Board = {
  columns: [
    {
      name: 'New',
      columnType: 'incoming',
      isSplit: false,
      stateMappings: { 'User Story': 'New', Bug: 'New', Task: 'To Do', Feature: 'New', Epic: 'New' },
    },
    {
      name: 'Active',
      columnType: 'inProgress',
      isSplit: false,
      stateMappings: { 'User Story': 'Active', Bug: 'Active', Task: 'In Progress', Feature: 'In Progress', Epic: 'In Progress' },
    },
    {
      name: 'In Review',
      columnType: 'inProgress',
      isSplit: false,
      stateMappings: { 'User Story': 'In Review', Bug: 'In Review', Task: 'In Review' },
    },
    {
      name: 'Resolved',
      columnType: 'inProgress',
      isSplit: false,
      stateMappings: { 'User Story': 'Resolved', Bug: 'Resolved' },
    },
    {
      name: 'Closed',
      columnType: 'outgoing',
      isSplit: false,
      stateMappings: { 'User Story': 'Closed', Bug: 'Closed', Task: 'Done', Feature: 'Done', Epic: 'Done' },
    },
  ],
}

// ---- state → category (feeds the theme + Tier-2 column fallback) ----
export const DEMO_STATE_CATEGORY: Record<string, StateCategory> = {
  New: 'Proposed',
  'To Do': 'Proposed',
  Active: 'InProgress',
  'In Progress': 'InProgress',
  'In Review': 'InProgress',
  Resolved: 'Resolved',
  Closed: 'Completed',
  Done: 'Completed',
}

// ---- field catalog (drives the ticket modal's dynamic rich-text rendering) ----
export const DEMO_FIELDS: FieldMeta[] = [
  { referenceName: 'System.Description', displayName: 'Description', type: 'html' },
  { referenceName: 'Microsoft.VSTS.Common.AcceptanceCriteria', displayName: 'Acceptance Criteria', type: 'html' },
  { referenceName: 'Microsoft.VSTS.TCM.ReproSteps', displayName: 'Repro Steps', type: 'html' },
  { referenceName: 'System.Title', displayName: 'Title', type: 'string' },
  { referenceName: 'System.State', displayName: 'State', type: 'string' },
]

interface Seed {
  id: number
  type: string
  title: string
  state: string
  boardColumn?: string | null
  assignedTo?: Identity | null
  tags?: string[]
  parent?: number | null
  sprint: string
  rev?: number
}

const SEEDS: Seed[] = [
  // --- Sprint 2 (current) ---
  { id: 101, type: 'User Story', title: 'Build the login screen', state: 'Active', boardColumn: 'Active', assignedTo: ALEX, tags: ['frontend', 'auth'], sprint: 'Sprint 2' },
  { id: 201, type: 'Task', title: 'Wire up the login form', state: 'In Progress', assignedTo: ALEX, parent: 101, sprint: 'Sprint 2' },
  { id: 202, type: 'Task', title: 'Add client-side form validation', state: 'To Do', assignedTo: DEV_ONE, parent: 101, sprint: 'Sprint 2' },
  { id: 203, type: 'Task', title: 'Write unit tests for the form', state: 'In Review', assignedTo: ALEX, parent: 101, sprint: 'Sprint 2' },
  { id: 212, type: 'Task', title: 'Handle expired-session redirect', state: 'Done', assignedTo: DEV_ONE, parent: 101, sprint: 'Sprint 2' },

  { id: 102, type: 'User Story', title: 'Dashboard summary charts', state: 'New', boardColumn: 'New', assignedTo: SAM, tags: ['frontend', 'charts'], sprint: 'Sprint 2' },
  { id: 204, type: 'Task', title: 'Design the chart layout', state: 'To Do', assignedTo: SAM, parent: 102, sprint: 'Sprint 2' },
  { id: 205, type: 'Task', title: 'Integrate the charting library', state: 'In Progress', assignedTo: JORDAN, parent: 102, sprint: 'Sprint 2' },
  { id: 213, type: 'Task', title: 'Review chart contrast in dark themes', state: 'In Review', assignedTo: SAM, parent: 102, sprint: 'Sprint 2' },

  { id: 103, type: 'Bug', title: 'App crashes on logout', state: 'Resolved', boardColumn: 'Resolved', assignedTo: JORDAN, tags: ['bug', 'priority'], sprint: 'Sprint 2' },
  { id: 206, type: 'Task', title: 'Reproduce and patch the crash', state: 'Done', assignedTo: JORDAN, parent: 103, sprint: 'Sprint 2' },

  // Orphan task (no parent in scope) → exercises the "No parent" lane.
  { id: 210, type: 'Task', title: 'Bump project dependencies', state: 'In Progress', assignedTo: DEV_ONE, parent: null, sprint: 'Sprint 2' },

  // --- Sprint 1 (past) ---
  { id: 104, type: 'User Story', title: 'Set up the CI pipeline', state: 'Closed', boardColumn: 'Closed', assignedTo: DEV_ONE, tags: ['devops'], sprint: 'Sprint 1' },
  { id: 207, type: 'Task', title: 'Add the build stage', state: 'Done', assignedTo: DEV_ONE, parent: 104, sprint: 'Sprint 1' },
  { id: 208, type: 'Task', title: 'Add the test stage', state: 'Done', assignedTo: SAM, parent: 104, sprint: 'Sprint 1' },

  // --- Sprint 3 (future) ---
  { id: 105, type: 'User Story', title: 'Dark mode support', state: 'New', boardColumn: 'New', assignedTo: ALEX, tags: ['frontend', 'theme'], sprint: 'Sprint 3' },
  { id: 209, type: 'Task', title: 'Audit color tokens', state: 'To Do', assignedTo: ALEX, parent: 105, sprint: 'Sprint 3' },

  // --- Portfolio: Features (not iteration-scoped) ---
  { id: 301, type: 'Feature', title: 'Authentication', state: 'In Progress', boardColumn: 'Active', assignedTo: ALEX, tags: ['auth'], sprint: 'Sprint 2' },
  { id: 302, type: 'Feature', title: 'Reporting & dashboards', state: 'New', boardColumn: 'New', assignedTo: SAM, tags: ['reporting'], sprint: 'Sprint 2' },

  // --- Portfolio: Epics ---
  { id: 401, type: 'Epic', title: 'Platform foundation', state: 'In Progress', boardColumn: 'Active', assignedTo: JORDAN, sprint: 'Sprint 2' },
]

/** Builds a FRESH array of demo work items (callers may mutate their own copy —
 *  see the runtime store — so this must never share item references). */
export function makeDemoWorkItems(): WorkItem[] {
  return SEEDS.map((s) => ({
    id: s.id,
    type: s.type,
    title: s.title,
    state: s.state,
    boardColumn: s.boardColumn ?? null,
    assignedTo: s.assignedTo ?? null,
    tags: s.tags ?? [],
    parent: s.parent ?? null,
    iterationPath: path(s.sprint),
    rev: s.rev ?? 1,
  }))
}

// ---- per-item detail (Description / Acceptance Criteria / Repro Steps) ----
// Only a few items carry rich detail; the rest fall back to an empty detail
// (see `demoWorkItemDetail`). Relations on #101 exercise the modal's Relations
// section (URLs point at a fake org — never dereferenced in demo).
export const DEMO_DETAILS: Record<number, WorkItemDetail> = {
  101: {
    id: 101,
    fields: {
      'System.Description': '<div>As a returning user, I want a working login form so that I can sign in and reach my board.</div>',
      'Microsoft.VSTS.Common.AcceptanceCriteria':
        '<ul><li>Given valid credentials, sign-in succeeds and lands on the board.</li><li>Given invalid credentials, a clear error is shown.</li><li>The password field is masked.</li></ul>',
    },
    relations: [
      { rel: 'System.LinkTypes.Hierarchy-Forward', id: 201, url: 'https://dev.azure.com/demo-org/Demo%20Project/_apis/wit/workItems/201' },
      { rel: 'System.LinkTypes.Hierarchy-Forward', id: 202, url: 'https://dev.azure.com/demo-org/Demo%20Project/_apis/wit/workItems/202' },
    ],
  },
  201: {
    id: 201,
    fields: {
      'System.Description': '<div>Connect the login form fields to the auth service and handle the loading + error states.</div>',
    },
    relations: [
      { rel: 'System.LinkTypes.Hierarchy-Reverse', id: 101, url: 'https://dev.azure.com/demo-org/Demo%20Project/_apis/wit/workItems/101' },
    ],
  },
  102: {
    id: 102,
    fields: {
      'System.Description': '<div>Show summary charts (throughput, cycle time) on the dashboard landing page.</div>',
      'Microsoft.VSTS.Common.AcceptanceCriteria': '<ul><li>Charts render in both light and dark themes.</li><li>Empty state is handled gracefully.</li></ul>',
    },
    relations: [],
  },
  103: {
    id: 103,
    fields: {
      'System.Description': '<div>The app throws and shows a blank screen when a user logs out from the settings menu.</div>',
      'Microsoft.VSTS.TCM.ReproSteps':
        '<ol><li>Sign in.</li><li>Open Settings.</li><li>Click "Log out".</li><li>Observe the blank screen and console error.</li></ol>',
    },
    relations: [],
  },
  301: {
    id: 301,
    fields: {
      'System.Description': '<div>Everything related to signing in: login screen, session handling, and password reset.</div>',
    },
    relations: [],
  },
}

/** The detail for a demo item — a populated one when seeded, else an empty
 *  (but well-formed) detail so the modal renders "No details." rather than
 *  erroring. */
export function demoWorkItemDetail(id: number): WorkItemDetail {
  return DEMO_DETAILS[id] ?? { id, fields: {}, relations: [] }
}

// ---- per-item discussion comments (synthetic) ----
// Authors reuse the demo people above (never real addresses). #101 carries
// enough comments to span multiple demo pages (exercising "Load more"); #102
// has a single comment; every other id falls back to the empty list.
const day = (d: string): string => `2025-07-${d}T09:00:00Z`
export const DEMO_COMMENTS: Record<number, WorkItemComment[]> = {
  101: [
    { id: 1, text: '<div>Started wiring the form — should have a draft up shortly.</div>', createdBy: ALEX, createdDate: day('01') },
    { id: 2, text: '<div>Nice. Remember the password field needs to be masked.</div>', createdBy: SAM, createdDate: day('02') },
    { id: 3, text: '<div>Added masking and the invalid-credentials error state.</div>', createdBy: ALEX, createdDate: day('03') },
    { id: 4, text: '<div>Reviewed — looks good. One nit on the loading spinner.</div>', createdBy: JORDAN, createdDate: day('04') },
    { id: 5, text: '<div>Nit addressed. Merging after CI is green.</div>', createdBy: ALEX, createdDate: day('05') },
  ],
  102: [
    { id: 6, text: '<div>Which charting library are we standardizing on?</div>', createdBy: JORDAN, createdDate: day('02') },
  ],
}

// Small demo page size purely to exercise the pagination UI in demo mode — a
// 5-comment seed then yields two pages. Real ADO uses $top=50 (see the client).
const DEMO_COMMENTS_PAGE_SIZE = 3

/** Paginates a demo item's seeded comments via a numeric offset encoded as the
 *  string continuationToken (first call: `undefined` → offset 0). Returns
 *  `continuationToken` only while more remain; unseeded ids yield an empty page. */
export function demoWorkItemComments(id: number, continuationToken?: string): WorkItemCommentsPage {
  const all = DEMO_COMMENTS[id] ?? []
  const offset = continuationToken !== undefined ? Number(continuationToken) : 0
  const nextOffset = offset + DEMO_COMMENTS_PAGE_SIZE
  return {
    comments: all.slice(offset, nextOffset),
    continuationToken: nextOffset < all.length ? String(nextOffset) : undefined,
    totalCount: all.length,
  }
}
