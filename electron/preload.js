const { contextBridge, ipcRenderer } = require('electron');
// Minimal preload for desktop packaging (file:// + IPC if needed later).
contextBridge.exposeInMainWorld('dragonsim', {
  platform: process.platform,
  version: '0.1.0',
});
void ipcRenderer;
