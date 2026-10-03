const { app, BrowserWindow, ipcMain, session, shell, dialog } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs/promises');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Modern USB cameras work best with Electron's default Media Foundation path
// on Windows. Keep the legacy DirectShow workaround opt-in for a specific
// troublesome camera rather than breaking camera discovery on every laptop.
if (process.platform === 'win32' && process.env.MIRROR_FORCE_DIRECTSHOW === 'true') {
  app.commandLine.appendSwitch('disable-features', 'MediaFoundationVideoCapture');
}

const isDev = process.argv.includes('--dev');
const useKiosk = process.argv.includes('--kiosk') || process.env.MIRROR_KIOSK === 'true';
const memoryPath = path.join(__dirname, '..', 'data', 'memory.json');
const closetPath = path.join(__dirname, '..', 'data', 'closet.json');
const closetAssetDirectory = path.join(__dirname, '..', 'data', 'closet');
const tryOnDirectory = path.join(__dirname, '..', 'data', 'tryon');
const serviceUrls = Object.freeze({
  youtube: 'https://www.youtube.com/',
  netflix: 'https://www.netflix.com/',
  spotify: 'https://open.spotify.com/',
  findmy: 'https://www.icloud.com/find/',
  calendar: 'https://www.icloud.com/calendar/',
  photos: 'https://www.icloud.com/photos/',
  maps: 'https://www.google.com/maps/'
});
let mainWindow = null;

async function readMemory() {
  try {
    const parsed = JSON.parse(await fs.readFile(memoryPath, 'utf8'));
    return { version: 1, facts: Array.isArray(parsed.facts) ? parsed.facts.slice(-100) : [] };
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('[memory] read failed', error.message);
    return { version: 1, facts: [] };
  }
}

async function writeMemory(memory) {
  await fs.mkdir(path.dirname(memoryPath), { recursive: true });
  const temporaryPath = `${memoryPath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(memory, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryPath, memoryPath);
  return memory;
}

async function readCloset() {
  try {
    const parsed = JSON.parse(await fs.readFile(closetPath, 'utf8'));
    const garments = Array.isArray(parsed.garments) ? parsed.garments : [];
    return { version: 1, garments: garments.filter((item) => item?.id && item?.assetPath).map(publicGarment) };
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('[closet] read failed', error.message);
    return { version: 1, garments: [] };
  }
}

async function writeCloset(closet) {
  await fs.mkdir(path.dirname(closetPath), { recursive: true });
  await fs.writeFile(closetPath, `${JSON.stringify(closet, null, 2)}\n`, 'utf8');
  return closet;
}

function publicGarment(item) {
  return { id: item.id, name: item.name, category: item.category, createdAt: item.createdAt, imageUrl: pathToFileURL(item.assetPath).href };
}

async function importClosetGarment(event, input = {}) {
  const name = String(input.name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const category = String(input.category || 'other').replace(/[^a-z-]/gi, '').toLowerCase().slice(0, 30) || 'other';
  if (!name) throw new Error('Give the garment a name before importing it.');
  const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    title: 'Choose a front-facing garment image', properties: ['openFile'],
    filters: [{ name: 'Garment images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const source = result.filePaths[0];
  const id = `garment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const extension = path.extname(source).toLowerCase() || '.png';
  const destinationDir = path.join(closetAssetDirectory, id);
  const assetPath = path.join(destinationDir, `front${extension}`);
  await fs.mkdir(destinationDir, { recursive: true });
  await fs.copyFile(source, assetPath);
  const raw = await readClosetRaw();
  const item = { id, name, category, assetPath, createdAt: new Date().toISOString(), render: { layer: category === 'accessory' ? 'face' : 'body', source: 'front-image' } };
  raw.garments.push(item);
  await writeCloset(raw);
  return publicGarment(item);
}

