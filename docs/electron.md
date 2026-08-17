# Electron desktop app — design spec

Status: **v1 (Linux) + v1 (macOS, unsigned) + v1 (Windows, unsigned)
implemented** — Option A (renderer holds the PAT). `electron/main.mjs` boots the
existing relay on a **fixed localhost port** (5320, ephemeral fallback if taken)
so the renderer origin — and with it the persisted connection store/PAT, theme,
and query cache — stays stable across launches; the headed smoke
(`npm run test:electron`) confirms the login screen renders through it.
AppImage + deb build via `electron-builder` (deb verified in CI); macOS dmg +
zip and Windows NSIS exe build unsigned in CI. Cross-platform signing/notarization
remains gated on Apple/Microsoft credentials. Tracks issue #3.

## Goal

Ship a standalone desktop build of the taskboard. **Linux first** (`AppImage` +
`.deb` + pacman), then macOS (`.dmg` + `.zip` — ✅ done, unsigned) and Windows
(`nsis` — ✅ done, unsigned). The app must behave identically to the web app —
same board, same drag-and-drop, same connection flow.

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
  zoom.mjs          # pure browser-style zoom mapping (keys + Ctrl+wheel), unit-tested
src/titlebar/
  TitleBar.tsx      # custom drag strip for the Window Controls Overlay (web app: no-op)
  desktop.ts        # bridge typing + theme→overlay color helpers
server/
  index.mjs         # CLI entry (calls createServer)
  createServer.mjs  # extracted: build the express app + proxy (no listen)
scripts/
  electron-smoke.mjs  # headed CDP smoke: launches the app, asserts login screen + titlebar
build/
  icon.svg          # transparent rounded-tile source (Linux icon + runtime window icon)
  icon.png          # 1024² raster of icon.svg
  icon-mac.svg      # full-bleed gradient source (macOS squircle-masks the icon)
  icon.icns         # macOS bundle icon (full-bleed; avoids the "floating tile" look)
  icon.ico          # Windows multi-size icon (16→256; uses the transparent tile)
