import { useState } from 'react'
import type { FormEvent } from 'react'
import { addConnection } from './store'
import { DEMO_CONNECTION } from '../demo/connection'

interface LoginScreenProps {
  /** Optional cancel affordance — shown as a "Cancel" button when the screen is
   *  used as an overlay (e.g. "+ Add connection…"), omitted on the first-run gate. */
  onCancel?: () => void
}

/**
 * Connection setup / login form. Validate-on-add: before saving, a test call
 * through the proxy (`GET /api/ado/_apis/projects/{project}`) confirms the
 * org + PAT actually work, so a bad token never gets stored. On success the
 * connection is added and activated (via `addConnection`), which flips `App`'s
 * `active === null` gate and renders the board.
 */
export function LoginScreen({ onCancel }: LoginScreenProps) {
  const [label, setLabel] = useState('')
  const [org, setOrg] = useState('')
  const [project, setProject] = useState('')
  const [pat, setPat] = useState('')
  const [team, setTeam] = useState('')
  const [me, setMe] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [validating, setValidating] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setValidating(true)
    try {
      const headers: Record<string, string> = { 'X-ADO-Org': org }
      if (pat) headers['X-ADO-PAT'] = pat
      let response: Response
      try {
        response = await fetch(
          '/api/ado/_apis/projects/' + encodeURIComponent(project) + '?api-version=7.1',
          { headers },
        )
      } catch {
        // A thrown fetch is a transport failure (proxy down / offline), NOT an
        // auth/404 — keep it distinct from an HTTP error status.
        setError("Can't reach the proxy — is the dev server running?")
        return
      }
      if (response.ok) {
        addConnection({
          id: crypto.randomUUID(),
          label: label || `${org} / ${project}`,
          org,
          project,
          team: team || undefined,
          me: me || undefined,
          pat,
        })
        return
      }
      if (response.status === 401) {
        setError('PAT rejected (check scope: Work Items Read/Write, Project Read).')
      } else if (response.status === 404) {
        setError('Project not found under this org — check the org and project names.')
      } else {
        setError(`Validation failed (ADO ${response.status}).`)
      }
    } finally {
      setValidating(false)
    }
  }

  const inputClass =
    'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-content placeholder-content-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-ring'
  const labelClass = 'mb-1 block text-sm font-medium text-content'

  return (
    <div className="flex flex-1 items-center justify-center overflow-auto p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-lg border border-line bg-surface p-6 shadow-sm"
      >
        <h2 className="mb-1 text-lg font-semibold text-content">
          Connect to Azure DevOps
        </h2>
        <p className="mb-4 text-xs text-content-muted">
          Enter your ADO organization, project, and a Personal Access Token. The PAT is stored in
          this browser (localStorage) — acceptable for a local single-user tool — and sent with each
          request; it is the only way in.
        </p>

        {error && (
          <p
            role="alert"
            className="mb-4 rounded-md border border-danger bg-danger-muted px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        )}

        <div className="space-y-3">
          <div>
            <label htmlFor="conn-label" className={labelClass}>
              Label <span className="font-normal text-content-subtle">(optional)</span>
            </label>
            <input
              id="conn-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={org && project ? `${org} / ${project}` : 'My board'}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="conn-org" className={labelClass}>
              Organization
            </label>
            <input
              id="conn-org"
              type="text"
              required
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              placeholder="contoso"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="conn-project" className={labelClass}>
              Project
            </label>
            <input
              id="conn-project"
              type="text"
              required
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder="MyProject"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="conn-pat" className={labelClass}>
              Personal Access Token
            </label>
            <input
              id="conn-pat"
              type="password"
              required
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              autoComplete="off"
              placeholder="••••••••"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="conn-team" className={labelClass}>
                Team <span className="font-normal text-content-subtle">(optional)</span>
              </label>
              <input
                id="conn-team"
                type="text"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="conn-me" className={labelClass}>
                Me <span className="font-normal text-content-subtle">(optional)</span>
              </label>
              <input
                id="conn-me"
                type="text"
                value={me}
                onChange={(e) => setMe(e.target.value)}
                placeholder="you@company.com"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="submit"
            disabled={validating}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent disabled:opacity-50"
          >
            {validating ? 'Validating…' : 'Add connection'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-content hover:bg-surface-raised"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 text-xs text-content-muted">
            Just want to look around? Explore a synthetic board — no ADO, no PAT.
          </p>
          <button
            type="button"
            onClick={() => addConnection(DEMO_CONNECTION)}
            className="rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-content hover:bg-surface-raised"
          >
            View demo
          </button>
        </div>
      </form>
    </div>
  )
}
