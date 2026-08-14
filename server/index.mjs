// server/index.mjs
//
// Production server for the built app. Standalone on purpose (no imports
// from src/): it serves the Vite production build (dist/) and proxies
// /api/ado/* to Azure DevOps, mirroring the dev-time Vite proxy in
// vite.config.ts + src/proxy/auth.ts.
//
// Pure relay: org + PAT come ONLY from the active connection's X-ADO-Org /
// X-ADO-PAT headers, per request. There is no server-side/.env ADO config,
// no fallback PAT, and no bootstrap endpoint.
//
// Usage:
//   node server/index.mjs        (after `npm run build`)
//   npm run serve                (build + start, one command)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

// A port is not ADO config — keep reading it from the environment.
const PORT = process.env.PORT || 5280;

// ADO host only — org is appended per request from the X-ADO-Org header.
const ADO_BASE_URL = 'https://dev.azure.com';

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
    router: (req) => `${ADO_BASE_URL}/${sanitizeOrg(req.headers['x-ado-org'])}`,
    on: {
      proxyReq: (proxyReq, req) => {
        const pat = req.headers['x-ado-pat'];
        // No PAT header → don't set Authorization; ADO returns 401,
        // which the app surfaces as an auth error.
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
