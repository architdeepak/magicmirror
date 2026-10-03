// Browser-only mirror preview for an SSH-connected development machine.
// Binds exclusively to localhost; use an SSH tunnel rather than exposing it.
const http = require('http');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });
const host = process.env.MIRROR_PREVIEW_HOST || '127.0.0.1';
const port = Number(process.env.MIRROR_PREVIEW_PORT || 8787);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.bin': 'application/octet-stream', '.data': 'application/octet-stream', '.task': 'application/octet-stream', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };

const sendJson = (response, status, payload) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
};

async function createGeminiToken() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on the preview host.');
  const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(Date.now() + 60 * 1000).toISOString();
  const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ uses: 1, expireTime, newSessionExpireTime })
  });
  const payload = await upstream.json().catch(() => ({}));
  if (!upstream.ok || !payload.name) throw new Error(`Gemini token request failed (${upstream.status}).`);
  return { token: payload.name, expiresAt: payload.expireTime || expireTime };
}

http.createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${host}`).pathname);
  if (pathname === '/api/config' && request.method === 'GET') {
    sendJson(response, 200, { hasGeminiKey: Boolean(process.env.GEMINI_API_KEY), geminiModel: process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview', geminiVoice: process.env.GEMINI_VOICE || 'Aoede', city: process.env.MIRROR_CITY || 'San Francisco', units: process.env.MIRROR_UNITS === 'metric' ? 'metric' : 'imperial' });
    return;
  }
  if (pathname === '/api/gemini-token' && request.method === 'POST') {
    try { sendJson(response, 200, await createGeminiToken()); }
    catch (error) { sendJson(response, 502, { error: error.message }); }
    return;
  }
  const requested = path.resolve(root, `.${pathname === '/' ? '/src/index.html' : pathname}`);
  if (requested !== root && !requested.startsWith(`${root}${path.sep}`)) { response.writeHead(403); response.end('Forbidden'); return; }
  fs.stat(requested, (statError, stat) => {
    if (statError || !stat.isFile()) { response.writeHead(404); response.end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': types[path.extname(requested).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' });
    fs.createReadStream(requested).pipe(response);
  });
}).listen(port, host, () => console.log(`Mirror browser preview: http://${host}:${port}/src/index.html`));
