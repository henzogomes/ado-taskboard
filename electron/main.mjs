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
  });
  win.loadURL(url);
  return win;
}

// Boot the relay on an ephemeral 127.0.0.1 port. dist/ ships beside
// electron/ (and server/) in the packaged app, so resolve it relative to this
// module — works both unpackaged and inside the asar.
async function bootstrap() {
  const distDir = path.join(__dirname, '..', 'dist');
  const server = createServer({ distDir });

  const listener = server.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    listener.once('listening', resolve);
    listener.once('error', reject);
  });

  const { port } = listener.address();
  httpServer = listener;
  return `http://127.0.0.1:${port}`;
}

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
