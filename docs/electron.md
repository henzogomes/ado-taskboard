# Electron desktop app — design spec

Status: **v1 (Linux) implemented and verified** — Option A (renderer holds the
PAT). `electron/main.mjs` boots the existing relay on an ephemeral port; the
headed smoke (`npm run test:electron`) confirms the login screen renders
through it. AppImage + deb build via `electron-builder` (deb verified in CI).
macOS/Windows remain deferred. Tracks issue #3.

## Goal

Ship a standalone desktop build of the taskboard. **Linux first** (`AppImage` +
`.deb`), then macOS (`.dmg`) and Windows (`nsis`) as follow-ups. The app must
behave identically to the web app — same board, same drag-and-drop, same
connection flow.

Linux-first is the pragmatic call: it needs no code-signing/notarization, so it
can be built and verified on this machine (Linux) end-to-end — no Apple
credential blocker.

## The one hard decision: who holds the PAT

The entire app is built around *"the browser holds the PAT; the proxy is a pure
relay."* Electron gives two ways to fit that model, and they have very different
costs.

### Option A — renderer holds the PAT (v1, recommended first)

Treat the Electron `BrowserWindow` as "the browser." Run the existing prod
server/proxy in the main process, load it in the window, and let the web app run
unchanged: the PAT stays in `src/connections/store.ts` (`localStorage`, inside
Chromium's profile under Electron `userData`), and `src/api/client.ts` keeps
sending `X-ADO-PAT` to the relay.

- **Pros:** near-zero change to the web app; ships fast; reuses every existing
  path (proxy, auth, connection store, demo mode) verbatim.
- **Cons:** the PAT is on disk in the renderer profile (unencrypted, but scoped
  to the OS user). For a local single-user tool this is on par with the web app
  today; it is *not* `safeStorage`-hardened.

### Option B — main process holds the PAT (v2, later)

The issue's security bullet: PAT encrypted with Electron `safeStorage`, held in
the main process; the renderer never sees it.

- Requires moving the connection store into the main process, exposing it to the
  renderer over IPC (`contextBridge` + a `preload` script), removing the
  `X-ADO-PAT` header from `src/api/client.ts`, and teaching the proxy to inject
  the PAT from the main-process store (keyed by connection id) instead of from a
  request header.
- **This is a real refactor of `src/connections/*`, `src/api/client.ts`, and the
  proxy** — the riskiest part of the whole feature and why it should land behind
  its own milestone, not mixed into the web app.

**Recommendation:** ship A first (issue's first bullet), then B as a follow-up.
Both are worth a clean separation from the web code.

## Serving model

The prod server is a self-starting script today (`server/index.mjs` ends in
`app.listen(PORT)`). For Electron we want it importable:

1. Extract `createServer({ distDir })` from `server/index.mjs` (returns the
   Express app, no `listen`); keep `index.mjs` as a thin CLI entry that calls it.
   This is a no-behavior-change refactor and also makes the server unit-testable.
2. Electron main imports `createServer`, listens on an **ephemeral port**
   (`listen(0)` → `server.address().port`), and `loadURL`s that address. No child
   process, clean shutdown on `app.quit()`.

Keeping the local HTTP relay (rather than a custom `app://` scheme) avoids any
custom-protocol/CORS work — the browser's `fetch('/api/ado/…')` keeps working.

## File layout (proposed)

```
electron/
  main.mjs          # app lifecycle: create server on ephemeral port, BrowserWindow, load URL
  preload.cjs       # v1: absent/unused; v2: contextBridge IPC for the connection store
server/
  index.mjs         # CLI entry (calls createServer)
  createServer.mjs  # extracted: build the express app + proxy (no listen)
scripts/
  electron-smoke.mjs  # headed CDP smoke: launches the app, asserts the login screen renders
package.json        # "main": "electron/main.mjs", "build": { electron-builder config }
```

`server/createServer.mjs`, `electron/main.mjs`, and `scripts/electron-smoke.mjs`
are implemented as of the v1 milestone; `preload.cjs` is intentionally absent
until v2.

## Build & packaging

- **Bundler:** `electron-builder`.
- `"files"`: `dist/**`, `server/**`, `electron/**`, `package.json`.
- **Targets (Linux first):** `AppImage` + `deb`. No code-signing required to
  distribute (optional GPG signing only if we later publish to an apt repo).
- **Later:** macOS `dmg` + `zip` (signed + notarized — needs an Apple Developer
  ID cert + `notarytool` credentials, **blocked**) and Windows `nsis`.
- **CI:** a Linux GitHub Actions runner builds `AppImage`/`deb` (with `xvfb`
  for any headed smoke); macOS/Windows artifacts from their own runners later.

## Security model (v1)

Keep Electron defaults locked down: `contextIsolation: true`,
`nodeIntegration: false`, `sandbox: true`. The web app needs no Node APIs in the
renderer, so v1 ships with **no preload** (v2 adds one for the IPC bridge).

## Dependencies

- **dev:** `electron`, `electron-builder`; dev convenience `concurrently` +
  `wait-on` (optional).
- **runtime:** none new — the app's existing prod deps (`express`,
  `http-proxy-middleware`, React, …) are enough; Electron bundles its own
  runtime.

## Scripts

- `dev:electron` — `npm run build && electron .` (launch the desktop app).
- `build:electron` — `npm run build && electron-builder --linux` (AppImage + deb).
- `pack:electron` — `npm run build && electron-builder --dir` (unpacked, fast).
- `test:electron` — headed smoke (`scripts/electron-smoke.mjs`); run under
  `xvfb-run` in CI.

## Verification plan

1. `npm run build` → `dist/`, then `npm run dev:electron` on Linux. ✅ verified
   on this machine.
2. `npm run test:electron` asserts the login screen renders through the relay.
   ✅ verified.
3. Plain web app unchanged: `npm run serve` + the `createServer` unit tests
   (`server/createServer.test.mjs`) cover the relay. ✅ verified.
4. `electron-builder --linux` → AppImage (✅ built and launched locally) + deb
   (✅ built in CI; local Arch box lacks `libcrypt.so.1` for the bundled fpm).

## Open decisions / blockers

1. **A vs B** — **resolved**: A (renderer-PAT) is implemented as v1; B
   (`safeStorage`/main-PAT) is the v2 follow-up.
2. **Auto-update** (`electron-updater`) — later; needs a signed release feed.
3. Confirm the **HTTP-relay** approach (vs custom protocol) — recommended here.
4. **macOS/Windows** are deferred to their own milestones (macOS is gated on
   Apple signing credentials).

Linux has no signing blocker, so this is no longer `needs-refinement` for the
Linux target — implementation can proceed and be verified on this machine.
