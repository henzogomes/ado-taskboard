import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))

/** Reads a committed JSON fixture as a raw string (for `route.fulfill`). */
function fixture(name: string): string {
  return readFileSync(join(here, 'fixtures', `${name}.json`), 'utf8')
}

/**
 * Routes every `/api/ado/**` request to the matching committed fixture,
 * keyed by URL substring. Order matters: `workitemsbatch` is checked before
 * the single `workitems/<id>` detail regex. Returns 404 for anything the load
 * path doesn't touch, so an unexpected new call fails loudly rather than
 * silently 200-ing with the wrong shape.
 */
export async function mockAdo(page: Page): Promise<void> {
  await page.route('**/api/ado/**', async (route) => {
    const url = route.request().url()
    const pick = (): string | null => {
      if (url.includes('/backlogs')) return 'backlogs'
      if (url.includes('/boards/')) return 'board'
      if (url.includes('/classificationnodes/iterations')) return 'iterations'
      if (url.includes('/wiql')) return 'wiql'
      if (url.includes('/workitemsbatch')) return 'workitemsbatch'
      if (url.includes('/wit/fields')) return 'fields'
      if (url.includes('/states')) return 'states'
      if (url.includes('/teams')) return 'teams'
      if (/\/workitems\/\d+/.test(url)) return 'workitem-detail'
      return null
    }
    const name = pick()
    if (!name) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
    await route.fulfill({ status: 200, contentType: 'application/json', body: fixture(name) })
  })
}

/** A single ready-to-use connection, seeded into localStorage before load so
 * the app skips the login gate and the bootstrap fetch (both keyed off an
 * empty connection list). `pat: ''` = dual-mode, but every call is mocked so
 * the proxy is never hit. */
const SEED_CONNECTIONS = {
  connections: [
    { id: 'e2e-conn', label: 'Demo', org: 'demo', project: 'Demo', team: 'Demo Team', me: 'me@demo', pat: '' },
  ],
  activeId: 'e2e-conn',
}

/** Seeds the active connection, installs the ADO mocks, and navigates to the
 * board — the shared arrange step for every smoke spec. */
export async function gotoBoard(page: Page): Promise<void> {
  await page.addInitScript((seed) => {
    localStorage.setItem('ado-taskboard-connections', JSON.stringify(seed))
  }, SEED_CONNECTIONS)
  await mockAdo(page)
  await page.goto('/')
}
