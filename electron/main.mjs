// electron/main.mjs
//
// Electron main process — v1 of the desktop build ("renderer holds the PAT").
// Serves the built web app through the exact same Express relay as the prod
// server (createServer from server/createServer.mjs) on an ephemeral localhost
// port, then loads it in a locked-down BrowserWindow. No custom protocol, no
// Node APIs in the renderer: the app runs identically to the web app — its own
// login/connection flow and demo mode included.
//
// Custom title bar via the Window Controls Overlay: the OS title-bar content
// is hidden but the NATIVE min/max/close buttons stay, and the renderer draws
// its own drag strip (TitleBar) in the freed space. The only IPC is the
// renderer telling the overlay's native controls which theme colors to use.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import { createServer } from '../server/createServer.mjs';

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

function createWindow(url) {
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
    // No menu bar (File/Edit/View/Window): the taskboard is a single-window app
    // with no native-menu affordances — the in-app UI covers everything. Kept
    // removed across platforms; a minimal macOS app menu is deferred with the
    // macOS milestone.
    Menu.setApplicationMenu(null);

    // Keep the native title-bar buttons in sync with the active app theme. The
    // renderer sends `#rrggbb` values only (validated), resolved from its theme
    // tokens; there is no other renderer→main channel.
    ipcMain.handle('window:set-title-bar-overlay', (event, opts) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return;
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
    createWindow(url);

    // macOS convention: re-create a window when the dock icon is clicked.
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(url);
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('will-quit', () => {
    if (httpServer) httpServer.close();
  });
}
