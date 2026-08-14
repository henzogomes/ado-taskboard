# Theming

Every color in the app comes from a small set of **semantic tokens** (CSS custom
properties), not hardcoded Tailwind palette classes. There is no `dark:` variant
and no `darkMode` — each theme is one complete palette selected by `data-theme`
on `<html>`.

## How it works

- `themes.ts` is the single source of truth: a typed `ThemeTokens` contract, the
  `THEMES` array, and `buildThemeCss(THEMES)`.
- `main.tsx` injects `buildThemeCss(THEMES)` once as `<style id="theme-vars">`.
  It emits one `[data-theme="id"]{ … }` block per theme, each setting
  `color-scheme` and every token as an `R G B` channel triple.
- `tailwind.config.ts` maps each token to a semantic color name via
  `rgb(var(--token) / <alpha-value>)`, so utilities like `bg-surface`,
  `text-content-muted`, `border-line`, and opacity modifiers like
  `bg-state-inprogress/15` all work.
- `useTheme()` sets `data-theme` + `color-scheme` and persists the id +
  appearance. `index.html` has a tiny pre-paint script that reads the persisted
  values before React mounts, so a reload never flashes the wrong appearance.

## Adding a theme

1. Append one object to `THEMES` in `themes.ts`:

   ```ts
   {
     id: 'my-theme',            // unique; used as data-theme and the persisted value
     label: 'My Theme',         // shown in the picker
     appearance: 'dark',        // 'light' | 'dark' — sets color-scheme
     tokens: {
       // fill EVERY ThemeTokens key with a hex color — TypeScript enforces
       // completeness (a missing key is a compile error).
       bg: '#…', surface: '#…', /* … */ danger: '#…', dangerMuted: '#…',
     },
   }
   ```

2. That's it. It appears in the `ThemePicker` dropdown and its CSS block is
   generated automatically — no component or CSS-file edit. `themes.test.ts`
   guards id-uniqueness and token completeness.

## Token reference

Chrome: `bg` (page), `surface` / `surfaceMuted` / `surfaceRaised`, `border` /
`borderMuted`, `text` / `textMuted` / `textSubtle`. Interactive: `accent` /
`accentFg` / `accentMuted` / `accentRing`, `link`. State: `stateProposed`,
`stateInProgress`, `stateResolved`, `stateCompleted`, `stateRemoved`. Incidental:
`tagBg` / `tagText`, `danger` / `dangerMuted`.
