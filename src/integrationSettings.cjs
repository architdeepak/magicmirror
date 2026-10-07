const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const fields = ['geminiApiKey', 'spotifyClientId', 'tryOnProvider', 'tryOnEndpoint', 'tryOnApiKey', 'tryOnProject', 'tryOnLocation', 'decartApiKey'];

class IntegrationSettings {
  constructor(directory, safeStorage) {
    this.filename = path.join(directory, 'integration-settings.bin');
    this.safeStorage = safeStorage;
    this.settings = {};
    this.sessionOnly = false;
    this.loadError = '';
    this.saving = false;
  }
  secureStorageAvailable() {
    return this.safeStorage.isEncryptionAvailable()
      && this.safeStorage.getSelectedStorageBackend?.() !== 'basic_text';
  }
  value(name, fallback = '') { return Object.hasOwn(this.settings, name) ? this.settings[name] : fallback; }
  async load() {
    if (!this.secureStorageAvailable()) return;
    try {
      const contents = JSON.parse(this.safeStorage.decryptString(await fs.readFile(this.filename)));
      for (const field of fields) {
        if (typeof contents[field] === 'string') this.settings[field] = contents[field];
      }
    } catch (error) {
      if (error.code !== 'ENOENT') this.loadError = 'Saved connections could not be unlocked. Enter them again in Settings.';
    }
  }
  async save(input = {}) {
    if (this.saving) throw new Error('Wait for the previous settings save to finish.');
    const next = { ...this.settings };
    for (const field of fields) {
      if (!Object.hasOwn(input, field)) continue;
      if (typeof input[field] !== 'string') throw new Error('Connection details must be text.');
      const value = input[field].trim();
      if (value.length > (field === 'tryOnEndpoint' ? 2048 : field === 'tryOnApiKey' ? 2048 : 256) || /[\s\x00-\x1f]/.test(value)) throw new Error('Connection details contain invalid characters.');
      next[field] = value;
    }
    if (Object.hasOwn(next, 'tryOnProvider') && !['off', 'custom', 'vertex'].includes(next.tryOnProvider)) throw new Error('Choose Off, Custom renderer, or Google Cloud for try-on.');
    if (next.tryOnEndpoint) {
      let url; try { url = new URL(next.tryOnEndpoint); } catch { throw new Error('Enter a valid try-on renderer URL.'); }
      const local = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if (url.protocol !== 'https:' && !local) throw new Error('Use HTTPS for a remote try-on renderer, or HTTP on localhost.');
      if (url.username || url.password || url.hash) throw new Error('Put renderer credentials in the token field and remove URL fragments.');
    }
    if (next.tryOnProject && !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(next.tryOnProject)) throw new Error('Enter a valid Google Cloud project ID.');
    if (next.tryOnLocation && !/^[a-z]+(?:-[a-z0-9]+)+$/.test(next.tryOnLocation)) throw new Error('Enter a valid Google Cloud region.');
    if (next.tryOnProvider === 'custom' && !next.tryOnEndpoint) throw new Error('Enter the custom try-on renderer URL.');
    if (next.tryOnProvider === 'vertex' && !next.tryOnProject) throw new Error('Enter your Google Cloud project ID.');
    if (input.clearGemini === true) next.geminiApiKey = '';
    const remember = input.remember !== false;
    if (remember && !this.secureStorageAvailable()) throw new Error('Encrypted storage is unavailable. Turn off “Remember on this device” to use this session only.');
    this.saving = true;
    try {
      if (remember) {
        const encrypted = this.safeStorage.encryptString(JSON.stringify(next));
        await fs.mkdir(path.dirname(this.filename), { recursive: true });
        const temporary = `${this.filename}.tmp`;
        await fs.writeFile(temporary, encrypted, { mode: 0o600 });
        await fs.rename(temporary, this.filename);
      }
      this.settings = next;
      this.sessionOnly = !remember;
      this.loadError = '';
      return { remembered: remember };
    } finally { this.saving = false; }
  }
}
function tryOnConnection(settings, env = {}) {
  const endpoint = String(settings.value('tryOnEndpoint', env.MIRROR_TRYON_ENDPOINT || '')).trim();
  const project = String(settings.value('tryOnProject', env.MIRROR_VERTEX_PROJECT || '')).trim();
  const location = String(settings.value('tryOnLocation', env.MIRROR_VERTEX_LOCATION || 'us-central1')).trim() || 'us-central1';
  const provider = settings.value('tryOnProvider', project ? 'vertex' : endpoint ? 'custom' : 'off');
  const apiKey = settings.value('tryOnApiKey', env.MIRROR_TRYON_API_KEY || '');
  let host = ''; try { if (provider === 'custom') host = new URL(endpoint).host; } catch {}
  if (provider === 'vertex' && project) host = `${location}-aiplatform.googleapis.com`;
  const destinationId = crypto.createHash('sha256').update(JSON.stringify([provider, provider === 'custom' ? endpoint : '', provider === 'vertex' ? project : '', provider === 'vertex' ? location : ''])).digest('hex');
  return { provider, endpoint, project, location, apiKey, host, destinationId,
    configured: provider === 'vertex' ? Boolean(project) : provider === 'custom' ? Boolean(endpoint) : false };
}
module.exports = { IntegrationSettings, tryOnConnection };