package.json        # "main": "electron/main.mjs", "build": { electron-builder config }
```

## Build & packaging

- **Bundler:** `electron-builder`.
- `"files"`: `dist/**`, `server/**`, `electron/**`, `package.json`.
- **Targets (Linux first):** AppImage + pacman (Arch-native) locally; deb built
  in CI. No code-signing required to distribute (optional GPG signing only if
  we later publish to an apt repo).
- **macOS:** dmg + zip, **unsigned** (dev + CI). Distribution needs signing +
  notarization — an Apple Developer ID cert (`CSC_LINK`/`CSC_KEY_PASSWORD` or a
  keychain identity) + `notarytool` credentials (`APPLE_ID`/
  `APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID`, or an App Store Connect API
  key), wired into CI via secrets (**blocked**). Until then Gatekeeper flags the
  app on other Macs (right-click → Open to launch).
- **Windows:** NSIS installer (`build:electron:win`), **unsigned**. Distribution
  needs an Authenticode cert (`CSC_LINK`/`CSC_KEY_PASSWORD`); until then
  SmartScreen warns on other machines. electron-builder cross-builds nsis from
  macOS (verified locally); CI runs it on `windows-latest` so the headed smoke
  exercises the real Windows binary.
- **CI:** a Linux GitHub Actions runner builds AppImage/deb/pacman (with `xvfb`
  for the headed smoke against the packaged build); macOS (`macos-15`) and
  Windows (`windows-latest`) runners follow it and attach their unsigned
  artifacts to the same GitHub Release.

### Release flow

- The **Electron Linux build** workflow runs only on pushes to the `release`
  branch (or on demand via the "Run workflow" / `workflow_dispatch` trigger) —
  commits to `main` are CI-silent. To produce a packaged build, bring main in:

  ```
  git push origin main:release
  ```

- On success the workflow **creates or updates a GitHub Release** tagged with
  the app version (e.g. `v0.0.0` today, read from `package.json`), with the
  AppImage, deb and pacman attached as **separate downloadable assets**. Bump
  `version` in `package.json` to get a new tag/release on the next build.
- The `--publish never` flag keeps `electron-builder` packaging-only; the
  release itself is published explicitly by a dedicated step
  (`softprops/action-gh-release`) with `permissions: contents: write`.

## Security model (v1)

Keep Electron defaults locked down: `contextIsolation: true`,
`nodeIntegration: false`, `sandbox: true`. The preload exposes exactly one
surface — `window.taskboard.setTitleBarOverlay` for theming the native
title-bar overlay — and nothing else: the PAT stays in the renderer connection
store and there is no connection-store IPC (that stays with v2's
`safeStorage` milestone).

## Custom title bar (Window Controls Overlay)

`titleBarStyle: 'hidden'` + `titleBarOverlay` hide the OS title-bar text area
while keeping the **native** window buttons (Linux support since Electron 30.2;
this is Electron 43). The renderer's `TitleBar` renders a drag strip
(`-webkit-app-region: drag`) in the freed space and themes the buttons by
sending its theme's `--surface`/`--text-muted` colors (as `#rrggbb`) over the
single IPC channel; it re-syncs when `data-theme` changes. In the plain web
build the bridge is absent and `TitleBar` renders nothing.

macOS difference: the traffic lights sit **top-left** (Windows/Linux put the
window buttons top-right), so `TitleBar` reads `platform` from the preload
bridge and applies a left inset (`pl-20`) on darwin to clear them. The app menu
is also macOS-specific: Linux/Windows keep no menu bar
(`Menu.setApplicationMenu(null)`), while macOS gets the minimal standard
template (`appMenu` + `editMenu` + `windowMenu`) so Cmd+C/V, Cmd+Q and
Cmd+M/W keep working.

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
- `build:electron:mac` — `npm run build && electron-builder --mac --publish never`
  (dmg + zip; signs if a Developer ID identity is in the keychain, else unsigned).
- `build:electron:mac:unsigned` — same, but forces `CSC_IDENTITY_AUTO_DISCOVERY=false`
  (deterministic unsigned; what CI runs).
- `build:electron:win` — `npm run build && electron-builder --win nsis --publish never`
  (NSIS installer; cross-builds from macOS too).
- `pack:electron` — `npm run build && electron-builder --dir` (unpacked, fast).
- `test:electron` — headed smoke (`scripts/electron-smoke.mjs`); run under
  `xvfb-run` in CI on Linux, plain on macOS.

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
   `libcrypt.so.1`, which Arch lacks). CI is green end-to-end; a successful
   `release`-branch build also publishes all three as a GitHub Release with
   separate download links (✅ verified).
5. Custom title bar verified on this machine (`dev:electron`): drag strip
   renders, native min/max/close buttons stay, overlay colors follow the theme.
6. Browser-style zoom verified on this machine: Ctrl/Cmd+= / Ctrl/Cmd+- /
   Ctrl+0 and Ctrl+wheel zoom the page; the level survives relaunches (read
   from `userData/zoom.json`, applied on load; unit-tested in `zoom.mjs`).
7. **macOS** (`build:electron:mac:unsigned` on this Mac, arm64): dmg + zip
   built; the headed smoke passes against the packaged
   `release/mac-arm64/ado-taskboard.app`; the app menu (appMenu/editMenu/
   windowMenu) and the traffic-light left inset render as expected. ✅ verified
   locally; CI builds + smokes it on a macOS runner.
8. **Windows** (`build:electron:win`): NSIS installer built + smokes against the
   packaged `release/win-unpacked/ado-taskboard.exe` in CI on `windows-latest`.
   The custom title bar / Window Controls Overlay and the smoke's
   platform-correct binary resolution are already cross-platform; no code
   change was needed beyond the `win` config + `.ico`.

> Local build gotcha: electron-builder's dependency collector runs `npm list`
> against `node_modules`; a symlinked worktree `node_modules` makes it report
> broken/versionless entries and silently drop transitive deps. Build packages
> from a real install (`npm ci`) — CI always does.

## Open decisions / blockers

1. **A vs B** — **resolved**: A (renderer-PAT) is implemented as v1; B
   (`safeStorage`/main-PAT) is the v2 follow-up.
2. **Auto-update** (`electron-updater`) — later; needs a signed release feed.
3. Confirm the **HTTP-relay** approach (vs custom protocol) — recommended here.
4. **macOS + Windows signing** still gated on Apple/Microsoft credentials — the
   unsigned macOS dmg/zip and Windows NSIS exe are shipped (CI), but until a
   Developer ID cert + `notarytool` creds (macOS) and an Authenticode cert
   (Windows) are wired into CI secrets, releases hit Gatekeeper/SmartScreen on
   other machines.
5. **Icon** — **resolved**: `build/icon.svg` (kanban-mark on an indigo→violet
   rounded tile) is rasterized to `build/icon.png` (1024²); electron-builder
   picks it up for AppImage/deb/pacman (`linux.icon`) and `main.mjs` sets it on
   the BrowserWindow (bundled in the asar via `build` "files"). macOS uses the
   full-bleed `build/icon.icns` (rasterized from `build/icon-mac.svg`) so the
   system's squircle mask applies cleanly.

Linux has no signing blocker, so this is no longer `needs-refinement` for the
Linux target — implementation can proceed and be verified on this machine.
