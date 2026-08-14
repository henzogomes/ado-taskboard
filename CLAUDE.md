# ado-taskboard — contributor guide

A local, live **Azure DevOps board taskboard**: renders any ADO team board as a
Story-per-row taskboard (stories pinned in a fixed left column; child tasks placed in
board-state columns under their parent), with drag-and-drop **and** a per-card dropdown
to move a card (which writes its new state back to ADO). Project-agnostic — connect via
the in-app login screen (`src/connections/`), switch between multiple stored
connections; `.env` is an optional server-side fallback / demo seed, not required.

## Commands

- `npm install` — deps.
- `npm run dev` — single-process dev server (Vite). The dev-server **proxy holds the
  PAT** and forwards `/api/ado/*` → ADO with auth attached.
- `npm test` — Vitest (unit tests; run before every commit).
- `npm run build` — typecheck + production build.
- `node scripts/capture-fixtures.mjs` — regenerate test fixtures from the live board
  (needs a valid `.env`).

## Setup

`npm run dev` and use the in-app login screen (org + project + PAT) — no `.env`
required. Optionally copy `.env.example` → `.env` (gitignored) and fill it to
auto-seed a default connection on first run with the PAT held server-side
instead of in the browser. See the README for the full reference and the PAT
storage trade-off.

## Architecture / invariants (do not break)

- **PAT handling is dual-mode.** The active browser `Connection`
  (`src/connections/store.ts`) may hold its own PAT (sent as `X-ADO-PAT`/
  `X-ADO-Org` headers, `src/api/client.ts`), and is never logged/echoed
  elsewhere. The proxy
  (`vite.config.ts` dev / `server/index.mjs` prod) relays those headers when
  present, else falls back to `.env`'s `ADO_ORG`/`ADO_PAT` — a connection with
  an **empty** stored PAT always means "use the server-side PAT instead". The
  client talks **only** to relative `/api/ado/*` URLs, never `dev.azure.com`
  directly (the one exception: `Card.tsx`'s human work-item hyperlink, which
  reads the active connection's non-secret org/project).
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
- No PATs, tokens, connection strings, or `.env` contents. `.env` is gitignored
  (`.env*`, with `!.env.example`); `.env.example` holds placeholders only.

Before every commit, sweep the diff for the above. When in doubt, invent a
placeholder — never paste a real value.

## Design docs

`docs/PRINCIPLES.md` states the governing rule (everything discovered from ADO
at runtime — nothing project-specific hardcoded); `docs/task-column-mapping.md`
documents the trickier algorithms (e.g. task→column mapping).
