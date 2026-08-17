// src/titlebar/desktop.ts
//
// Desktop-mode helpers for the Window Controls Overlay title bar. The Electron
// preload (electron/preload.cjs) exposes `window.taskboard`; without it (plain
// web app) the bridge is undefined and every helper degrades gracefully.

/** The single bridge the Electron preload exposes to the renderer. */
export interface TaskboardBridge {
  isDesktop: boolean
  /** `process.platform` — the renderer uses it to lay out around the macOS traffic lights. */
  platform?: string
  /** Tell the native title-bar buttons to use the given colors (`#rrggbb`). */
  setTitleBarOverlay: (opts: { color: string; symbolColor: string }) => void
}

declare global {
  interface Window {
    taskboard?: TaskboardBridge
  }
}

/** True when running inside the Electron build (the preload is present). */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && Boolean(window.taskboard?.isDesktop)
}

/** Theme CSS vars store channels as "R G B" → convert to `#rrggbb`. */
export function channelsToHex(channels: string): string {
  const parts = channels.trim().split(/\s+/).map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return ''
  return '#' + parts.map((n) => n.toString(16).padStart(2, '0')).join('')
}

/**
 * WCO overlay colors for the current theme, derived from its surface + muted
 * text channel triples. Returns null if either is unreadable (e.g. before the
 * theme CSS has been applied).
 */
export function overlayColors(
  surfaceChannels: string,
  textMutedChannels: string,
): { color: string; symbolColor: string } | null {
  const color = channelsToHex(surfaceChannels)
  const symbolColor = channelsToHex(textMutedChannels)
  if (!color || !symbolColor) return null
  return { color, symbolColor }
}
