import { defineConfig } from '@playwright/test'

// Mocked e2e: every `/api/ado/**` call is intercepted in-page (see
// e2e/support.ts → mockAdo), so the dev server never reaches real ADO and no
// PAT is needed. The proxy is a pure relay with no server-side config, so there
// is nothing to configure here.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:5280' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5280',
    reuseExistingServer: !process.env.CI,
  },
})
