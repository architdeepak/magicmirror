const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mirrorBridge', {
  getConfig: () => ipcRenderer.invoke('mirror:get-config'),
  createGeminiToken: () => ipcRenderer.invoke('mirror:create-gemini-token'),
  getWakeWordAccessKey: () => ipcRenderer.invoke('mirror:get-wake-word-key'),
  readMemory: () => ipcRenderer.invoke('mirror:read-memory'),
  rememberFact: (fact) => ipcRenderer.invoke('mirror:remember-fact', fact),
  clearMemory: () => ipcRenderer.invoke('mirror:clear-memory'),
  toggleFullscreen: () => ipcRenderer.invoke('mirror:toggle-fullscreen')
});
