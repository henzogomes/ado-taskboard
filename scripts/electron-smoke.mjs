// scripts/electron-smoke.mjs
//
// Headed smoke test for the Electron build: launches the app (the unpackaged
// `electron .` build by default, or any binary via $ELECTRON_SMOKE_BIN, e.g. a
// packaged build) with a remote-debugging port, connects over the DevTools
// Protocol, and asserts the renderer actually loads the app through the local
// relay — either the login screen (fresh profile) or the board (a profile that
// already has a persisted connection). Exits non-zero on failure.
//
// Needs a display — run under `xvfb-run` in CI. Uses only Node built-ins
// (global WebSocket), no Playwright.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (typeof WebSocket === 'undefined') {
  throw new Error('global WebSocket is required — run with Node 22 or newer');
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const electronBin =
  process.env.ELECTRON_SMOKE_BIN || path.join(root, 'node_modules', 'electron', 'dist', 'electron');
const DEBUG_PORT = 9333;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Poll /json until the page target appears (the window opens async).
async function waitForPageTarget(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json`, 1000);
      const page = targets.find((t) => t.type === 'page' && t.url.includes('127.0.0.1'));
      if (page) return page;
    } catch {
      // Debug endpoint not up yet.
    }
    await sleep(300);
  }
  throw new Error('timed out waiting for Electron page target');
}

function cdpEvaluate(ws, expression) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e9);
    const timer = setTimeout(() => reject(new Error('CDP evaluate timeout')), 5000);
    const onMessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== id) return;
      clearTimeout(timer);
      ws.removeEventListener('message', onMessage);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result.result.value);
    };
    ws.addEventListener('message', onMessage);
    ws.send(
      JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: { expression, returnByValue: true },
      }),
    );
  });
}

async function main() {
  // The unpackaged electron binary takes the app dir as its first arg; a
  // packaged binary (ELECTRON_SMOKE_BIN) takes none.
  const args = process.env.ELECTRON_SMOKE_BIN
    ? [`--remote-debugging-port=${DEBUG_PORT}`]
    : [root, `--remote-debugging-port=${DEBUG_PORT}`];
  // Chromium's setuid sandbox fails in environments that can't use it — when
  // running as root, or in CI containers where the chrome-sandbox SUID helper
  // can't be configured (GitHub Actions, Docker without user namespaces).
  // Relax only there; the shipped app and local runs keep the sandbox on, and
  // the window itself still sets sandbox: true.
  if (
    (typeof process.getuid === 'function' && process.getuid() === 0) ||
    process.env.CI
  ) {
    args.push('--no-sandbox');
  }

  const child = spawn(electronBin, args, { stdio: 'inherit' });
  try {
    const page = await waitForPageTarget(30000);
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });

    // The app renders after React mounts; poll briefly. Two valid end states:
    // a fresh profile shows the login screen ("View demo"), while a profile
    // with a persisted connection boots straight into the board ("Current
    // sprint" header). Either proves the relay + app loaded.
    const deadline = Date.now() + 15000;
    let bodyText = '';
    while (Date.now() < deadline) {
      bodyText = await cdpEvaluate(ws, 'document.body && document.body.innerText');
      if (bodyText && (bodyText.includes('View demo') || bodyText.includes('Current sprint'))) break;
      await sleep(500);
    }

    // Desktop-mode assertions: the preload bridge is present, the custom
    // title-bar strip actually rendered (only exists in the Electron build),
    // and the relay is on the fixed port — that stable origin is what lets
    // localStorage (connection store/PAT, theme, cache) survive relaunches.
    // Keep RELAY_PORT in sync with electron/main.mjs.
    const desktop = await cdpEvaluate(
      ws,
      'Boolean(window.taskboard && window.taskboard.isDesktop && document.querySelector(\'[data-testid="titlebar"]\'))',
    );
    const relayPort = await cdpEvaluate(ws, 'location.port');

    ws.close();

    if (!bodyText || !(bodyText.includes('View demo') || bodyText.includes('Current sprint'))) {
      throw new Error(
        'app did not render (no login screen and no board) in renderer body: ' +
          (bodyText ? JSON.stringify(bodyText.slice(0, 300)) : '<empty>'),
      );
    }
    if (!desktop) {
      throw new Error('desktop bridge/titlebar not present — app not running in Electron mode');
    }
    if (relayPort !== '5320') {
      throw new Error(`relay not on the stable origin (port ${relayPort}) — persistence broken`);
    }
    console.log(
      'PASS: Electron renderer loaded the app (login screen or persisted board); ' +
        'custom title bar visible, relay on stable port.',
    );
  } finally {
    child.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
