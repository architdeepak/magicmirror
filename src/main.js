const { app, BrowserWindow, ipcMain, session, shell, dialog, nativeImage, safeStorage, desktopCapturer, screen, powerMonitor } = require('electron');
const { assertBrowserAccountReady } = require('./browserAccountBoundary.cjs');
const { DesktopNavigation } = require('./desktopNavigation.cjs');
const desktopNavigation = new DesktopNavigation({onRetire:browser=>{if(desktopWindow===browser)desktopWindow=null;}});
const { wardrobePhotoBytes } = require('./wardrobePhotoValidation.cjs');
const photoSourceValidation = import('./photoSourceValidation.mjs');
const { LookbookStore } = require('./lookbookStore.cjs');
const {createWakeModelServer}=require('./wakeModelServer.cjs');
let wakeModelServer;
const path = require('path');
const { pathToFileURL } = require('url');
const http = require('http');
const os = require('os');
const crypto = require('crypto');
const fs = require('fs/promises');
const dotenv = require('dotenv');
const QRCode = require('qrcode');
const { GoogleAuth } = require('google-auth-library');
const { CodexMirrorAgent } = require('./codexMirrorAgent');
const { TryOnRequests } = require('./tryOnRequests.cjs');
const tryOnRequests = new TryOnRequests();
const { createNativeDesktop, nativeAction, sameForeground, NATIVE_KEYS } = require('./nativeDesktop.cjs');
const { managedKeyEvents, MANAGED_KEYS } = require('./managedBrowserKeys.cjs');
const { createCastReceiver } = require('./castReceiver.cjs');
const { NativeCompanion } = require('./nativeCompanion.cjs');
const { createWindowsSpotify } = require('./windowsSpotify.cjs');
const windowsSpotify = createWindowsSpotify();
const { IntegrationSettings, tryOnConnection } = require('./integrationSettings.cjs');
const { createYouTubePlayerServer } = require('./youtubePlayerServer.cjs');
let youtubePlayerServer = null;

// Keep application data and Chromium storage in the same explicitly selected profile.
const profileDirectory = app.commandLine.getSwitchValue('user-data-dir');
if (profileDirectory) app.setPath('userData', path.resolve(profileDirectory));
const ownsInstanceLock = app.requestSingleInstanceLock();
if (!ownsInstanceLock) app.quit();

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Modern USB cameras work best with Electron's default Media Foundation path
// on Windows. Keep the legacy DirectShow workaround opt-in for a specific
// troublesome camera rather than breaking camera discovery on every laptop.
if (process.platform === 'win32' && process.env.MIRROR_FORCE_DIRECTSHOW === 'true') {
  app.commandLine.appendSwitch('disable-features', 'MediaFoundationVideoCapture');
}

const isDev = process.argv.includes('--dev');
let useKiosk = process.argv.includes('--kiosk') || process.env.MIRROR_KIOSK === 'true';
const writableDataDirectory = app.isPackaged ? path.join(app.getPath('userData'), 'data') : path.join(__dirname, '..', 'data');
const memoryPath = path.join(writableDataDirectory, 'memory.json');
const closetPath = path.join(writableDataDirectory, 'closet.json');
const closetAssetDirectory = path.join(writableDataDirectory, 'closet');
const tryOnDirectory = path.join(writableDataDirectory, 'tryon');
const integrationSettings = new IntegrationSettings(app.getPath('userData'), safeStorage);
const { LiveTryOnTokens, DESTINATION: liveTryOnDestinationId } = require('./liveTryOnTokens.cjs');
const decartApiKey = () => integrationSettings.value('decartApiKey', process.env.DECART_API_KEY || '');
const liveTryOnTokens = new LiveTryOnTokens({ key: decartApiKey });
const spotifyTokenPath = () => path.join(app.getPath('userData'), 'spotify-tokens.bin');
const lookCaptures = new TryOnRequests();
const lookbook = new LookbookStore(path.join(writableDataDirectory, 'lookbook'), bytes => {
  const image = nativeImage.createFromBuffer(bytes);
  if (image.isEmpty()) throw new Error('Invalid look photo.');
  return image.toPNG();
});

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
let desktopWindow = null;
let phoneLinkServer = null;
let phoneLinkToken = '';
let phoneLinkHost = '';
let wardrobePhoneWaiting = false;
let wardrobePhoneGeneration=0,wardrobePhoneReceiving=false;
let spotifyTokens = null;
let spotifyAuthServer = null;
let spotifyAuthState = '';
let spotifyAuthVerifier = '';
let spotifyAuthTimeout = null;
let spotifyControlBusy = false;
let spotifyGeneration = 0;
let spotifyStorageQueue = Promise.resolve();
let lastScreenObservation = null;
let desktopObservationGeneration = 0;
const nativeDesktop = createNativeDesktop();
let desktopActionAbort = null;
let castReceiver = null;
const castCommands = new Map();

async function startCastReceiver() {
  if (castReceiver) return castReceiver.details();
  const host = findLanIPv4();
  if (!host) throw new Error('Connect the mirror to Wi-Fi or Ethernet before enabling casting.');
  const digest = crypto.createHash('sha256').update(`${os.hostname()}:${app.getPath('userData')}`).digest('hex');
  const deviceId = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
  castReceiver = createCastReceiver({ host, name: 'Reflect Mirror', id: deviceId, onCommand: (command) => new Promise((resolve, reject) => {
    if (!mainWindow || mainWindow.isDestroyed()) { reject(new Error('The mirror display is unavailable.')); return; }
    const id = crypto.randomUUID();
    const timeout = setTimeout(() => { castCommands.delete(id); reject(new Error('The mirror player did not respond.')); }, 8000);
    castCommands.set(id, { resolve, reject, timeout });
    if (['load', 'play'].includes(command.action)) {
      prepareWatchPresentation();
    }
    mainWindow.webContents.send('mirror:cast-command', { ...command, id });
  }) });
  try { return await castReceiver.start(); }
  catch (error) { castReceiver = null; throw new Error(`Casting could not start: ${error.message}`); }
}

async function stopCastReceiver() {
  const receiver = castReceiver; castReceiver = null;
  for (const entry of castCommands.values()) { clearTimeout(entry.timeout); entry.reject(new Error('Casting stopped.')); }
  castCommands.clear();
  await receiver?.stop();
  return true;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function phoneSessionAuthorized(request) {
  if (!phoneLinkToken) return false;
  const cookie = String(request.headers.cookie || '').split(';').map((part) => part.trim());
  const sessionCookie = cookie.find((part) => part.startsWith('mirror_pair='));
  return safeEqual(sessionCookie?.slice('mirror_pair='.length), phoneLinkToken);
}

function supportedPhoneMediaUrl(value) {
  let target;
  try { target = new URL(String(value || '').trim()); }
  catch { throw new Error('Paste a valid YouTube, Spotify, or direct video URL.'); }
  if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password) {
    throw new Error('Use a public http(s) media link without embedded credentials.');
  }
  const host = target.hostname.toLowerCase().replace(/^www\./, '');
  const supportedService = host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'open.spotify.com';
  const directVideo = /\.(?:mp4|webm|ogg)$/i.test(target.pathname);
  if (!supportedService && !directVideo) throw new Error('This link type is not supported. Send YouTube, Spotify, or a direct video link.');
  return target.href;
}

function normalizeExternalWebUrl(value) {
  let target;
  try { target = new URL(String(value || '').trim()); }
  catch { throw new Error('Give me a valid website URL beginning with https:// or http://.'); }
  if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password || !target.hostname) {
    throw new Error('Only public web pages using HTTP or HTTPS can be opened.');
  }
  return target.href;
}

const nativeCompanion = new NativeCompanion({ getWindow: () => mainWindow, screen, onChange: notifyDesktopPresentation, onInvalidate: () => { invalidateDesktopObservation(); desktopActionAbort?.abort(); } });

function desktopPresentation() {
  if (nativeCompanion.active) return nativeCompanion.presentation();
  const active = Boolean(desktopWindow && !desktopWindow.isDestroyed() && desktopWindow.isVisible());
  return { active, kind: active ? 'browser' : null };
}

function notifyDesktopPresentation() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('mirror:desktop-presentation', desktopPresentation());
}
function prepareWatchPresentation(){
  desktopNavigation.cancel();invalidateDesktopObservation();desktopActionAbort?.abort();
  nativeCompanion.exit();
  if(desktopWindow&&!desktopWindow.isDestroyed())desktopWindow.hide();
  mainWindow.show();mainWindow.focus();
}

function layoutDesktopWindow() {
  nativeCompanion.layout();
  if (!mainWindow || mainWindow.isDestroyed() || !desktopWindow || desktopWindow.isDestroyed()) return;
  const bounds = mainWindow.getContentBounds();
  // Match the renderer's centered portrait surface. Reserve its bottom third
  // for the host, two caption lines, Listen/Stop, and hard mute.
  const width = Math.min(bounds.width, bounds.height * 9 / 16);
  const height = Math.min(bounds.height, bounds.width * 16 / 9);
  const margin = Math.max(6, Math.round(width * .014));
  desktopWindow.setBounds({
    x: Math.round(bounds.x + (bounds.width - width) / 2 + margin),
    y: Math.round(bounds.y + (bounds.height - height) / 2 + margin),
    width: Math.max(100, Math.round(width - margin * 2)),
    height: Math.max(100, Math.round(height * .68 - margin))
  });
  // Coordinates from earlier screenshots no longer describe this layout.
  invalidateDesktopObservation();
}

