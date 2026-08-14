// Theme token registry — the single source of truth for every color in the app.
//
// Each theme is one complete palette typed `ThemeTokens`, so a missing token is
// a COMPILE error (see `Theme.tokens: ThemeTokens`). The stylesheet is generated
// from `THEMES` at startup (`buildThemeCss`, injected in `main.tsx`) — adding a
// theme is a one-object append here, no component or CSS-file edit.
//
// Values are stored as hex for readability; `buildThemeCss` converts each to an
// "R G B" channel triple so the emitted CSS custom properties work with Tailwind
// opacity modifiers everywhere (e.g. `bg-state-inprogress/15`). See
// `src/theme/README.md` for the add-a-theme recipe.
//
// themes-2 palette set: accents are spread across the hue wheel (no more
// blue-on-everything), text is tinted per theme, and the darker themes carry a
// clearer bg→surface contrast step so cards read as cards. The prior set is
// tagged `themes-1` for rollback.

/** Every semantic color token. A theme must define all of them (compile-checked). */
export interface ThemeTokens {
  /** Page background. */
  bg: string
  /** Cards, header, modal. */
  surface: string
  /** Nested/tinted blocks (filter bar, inputs). */
  surfaceMuted: string
  /** Hover / raised surface. */
  surfaceRaised: string
  /** Default border. */
  border: string
  /** Subtle divider border. */
  borderMuted: string
  /** Primary text. */
  text: string
  /** Secondary text. */
  textMuted: string
  /** Tertiary text / placeholders. */
  textSubtle: string
  /** Accent (buttons, active). */
  accent: string
  /** Text/icon on an accent fill. */
  accentFg: string
  /** Accent-tinted background (highlight-mine). */
  accentMuted: string
  /** Focus ring. */
  accentRing: string
  /** Hyperlink text. */
  link: string
  /** State-category colors (card border, modal accent, pill). */
  stateProposed: string
  stateInProgress: string
  stateResolved: string
  stateCompleted: string
  stateRemoved: string
  /** Tag chip. */
  tagBg: string
  tagText: string
  /** Error banner. */
  danger: string
  dangerMuted: string
}

export interface Theme {
  id: string
  label: string
  appearance: 'light' | 'dark'
  tokens: ThemeTokens
}

