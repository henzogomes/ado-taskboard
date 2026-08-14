import { Dropdown } from '../board/Dropdown'
import type { DropdownEntry } from '../board/Dropdown'
import { THEMES, THEME_EMOJI } from './themes'
import type { Theme } from './themes'
import { useTheme } from './useTheme'

/** Neutral defaults pinned to the top of their group; the rest sort alphabetically by label. */
function ordered(themes: Theme[], defaultId: string): Theme[] {
  const def = themes.find((t) => t.id === defaultId)
  const rest = themes
    .filter((t) => t.id !== defaultId)
    .sort((a, b) => a.label.localeCompare(b.label))
  return def ? [def, ...rest] : rest
}

/**
 * Header theme selector. A single dropdown over the `THEMES` registry, grouped
 * into Light / Dark sections (by each theme's `appearance`) — each theme is one
 * complete palette. Self-contained (owns `useTheme`), like the toggle it
 * replaced, so it needs no props.
 */
export function ThemePicker() {
  const { theme, setTheme, previewTheme } = useTheme()
  const active = THEMES.find((t) => t.id === theme) ?? THEMES[0]

  const light = ordered(THEMES.filter((t) => t.appearance === 'light'), 'light')
  const dark = ordered(THEMES.filter((t) => t.appearance === 'dark'), 'dark')
  const toItem = (t: Theme) => ({
    value: t.id,
    label: t.label,
    emoji: THEME_EMOJI[t.id],
    current: t.id === active.id,
  })

  const items: DropdownEntry[] = [
    { heading: 'Light' },
    ...light.map(toItem),
    { heading: 'Dark' },
    ...dark.map(toItem),
  ]

  return (
    <Dropdown
      buttonLabel={`${THEME_EMOJI[active.id] ?? ''} ${active.label}`.trim()}
      items={items}
      onSelect={setTheme}
      // Preview live while browsing (hover or arrow-key) without committing; Enter
      // or click commits, Escape/click-outside reverts to the committed theme.
      onHighlight={previewTheme}
      onCancel={() => previewTheme(theme)}
      ariaLabel="Theme"
      triggerClassName="flex items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-raised"
    />
  )
}
