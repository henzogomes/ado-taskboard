// electron/preload.cjs
//
// Minimal, single-purpose bridge for the Window Controls Overlay. Exposes
// exactly one surface (`window.taskboard`) so the renderer can theme the
// native title-bar buttons to match the active app theme. Nothing else is
// exposed — the PAT stays renderer-side (v1 keeps it in the connection store)
// and there is no connection-store IPC in this milestone.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('taskboard', {
  isDesktop: true,
  platform: process.platform,
  setTitleBarOverlay: (opts) => ipcRenderer.invoke('window:set-title-bar-overlay', opts),
});
