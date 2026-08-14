import { describe, it, expect } from 'vitest'
import { THEMES, buildThemeCss, THEME_EMOJI } from './themes'
import type { ThemeTokens } from './themes'

const TOKEN_KEYS: (keyof ThemeTokens)[] = [
  'bg', 'surface', 'surfaceMuted', 'surfaceRaised', 'border', 'borderMuted',
  'text', 'textMuted', 'textSubtle', 'accent', 'accentFg', 'accentMuted',
  'accentRing', 'link', 'stateProposed', 'stateInProgress', 'stateResolved',
  'stateCompleted', 'stateRemoved', 'tagBg', 'tagText', 'danger', 'dangerMuted',
]

describe('THEMES', () => {
  it('has unique ids and includes light + dark', () => {
    const ids = THEMES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining(['light', 'dark']))
  })

  it('every theme defines every token as a hex color', () => {
    for (const t of THEMES) {
      for (const k of TOKEN_KEYS) {
        expect(t.tokens[k], `${t.id}.${k}`).toMatch(/^#[0-9a-fA-F]{3,6}$/)
      }
    }
  })

  it('every theme has an emoji', () => {
    for (const t of THEMES) expect(THEME_EMOJI[t.id], t.id).toBeTruthy()
  })
})

describe('buildThemeCss', () => {
  it('emits one selector block per theme with color-scheme and channel-triple vars', () => {
    const css = buildThemeCss(THEMES)
    for (const t of THEMES) {
      expect(css).toContain(`[data-theme="${t.id}"]`)
      expect(css).toContain(`color-scheme:${t.appearance}`)
    }
    // channels, not hex: e.g. light --bg #f9fafb → "249 250 251"
    expect(css).toContain('--bg:249 250 251')
    expect(css).toContain('--surface:255 255 255')
    // no raw hex leaks into the emitted CSS
    expect(css).not.toContain('#')
  })
})
