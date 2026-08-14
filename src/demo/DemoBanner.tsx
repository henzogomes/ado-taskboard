// The "Demo data" banner shown while demo mode is active: a clear label that
// the board is synthetic + in-memory, and a prominent "Connect your ADO" action
// that leaves demo (removes the demo connection) and returns to the login
// screen.

interface DemoBannerProps {
  /** Leaves demo mode — removes the demo connection so the login gate shows. */
  onConnect: () => void
}

export function DemoBanner({ onConnect }: DemoBannerProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-accent-ring bg-accent-muted px-4 py-2 text-sm">
      <span className="inline-flex items-center gap-1.5 font-medium text-content">
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 shrink-0 rounded-full bg-accent"
        />
        Demo data
      </span>
      <span className="text-content-muted">
        Synthetic, in-memory board — no connection to Azure DevOps. Changes stay in this browser.
      </span>
      <button
        type="button"
        onClick={onConnect}
        className="ml-auto rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent"
      >
        Connect your ADO
      </button>
    </div>
  )
}
