import type { Config } from 'tailwindcss'

// Semantic color tokens. Each maps to a CSS custom property holding an "R G B"
// channel triple (emitted by `buildThemeCss` from the THEMES registry), wrapped
// in `rgb(... / <alpha-value>)` so Tailwind opacity modifiers work everywhere
// (e.g. `bg-state-inprogress/15`, `ring-accent/50`). Themes are selected by
// `data-theme` on <html>; there is no `dark:` variant and no `darkMode`.
const token = (v: string) => `rgb(var(${v}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: token('--bg'),
        surface: {
          DEFAULT: token('--surface'),
          muted: token('--surface-muted'),
          raised: token('--surface-raised'),
        },
        line: {
          DEFAULT: token('--border'),
          muted: token('--border-muted'),
        },
        content: {
          DEFAULT: token('--text'),
          muted: token('--text-muted'),
          subtle: token('--text-subtle'),
        },
        accent: {
          DEFAULT: token('--accent'),
          fg: token('--accent-fg'),
          muted: token('--accent-muted'),
          ring: token('--accent-ring'),
        },
        link: token('--link'),
        state: {
          proposed: token('--state-proposed'),
          inprogress: token('--state-inprogress'),
          resolved: token('--state-resolved'),
          completed: token('--state-completed'),
          removed: token('--state-removed'),
        },
        tag: {
          DEFAULT: token('--tag-bg'),
          fg: token('--tag-text'),
        },
        danger: {
          DEFAULT: token('--danger'),
          muted: token('--danger-muted'),
        },
      },
    },
  },
  plugins: [],
} satisfies Config
