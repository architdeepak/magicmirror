const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mirrorBridge', {
  getConfig: () => ipcRenderer.invoke('mirror:get-config'),
  createGeminiToken: () => ipcRenderer.invoke('mirror:create-gemini-token'),
  getWakeWordAccessKey: () => ipcRenderer.invoke('mirror:get-wake-word-key'),
  readMemory: () => ipcRenderer.invoke('mirror:read-memory'),
  rememberFact: (fact) => ipcRenderer.invoke('mirror:remember-fact', fact),
  clearMemory: () => ipcRenderer.invoke('mirror:clear-memory'),
  listCloset: () => ipcRenderer.invoke('mirror:list-closet'),
  importClosetGarment: (item) => ipcRenderer.invoke('mirror:import-closet-garment', item),
  queueTryOn: (request) => ipcRenderer.invoke('mirror:queue-tryon', request),
  toggleFullscreen: () => ipcRenderer.invoke('mirror:toggle-fullscreen'),
  openService: (service) => ipcRenderer.invoke('mirror:open-service', service)
});