async function queueTryOn(input = {}) {
  const garmentId = String(input.garmentId || '');
  const frameDataUrl = String(input.frameDataUrl || '');
  if (!garmentId || !frameDataUrl.startsWith('data:image/')) throw new Error('Choose a garment and capture a camera frame first.');
  if (Buffer.byteLength(frameDataUrl, 'utf8') > 8_000_000) throw new Error('Try-on frame is too large; step back from the mirror and try again.');
  const closet = await readClosetRaw();
  const garment = closet.garments.find((item) => item.id === garmentId);
  if (!garment) throw new Error('That garment is no longer in the local closet.');
  const id = `tryon-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await fs.mkdir(tryOnDirectory, { recursive: true });
  const framePath = path.join(tryOnDirectory, `${id}-person.jpg`);
  const encodedFrame = frameDataUrl.slice(frameDataUrl.indexOf(',') + 1);
  await fs.writeFile(framePath, Buffer.from(encodedFrame, 'base64'));
  const job = { id, status: 'captured-local', garmentId, garmentName: garment.name, framePath, createdAt: new Date().toISOString(), providerConfigured: Boolean(process.env.MIRROR_TRYON_ENDPOINT) };
  await fs.writeFile(path.join(tryOnDirectory, `${id}.json`), `${JSON.stringify(job, null, 2)}\n`, 'utf8');
  // Provider calls are intentionally not guessed. When a provider is selected,
  // its adapter owns its schema, credentials, retries, and consent wording.
  return { id, status: job.status, garmentName: garment.name, providerConfigured: job.providerConfigured };
}

async function readClosetRaw() {
  try {
    const parsed = JSON.parse(await fs.readFile(closetPath, 'utf8'));
    return { version: 1, garments: Array.isArray(parsed.garments) ? parsed.garments : [] };
  } catch (error) { if (error.code !== 'ENOENT') console.warn('[closet] raw read failed', error.message); return { version: 1, garments: [] }; }
}

async function rememberUserFact(input = {}) {
  const fact = String(input.fact || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const category = String(input.category || 'general').replace(/[^a-z0-9 _-]/gi, '').trim().slice(0, 40) || 'general';
  if (!fact) throw new Error('A non-empty fact is required');
  const memory = await readMemory();
  const normalized = fact.toLocaleLowerCase();
  const duplicate = memory.facts.some((item) => String(item.fact).toLocaleLowerCase() === normalized);
  if (!duplicate) memory.facts.push({ fact, category, learnedAt: new Date().toISOString() });
  memory.facts = memory.facts.slice(-100);
  return writeMemory(memory);
}

function safePublicConfig() {
  return {
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    geminiModel: process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview',
    geminiVoice: process.env.GEMINI_VOICE || 'Aoede',
    memoryPath,
    city: process.env.MIRROR_CITY || 'San Francisco',
    units: process.env.MIRROR_UNITS === 'metric' ? 'metric' : 'imperial',
    kiosk: useKiosk
  };
}

async function createGeminiToken() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured in .env');

  const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(Date.now() + 60 * 1000).toISOString();
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({ uses: 1, expireTime, newSessionExpireTime })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini token request failed (${response.status}): ${detail.slice(0, 240)}`);
  }

  const token = await response.json();
  if (!token.name) throw new Error('Gemini did not return an ephemeral token');
  return { token: token.name, expiresAt: token.expireTime || expireTime };
}

function registerBridge() {
  ipcMain.handle('mirror:get-config', () => safePublicConfig());
  ipcMain.handle('mirror:create-gemini-token', () => createGeminiToken());
  ipcMain.handle('mirror:read-memory', () => readMemory());
  ipcMain.handle('mirror:remember-fact', (_event, input) => rememberUserFact(input));
  ipcMain.handle('mirror:clear-memory', () => writeMemory({ version: 1, facts: [] }));
  ipcMain.handle('mirror:list-closet', () => readCloset());
  ipcMain.handle('mirror:import-closet-garment', (event, input) => importClosetGarment(event, input));
  ipcMain.handle('mirror:queue-tryon', (_event, input) => queueTryOn(input));
  ipcMain.handle('mirror:toggle-fullscreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    win.setFullScreen(!win.isFullScreen());
    return win.isFullScreen();
  });
  ipcMain.handle('mirror:open-service', async (_event, service) => {
    const target = serviceUrls[String(service || '').toLowerCase()];
    if (!target) throw new Error('That service is not available in the mirror launcher.');
    await shell.openExternal(target);
    return true;
  });
}

function createWindow() {
  const win = new BrowserWindow({
    // Vertical 43" TV portrait dimensions (9:16 aspect ratio)
    // 540x960 fits perfectly on laptop dev screens, scales natively to 1080x1920 / 4K on TV
    width: 540,
    height: 960,
    minWidth: 400,
    minHeight: 700,
    aspectRatio: 9 / 16,
    backgroundColor: '#000000',
    fullscreen: useKiosk,
    kiosk: useKiosk,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
  mainWindow = win;

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message}`);
  });

  if (isDev) win.webContents.openDevTools({ mode: 'detach' });

  // A portrait mirror normally runs for days. Recover the renderer if a GPU
  // driver or media stack wedges instead of leaving a black, unresponsive TV.
  let unresponsiveTimer = null;
  win.on('unresponsive', () => {
    console.warn('[watchdog] renderer became unresponsive; scheduling reload');
    clearTimeout(unresponsiveTimer);
    unresponsiveTimer = setTimeout(() => {
      if (!win.isDestroyed()) win.webContents.reloadIgnoringCache();
    }, 5000);
  });
  win.on('responsive', () => clearTimeout(unresponsiveTimer));
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[watchdog] renderer process gone', details.reason);
    if (!win.isDestroyed()) win.webContents.reloadIgnoringCache();
  });
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });
  return win;
}

app.whenReady().then(() => {
  registerBridge();

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media');
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
