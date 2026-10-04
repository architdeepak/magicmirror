const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mirrorBridge', {
  onStopRequested: callback => {
    const listener = () => callback();
    ipcRenderer.on('mirror:stop-requested', listener);
    return () => ipcRenderer.removeListener('mirror:stop-requested', listener);
  },
  codexTask: task => ipcRenderer.invoke('mirror:codex-task', task),
  cancelCodex: () => ipcRenderer.invoke('mirror:codex-cancel'),
  codexToolResult: payload => ipcRenderer.invoke('mirror:codex-tool-result', payload),
  onCodexTool: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('mirror:codex-tool', listener);
    return () => ipcRenderer.removeListener('mirror:codex-tool', listener);
  },
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
  openMirrorMedia: (input) => ipcRenderer.invoke('mirror:open-media', input),
  hideMirrorMedia: () => ipcRenderer.invoke('mirror:hide-media'),
  resizeMirrorMedia: (bounds) => ipcRenderer.invoke('mirror:resize-media', bounds),
  controlMirrorMedia: (input) => ipcRenderer.invoke('mirror:control-media', input),
  browserAction: input => ipcRenderer.invoke('mirror:browser-action', input),
  mirrorMediaPointer: (input) => ipcRenderer.invoke('mirror:media-pointer', input),
  openService: (service) => ipcRenderer.invoke('mirror:open-service', service)
});