async function openDesktopWebpage(value) {
  const target = normalizeExternalWebUrl(value);
  const navigation = desktopNavigation.begin();
  nativeCompanion.exit();
  if (!desktopWindow || desktopWindow.isDestroyed()) {
    desktopWindow = new BrowserWindow({
      parent: mainWindow || undefined,
      show: false,
      width: 540,
      height: 650,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      movable: false,
      title: 'Mirror Desktop',
      autoHideMenuBar: true,
      webPreferences: {
        partition: 'persist:mirror-desktop',
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true
      }
    });
    const browser = desktopWindow;
    browser.webContents.setWindowOpenHandler(({ url }) => {
      try { void openNativeApplication(normalizeExternalWebUrl(url), 'Browser').catch(() => {}); } catch {}
      return { action: 'deny' };
    });
    browser.webContents.on('will-navigate', (event, url) => {
      try { normalizeExternalWebUrl(url); }
      catch { event.preventDefault(); }
    });
    // URL and bounds can remain identical across reload/SPA transitions.
    // Retire observations at both navigation start and commit, including any
    // captured while the next document was loading. Ignore retired windows.
    const invalidateNavigation = () => {
      if (desktopWindow !== browser || browser.isDestroyed()) return;
      invalidateDesktopObservation();
      desktopActionAbort?.abort();
    };
    browser.webContents.on('did-start-navigation', details => {
      if (details.isMainFrame) invalidateNavigation();
    });
    browser.webContents.on('did-navigate', invalidateNavigation);
    browser.webContents.on('did-navigate-in-page', (_event, _url, isMainFrame) => {
      if (isMainFrame) invalidateNavigation();
    });
    browser.on('show', notifyDesktopPresentation);
    browser.on('hide', notifyDesktopPresentation);
    browser.on('closed', () => {
      if (desktopWindow && desktopWindow !== browser) return;
      if (desktopWindow === browser) desktopWindow = null;
      invalidateDesktopObservation();
      notifyDesktopPresentation();
      if (nativeCompanion.active) return;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        if (useKiosk) mainWindow.setFullScreen(true);
      }
    });
  }
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  layoutDesktopWindow();
  const browser = desktopWindow;
  desktopNavigation.attach(navigation,browser);
  try { await browser.loadURL(target); }
  catch (error) {
    desktopNavigation.assertCurrent(navigation);
    desktopNavigation.finish(navigation);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
    if (!browser.isDestroyed()) browser.close();
    throw new Error(`The desktop browser could not open that page: ${error.message}`);
  }
  desktopNavigation.assertCurrent(navigation);
  if (browser.isDestroyed()) throw new Error('The desktop browser closed before the page loaded.');
  desktopNavigation.finish(navigation);
  browser.show();
  layoutDesktopWindow();
  notifyDesktopPresentation();
  browser.focus();
  return { ok: true, url: target };
}

async function closeDesktopWindow() {
  desktopNavigation.cancel();
  nativeCompanion.exit();
  const browser=desktopWindow;desktopWindow=null;
  if (browser && !browser.isDestroyed()) browser.close();
  else if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    if (useKiosk) mainWindow.setFullScreen(true);
  }
  notifyDesktopPresentation();
  return true;
}

function resizeForAssistant(image) {
  const { width, height } = image.getSize();
  return width > 1280 ? image.resize({ width: 1280, height: Math.round(height * 1280 / width), quality: 'good' }) : image;
}

function invalidateDesktopObservation() {
  desktopObservationGeneration += 1;
  lastScreenObservation = null;
}

async function captureCurrentScreen({ recordObservation = false, signal } = {}) {
  if (recordObservation) invalidateDesktopObservation();
  const generation = desktopObservationGeneration;
  const assertCurrent = () => {
    if (signal?.aborted || generation !== desktopObservationGeneration) throw new Error('Screen observation cancelled or superseded. Inspect again.');
  };
  assertCurrent();
  await assertBrowserAccountReady(desktopWindow); assertCurrent();
  if (nativeCompanion.active && /spotify/i.test(nativeCompanion.label)) throw new Error('Spotify content stays local. Return to the mirror before sharing the screen.');
  const targetWindow = desktopWindow && !desktopWindow.isDestroyed() && desktopWindow.isVisible()
    ? desktopWindow : mainWindow;
  if (!targetWindow || targetWindow.isDestroyed()) throw new Error('There is no mirror display to inspect.');
  const openWindows = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 0, height: 0 } });
  assertCurrent();
  const foreground = nativeDesktop.supported ? await nativeDesktop.inspect(signal) : null;
  assertCurrent();
  if (!nativeDesktop.supported && openWindows.some((source) => /spotify/i.test(source.name || ''))) {
    throw new Error('Spotify is open. Its screen content stays local and cannot be shared with AI input.');
  }
  const targetDisplay = screen.getDisplayMatching(targetWindow.getBounds());
  const displays = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1280, height: 2560 }
  });
  assertCurrent();
  const displaySource = displays.find((source) => source.display_id === String(targetDisplay.id)) || (displays.length === 1 ? displays[0] : null);
  if (!displaySource) throw new Error('The TV display could not be captured. Check screen-recording permission and try again.');
  await assertBrowserAccountReady(desktopWindow); assertCurrent();
  const image = resizeForAssistant(displaySource.thumbnail);
  if (foreground && !sameForeground(foreground, await nativeDesktop.inspect(signal))) throw new Error('Desktop focus changed during capture. Inspect the screen again.');
  assertCurrent();
  const size = image.getSize();
  if (image.isEmpty() || !size.width || !size.height) throw new Error('The visible screen could not be captured. Check screen-recording permission and try again.');
  const displayBounds = targetDisplay.bounds;
  const contentBounds = desktopWindow && !desktopWindow.isDestroyed() && desktopWindow.isVisible()
    ? desktopWindow.getContentBounds() : null;
  const browserRect = contentBounds ? {
    x: Math.round((contentBounds.x - displayBounds.x) * size.width / displayBounds.width),
    y: Math.round((contentBounds.y - displayBounds.y) * size.height / displayBounds.height),
    width: Math.round(contentBounds.width * size.width / displayBounds.width),
    height: Math.round(contentBounds.height * size.height / displayBounds.height)
  } : null;
  const observation = {
    id: crypto.randomUUID(),
    capturedAt: Date.now(),
    displayId: String(targetDisplay.id),
    url: desktopWindow && !desktopWindow.isDestroyed() && desktopWindow.isVisible() ? desktopWindow.webContents.getURL() : '',
    width: size.width,
    height: size.height,
    browserRect,
    displayBounds: { ...displayBounds },
    foreground
  };
  if (recordObservation) lastScreenObservation = observation;
  return {
    dataUrl: `data:image/jpeg;base64,${image.toJPEG(78).toString('base64')}`,
    width: size.width,
    height: size.height,
    target: `TV display ${targetDisplay.id}`,
    displayId: String(targetDisplay.id),
    url: observation.url,
    browserRect,
    inputTarget: nativeDesktop.supported ? 'windows-desktop' : 'managed-browser',
    supportedKeys: nativeDesktop.supported ? NATIVE_KEYS : MANAGED_KEYS,
    foreground: foreground ? { processName: foreground.processName, title: foreground.title } : null,
    snapshotId: observation.id
  };
}

async function performDesktopAction(input = {}) {
  if (desktopActionAbort) throw new Error('A desktop action is still running. Wait for its result before sending another.');
  const controller = new AbortController();
  desktopActionAbort = controller;
  try { return await performObservedDesktopAction(input, controller.signal); }
  finally { if (desktopActionAbort === controller) desktopActionAbort = null; }
}

async function performObservedDesktopAction(input = {}, signal) {
  const browser = desktopWindow;
  const action = String(input.action || '');
  if (action === 'close_browser') { await closeDesktopWindow(); return { result: 'closed assistant browser and returned to mirror' }; }
  const observation = lastScreenObservation;
  if (!observation || !input.snapshotId || input.snapshotId !== observation.id || Date.now() - observation.capturedAt > 30_000) {
    lastScreenObservation = null;
    throw new Error('Capture the current screen immediately before each desktop action; the previous screenshot is missing, expired, or already used.');
  }
  lastScreenObservation = null;
  let pageHost = '';
  try { pageHost = new URL(browser?.webContents.getURL()).hostname.toLowerCase(); } catch {}
  if (pageHost === 'spotify.com' || pageHost.endsWith('.spotify.com')) throw new Error('Use the local Music player or Spotify app controls for Spotify.');
  const capture = await captureCurrentScreen({ signal });
  if (signal.aborted) throw new Error('Desktop action cancelled.');
  if (capture.displayId !== observation.displayId || capture.width !== observation.width || capture.height !== observation.height) throw new Error('The display changed since that screenshot. Inspect it again.');
  if (nativeDesktop.supported) {
    const foreground = await nativeDesktop.inspect(signal);
    if (!sameForeground(observation.foreground, foreground)) throw new Error('Desktop focus changed since that screenshot. Inspect it again.');
    const rect = foreground.bounds;
    const topLeft = screen.screenToDipPoint({ x: rect.x, y: rect.y });
    const bottomRight = screen.screenToDipPoint({ x: rect.x + rect.width, y: rect.y + rect.height });
    const display = observation.displayBounds;
    if (bottomRight.x <= display.x || topLeft.x >= display.x + display.width || bottomRight.y <= display.y || topLeft.y >= display.y + display.height) throw new Error('The focused app is on another display. Bring it onto the TV, then inspect again.');
    const command = nativeAction(input, observation, (point) => screen.dipToScreenPoint(point));
    if (Date.now() - observation.capturedAt > 30_000) throw new Error('That screenshot expired while preparing the action. Inspect again.');
    return nativeDesktop.perform(command, signal);
  }
  if (!browser || browser.isDestroyed() || !browser.isVisible()) throw new Error('Open a website in the assistant desktop before using computer controls on this platform.');
  const browserRect = capture.browserRect;
  if (!browserRect?.width || !browserRect?.height) throw new Error('The managed browser is not visible on the TV display.');
  const sameRect = ['x', 'y', 'width', 'height'].every((key) => Math.abs(browserRect[key] - observation.browserRect?.[key]) <= 2);
  if (capture.displayId !== observation.displayId || capture.url !== observation.url || capture.width !== observation.width || capture.height !== observation.height || !sameRect) {
    throw new Error('The screen changed since that screenshot. Inspect the current display and try the action again.');
  }
  const [viewWidth, viewHeight] = browser.getContentSize();
  const toViewPoint = () => {
    const x = Number(input.x); const y = Number(input.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < browserRect.x || y < browserRect.y || x >= browserRect.x + browserRect.width || y >= browserRect.y + browserRect.height) {
      throw new Error(`Choose a screen point inside the browser content at x ${browserRect.x}, y ${browserRect.y}, width ${browserRect.width}, height ${browserRect.height}.`);
    }
    return {
      x: Math.round((x - browserRect.x) * viewWidth / browserRect.width),
      y: Math.round((y - browserRect.y) * viewHeight / browserRect.height)
    };
  };
  browser.focus();
  if (action === 'click' || action === 'double_click') {
    const point = toViewPoint();
    browser.webContents.sendInputEvent({ type: 'mouseMove', ...point });
    browser.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point });
    browser.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point });
    if (action === 'double_click') {
      browser.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 2, ...point });
      browser.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 2, ...point });
    }
    return { result: action === 'double_click' ? 'double-clicked' : 'clicked', ...point };
  }
  if (action === 'type_text') {
    const text = String(input.text || '').slice(0, 4000);
    if (!text) throw new Error('There is no text to enter.');
    await browser.webContents.insertText(text);
    return { result: 'entered text', characters: text.length };
  }
  if (action === 'press_key') {
    for (const event of managedKeyEvents(input.key)) browser.webContents.sendInputEvent(event);
    return { result: `pressed ${String(input.key).toLowerCase()}` };
  }
  if (action === 'scroll') {
    const point = toViewPoint();
    const deltaY = Math.max(-900, Math.min(900, Math.trunc(Number(input.deltaY) || 0)));
    if (!deltaY) throw new Error('Give scroll a nonzero deltaY.');
    browser.webContents.sendInputEvent({ type: 'mouseWheel', ...point, deltaY: -deltaY, deltaX: 0 });
    return { result: 'scrolled', deltaY };
  }
  throw new Error('Allowed computer actions: click, double_click, type_text, press_key, scroll, close_browser.');
}

