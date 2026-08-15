// electron/zoom.mjs
//
// Browser-style page zoom for the desktop build (Ctrl/Cmd+=, Ctrl/Cmd+-, and
// Ctrl+0 to reset, plus Ctrl+wheel). Pure input→delta mapping kept free of
// Electron imports so it unit-tests under Vitest; main.mjs applies the result
// to the window's webContents and persists the level.
//
// Chromium zoom levels: 0 = 100%, each 0.5 step ≈ 20% (matches browser
// behaviour).
export const ZOOM_STEP = 0.5;
export const MIN_ZOOM_LEVEL = -5;
export const MAX_ZOOM_LEVEL = 5;

// Keyboard shortcuts. Returns +ZOOM_STEP (zoom in), -ZOOM_STEP (zoom out), or
// 0 (reset). Returns null when the shortcut does not match — callers should
// consume the event only for a non-null result.
export function zoomDeltaForInput({ control, meta, key }) {
  if (!(control || meta)) return null;
  switch (key.toLowerCase()) {
    case '=':
    case '+':
      return ZOOM_STEP;
    case '-':
      return -ZOOM_STEP;
    case '0':
      return 0;
    default:
      return null;
  }
}

// Ctrl+wheel, browser-style: scroll up zooms in, down zooms out. Returns a
// signed delta or null when not a zoom gesture.
export function zoomDeltaForWheel({ control, meta, deltaY }) {
  if (!(control || meta)) return null;
  if (deltaY === 0) return null;
  return deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
}

export function clampZoomLevel(level) {
  return Math.min(MAX_ZOOM_LEVEL, Math.max(MIN_ZOOM_LEVEL, level));
}
