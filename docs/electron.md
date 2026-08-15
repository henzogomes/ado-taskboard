# Electron desktop app — design spec

Status: **spec only** (no implementation yet). Tracks issue #3.

## Goal

Ship a standalone desktop build of the taskboard: macOS `.dmg` first, then
Linux (`AppImage`/`.deb`) and Windows (`nsis`). The app must behave identically
to the web app — same board, same drag-and-drop, same connection flow.

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
package.json        # "main": "electron/main.mjs", "build": { electron-builder config }
```

## Build & packaging

- **Bundler:** `electron-builder`.
- `"files"`: `dist/**`, `server/**`, `electron/**`, `package.json`.
- **Targets:** `mac` → `dmg` + `zip` (signed + notarized); later `linux`
  (`AppImage`, `deb`) and `win` (`nsis`).
- **Signing/notarization (macOS):** requires an Apple Developer ID Application
  cert + `notarytool` credentials (`APPLE_ID`, team id, app-specific password).
  **Blocked on credentials** — this is a hard external dependency.
- **CI:** a macOS GitHub Actions runner builds the `.dmg`; signing secrets via
  repo/org secrets; Windows/Linux artifacts from their own runners (or
  `electron-builder`'s cross-build where supported).

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

## Scripts (proposed)

- `dev:electron` — build once, then launch Electron against the dev server.
- `build:electron` — `npm run build && electron-builder --mac` (per-OS flag).

## Verification plan

1. `npm run build` → `dist/`, then `npx electron .` on the target OS.
2. Manual smoke with a throwaway PAT: login screen → connect → board loads →
   drag a card → Move menu → edit title/tags → post a comment → demo mode.
3. Assert the app still works as a plain web app (`npm run serve`) — no
   regression from the `createServer` extraction.
4. Packaged `.dmg` opens and runs on a clean macOS machine (Gatekeeper pass
   depends on notarization).

## Open decisions / blockers (why it's still `needs-refinement`)

1. **A vs B** (renderer-PAT vs `safeStorage`/main-PAT) — recommend A then B.
2. **Apple signing + notarization credentials** — not available; blocks a
   distributable `.dmg`.
3. **Auto-update** (`electron-updater`) — later; needs a signed release feed.
4. Confirm the **HTTP-relay** approach (vs custom protocol) — recommended here.

No code has been written; this spec is the "refinement" needed before
implementation can be verified end-to-end on a real macOS machine.
