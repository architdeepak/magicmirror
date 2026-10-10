// Permanent credentials stay in Electron's main process. No camera media is
// sent by this broker; it only mints a restricted, short-lived client token.
const MODEL = 'lucy-vton-3.5';
const DESTINATION = `decart:${MODEL}`;
class LiveTryOnTokens {
  constructor({ key, fetchImpl = fetch }) { this.key = key; this.fetch = fetchImpl; this.active = null; }
  cancel() { this.active?.abort(); this.active = null; }
  async create(input = {}) {
    if (input.consent !== true || input.destinationId !== DESTINATION) throw new Error('Confirm live camera sharing with Decart in Try On first.');
    const key = this.key();
    if (!key) throw new Error('Add a Decart API key in Settings to enable live AI try-on.');
    this.cancel();
    const controller = new AbortController();
    this.active = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await this.fetch('https://api.decart.ai/v1/client/tokens', {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: 60, allowedModels: [MODEL], constraints: { realtime: { maxSessionDuration: 600 } } })
      });
      if (!response.ok) throw new Error(`Decart token request returned HTTP ${response.status}.`);
      const text = await response.text();
      if (text.length > 32000) throw new Error('Invalid Decart token response.');
      const token = JSON.parse(text);
      controller.signal.throwIfAborted();
      if (this.active !== controller || this.key() !== key) throw new Error('Live try-on connection changed. Start again.');
      if (typeof token.apiKey !== 'string' || !token.apiKey || token.apiKey === key || token.apiKey.length > 16000) throw new Error('Decart returned no usable client token.');
      return { apiKey: token.apiKey, expiresAt: token.expiresAt, model: MODEL, maxSessionSeconds: 600 };
    } finally {
      clearTimeout(timeout);
      if (this.active === controller) this.active = null;
    }
  }
}
module.exports = { LiveTryOnTokens, MODEL, DESTINATION };
