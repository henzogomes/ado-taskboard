# Task 3 spike: how child Tasks map onto the Stories board columns

Captured against the `contoso` org, `Contoso.MyProject` project,
team **`Contoso.MyProject Team`** (resolved as the default team — `ADO_TEAM`
was left unset), board **`Stories`** (the literal name worked on the first
try — no need to fall back to `GET .../_apis/work/boards` and pick a candidate).

Fixtures captured by `scripts/capture-fixtures.mjs` into `src/api/__fixtures__/`:
`board.json`, `iterations.json`, `workitems.json`.

## 1. Board columns (ordered, none deprecated)

`board.json` `columns[]`, in board order. No column carries an `isDeprecated`
flag in this payload, so all 11 are live:

| # | Column name | columnType | `stateMappings['User Story']` | `stateMappings['Task']` |
|---|---|---|---|---|
| 1 | New | incoming | New | — |
| 2 | Prioritized | inProgress | New | — |
| 3 | In Refinement | inProgress | IN REFINEMENT | — |
| 4 | Ready for Agent | inProgress | READY FOR DEVELOPMENT | — |
| 5 | Active | inProgress | Active | — |
| 6 | Ready for Review | inProgress | READY FOR REVIEW | — |
| 7 | In Review | inProgress | IN REVIEW | — |
| 8 | Ready for PO Review | inProgress | READY FOR PO REVIEW | — |
| 9 | In PO Review | inProgress | IN PO REVIEW | — |
| 10 | Ready for Release | inProgress | READY FOR RELEASE | — |
| 11 | Closed | outgoing | Closed | — |

**Finding 1 (rules out option a):** every column's `stateMappings` object has
exactly two keys, `"User Story"` and `"Bug"`. There is **no `"Task"` key on any
column** — confirmed by inspecting all 11 `stateMappings` objects in
`board.json`. Rule (a) — "board `stateMappings['Task']` exists" — does not
apply on this board.

## 2. Sample Tasks: `System.State` vs `System.BoardColumn`

`workitems.json` (WIQL-selected, capped at 200 rows — see caveat below)
contains 161 `Task` items. Distinct `(state → boardColumn)` pairs observed
across all 161:

| System.State | System.BoardColumn | count |
|---|---|---|
| Closed | *(absent)* | 131 |
| New | *(absent)* | 25 |
| READY FOR DEVELOPMENT | *(absent)* | 2 |
| IN CODE REVIEW | *(absent)* | 1 |
| IN REFINEMENT | *(absent)* | 1 |
| READY FOR CODE REVIEW | *(absent)* | 1 |

Concrete tuples (one per distinct state), `(id, state, boardColumn, parent)`:

- `(808151, "Closed", null, parent=807095)`
- `(810551, "New", null, parent=818300)`
- `(810982, "IN REFINEMENT", null, parent=812454)`
- `(818850, "READY FOR DEVELOPMENT", null, parent=807104)`
- `(819971, "IN CODE REVIEW", null, parent=818300)`
- `(819974, "READY FOR CODE REVIEW", null, parent=818300)`

**Finding 2 (rules out option b):** `System.BoardColumn` is `null`/absent on
**all 161 sampled Tasks, with no exceptions**. Tasks never carry a board-column
value on this board (only `User Story` items do — see below), so rule (b) —
"tasks carry a matching `System.BoardColumn`" — does not apply either.

For contrast, the 39 `User Story` items in the same capture *do* carry
`System.BoardColumn`, and it matches the column whose `stateMappings['User
Story']` equals the story's state — confirming the mapping semantics for
stories works exactly as `board.json` describes:

- `(state="New", boardColumn="New")` × 3
- `(state="New", boardColumn="Prioritized")` × 1 — both are legal per
  `stateMappings`, since **both** the "New" and "Prioritized" columns map
  `User Story` state "New" (an inherent, documented ambiguity on this board).
- `(state="READY FOR DEVELOPMENT", boardColumn="Ready for Agent")` × 9
- `(state="READY FOR PO REVIEW", boardColumn="Ready for PO Review")` × 26

## 3. Resolution: option (c), state-category fallback — refined with an exact-name pass

Since neither (a) nor (b) hold, Task 5's `columnForTask(task, board)` must use
option (c). To make the fallback less lossy than a pure 4-bucket category
match, the rule is a **two-pass** version of (c):

**Pass 1 — exact state-name match (cheap, unambiguous where it fires).**
Because this process template gives `Task` and `User Story` overlapping state
*names* for the early lifecycle (`New`, `IN REFINEMENT`, `READY FOR
DEVELOPMENT`, `Closed` — confirmed via `GET
_apis/wit/workitemtypes/{type}/states`), look for a column whose
`stateMappings['User Story']` string equals the task's `System.State`
(case-sensitive exact match, since the API returns states pre-cased, e.g.
`"IN REFINEMENT"` on both types). If more than one column matches, pick the
**first** in board-column order (matches the brief's ambiguity guidance, and
mirrors what real `User Story` items with state `New` do — they land in the
first, "New" column, more often than "Prioritized").

