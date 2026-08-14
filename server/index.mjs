// server/index.mjs
//
// Production server for the built app. Standalone on purpose (no imports
// from src/): it serves the Vite production build (dist/) and proxies
// /api/ado/* to Azure DevOps with the PAT attached server-side, mirroring
// the dev-time Vite proxy in vite.config.ts + src/proxy/auth.ts.
//
// The PAT is read from process.env at RUNTIME only. It is never baked into
// the client bundle and never touches the browser.
//
// Usage:
//   node server/index.mjs        (after `npm run build`)
//   npm run serve                (build + start, one command)
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

const {
  PORT = 5280,
  ADO_ORG,
  ADO_PAT,
  ADO_PROJECT,
  ADO_TEAM,
  ADO_ME,
  ADO_BASE_URL = 'https://dev.azure.com',
} = process.env;

if (!ADO_ORG || !ADO_PAT) {
  console.warn(
    'No ADO_ORG/ADO_PAT env fallback set — the app can still supply a browser connection.\n' +
      'Set them in .env (local) or as runtime environment variables (Docker) — see .env.example.',
  );
}

// Same header shape as src/proxy/auth.ts's buildAuthHeader — duplicated
// (not imported) so this server has no dependency on the client source tree.
function authHeader(pat) {
  return 'Basic ' + Buffer.from(':' + pat).toString('base64');
}

// Mirrors src/connections/sanitize.ts — inlined so this server stays
// independent of the client source tree. Accept only ADO org slugs
// (path segment); the host is never client-supplied.
function sanitizeOrg(v) {
  return typeof v === 'string' && /^[A-Za-z0-9._-]+$/.test(v) ? v : '';
}

const app = express();

// Proxy first, so /api/ado/* never falls through to the static/SPA handlers.
app.use(
  '/api/ado',
  createProxyMiddleware({
    target: ADO_BASE_URL, // host only; org appended per request via router
    changeOrigin: true,
    pathRewrite: { '^/api/ado': '' },
    router: (req) => `${ADO_BASE_URL}/${sanitizeOrg(req.headers['x-ado-org']) || ADO_ORG || ''}`,
    on: {
      proxyReq: (proxyReq, req) => {
        const pat = req.headers['x-ado-pat'] || ADO_PAT;
        if (pat) proxyReq.setHeader('Authorization', authHeader(String(pat)));
        proxyReq.removeHeader('x-ado-pat');
        proxyReq.removeHeader('x-ado-org');
      },
      // ADO doesn't reject a bad/expired PAT with a REST 401 on every
      // endpoint — some redirect (3xx) to an interactive VSSPS sign-in page
      // instead. A cross-origin redirect like that reaches the browser's
      // fetch as a CORS network error, not a clean status code, so callers
      // (AuthError, the login form's validate-on-add) could never detect
      // it. Collapse any such redirect into a same-origin 401 here instead.
      proxyRes: (proxyRes) => {
        if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode ?? 0)) {
          proxyRes.statusCode = 401;
          delete proxyRes.headers['location'];
        }
      },
    },
  }),
);

// Non-secret runtime env → JSON for the client bootstrap. PAT excluded.
// Registered before the SPA fallback so it isn't shadowed by index.html.
app.get('/api/config/bootstrap', (_req, res) =>
  res.json({
    org: ADO_ORG || '',
    project: ADO_PROJECT || '',
    team: ADO_TEAM || '',
    me: ADO_ME || '',
  }),
);

app.use(express.static(distDir));

// SPA fallback: any other GET request serves index.html so client-side
// routes work on refresh/direct-load. Implemented as plain middleware
// (rather than app.get('*', ...)) to stay agnostic of the installed
// Express major version's path-matching syntax.
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) {
    next();
    return;
  }
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ado-taskboard listening on http://localhost:${PORT}`);
});