async function scrollDesktopFromGesture(direction) {
  if (!['up', 'down'].includes(direction)) throw new Error('Use up or down for gesture scrolling.');
  if (desktopActionAbort) throw new Error('Wait for the assistant’s desktop action to finish before scrolling.');
  if (nativeCompanion.active) {
    if (!nativeDesktop.supported) throw new Error('Native hand scrolling is available on Windows. Return to mirror for managed-browser scrolling.');
    const area = nativeCompanion.exposedBounds();
    if (!area) throw new Error('The native app is no longer visible.');
    const controller = new AbortController(); desktopActionAbort = controller;
    invalidateDesktopObservation();
    try {
      const first = screen.dipToScreenPoint({ x: Math.ceil(area.x), y: Math.ceil(area.y) });
      const last = screen.dipToScreenPoint({ x: Math.floor(area.x + area.width), y: Math.floor(area.y + area.height) });
      const point = screen.dipToScreenPoint({ x: Math.round(area.x + area.width / 2), y: Math.round(area.y + area.height / 2) });
      const handle = mainWindow.getNativeWindowHandle();
      const mirrorWindowId = handle.length >= 8 ? handle.readBigInt64LE().toString() : String(handle.readUInt32LE());
      return await nativeDesktop.scrollFromGesture({ ...point, deltaY: direction === 'down' ? 360 : -360, mirrorWindowId,
        bounds: { left: first.x, top: first.y, right: last.x, bottom: last.y } }, controller.signal);
    } finally { if (desktopActionAbort === controller) desktopActionAbort = null; }
  }
  const browser = desktopWindow;
  if (!browser || browser.isDestroyed() || !browser.isVisible()) throw new Error('Open a website before scrolling it with your hand.');
  const [width, height] = browser.getContentSize();
  invalidateDesktopObservation();
  browser.focus();
  // Input goes only to our managed browser. This is direct user input, not
  // an AI action authorized by an earlier screenshot.
  browser.webContents.sendInputEvent({ type: 'mouseWheel', x: Math.round(width / 2), y: Math.round(height / 2),
    deltaY: direction === 'down' ? -Math.round(height * .65) : Math.round(height * .65), deltaX: 0 });
  return { result: `scroll input sent ${direction}` };
}

function spotifyClientId() { return String(integrationSettings.value('spotifyClientId', process.env.MIRROR_SPOTIFY_CLIENT_ID || '')).trim(); }
function spotifyConfigured() { return Boolean(spotifyClientId()); }

async function openNativeApplication(target, label) {
  if (desktopWindow && !desktopWindow.isDestroyed()) desktopWindow.hide();
  const presented = nativeCompanion.enter(label);
  try { await shell.openExternal(target); }
  catch (error) { if (presented) nativeCompanion.exit(); throw error; }
  return { ok: true, target, companion: presented, launchRequested: true };
}

async function openSpotifyService() {
  try { await openNativeApplication('spotify:', 'Spotify'); return { ok: true, target: 'spotify-app', companion: nativeCompanion.active, launchRequested: true }; }
  catch { return openDesktopWebpage(serviceUrls.spotify); }
}

async function loadSpotifyTokens() {
  if (!spotifyConfigured() || !integrationSettings.secureStorageAvailable()) return;
  try {
    const encrypted = await fs.readFile(spotifyTokenPath());
    const saved = JSON.parse(safeStorage.decryptString(encrypted));
    if (saved.clientId === spotifyClientId()) spotifyTokens = saved;
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('[spotify] stored authorization could not be loaded', error.message);
  }
}

function persistSpotifyTokens() {
  if (integrationSettings.sessionOnly || !integrationSettings.secureStorageAvailable()) return Promise.resolve();
  const generation = spotifyGeneration;
  const encrypted = safeStorage.encryptString(JSON.stringify(spotifyTokens));
  const operation = spotifyStorageQueue.catch(() => {}).then(async () => {
    if (generation !== spotifyGeneration) return;
    await fs.mkdir(path.dirname(spotifyTokenPath()), { recursive: true });
    if (generation !== spotifyGeneration) return;
    await fs.writeFile(spotifyTokenPath(), encrypted, { mode: 0o600 });
  });
  spotifyStorageQueue = operation;
  return operation;
}

function deleteSpotifyTokens() {
  const operation = spotifyStorageQueue.catch(() => {}).then(async () => {
    try { await fs.unlink(spotifyTokenPath()); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  });
  spotifyStorageQueue = operation;
  return operation;
}

function spotifyAuthCleanup() {
  clearTimeout(spotifyAuthTimeout);
  spotifyAuthTimeout = null;
  const server = spotifyAuthServer;
  spotifyAuthServer = null;
  spotifyAuthState = '';
  spotifyAuthVerifier = '';
  if (server?.listening) server.close();
}

async function startSpotifyAuthorization() {
  const clientId = spotifyClientId();
  const generation = ++spotifyGeneration;
  if (!clientId) throw new Error('Add your Spotify app client ID in Settings to connect Spotify.');
  spotifyAuthCleanup();
  spotifyAuthState = crypto.randomBytes(24).toString('base64url');
  spotifyAuthVerifier = crypto.randomBytes(32).toString('base64url');
  const authState = spotifyAuthState;
  const verifier = spotifyAuthVerifier;
  const cleanup = () => { if (generation === spotifyGeneration) spotifyAuthCleanup(); };
  const codeChallenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  let redirectUri = '';
  spotifyAuthServer = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    const suppliedState = requestUrl.searchParams.get('state') || '';
    const code = requestUrl.searchParams.get('code') || '';
    if (request.method !== 'GET' || requestUrl.pathname !== '/callback' || generation !== spotifyGeneration || !safeEqual(suppliedState, authState)) {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Spotify authorization state did not match. Return to your mirror and try again.');
      return;
    }
    if (!code) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><meta charset="utf-8"><title>Spotify not connected</title><p>Spotify authorization was cancelled. You can close this window.</p>');
      cleanup();
      if (generation === spotifyGeneration) mainWindow?.webContents.send('mirror:spotify-auth-status', { connected: false, error: 'Spotify authorization was cancelled.' });
      return;
    }
    try {
      const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier })
      });
      const payload = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(payload.error_description || payload.error || `Spotify token exchange failed (${tokenResponse.status}).`);
      if (generation !== spotifyGeneration) throw new Error('Spotify connection changed while signing in. Try again.');
      spotifyTokens = { clientId, accessToken: payload.access_token, refreshToken: payload.refresh_token, expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000, scope: payload.scope || '' };
      await persistSpotifyTokens();
      if (generation !== spotifyGeneration) throw new Error('Spotify connection changed while signing in. Try again.');
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><meta charset="utf-8"><title>Spotify connected</title><p>Spotify is connected. Return to your mirror.</p>');
      cleanup();
      if (generation === spotifyGeneration) mainWindow?.webContents.send('mirror:spotify-auth-status', { connected: true });
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Spotify could not finish connecting. Return to the mirror and try again.');
      cleanup();
      if (generation === spotifyGeneration) mainWindow?.webContents.send('mirror:spotify-auth-status', { connected: false, error: error.message });
    }
  });
  const authServer = spotifyAuthServer;
  await new Promise((resolve, reject) => {
    authServer.once('error', reject);
    authServer.listen(0, '127.0.0.1', resolve);
  });
  if (generation !== spotifyGeneration) { if (authServer.listening) authServer.close(); throw new Error('Spotify connection changed. Try connecting again.'); }
  const port = authServer.address().port;
  redirectUri = `http://127.0.0.1:${port}/callback`;
  const authorizeUrl = new URL('https://accounts.spotify.com/authorize');
  authorizeUrl.search = new URLSearchParams({
    client_id: clientId, response_type: 'code', redirect_uri: redirectUri,
    code_challenge_method: 'S256', code_challenge: codeChallenge,
    state: authState,
    scope: 'user-read-playback-state user-modify-playback-state'
  }).toString();
  spotifyAuthTimeout = setTimeout(() => {
    cleanup();
    if (generation === spotifyGeneration) mainWindow?.webContents.send('mirror:spotify-auth-status', { connected: false, error: 'Spotify sign-in timed out. Try connecting again.' });
  }, 5 * 60 * 1000);
  try { await openNativeApplication(authorizeUrl.href, 'Spotify sign-in'); }
  catch (error) { cleanup(); throw error; }
  return { started: true };
}

