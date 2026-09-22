const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Disable buggy Windows MediaFoundation video capture so Electron uses DirectShow for the integrated webcam
app.commandLine.appendSwitch('disable-features', 'MediaFoundationVideoCapture');

const isDev = process.argv.includes('--dev');
const useKiosk = process.argv.includes('--kiosk') || process.env.MIRROR_KIOSK === 'true';
const memoryPath = path.join(__dirname, '..', 'data', 'memory.json');

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
  ipcMain.handle('mirror:toggle-fullscreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    win.setFullScreen(!win.isFullScreen());
    return win.isFullScreen();
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

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message}`);
  });

  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
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
