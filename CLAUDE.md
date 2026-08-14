# ado-taskboard — contributor guide

A local, live **Azure DevOps board taskboard**: renders any ADO team board as a
Story-per-row taskboard (stories pinned in a fixed left column; child tasks placed in
board-state columns under their parent), with drag-and-drop **and** a per-card dropdown
to move a card (which writes its new state back to ADO). Project-agnostic — connect via
the in-app login screen (`src/connections/`), switch between multiple stored
connections. There is no `.env` / server-side PAT; the browser connection is the sole
source of credentials.

## Commands

- `npm install` — deps.
- `npm run dev` — single-process dev server (Vite). The dev-server **proxy relays the
  active connection's `X-ADO-Org` / `X-ADO-PAT`** headers to `/api/ado/*` → ADO with auth
  attached per request.
- `npm test` — Vitest (unit tests; run before every commit).
- `npm run build` — typecheck + production build.
- `ADO_ORG=.. ADO_PROJECT=.. ADO_PAT=.. node scripts/capture-fixtures.mjs` — regenerate
  test fixtures from the live board. Credentials are passed as inline env vars (no `.env`,
  no dotenv).

## Setup

`npm run dev` and use the in-app login screen (org + project + PAT). The PAT is
stored in the browser and sent with each request — it's the only way in. There
is no `.env` / server-side PAT. On first run with no stored connection, the app
auto-seeds a synthetic **demo** connection so it opens on a working demo board;
"Connect your ADO" removes it and shows the login screen.

## Architecture / invariants (do not break)

- **The active connection's PAT is the sole credential.** The active browser
  `Connection` (`src/connections/store.ts`) holds its own PAT, sent as
  `X-ADO-PAT` / `X-ADO-Org` headers (`src/api/client.ts`), never logged/echoed
  elsewhere. The proxy (`vite.config.ts` dev / `server/index.mjs` prod) is a
  **pure relay**: it forwards those headers per request and attaches
  `Authorization` from the PAT header only — there is **no** server-side/`.env`
  fallback and **no** bootstrap seed endpoint. With no PAT header, no
  `Authorization` is set and ADO returns 401 (which the app surfaces). An empty
  stored PAT means no credential; the only legitimate empty PAT is the demo
  sentinel, which short-circuits to synthetic data before any request reaches
  the proxy. The client talks **only** to relative `/api/ado/*` URLs, never
  `dev.azure.com` directly (the one exception: `Card.tsx`'s human work-item
  hyperlink, which reads the active connection's non-secret org/project).
- **Writes are state/column moves only** — the sole write is `patchState` (sets
  `System.State`, with an optimistic-concurrency `test /rev` guard). No title/body/tag/
  assignee writes.
- **Layers:** `src/api` (typed client over the proxy) → `src/domain` (pure transforms:
  `columnForTask`, `buildSections`, filters, `currentIteration`, `moveCard`) →
  `src/hooks/useBoardData` (TanStack Query: cached board data, localStorage-persisted)
  → `src/board` + `src/App` (rendering, dnd, the move orchestration `performMove`).
- **Optimistic moves:** the pure `moveCard` reducer computes the next state; drag and
  the dropdown both go through the same path; same-position/same-state drops are no-ops;
  writes serialize; failures roll back + toast.
- **Caching:** `staleTime: Infinity` — data updates only on **Refresh** (refetch) or
  after a move; persisted to `localStorage` (`gcTime` 30 min, persister `maxAge` 24h).

## Conventions

- **TDD the pure core.** Domain transforms and reducers have unit tests; keep them green
  and add tests with new logic. UI-only/layout changes are verified in the running app.
- Tailwind (`darkMode: 'class'`); style both light and dark (`dark:` variants).
- Iterations come from the **project's** classification nodes (so all sprints show,
  regardless of team subscription); "current" is date-based.

## Known limitations

- A task's state may not map 1:1 to a distinct column (tasks and stories have
  overlapping-but-not-identical state vocabularies), so some in-progress task states
  collapse onto the first in-progress column. See `docs/task-column-mapping.md`.
- Local-only (your machine, your PAT) — not a shareable link.

## Data safety (hard rule — this is a public repository)

Never commit anything that identifies a real organization, client, project, or
person:

- No real ADO org / project / team names, internal codenames, or client
  identifiers. Docs and examples use generic placeholders (`contoso`,
  `Contoso.MyProject`, `Demo`, `Sprint 1`).
- No real work-item data, coworker names, or `@company` emails. Fixtures
  (`src/api/__fixtures__/`, `e2e/fixtures/`) are **synthetic** only
  (`Dev One`…, `me@demo`, made-up titles/GUIDs).
- No PATs, tokens, connection strings, or `.env` contents. `.env*` is gitignored;
  the app reads no `.env` at all (credentials live only in the browser connection).

Before every commit, sweep the diff for the above. When in doubt, invent a
placeholder — never paste a real value.

## Design docs

`docs/PRINCIPLES.md` states the governing rule (everything discovered from ADO
at runtime — nothing project-specific hardcoded); `docs/task-column-mapping.md`
documents the trickier algorithms (e.g. task→column mapping).