async function getSpotifyAccessToken() {
  if (!spotifyTokens?.refreshToken) throw new Error('Connect Spotify first.');
  if (spotifyTokens.accessToken && spotifyTokens.expiresAt > Date.now() + 60_000) return spotifyTokens.accessToken;
  const generation = spotifyGeneration;
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: spotifyClientId(), grant_type: 'refresh_token', refresh_token: spotifyTokens.refreshToken })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error_description || payload.error || `Spotify token refresh failed (${response.status}).`);
  if (generation !== spotifyGeneration || !spotifyTokens) throw new Error('Spotify connection changed. Connect again.');
  spotifyTokens.accessToken = payload.access_token;
  if (payload.refresh_token) spotifyTokens.refreshToken = payload.refresh_token;
  spotifyTokens.expiresAt = Date.now() + Number(payload.expires_in || 3600) * 1000;
  await persistSpotifyTokens();
  if (generation !== spotifyGeneration || !spotifyTokens) throw new Error('Spotify connection changed. Connect again.');
  return spotifyTokens.accessToken;
}

async function spotifyApi(pathname, { method = 'GET', body } = {}) {
  const generation = spotifyGeneration;
  const token = await getSpotifyAccessToken();
  const assertCurrent = () => { if (generation !== spotifyGeneration) throw new Error('Spotify connection changed. Refresh playback and try again.'); };
  assertCurrent();
  const response = await fetch(`https://api.spotify.com/v1/${pathname}`, {
    method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  assertCurrent();
  if (response.status === 204) return null;
  if (!response.ok) {
    const detail = await response.text();
    assertCurrent();
    if (response.status === 401 && spotifyTokens?.accessToken === token) { spotifyTokens.accessToken = ''; spotifyTokens.expiresAt = 0; }
    throw new Error(response.status === 404
      ? 'Spotify has no active playback device. Open Spotify on this PC or another device and start playback.'
      : response.status === 403
        ? 'Spotify denied that action. Playback control may require Premium or a supported active device.'
        : `Spotify API returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : '.'}`);
  }
  const payload = await response.json();
  assertCurrent();
  return payload;
}

async function getSpotifyNowPlaying() {
  if (!spotifyTokens?.refreshToken && typeof windowsSpotify !== 'undefined' && windowsSpotify.supported) {
    try { const generation=spotifyGeneration; const snapshot=await windowsSpotify.status(); if(generation!==spotifyGeneration || spotifyTokens?.refreshToken) throw new Error('Spotify connection changed. Refresh playback.'); return snapshot; }
    catch (error) { return {connected:true,source:'windows-native',error:error.message}; }
  }
  if (!spotifyTokens?.refreshToken) return { connected: false, configured: spotifyConfigured() };
  const generation = spotifyGeneration;
  try {
    const current = await spotifyApi('me/player');
    if (generation !== spotifyGeneration) throw new Error('Spotify connection changed. Refresh playback and try again.');
    if (!current?.item) return { connected: true, configured: true, isPlaying: false, item: null, device: String(current?.device?.name || ''), canControl: Boolean(current?.device?.id && !current?.device?.is_restricted) };
    const item = current.item;
    return {
      connected: true, configured: true, isPlaying: Boolean(current.is_playing),
      progressMs: Number(current.progress_ms || 0), durationMs: Number(item.duration_ms || 0),
      canControl: Boolean(current.device?.id && !current.device?.is_restricted),
      canPause: !current.actions?.disallows?.pausing,
      canResume: !current.actions?.disallows?.resuming,
      canNext: !current.actions?.disallows?.skipping_next,
      canPrevious: !current.actions?.disallows?.skipping_prev,
      item: {
        name: String(item.name || ''), artists: (item.artists || []).map((artist) => String(artist.name || '')).filter(Boolean),
        album: String(item.album?.name || ''), imageUrl: String(item.album?.images?.[0]?.url || ''),
        uri: String(item.uri || ''), externalUrl: String(item.external_urls?.spotify || '')
      },
      device: String(current.device?.name || '')
    };
  } catch (error) {
    return { connected: Boolean(spotifyTokens?.refreshToken), configured: spotifyConfigured(), error: error.message };
  }
}

async function controlSpotify(action) {
  if (spotifyControlBusy) throw new Error('Wait for the previous Spotify playback request to finish.');
  spotifyControlBusy = true;
  try { return await performSpotifyControl(action); }
  finally { spotifyControlBusy = false; }
}

async function performSpotifyControl(action) {
  if (!spotifyTokens?.refreshToken && typeof windowsSpotify !== 'undefined' && windowsSpotify.supported && typeof action === 'string') {
    const generation=spotifyGeneration;
    return windowsSpotify.control(action,()=>{if(generation!==spotifyGeneration || spotifyTokens?.refreshToken) throw new Error('Spotify connection changed. Refresh playback.');});
  }
  const generation = spotifyGeneration;
  if (action?.action === 'transfer') {
    const deviceId = action.deviceId;
    if (typeof deviceId !== 'string' || !deviceId || deviceId.length > 256 || /[\s\x00-\x1f]/.test(deviceId)) throw new Error('Choose an available Spotify device.');
    const available = await spotifyApi('me/player/devices');
    if (generation !== spotifyGeneration) throw new Error('Spotify connection changed. Refresh devices and try again.');
    const target = available?.devices?.find(device => device.id === deviceId);
    if (!target) throw new Error('That Spotify device is no longer available. Refresh devices.');
    if (target.is_restricted) throw new Error('Spotify does not allow playback control on this device.');
    await spotifyApi('me/player', { method: 'PUT', body: { device_ids: [deviceId], play: false } });
    if (generation !== spotifyGeneration) throw new Error('Spotify connection changed. Refresh devices and try again.');
    const observed = await spotifyApi('me/player');
    if (generation !== spotifyGeneration) throw new Error('Spotify connection changed. Refresh devices and try again.');
    return { ok: true, transferRequested: true, confirmed: observed?.device?.id === deviceId };
  }
  const current = await spotifyApi('me/player');
  if (generation !== spotifyGeneration) throw new Error('Spotify connection changed. Refresh playback and try again.');
  if (!current?.device?.id) throw new Error('Open Spotify on a device and start playback first.');
  if (current.device.is_restricted) throw new Error('Spotify does not allow playback control on this device.');
  const restriction = { play: 'resuming', pause: 'pausing', next: 'skipping_next', previous: 'skipping_prev' }[String(action || '').toLowerCase()];
  if (restriction && current.actions?.disallows?.[restriction]) throw new Error('Spotify has restricted that playback action right now.');
  const commands = {
    play: () => spotifyApi(`me/player/play?device_id=${encodeURIComponent(current.device.id)}`, { method: 'PUT', body: {} }),
    pause: () => spotifyApi(`me/player/pause?device_id=${encodeURIComponent(current.device.id)}`, { method: 'PUT' }),
    next: () => spotifyApi(`me/player/next?device_id=${encodeURIComponent(current.device.id)}`, { method: 'POST' }),
    previous: () => spotifyApi(`me/player/previous?device_id=${encodeURIComponent(current.device.id)}`, { method: 'POST' })
  };
  const command = commands[String(action || '').toLowerCase()];
  if (!command) throw new Error('Spotify controls support play, pause, next, and previous.');
  await command();
  return { ok: true };
}

function findLanIPv4() {
  const addresses = Object.values(os.networkInterfaces()).flat().filter((item) => item && !item.internal && (item.family === 'IPv4' || item.family === 4));
  const rank = (address) => address.startsWith('192.168.') ? 0 : address.startsWith('10.') ? 1 : /^172\.(?:1[6-9]|2\d|3[01])\./.test(address) ? 2 : 3;
  addresses.sort((a, b) => rank(a.address) - rank(b.address));
  return addresses[0]?.address || '';
}

function phonePairPage() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data: blob:; form-action 'self'; base-uri 'none'"><title>Send to Reflect</title><style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;padding:24px;display:grid;place-items:center;background:#071014;color:#f4fbff;font:16px system-ui,sans-serif}.card{width:min(100%,460px);padding:24px;border:1px solid #385248;border-radius:22px;background:#0c1919;box-shadow:0 20px 70px #0008}h1{margin:0;font:500 24px Georgia,serif;color:#b5ffd4}p{color:#b6c9c2;line-height:1.5}label{display:block;margin:20px 0 8px;font-size:13px;color:#d9e8e2}input{width:100%;height:50px;padding:0 12px;border:1px solid #456356;border-radius:10px;background:#06100f;color:#fff;font:inherit}button{width:100%;height:50px;margin-top:12px;border:0;border-radius:10px;background:#b5ffd4;color:#06110c;font:700 15px system-ui;cursor:pointer}output{display:block;min-height:24px;margin-top:12px;color:#b5ffd4;line-height:1.4}.note{font-size:12px;color:#829890}</style></head><body><main class="card"><h1>Send to your mirror</h1><p>Paste a YouTube, Spotify, or direct video link. It will open in Watch mode on your TV.</p><form id="send-form"><label for="media-url">Media link</label><input id="media-url" type="url" inputmode="url" placeholder="https://youtu.be/…" autocomplete="url" required><button type="submit">Send to mirror</button><output id="result" aria-live="polite"></output></form><hr><h1>Add clothing</h1><p>Photograph one garment laid flat or on a hanger against a contrasting plain background. Spread sleeves away from the body. Review and save the cutout on the mirror.</p><form id="photo-form"><label for="garment-photo">Clothing photo</label><input id="garment-photo" type="file" accept="image/png,image/jpeg,image/webp" required><button type="submit">Send photo to wardrobe</button><output id="photo-result" aria-live="polite"></output></form><p class="note">Your phone and mirror must be on the same Wi-Fi. This sends a media link; it does not mirror your whole phone screen.</p></main><script>
    const form=document.querySelector('#send-form'), input=document.querySelector('#media-url'), result=document.querySelector('#result');
    form.addEventListener('submit',async event=>{event.preventDefault();result.textContent='Sending…';try{const response=await fetch('/cast',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:input.value})});const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Could not send this link.');result.textContent='Sent. Look at the mirror.';}catch(error){result.textContent=error.message;}});
    document.querySelector('#photo-form').addEventListener('submit',async event=>{
      event.preventDefault();const output=document.querySelector('#photo-result'),button=event.target.querySelector('button'),file=document.querySelector('#garment-photo').files[0];
      if(!file)return;button.disabled=true;output.textContent='Preparing photo…';let url;
      try{
        if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20000000)throw new Error('Choose a JPG, PNG or WebP under 20 MB.');
        const imageDataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Photo could not open.'));reader.readAsDataURL(file);});
        const response=await fetch('/wardrobe-photo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageDataUrl})}),payload=await response.json();if(!response.ok)throw new Error(payload.error||'Could not send photo.');output.textContent='Sent. Check the outline and save on the mirror.';
      }catch(error){output.textContent=error.message}finally{button.disabled=false;if(url)URL.revokeObjectURL(url)}
    });
  </script></body></html>`;
}

async function startPhoneLink() {
  if (phoneLinkServer) return phoneLinkDetails();
  const ip = findLanIPv4();
  if (!ip) throw new Error('No local Wi-Fi or Ethernet address was found.');
  phoneLinkToken = crypto.randomBytes(24).toString('hex');
  phoneLinkHost = ip;
  phoneLinkServer = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://mirror.local');
    const json = (status, payload) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(JSON.stringify(payload));
    };
    if (request.method === 'GET' && requestUrl.pathname.startsWith('/pair/')) {
      const supplied = requestUrl.pathname.slice('/pair/'.length);
      if (!safeEqual(supplied, phoneLinkToken)) { response.writeHead(404); response.end('Pairing link expired.'); return; }
      response.writeHead(303, {
        Location: '/',
        'Set-Cookie': `mirror_pair=${phoneLinkToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600`,
        'Cache-Control': 'no-store'
      });
      response.end();
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname === '/') {
      if (!phoneSessionAuthorized(request)) { response.writeHead(404); response.end('Pair this phone from the mirror first.'); return; }
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data: blob:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
        'X-Frame-Options': 'DENY'
      });
      response.end(phonePairPage());
      return;
    }
    if (request.method === 'POST' && requestUrl.pathname === '/wardrobe-photo') {
      if (!phoneSessionAuthorized(request)) { json(403, { error: 'Pair this phone from the mirror first.' }); return; }
      if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) { json(403, { error: 'Cross-site requests are not allowed.' }); return; }
      if (!wardrobePhoneWaiting) { json(409, { error: 'Tap From phone in the mirror wardrobe first.' }); return; }
      if(wardrobePhoneReceiving){json(409,{error:'A photo is still uploading. Try again when it finishes.'});return;}
      wardrobePhoneReceiving=true;request.setTimeout(15000,()=>request.destroy());
      const photoGeneration=wardrobePhoneGeneration;
      try {
        const chunks=[];let bodyBytes=0;
        for await (const chunk of request) { if(photoGeneration!==wardrobePhoneGeneration)throw new Error('Photo editor changed. Tap From phone again.');bodyBytes+=chunk.length;if(bodyBytes>27_000_000)throw new Error('Photo is too large.');chunks.push(chunk); }
        const value = JSON.parse(Buffer.concat(chunks,bodyBytes).toString('utf8')).imageDataUrl;
        await inspectPhotoOriginal(value);
        if (photoGeneration!==wardrobePhoneGeneration || !wardrobePhoneWaiting || !mainWindow || mainWindow.isDestroyed()) throw new Error('Photo editor closed. Tap From phone again.');
        wardrobePhoneWaiting = false;
        mainWindow.webContents.send('mirror:phone-wardrobe', value);
        json(200, { ok: true });
      } catch (error) { json(400, { error: error.message || 'Could not send photo.' }); }finally{wardrobePhoneReceiving=false;}
      return;
    }
    if (request.method === 'POST' && requestUrl.pathname === '/cast') {
      if (!phoneSessionAuthorized(request)) { json(403, { error: 'Pair this phone again from the mirror.' }); return; }
      const origin = request.headers.origin;
      if (origin && origin !== `http://${request.headers.host}`) { json(403, { error: 'Cross-site requests are not allowed.' }); return; }
      try {
        let body = '';
        for await (const chunk of request) {
          body += chunk.toString('utf8');
          if (Buffer.byteLength(body, 'utf8') > 12_000) throw new Error('Request is too large.');
        }
        const mediaUrl = supportedPhoneMediaUrl(JSON.parse(body).url);
        if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) throw new Error('The mirror window is not available.');
        prepareWatchPresentation();
        mainWindow.webContents.send('mirror:phone-media', mediaUrl);
        json(200, { ok: true });
      } catch (error) { json(400, { error: error.message || 'Could not send this media link.' }); }
      return;
    }
    response.writeHead(404, { 'Cache-Control': 'no-store' });
    response.end('Not found.');
  });
  await new Promise((resolve, reject) => {
    phoneLinkServer.once('error', reject);
    phoneLinkServer.listen(0, ip, resolve);
  }).catch((error) => {
    try { phoneLinkServer?.close(); } catch {}
    phoneLinkServer = null;
    phoneLinkToken = '';
    phoneLinkHost = '';
    throw new Error(`Could not start phone link: ${error.message}`);
  });
  try { return await phoneLinkDetails(); }
  catch (error) { stopPhoneLink(); throw error; }
}

