import { useEffect } from 'react'
import { isDesktop, overlayColors } from './desktop'

// src/titlebar/TitleBar.tsx
//
// The custom title-bar strip rendered only inside the Electron desktop build
// (Window Controls Overlay). The OS title-bar text area is hidden and the
// native min/max/close buttons float top-right; this strip occupies the freed
// space as a drag region and themes those buttons to match the active theme.
// In the plain web app it renders nothing.

export function TitleBar() {
  const bridge = window.taskboard

  useEffect(() => {
    if (!bridge?.setTitleBarOverlay) return
    const sync = () => {
      const cs = getComputedStyle(document.documentElement)
      const colors = overlayColors(
        cs.getPropertyValue('--surface'),
        cs.getPropertyValue('--text-muted'),
      )
      if (colors) bridge.setTitleBarOverlay(colors)
    }
    sync()
    // Re-sync when the theme changes (a commit or a live picker preview — both
    // just flip `data-theme` on <html>).
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [bridge])

  if (!isDesktop()) return null

  return (
    <div
      data-testid="titlebar"
      className="flex h-8 shrink-0 select-none items-center border-b border-line bg-surface px-3 [-webkit-app-region:drag]"
    >
      <span className="text-xs font-medium text-content-muted">ADO Taskboard</span>
    </div>
  )
}
