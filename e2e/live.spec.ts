import { test, expect } from '@playwright/test'

// A read-only LIVE smoke test, gated on ADO_* env vars (set in CI from repo
// secrets; see .github/workflows/live-smoke.yml). Unlike the mocked suite
// (support.ts → mockAdo), this spec does NOT intercept /api/ado — it seeds a
// real connection (org/project/PAT) into localStorage and loads the board
// through the dev proxy, so genuine ADO responses are parsed and rendered.
//
// Read-only by design: it never PATCHes/moves a work item, so it cannot mutate
// a real board. Its value is catching API drift (schema changes, preview-version
// breakage, field renames) on the load + level-discovery path.

const ORG = process.env.ADO_ORG ?? ''
const PROJECT = process.env.ADO_PROJECT ?? ''
const TEAM = process.env.ADO_TEAM ?? ''
const PAT = process.env.ADO_PAT ?? ''

const configured = ORG !== '' && PROJECT !== '' && PAT !== ''

test.describe('live smoke (reads a real board)', () => {
  test.skip(!configured, 'Set ADO_ORG, ADO_PROJECT, and ADO_PAT (optional ADO_TEAM) to run.')

  test('loads a board, discovers levels, and parses work items without error', async ({ page }) => {
    await page.addInitScript(
      ({ org, project, team, pat }) => {
        localStorage.setItem(
          'ado-taskboard-connections',
          JSON.stringify({
            connections: [{ id: 'live-conn', label: 'Live', org, project, team: team || undefined, pat }],
            activeId: 'live-conn',
          }),
        )
      },
      { org: ORG, project: PROJECT, team: TEAM, pat: PAT },
    )

    await page.goto('/')

    // A bad/expired PAT causes the app to drop the connection and fall to the
    // login screen; a schema/parse error paints a red "Failed to load board"
    // banner. Assert neither happened — i.e. the board actually loaded.
    await expect(page.getByText('Connect to Azure DevOps')).toHaveCount(0)
    await expect(page.getByText(/Failed to load board/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible()
    // Data landed: the header stamp flips from "Not loaded yet" to "Last updated …".
    await expect(page.getByText(/Last updated/)).toBeVisible()
  })
})
