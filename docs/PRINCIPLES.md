# ado-taskboard — design principles

## 1. Everything dynamic. Hardcode nothing project-specific.

The taskboard must work with **any** ADO project, team, and process template. We
do not know a user's work-item types, board layout, states, or backlog levels — so
we **discover them all from the API** and never bake in a specific value.

**Never hardcode:**
- work-item type names (`User Story`, `Task`, `Bug`, …)
- board names (`Stories`) or column names / layouts
- state names (`New`, `Active`, `Closed`, …) or state→category maps
- backlog levels (Epic / Feature / Story / Initiative)

**Discover instead:**
- `_apis/work/backlogs` — backlog levels (`requirement` / `task` / `portfolio`),
  their work-item types, and board names.
- `_apis/work/boards/{name}` — columns + `stateMappings`.
- `_apis/wit/workitemtypes/{type}/states` — each state's name → category → color.

**OK to rely on (ADO's fixed contract, not project-specific):**
- `System.*` field names (`System.State`, `System.BoardColumn`,
  `System.WorkItemType`, `System.Parent`, `System.IterationPath`, …).
- The five ADO state **categories**: `Proposed`, `InProgress`, `Resolved`,
  `Completed`, `Removed`.

**Process-specific fields must degrade gracefully.** e.g.
`Microsoft.VSTS.Common.AcceptanceCriteria` exists in Agile/Scrum/CMMI but not the
Basic process — render its absence cleanly, never assume it's present.

> Any literal in `src/` that names a specific type, state, board, column, or level
> is a bug. Grep for them in review:
> `grep -rnE "'(User Story|Task|Stories|New|Active|Closed)'|boards/Stories" src`

This is what issues #1 (generalize for any board) and #3 (dynamic discovered
level toggle) enforce, and it binds all future work.
