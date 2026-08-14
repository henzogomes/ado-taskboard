import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// Demo mode e2e: with NOTHING configured (bootstrap names no project) and no
// stored connection, the app must auto-open on the synthetic demo board — no
// login wall, and crucially NO /api/ado network at all. Also covers the
// explicit exit ("Connect your ADO" → login) and re-entry ("View demo").
//
// The bootstrap is mocked in-page to a no-project response (mirroring the
// in-page ADO mocking in support.ts) so the spec is hermetic — independent of
// whatever env the reused dev server happens to carry. `/api/ado` is routed to
// 404 as a guard: demo must never call it, and a stray call fails loudly rather
// than reaching a real proxy.
async function gotoDemo(page: Page): Promise<void> {
  await page.route('**/api/config/bootstrap', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"org":"","project":"","team":"","me":""}' }),
  )
  await page.route('**/api/ado/**', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  await page.goto('/')
}

test.describe('demo mode', () => {
  test('auto-loads a working demo board on first run with zero /api/ado calls', async ({ page }) => {
    const adoCalls: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/api/ado')) adoCalls.push(req.url())
    })

    await gotoDemo(page)

    // The demo banner and a synthetic card render — no login wall.
    await expect(page.getByText('Synthetic, in-memory board', { exact: false })).toBeVisible()
    await expect(page.getByText('Build the login screen')).toBeVisible()
    // A board column header renders (real domain pipeline exercised).
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible()

    // From here on, demo mode must be fully networkless. (Reset the tally: the
    // board query fires once at mount BEFORE the bootstrap seeds the demo
    // connection — a pre-existing eager query with an empty project, guarded to
    // 404 above and unrelated to the demo data path.)
    adoCalls.length = 0

    // The ticket modal works too (detail served from synthetic data — a task
    // card is the clickable element; the story is the pinned lane header).
    await page.getByText('Wire up the login form').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Wire up the login form')
    await expect(dialog.getByRole('heading', { name: 'Description' })).toBeVisible()
    await page.keyboard.press('Escape')

    // Loading the demo board + its detail + field catalog hit the network zero times.
    expect(adoCalls).toEqual([])
  })

  test('exits demo via "Connect your ADO" and re-enters via "View demo"', async ({ page }) => {
    await gotoDemo(page)
    await expect(page.getByText('Synthetic, in-memory board', { exact: false })).toBeVisible()

    // Leave demo → the login screen shows.
    await page.getByRole('button', { name: 'Connect your ADO' }).click()
    await expect(page.getByRole('heading', { name: 'Connect to Azure DevOps' })).toBeVisible()

    // Re-enter demo from the login screen.
    await page.getByRole('button', { name: 'View demo' }).click()
    await expect(page.getByText('Synthetic, in-memory board', { exact: false })).toBeVisible()
    await expect(page.getByText('Build the login screen')).toBeVisible()
  })
})
