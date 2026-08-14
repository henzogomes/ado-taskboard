import { useCallback, useEffect, useState } from 'react'
import { THEMES } from './themes'

const KEY = 'ado-taskboard-theme'
const APP_KEY = 'ado-taskboard-appearance'

/** Visual-only apply: sets `data-theme` + `color-scheme` on <html>. No state, no persist. */
function applyVisual(id: string) {
  const t = THEMES.find((x) => x.id === id) ?? THEMES[0]
  document.documentElement.dataset.theme = t.id
  document.documentElement.style.colorScheme = t.appearance
}

/**
 * Theme state. `setTheme(id)` COMMITS a theme: it applies + persists the id and
 * appearance. `previewTheme(id)` applies a theme VISUALLY ONLY (no state, no
 * persist) — used to preview a theme live while browsing the picker; reverting a
 * preview is just `previewTheme(theme)` (the still-committed id). Falls back to
 * the first theme (Light) for an unknown stored id.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<string>(() => localStorage.getItem(KEY) || 'light')

  useEffect(() => {
    const t = THEMES.find((x) => x.id === theme) ?? THEMES[0]
    applyVisual(t.id)
    localStorage.setItem(KEY, t.id)
    localStorage.setItem(APP_KEY, t.appearance)
  }, [theme])

  const setTheme = useCallback((id: string) => setThemeState(id), [])
  const previewTheme = useCallback((id: string) => applyVisual(id), [])
  return { theme, setTheme, previewTheme }
}
