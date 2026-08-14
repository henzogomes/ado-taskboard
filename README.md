# ado-taskboard

A local, live Azure DevOps board taskboard. It renders any ADO team board as a
**story-per-row** grid: user stories pinned in a fixed left column, their
child tasks placed in board-state columns to the right, with drag-and-drop to
move a card — which writes the new state straight back to ADO. Project-agnostic —
connect to any org/project/team from an in-app login screen, and switch between
multiple connections without restarting anything.

## Setup

```bash
npm install
npm run dev
```

Open the printed local URL. On first load you'll see a **login screen**: enter
your ADO organization, project, and a Personal Access Token (PAT scope: **Work
Items Read & Write** — read-only works too, drag-and-drop just won't persist).
The connection is validated against ADO before it's saved, then stored in your
browser. Add more connections and switch between them from the **Connection**
dropdown in the header; "Log out" clears one connection or all of them.

Team-admin permissions are **not** required — iterations are sourced from the
project's classification nodes, not the team's sprint subscription, so every
project sprint shows up even if the team was never configured to see it.

### PAT storage — the trade-off

The PAT you enter is stored in the browser (`localStorage`), plaintext. That's
**weaker** than a server-only secret: anyone with access to that browser profile
(or an XSS/extension in a worse case) could read it. This is the accepted
trade-off for a **local, single-user tool** — it's the same exposure as a
plaintext `.env` file. If you'd rather the PAT never touch the browser at all,
use the optional `.env` fallback below instead — leave the PAT field blank when
adding that connection (or let the app auto-seed it) and the proxy uses the
server-side PAT for that connection instead.

### Optional: `.env` server-side fallback / demo seed

```bash
cp .env.example .env   # fill in ADO_ORG / ADO_PROJECT / ADO_PAT (see the file for details)
```

Not required to run the app — but if `.env` is present, the app auto-seeds a
default connection on first run with an **empty stored PAT**, so it goes
straight to the board with no login step, and the PAT stays server-side for
that connection (the proxy relays it, the browser never sees it). This is the
right setup for hosting (e.g. a shared demo) where you don't want a PAT sitting
in every visitor's browser.

```bash
npm test                        # Vitest
node scripts/capture-fixtures.mjs   # regenerate test fixtures from the live board
```

## Running the built app

The dev server's `/api/ado` proxy only exists in `vite dev`. To run the
**production build**, a tiny standalone server (`server/index.mjs`) serves
`dist/` and proxies `/api/ado/*` to ADO the same **dual-mode** way the dev
proxy does: it relays whatever org/PAT the browser's active connection sends,
or falls back to `.env`'s `ADO_ORG`/`ADO_PAT` when a connection leaves the PAT
blank.

```bash
npm run serve      # builds, then starts the prod server (reads .env, optional)
# or, if dist/ is already built:
npm run start
```

Open `http://localhost:5280` (or `$PORT` if set).

## Docker

```bash
docker compose up --build
```

Builds the image and runs the container. `.env` is entirely optional here too
(read at **container start** via `env_file`, never baked into the image or
passed as a build arg — `.env` itself is also never copied into the image, see
`.dockerignore`): set it to auto-seed a connection with a server-side PAT for
every visitor (the demo-hosting case), or leave it out and let each visitor add
their own connection through the login screen. Open `http://localhost:5280`.

## Features

- **Iteration picker** — current sprint / all sprints / a specific sprint,
  sourced from the project's iterations so every sprint shows, not just ones
  the team subscribed to. "Current" is detected by date (today falling inside
  an iteration's start/finish window), not ADO's team timeframe.
- **Sections** — one collapsible section per sprint (newest first) when
  viewing all sprints; collapse via native `<details>`.
- **Filters** — client-side, by developer / tag / state.
- **Counts** — per-lane and per-sprint badges.
- **Sticky layout** — sticky column-header row and sticky story column while
  scrolling.
- **Theme** — light/dark, default light, persisted across reloads.
- **Refresh** — manual "Refresh" action plus a "last updated" timestamp.
- **Drag-and-drop** — moving a card writes an optimistic UI update immediately,
  PATCHes the new state to ADO, and rolls back with a failure toast (dismiss
  only — the rollback already happened, so there's nothing left to undo).
  Writes serialize (no overlapping PATCHes); dropping onto the same
  position/state is a no-op.

## Scope / limits

- **Writes are state/column moves only.** No title, description, tag, or
  assignee edits.
- **Local-only.** Runs on your machine with your PAT — there's no shareable
  link or deployed instance.
- Tasks with no board-column value, and whose state doesn't map cleanly to a
  column, collapse onto the **first in-progress column**. This is a documented
  limitation, not a bug — see `docs/task-column-mapping.md`.
- The **Prioritized** column is a dead drop target: it maps to the same User
  Story state (`New`) as the **New** column, and first-match resolution means
  a card dropped there writes state `New` correctly but snaps back to **New**
  on refresh — see `docs/task-column-mapping.md` §5.
- A misnamed ADO iteration node (e.g. a sprint node with a typo in its name)
  is shown verbatim; renaming it is a team-write this PAT scope doesn't need
  or grant.
- No weekend guard — every move here is your own manual action against your
  own board.

## Quality gate

Local-only (no CI). Two git hooks (Husky), installed automatically on
`npm install` via the `prepare` script:

- **pre-commit** → `lint-staged` runs `oxlint` on staged `*.{ts,tsx}` plus one
  project-wide `npm run typecheck` (`tsc -b --noEmit`).
- **pre-push** → the full fast gate: `npm run typecheck && npm run lint && npm test`.

End-to-end tests are **not** in the hooks (slower; run pre-PR/manually):

```bash
npm run test:e2e     # Playwright, fully mocked — no PAT, no live ADO
```

The e2e suite (`e2e/`) boots the dev server and intercepts every `/api/ado/**`
call in-page (`e2e/support.ts` → `mockAdo`), serving committed JSON fixtures
(`e2e/fixtures/`). A ready-made connection is seeded into `localStorage` before
load, so the four smoke specs — board loads, ticket modal, search, iteration
switch — are deterministic and secret-free.

## Architecture

**Connections** (`src/connections/`) — org/project/PAT are runtime, not
build-time: a `Connection` (org, project, PAT, optional team/me) lives in
`localStorage`, one or more per browser, one marked active. `CONFIG` (Task 3,
`src/config.ts`) resolves org/project/team/me from the active connection via
live getters. The client (`src/api/client.ts`) attaches the active
connection's org/PAT as `X-ADO-Org`/`X-ADO-PAT` headers on every `/api/ado`
call — the browser never calls `dev.azure.com` directly.

**Proxy — dual-mode** (`vite.config.ts` dev / `server/index.mjs` prod, same
`http-proxy-middleware`-based shape in both): relays the client's
`X-ADO-Org`/`X-ADO-PAT` per request when present, else falls back to `.env`'s
`ADO_ORG`/`ADO_PAT`. Either way this is the only place the PAT is attached as
an `Authorization` header — but unlike the pre-connection-manager design, the
PAT itself may now legitimately live in the browser (a per-connection choice,
not a hardcoded server secret). See `CLAUDE.md` for the invariants and the PAT
storage trade-off.

Pure domain functions (`src/domain/`) transform raw ADO work items into sprint
sections → lanes → columns, independent of any UI or fetching concern.
Drag-and-drop is driven by `@dnd-kit` plus a pure `performMove`/`moveCard`
reducer (`src/board/dnd.ts`, `src/board/performMove.ts`) that computes the
optimistic next state, which the board then persists via a serialized PATCH
with rollback on failure.

## Roadmap

Planned enhancements are tracked as GitHub issues. The governing design rule —
everything discovered from ADO at runtime, nothing project-specific hardcoded —
lives in `docs/PRINCIPLES.md`.