function phoneLinkDetails() {
  if (!phoneLinkServer?.listening || !phoneLinkToken || !phoneLinkHost) return null;
  const port = phoneLinkServer.address().port;
  const url = `http://${phoneLinkHost}:${port}/pair/${phoneLinkToken}`;
  return QRCode.toDataURL(url, { width: 360, margin: 1, color: { dark: '#06110c', light: '#ffffff' } }).then((qrDataUrl) => ({ url, qrDataUrl, port }));
}

function stopPhoneLink() {
  wardrobePhoneGeneration++;wardrobePhoneWaiting = false;
  const server = phoneLinkServer;
  phoneLinkServer = null;
  phoneLinkToken = '';
  phoneLinkHost = '';
  if (server?.listening) server.close();
  return true;
}

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

async function writeCloset(closet,signal) {
  await fs.mkdir(path.dirname(closetPath), { recursive: true });
  const temporary = `${closetPath}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(closet, null, 2)}\n`, 'utf8');
  try{signal?.throwIfAborted();await fs.rename(temporary, closetPath);}catch(error){await fs.rm(temporary,{force:true});throw error;}
  return closet;
}

function publicGarment(item) {
  return { id: item.id, name: item.name, category: item.category, createdAt: item.createdAt, imageUrl: pathToFileURL(item.assetPath).href, ...(item.backAssetPath ? { backImageUrl: pathToFileURL(item.backAssetPath).href } : {}), ...(item.original ? { original: { ...item.original, assetPath: undefined, imageUrl: pathToFileURL(item.original.assetPath).href } } : {}), ...(item.backOriginal ? { backOriginal: { ...item.backOriginal, assetPath: undefined, imageUrl: pathToFileURL(item.backOriginal.assetPath).href } } : {}) };
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

function photoOriginalRecord(original,directory,name){return {assetPath:path.join(directory,`${name}.${original.extension}`),mime:original.mime,width:original.width,height:original.height,byteLength:original.byteLength,sha256:original.sha256};}
async function readClosetOriginal(id,side='front'){
  if(typeof id!=='string'||id.length>200||!['front','back'].includes(side))throw new Error('Choose a saved garment photo.');
  const item=(await readClosetRaw()).garments.find(item=>item.id===id);
  if(!item)throw new Error('That garment is no longer in your wardrobe.');
  const record=side==='back'?item.backOriginal:item.original;
  const cutout=side==='back'?item.backAssetPath:item.assetPath;
  if(!cutout)return null;
  const file=record?.assetPath||path.join(path.dirname(cutout),side==='back'?'back-original.png':'original.png');
  const root=path.resolve(closetAssetDirectory)+path.sep;
  if(!path.resolve(file).startsWith(root))throw new Error('Original photo is outside your wardrobe.');
  let resolved;try{resolved=await fs.realpath(file);}catch(error){if(error.code==='ENOENT')throw new Error('The original photo is missing. Upload the garment photo again.');throw error;}
  const realRoot=await fs.realpath(closetAssetDirectory);
  if(!resolved.startsWith(realRoot+path.sep))throw new Error('Original photo is outside your wardrobe.');
  const size=(await fs.stat(resolved)).size;if(size>20_000_000)throw new Error('Original photo is too large.');
  const bytes=await fs.readFile(resolved);if(bytes.length>20_000_000)throw new Error('Original photo is too large.');
  const mime=record?.mime||'image/png',value=`data:${mime};base64,${bytes.toString('base64')}`;
  const original=await inspectPhotoOriginal(value);
  if(record?.sha256&&record.sha256!==original.sha256)throw new Error('Original photo has changed. Upload it again.');
  return {imageDataUrl:value,width:original.width,height:original.height,legacy:!record};
}
async function inspectPhotoOriginal(value){
  const {photoSourceDataUrl}=await photoSourceValidation;
  const parsed=photoSourceDataUrl(value),bytes=Buffer.from(parsed.bytes);
  // Originals are archives. Chromium decodes WebP for the reviewed preview;
  // nativeImage supports PNG/JPEG only. Keep bounded WebP bytes unchanged.
  const image=parsed.mime==='image/webp'?null:nativeImage.createFromBuffer(bytes),size=image?image.getSize():{width:parsed.width,height:parsed.height};
  if((image?.isEmpty())||!size.width||!size.height||size.width>8192||size.height>8192||size.width*size.height>24_000_000)throw new Error('Photo could not open, or is too large.');
  const same=size.width===parsed.width&&size.height===parsed.height;
  const rotated=size.width===parsed.height&&size.height===parsed.width;
  if(!same&&!rotated)throw new Error('Photo dimensions do not match its header.');
  return {...parsed,bytes,width:size.width,height:size.height,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
}
let closetPhotoQueue = Promise.resolve(),closetPhotoPending=0;
const closetPhotoControllers=new Map();
function cancelClosetPhoto(id){for(const [key,controller] of closetPhotoControllers)if(!id||key===id)controller.abort(new Error('Wardrobe photo save canceled.'));return true;}
function saveClosetPhoto(input = {}) {
  if(closetPhotoPending>=2)return Promise.reject(new Error('Wait for the current wardrobe photo to finish saving.'));
  for(const key of ['originalDataUrl','backOriginalDataUrl'])if((input[key]&&typeof input[key]!=='string')||(typeof input[key]==='string'&&input[key].length>27_000_000))return Promise.reject(new Error('Choose a photo under 20 MB.'));
  const requestId=input.requestId||crypto.randomUUID();
  if(typeof requestId!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(requestId)||closetPhotoControllers.has(requestId))return Promise.reject(new Error('Photo save is already active, or its ID is invalid.'));
  const controller=new AbortController(),signal=controller.signal;closetPhotoControllers.set(requestId,controller);closetPhotoPending++;
  const operation = closetPhotoQueue.then(async () => {
    signal.throwIfAborted();
    const name = String(input.name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!name) throw new Error('Give the garment a name.');
    if (!['top', 'outerwear', 'dress', 'skirt', 'bottoms'].includes(input.category)) throw new Error('Choose a clothing type.');
    const decode = value => {
      const image = nativeImage.createFromBuffer(wardrobePhotoBytes(value)), size = image.getSize();
      if (image.isEmpty() || size.width > 1024 || size.height > 1024) throw new Error('Photo must be at most 1024 pixels per side.');
      return image.toPNG();
    };
    const image = decode(input.imageDataUrl);
    const original = input.originalDataUrl ? await inspectPhotoOriginal(input.originalDataUrl) : null;
    if (input.backOriginalDataUrl && !input.backImageDataUrl) throw new Error('A back original needs a reviewed back cutout.');
    const backImage = input.backImageDataUrl ? decode(input.backImageDataUrl) : null;
    const backOriginal = input.backOriginalDataUrl ? await inspectPhotoOriginal(input.backOriginalDataUrl) : null;
    const raw=await readClosetRaw(),index=input.garmentId?raw.garments.findIndex(item=>item.id===input.garmentId):-1;
    if(input.garmentId&&index<0)throw new Error('That garment is no longer in your wardrobe.');
    const previous=index>=0?raw.garments[index]:null;
    if(previous&&(!original||(backImage&&!backOriginal)))throw new Error('Keep the original photo when editing this garment.');
    const id=previous?.id||`garment-${crypto.randomUUID()}`,directory=path.join(closetAssetDirectory,`garment-${crypto.randomUUID()}`);
    signal.throwIfAborted();
    const assetPath = path.join(directory, 'front.png'), backAssetPath = backImage ? path.join(directory,'back.png') : null;
    await fs.mkdir(directory, { recursive: true });
    let committed=false;
    try {
      await fs.writeFile(assetPath, image);
      if (original) await fs.writeFile(path.join(directory, `original.${original.extension}`), original.bytes);
      if (backImage) await fs.writeFile(backAssetPath, backImage);
      if (backOriginal) await fs.writeFile(path.join(directory,`back-original.${backOriginal.extension}`),backOriginal.bytes);
      if (!previous && raw.garments.length >= 500) throw new Error('Your wardrobe has reached 500 garments.');
      const item = { id, name, category: input.category, assetPath, ...(backAssetPath ? {backAssetPath} : {}), ...(original?{original:photoOriginalRecord(original,directory,'original')}:{}), ...(backOriginal?{backOriginal:photoOriginalRecord(backOriginal,directory,'back-original')}:{}), createdAt: previous?.createdAt||new Date().toISOString(), render: { source: 'local-photo-cutout' } };
      if(previous)raw.garments[index]=item;else raw.garments.push(item);
      await writeCloset(raw,signal);committed=true;
      if(previous){const old=path.dirname(previous.assetPath);if(path.resolve(old).startsWith(path.resolve(closetAssetDirectory)+path.sep))await fs.rm(old,{recursive:true,force:true}).catch(error=>console.warn('[closet] old revision cleanup failed',error.message));}
      return publicGarment(item);
    } catch (error) { if(!committed)await fs.rm(directory, { recursive: true, force: true }); throw error; }
  });
  closetPhotoQueue = operation.catch(() => {});
  return operation.finally(()=>{closetPhotoPending--;if(closetPhotoControllers.get(requestId)===controller)closetPhotoControllers.delete(requestId);});
}

function queueTryOn(input = {}) {
  return tryOnRequests.run(input.requestId, signal => performTryOn(input, signal));
}

async function performTryOn(input, signal) {
  const connection = tryOnConnection(integrationSettings, process.env);
  const garmentId = String(input.garmentId || '');
  const frameDataUrl = String(input.frameDataUrl || '');
  if (input.consent !== true) throw new Error('Confirm try-on consent before preparing this image.');
  if (connection.configured && input.destinationId !== connection.destinationId) throw new Error('The try-on connection changed. Confirm consent for the current renderer and try again.');
  if (!garmentId || !/^data:image\/(?:jpeg|png|webp);base64,/i.test(frameDataUrl)) throw new Error('Choose a garment and capture a camera frame first.');
  if (Buffer.byteLength(frameDataUrl, 'utf8') > 8_000_000) throw new Error('Try-on frame is too large; step back from the mirror and try again.');
  const closet = await readClosetRaw();
  const garment = closet.garments.find((item) => item.id === garmentId);
  if (!garment) throw new Error('That garment is no longer in the local closet.');
  const allowedClosetRoot = `${path.resolve(closetAssetDirectory)}${path.sep}`;
  const resolvedGarmentPath = path.resolve(garment.assetPath);
  if (!resolvedGarmentPath.startsWith(allowedClosetRoot)) throw new Error('That garment file is outside the local closet.');
  const garmentBytes = await fs.readFile(resolvedGarmentPath);
  if (garmentBytes.byteLength > 20_000_000) throw new Error('Garment image is too large; choose an image under 20 MB.');
  const extension = path.extname(resolvedGarmentPath).toLowerCase();
  const mimeTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
  const garmentMimeType = mimeTypes[extension];
  if (!garmentMimeType) throw new Error('This garment image format is not supported.');
  const id = `tryon-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await fs.mkdir(tryOnDirectory, { recursive: true });
  signal.throwIfAborted();
  const framePath = path.join(tryOnDirectory, `${id}-person.jpg`);
  const encodedFrame = frameDataUrl.slice(frameDataUrl.indexOf(',') + 1);
  await fs.writeFile(framePath, Buffer.from(encodedFrame, 'base64'));
  const endpoint = connection.provider === 'custom' ? connection.endpoint : '';
  const vertexProject = connection.provider === 'vertex' ? connection.project : '';
  const providerConfigured = connection.configured;
  const job = { id, status: 'captured-local', garmentId, garmentName: garment.name, framePath, createdAt: new Date().toISOString(), providerConfigured };
  const manifestPath = path.join(tryOnDirectory, `${id}.json`);
  const persistJob = () => fs.writeFile(manifestPath, `${JSON.stringify(job, null, 2)}\n`, 'utf8');
  if (!providerConfigured) {
    await persistJob();
    return { id, status: job.status, garmentName: garment.name, providerConfigured: false };
  }

  const startedAt = Date.now();
  try {
    signal.throwIfAborted();
    let result;
    if (vertexProject) {
      result = await callVertexTryOn({ project: vertexProject, location: connection.location, personDataUrl: frameDataUrl, garmentBytes, garmentMimeType, signal });
    } else {
      const endpointUrl = new URL(endpoint);
      if (endpointUrl.username || endpointUrl.password) throw new Error('Store try-on credentials in MIRROR_TRYON_API_KEY, not in the endpoint URL.');
      const isLocalHttp = endpointUrl.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(endpointUrl.hostname);
      if (endpointUrl.protocol !== 'https:' && !isLocalHttp) throw new Error('The try-on endpoint must use HTTPS (HTTP is allowed only for localhost).');
      const response = await fetch(endpointUrl, {
        method: 'POST',
        signal: signal,
        redirect: 'error',
        headers: {
          'Content-Type': 'application/json',
          ...(connection.apiKey ? { Authorization: `Bearer ${connection.apiKey}` } : {})
        },
        body: JSON.stringify({
          schema: 'magicmirror.tryon.v1',
          jobId: id,
          personFrame: frameDataUrl,
          garment: {
            id: garment.id,
            name: garment.name,
            category: garment.category,
            image: `data:${garmentMimeType};base64,${garmentBytes.toString('base64')}`
          },
          fitRequest: { preserveIdentity: true, preservePose: true, output: 'full-frame-image' }
        })
      });
      if (!response.ok) throw new Error(`Try-on provider returned HTTP ${response.status}.`);
      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > 36_000_000) throw new Error('Try-on provider response exceeds 36 MB.');
      const responseText = await response.text();
      if (Buffer.byteLength(responseText, 'utf8') > 36_000_000) throw new Error('Try-on provider response exceeds 36 MB.');
      result = JSON.parse(responseText);
    }
    signal.throwIfAborted();
    const imageValue = String(result.imageDataUrl || result.imageBase64 || '');
    const dataUrlMatch = imageValue.match(/^data:(image\/(?:png|jpeg|webp));base64,([\s\S]+)$/i);
    const mimeType = (dataUrlMatch?.[1] || String(result.mimeType || 'image/png')).toLowerCase();
    const base64 = dataUrlMatch?.[2] || imageValue;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType) || !/^[a-z0-9+/]+=*$/i.test(base64)) {
      throw new Error('Try-on provider response must include a base64 PNG, JPEG, or WebP image.');
    }
    const resultBytes = Buffer.from(base64, 'base64');
    if (!resultBytes.length || resultBytes.length > 25_000_000) throw new Error('Try-on result image is empty or exceeds 25 MB.');
    const outputExtension = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' }[mimeType];
    const resultPath = path.join(tryOnDirectory, `${id}-result${outputExtension}`);
    await fs.writeFile(resultPath, resultBytes);
    job.status = 'rendered';
    job.resultPath = resultPath;
    job.confidence = Number.isFinite(result.confidence) ? Math.min(1, Math.max(0, result.confidence)) : null;
    job.latencyMs = Date.now() - startedAt;
    await persistJob();
    return {
      id, status: job.status, garmentName: garment.name, providerConfigured: true,
      resultUrl: pathToFileURL(resultPath).href, confidence: job.confidence, latencyMs: job.latencyMs
    };
  } catch (error) {
    job.status = signal.aborted && !/timed out/.test(signal.reason?.message || '') ? 'cancelled' : 'failed';
    job.failureReason = signal.aborted ? signal.reason.message : error.message;
    job.latencyMs = Date.now() - startedAt;
    await persistJob();
    throw new Error(job.failureReason);
  }
}

async function callVertexTryOn({ project, location, personDataUrl, garmentBytes, garmentMimeType, signal }) {
  if (!/^[a-z]+(?:-[a-z0-9]+)+$/.test(location)) throw new Error('MIRROR_VERTEX_LOCATION must be a valid Google Cloud region, such as us-central1.');
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project)) throw new Error('MIRROR_VERTEX_PROJECT must be a valid Google Cloud project ID.');
  if (!['image/png', 'image/jpeg'].includes(garmentMimeType)) throw new Error('Google Virtual Try-On accepts PNG or JPEG garment images. Re-import this garment as PNG or JPEG.');
  const garmentForModel = garmentBytes.byteLength > 7_000_000 ? null : garmentBytes;
  if (!garmentForModel) throw new Error('Google Virtual Try-On accepts garment images up to 7 MB. Choose a smaller PNG or JPEG.');
  const personMatch = personDataUrl.match(/^data:(image\/(?:jpeg|png));base64,([\s\S]+)$/i);
  if (!personMatch) throw new Error('The camera frame must be a JPEG or PNG image for Google Virtual Try-On.');
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const authClient = await auth.getClient();
  const accessToken = await authClient.getAccessToken();
  const token = typeof accessToken === 'string' ? accessToken : accessToken?.token;
  if (!token) throw new Error('Google Cloud credentials returned no access token. Set up Application Default Credentials for this PC.');
  signal.throwIfAborted();
  const host = `${location}-aiplatform.googleapis.com`;
  const target = `https://${host}/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/publishers/google/models/virtual-try-on-001:predict`;
  const response = await fetch(target, {
    method: 'POST', signal, redirect: 'error',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{
        personImage: { image: { mimeType: personMatch[1], bytesBase64Encoded: personMatch[2] } },
        productImages: [{ image: { mimeType: garmentMimeType, bytesBase64Encoded: garmentForModel.toString('base64') } }]
      }],
      parameters: { sampleCount: 1, addWatermark: true }
    })
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 400);
    throw new Error(`Google Virtual Try-On returned HTTP ${response.status}${detail ? `: ${detail}` : '.'}`);
  }
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > 36_000_000) throw new Error('Google Virtual Try-On response exceeds 36 MB.');
  const responseText = await response.text();
  if (Buffer.byteLength(responseText, 'utf8') > 36_000_000) throw new Error('Google Virtual Try-On response exceeds 36 MB.');
  const payload = JSON.parse(responseText);
  const prediction = payload.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) throw new Error('Google Virtual Try-On returned no result image.');
  return { imageBase64: prediction.bytesBase64Encoded, mimeType: prediction.mimeType || 'image/png' };
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
  const tryOn = tryOnConnection(integrationSettings, process.env);
  return {
    hasGeminiKey: Boolean(integrationSettings.value('geminiApiKey', process.env.GEMINI_API_KEY || '')),
    spotifyClientId: spotifyClientId(),
    secureStorageAvailable: integrationSettings.secureStorageAvailable(),
    settingsNotice: integrationSettings.loadError,
    rememberConnections: !integrationSettings.sessionOnly,
    geminiModel: process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview',
    geminiVoice: process.env.GEMINI_VOICE || 'Aoede',
    memoryPath,
    city: process.env.MIRROR_CITY || 'San Francisco',
    units: process.env.MIRROR_UNITS === 'metric' ? 'metric' : 'imperial',
    kiosk: useKiosk,
    isWindows: process.platform === 'win32',
    hasTryOnProvider: tryOn.configured, tryOnProviderHost: tryOn.host,
    tryOnProvider: tryOn.provider, tryOnEndpoint: tryOn.endpoint, tryOnProject: tryOn.project,
    tryOnLocation: tryOn.location, tryOnDestinationId: tryOn.destinationId, hasTryOnToken: Boolean(tryOn.apiKey),
    hasLiveTryOnProvider: Boolean(decartApiKey()), liveTryOnDestinationId
  };
}

