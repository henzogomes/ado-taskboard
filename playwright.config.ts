import { defineConfig } from '@playwright/test'

// Mocked e2e: every `/api/ado/**` call is intercepted in-page (see
// e2e/support.ts → mockAdo), so the dev server never reaches real ADO and no
// PAT is needed. The env below is a dummy so the proxy — even if it were hit —
// carries nothing real or secret.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:5280' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5280',
    reuseExistingServer: !process.env.CI,
    env: { ADO_ORG: '', ADO_PROJECT: '', ADO_TEAM: '', ADO_ME: '', ADO_PAT: 'e2e-dummy' },
  },
})
