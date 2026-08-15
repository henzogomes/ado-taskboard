// electron/main.mjs
//
// Electron main process — v1 of the desktop build ("renderer holds the PAT").
// Serves the built web app through the exact same Express relay as the prod
// server (createServer from server/createServer.mjs) on an ephemeral localhost
// port, then loads it in a locked-down BrowserWindow. No custom protocol, no
// preload, no Node APIs in the renderer: the app runs identically to the web
// app — its own login/connection flow and demo mode included.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, Menu } from 'electron';
import { createServer } from '../server/createServer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Keep the browser on the strict side of Electron defaults. The web app needs
// no Node APIs in the renderer, so v1 ships with no preload script.
const webPreferences = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
};

let httpServer = null;

function createWindow(url) {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
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