export const THEMES: Theme[] = [
  {
    // Crisp, high-contrast neutral light — indigo accent.
    id: 'light',
    label: 'Light',
    appearance: 'light',
    tokens: {
      bg: '#f9fafb',
      surface: '#ffffff',
      surfaceMuted: '#f3f4f6',
      surfaceRaised: '#e5e7eb',
      border: '#e5e7eb',
      borderMuted: '#eef0f2',
      text: '#111827',
      textMuted: '#4b5563',
      textSubtle: '#9ca3af',
      accent: '#4f46e5',
      accentFg: '#ffffff',
      accentMuted: '#eef2ff',
      accentRing: '#6366f1',
      link: '#2563eb',
      stateProposed: '#64748b',
      stateInProgress: '#2563eb',
      stateResolved: '#7c3aed',
      stateCompleted: '#16a34a',
      stateRemoved: '#dc2626',
      tagBg: '#fef3c7',
      tagText: '#92400e',
      danger: '#b91c1c',
      dangerMuted: '#fef2f2',
    },
  },
  {
    // Crisp, high-contrast neutral dark — indigo accent.
    id: 'dark',
    label: 'Dark',
    appearance: 'dark',
    tokens: {
      bg: '#030712',
      surface: '#111827',
      surfaceMuted: '#1f2937',
      surfaceRaised: '#374151',
      border: '#374151',
      borderMuted: '#1f2937',
      text: '#f3f4f6',
      textMuted: '#9ca3af',
      textSubtle: '#6b7280',
      accent: '#6366f1',
      accentFg: '#ffffff',
      accentMuted: '#312e81',
      accentRing: '#818cf8',
      link: '#60a5fa',
      stateProposed: '#94a3b8',
      stateInProgress: '#3b82f6',
      stateResolved: '#a78bfa',
      stateCompleted: '#22c55e',
      stateRemoved: '#ef4444',
      tagBg: '#78350f',
      tagText: '#fde68a',
      danger: '#fca5a5',
      dangerMuted: '#450a0a',
    },
  },
  {
    // Warm cream light, taupe text — TEAL accent (sets it apart from Light's
    // crisp white + indigo).
    id: 'catppuccin-latte',
    label: 'Catppuccin Latte',
    appearance: 'light',
    tokens: {
      bg: '#f4ecdd',
      surface: '#fdf8ee',
      surfaceMuted: '#ece1cd',
      surfaceRaised: '#e3d6bd',
      border: '#d8cbb2',
      borderMuted: '#ebe0cd',
      text: '#574f45',
      textMuted: '#7a6f5e',
      textSubtle: '#a89d89',
      accent: '#179299',
      accentFg: '#ffffff',
      accentMuted: '#d7ebe4',
      accentRing: '#179299',
      link: '#1e66f5',
      stateProposed: '#8a7f6b',
      stateInProgress: '#1e66f5',
      stateResolved: '#8839ef',
      stateCompleted: '#40a02b',
      stateRemoved: '#d20f39',
      tagBg: '#f0ddb8',
      tagText: '#875600',
      danger: '#c0392b',
      dangerMuted: '#f6e2d8',
    },
  },
  {
    // Soft purple-black, lavender text — MAUVE accent.
    id: 'catppuccin-mocha',
    label: 'Catppuccin Mocha',
    appearance: 'dark',
    tokens: {
      bg: '#181825',
      surface: '#24273a',
      surfaceMuted: '#302d41',
      surfaceRaised: '#45475a',
      border: '#45475a',
      borderMuted: '#302d41',
      text: '#cdd6f4',
      textMuted: '#a6adc8',
      textSubtle: '#7f849c',
      accent: '#cba6f7',
      accentFg: '#1e1e2e',
      accentMuted: '#3a2f52',
      accentRing: '#cba6f7',
      link: '#89b4fa',
      stateProposed: '#9399b2',
      stateInProgress: '#89b4fa',
      stateResolved: '#cba6f7',
      stateCompleted: '#a6e3a1',
      stateRemoved: '#f38ba8',
      tagBg: '#453a2e',
      tagText: '#fab387',
      danger: '#f38ba8',
      dangerMuted: '#3a222b',
    },
  },
  {
    // Warm olive, cream text — PINK accent (Monokai's signature).
    id: 'monokai',
    label: 'Monokai',
    appearance: 'dark',
    tokens: {
      bg: '#272822',
      surface: '#33342c',
      surfaceMuted: '#3e3f34',
      surfaceRaised: '#49483e',
      border: '#56564a',
      borderMuted: '#3e3f34',
      text: '#f8f6ec',
      textMuted: '#b8b39c',
      textSubtle: '#75715e',
      accent: '#f92672',
      accentFg: '#ffffff',
      accentMuted: '#4a2436',
      accentRing: '#f92672',
      link: '#66d9ef',
      stateProposed: '#75715e',
      stateInProgress: '#66d9ef',
      stateResolved: '#ae81ff',
      stateCompleted: '#a6e22e',
      stateRemoved: '#f92672',
      tagBg: '#46422a',
      tagText: '#e6db74',
      danger: '#f92672',
      dangerMuted: '#3a2028',
    },
  },
  {
    // Deep slate, cool white text — frost CYAN accent.
    id: 'nord',
    label: 'Nord',
    appearance: 'dark',
    tokens: {
      bg: '#262b33',
      surface: '#2e3440',
      surfaceMuted: '#353c4a',
      surfaceRaised: '#434c5e',
      border: '#4c566a',
      borderMuted: '#353c4a',
      text: '#eceff4',
      textMuted: '#c2cbd9',
      textSubtle: '#7b88a1',
      accent: '#88c0d0',
      accentFg: '#2e3440',
      accentMuted: '#2b4048',
      accentRing: '#88c0d0',
      link: '#81a1c1',
      stateProposed: '#7b88a1',
      stateInProgress: '#81a1c1',
      stateResolved: '#b48ead',
      stateCompleted: '#a3be8c',
      stateRemoved: '#bf616a',
      tagBg: '#4a4632',
      tagText: '#ebcb8b',
      danger: '#bf616a',
      dangerMuted: '#3b2c30',
    },
  },
  {
    // Grey-purple, cream text — PURPLE accent.
    id: 'dracula',
    label: 'Dracula',
    appearance: 'dark',
    tokens: {
      bg: '#21222c',
      surface: '#282a36',
      surfaceMuted: '#343746',
      surfaceRaised: '#44475a',
      border: '#44475a',
      borderMuted: '#343746',
      text: '#f8f8f2',
      textMuted: '#b8becf',
      textSubtle: '#6272a4',
      accent: '#bd93f9',
      accentFg: '#21222c',
      accentMuted: '#3a2f5c',
      accentRing: '#bd93f9',
      link: '#8be9fd',
      stateProposed: '#6272a4',
      stateInProgress: '#8be9fd',
      stateResolved: '#bd93f9',
      stateCompleted: '#50fa7b',
      stateRemoved: '#ff5555',
      tagBg: '#454429',
      tagText: '#f1fa8c',
      danger: '#ff5555',
      dangerMuted: '#3a2129',
    },
  },
  {
    // Near-black, warm taupe text — GOLD accent (the standout).
    id: 'ayu-dark',
    label: 'Ayu (Dark)',
    appearance: 'dark',
    tokens: {
      bg: '#0b0e14',
      surface: '#131721',
      surfaceMuted: '#1a1f2a',
      surfaceRaised: '#232a35',
      border: '#2d3640',
      borderMuted: '#1a1f2a',
      text: '#bfbdb6',
      textMuted: '#8a9199',
      textSubtle: '#565b66',
      accent: '#ffb454',
      accentFg: '#0b0e14',
      accentMuted: '#33291a',
      accentRing: '#ffb454',
      link: '#59c2ff',
      stateProposed: '#565b66',
      stateInProgress: '#59c2ff',
      stateResolved: '#d2a6ff',
      stateCompleted: '#aad94c',
      stateRemoved: '#f07178',
      tagBg: '#33291a',
      tagText: '#ffd580',
      danger: '#f07178',
      dangerMuted: '#33191d',
    },
  },
  {
    // Deep blue-black, blue-lavender text — bright CYAN accent.
    id: 'tokyo-night',
    label: 'Tokyo Night',
    appearance: 'dark',
    tokens: {
      bg: '#16161e',
      surface: '#1f2335',
      surfaceMuted: '#24283b',
      surfaceRaised: '#2f334d',
      border: '#2f334d',
      borderMuted: '#24283b',
      text: '#c0caf5',
      textMuted: '#a9b1d6',
      textSubtle: '#565f89',
      accent: '#7dcfff',
      accentFg: '#16161e',
      accentMuted: '#22344a',
      accentRing: '#7dcfff',
      link: '#7aa2f7',
      stateProposed: '#565f89',
      stateInProgress: '#7aa2f7',
      stateResolved: '#bb9af7',
      stateCompleted: '#9ece6a',
      stateRemoved: '#f7768e',
      tagBg: '#423a24',
      tagText: '#e0af68',
      danger: '#f7768e',
      dangerMuted: '#37222b',
    },
  },
  {
    // Blue-grey, cool dim text — ORANGE accent (warm, sets it apart from the blues).
    id: 'one-dark',
    label: 'One (Dark)',
    appearance: 'dark',
    tokens: {
      bg: '#21252b',
      surface: '#282c34',
      surfaceMuted: '#2f343e',
      surfaceRaised: '#3b4048',
      border: '#3b4048',
      borderMuted: '#2f343e',
      text: '#abb2bf',
      textMuted: '#828997',
      textSubtle: '#5c6370',
      accent: '#d19a66',
      accentFg: '#21252b',
      accentMuted: '#3d3226',
      accentRing: '#d19a66',
      link: '#61afef',
      stateProposed: '#5c6370',
      stateInProgress: '#61afef',
      stateResolved: '#c678dd',
      stateCompleted: '#98c379',
      stateRemoved: '#e06c75',
      tagBg: '#3a3326',
      tagText: '#e5c07b',
      danger: '#e06c75',
      dangerMuted: '#37242a',
    },
  },
  {
    // Warm cream, low-contrast classic — CYAN accent.
    id: 'solarized-light',
    label: 'Solarized Light',
    appearance: 'light',
    tokens: {
      bg: '#f3ead2',
      surface: '#fdf6e3',
      surfaceMuted: '#eae1c5',
      surfaceRaised: '#e0d7ba',
      border: '#d9cfb0',
      borderMuted: '#ebe2c8',
      text: '#586e75',
      textMuted: '#657b83',
      textSubtle: '#93a1a1',
      accent: '#2aa198',
      accentFg: '#fdf6e3',
      accentMuted: '#d3e8e2',
      accentRing: '#2aa198',
      link: '#268bd2',
      stateProposed: '#93a1a1',
      stateInProgress: '#268bd2',
      stateResolved: '#6c71c4',
      stateCompleted: '#859900',
      stateRemoved: '#dc322f',
      tagBg: '#eee2bb',
      tagText: '#7a6000',
      danger: '#dc322f',
      dangerMuted: '#f6ddd7',
    },
  },
  {
    // Retro yellow-cream, earthy — ORANGE accent.
    id: 'gruvbox-light',
    label: 'Gruvbox Light',
    appearance: 'light',
    tokens: {
      bg: '#f2e5bc',
      surface: '#fbf1c7',
      surfaceMuted: '#ebdbb2',
      surfaceRaised: '#ddcca0',
      border: '#d5c4a1',
      borderMuted: '#ecdcb5',
      text: '#3c3836',
      textMuted: '#665c54',
      textSubtle: '#928374',
      accent: '#d65d0e',
      accentFg: '#fbf1c7',
      accentMuted: '#f3ddc0',
      accentRing: '#d65d0e',
      link: '#076678',
      stateProposed: '#928374',
      stateInProgress: '#458588',
      stateResolved: '#8f3f71',
      stateCompleted: '#79740e',
      stateRemoved: '#9d0006',
      tagBg: '#ecdcae',
      tagText: '#79740e',
      danger: '#9d0006',
      dangerMuted: '#f2dcd0',
    },
  },
  {
    // Soft rose pastel — IRIS (soft purple) accent.
    id: 'rose-pine-dawn',
    label: 'Rosé Pine Dawn',
    appearance: 'light',
    tokens: {
      bg: '#faf4ed',
      surface: '#fdf8f2',
      surfaceMuted: '#f2e9e1',
      surfaceRaised: '#e9ddd4',
      border: '#dcd0c8',
      borderMuted: '#f0e6de',
      text: '#575279',
      textMuted: '#797593',
      textSubtle: '#9893a5',
      accent: '#907aa9',
      accentFg: '#faf4ed',
      accentMuted: '#e6dfef',
      accentRing: '#907aa9',
      link: '#286983',
      stateProposed: '#9893a5',
      stateInProgress: '#56949f',
      stateResolved: '#907aa9',
      stateCompleted: '#286983',
      stateRemoved: '#b4637a',
      tagBg: '#f2e0cf',
      tagText: '#8a5a00',
      danger: '#b4637a',
      dangerMuted: '#f4e1e1',
    },
  },
  {
    // Clean cool grey (pairs with One Dark) — BLUE accent.
    id: 'one-light',
    label: 'One Light',
    appearance: 'light',
    tokens: {
      bg: '#eef0f3',
      surface: '#f7f8fa',
      surfaceMuted: '#e4e7ec',
      surfaceRaised: '#dadee5',
      border: '#ccd1da',
      borderMuted: '#e6e9ee',
      text: '#383a42',
      textMuted: '#6a6f7a',
      textSubtle: '#a0a1a7',
      accent: '#4078f2',
      accentFg: '#ffffff',
      accentMuted: '#dde7fd',
      accentRing: '#4078f2',
      link: '#0184bc',
      stateProposed: '#a0a1a7',
      stateInProgress: '#4078f2',
      stateResolved: '#a626a4',
      stateCompleted: '#50a14f',
      stateRemoved: '#e45649',
      tagBg: '#f6e2c4',
      tagText: '#8a5a00',
      danger: '#e45649',
      dangerMuted: '#fbe2df',
    },
  },
  {
    // Warm soft green-cream, nature-y — GREEN accent.
    id: 'everforest-light',
    label: 'Everforest Light',
    appearance: 'light',
    tokens: {
      bg: '#f4f0d9',
      surface: '#fdf6e3',
      surfaceMuted: '#e9e5cd',
      surfaceRaised: '#ded9bf',
      border: '#d5d0b4',
      borderMuted: '#ebe6cf',
      text: '#5c6a72',
      textMuted: '#66756a',
      textSubtle: '#939f91',
      accent: '#8da101',
      accentFg: '#fdf6e3',
      accentMuted: '#e4ecc0',
      accentRing: '#8da101',
      link: '#3a94c5',
      stateProposed: '#939f91',
      stateInProgress: '#3a94c5',
      stateResolved: '#df69ba',
      stateCompleted: '#35a77c',
      stateRemoved: '#f85552',
      tagBg: '#efe6be',
      tagText: '#8a6d00',
      danger: '#f85552',
      dangerMuted: '#f7e0dc',
    },
  },
  {
    // Warm ink-wash paper, traditional — VIOLET accent.
    id: 'kanagawa-lotus',
    label: 'Kanagawa Lotus',
    appearance: 'light',
    tokens: {
      bg: '#ede3b0',
      surface: '#f2ecbc',
      surfaceMuted: '#e5ddad',
      surfaceRaised: '#dccf9c',
      border: '#d3c99a',
      borderMuted: '#e8e0af',
      text: '#545464',
      textMuted: '#716e61',
      textSubtle: '#8a8980',
      accent: '#624c83',
      accentFg: '#f2ecbc',
      accentMuted: '#e4d9dd',
      accentRing: '#624c83',
      link: '#4d699b',
      stateProposed: '#8a8980',
      stateInProgress: '#4d699b',
      stateResolved: '#624c83',
      stateCompleted: '#6f894e',
      stateRemoved: '#c84053',
      tagBg: '#e5d7a0',
      tagText: '#77713f',
      danger: '#c84053',
      dangerMuted: '#f0dcd4',
    },
  },
  {
    // Cool light grey (Nord Snow Storm) — frost BLUE accent.
    id: 'nord-light',
    label: 'Nord Light',
    appearance: 'light',
    tokens: {
      bg: '#e5e9f0',
      surface: '#eceff4',
      surfaceMuted: '#dbe1ea',
      surfaceRaised: '#d0d8e4',
      border: '#c2ccdb',
      borderMuted: '#dde3ec',
      text: '#2e3440',
      textMuted: '#4c566a',
      textSubtle: '#7b88a1',
      accent: '#5e81ac',
      accentFg: '#eceff4',
      accentMuted: '#d9e2f0',
      accentRing: '#5e81ac',
      link: '#81a1c1',
      stateProposed: '#7b88a1',
      stateInProgress: '#5e81ac',
      stateResolved: '#b48ead',
      stateCompleted: '#a3be8c',
      stateRemoved: '#bf616a',
      tagBg: '#e0d3b0',
      tagText: '#8a6d00',
      danger: '#bf616a',
      dangerMuted: '#f2e0e2',
    },
  },
  {
    // Playful pastel pink, berry text — HOT PINK accent.
    id: 'girly-girl',
    label: 'Girly Girl',
    appearance: 'light',
    tokens: {
      bg: '#fdeef5',
      surface: '#fef6fa',
      surfaceMuted: '#f9dfeb',
      surfaceRaised: '#f4cfe1',
      border: '#f0c0d6',
      borderMuted: '#f9e1ee',
      text: '#5f2749',
      textMuted: '#9c5a7d',
      textSubtle: '#c98fb0',
      accent: '#ec4899',
      accentFg: '#ffffff',
      accentMuted: '#fbd5e8',
      accentRing: '#ec4899',
      link: '#a21caf',
      stateProposed: '#b08ba5',
      stateInProgress: '#db2777',
      stateResolved: '#9333ea',
      stateCompleted: '#10b981',
      stateRemoved: '#e11d48',
      tagBg: '#fbd9e8',
      tagText: '#9d174d',
      danger: '#e11d48',
      dangerMuted: '#fce4ea',
    },
  },
  {
    // Warm brown-black, cream text — ORANGE accent (pairs with Gruvbox Light).
    id: 'gruvbox-dark',
    label: 'Gruvbox Dark',
    appearance: 'dark',
    tokens: {
      bg: '#282828',
      surface: '#32302f',
      surfaceMuted: '#3c3836',
      surfaceRaised: '#504945',
      border: '#504945',
      borderMuted: '#3c3836',
      text: '#ebdbb2',
      textMuted: '#bdae93',
      textSubtle: '#928374',
      accent: '#fe8019',
      accentFg: '#282828',
      accentMuted: '#4a3520',
      accentRing: '#fe8019',
      link: '#83a598',
      stateProposed: '#928374',
      stateInProgress: '#83a598',
      stateResolved: '#d3869b',
      stateCompleted: '#b8bb26',
      stateRemoved: '#fb4934',
      tagBg: '#4a4526',
      tagText: '#fabd2f',
      danger: '#fb4934',
      dangerMuted: '#3a2420',
    },
  },
  {
    // Muted purple-black, aesthetic — ROSE accent (pairs with Rosé Pine Dawn).
    id: 'rose-pine',
    label: 'Rosé Pine',
    appearance: 'dark',
    tokens: {
      bg: '#191724',
      surface: '#1f1d2e',
      surfaceMuted: '#26233a',
      surfaceRaised: '#403d52',
      border: '#403d52',
      borderMuted: '#26233a',
      text: '#e0def4',
      textMuted: '#908caa',
      textSubtle: '#6e6a86',
      accent: '#ebbcba',
      accentFg: '#191724',
      accentMuted: '#3a2b33',
      accentRing: '#ebbcba',
      link: '#9ccfd8',
      stateProposed: '#6e6a86',
      stateInProgress: '#9ccfd8',
      stateResolved: '#c4a7e7',
      stateCompleted: '#31748f',
      stateRemoved: '#eb6f92',
      tagBg: '#4a3f2a',
      tagText: '#f6c177',
      danger: '#eb6f92',
      dangerMuted: '#3a222b',
    },
  },
  {
    // Dark counterpart to Girly Girl — purple-black, pale pink text, HOT PINK accent.
    id: 'goth-girl',
    label: 'Goth Girl',
    appearance: 'dark',
    tokens: {
      bg: '#17121f',
      surface: '#211a2b',
      surfaceMuted: '#2b2138',
      surfaceRaised: '#3a2c4a',
      border: '#3a2c4a',
      borderMuted: '#2b2138',
      text: '#f5e6f0',
      textMuted: '#c9a3bd',
      textSubtle: '#8a6a80',
      accent: '#f43f9d',
      accentFg: '#17121f',
      accentMuted: '#3a1830',
      accentRing: '#f43f9d',
      link: '#c084fc',
      stateProposed: '#9c7a92',
      stateInProgress: '#ec4899',
      stateResolved: '#a855f7',
      stateCompleted: '#4ade80',
      stateRemoved: '#fb5a7a',
      tagBg: '#3a1f33',
      tagText: '#f9a8d4',
      danger: '#fb5a7a',
      dangerMuted: '#3a1a24',
    },
  },
]

