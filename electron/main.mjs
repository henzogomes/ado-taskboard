// electron/main.mjs
//
// Electron main process — v1 of the desktop build ("renderer holds the PAT").
// Serves the built web app through the exact same Express relay as the prod
// server (createServer from server/createServer.mjs) on a fixed localhost port
// (stable origin ⇒ localStorage persists across launches), then loads it in a
// locked-down BrowserWindow. No custom protocol, no Node APIs in the renderer:
// the app runs identically to the web app — its own login/connection flow and
// demo mode included.
//
// Custom title bar via the Window Controls Overlay: the OS title-bar content
// is hidden but the NATIVE min/max/close buttons stay, and the renderer draws
// its own drag strip (TitleBar) in the freed space. The only IPC is the
// renderer telling the overlay's native controls which theme colors to use.
//
// Browser-style zoom (Ctrl/Cmd+=, Ctrl/Cmd+-, Ctrl+0, Ctrl+wheel) is handled
// in the main process and the level persists across launches — see zoom.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import { createServer } from '../server/createServer.mjs';
import { clampZoomLevel, zoomDeltaForInput, zoomDeltaForWheel } from './zoom.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Keep the browser on the strict side of Electron defaults. The web app needs
// no Node APIs in the renderer; the preload only exposes the one-window
// taskboard bridge (see preload.cjs) for theming the native title-bar overlay.
const webPreferences = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  preload: path.join(__dirname, 'preload.cjs'),
};

let httpServer = null;

// `#rrggbb` only — the only input the renderer may send for overlay theming.
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

// Zoom level persistence: a tiny JSON next to the app's profile data (not the
// web app's localStorage, which is renderer-scoped and reset on wipe). Written
// debounced on change, read once at startup and re-applied on each load.
function zoomFile() {
  return path.join(app.getPath('userData'), 'zoom.json');
}

let zoomSaveTimer = null;
function persistZoomLevel(level) {
  clearTimeout(zoomSaveTimer);
  zoomSaveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(zoomFile(), JSON.stringify({ level }));
    } catch (err) {
      console.warn('[electron] failed to persist zoom level:', err.message);
    }
  }, 400);
}

function loadZoomLevel() {
  try {
    const { level } = JSON.parse(fs.readFileSync(zoomFile(), 'utf8'));
    if (typeof level === 'number' && Number.isFinite(level)) return clampZoomLevel(level);
  } catch {
    // Missing/corrupt file: fall through to the default zoom.
  }
  return 0;
}

function applyZoom(win, level) {
  const clamped = clampZoomLevel(level);
  win.webContents.setZoomLevel(clamped);
  persistZoomLevel(clamped);
}

function createWindow(url, initialZoomLevel) {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    // Window Controls Overlay: hide the OS title-bar text area, keep the
    // native window buttons (min/max/close). The renderer's TitleBar draws the
    // drag strip and themes the buttons via the `window:set-title-bar-overlay`
    // IPC below. Initial colors are replaced the moment the renderer mounts.
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#ffffff',
      symbolColor: '#374151',
      height: 32,
    },
    webPreferences,
    // App icon: packaged `build/icon.png` ships inside the asar (listed in
    // package.json "files"), so the same path works dev and packaged.
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
  });

  // Browser-style zoom. Keyboard: Ctrl/Cmd+= / Ctrl/Cmd+- / Ctrl+0. Wheel:
  // Ctrl+scroll zooms instead of scrolling the page. Both map through the pure
  // helpers in zoom.mjs, which return null when the input is not a zoom
  // gesture — only then is the event left alone. Only keyDown counts: reacting
  // to keyUp too would double-step every press.
  win.webContents.on('before-input-event', (event, input) => {
    let delta = null;
    if (input.type === 'mouseWheel') {
      delta = zoomDeltaForWheel(input);
    } else if (input.type === 'keyDown') {
      delta = zoomDeltaForInput(input);
    }
    if (delta === null) return;
    event.preventDefault();
    const level = delta === 0 ? 0 : win.webContents.getZoomLevel() + delta;
    applyZoom(win, level);
  });

  // Re-apply the persisted level once the page is ready (covers the initial
  // load and any in-app navigation that resets zoom).
  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomLevel(initialZoomLevel);
  });

  win.loadURL(url);
  return win;
}

