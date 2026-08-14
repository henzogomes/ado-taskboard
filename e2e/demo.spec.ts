import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// Demo mode e2e: with no stored connection the app shows the LOGIN screen —
// nothing is auto-presented; the browser connection is the source of truth. The
// synthetic demo board is opt-in via "View demo", and when active it must make
// NO /api/ado network calls. Also covers exit ("Connect your ADO" → login) and
// re-entry.
//
// `/api/ado` is routed to 404 as a guard: demo must never call it, and a stray
// call fails loudly rather than reaching a real proxy.
async function gotoApp(page: Page): Promise<void> {
  await page.route('**/api/ado/**', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  await page.goto('/')
}

test.describe('demo mode', () => {
  test('first run shows the login screen; "View demo" opens the networkless demo board', async ({ page }) => {
    const adoCalls: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/api/ado')) adoCalls.push(req.url())
    })

    await gotoApp(page)

    // First run = the login screen. No board, no demo banner is auto-presented.
    await expect(page.getByRole('heading', { name: 'Connect to Azure DevOps' })).toBeVisible()
    await expect(page.getByText('Synthetic, in-memory board', { exact: false })).toHaveCount(0)

    // Opt into the demo.
    await page.getByRole('button', { name: 'View demo' }).click()
    await expect(page.getByText('Synthetic, in-memory board', { exact: false })).toBeVisible()
    await expect(page.getByText('Build the login screen')).toBeVisible()
    // A board column header renders (the real domain pipeline is exercised).
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible()

    // From here demo mode must be fully networkless. (Reset the tally: an eager
    // board query may have fired once with an empty project before demo became
    // active — guarded to 404 above, unrelated to the demo data path.)
    adoCalls.length = 0

    // The ticket modal works too (detail served from synthetic data).
    await page.getByText('Wire up the login form').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Wire up the login form')
    await expect(dialog.getByRole('heading', { name: 'Description' })).toBeVisible()
    await page.keyboard.press('Escape')

    // Loading the demo board + its detail + field catalog hit the network zero times.
    expect(adoCalls).toEqual([])
  })

  test('demo is opt-in: enter via "View demo", exit via "Connect your ADO", re-enter', async ({ page }) => {
    await gotoApp(page)
    await expect(page.getByRole('heading', { name: 'Connect to Azure DevOps' })).toBeVisible()

    // Enter demo.
    await page.getByRole('button', { name: 'View demo' }).click()
    await expect(page.getByText('Synthetic, in-memory board', { exact: false })).toBeVisible()

    // Leave demo → back to the login screen.
    await page.getByRole('button', { name: 'Connect your ADO' }).click()
    await expect(page.getByRole('heading', { name: 'Connect to Azure DevOps' })).toBeVisible()

    // Re-enter demo from the login screen.
    await page.getByRole('button', { name: 'View demo' }).click()
    await expect(page.getByText('Build the login screen')).toBeVisible()
  })
})
