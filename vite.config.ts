import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { buildAuthHeader } from './src/proxy/auth.ts'
import { sanitizeOrg } from './src/connections/sanitize.ts'

// ADO host only — org is appended per request from the connection's
// X-ADO-Org header. There is no server-side/.env ADO config.
const ADO_BASE_URL = 'https://dev.azure.com'

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [
      react(),
      {
        name: 'ado-proxy',
        // Vite's declarative `server.proxy` is a thin wrapper over the raw
        // `http-proxy` package, which has NO per-request `router` support
        // (that's an http-proxy-middleware-only feature). A per-request org
        // needs a per-request target, so the /api/ado proxy is mounted here
        // directly via http-proxy-middleware instead — the same library and
        // config shape server/index.mjs uses in prod, where it works.
        configureServer(server) {
          // Pure relay: org + PAT come ONLY from the active connection's
          // X-ADO-Org / X-ADO-PAT headers. No .env, no fallback, no bootstrap.
          server.middlewares.use(
            '/api/ado',
            createProxyMiddleware({
              target: ADO_BASE_URL, // host only; org appended per request below
              changeOrigin: true,
              pathRewrite: { '^/api/ado': '' },
              router: (req) => `${ADO_BASE_URL}/${sanitizeOrg(req.headers['x-ado-org'])}`,
              on: {
                proxyReq: (proxyReq, req) => {
                  const pat = req.headers['x-ado-pat']
                  // No PAT header → don't set Authorization; ADO returns 401,
                  // which the app surfaces as an auth error.
                  if (pat) proxyReq.setHeader('Authorization', buildAuthHeader(String(pat)))
                  proxyReq.removeHeader('x-ado-pat')
                  proxyReq.removeHeader('x-ado-org')
                },
                // ADO doesn't reject a bad/expired PAT with a REST 401 on
                // every endpoint — some redirect (3xx) to an interactive
                // VSSPS sign-in page instead. A cross-origin redirect like
                // that reaches the browser's fetch as a CORS network error,
                // not a clean status code, so callers (AuthError, the login
                // form's validate-on-add) could never detect it. Collapse
                // any such redirect into a same-origin 401 here instead.
                proxyRes: (proxyRes) => {
                  if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode ?? 0)) {
                    proxyRes.statusCode = 401
                    delete proxyRes.headers['location']
                  }
                },
              },
            }),
          )
        },
      },
    ],
    define: {
      // org/project/team/me are runtime (from the active connection); there is
      // no build-time or server-side ADO config to define.
    },
    server: {
      // Off Vite's default 5173 to avoid clashing with other local Vite apps.
      port: 5280,
      strictPort: false,
    },
    preview: { port: 5280 },
    test: {
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
      globals: true,
      // e2e/ holds Playwright specs (also named *.spec.ts); Vitest must not
      // collect them — Playwright's test.describe() throws under Vitest.
      exclude: [...configDefaults.exclude, 'e2e/**'],
    },
  }
})