async function createGeminiToken() {
  const apiKey = integrationSettings.value('geminiApiKey', process.env.GEMINI_API_KEY || '');
  if (!apiKey) throw new Error('Add a Gemini key in Settings to use live conversation.');

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
  const assertAgentFrame = event => {
    if (event.sender !== mainWindow?.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw new Error('Agent controls are only available to the mirror.');
  };
  const toolWaiters = new Map(); let toolSequence = 0, activeRunId = null;
  const codex = new CodexMirrorAgent({ cwd: app.getPath('userData'), executeTool: (tool, args, generation) => new Promise((resolve, reject) => {
    if (!activeRunId || !mainWindow || mainWindow.isDestroyed()) return reject(new Error('Mirror unavailable'));
    const id = ++toolSequence;
    const timer = setTimeout(() => { toolWaiters.delete(id); reject(new Error('Mirror tool timed out')); }, 15000);
    toolWaiters.set(id, { resolve, timer, runId: activeRunId });
    mainWindow.webContents.send('mirror:codex-tool', { id, tool, args, generation, runId: activeRunId });
  }) });
  const cancelCodex = () => {
    const cancelledRunId=activeRunId;
    activeRunId = null; codex.cancel(); desktopNavigation.cancel(); invalidateDesktopObservation(); desktopActionAbort?.abort();
    for (const waiter of toolWaiters.values()) { clearTimeout(waiter.timer); waiter.resolve({ cancelled: true }); }
    toolWaiters.clear();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('mirror:codex-cancelled', { runId: cancelledRunId });
  };
  ipcMain.handle('mirror:codex-task', async (event, input) => {
    assertAgentFrame(event);
    if (codex.child) return { error: 'An agent task is already running.' };
    if (!input || typeof input.runId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(input.runId)) throw new Error('Invalid agent run.');
    activeRunId = input.runId;
    try { return await codex.run(input.task); }
    finally {
      if (activeRunId === input.runId) {
        activeRunId = null; desktopNavigation.cancel(); invalidateDesktopObservation(); desktopActionAbort?.abort();
        for (const [id, waiter] of toolWaiters) { if (waiter.runId === input.runId) { clearTimeout(waiter.timer); waiter.resolve({ cancelled: true }); toolWaiters.delete(id); } }
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('mirror:codex-cancelled', { runId: input.runId });
      }
    }
  });
  ipcMain.handle('mirror:codex-cancel', event => { assertAgentFrame(event); cancelCodex(); return { cancelled: true }; });
  ipcMain.handle('mirror:codex-tool-result', (event, input) => {
    assertAgentFrame(event);
    const waiter = toolWaiters.get(input?.id);
    if (waiter && input.runId === waiter.runId && input.runId === activeRunId) {
      clearTimeout(waiter.timer); toolWaiters.delete(input.id); waiter.resolve(input.result);
    }
  });
  app.on('before-quit', cancelCodex);
  app.on('web-contents-created', (_event, contents) => {
    contents.on('did-start-navigation', (_event, _url, _inPlace, isMainFrame) => { if (isMainFrame && contents === mainWindow?.webContents) cancelCodex(); });
    contents.on('destroyed', () => { if (contents === mainWindow?.webContents) cancelCodex(); });
  });

  ipcMain.handle('mirror:youtube-player-url', async () => {
    if (!youtubePlayerServer) youtubePlayerServer = createYouTubePlayerServer().catch((error) => { youtubePlayerServer = null; throw error; });
    return (await youtubePlayerServer).url;
  });
  ipcMain.handle('mirror:wake-model-url', async()=>{wakeModelServer ||= createWakeModelServer();return (await wakeModelServer).url;});
  ipcMain.handle('mirror:get-config', (event) => {
    if (event.sender !== mainWindow?.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw new Error('Use mirror Settings to inspect connections.');
    return safePublicConfig();
  });
  ipcMain.handle('mirror:save-connections', async (event, input) => {
    if (event.sender !== mainWindow?.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw new Error('Connections can only be changed from mirror Settings.');
    const previousClient = spotifyClientId();
    const previousTryOn = JSON.stringify(tryOnConnection(integrationSettings, process.env));
    const saved = await integrationSettings.save(input);
    liveTryOnTokens.cancel();
    if (previousTryOn !== JSON.stringify(tryOnConnection(integrationSettings, process.env))) tryOnRequests.cancelAll();
    if (previousClient !== spotifyClientId()) {
      spotifyGeneration += 1; spotifyAuthCleanup(); spotifyTokens = null;
      await deleteSpotifyTokens();
    }
    return { ...safePublicConfig(), remembered: saved.remembered };
  });
  ipcMain.handle('mirror:create-gemini-token', () => createGeminiToken());
  ipcMain.handle('mirror:read-memory', () => readMemory());
  ipcMain.handle('mirror:remember-fact', (_event, input) => rememberUserFact(input));
  ipcMain.handle('mirror:clear-memory', () => writeMemory({ version: 1, facts: [] }));
  ipcMain.handle('mirror:save-closet-photo', (event, input) => {
    if (event.sender !== mainWindow?.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw new Error('Use the mirror wardrobe to save photos.');
    return saveClosetPhoto(input);
  });
  ipcMain.handle('mirror:cancel-closet-photo',(event,id)=>{if(event.sender!==mainWindow?.webContents||event.senderFrame!==mainWindow.webContents.mainFrame)throw new Error('Use the mirror wardrobe.');return cancelClosetPhoto(id);});
  ipcMain.handle('mirror:read-closet-original',(event,id,side)=>{if(event.sender!==mainWindow?.webContents||event.senderFrame!==mainWindow.webContents.mainFrame)throw new Error('Use the mirror wardrobe to open photos.');return readClosetOriginal(id,side);});
  ipcMain.handle('mirror:list-closet', () => readCloset());
  ipcMain.handle('mirror:import-closet-garment', (event, input) => importClosetGarment(event, input));
  const assertTryOnFrame = (event) => {
    if (event.sender !== mainWindow?.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw new Error('Use the mirror Try On controls.');
  };
  ipcMain.handle('mirror:queue-tryon', (event, input) => { assertTryOnFrame(event); return queueTryOn(input); });
  ipcMain.handle('mirror:list-looks', event => { assertTryOnFrame(event); return lookbook.list(); });
  ipcMain.handle('mirror:save-look', (event, input) => { assertTryOnFrame(event); return lookCaptures.run(input?.requestId, signal => lookbook.save(input, signal)); });
  ipcMain.handle('mirror:update-look', (event, input) => { assertTryOnFrame(event); return lookbook.update(input?.id, input?.action); });
  ipcMain.handle('mirror:cancel-look', event => { assertTryOnFrame(event); lookCaptures.cancelAll(); return true; });
  ipcMain.handle('mirror:cancel-tryon', (event, id) => { assertTryOnFrame(event); return tryOnRequests.cancel(id); });
  ipcMain.handle('mirror:live-tryon-token', (event, input) => { assertTryOnFrame(event); return liveTryOnTokens.create(input); });
  ipcMain.handle('mirror:cancel-live-tryon-token', event => { assertTryOnFrame(event); liveTryOnTokens.cancel(); });
  ipcMain.handle('mirror:toggle-fullscreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    win.setFullScreen(!win.isFullScreen());
    return win.isFullScreen();
  });
  ipcMain.handle('mirror:open-service', async (_event, service) => {
    const key = String(service || '').toLowerCase();
    if (key === 'spotify') return openSpotifyService();
    const target = serviceUrls[key];
    if (!target) throw new Error('That service is not available in the mirror launcher.');
    return openDesktopWebpage(target);
  });
  ipcMain.handle('mirror:open-webpage', async (_event, value) => {
    return openDesktopWebpage(value);
  });
  ipcMain.handle('mirror:desktop-gesture-scroll', (event, direction) => {
    if (event.sender !== mainWindow?.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw new Error('Use the mirror’s gesture controls to scroll.');
    return scrollDesktopFromGesture(direction);
  });
  ipcMain.handle('mirror:desktop-presentation', () => desktopPresentation());
  ipcMain.handle('mirror:close-desktop', () => closeDesktopWindow());
  ipcMain.handle('mirror:desktop-capture', () => captureCurrentScreen({ recordObservation: true }));
  ipcMain.handle('mirror:desktop-action', (_event, input) => performDesktopAction(input));
  ipcMain.handle('mirror:desktop-cancel', () => {
    desktopNavigation.cancel();
    if(typeof windowsSpotify !== 'undefined') windowsSpotify.cancelPending();
    invalidateDesktopObservation();
    desktopActionAbort?.abort();
    return true;
  });
  ipcMain.handle('mirror:spotify-status', () => ({ configured: spotifyConfigured() || windowsSpotify.supported, connected: Boolean(spotifyTokens?.refreshToken) || windowsSpotify.supported, local: windowsSpotify.supported && !spotifyTokens?.refreshToken, accountConfigured: spotifyConfigured() }));
  ipcMain.handle('mirror:spotify-connect', () => startSpotifyAuthorization());
  ipcMain.handle('mirror:spotify-disconnect', async () => {
    spotifyGeneration += 1; spotifyAuthCleanup();
    spotifyTokens = null;
    await deleteSpotifyTokens();
    return { connected: false, configured: spotifyConfigured() };
  });
  ipcMain.handle('mirror:spotify-current', () => getSpotifyNowPlaying());
  ipcMain.handle('mirror:spotify-devices', async event => {
    if (event.sender !== mainWindow?.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw new Error('Use the local Music device controls.');
    const result = await spotifyApi('me/player/devices');
    return (result?.devices || []).filter(device => typeof device.id === 'string' && device.id).map(device => ({
      id: device.id, name: String(device.name || 'Spotify device').slice(0, 120), type: String(device.type || ''),
      active: Boolean(device.is_active), restricted: Boolean(device.is_restricted)
    }));
  });
  ipcMain.handle('mirror:spotify-control', (event, action) => {
    if (event.sender !== mainWindow?.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw new Error('Use the mirror Music controls.');
    return controlSpotify(action);
  });
  ipcMain.handle('mirror:open-spotify-item', async (_event, input) => {
    const uri = String(input?.uri || '');
    const webUrl = normalizeExternalWebUrl(input?.url);
    if (!/^spotify:(?:track|episode):[A-Za-z0-9]+$/.test(uri) || !webUrl.startsWith('https://open.spotify.com/')) {
      throw new Error('That Spotify item link is not valid.');
    }
    try { await openNativeApplication(uri, 'Spotify'); }
    catch { await openNativeApplication(webUrl, 'Spotify'); }
    return true;
  });
  ipcMain.handle('mirror:search-web', async (_event, query) => {
    const terms = String(query || '').replace(/\s+/g, ' ').trim().slice(0, 240);
    if (!terms) throw new Error('Give me something to search for.');
    return openDesktopWebpage(`https://www.google.com/search?q=${encodeURIComponent(terms)}`);
  });
  ipcMain.handle('mirror:wardrobe-phone', async (event, enabled) => {
    if (event.sender !== mainWindow?.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw new Error('Use the wardrobe photo editor.');
    wardrobePhoneGeneration++;wardrobePhoneWaiting = enabled === true;
    if (!wardrobePhoneWaiting) return null;
    try { return await startPhoneLink(); } catch (error) { wardrobePhoneWaiting = false; throw error; }
  });
  ipcMain.handle('mirror:start-phone-link', () => startPhoneLink());
  ipcMain.handle('mirror:stop-phone-link', () => stopPhoneLink());
  ipcMain.handle('mirror:start-casting', () => startCastReceiver());
  ipcMain.handle('mirror:stop-casting', () => stopCastReceiver());
  ipcMain.handle('mirror:cast-state', (event, state) => { if (event.sender === mainWindow?.webContents) castReceiver?.update(state || {}); });
  ipcMain.handle('mirror:cast-result', (event, result) => {
    if (event.sender !== mainWindow?.webContents) return;
    const entry = castCommands.get(result?.id); if (!entry) return;
    clearTimeout(entry.timeout); castCommands.delete(result.id);
    if (result.error) entry.reject(new Error(String(result.error).slice(0, 300))); else entry.resolve();
  });
  ipcMain.handle('mirror:open-cast-settings', async () => {
    if (process.platform !== 'win32') throw new Error('Windows wireless display receiving is available on Windows only.');
    await openNativeApplication('ms-settings:projecting', 'Wireless display settings');
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
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
  mainWindow = win;
  for (const event of ['resize', 'move', 'enter-full-screen', 'leave-full-screen']) win.on(event, layoutDesktopWindow);
  win.webContents.on('did-finish-load', notifyDesktopPresentation);

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
    liveTryOnTokens.cancel();
    nativeCompanion.exit();
    void stopCastReceiver();
    console.error('[watchdog] renderer process gone', details.reason);
    if (!win.isDestroyed()) win.webContents.reloadIgnoringCache();
  });
  win.webContents.on('did-start-navigation', (_event, _url, _inPlace, isMainFrame) => { if (isMainFrame) { cancelClosetPhoto();tryOnRequests.cancelAll(); liveTryOnTokens.cancel(); void stopCastReceiver(); } });
  win.on('closed', () => {
    if (mainWindow === win) {
      tryOnRequests.cancelAll();
      liveTryOnTokens.cancel();
      if (desktopWindow && !desktopWindow.isDestroyed()) desktopWindow.close();
      mainWindow = null; void stopCastReceiver();
    }
  });
  return win;
}

app.whenReady().then(async () => {
  if (!ownsInstanceLock) return;
  powerMonitor.on('resume', () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('mirror:system-resume'); });
  await integrationSettings.load();
  registerBridge();
  await loadSpotifyTokens();

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media');
  });

  const playerIdentity = `https://${require('../package.json').mirrorAppId || 'com.architdeepak.reflect-mirror'}/`;
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['https://www.youtube.com/embed/*', 'https://www.youtube-nocookie.com/embed/*'] }, (details, callback) => {
    const headers = { ...details.requestHeaders };
    if (mainWindow && details.webContentsId === mainWindow.webContents.id) {
      for (const name of Object.keys(headers)) if (name.toLowerCase() === 'referer') delete headers[name];
      headers.Referer = playerIdentity;
    }
    callback({ requestHeaders: headers });
  });
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', (_event, argv) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  void closeDesktopWindow().then(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    const kioskRequested = argv.includes('--kiosk');
    useKiosk = kioskRequested;
    mainWindow.setKiosk(kioskRequested);
    mainWindow.setFullScreen(kioskRequested);
    mainWindow.show(); mainWindow.focus();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {cancelClosetPhoto();tryOnRequests.cancelAll();});
app.on('before-quit', () => liveTryOnTokens.cancel());
app.on('before-quit', () => windowsSpotify.close());
app.on('before-quit',()=>{void wakeModelServer?.then(server=>server.close()).catch(()=>{});});
app.on('before-quit', stopPhoneLink);
app.on('before-quit', () => { void stopCastReceiver(); });

app.on('before-quit', () => { void youtubePlayerServer?.then((server) => server.close()).catch(() => {}); });
