# Electron desktop app — design spec

Status: **v1 (Linux) implemented and verified** — Option A (renderer holds the
PAT). `electron/main.mjs` boots the existing relay on a **fixed localhost port**
(5320, ephemeral fallback if taken) so the renderer origin — and with it the
persisted connection store/PAT, theme, and query cache — stays stable across
launches; the headed smoke (`npm run test:electron`) confirms the login screen
renders through it. AppImage + deb build via `electron-builder` (deb verified
in CI). macOS/Windows remain deferred. Tracks issue #3.

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
2. Electron main imports `createServer`, listens on a **fixed port** (5320;
   ephemeral fallback if taken). localStorage is partitioned by the renderer's
   origin (scheme+host+port), so a stable port is what makes the connection
   store/PAT, theme, and query cache persist between launches. A
   single-instance lock stops a second launch from racing the port. `loadURL`s
   that address. No child process, clean shutdown on `app.quit()`.

Keeping the local HTTP relay (rather than a custom `app://` scheme) avoids any
custom-protocol/CORS work — the browser's `fetch('/api/ado/…')` keeps working.

## File layout

```
electron/
  main.mjs          # app lifecycle: create server on fixed relay port, BrowserWindow, load URL
  preload.cjs       # minimal contextBridge (`window.taskboard`) for the title-bar overlay
src/titlebar/
  TitleBar.tsx      # custom drag strip for the Window Controls Overlay (web app: no-op)
  desktop.ts        # bridge typing + theme→overlay color helpers
server/
  index.mjs         # CLI entry (calls createServer)
  createServer.mjs  # extracted: build the express app + proxy (no listen)
scripts/
  electron-smoke.mjs  # headed CDP smoke: launches the app, asserts login screen + titlebar
package.json        # "main": "electron/main.mjs", "build": { electron-builder config }
```

## Build & packaging

- **Bundler:** `electron-builder`.
- `"files"`: `dist/**`, `server/**`, `electron/**`, `package.json`.
- **Targets (Linux first):** AppImage + pacman (Arch-native) locally; deb built
  in CI. No code-signing required to distribute (optional GPG signing only if
  we later publish to an apt repo).
- **Later:** macOS `dmg` + `zip` (signed + notarized — needs an Apple Developer
  ID cert + `notarytool` credentials, **blocked**) and Windows `nsis`.
- **CI:** a Linux GitHub Actions runner builds AppImage/deb/pacman (with `xvfb`
  for the headed smoke against the packaged build); macOS/Windows artifacts
  from their own runners later.

## Security model (v1)

Keep Electron defaults locked down: `contextIsolation: true`,
`nodeIntegration: false`, `sandbox: true`. The preload exposes exactly one
surface — `window.taskboard.setTitleBarOverlay` for theming the native
title-bar overlay — and nothing else: the PAT stays in the renderer connection
store and there is no connection-store IPC (that stays with v2's
`safeStorage` milestone).

## Custom title bar (Window Controls Overlay)

`titleBarStyle: 'hidden'` + `titleBarOverlay` hide the OS title-bar text area
while keeping the **native** min/max/close buttons (Linux support since
Electron 30.2; this is Electron 43). The renderer's `TitleBar` renders a
drag strip (`-webkit-app-region: drag`) in the freed space and themes the
buttons by sending its theme's `--surface`/`--text-muted` colors (as `#rrggbb`)
over the single IPC channel; it re-syncs when `data-theme` changes. In the
plain web build the bridge is absent and `TitleBar` renders nothing.

## Dependencies

- **dev:** `electron`, `electron-builder`; dev convenience `concurrently` +
  `wait-on` (optional).
- **runtime:** none new — the app's existing prod deps (`express`,
  `http-proxy-middleware`, React, …) are enough; Electron bundles its own
  runtime.

## Scripts

- `dev:electron` — `npm run build && electron .` (launch the desktop app).
- `build:electron` — `npm run build && electron-builder --linux AppImage pacman`
  (the two formats that run on Arch — this project's primary dev host).
- `build:electron:deb` — `npm run build && electron-builder --linux deb`
  (Debian/Ubuntu; built from CI, which has the `libcrypt` the bundled fpm needs).
- `pack:electron` — `npm run build && electron-builder --dir` (unpacked, fast).
- `test:electron` — headed smoke (`scripts/electron-smoke.mjs`); run under
  `xvfb-run` in CI.

## Verification plan

1. `npm run build` → `dist/`, then `npm run dev:electron` on Linux. ✅ verified
   on this machine.
2. `npm run test:electron` asserts the login screen renders through the relay —
   and in desktop mode asserts `window.taskboard` (preload) + the custom
   title-bar strip are present. ✅ verified — in CI against the **packaged**
   build (`ELECTRON_SMOKE_BIN=release/linux-unpacked/ado-taskboard`) so
   packaging regressions (e.g. dropped transitive deps) fail the build.
3. Plain web app unchanged: `npm run serve` + the `createServer` unit tests
   (`server/createServer.test.mjs`) cover the relay. ✅ verified.
4. `electron-builder --linux` → AppImage (✅ built and launched locally), pacman
   `ado-taskboard-*.pacman` (✅ built + packaged-app smoke passed locally —
   Arch-native), deb (✅ built in CI; a `.deb` is Debian-family only and needs
   `libcrypt.so.1`, which Arch lacks).
5. Custom title bar verified on this machine (`dev:electron`): drag strip
   renders, native min/max/close buttons stay, overlay colors follow the theme.

> Local build gotcha: electron-builder's dependency collector runs `npm list`
> against `node_modules`; a symlinked worktree `node_modules` makes it report
> broken/versionless entries and silently drop transitive deps. Build packages
> from a real install (`npm ci`) — CI always does.

## Open decisions / blockers

1. **A vs B** — **resolved**: A (renderer-PAT) is implemented as v1; B
   (`safeStorage`/main-PAT) is the v2 follow-up.
2. **Auto-update** (`electron-updater`) — later; needs a signed release feed.
3. Confirm the **HTTP-relay** approach (vs custom protocol) — recommended here.
4. **macOS/Windows** are deferred to their own milestones (macOS is gated on
   Apple signing credentials).
5. **Icon** — **resolved**: `build/icon.svg` (kanban-mark on an indigo→violet
   rounded tile) is rasterized to `build/icon.png` (512²); electron-builder
   picks it up for AppImage/deb/pacman (`linux.icon`) and `main.mjs` sets it on
   the BrowserWindow (bundled in the asar via `build` "files").

Linux has no signing blocker, so this is no longer `needs-refinement` for the
Linux target — implementation can proceed and be verified on this machine.