// Fixed relay port. The renderer's origin (scheme+host+port) is what
// localStorage is partitioned by, so an ephemeral port meant a fresh origin —
// and empty storage — on every launch (connection store/PAT, theme, and query
// cache all reset). A stable port keeps them across launches. If the port is
// taken (stray process, another instance racing the lock), fall back to an
// ephemeral port: the app still works, it just won't persist that session.
const RELAY_HOST = '127.0.0.1';
const RELAY_PORT = 5320;

function listen(server, port) {
  return new Promise((resolve, reject) => {
    const listener = server.listen(port, RELAY_HOST);
    listener.once('listening', () => resolve(listener));
    listener.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        listener.close();
        reject(err);
      } else {
        reject(err);
      }
    });
  });
}

// Boot the relay on the fixed localhost port (see RELAY_PORT above), falling
// back to an ephemeral port if it's unavailable. dist/ ships beside electron/
// (and server/) in the packaged app, so resolve it relative to this module —
// works both unpackaged and inside the asar.
async function bootstrap() {
  const distDir = path.join(__dirname, '..', 'dist');
  const server = createServer({ distDir });

  let listener;
  try {
    listener = await listen(server, RELAY_PORT);
  } catch (err) {
    console.warn(
      `[electron] relay port ${RELAY_PORT} unavailable (${err.code}); ` +
        'falling back to an ephemeral port — this session will not persist ' +
        'credentials/theme/cache',
    );
    listener = await listen(server, 0);
  }

  const { port } = listener.address();
  httpServer = listener;
  return `http://${RELAY_HOST}:${port}`;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // Second launch: focus the existing window instead of starting a duplicate
  // (which would otherwise race for the fixed relay port and land on an
  // ephemeral one). Standard single-window desktop behaviour.
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    // Application menu. The taskboard is a single-window app with no native-menu
    // affordances — the in-app UI covers everything — so on Linux/Windows there
    // is no menu bar at all. On macOS, however, removing the menu entirely also
    // removes the app menu (About/Hide/Quit) and the Edit/Window menus that own
    // Cmd+C/V/X, Cmd+Q, Cmd+M/W — so give macOS the minimal standard template
    // (roles fill in the app name, standard shortcuts, and window commands).
    const isMac = process.platform === 'darwin';
    if (isMac) {
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]),
      );
    } else {
      Menu.setApplicationMenu(null);
    }

    // Keep the native title-bar buttons in sync with the active app theme. The
    // renderer sends `#rrggbb` values only (validated), resolved from its theme
    // tokens; there is no other renderer→main channel.
    ipcMain.handle('window:set-title-bar-overlay', (event, opts) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      // macOS has no Window Controls Overlay: its traffic lights are native and
      // unthemeable, so `setTitleBarOverlay` does not exist there — no-op.
      if (!win || typeof win.setTitleBarOverlay !== 'function') return;
      if (
        typeof opts !== 'object' ||
        opts === null ||
        typeof opts.color !== 'string' ||
        !HEX_COLOR_RE.test(opts.color) ||
        typeof opts.symbolColor !== 'string' ||
        !HEX_COLOR_RE.test(opts.symbolColor)
      ) {
        return;
      }
      win.setTitleBarOverlay({ color: opts.color, symbolColor: opts.symbolColor });
    });

    const url = await bootstrap();
    const initialZoomLevel = loadZoomLevel();
    createWindow(url, initialZoomLevel);

    // macOS convention: re-create a window when the dock icon is clicked.
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(url, initialZoomLevel);
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('will-quit', () => {
    if (httpServer) httpServer.close();
  });
}
