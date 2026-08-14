import { test, expect } from '@playwright/test'
import { gotoBoard } from './support'

// Mocked smoke suite: the board loads entirely from committed fixtures (see
// support.ts). Sprint 2 spans into the far future, so it is always the
// date-derived "current" sprint and renders auto-expanded; Sprint 1 stays
// collapsed. These four cover the load path, the ticket modal, search, and the
// iteration switch.

test.describe('board smoke', () => {
  test('board loads with columns and at least one card', async ({ page }) => {
    await gotoBoard(page)
    // A known board column header renders...
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible()
    // ...and a card from the auto-expanded current sprint.
    await expect(page.getByText('Story in Sprint Two')).toBeVisible()
    await expect(page.getByText('Wire up the login form')).toBeVisible()
  })

  test('clicking a card opens the ticket modal with dynamic detail fields', async ({ page }) => {
    await gotoBoard(page)
    await page.getByText('Wire up the login form').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Wire up the login form')
    // Detail body is discovered per field: the fixture's html Description field
    // renders under its display name (not a hardcoded pair).
    await expect(dialog.getByRole('heading', { name: 'Description' })).toBeVisible()
    await expect(dialog).toContainText('working login form')
  })

  test('search narrows the visible cards', async ({ page }) => {
    await gotoBoard(page)
    await expect(page.getByText('Add unit tests')).toBeVisible()
    await page.getByLabel('Search cards').fill('Wire')
    await expect(page.getByText('Wire up the login form')).toBeVisible()
    await expect(page.getByText('Add unit tests')).toHaveCount(0)
  })

  test('switching the iteration re-renders the board', async ({ page }) => {
    await gotoBoard(page)
    // The picker starts on the date-derived current sprint.
    const picker = page.getByRole('button', { name: /Iteration scope/i })
    await expect(picker).toContainText('Current sprint')
    await picker.click()
    await page.getByRole('menuitem', { name: 'Sprint 1' }).click()
    await expect(picker).toContainText('Sprint 1')
    // Board still renders after the scope change (fixtures are scope-agnostic).
    await expect(page.getByText('Story in Sprint Two')).toBeVisible()
  })
})