/**
 * Emoji shown before each theme's label in the picker. Kept beside `THEMES`
 * (not baked into `label`, so the persisted id + sort stay clean). Every theme
 * id must have an entry — enforced by `themes.test.ts`.
 */
export const THEME_EMOJI: Record<string, string> = {
  // Light
  light: '☀️',
  'catppuccin-latte': '☕',
  'everforest-light': '🌿',
  'girly-girl': '🎀',
  'gruvbox-light': '🌾',
  'kanagawa-lotus': '🪷',
  'nord-light': '❄️',
  'one-light': '🤍',
  'rose-pine-dawn': '🌸',
  'solarized-light': '🌞',
  // Dark
  dark: '🌙',
  'ayu-dark': '🌃',
  'catppuccin-mocha': '🍫',
  dracula: '🧛',
  'goth-girl': '🦇',
  'gruvbox-dark': '🍂',
  monokai: '🎨',
  nord: '🏔️',
  'one-dark': '🖤',
  'rose-pine': '🌹',
  'tokyo-night': '🗼',
}

/** camelCase token key → CSS custom property name. Must list every `ThemeTokens` key. */
const CSS_VAR: Record<keyof ThemeTokens, string> = {
  bg: '--bg',
  surface: '--surface',
  surfaceMuted: '--surface-muted',
  surfaceRaised: '--surface-raised',
  border: '--border',
  borderMuted: '--border-muted',
  text: '--text',
  textMuted: '--text-muted',
  textSubtle: '--text-subtle',
  accent: '--accent',
  accentFg: '--accent-fg',
  accentMuted: '--accent-muted',
  accentRing: '--accent-ring',
  link: '--link',
  stateProposed: '--state-proposed',
  stateInProgress: '--state-inprogress',
  stateResolved: '--state-resolved',
  stateCompleted: '--state-completed',
  stateRemoved: '--state-removed',
  tagBg: '--tag-bg',
  tagText: '--tag-text',
  danger: '--danger',
  dangerMuted: '--danger-muted',
}

/** `#3b82f6` → `59 130 246` (space-separated channels for `rgb(var(--x) / <alpha>)`). */
function hexToChannels(hex: string): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `${r} ${g} ${b}`
}

/**
 * Generate one `[data-theme="id"]{ … }` block per theme, each setting
 * `color-scheme` and every token as an "R G B" channel triple. Injected once at
 * startup; switching themes is then just `documentElement.dataset.theme = id`.
 */
export function buildThemeCss(themes: Theme[]): string {
  return themes
    .map((t) => {
      const vars = (Object.keys(t.tokens) as (keyof ThemeTokens)[])
        .map((k) => `${CSS_VAR[k]}:${hexToChannels(t.tokens[k])}`)
        .join(';')
      return `[data-theme="${t.id}"]{color-scheme:${t.appearance};${vars}}`
    })
    .join('\n')
}
