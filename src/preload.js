const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mirrorBridge', {
  codexTask: input => ipcRenderer.invoke('mirror:codex-task', input),
  cancelCodex: () => ipcRenderer.invoke('mirror:codex-cancel'),
  codexToolResult: input => ipcRenderer.invoke('mirror:codex-tool-result', input),
  onCodexTool: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('mirror:codex-tool', listener);
    return () => ipcRenderer.removeListener('mirror:codex-tool', listener);
  },
  onCodexCancelled: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('mirror:codex-cancelled', listener);
    return () => ipcRenderer.removeListener('mirror:codex-cancelled', listener);
  },
  wakeModelUrl:()=>ipcRenderer.invoke('mirror:wake-model-url'),
  youtubePlayerUrl: () => ipcRenderer.invoke('mirror:youtube-player-url'),
  saveConnections: (input) => ipcRenderer.invoke('mirror:save-connections', input),
  getConfig: () => ipcRenderer.invoke('mirror:get-config'),
  createGeminiToken: () => ipcRenderer.invoke('mirror:create-gemini-token'),
  getWakeWordAccessKey: () => ipcRenderer.invoke('mirror:get-wake-word-key'),
  readMemory: () => ipcRenderer.invoke('mirror:read-memory'),
  rememberFact: (fact) => ipcRenderer.invoke('mirror:remember-fact', fact),
  clearMemory: () => ipcRenderer.invoke('mirror:clear-memory'),
  saveClosetPhoto: input => ipcRenderer.invoke('mirror:save-closet-photo', input),
  listCloset: () => ipcRenderer.invoke('mirror:list-closet'),
  importClosetGarment: (item) => ipcRenderer.invoke('mirror:import-closet-garment', item),
  queueTryOn: (request) => ipcRenderer.invoke('mirror:queue-tryon', request),
  cancelTryOn: (id) => ipcRenderer.invoke('mirror:cancel-tryon', id),
  createLiveTryOnToken: input => ipcRenderer.invoke('mirror:live-tryon-token', input),
  cancelLiveTryOnToken: () => ipcRenderer.invoke('mirror:cancel-live-tryon-token'),
  toggleFullscreen: () => ipcRenderer.invoke('mirror:toggle-fullscreen'),
  openService: (service) => ipcRenderer.invoke('mirror:open-service', service),
  openWebpage: (url) => ipcRenderer.invoke('mirror:open-webpage', url),
  scrollDesktopGesture: (direction) => ipcRenderer.invoke('mirror:desktop-gesture-scroll', direction),
  desktopPresentation: () => ipcRenderer.invoke('mirror:desktop-presentation'),
  onDesktopPresentation: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('mirror:desktop-presentation', listener);
    return () => ipcRenderer.removeListener('mirror:desktop-presentation', listener);
  },
  closeDesktop: () => ipcRenderer.invoke('mirror:close-desktop'),
  captureScreen: () => ipcRenderer.invoke('mirror:desktop-capture'),
  desktopAction: (input) => ipcRenderer.invoke('mirror:desktop-action', input),
  cancelDesktopActions: () => ipcRenderer.invoke('mirror:desktop-cancel'),
  spotifyStatus: () => ipcRenderer.invoke('mirror:spotify-status'),
  spotifyConnect: () => ipcRenderer.invoke('mirror:spotify-connect'),
  spotifyDisconnect: () => ipcRenderer.invoke('mirror:spotify-disconnect'),
  spotifyCurrent: () => ipcRenderer.invoke('mirror:spotify-current'),
  spotifyControl: (action) => ipcRenderer.invoke('mirror:spotify-control', action),
  spotifyDevices: () => ipcRenderer.invoke('mirror:spotify-devices'),
  openSpotifyItem: (item) => ipcRenderer.invoke('mirror:open-spotify-item', item),
  searchWeb: (query) => ipcRenderer.invoke('mirror:search-web', query),
  wardrobePhone: enabled => ipcRenderer.invoke('mirror:wardrobe-phone', enabled),
  onWardrobePhoto: callback => { const listener = (_event, value) => callback(value); ipcRenderer.on('mirror:phone-wardrobe', listener); return () => ipcRenderer.removeListener('mirror:phone-wardrobe', listener); },
  startPhoneLink: () => ipcRenderer.invoke('mirror:start-phone-link'),
  stopPhoneLink: () => ipcRenderer.invoke('mirror:stop-phone-link'),
  openCastSettings: () => ipcRenderer.invoke('mirror:open-cast-settings'),
  startCasting: () => ipcRenderer.invoke('mirror:start-casting'),
  stopCasting: () => ipcRenderer.invoke('mirror:stop-casting'),
  reportCastState: (state) => ipcRenderer.invoke('mirror:cast-state', state),
  completeCastCommand: (result) => ipcRenderer.invoke('mirror:cast-result', result),
  onCastCommand: (callback) => {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on('mirror:cast-command', listener);
    return () => ipcRenderer.removeListener('mirror:cast-command', listener);
  },
  onPhoneMedia: (callback) => {
    const listener = (_event, url) => callback(url);
    ipcRenderer.on('mirror:phone-media', listener);
    return () => ipcRenderer.removeListener('mirror:phone-media', listener);
  },
  onSpotifyAuthStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('mirror:spotify-auth-status', listener);
    return () => ipcRenderer.removeListener('mirror:spotify-auth-status', listener);
  }
});