**Pass 2 — state-category fallback for names that don't line up.**
Task and User Story have partially divergent state vocabularies past
refinement (e.g. Task has `READY FOR CODE REVIEW`/`IN CODE REVIEW`, Story has
`READY FOR REVIEW`/`IN REVIEW`; Task has no PO-review or release states at
all). For these, look up the task's state category via
`_apis/wit/workitemtypes/Task/states` (`Proposed` / `InProgress` / `Resolved`
/ `Completed` / `Removed`), then pick the **first** column (board order) whose
`stateMappings['User Story']` state has the same category. Record this as an
approximate mapping — it is a real, unavoidable ambiguity, not a bug.

State categories captured from `_apis/wit/workitemtypes/{type}/states`
(not saved as a fixture — this is a one-off lookup used only to write this
rule, since the endpoint's job is answering "what category is this state in?"
rather than something Tasks 4–5 need to fetch/cache at runtime):

| Task state | Category | User Story equivalent (same name) | Category |
|---|---|---|---|
| New | Proposed | New | Proposed |
| IN REFINEMENT | Proposed | IN REFINEMENT | Proposed |
| READY FOR DEVELOPMENT | Proposed | READY FOR DEVELOPMENT | Proposed |
| IN DEVELOPMENT | InProgress | IN DEVELOPMENT (state exists but unused in stateMappings) | InProgress |
| READY FOR CODE REVIEW | InProgress | *(no equivalent)* | — |
| IN CODE REVIEW | InProgress | *(no equivalent)* | — |
| BLOCKED | InProgress | BLOCKED (state exists but unused in stateMappings) | InProgress |
| Closed | Completed | Closed | Completed |
| Removed / CANCELLED | Removed | Removed | Removed |

Applying the two passes to the observed Task states:

| Task state | Pass 1 exact match? | Resulting column | Pass used |
|---|---|---|---|
| New | yes → "New" (first of New/Prioritized) | **New** | 1 (exact) |
| IN REFINEMENT | yes | **In Refinement** | 1 (exact) |
| READY FOR DEVELOPMENT | yes | **Ready for Agent** | 1 (exact) |
| Closed | yes | **Closed** | 1 (exact) |
| READY FOR CODE REVIEW | no (category InProgress, 6 candidate columns: Active, Ready for Review, In Review, Ready for PO Review, In PO Review, Ready for Release) | **Active** (first InProgress column in board order) | 2 (category, ambiguous — flagged) |
| IN CODE REVIEW | no (same InProgress bucket) | **Active** | 2 (category, ambiguous — flagged) |

**Known ambiguity to carry into Task 5:** the `InProgress` category covers 6
of the 11 Story columns, so any Task state without an exact-name match
(`READY FOR CODE REVIEW`, `IN CODE REVIEW`, `IN DEVELOPMENT`, `BLOCKED`) all
collapse onto the *same* first InProgress column (**Active**) under this
board's column ordering, even though a human reading the board would
probably expect `IN CODE REVIEW` tasks to visually align with the story's
`In Review` column. This is a genuine, documented limitation of bucket-by-
category — not a fixable bug — and Task 5 should surface it (e.g. a code
comment + a test asserting the documented fallback column) rather than
silently pretend it's precise.

### Pseudocode for Task 5

```
function columnForTask(task, board):
  storyMappings = board.columns.map(c => [c, c.stateMappings['User Story']])

  // Pass 1: exact state-name match
  exact = storyMappings.find(([c, state]) => state === task.state)
  if exact: return exact.column

  // Pass 2: category fallback
  category = categoryOf('Task', task.state)   // from workitemtypes/Task/states
  sameCategory = storyMappings.filter(([c, state]) => categoryOf('User Story', state) === category)
  if sameCategory.length > 0: return sameCategory[0].column  // first in board order

  // last resort: unmapped
  return null
```

## 4. Counts and capture caveats

- WIQL (`WorkItems WHERE WorkItemType IN ('User Story','Task') AND State <>
  'Removed'`) matched **351** items total.
- The capture script caps the batch fetch at the first **200** ids
  (`.slice(0, 200)`, per the brief's script) — so `workitems.json` holds a
  **partial sample**: 39 `User Story` + 161 `Task` = 200 of 351. Tasks 4–5
  tests should treat this fixture as representative, not exhaustive — do not
  assert exact totals like "all tasks under story X" without checking whether
  that story's tasks were inside the first 200 ids returned by WIQL (WIQL's
  default order is by `System.Id` ascending, so later-created work items may
  be cut off).
- `iterations.json` was captured but not used for the column-mapping question;
  it's there for Task 4/5's iteration-path needs.

## 5. Known limitation: `Prioritized` is a dead drop target for User Stories

Moves write only `System.State`, and `columnForTask`/`columnForStory` resolve
a card to the **first** column whose `stateMappings['User Story']` matches
that state. Per the table in §1, both **New** (column 1) and **Prioritized**
(column 2) map `User Story` state `New` — an inherent ambiguity on this board,
not something the app introduced.

Consequence: dragging a User Story card onto **Prioritized** correctly PATCHes
`System.State = "New"` (the write is honest and matches what a human working
directly in ADO would set), but on the next render/refresh the card resolves
to the first matching column and snaps back to **New**, never staying in
Prioritized. `Prioritized` is therefore a permanently-empty, effectively dead
drop target under first-match resolution. This is the same class of
limitation as the Task in-progress-collapse case above (§3's "known
ambiguity"): the written state is correct, only the visual column placement
is lossy. Not planned to be fixed — a real fix would need a tie-breaker (e.g.
preferring the column the card was already in, or persisting
`System.BoardColumn`), which is out of scope for a state-only-write app.
