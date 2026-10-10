const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

// Serve only the isolated player document and its own bridge on loopback.
// A distinct HTTP origin prevents provider scripts from reaching mirrorBridge
// in the privileged file:// renderer, while allowing the official player API.
async function createYouTubePlayerServer() {
  const access = crypto.randomBytes(24).toString('hex');
  const [html, script] = await Promise.all([
    fs.readFile(path.join(__dirname, 'youtube-player.html'), 'utf8'),
    fs.readFile(path.join(__dirname, 'youtubePlayerFrame.js'), 'utf8')
  ]);
  const server = http.createServer((request, response) => {
    const host = `127.0.0.1:${server.address().port}`;
    let url;
    try { url = new URL(request.url, `http://${host}`); }
    catch { response.writeHead(400); response.end(); return; }
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (request.method !== 'GET' || request.headers.host !== host || url.searchParams.get('access') !== access) {
      response.writeHead(403); response.end(); return;
    }
    if (url.pathname === '/player') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(html.replace('src="youtubePlayerFrame.js"', `src="/frame.js?access=${access}"`));
    } else if (url.pathname === '/frame.js') {
      response.setHeader('Content-Type', 'application/javascript; charset=utf-8'); response.end(script);
    } else { response.writeHead(404); response.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { url: `http://127.0.0.1:${server.address().port}/player?access=${access}`, close: () => server.close() };
}
module.exports = { createYouTubePlayerServer };
