// Browser-preview equivalent of Electron's narrow preload bridge. The preview
// server is deliberately bound to 127.0.0.1, and only short-lived Gemini tokens
// cross this boundary; the long-lived API key stays on the Spark.
(() => {
  if (window.mirrorBridge) return;
  const services = {
    youtube: 'https://www.youtube.com/', netflix: 'https://www.netflix.com/',
    spotify: 'https://open.spotify.com/', findmy: 'https://www.icloud.com/find/',
    calendar: 'https://www.icloud.com/calendar/', photos: 'https://www.icloud.com/photos/',
    maps: 'https://www.google.com/maps/'
  };
  const memoryKey = 'mirror.preview.memory';
  const closetKey = 'mirror.preview.closet';
  const getMemory = () => {
    try { return JSON.parse(localStorage.getItem(memoryKey)) || { version: 1, facts: [] }; }
    catch { return { version: 1, facts: [] }; }
  };
  const saveMemory = (memory) => {
    const next = { version: 1, facts: Array.isArray(memory?.facts) ? memory.facts.slice(-100) : [] };
    localStorage.setItem(memoryKey, JSON.stringify(next));
    return next;
  };
  const getCloset = () => {
    try { return JSON.parse(localStorage.getItem(closetKey)) || { version: 1, garments: [] }; }
    catch { return { version: 1, garments: [] }; }
  };
  const request = async (url, options) => {
    const response = await fetch(url, options);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Preview bridge failed (${response.status})`);
    return body;
  };
  window.mirrorBridge = {
    getConfig: () => request('/api/config'),
    createGeminiToken: () => request('/api/gemini-token', { method: 'POST' }),
    readMemory: async () => getMemory(),
    listCloset: async () => getCloset(),
    rememberFact: async ({ fact, category = 'general' } = {}) => {
      const memory = getMemory();
      const value = String(fact || '').trim().slice(0, 300);
      if (value && !memory.facts.some((item) => item.fact?.toLowerCase() === value.toLowerCase())) {
        memory.facts.push({ fact: value, category, learnedAt: new Date().toISOString() });
      }
      return saveMemory(memory);
    },
    clearMemory: async () => saveMemory({ version: 1, facts: [] }),
    toggleFullscreen: async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      return Boolean(document.fullscreenElement);
    },
    openService: async (service) => {
      const url = services[String(service || '').toLowerCase()];
      if (!url) throw new Error('That service is not available in the mirror launcher.');
      window.open(url, '_blank', 'noopener,noreferrer');
      return true;
    }
  };
})();
