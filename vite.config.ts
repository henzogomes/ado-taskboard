/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { buildAuthHeader } from './src/proxy/auth.ts'
import { sanitizeOrg } from './src/connections/sanitize.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'ADO_') // load ADO_* from .env (server-side fallback)
  const base = env.ADO_BASE_URL || 'https://dev.azure.com'
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
          // Non-secret runtime env → JSON for the client bootstrap. PAT excluded.
          server.middlewares.use('/api/config/bootstrap', (_req, res) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                org: env.ADO_ORG || '',
                project: env.ADO_PROJECT || '',
                team: env.ADO_TEAM || '',
                me: env.ADO_ME || '',
              }),
            )
          })
          server.middlewares.use(
            '/api/ado',
            createProxyMiddleware({
              target: base, // host only; org appended per request below
              changeOrigin: true,
              pathRewrite: { '^/api/ado': '' },
              router: (req) => `${base}/${sanitizeOrg(req.headers['x-ado-org']) || env.ADO_ORG || ''}`,
              on: {
                proxyReq: (proxyReq, req) => {
                  const pat = req.headers['x-ado-pat'] || env.ADO_PAT
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
      // org/project/team/me are runtime now (per Task 3); never define ADO_PAT.
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
