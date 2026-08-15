import { afterEach, describe, expect, it } from 'vitest'
import { channelsToHex, isDesktop, overlayColors } from './desktop'

describe('channelsToHex', () => {
  it('converts an "R G B" channel triple to #rrggbb', () => {
    expect(channelsToHex('255 255 255')).toBe('#ffffff')
    expect(channelsToHex('59 130 246')).toBe('#3b82f6')
    expect(channelsToHex('17 24 39')).toBe('#111827')
  })

  it('returns "" for anything that is not exactly three finite numbers', () => {
    expect(channelsToHex('')).toBe('')
    expect(channelsToHex('255 255')).toBe('')
    expect(channelsToHex('a b c')).toBe('')
    expect(channelsToHex('255 255 255 255')).toBe('')
  })
})

describe('overlayColors', () => {
  it('maps surface + muted-text channels to overlay colors', () => {
    expect(overlayColors('255 255 255', '107 114 128')).toEqual({
      color: '#ffffff',
      symbolColor: '#6b7280',
    })
  })

  it('returns null when either channel triple is unreadable', () => {
    expect(overlayColors('', '107 114 128')).toBeNull()
    expect(overlayColors('255 255 255', '')).toBeNull()
  })
})

describe('isDesktop', () => {
  const original = window.taskboard

  afterEach(() => {
    window.taskboard = original
  })

  it('is false without the Electron preload bridge', () => {
    delete window.taskboard
    expect(isDesktop()).toBe(false)
  })

  it('is true when the preload bridge is present', () => {
    window.taskboard = { isDesktop: true, setTitleBarOverlay: () => {} }
    expect(isDesktop()).toBe(true)
  })
})
