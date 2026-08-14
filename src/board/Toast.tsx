export interface ToastProps {
  message: string
  /** Present only when there's something meaningful to undo. */
  onUndo?: () => void
  onDismiss: () => void
}

/** A small bottom-corner notification: a message, an optional Undo action, and a dismiss (×). */
export function Toast({ message, onUndo, onDismiss }: ToastProps) {
  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-md border border-line bg-surface px-4 py-3 text-sm shadow-lg"
    >
      <span className="text-content">{message}</span>
      {onUndo && (
        <button
          type="button"
          onClick={onUndo}
          className="font-medium text-accent hover:underline"
        >
          Undo
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-content-subtle hover:text-content-muted"
      >
        ×
      </button>
    </div>
  )
}
