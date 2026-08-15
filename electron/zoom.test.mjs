import { describe, expect, it } from 'vitest'
import {
  MAX_ZOOM_LEVEL,
  MIN_ZOOM_LEVEL,
  ZOOM_STEP,
  clampZoomLevel,
  zoomDeltaForInput,
  zoomDeltaForWheel,
} from './zoom.mjs'

describe('zoomDeltaForInput', () => {
  it('zooms in on Ctrl+= and Ctrl++ (plus on the numpad/layouts where + is its own key)', () => {
    expect(zoomDeltaForInput({ control: true, meta: false, key: '=' })).toBe(ZOOM_STEP)
    expect(zoomDeltaForInput({ control: true, meta: false, key: '+' })).toBe(ZOOM_STEP)
  })

  it('honours Cmd on macOS', () => {
    expect(zoomDeltaForInput({ control: false, meta: true, key: '=' })).toBe(ZOOM_STEP)
    expect(zoomDeltaForInput({ control: false, meta: true, key: '-' })).toBe(-ZOOM_STEP)
  })

  it('zooms out on Ctrl+- and resets on Ctrl+0', () => {
    expect(zoomDeltaForInput({ control: true, meta: false, key: '-' })).toBe(-ZOOM_STEP)
    expect(zoomDeltaForInput({ control: true, meta: false, key: '0' })).toBe(0)
  })

  it('ignores plain keys and unmodified presses', () => {
    expect(zoomDeltaForInput({ control: false, meta: false, key: '=' })).toBeNull()
    expect(zoomDeltaForInput({ control: true, meta: false, key: 'a' })).toBeNull()
    expect(zoomDeltaForInput({ control: true, meta: false, key: 'Shift' })).toBeNull()
  })
})

describe('zoomDeltaForWheel', () => {
  it('zooms in/out with Ctrl+wheel, honouring scroll direction', () => {
    expect(zoomDeltaForWheel({ control: true, meta: false, deltaY: -100 })).toBe(ZOOM_STEP)
    expect(zoomDeltaForWheel({ control: true, meta: false, deltaY: 100 })).toBe(-ZOOM_STEP)
  })

  it('ignores plain wheel and zero deltas', () => {
    expect(zoomDeltaForWheel({ control: false, meta: false, deltaY: -100 })).toBeNull()
    expect(zoomDeltaForWheel({ control: true, meta: false, deltaY: 0 })).toBeNull()
  })
})

describe('clampZoomLevel', () => {
  it('keeps in-range levels untouched', () => {
    expect(clampZoomLevel(0)).toBe(0)
    expect(clampZoomLevel(2)).toBe(2)
  })

  it('clamps to the bounds', () => {
    expect(clampZoomLevel(-99)).toBe(MIN_ZOOM_LEVEL)
    expect(clampZoomLevel(99)).toBe(MAX_ZOOM_LEVEL)
  })
})
