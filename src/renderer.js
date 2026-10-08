import * as THREE from 'three';
import { RenderBudget, SceneRenderBudget } from './renderBudget.js';
import { AvatarController } from './avatarController.js';
import { ClosetStore } from './closetStore.js';
import { matchGarment } from './garmentMatch.js';
import { AROverlay } from './arOverlay.js';
import { GarmentOverlay } from './garmentOverlay.js';
import { LiveTryOn } from './liveTryOn.js';
import { selectAssistantVision } from './assistantVision.js';
import { createDepthScene } from './depthScene.js';
import { GeminiLiveAdapter } from './geminiLiveAdapter.js';
import { GestureNavigation } from './gestureNavigation.js';
import { MagicMirrorView } from './magicMirrorView.js';
import { SpeechEngine } from './speechEngine.js';
import { WakeWordListener } from './wakeWord.js';
import { WatchPlaybackController } from './watchPlaybackController.js';
import { YouTubeWatchPlayer } from './youtubeWatchPlayer.js';
import { WatchCastPlayer } from './watchCastPlayer.js';
import { SpotifyDevices } from './spotifyDevices.js';
import {
  applyOffAxisProjection,
  applyFlatProjection,
  calibrateDepth,
  getCameraDevices,
  getFaceBlendshapes,
  getFaceLandmarks,
  getEyeGaze,
  getTrackingStatus,
  initHeadTracking,
  setTrackingOptions,
  switchCamera,
  toggleCamera,
  updateHeadTracking
} from './headTracking.js';

const elements = {
  shell: document.querySelector('#app-shell'),
  desktopReturn: document.querySelector('#desktop-return'),
  canvas: document.querySelector('#scene-canvas'),
  video: document.querySelector('#camera-feed'),
  arCanvas: document.querySelector('#ar-canvas'),
  garmentCanvas: document.querySelector('#garment-canvas'),
  avatarHost: document.querySelector('#avatar-engine'),
  loader: document.querySelector('#loader'),
  loaderText: document.querySelector('#loader-text'),
  stateDot: document.querySelector('#state-dot'),
  stateLabel: document.querySelector('#state-label'),
  oracleCard: document.querySelector('#oracle-card'),
  oracleText: document.querySelector('#oracle-text'),
  oracleUser: document.querySelector('#oracle-user'),
  oracleEyebrow: document.querySelector('#oracle-eyebrow'),
  oracleClose: document.querySelector('#oracle-close'),
  form: document.querySelector('#prompt-form'),
  mic: document.querySelector('#mic-btn'),
  micLabel: document.querySelector('#mic-label'),
  mute: document.querySelector('#mute-btn'),
  muteLabel: document.querySelector('#mute-label'),
  captions: document.querySelector('#live-captions'),
  captionUser: document.querySelector('#caption-user'),
  captionAssistant: document.querySelector('#caption-assistant'),
  settingsToggle: document.querySelector('#settings-toggle'),
  settings: document.querySelector('#settings-panel'),
  cameraSelect: document.querySelector('#camera-select'),
  cameraMount: document.querySelector('#camera-mount'),
  citySelect: document.querySelector('#city-select'),
  glassProfile: document.querySelector('#glass-profile'),
  arEffect: document.querySelector('#ar-effect'),
  voiceSelect: document.querySelector('#voice-select'),
  paceSelect: document.querySelector('#pace-select'),
  wakeToggle: document.querySelector('#wake-toggle'),
  gestureToggle: document.querySelector('#gesture-toggle'),
  facePuppetToggle: document.querySelector('#face-puppet-toggle'),
  visionToggle: document.querySelector('#vision-toggle'),
  wakeStatus: document.querySelector('#wake-status'),
  visionNotice: document.querySelector('#vision-notice'),
  clearMemory: document.querySelector('#clear-memory'),
  memoryStatus: document.querySelector('#memory-status'),
  sensitivity: document.querySelector('#sensitivity'),
  sensitivityValue: document.querySelector('#sensitivity-value'),
  smoothing: document.querySelector('#smoothing'),
  smoothingValue: document.querySelector('#smoothing-value'),
  cameraToggle: document.querySelector('#camera-toggle'),
  cameraNotice: document.querySelector('#camera-notice'),
  calibrateDepth: document.querySelector('#calibrate-depth'),
  diagnosticsToggle: document.querySelector('#diagnostics-toggle'),
  diagnostics: document.querySelector('#diagnostics'),
  diagRender: document.querySelector('#diag-render'),
  diagTracking: document.querySelector('#diag-tracking'),
  diagRig: document.querySelector('#diag-rig'),
  diagBlendshapes: document.querySelector('#diag-blendshapes'),
  diagGaze: document.querySelector('#diag-gaze'),
  fullscreenToggle: document.querySelector('#fullscreen-toggle'),
  trackingBadge: document.querySelector('#tracking-badge'),
  apiBadge: document.querySelector('#api-badge'),
  configNote: document.querySelector('#config-note'),
  connectionForm: document.querySelector('#connection-form'),
  geminiKey: document.querySelector('#gemini-key'),
  spotifyClientId: document.querySelector('#spotify-client-id'),
  tryOnProvider: document.querySelector('#tryon-provider'),
  decartKey: document.querySelector('#decart-key'),
  decartClearKey: document.querySelector('#decart-clear-key'),
  liveTryOnVideo: document.querySelector('#live-tryon-video'),
  liveTryOnConsent: document.querySelector('#live-tryon-consent'),
  liveTryOnStart: document.querySelector('#live-tryon-start'),
  liveTryOnStop: document.querySelector('#live-tryon-stop'),
  liveTryOnStatus: document.querySelector('#live-tryon-status'),
  tryOnEndpoint: document.querySelector('#tryon-endpoint'),
  tryOnToken: document.querySelector('#tryon-token'),
  tryOnClearToken: document.querySelector('#tryon-clear-token'),
  tryOnProject: document.querySelector('#tryon-project'),
  tryOnLocation: document.querySelector('#tryon-location'),
  tryOnCustomSettings: document.querySelector('#tryon-custom-settings'),
  tryOnCloudSettings: document.querySelector('#tryon-cloud-settings'),
  tryOnConnectionNote: document.querySelector('#tryon-connection-note'),
  rememberConnections: document.querySelector('#remember-connections'),
  connectionStatus: document.querySelector('#connection-status'),
  saveConnections: document.querySelector('#save-connections'),
  disableGemini: document.querySelector('#disable-gemini'),
  dashboard: document.querySelector('#dashboard-container'),
  studioPanel: document.querySelector('#studio-panel'),
  studioTools: document.querySelector('#studio-tools'),
  studioToolsToggle: document.querySelector('#studio-tools-toggle'),
  studioSummary: document.querySelector('#studio-summary'),
  watchPanel: document.querySelector('#watch-panel'),
  spotifyPanel: document.querySelector('#spotify-panel'),
  spotifyCard: document.querySelector('#spotify-card'),
  spotifyStatus: document.querySelector('#spotify-status'),
  spotifyCover: document.querySelector('#spotify-cover'),
  spotifyTrackLink: document.querySelector('#spotify-track-link'),
  spotifyTitle: document.querySelector('#spotify-title'),
  spotifyArtist: document.querySelector('#spotify-artist'),
  spotifyAlbum: document.querySelector('#spotify-album'),
  spotifyDevice: document.querySelector('#spotify-device'),
  spotifyDeviceSelect: document.querySelector('#spotify-device-select'),
  spotifyDeviceUse: document.querySelector('#spotify-device-use'),
  spotifyDeviceRefresh: document.querySelector('#spotify-device-refresh'),
  spotifyDeviceStatus: document.querySelector('#spotify-device-status'),
  spotifyProgress: document.querySelector('#spotify-progress'),
  spotifyConnect: document.querySelector('#spotify-connect'),
  spotifyDisconnect: document.querySelector('#spotify-disconnect'),
  spotifyPlay: document.querySelector('#spotify-play'),
  spotifyViews: document.querySelector('#spotify-views'),
  effectGrid: document.querySelector('#effect-grid'),
  watchUrl: document.querySelector('#watch-url'),
  watchLoad: document.querySelector('#watch-load'),
  watchVideo: document.querySelector('#watch-video'),
  watchFrame: document.querySelector('#watch-frame'),
  watchPlaceholder: document.querySelector('#watch-placeholder'),
  phoneLinkToggle: document.querySelector('#phone-link-toggle'),
  windowsCastSettings: document.querySelector('#windows-cast-settings'),
  phoneLinkPanel: document.querySelector('#phone-link-panel'),
  phoneLinkQr: document.querySelector('#phone-link-qr'),
  phoneLinkAddress: document.querySelector('#phone-link-address'),
  phoneLinkStatus: document.querySelector('#phone-link-status'),
  phoneLinkStop: document.querySelector('#phone-link-stop'),
  castingToggle: document.querySelector('#casting-toggle'),
  castingStatus: document.querySelector('#casting-status'),
  closetList: document.querySelector('#closet-list'),
  closetImport: document.querySelector('#closet-import'),
  tryOnConsent: document.querySelector('#tryon-consent'),
  tryOnConsentCopy: document.querySelector('#tryon-consent-copy'),
  tryOnRun: document.querySelector('#tryon-run'),
  tryOnCancel: document.querySelector('#tryon-cancel'),
  tryOnStatus: document.querySelector('#tryon-status'),
  tryOnResult: document.querySelector('#tryon-result'),
  tryOnOverlay: document.querySelector('#tryon-overlay'),
  tryOnLive: document.querySelector('#tryon-live'),
  tryOnStill: document.querySelector('#tryon-still'),
  liveFitStatus: document.querySelector('#live-fit-status'),
  garmentFit: document.querySelector('#garment-fit'),
  garmentWidth: document.querySelector('#garment-width'),
  garmentLength: document.querySelector('#garment-length'),
  garmentOffset: document.querySelector('#garment-offset'),
  garmentFitReset: document.querySelector('#garment-fit-reset'),
  gestureToast: document.querySelector('#gesture-toast'),
  awakening: document.querySelector('#awakening'),
  personaToggle: document.querySelector('#persona-toggle'),
  personaToggleImage: document.querySelector('#persona-toggle-image'),
  personaPanel: document.querySelector('#persona-panel'),
  personaList: document.querySelector('#persona-list'),
  launcherToggle: document.querySelector('#launcher-toggle'),
  launcherPanel: document.querySelector('#launcher-panel'),
  quickNoteForm: document.querySelector('#quick-note-form'),
  quickNoteInput: document.querySelector('#quick-note-input'),
  dimensionSwitch: document.querySelector('#dimension-switch')
};

const config = await loadConfig();
config.memory = await loadMemory();
const savedVoice = localStorage.getItem('mirror.voice') || config.geminiVoice;
const savedPace = localStorage.getItem('mirror.pace') || 'brisk';
const visionEnabled = localStorage.getItem('mirror.vision') !== 'false';
const wakeEnabled = localStorage.getItem('mirror.wake') !== 'false';
const gesturesEnabled = localStorage.getItem('mirror.gestures') !== 'false';
const facePuppetEnabled = localStorage.getItem('mirror.face-puppet') === 'true';
const savedPersona = localStorage.getItem('mirror.persona') || 'velora';
const savedGlassProfile = localStorage.getItem('mirror.glass-profile') || 'glass';
const savedCameraMount = localStorage.getItem('mirror.camera-mount') || 'top';
const savedAvatarPosition = ['center', 'left', 'right', 'upper', 'lower'].includes(localStorage.getItem('mirror.avatar-position'))
  ? localStorage.getItem('mirror.avatar-position') : 'center';
let depthEnabled = localStorage.getItem('mirror.depth-cube') === 'true';
config.geminiVoice = savedVoice;
elements.citySelect.value = config.city;
elements.cameraMount.value = savedCameraMount;
setTrackingOptions({ mount: savedCameraMount });
elements.glassProfile.value = savedGlassProfile;
elements.shell.dataset.glassProfile = savedGlassProfile;
elements.shell.dataset.avatarPosition = savedAvatarPosition;
elements.voiceSelect.value = savedVoice;
elements.paceSelect.value = savedPace;
elements.visionToggle.checked = visionEnabled;
elements.wakeToggle.checked = wakeEnabled;
elements.gestureToggle.checked = gesturesEnabled;
elements.facePuppetToggle.checked = facePuppetEnabled;
elements.tryOnConsentCopy.textContent = config.hasTryOnProvider
  ? `I consent to send one camera frame and this garment to ${config.tryOnProviderHost || 'the configured renderer'} for rendering. Cost, processing, and retention follow that provider's terms.`
  : 'I consent to capture one camera frame for this local try-on sample.';
elements.tryOnRun.textContent = config.hasTryOnProvider ? 'Render selected look' : 'Save local try-on sample';
elements.visionNotice.textContent = visionEnabled
  ? 'Camera and try-on views are shared with the assistant only while listening'
  : 'Assistant vision is off · camera tracking stays on this device';
updateMemoryStatus(config.memory);


const renderer = new THREE.WebGLRenderer({ canvas: elements.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
const viewportSize = () => ({ width: elements.shell.clientWidth || window.innerWidth, height: elements.shell.clientHeight || window.innerHeight });
// A native 4K portrait television is already 8.3MP at DPR 1.  Preserve that
// native detail, but cap Retina/browser scaling by a pixel budget rather than
// a blunt DPR value that can turn a 4K panel into a 33MP render target.
const RENDER_PIXEL_BUDGET = 12_000_000;
const preferredPixelRatio = () => {
  const { width, height } = viewportSize();
  const budgetRatio = Math.sqrt(RENDER_PIXEL_BUDGET / Math.max(1, width * height));
  return Math.min(window.devicePixelRatio || 1, Math.max(.8, budgetRatio));
};
const sceneBudget = new SceneRenderBudget();
elements.canvas.addEventListener('webglcontextrestored', () => sceneBudget.invalidate());
const renderQuality = {
  // A 4K portrait panel at DPR 2 would otherwise request ~33 million pixels
  // per rendered layer. The governor protects frame time before visual polish.
  maxPixelRatio: preferredPixelRatio(),
  pixelRatio: preferredPixelRatio(),
  frames: 0,
  elapsed: 0,
  fps: 60
};
renderer.setPixelRatio(renderQuality.pixelRatio);
{ const viewport = viewportSize(); renderer.setSize(viewport.width, viewport.height); }
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const initialViewport = viewportSize();
const camera = new THREE.PerspectiveCamera(45, initialViewport.width / initialViewport.height, 0.06, 30);
camera.position.set(0, 0, 3.1);
scene.add(new THREE.HemisphereLight(0xb798ff, 0x160805, 1.7));
const keyLight = new THREE.DirectionalLight(0xffe4b0, 4.2);
keyLight.position.set(1.8, 3.4, 3.2);
scene.add(keyLight);
const rimLight = new THREE.PointLight(0x8a3fff, 18, 8);
rimLight.position.set(-2.2, 1.2, -0.5);
scene.add(rimLight);
const emberLight = new THREE.PointLight(0xff481e, 12, 7);
emberLight.position.set(1.2, -2.5, 0.4);
scene.add(emberLight);

const depthScene = createDepthScene(scene);
depthScene.setDepthEnabled(depthEnabled);
depthScene.setAvatarPosition(savedAvatarPosition);
const arOverlay = new AROverlay(elements.arCanvas);
const garmentOverlay = new GarmentOverlay(elements.garmentCanvas, elements.video, (message) => {
  elements.liveFitStatus.textContent = message;
  if (tryOnView === 'live' && elements.shell.dataset.liveTryon !== 'true') elements.studioSummary.textContent = message;
});
let tryOnView = 'live';
let garmentSelection = Promise.resolve(false);
let garmentRevision = 0;
let tryOnRendering = false;
let tryOnRequestId = null;
const gestures = new GestureNavigation(elements.video, handleGesture, (status) => {
  if (status === 'unavailable' && elements.gestureToggle.checked) showGesture('Gesture controls unavailable · turn Hands-free navigation off and on to retry.');
});
const dashboard = new MagicMirrorView(elements.dashboard, { city: config.city, units: config.units });
const closet = new ClosetStore({
  container: elements.closetList,
  onStopVoice: stopAssistant,
  ensureCamera: () => toggleCamera(true),
  video: elements.video,
  importButton: elements.closetImport,
  onSelect: (item) => {
    const restartLive = Boolean(liveTryOn.session && elements.liveTryOnConsent.checked);
    liveTryOn.stop();
    cancelTryOnRender();
    garmentRevision += 1;
    elements.tryOnResult.classList.remove('visible');
    elements.tryOnResult.removeAttribute('src');
    elements.tryOnOverlay.classList.remove('visible');
    elements.tryOnOverlay.removeAttribute('src');
    elements.tryOnStill.disabled = true;
    garmentSelection = garmentOverlay.select(item);
    syncGarmentFitControls();
    setTryOnView('live');
    setStudioToolsOpen(false);
    localStorage.setItem('mirror.closet.selected-name', item.name);
    elements.tryOnRun.disabled = tryOnRendering || !elements.tryOnConsent.checked;
    elements.tryOnStatus.textContent = `${item.name} selected · local fit stays on-device; still rendering and live AI require their sharing consent.`;
    showGesture(`${item.name} selected · step back for live fit`);
    updateLiveTryOnControls();
    if (restartLive) void startLiveTryOn();
  },
  onNotice: (message) => showGesture(message)
});
const liveTryOn = new LiveTryOn({
  video: elements.video, output: elements.liveTryOnVideo,
  token: input => window.mirrorBridge.createLiveTryOnToken(input),
  cancelToken: () => window.mirrorBridge?.cancelLiveTryOnToken?.(),
  onState: snapshot => {
    elements.shell.dataset.liveTryon = String(snapshot.active);
    elements.garmentFit.hidden = snapshot.active || tryOnView !== 'live';
    elements.tryOnLive.setAttribute('aria-pressed', String(!snapshot.active && tryOnView === 'live'));
    if (snapshot.active) elements.studioSummary.textContent = `${snapshot.state === 'streaming' ? 'Live AI outfit' : 'Connecting live AI'} · ${snapshot.garment}`;
    else if (tryOnView === 'live') elements.studioSummary.textContent = garmentOverlay.lastStatus || 'Choose a garment to see your live fit.';
    garmentOverlay.setEnabled(!snapshot.active && mode === 'ar' && tryOnView === 'live' && !desktopActive);
    updateLiveTryOnControls();
    updateVisionNotice();
  }
});
function updateLiveTryOnControls() {
  const snapshot = liveTryOn.snapshot();
  elements.liveTryOnStart.disabled = snapshot.active || !config.hasLiveTryOnProvider || !elements.liveTryOnConsent.checked || !closet.selectedId;
  elements.liveTryOnStop.hidden = !snapshot.active;
  elements.liveTryOnStatus.textContent = snapshot.error || (snapshot.state === 'streaming'
    ? `LIVE · sharing camera with Decart · ${snapshot.garment}${snapshot.quality ? ` · connection ${snapshot.quality}` : ''}${snapshot.latencyMs !== null ? ` · ${Math.round(snapshot.latencyMs)} ms delay` : ''}`
    : snapshot.active ? `Connecting live AI · ${snapshot.garment} · Stop cancels camera sharing`
      : config.hasLiveTryOnProvider ? 'Ready · select a garment, confirm sharing, then Start live AI.' : 'Add a Decart key in Settings to enable live AI.');
}
function updateVisionNotice() {
  elements.visionNotice.textContent = liveTryOn.session
    ? `Live try-on shares camera video with Decart · assistant vision ${elements.visionToggle.checked ? 'enabled while listening' : 'off'}`
    : elements.visionToggle.checked ? 'Camera and try-on views are shared with the assistant only while listening'
      : 'Assistant vision is off · camera tracking stays on this device';
}
async function startLiveTryOn() {
  if (!config.hasLiveTryOnProvider || !elements.liveTryOnConsent.checked) { updateLiveTryOnControls(); return false; }
  setAssistantMode('ar');
  setTryOnView('live');
  cancelTryOnRender();
  return liveTryOn.start(closet.items.find(item => item.id === closet.selectedId), elements.liveTryOnConsent.checked);
}
elements.liveTryOnConsent.addEventListener('change', () => { if (!elements.liveTryOnConsent.checked) liveTryOn.stop(); updateLiveTryOnControls(); });
elements.liveTryOnStart.addEventListener('click', () => { void startLiveTryOn(); });
elements.liveTryOnStop.addEventListener('click', () => liveTryOn.stop());
window.addEventListener('beforeunload', () => liveTryOn.stop());
document.addEventListener('visibilitychange', () => { if (document.hidden) liveTryOn.stop(); });
const avatar = new AvatarController({
  scene,
  camera,
  host: elements.avatarHost,
  onStatus: (message) => { elements.loaderText.textContent = message.toUpperCase(); }
});

let desktopActive = false;
let desktopKind = '';
let desktopLabel = '';
let mode = 'mirror';
let requestedMode = 'mirror';
let state = 'starting';
const castPlayer = new WatchCastPlayer({
  video: elements.watchVideo, frame: elements.watchFrame, placeholder: elements.watchPlaceholder, urlInput: elements.watchUrl,
  openWatch: () => setAssistantMode('watch'),
  onState: (snapshot) => {
    if (snapshot.transport === 'NO_MEDIA_PRESENT') delete elements.watchPanel.dataset.casting;
    void window.mirrorBridge?.reportCastState?.(snapshot)?.catch(() => {});
  },
  onNotice: (message) => { elements.castingStatus.textContent = message; showGesture(message); }
});
const youtubePlayer = new YouTubeWatchPlayer(elements.watchFrame, (message) => showGesture(message));
const watchPlayback = new WatchPlaybackController({ video: elements.watchVideo, frame: elements.watchFrame, youtube: youtubePlayer, openWatch: () => setAssistantMode('watch') });
let watchLoadGeneration = 0;
let castingEnabled = false;
let assistantTranscript = '';
let hardMuted = localStorage.getItem('mirror.hard-muted') === 'true';
let browserRecognition = null;
let voiceStartGeneration = 0;
let voiceStarting = false;
const captionState = { user: '', assistant: '' };
let captionUserTurnActive = false;
let captionAssistantTurnActive = false;
let localCaptionEpoch = 0;
let localCaptionsAllowed = false;
let userCaptionFromLocal = false;
let idleTimer = null;
let sleepTimer = null;
let sleeping = false;
let cameraWasActiveBeforeSleep = false;
let diagnosticsTimer = 0;

const speech = new SpeechEngine(avatar, { onState: setState });
const gemini = new GeminiLiveAdapter({
  avatar,
  config,
  onState: setState,
  onTranscript: handleTranscript,
  onSpeechStart: beginHeardCaption,
  onError: (message) => showOracle(message, '', 'Connection notice'),
  onSessionEnd: stopAssistant,
  onRemember: async (fact) => {
    const memory = await window.mirrorBridge.rememberFact(fact);
    updateMemoryStatus(memory);
    return memory;
  },
  onTurnComplete: () => {
    captionUserTurnActive = false;
    captionAssistantTurnActive = false;
    returnToRequestedMode();
    if (!hardMuted && !gemini.listening && elements.wakeToggle.checked) wake.resume();
  },
  onModeChange: async (nextMode) => setAssistantMode(nextMode),
  onArEffect: async (effect) => setArEffect(effect),
  onSearch: async (query) => window.mirrorBridge.searchWeb(query),
  onAvatarPosition: async (position) => setAvatarPosition(position),
  onWardrobe: async ({ command = '' } = {}) => {
    setAssistantMode('ar');
    if (/^save(?: (?:garment|photo|it))?$/i.test(command.trim()) && closet.photo.open) await closet.photo.save();
    else if (/^(?:take|capture)(?: a)? photo$/i.test(command.trim()) && closet.photo.open) await closet.photo.capture();
    else if (/^(?:take|capture) (front|back) photo[.!]?$/i.test(command.trim()) && closet.photo.open) { closet.photo.switchView(command.toLowerCase().includes('back') ? 'back' : 'front'); await closet.photo.capture(); }
    else if (/^(?:extract|isolate)(?: worn)? clothing[.!]?$/i.test(command.trim()) && closet.photo.open) await closet.photo.extractClothing();
    else if (!closet.voice(command)) return { result: 'Command not recognized.' };
    return { result: closet.photo.open ? closet.photo.field('status').textContent : 'Wardrobe updated.', photoEditorOpen: closet.photo.open, selected: closet.items.find(item => item.id === closet.selectedId)?.name };
  },
  onTryOn: handleTryOnVoice,
  onTryOnAdjust: adjustTryOn,
  onOpenService: async (service) => window.mirrorBridge.openService(service),
  onOpenWebpage: async (url) => window.mirrorBridge.openWebpage(url),
  onCaptureScreen: async () => {
    const watchHost = (() => { try { return new URL(elements.watchFrame.src).hostname.toLowerCase(); } catch { return ''; } })();
    const watchIsSpotify = mode === 'watch' && elements.watchFrame.classList.contains('loaded')
      && (watchHost === 'spotify.com' || watchHost.endsWith('.spotify.com'));
    if (!desktopActive && (mode === 'spotify' || watchIsSpotify)) throw new Error('Spotify content stays on the mirror and is not shared with AI input.');
    return window.mirrorBridge.captureScreen();
  },
  onMirrorState: getMirrorState,
  onWatchControl: handleWatchControl,
  onComputerAction: async (action) => window.mirrorBridge.desktopAction(action),
  onSpotify: async (action) => {
    if (action === 'status') {
      setAssistantMode('spotify');
      await refreshSpotify();
      return { result: 'Opened the local Spotify player. It will show the current track on screen; do not mention track details.' };
    }
    await window.mirrorBridge.spotifyControl(action);
    await refreshSpotify();
    return { result: 'Spotify playback command completed. The current track is displayed locally; do not mention track details.' };
  }
});
gemini.setVideoSource(() => selectAssistantVision({ mode, desktopActive, camera: elements.video, neural: elements.liveTryOnVideo,
  neuralState: liveTryOn.snapshot(), view: tryOnView, still: elements.tryOnOverlay,
  cameraCanvas: garmentOverlay.cameraCanvas, garmentCanvas: elements.garmentCanvas, effectCanvas: elements.arCanvas,
  width: elements.shell.clientWidth || 720, height: elements.shell.clientHeight || 1280 }));
gemini.setPersona(savedPersona);
gemini.setVisionEnabled(visionEnabled);
gemini.setSpeakingPace(savedPace);

const wake = new WakeWordListener({
  phrase: 'mirror mirror',
  onWake: handleWakeWord,
  onTranscript: handleLocalTranscript,
  onStop: (text) => { appendCaption('user', text, { replace: true }); stopAssistant(); },
  onStatus: updateWakeStatus
});

elements.mute.setAttribute('aria-pressed', String(hardMuted));
elements.muteLabel.textContent = hardMuted ? 'MUTED' : 'MUTE';
elements.mute.querySelector('span').textContent = hardMuted ? '⊘' : '◉';
elements.mute.setAttribute('aria-label', hardMuted ? 'Unmute and arm wake word' : 'Hard mute microphone');
if (hardMuted) elements.mic.disabled = true;

let gestureToastTimer = null;
await initialize();

async function initialize() {
  setState('starting');
  initHeadTracking(elements.video)
    .then(populateCameras)
    .catch((error) => console.warn('[startup] tracking', error));
  gestures.setEnabled(elements.gestureToggle.checked);
  try { await avatar.init('assets/avatar.glb'); }
  catch (error) { console.warn('[startup] avatar', error); }
  depthScene.setAvatarCanvas(avatar.faceHost?.canvas);
  avatar.setDepthEnabled(depthEnabled && mode === 'portal' && !desktopActive);
  await closet.load();
  setMode('mirror');
  setPersona(savedPersona, false);
  avatar.setFacePuppetEnabled(facePuppetEnabled);
  elements.loader.classList.add('done');
  setState('ready');
  elements.oracleCard.classList.add('empty');
  if (elements.wakeToggle.checked && !hardMuted) wake.start();
  else updateWakeStatus('paused');
}

window.__mirrorDebug = { scene, camera, avatar, gestures, depthScene, renderQuality, garmentOverlay, liveTryOn, gemini, getMirrorState, stopAssistant,
  getPowerState: () => ({ ...renderBudget.snapshot(), scene: sceneBudget.snapshot() }) };

function setDepthMode(enabled, announce = true) {
  depthEnabled = Boolean(enabled);
  sceneBudget.invalidate();
  localStorage.setItem('mirror.depth-cube', String(depthEnabled));
  elements.shell.dataset.depth = depthEnabled ? 'cube' : 'flat';
  elements.dimensionSwitch?.querySelectorAll('button').forEach((button) => button.classList.toggle('active', button.dataset.depth === (depthEnabled ? 'cube' : 'flat')));
  depthScene.setDepthEnabled(depthEnabled);
  avatar.setDepthEnabled(depthEnabled && mode === 'portal' && !desktopActive);
  if (announce) showGesture(depthEnabled ? 'Depth Cube · head tracking active' : '2D surface · stable front view');
}
setDepthMode(depthEnabled, false);

function setMode(nextMode) {
  if (!['portal', 'mirror', 'ar', 'watch', 'spotify'].includes(nextMode)) return;
  if (mode === 'ar' && nextMode !== 'ar') { cancelTryOnRender(); liveTryOn.stop(); }
  if (mode === 'watch' && nextMode !== 'watch') { elements.watchVideo.pause(); youtubePlayer.pause(); }
  mode = nextMode;
  sceneBudget.invalidate();
  elements.shell.dataset.mode = nextMode;
  document.querySelectorAll('.mode-btn').forEach((button) => button.classList.toggle('active', button.dataset.mode === nextMode));
  elements.studioPanel.classList.toggle('active', nextMode === 'ar');
  elements.watchPanel.classList.toggle('active', nextMode === 'watch');
  elements.spotifyPanel.classList.toggle('active', nextMode === 'spotify');
  garmentOverlay.setEnabled(nextMode === 'ar' && tryOnView === 'live' && !desktopActive && !liveTryOn.session);
  if (nextMode === 'spotify') { spotifyLastFetchedAt = 0; void refreshSpotify(); }
  depthScene.setMode(desktopActive ? 'mirror' : nextMode);
  avatar.setVisible(desktopActive || nextMode === 'portal' || nextMode === 'ar' || nextMode === 'watch' && Boolean(gemini.listening || browserRecognition || ['connecting', 'listening', 'thinking', 'speaking'].includes(state)));
  avatar.setDisplayMode(nextMode);
  avatar.setDepthEnabled(depthEnabled && nextMode === 'portal' && !desktopActive);
  if (nextMode === 'mirror') elements.oracleCard.classList.add('empty');
  resetIdle();
}

function setAssistantMode(nextMode) {
  if (!['mirror', 'portal', 'ar', 'watch', 'spotify'].includes(nextMode)) return;
  if (desktopActive) void window.mirrorBridge?.closeDesktop?.();
  requestedMode = nextMode;
  setMode(nextMode);
  if (nextMode === 'mirror') elements.oracleCard.classList.add('empty');
}

function setAvatarPosition(position) {
  const allowed = ['center', 'left', 'right', 'upper', 'lower'];
  const selected = allowed.includes(position) ? position : 'center';
  elements.shell.dataset.avatarPosition = selected;
  depthScene.setAvatarPosition(selected);
  localStorage.setItem('mirror.avatar-position', selected);
  showGesture(`Host moved · ${selected}`);
}

function applyDesktopPresentation(presentation) {
  desktopActive = Boolean(presentation?.active);
  if (desktopActive) liveTryOn.stop();
  elements.shell.dataset.desktop = String(desktopActive);
  desktopKind = presentation?.kind || '';
  desktopLabel = presentation?.label || '';
  elements.shell.dataset.desktopKind = desktopKind;
  elements.desktopReturn.hidden = !desktopActive;
  depthScene.setMode(desktopActive ? 'mirror' : mode);
  avatar.setDepthEnabled(depthEnabled && mode === 'portal' && !desktopActive);
  setMode(mode);
  if (desktopActive) {
    elements.settings.classList.remove('open');
    elements.personaPanel.classList.remove('open');
    elements.launcherPanel.classList.remove('open');
  }
}
const removeDesktopListener = window.mirrorBridge?.onDesktopPresentation?.(applyDesktopPresentation);
window.mirrorBridge?.desktopPresentation?.().then(applyDesktopPresentation).catch(() => {});
elements.desktopReturn.addEventListener('click', () => {
  void window.mirrorBridge?.closeDesktop?.().catch((error) => showOracle(error.message, '', 'Desktop browser'));
});

// Explicit fields keep credentials, URLs, camera pixels, and Spotify metadata
// out of structural context. A screenshot is still needed to inspect actual pixels.
function getMirrorState() {
  const vision = gemini.getVideoSourceSnapshot?.() || { available: Boolean(elements.video.srcObject && elements.video.srcObject.active !== false && elements.video.readyState >= 2), source: 'camera' };
  const sharingVision = Boolean(!hardMuted && elements.visionToggle.checked && gemini.listening && gemini.connected && gemini.videoTimer && vision.available);
  const tracking = getTrackingStatus();
  const selected = closet.items.find((item) => item.id === closet.selectedId);
  const video = elements.watchVideo;
  return {
    observedAt: new Date().toISOString(),
    display: { mode, requestedMode, desktopActive, desktopKind, desktopLabel, sleeping, visible: document.visibilityState === 'visible', width: innerWidth, height: innerHeight,
      avatarPosition: elements.shell.dataset.avatarPosition || 'center', depthEnabled },
    voice: { state, connecting: voiceStarting, listening: Boolean(gemini.listening || browserRecognition), hardMuted,
      wakeEnabled: elements.wakeToggle.checked, persona: avatar.persona },
    vision: { ...vision, enabled: elements.visionToggle.checked, sharedWithAssistant: sharingVision },
    camera: { active: Boolean(tracking.cameraActive), error: tracking.error || '', visionSharingEnabled: elements.visionToggle.checked,
      sharedWithAssistant: sharingVision && tracking.cameraActive && vision.source !== 'rendered-try-on-still',
      faceTracking: { ready: tracking.ready, detected: tracking.faceDetected, frameAgeMs: tracking.frameAgeMs, lastInferenceMs: tracking.lastInferenceMs } },
    gestures: { requested: elements.gestureToggle.checked, active: gestures.enabled && gestures.tracker.ready && Boolean(tracking.cameraActive),
      status: gestures.status, lastInferenceMs: gestures.tracker.inferenceMs || 0 },
    tryOn: { view: liveTryOn.session ? 'neural' : tryOnView, rendering: tryOnRendering, consented: elements.tryOnConsent.checked,
      liveAI: { ...liveTryOn.snapshot(), configured: config.hasLiveTryOnProvider, consented: elements.liveTryOnConsent.checked },
      rendererConfigured: config.hasTryOnProvider, rendererHost: config.tryOnProviderHost || '',
      selected: selected ? { name: selected.name, category: selected.category } : null,
      fit: { ...garmentOverlay.fit }, contourOcclusion: Boolean(garmentOverlay.tracker.getSegmentation()), trackingInferenceMs: garmentOverlay.tracker.inferenceMs || 0, previewReady: Boolean(garmentOverlay.texture),
      liveFit: garmentOverlay.getLiveState(),
      renderedStillAvailable: !elements.tryOnStill.disabled,
      photoEditor: { open: closet.photo.open, readyToSave: closet.photo.readyToSave, view: closet.photo.activeView, frontReady: Boolean(closet.photo.views.front?.output), backReady: Boolean(closet.photo.views.back?.output), extracting: Boolean(closet.photo.extracting), saving: Boolean(closet.photo.saving) },
      closet: closet.items.slice(0, 80).map((item) => ({ name: item.name, category: item.category })) },
    watch: { ...watchPlayback.snapshot(), castingEnabled, castActive: castPlayer.active },
    music: { view: elements.spotifyCard.dataset.view || 'classic', metadataKeptLocal: true }
  };
}

function showAssistant() {
  setMode(['ar', 'watch'].includes(requestedMode) ? requestedMode : 'portal');
}

function returnToRequestedMode() {
  setTimeout(() => {
    if (!gemini.listening && state !== 'speaking' && state !== 'thinking') setMode(requestedMode);
  }, 850);
}

function setArEffect(effect, { openStudio = false } = {}) {
  const effects = ['enchanted', 'crown', 'runes', 'aura', 'glasses', 'mask', 'cat', 'halo', 'emoji', 'scan', 'none'];
  const selected = effects.includes(effect) ? effect : 'crown';
  arOverlay.setEffect(selected);
  if (elements.arEffect.querySelector(`option[value="${selected}"]`)) elements.arEffect.value = selected;
  elements.effectGrid.querySelectorAll('.effect-chip').forEach((chip) => chip.classList.toggle('active', chip.dataset.effect === selected));
  if (selected === 'none') {
    showOracle('The enchantment fades.', '', 'AR filter removed');
    return;
  }
  if (openStudio) setAssistantMode('ar');
  const names = { enchanted: 'Enchanted reveal', crown: 'Astral crown', runes: 'Oracle runes', aura: 'Violet aura', glasses: 'Arcane glasses', mask: 'Masquerade mask', cat: 'Familiar cat', halo: 'Celestial halo', emoji: 'Magic emojis', scan: 'Mystic face scan' };
  showOracle(`${names[selected]} applied.`, '', 'AR enchantment');
}

function setState(next) {
  state = next;
  if (mode === 'watch') avatar.setVisible(desktopActive || Boolean(gemini.listening || browserRecognition || ['connecting', 'listening', 'thinking', 'speaking'].includes(next)));
  const labels = {
    starting: 'Awakening', connecting: 'Opening the veil', ready: config.hasGeminiKey ? 'AI ready' : 'Demo ready',
    listening: 'Listening', thinking: 'Consulting', speaking: 'Speaking', offline: 'Demo ready', error: 'Needs attention'
  };
  elements.stateLabel.textContent = labels[next] || next;
  elements.stateDot.className = `state-dot${['starting', 'connecting', 'thinking', 'speaking'].includes(next) ? ' busy' : next === 'error' ? ' error' : ''}`;
  const micActive = Boolean(voiceStarting || gemini?.listening || browserRecognition || speech.isSpeaking || elements.awakening.classList.contains('active'));
  elements.mic.classList.toggle('listening', micActive);
  elements.micLabel.textContent = micActive ? 'STOP' : 'LISTEN';
  elements.mic.setAttribute('aria-label', micActive ? 'Stop listening' : 'Start listening');
  if (next === 'speaking' || next === 'thinking' || next === 'listening') showAssistant();
  if (next === 'listening' && !assistantTranscript) showOracle('Listening…', '', 'Speak to the mirror');
  if (next === 'ready' && !gemini?.listening) returnToRequestedMode();
}

function showOracle(text, user = '', eyebrow = 'The mirror answers') {
  if (!text) return;
  elements.oracleText.textContent = text;
  elements.oracleUser.textContent = user ? `You asked: “${user}”` : '';
  elements.oracleEyebrow.textContent = eyebrow;
  elements.oracleCard.classList.remove('empty');
}

async function askMirror(text) {
  const prompt = text.trim();
  if (!prompt) return;
  appendCaption('user', prompt);
  if (runVoiceNavigation(prompt)) return;
  showAssistant();
  showOracle('The answer is taking shape…', prompt, 'Your question enters the glass');
  assistantTranscript = '';
  const generation = voiceStartGeneration;
  if (config.hasGeminiKey) {
    try {
      await gemini.askText(prompt);
      return;
    } catch (error) {
      if (hardMuted || generation !== voiceStartGeneration) return;
      console.warn('[voice] using demo fallback', error);
    }
  }
  if (hardMuted || generation !== voiceStartGeneration) return;
  const response = speech.respond(prompt);
  appendCaption('assistant', response);
  showOracle(response, prompt);
  if (elements.wakeToggle.checked) wake.resume();
}

async function handleWakeWord(command) {
  if (hardMuted) return;
  const generation = ++voiceStartGeneration;
  const cancelled = () => hardMuted || generation !== voiceStartGeneration;
  void wake.pause();
  await wakeFromSleep();
  if (cancelled()) return;
  // Keep the local stop detector active during the reveal and greeting too.
  wake.setAssistantActive(true);
  void wake.resume();
  appendCaption('user', 'Mirror mirror', { replace: true });
  if (command) {
    showAssistant();
    await askMirror(command);
    return;
  }
  elements.awakening.classList.add('active');
  setState('starting');
  await new Promise((resolve) => setTimeout(resolve, 2350));
  if (cancelled()) return;
  elements.awakening.classList.remove('active');
  showAssistant();
  const greeting = 'Yes, yes, your evil highness. What shall we conjure?';
  if (config.hasGeminiKey) {
    await toggleVoice();
    if (hardMuted || voiceStartGeneration !== generation + 1 || !gemini.listening) return;
    try {
      await gemini.askText(`The user just woke the mirror. Greet them in your current host voice. Say only: ${greeting} Do not call tools.`);
    } catch (error) {
      if (!hardMuted && voiceStartGeneration === generation + 1) showOracle(error.message, '', 'Voice connection');
    }
    return;
  }
  showOracle(greeting, '', 'Mirror mirror');
  appendCaption('assistant', greeting);
  speech.setPersona(avatar.persona || 'velora');
  await speech.speak(greeting);
  if (cancelled()) return;
  await toggleVoice();
}

function updateWakeStatus(status) {
  const labels = {
    armed: 'Say “mirror mirror”', heard: 'Wake word heard', paused: 'Wake word paused',
    training: 'Loading local speech model…', unavailable: 'Wake word unavailable', disconnected: 'Microphone disconnected · reconnect and toggle wake'
  };
  elements.wakeStatus.textContent = hardMuted ? 'Hard muted · unmute to listen'
    : status === 'armed' && (gemini.listening || browserRecognition || voiceStarting) ? 'Listening · say “mirror stop”'
      : !elements.wakeToggle.checked && status === 'paused' ? 'Wake off · use Listen'
        : labels[status] || labels.paused;
  elements.wakeStatus.classList.toggle('armed', !hardMuted && status === 'armed');
}

function beginHeardCaption() {
  localCaptionsAllowed = true;
  userCaptionFromLocal = false;
  captionUserTurnActive = false;
  localCaptionEpoch = wake.startCaptionTurn();
}

function handleLocalTranscript(text, { epoch }) {
  if (hardMuted || !gemini.listening || !localCaptionsAllowed || epoch !== localCaptionEpoch || !text?.trim()) return;
  appendCaption('user', text.trim(), { replace: true });
  userCaptionFromLocal = true;
}

function handleTranscript(role, text) {
  if (!text?.trim()) return;
  const replace = role === 'user' && userCaptionFromLocal;
  if (role === 'user') {
    localCaptionsAllowed = false;
    userCaptionFromLocal = false;
    wake.stopCaptionTurn();
  }
  appendCaption(role, text.trim(), { replace });
  if (role === 'user' && !hardMuted && /\bmirror\s+(?:stop|mute|quiet|cancel)\b/i.test(text)) {
    stopAssistant();
    return;
  }
  if (role === 'assistant') {
    assistantTranscript = `${assistantTranscript} ${text}`.trim();
    showOracle(assistantTranscript, '', 'The mirror answers');
  } else {
    assistantTranscript = '';
    showOracle('Listening…', text.trim(), 'You said');
  }
}

async function toggleVoice() {
  if (hardMuted) return;
  if (voiceStarting || browserRecognition || gemini.listening || speech.isSpeaking || elements.awakening.classList.contains('active')) {
    stopAssistant();
    return;
  }
  const generation = ++voiceStartGeneration;
  elements.awakening.classList.remove('active');
  speech.stop();
  if (!config.hasGeminiKey) {
    wake.pause();
    startBrowserRecognition();
    return;
  }
  voiceStarting = true;
  wake.setAssistantActive(true);
  void wake.resume();
  setState('connecting');
  try {
    const active = await gemini.toggleMicrophone();
    if (hardMuted || generation !== voiceStartGeneration) return;
    elements.mic.classList.toggle('listening', active);
    elements.micLabel.textContent = active ? 'STOP' : 'LISTEN';
    wake.setAssistantActive(active);
    if (!hardMuted && (active || elements.wakeToggle.checked)) wake.resume();
    else void wake.pause();
  } catch (error) {
    if (hardMuted || generation !== voiceStartGeneration) return;
    voiceStarting = false;
    wake.setAssistantActive(false);
    setState('error');
    showOracle(error.message, '', 'Voice connection');
    if (!hardMuted && elements.wakeToggle.checked) wake.resume();
    else void wake.pause();
  } finally {
    if (generation === voiceStartGeneration) {
      voiceStarting = false;
      setState(state);
    }
  }
}

function appendCaption(role, text, { replace = false } = {}) {
  if (!['user', 'assistant'].includes(role)) return;
  const row = role === 'user' ? elements.captionUser : elements.captionAssistant;
  if (role === 'user' && !captionUserTurnActive) {
    captionUserTurnActive = true;
    captionAssistantTurnActive = false;
    captionState.user = '';
    elements.captionUser.querySelector('span').textContent = '';
    elements.captionUser.classList.remove('visible');
    captionState.assistant = '';
    elements.captionAssistant.querySelector('span').textContent = '';
    elements.captionAssistant.classList.remove('visible');
  } else if (role === 'assistant' && !captionAssistantTurnActive) {
    captionAssistantTurnActive = true;
    captionUserTurnActive = false;
    captionState.assistant = '';
  }
  const valueNode = row.querySelector('span');
  const previous = captionState[role];
  const merged = replace ? text : text === previous || previous.startsWith(text) ? previous
    : text.startsWith(previous) ? text : `${previous} ${text}`.trim();
  // Keep a bounded transcript and scroll each single-line row to the newest words.
  const next = Array.from(merged).slice(-2000).join('');
  captionState[role] = next;
  valueNode.textContent = next;
  row.classList.toggle('visible', Boolean(next));
  elements.captions.classList.toggle('visible', Boolean(captionState.user || captionState.assistant));
  valueNode.scrollLeft = valueNode.scrollWidth;
}

window.addEventListener('resize', () => {
  for (const row of [elements.captionUser, elements.captionAssistant]) {
    const value = row.querySelector('span');
    value.scrollLeft = value.scrollWidth;
  }
});

function stopAssistant() {
  liveTryOn.stop();
  cancelTryOnRender();
  localCaptionsAllowed = false;
  userCaptionFromLocal = false;
  voiceStarting = false;
  elements.awakening.classList.remove('active');
  captionUserTurnActive = false;
  captionAssistantTurnActive = false;
  void window.mirrorBridge?.cancelDesktopActions?.();
  voiceStartGeneration += 1;
  const recognition = browserRecognition;
  browserRecognition = null;
  recognition?.abort?.();
  speech.stop();
  gemini.stopMicrophone();
  gemini.stopPlayback();
  gemini.disconnect();
  wake.setAssistantActive(false);
  elements.mic.classList.remove('listening');
  elements.micLabel.textContent = 'LISTEN';
  setState('ready');
  elements.oracleCard.classList.add('empty');
  showGesture(hardMuted ? 'Stopped · microphone muted' : elements.wakeToggle.checked ? 'Stopped · say “mirror mirror” to resume' : 'Stopped · use Listen to resume');
  if (!hardMuted && elements.wakeToggle.checked) wake.resume();
  else void wake.pause();
}

async function setHardMute(muted) {
  if (muted) liveTryOn.stop();
  if (muted) cancelTryOnRender();
  localCaptionsAllowed = false;
  userCaptionFromLocal = false;
  voiceStarting = false;
  voiceStartGeneration += 1;
  elements.awakening.classList.remove('active');
  captionUserTurnActive = false;
  captionAssistantTurnActive = false;
  hardMuted = Boolean(muted);
  elements.mic.disabled = hardMuted;
  localStorage.setItem('mirror.hard-muted', String(hardMuted));
  elements.mute.setAttribute('aria-pressed', String(hardMuted));
  elements.muteLabel.textContent = hardMuted ? 'MUTED' : 'MUTE';
  elements.mute.querySelector('span').textContent = hardMuted ? '⊘' : '◉';
  elements.mute.setAttribute('aria-label', hardMuted ? 'Unmute and arm wake word' : 'Hard mute microphone');
  if (hardMuted) {
    void window.mirrorBridge?.cancelDesktopActions?.();
    browserRecognition?.abort?.();
    browserRecognition = null;
    speech.stop();
    gemini.stopMicrophone();
    gemini.stopPlayback();
    gemini.disconnect();
    wake.setAssistantActive(false);
    void wake.pause();
    elements.mic.classList.remove('listening');
    elements.micLabel.textContent = 'LISTEN';
    setState('ready');
    elements.oracleCard.classList.add('empty');
    updateWakeStatus('paused');
    showGesture('Microphone hard muted');
  } else {
    showGesture(elements.wakeToggle.checked ? 'Wake word armed · say “mirror mirror”' : 'Microphone unmuted · use Listen');
    if (elements.wakeToggle.checked) wake.resume();
    else updateWakeStatus('paused');
  }
}

function startBrowserRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    showOracle('Type your question below, or add a Gemini key to unlock live voice.', '', 'Demo voice is unavailable');
    return;
  }
  const recognition = new Recognition();
  browserRecognition = recognition;
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.onstart = () => {
    if (hardMuted || browserRecognition !== recognition) { recognition.abort(); return; }
    elements.micLabel.textContent = 'STOP';
    wake.setAssistantActive(true);
    if (elements.wakeToggle.checked) void wake.resume();
    setState('listening');
  };
  let submitted = '';
  recognition.onresult = (event) => {
    if (hardMuted || browserRecognition !== recognition) return;
    let finalText = '';
    let heardText = '';
    for (let i = 0; i < event.results.length; i += 1) {
      const text = event.results[i][0].transcript.trim();
      heardText += `${text} `;
      if (event.results[i].isFinal) finalText += `${text} `;
    }
    if (heardText.trim()) appendCaption('user', heardText.trim(), { replace: true });
    if (finalText.trim()) {
      const finalPrompt = finalText.trim();
      if (/\bmirror\s+(?:stop|mute|quiet|cancel)\b/i.test(finalPrompt)) stopAssistant();
      else if (submitted !== finalPrompt) { submitted = finalPrompt; void askMirror(finalPrompt); }
    }
  };
  recognition.onerror = () => { if (browserRecognition === recognition) setState('ready'); };
  recognition.onend = () => {
    if (browserRecognition !== recognition) return;
    browserRecognition = null;
    if (state === 'listening') setState('ready');
    if (!hardMuted && elements.wakeToggle.checked) wake.resume();
  };
  recognition.start();
}

async function populateCameras() {
  const cameras = await getCameraDevices();
  const tracking = getTrackingStatus();
  elements.cameraSelect.innerHTML = cameras.length
    ? cameras.map((device, i) => `<option value="${escapeHtml(device.deviceId)}">${escapeHtml(device.label || `Camera ${i + 1}`)}</option>`).join('')
    : '<option value="">No camera detected</option>';
  const active = cameras.find((device) => device.label === tracking.activeCameraLabel);
  if (active) elements.cameraSelect.value = active.deviceId;
  updateTrackingUi();
}

function updateTrackingUi() {
  const tracking = getTrackingStatus();
  if (liveTryOn.session && !tracking.cameraActive) liveTryOn.stop('Camera disconnected. Live AI try-on stopped.');
  elements.trackingBadge.textContent = tracking.faceDetected ? 'FACE LOCK' : tracking.cameraActive ? 'SEARCHING' : 'MOUSE';
  elements.cameraToggle.textContent = tracking.cameraActive ? 'Camera off' : 'Camera on';
  elements.cameraNotice.textContent = tracking.error || '';
  elements.cameraNotice.hidden = !tracking.error;
}

function refreshConnectionSettings() {
  elements.apiBadge.textContent = config.hasGeminiKey ? 'GEMINI CONFIGURED' : 'DEMO MODE';
  elements.spotifyClientId.value = config.spotifyClientId || '';
  elements.tryOnProvider.value = config.tryOnProvider || 'off';
  elements.tryOnEndpoint.value = config.tryOnEndpoint || '';
  elements.tryOnProject.value = config.tryOnProject || '';
  elements.tryOnLocation.value = config.tryOnLocation || 'us-central1';
  elements.tryOnClearToken.checked = false;
  elements.decartClearKey.checked = false;
  elements.decartKey.placeholder = config.hasLiveTryOnProvider ? 'Key configured · leave blank to keep it' : 'Decart API key';
  updateLiveTryOnControls();
  updateTryOnConnectionFields();
  elements.tryOnConnectionNote.textContent = config.tryOnProvider === 'off'
    ? 'Off uses the local garment preview.'
    : config.tryOnProvider === 'custom' && config.hasTryOnToken ? 'A renderer token is configured. Leave it blank to keep it.' : 'Camera frames are sent only after consent and a render request.';
  elements.rememberConnections.checked = Boolean(config.secureStorageAvailable) && config.rememberConnections !== false;
  elements.rememberConnections.disabled = !config.secureStorageAvailable;
  elements.disableGemini.disabled = !config.hasGeminiKey;
  elements.saveConnections.disabled = !window.mirrorBridge?.saveConnections;
  elements.configNote.textContent = config.hasGeminiKey
    ? 'Live voice is configured. Select Listen or say “mirror mirror” to connect.'
    : 'Add a Gemini API key above to enable live conversation.';
  elements.connectionStatus.textContent = config.settingsNotice || (config.secureStorageAvailable
    ? 'Saved keys are encrypted on this device. Leave the key field blank to keep the current key.'
    : 'Connections entered here apply to this session only. Encrypted storage is unavailable.');
}
function updateTryOnConnectionFields() {
  elements.tryOnCustomSettings.hidden = elements.tryOnProvider.value !== 'custom';
  elements.tryOnCloudSettings.hidden = elements.tryOnProvider.value !== 'vertex';
  // Inactive fields must not prevent submitting the selected provider.
  for (const field of [elements.tryOnEndpoint, elements.tryOnToken, elements.tryOnClearToken]) field.disabled = elements.tryOnProvider.value !== 'custom';
  for (const field of [elements.tryOnProject, elements.tryOnLocation]) field.disabled = elements.tryOnProvider.value !== 'vertex';
}
elements.tryOnProvider.addEventListener('change', updateTryOnConnectionFields);
refreshConnectionSettings();
async function saveConnectionSettings(clearGemini = false) {
  if (!window.mirrorBridge?.saveConnections) return;
  const input = { remember: elements.rememberConnections.checked, clearGemini };
  if (!clearGemini) {
    input.spotifyClientId = elements.spotifyClientId.value.trim();
    if (elements.decartClearKey.checked) input.decartApiKey = '';
    else if (elements.decartKey.value.trim()) input.decartApiKey = elements.decartKey.value.trim();
    input.tryOnProvider = elements.tryOnProvider.value;
    if (input.tryOnProvider === 'custom') {
      input.tryOnEndpoint = elements.tryOnEndpoint.value.trim();
      if (elements.tryOnClearToken.checked) input.tryOnApiKey = '';
      else if (elements.tryOnToken.value.trim()) input.tryOnApiKey = elements.tryOnToken.value.trim();
    } else if (input.tryOnProvider === 'vertex') {
      input.tryOnProject = elements.tryOnProject.value.trim();
      input.tryOnLocation = elements.tryOnLocation.value.trim() || 'us-central1';
    }
  }
  if (elements.geminiKey.value.trim() && !clearGemini) input.geminiApiKey = elements.geminiKey.value.trim();
  elements.saveConnections.disabled = true;
  elements.disableGemini.disabled = true;
  elements.connectionStatus.textContent = 'Saving connections…';
  try {
    const previousTryOn = JSON.stringify([config.tryOnProvider, config.tryOnEndpoint, config.tryOnProject, config.tryOnLocation]);
    const next = await window.mirrorBridge.saveConnections(input);
    elements.geminiKey.value = '';
    elements.tryOnToken.value = '';
    elements.decartKey.value = '';
    stopAssistant();
    elements.liveTryOnConsent.checked = false;
    const changedTryOn = previousTryOn !== JSON.stringify([next.tryOnProvider, next.tryOnEndpoint, next.tryOnProject, next.tryOnLocation]);
    Object.assign(config, next);
    if (changedTryOn) {
      elements.tryOnConsent.checked = false;
      elements.tryOnRun.disabled = true;
    }
    elements.tryOnConsentCopy.textContent = config.hasTryOnProvider
      ? `I consent to send one camera frame and this garment to ${config.tryOnProviderHost || 'the configured renderer'} for rendering. Cost, processing, and retention follow that provider's terms.`
      : 'I consent to capture one camera frame for this local try-on sample.';
    elements.tryOnRun.textContent = config.hasTryOnProvider ? 'Render selected look' : 'Save local try-on sample';
    refreshConnectionSettings();
    elements.connectionStatus.textContent = next.remembered ? 'Connections saved on this device.' : 'Connections updated for this session only.';
    await refreshSpotify();
    setState('ready');
  } catch (error) { elements.connectionStatus.textContent = error.message; }
  finally {
    elements.geminiKey.value = '';
    elements.tryOnToken.value = '';
    elements.decartKey.value = '';
    elements.saveConnections.disabled = !window.mirrorBridge?.saveConnections;
    elements.disableGemini.disabled = !config.hasGeminiKey;
  }
}
elements.connectionForm.addEventListener('submit', (event) => { event.preventDefault(); void saveConnectionSettings(); });
elements.disableGemini.addEventListener('click', () => { void saveConnectionSettings(true); });

elements.mic.addEventListener('click', toggleVoice);
elements.mute.addEventListener('click', () => { void setHardMute(!hardMuted); });
elements.dimensionSwitch?.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-depth]');
  if (button) setDepthMode(button.dataset.depth === 'cube');
});
elements.oracleCard.addEventListener('click', () => elements.oracleCard.classList.add('empty'));
elements.oracleClose.addEventListener('click', () => elements.oracleCard.classList.add('empty'));
document.querySelectorAll('.mode-btn').forEach((button) => button.addEventListener('click', () => setAssistantMode(button.dataset.mode)));
elements.settingsToggle.addEventListener('click', (event) => { event.stopPropagation(); elements.settings.classList.toggle('open'); populateCameras(); });
elements.personaToggle.addEventListener('click', (event) => { event.stopPropagation(); elements.personaPanel.classList.toggle('open'); });
elements.launcherToggle.addEventListener('click', (event) => { event.stopPropagation(); elements.launcherPanel.classList.toggle('open'); });
elements.settings.addEventListener('click', (event) => event.stopPropagation());
elements.personaPanel.addEventListener('click', (event) => event.stopPropagation());
elements.launcherPanel.addEventListener('click', (event) => event.stopPropagation());
document.addEventListener('click', () => { elements.settings.classList.remove('open'); elements.personaPanel.classList.remove('open'); elements.launcherPanel.classList.remove('open'); });
elements.personaList.addEventListener('click', (event) => {
  const card = event.target.closest('[data-persona]');
  if (card) {
    setPersona(card.dataset.persona);
    setAssistantMode('portal');
  }
});
elements.cameraSelect.addEventListener('change', async () => { liveTryOn.stop(); cancelTryOnRender(); await switchCamera(elements.cameraSelect.value); updateTrackingUi(); });
elements.cameraMount.addEventListener('change', () => {
  const mount = elements.cameraMount.value === 'center' ? 'center' : 'top';
  localStorage.setItem('mirror.camera-mount', mount);
  setTrackingOptions({ mount });
  showGesture(mount === 'top' ? 'Top-mounted camera profile selected' : 'Centered camera profile selected');
});
elements.citySelect.addEventListener('change', () => dashboard.setCity(elements.citySelect.value));
elements.glassProfile.addEventListener('change', () => {
  const profile = elements.glassProfile.value === 'night' ? 'night' : 'glass';
  elements.shell.dataset.glassProfile = profile;
  localStorage.setItem('mirror.glass-profile', profile);
  showGesture(profile === 'glass' ? 'Glass ready · high contrast' : 'Night calm · reduced glow');
});
elements.arEffect.addEventListener('change', () => setArEffect(elements.arEffect.value));
elements.effectGrid.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-effect]');
  if (chip) setArEffect(chip.dataset.effect);
});
elements.watchLoad.addEventListener('click', loadWatchVideo);
elements.watchUrl.addEventListener('keydown', (event) => { if (event.key === 'Enter') loadWatchVideo(); });
const spotifyDevicePicker = new SpotifyDevices({ select: elements.spotifyDeviceSelect, use: elements.spotifyDeviceUse,
  refresh: elements.spotifyDeviceRefresh, status: elements.spotifyDeviceStatus, bridge: window.mirrorBridge,
  onTransfer: () => refreshSpotify() });
window.__mirrorDebug.spotifyDevicePicker = spotifyDevicePicker;
let spotifySnapshot = null;
let spotifyLastFetchedAt = 0;
let spotifyRefreshBusy = false;
function renderSpotifyStatus(message) { elements.spotifyStatus.textContent = message; }
function clearSpotifyControls() {
  spotifyDevicePicker.clear();
  spotifySnapshot = null;
  elements.spotifyPlay.disabled = true;
  document.querySelectorAll('[data-spotify-action]').forEach(button => { button.disabled = true; });
}

async function refreshSpotify() {
  if (spotifyRefreshBusy || !window.mirrorBridge?.spotifyStatus) return;
  spotifyRefreshBusy = true;
  try {
    const auth = await window.mirrorBridge.spotifyStatus();
    elements.spotifyConnect.hidden = auth.local ? !auth.accountConfigured : auth.connected;
    elements.spotifyDisconnect.hidden = !auth.connected || auth.local;
    elements.spotifyConnect.disabled = auth.local ? !auth.accountConfigured : !auth.configured;
    if (!auth.configured) renderSpotifyStatus('Add your Spotify app client ID in Settings to connect.');
    else if (!auth.connected) renderSpotifyStatus('Connect Spotify for the currently playing track and controls.');
    if (!auth.connected) {
      clearSpotifyControls();
      return;
    }
    elements.spotifyDeviceRefresh.disabled = Boolean(auth.local) || spotifyDevicePicker.busy;
    if (auth.local) { spotifyDevicePicker.clear(); spotifyDevicePicker.status.textContent = 'Playback stays on this Windows PC · no Spotify developer setup needed.'; }
    else if (!spotifyDevicePicker.devices.length && !spotifyDevicePicker.busy) void spotifyDevicePicker.refresh();
    const snapshot = await window.mirrorBridge.spotifyCurrent();
    if (snapshot.error || snapshot.connected === false) {
      clearSpotifyControls();
      renderSpotifyStatus(snapshot.error || 'Connect Spotify to refresh playback.'); return;
    }
    spotifySnapshot = snapshot;
    spotifyLastFetchedAt = Date.now();
    const item = snapshot.item;
    elements.spotifyTitle.textContent = item?.name || 'Nothing playing';
    elements.spotifyArtist.textContent = item?.artists?.join(' · ') || (snapshot.source === 'windows-native' ? 'Open Spotify app on this PC and start a song' : 'Start playback in Spotify on a connected device');
    elements.spotifyAlbum.textContent = item?.album || 'Spotify ambient player';
    elements.spotifyDevice.textContent = snapshot.device ? `${snapshot.isPlaying ? 'Playing on' : 'Device:'} ${snapshot.device}` : '';
    const art = item?.imageUrl;
    const safeArt = Boolean(art && (/^https:\/\//i.test(art) || (snapshot.source === 'windows-native' && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(art) && art.length < 1500000)));
    if (safeArt) elements.spotifyCover.src = art;
    else elements.spotifyCover.removeAttribute('src');
    elements.spotifyCover.hidden = !safeArt;
    elements.spotifyTrackLink.hidden = !item?.externalUrl || !item?.uri;
    elements.spotifyTrackLink.dataset.url = item?.externalUrl || '';
    elements.spotifyTrackLink.dataset.uri = item?.uri || '';
    elements.spotifyPlay.textContent = snapshot.isPlaying ? 'Ⅱ' : '▶';
    elements.spotifyPlay.setAttribute('aria-label', snapshot.isPlaying ? 'Pause' : 'Play');
    elements.spotifyPlay.disabled = !snapshot.canControl || (snapshot.isPlaying ? snapshot.canPause === false : snapshot.canResume === false);
    document.querySelectorAll('[data-spotify-action]').forEach((button) => {
      button.disabled = !snapshot.canControl || (button.dataset.spotifyAction === 'next' ? snapshot.canNext === false : snapshot.canPrevious === false);
    });
    elements.spotifyProgress.max = String(Math.max(1, snapshot.durationMs || 1));
    elements.spotifyProgress.value = String(snapshot.progressMs || 0);
    renderSpotifyStatus(snapshot.statusMessage || (snapshot.isPlaying ? snapshot.source === 'windows-native' ? 'Playing in Spotify on this PC' : 'Playing now' : item ? 'Paused' : 'Ready when you are'));
  } catch (error) { clearSpotifyControls(); renderSpotifyStatus(error.message); }
  finally { spotifyRefreshBusy = false; }
}
document.querySelector('#spotify-open-app').addEventListener('click', async () => {
  try { await window.mirrorBridge.openService('spotify'); } catch (error) { renderSpotifyStatus(error.message); }
});
elements.spotifyConnect.addEventListener('click', async () => {
  elements.spotifyConnect.disabled = true;
  renderSpotifyStatus('Opening Spotify sign-in…');
  try { await window.mirrorBridge.spotifyConnect(); renderSpotifyStatus('Finish Spotify sign-in in your browser.'); }
  catch (error) { renderSpotifyStatus(error.message); elements.spotifyConnect.disabled = false; }
});
elements.spotifyDisconnect.addEventListener('click', async () => {
  try { await window.mirrorBridge.spotifyDisconnect(); await refreshSpotify(); }
  catch (error) { renderSpotifyStatus(error.message); }
});
async function spotifyCommand(action) {
  try {
    await window.mirrorBridge.spotifyControl(action);
    await refreshSpotify();
  } catch (error) { renderSpotifyStatus(error.message); }
}
document.querySelectorAll('[data-spotify-action]').forEach((button) => {
  button.addEventListener('click', () => { void spotifyCommand(button.dataset.spotifyAction); });
});
elements.spotifyPlay.addEventListener('click', () => spotifyCommand(spotifySnapshot?.isPlaying ? 'pause' : 'play'));
elements.spotifyTrackLink.addEventListener('click', async (event) => {
  event.preventDefault();
  try { await window.mirrorBridge.openSpotifyItem({ uri: elements.spotifyTrackLink.dataset.uri, url: elements.spotifyTrackLink.dataset.url }); }
  catch (error) { renderSpotifyStatus(error.message); }
});
elements.spotifyViews.addEventListener('click', () => {
  const view = elements.spotifyCard.dataset.view === 'classic' ? 'pocket' : 'classic';
  elements.spotifyCard.dataset.view = view;
  elements.spotifyViews.textContent = view === 'pocket' ? 'Switch to classic' : 'Switch to pocket';
  localStorage.setItem('mirror.spotify-view', view);
});
elements.spotifyCard.dataset.view = localStorage.getItem('mirror.spotify-view') === 'pocket' ? 'pocket' : 'classic';
elements.spotifyViews.textContent = elements.spotifyCard.dataset.view === 'pocket' ? 'Switch to classic' : 'Switch to pocket';
window.mirrorBridge?.onSpotifyAuthStatus?.((status) => {
  if (status.error) renderSpotifyStatus(status.error);
  else renderSpotifyStatus(status.connected ? 'Spotify connected.' : 'Spotify sign-in cancelled.');
  elements.spotifyConnect.disabled = false;
  void refreshSpotify();
});
setInterval(() => {
  if (document.hidden || sleeping) return;
  if (mode === 'spotify' && Date.now() - spotifyLastFetchedAt > 8000) void refreshSpotify();
  if (mode === 'spotify' && spotifySnapshot?.isPlaying && spotifySnapshot.durationMs) {
    const progress = Math.min(spotifySnapshot.durationMs, (spotifySnapshot.progressMs || 0) + Date.now() - spotifyLastFetchedAt);
    elements.spotifyProgress.value = String(progress);
  }
}, 1000);
elements.windowsCastSettings.hidden = !config.isWindows;
elements.windowsCastSettings.addEventListener('click', async () => {
  try {
    await window.mirrorBridge?.openCastSettings();
    showOracle('Windows Projecting settings are open. Enable Wireless Display, then set this PC as available to project to. On your phone, choose Cast or Smart View and select this PC.', '', 'Windows wireless display');
  } catch (error) {
    showOracle(error.message, '', 'Windows wireless display');
  }
});
elements.phoneLinkToggle.addEventListener('click', async () => {
  elements.phoneLinkToggle.disabled = true;
  elements.phoneLinkStatus.textContent = 'Starting a private local link…';
  try {
    const pairing = await window.mirrorBridge?.startPhoneLink();
    if (!pairing) throw new Error('Phone linking is available in the installed mirror app.');
    elements.phoneLinkQr.src = pairing.qrDataUrl;
    elements.phoneLinkAddress.textContent = pairing.url;
    elements.phoneLinkStatus.textContent = 'Scan with a phone on this Wi-Fi, paste a media link, then tap Send.';
    elements.phoneLinkPanel.classList.remove('hidden');
    elements.phoneLinkToggle.textContent = 'Phone link active';
  } catch (error) {
    elements.phoneLinkStatus.textContent = error.message;
    elements.phoneLinkPanel.classList.add('hidden');
    showOracle(error.message, '', 'Phone link');
  } finally { elements.phoneLinkToggle.disabled = false; }
});
elements.phoneLinkStop.addEventListener('click', async () => {
  await window.mirrorBridge?.stopPhoneLink();
  elements.phoneLinkPanel.classList.add('hidden');
  elements.phoneLinkQr.removeAttribute('src');
  elements.phoneLinkToggle.textContent = 'Connect phone';
  elements.phoneLinkStatus.textContent = 'Same Wi-Fi required.';
});
elements.castingToggle.addEventListener('click', async () => {
  elements.castingToggle.disabled = true;
  try {
    if (castingEnabled) {
      await window.mirrorBridge?.stopCasting?.(); castPlayer.detach(); castingEnabled = false;
      elements.castingStatus.textContent = 'Casting is off.';
    } else {
      const receiver = await window.mirrorBridge?.startCasting?.();
      if (!receiver) throw new Error('LAN casting is available in the installed mirror app.');
      castingEnabled = true;
      elements.castingStatus.textContent = `Choose “${receiver.name}” in a DLNA-compatible casting app on this Wi-Fi. Anyone on this network can cast while enabled.`;
    }
    elements.castingToggle.textContent = castingEnabled ? 'Stop LAN casting' : 'Enable LAN casting';
    elements.castingToggle.setAttribute('aria-pressed', String(castingEnabled));
  } catch (error) { elements.castingStatus.textContent = error.message; }
  finally { elements.castingToggle.disabled = false; }
});
const removeCastCommandListener = window.mirrorBridge?.onCastCommand?.(async (command) => {
  try {
    if (command.action === 'load') { watchLoadGeneration += 1; youtubePlayer.detach(); }
    await castPlayer.command(command);
    if (command.action === 'load') {
      elements.watchPanel.dataset.casting = 'true';
      elements.castingStatus.textContent = 'Media connected · use your phone to play, pause, seek, or adjust volume.';
    }
    await window.mirrorBridge.completeCastCommand({ id: command.id });
  } catch (error) { await window.mirrorBridge.completeCastCommand({ id: command.id, error: error.message }).catch(() => {}); }
});
const removePhoneMediaListener = window.mirrorBridge?.onPhoneMedia?.((url) => {
  elements.watchUrl.value = url;
  setAssistantMode('watch');
  loadWatchVideo();
  showGesture('Phone sent a media link');
});
document.querySelectorAll('[data-service]').forEach((button) => button.addEventListener('click', async () => {
  try {
    await window.mirrorBridge?.openService(button.dataset.service);
    showGesture(`Opening ${button.textContent}`);
  } catch (error) {
    showOracle(error.message, '', 'Service launcher');
  }
}));
elements.quickNoteInput.value = localStorage.getItem('mirror.quick-note') || '';
elements.quickNoteForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const note = elements.quickNoteInput.value.trim();
  localStorage.setItem('mirror.quick-note', note);
  dashboard.refreshNow();
  showGesture(note ? 'Note saved to this mirror' : 'Note cleared');
});
elements.voiceSelect.addEventListener('change', () => {
  localStorage.setItem('mirror.voice', elements.voiceSelect.value);
  gemini.setVoice(elements.voiceSelect.value);
  showOracle(`Voice changed to ${elements.voiceSelect.options[elements.voiceSelect.selectedIndex].text}. It will be used for the next response.`, '', 'Voice updated');
});
elements.paceSelect.addEventListener('change', () => {
  localStorage.setItem('mirror.pace', elements.paceSelect.value);
  gemini.setSpeakingPace(elements.paceSelect.value);
});
elements.visionToggle.addEventListener('change', () => {
  localStorage.setItem('mirror.vision', String(elements.visionToggle.checked));
  gemini.setVisionEnabled(elements.visionToggle.checked);
  updateVisionNotice();
});
elements.wakeToggle.addEventListener('change', () => {
  localStorage.setItem('mirror.wake', String(elements.wakeToggle.checked));
  if (!hardMuted && (elements.wakeToggle.checked || gemini.listening || voiceStarting)) wake.resume();
  else wake.pause();
});
elements.gestureToggle.addEventListener('change', () => {
  localStorage.setItem('mirror.gestures', String(elements.gestureToggle.checked));
  gestures.setEnabled(elements.gestureToggle.checked);
  showGesture(elements.gestureToggle.checked ? 'Hand navigation on' : 'Hand navigation off');
});
elements.facePuppetToggle.addEventListener('change', () => {
  localStorage.setItem('mirror.face-puppet', String(elements.facePuppetToggle.checked));
  avatar.setFacePuppetEnabled(elements.facePuppetToggle.checked);
  showGesture(elements.facePuppetToggle.checked ? 'Face puppet on · webcam input' : 'Face puppet off · AI animation');
});
elements.tryOnConsent.addEventListener('change', () => {
  if (!elements.tryOnConsent.checked) cancelTryOnRender();
  elements.tryOnRun.disabled = tryOnRendering || !elements.tryOnConsent.checked || !closet.selectedId;
  elements.tryOnStatus.textContent = elements.tryOnConsent.checked
    ? config.hasTryOnProvider ? `Consent confirmed · frame and garment will be sent to ${config.tryOnProviderHost || 'the configured provider'}.` : 'Consent confirmed · one frame will be saved locally.'
    : 'Consent is required before the camera frame is captured.';
});
function cancelTryOnRender() {
  const id = tryOnRequestId;
  if (!id) return false;
  tryOnRequestId = null;
  tryOnRendering = false;
  elements.tryOnCancel.hidden = true;
  elements.tryOnRun.disabled = !elements.tryOnConsent.checked || !closet.selectedId;
  elements.tryOnStatus.textContent = 'Render cancelled · live camera fit is available.';
  void window.mirrorBridge?.cancelTryOn?.(id)?.catch(error => console.warn('[try-on cancellation]', error.message));
  return true;
}

async function renderSelectedTryOn() {
  if (tryOnRendering) return { result: 'A still is already rendering. Wait for that result before requesting another.' };
  if (!closet.selectedId || !elements.tryOnConsent.checked) {
    setStudioToolsOpen(true);
    elements.tryOnStatus.textContent = 'Select a garment and confirm consent to capture or render a still.';
    return { result: 'Select a closet garment and confirm consent in the Try On panel before rendering.' };
  }
  if (!elements.video.srcObject || elements.video.readyState < 2 || !elements.video.videoWidth || !elements.video.videoHeight) {
    elements.tryOnStatus.textContent = 'Turn on the camera and stand in the frame first.';
    return { result: 'The camera is not ready. Turn on the camera and stand in frame first.' };
  }
  tryOnRendering = true;
  const requestId = crypto.randomUUID();
  tryOnRequestId = requestId;
  elements.tryOnCancel.hidden = false;
  const revision = garmentRevision;
  const garmentId = closet.selectedId;
  elements.tryOnRun.disabled = true;
  elements.tryOnStatus.textContent = 'Capturing one local frame…';
  try {
    const canvas = document.createElement('canvas');
    const longestSide = 1024;
    const targetAspect = (elements.shell.clientWidth || window.innerWidth) / (elements.shell.clientHeight || window.innerHeight);
    const sourceAspect = elements.video.videoWidth / elements.video.videoHeight;
    let sx = 0; let sy = 0; let sw = elements.video.videoWidth; let sh = elements.video.videoHeight;
    if (sourceAspect > targetAspect) {
      sw = elements.video.videoHeight * targetAspect;
      sx = (elements.video.videoWidth - sw) / 2;
    } else {
      sh = elements.video.videoWidth / targetAspect;
      sy = (elements.video.videoHeight - sh) / 2;
    }
    canvas.width = Math.round(longestSide * targetAspect);
    canvas.height = longestSide;
    const context = canvas.getContext('2d');
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(elements.video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const request = { requestId, destinationId: config.tryOnDestinationId || '', garmentId, frameDataUrl: canvas.toDataURL('image/jpeg', .9), consent: true };
    const job = window.mirrorBridge?.queueTryOn
      ? await window.mirrorBridge.queueTryOn(request)
      : { id: `browser-preview-${Date.now()}`, providerConfigured: false, previewOnly: true };
    if (requestId !== tryOnRequestId || revision !== garmentRevision) return { result: 'The previous render was cancelled or superseded. The current view remains selected.' };
    if (job?.resultUrl) {
      elements.tryOnResult.src = job.resultUrl;
      elements.tryOnResult.classList.add('visible');
      elements.tryOnOverlay.src = job.resultUrl;
      elements.tryOnStill.disabled = false;
      setTryOnView('rendered');
      const confidence = Number.isFinite(job.confidence) ? ` · ${Math.round(job.confidence * 100)}% provider confidence` : '';
      elements.tryOnStatus.textContent = `Rendered ${job.garmentName}${confidence} · ${Math.round(job.latencyMs / 1000)}s`;
      showOracle(`${job.garmentName} has been rendered. Review the look in the studio.`, '', 'Try-on ready');
      return { result: `${job.garmentName} was rendered. Ask the user to review the look in the studio.` };
    } else {
      elements.tryOnStatus.textContent = job?.providerConfigured ? `Provider returned no preview · job ${job.id}` : job?.previewOnly ? 'Browser preview complete. Nothing was saved or uploaded.' : 'Frame saved locally. Configure a try-on renderer to generate the outfit preview.';
      showOracle(job?.providerConfigured ? 'The try-on provider completed without an image preview.' : job?.previewOnly ? 'Browser preview completed with one in-memory frame. Nothing was saved or uploaded.' : 'Your selected garment and one consented frame are saved locally. No provider is configured yet.', '', 'Try-on prepared');
      return { result: 'No rendered outfit image is available. Explain that rendering is not configured yet.' };
    }
  } catch (error) {
    if (requestId !== tryOnRequestId) return { result: 'The previous render was cancelled.' };
    if (revision === garmentRevision) elements.tryOnStatus.textContent = error.message;
    return { error: error.message };
  } finally {
    if (requestId === tryOnRequestId) {
      tryOnRequestId = null;
      tryOnRendering = false;
      elements.tryOnCancel.hidden = true;
      elements.tryOnRun.disabled = !elements.tryOnConsent.checked || !closet.selectedId;
    }
  }
}

async function handleTryOnVoice({ garmentName = '', renderStill = false } = {}) {
  const liveAIActive = Boolean(liveTryOn.session);
  const query = String(garmentName).trim().toLocaleLowerCase();
  if (!query) return { result: 'Ask which garment to try on.' };
  const { item, choices } = matchGarment(closet.items, query);
  if (!item && choices.length) return { result: 'Several closet items match. Ask which one to try on.', choices: choices.map(candidate => ({ name: candidate.name, category: candidate.category })) };
  if (!item) return { result: 'No matching item is in the local closet. Ask the user to add it or choose an existing closet item.' };
  if (item.id !== closet.selectedId || !garmentOverlay.texture) closet.select(item.id);
  setAssistantMode('ar');
  if (!renderStill) {
    if (liveAIActive) return { result: `Selected ${item.name} for the consented live AI session. Check current mirror state before claiming the outfit is visible.`, liveAI: liveTryOn.snapshot() };
    setTryOnView('live');
    const ready = await garmentSelection;
    if (closet.selectedId !== item.id) return { result: 'The garment selection changed while loading. Use the current mirror state before continuing.' };
    const liveFit = garmentOverlay.getLiveState();
    return { result: ready ? `Selected ${item.name} for a local live camera fit. ${liveFit.status} Body tracking estimates placement; it does not simulate fabric or measure size. No frame was saved or uploaded.` : garmentOverlay.imageMessage || 'The garment image is not ready for live fit.', liveFit };
  }
  if (!config.hasTryOnProvider) return { result: `Selected ${item.name}, but no rendering provider is configured. Do not claim a try-on was rendered.` };
  if (!elements.tryOnConsent.checked) {
    setStudioToolsOpen(true);
    elements.tryOnConsent.focus();
    showOracle(`I selected ${item.name}. Confirm the consent box in Try On, then ask me to render it.`, '', 'Consent needed');
    return { result: `Selected ${item.name}. Ask the user to confirm the consent box in the Try On panel, then they can ask you to render it.` };
  }
  showOracle(`Preparing ${item.name}.`, '', 'Try-on');
  return renderSelectedTryOn();
}

elements.tryOnCancel.addEventListener('click', () => cancelTryOnRender());
elements.tryOnRun.addEventListener('click', () => { void renderSelectedTryOn(); });
elements.tryOnLive.addEventListener('click', () => setTryOnView('live'));
elements.tryOnStill.addEventListener('click', () => setTryOnView('rendered'));
elements.studioToolsToggle.addEventListener('click', () => setStudioToolsOpen(elements.studioTools.hidden));
for (const control of [elements.garmentWidth, elements.garmentLength, elements.garmentOffset]) {
  control.addEventListener('input', () => {
    garmentOverlay.setFit({ width: Number(elements.garmentWidth.value), length: Number(elements.garmentLength.value), offset: Number(elements.garmentOffset.value) });
  });
}
elements.garmentFitReset.addEventListener('click', () => { garmentOverlay.setFit({ width: 1, length: 1, offset: 0 }); syncGarmentFitControls(); });

function syncGarmentFitControls() {
  elements.garmentWidth.value = garmentOverlay.fit.width;
  elements.garmentLength.value = garmentOverlay.fit.length;
  elements.garmentOffset.value = garmentOverlay.fit.offset;
}

function setStudioToolsOpen(open) {
  elements.studioTools.hidden = !open;
  elements.studioToolsToggle.setAttribute('aria-expanded', String(open));
  elements.studioToolsToggle.textContent = open ? 'Hide tools' : 'Show tools';
}

function setTryOnView(view) {
  if (view === 'rendered' && !elements.tryOnOverlay.getAttribute('src')) return false;
  liveTryOn.stop();
  tryOnView = view === 'rendered' ? 'rendered' : 'live';
  elements.shell.dataset.tryonView = tryOnView;
  elements.tryOnLive.setAttribute('aria-pressed', String(tryOnView === 'live'));
  elements.tryOnStill.setAttribute('aria-pressed', String(tryOnView === 'rendered'));
  elements.tryOnOverlay.classList.toggle('visible', tryOnView === 'rendered');
  elements.garmentFit.hidden = tryOnView !== 'live';
  elements.studioSummary.textContent = tryOnView === 'rendered'
    ? `Rendered still · ${garmentOverlay.item?.name || 'selected look'}`
    : garmentOverlay.lastStatus || 'Choose a garment to see your live fit.';
  garmentOverlay.setEnabled(mode === 'ar' && tryOnView === 'live');
  return true;
}

async function adjustTryOn({ view, width, length, offset, reset = false } = {}) {
  if (!closet.selectedId) return { result: 'Choose a local closet garment first.' };
  if (view === 'neural') {
    if (!config.hasLiveTryOnProvider || !elements.liveTryOnConsent.checked) {
      setStudioToolsOpen(true);
      elements.liveTryOnConsent.focus();
      return { result: 'Live AI requires a Decart key in Settings and the user confirming its camera sharing checkbox in Try On. Ask the user to confirm before starting.' };
    }
    await startLiveTryOn();
    return { result: 'Live AI connection requested. Report the current state; do not claim the outfit is visible unless streaming.', liveAI: liveTryOn.snapshot() };
  }
  if (liveTryOn.session && !view) return { result: 'Local mesh fit sliders do not change neural cloth. Select another garment or switch to local live camera fit first.' };
  if (view && !setTryOnView(view)) return { result: 'No rendered still exists for this garment yet. Render one after consent first.' };
  const fit = garmentOverlay.setFit(reset ? { width: 1, length: 1, offset: 0 } : { width, length, offset });
  syncGarmentFitControls();
  setAssistantMode('ar');
  return { result: `Try-on view: ${tryOnView}. Live fit width ${fit.width}, length ${fit.length}, vertical offset ${fit.offset}.` };
}
elements.clearMemory.addEventListener('click', async () => {
  if (!window.confirm('Clear every personal fact the mirror has learned?')) return;
  config.memory = await window.mirrorBridge.clearMemory();
  updateMemoryStatus(config.memory);
  gemini.disconnect();
  showOracle('My stored memory of you has been cleared.', '', 'Memory cleared');
});
elements.sensitivity.addEventListener('input', () => {
  const value = Number(elements.sensitivity.value);
  setTrackingOptions({ sensitivity: value });
  elements.sensitivityValue.textContent = `${value.toFixed(1)}×`;
});
elements.smoothing.addEventListener('input', () => {
  const value = Number(elements.smoothing.value);
  setTrackingOptions({ smoothing: value });
  elements.smoothingValue.textContent = `${Math.round((1 - value) * 100)}%`;
});
elements.cameraToggle.addEventListener('click', async () => {
  const enable = !getTrackingStatus().cameraActive;
  if (!enable) liveTryOn.stop();
  if (!enable) cancelTryOnRender();
  await toggleCamera(enable);
  await populateCameras();
});
elements.calibrateDepth.addEventListener('click', () => {
  const ready = calibrateDepth();
  showOracle(
    ready ? 'Depth is calibrated from a stable sample at your normal viewing spot. Move side to side, then slightly up and down, to test the window effect.' : getTrackingStatus().calibrationReason,
    '',
    ready ? 'Screen alignment saved' : 'Camera needed'
  );
});
elements.diagnosticsToggle.addEventListener('click', () => elements.diagnostics.classList.toggle('open'));
elements.fullscreenToggle.addEventListener('click', () => window.mirrorBridge?.toggleFullscreen());

function resetIdle() {
  if (sleeping) void wakeFromSleep();
  elements.form.classList.remove('dim');
  clearTimeout(idleTimer);
  clearTimeout(sleepTimer);
  idleTimer = setTimeout(() => {
    if (state === 'ready') elements.form.classList.add('dim');
  }, 6000);
  sleepTimer = setTimeout(() => {
    if (desktopActive || state !== 'ready' || !['mirror', 'portal'].includes(mode) || gemini.listening || closet.photo.open ||
        elements.settings.classList.contains('open') || elements.personaPanel.classList.contains('open') ||
        elements.launcherPanel.classList.contains('open')) return;
    sleeping = true;
    resumeRendering();
    cameraWasActiveBeforeSleep = getTrackingStatus().cameraActive;
    elements.shell.dataset.sleeping = 'true';
    gestures.setEnabled(false);
    if (cameraWasActiveBeforeSleep) void toggleCamera(false);
  }, 180000);
}

async function wakeFromSleep() {
  if (!sleeping) return;
  sleeping = false;
  delete elements.shell.dataset.sleeping;
  resumeRendering();
  if (cameraWasActiveBeforeSleep) {
    const restored = await toggleCamera(true);
    gestures.setEnabled(restored && elements.gestureToggle.checked);
    await populateCameras();
  }
  cameraWasActiveBeforeSleep = false;
}
window.addEventListener('pointermove', resetIdle);
window.addEventListener('pointerdown', resetIdle);
window.addEventListener('keydown', (event) => {
  resetIdle();
  if (/input|select|textarea/i.test(event.target.tagName) || event.target.isContentEditable) return;
  if (event.key === '1') setMode('portal');
  if (event.key === '2') setMode('mirror');
  if (event.key === '3') setMode('ar');
  if (event.key === '4') setMode('watch');
  if (event.key.toLowerCase() === 'f') window.mirrorBridge?.toggleFullscreen();
  if (event.key.toLowerCase() === 'c') elements.cameraToggle.click();
  if (event.key.toLowerCase() === 'd' && !/input|select|textarea/i.test(event.target.tagName)) elements.diagnostics.classList.toggle('open');
});
resetIdle();

const clock = new THREE.Clock();
const renderBudget = new RenderBudget();
let animationFrame = null;
let animationTimer = null;
let statusTick = 0;
let cubeContentTick = 0;
function animate() {
  animationFrame = null;
  animationTimer = null;
  if (document.hidden || sleeping) {
    renderBudget.shouldRender(performance.now(), { hidden: document.hidden, sleeping });
    animationTimer = setTimeout(animate, 500);
    return;
  }
  animationFrame = requestAnimationFrame(animate);
  if (!renderBudget.shouldRender(performance.now(), { hidden: false, sleeping: false, mode, depthEnabled, avatarVisible: avatar.visible })) return;
  const frameDelta = clock.getDelta();
  const dt = Math.min(frameDelta, 0.05);
  const elapsed = clock.elapsedTime;
  const viewer = updateHeadTracking(performance.now());
  if (depthEnabled) {
    elements.shell.style.setProperty('--viewer-x', `${Math.round(viewer.x * 42)}px`);
    elements.shell.style.setProperty('--viewer-y', `${Math.round(viewer.y * 30)}px`);
  } else {
    elements.shell.style.setProperty('--viewer-x', '0px');
    elements.shell.style.setProperty('--viewer-y', '0px');
  }
  gestures.update(performance.now());
  if (depthEnabled) applyOffAxisProjection(camera, viewer);
  else {
    const viewport = viewportSize();
    applyFlatProjection(camera, viewport.width / Math.max(viewport.height, 1));
  }
  depthScene.update(dt, elapsed, depthEnabled ? viewer : { x: 0, y: 0, z: 1 });
  if (depthEnabled && elapsed - cubeContentTick > 1) {
    cubeContentTick = elapsed;
    depthScene.setCubeContent({
      time: document.querySelector('#clock-time')?.textContent || '',
      date: document.querySelector('#clock-date')?.textContent || '',
      weather: `${document.querySelector('#weather-temp')?.textContent || ''} ${document.querySelector('#weather-condition')?.textContent || ''}`,
      quote: document.querySelector('#mirror-quote')?.textContent || '',
      note: document.querySelector('#now-card p')?.textContent || 'Your day, held in view.'
    });
  }
  avatar.setFaceBlendshapes(getFaceBlendshapes());
  avatar.setEyeGaze(getEyeGaze());
  avatar.update(dt, elapsed, depthEnabled ? viewer : { x: 0, y: 0, z: 1 });
  arOverlay.render(getFaceLandmarks(), elements.video, elapsed, mode === 'ar' && !desktopActive);
  garmentOverlay.render(performance.now());
  if (sceneBudget.shouldRender({ hidden: document.hidden, sleeping, depthEnabled, awakening: elements.awakening.classList.contains('active'), mode })) renderer.render(scene, camera);
  updateRenderQuality(frameDelta);
  diagnosticsTimer += dt;
  if (diagnosticsTimer > .25 && elements.diagnostics.classList.contains('open')) {
    diagnosticsTimer = 0;
    updateDiagnostics();
  }
  statusTick += dt;
  if (statusTick > 0.5) { statusTick = 0; updateTrackingUi(); }
}
animate();

// Avoid waiting for the standby heartbeat before the first restored frame.
function resumeRendering() {
  sceneBudget.invalidate();
  if (animationFrame !== null) cancelAnimationFrame(animationFrame);
  if (animationTimer !== null) clearTimeout(animationTimer);
  renderBudget.reset();
  clock.getDelta();
  animate();
}
document.addEventListener('visibilitychange', resumeRendering);
window.addEventListener('pointerdown', resumeRendering);
window.addEventListener('keydown', resumeRendering);
window.addEventListener('beforeunload', () => {
  if (animationFrame !== null) cancelAnimationFrame(animationFrame);
  if (animationTimer !== null) clearTimeout(animationTimer);
});

function updateDiagnostics() {
  const tracking = getTrackingStatus();
  const blends = getFaceBlendshapes() || {};
  const gaze = getEyeGaze() || {};
  elements.diagRender.textContent = `${Math.round(renderQuality.fps)} fps · ${renderQuality.pixelRatio.toFixed(2)}× DPR`;
  elements.diagTracking.textContent = tracking.faceDetected ? 'Face lock' : tracking.cameraActive ? 'Searching' : 'Mouse fallback';
  const avatarVideo = avatar.getAvatarVideoStatus();
  const hostSource = avatarVideo.active
    ? `video · ${avatarVideo.state}${avatarVideo.width ? ` · ${avatarVideo.width}×${avatarVideo.height}` : ''}`
    : `${avatar.persona || 'velora'} · ${avatar.faceHost ? 'rig' : 'loading'}`;
  elements.diagRig.textContent = hostSource;
  elements.diagBlendshapes.textContent = `${Object.keys(blends).length} channels`;
  elements.diagGaze.textContent = gaze.confidence ? `${Math.round(gaze.confidence * 100)}% confidence` : 'No gaze lock';
}

window.addEventListener('resize', () => {
  const viewport = viewportSize();
  camera.aspect = viewport.width / viewport.height;
  camera.updateProjectionMatrix();
  renderQuality.maxPixelRatio = preferredPixelRatio();
  renderQuality.pixelRatio = Math.min(renderQuality.pixelRatio, renderQuality.maxPixelRatio);
  renderer.setPixelRatio(renderQuality.pixelRatio);
  renderer.setSize(viewport.width, viewport.height);
  sceneBudget.invalidate();
  arOverlay.resize();
  garmentOverlay.resize();
});

window.addEventListener('beforeunload', () => { removePhoneMediaListener?.(); removeCastCommandListener?.(); castPlayer.destroy(); youtubePlayer.destroy(); removeDesktopListener?.(); garmentOverlay.destroy(); wake.destroy(); gemini.disconnect(); });

async function loadConfig() {
  try {
    if (!window.mirrorBridge) throw new Error('Electron bridge not present');
    return await window.mirrorBridge.getConfig();
  }
  catch (error) {
    console.info('[config] browser preview uses demo defaults');
    return { hasGeminiKey: false, geminiModel: 'gemini-3.1-flash-live-preview', geminiVoice: 'Aoede', city: 'San Francisco', units: 'imperial' };
  }
}

async function loadMemory() {
  try { return await window.mirrorBridge?.readMemory() || { version: 1, facts: [] }; }
  catch (error) {
    console.warn('[memory] unavailable', error.message);
    return { version: 1, facts: [] };
  }
}

function updateMemoryStatus(memory) {
  config.memory = memory;
  const count = memory?.facts?.length || 0;
  elements.memoryStatus.textContent = `${count} ${count === 1 ? 'memory' : 'memories'}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

async function handleWatchControl(args = {}) {
  const action = String(args.action || 'status');
  if (action === 'load') {
    if (!args.url) throw new Error('Give Watch a video URL to load.');
    elements.watchUrl.value = String(args.url).slice(0, 2048);
    setAssistantMode('watch');
    return loadWatchVideo();
  }
  return watchPlayback.command(action, args.seconds === undefined ? 15 : Number(args.seconds));
}

async function loadWatchVideo() {
  const generation = ++watchLoadGeneration;
  const url = elements.watchUrl.value.trim();
  if (!url) return;
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Use an http(s) video URL.');
    const videoId = youtubeId(parsed);
    if (videoId && !/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error('Paste a complete YouTube video link.');
    castPlayer.detach();
    youtubePlayer.detach();
    const spotifyEmbed = spotifyEmbedUrl(parsed);
    if (videoId || spotifyEmbed) {
      elements.watchVideo.pause();
      elements.watchVideo.removeAttribute('src');
      elements.watchVideo.classList.remove('loaded');
      if (videoId) {
        await youtubePlayer.load(videoId);
        if (generation !== watchLoadGeneration) return;
      } else elements.watchFrame.src = spotifyEmbed;
      elements.watchFrame.classList.add('loaded');
    } else {
      elements.watchFrame.removeAttribute('src');
      elements.watchFrame.classList.remove('loaded');
      elements.watchVideo.src = parsed.href;
      elements.watchVideo.classList.add('loaded');
      elements.watchVideo.play().catch(() => {});
    }
    elements.watchPlaceholder.classList.add('hidden');
    return { result: 'Media source selected; playback readiness is reported by its player.', ...watchPlayback.snapshot() };
  } catch (error) {
    if (generation !== watchLoadGeneration) return;
    youtubePlayer.detach();
    showOracle(error.message, '', 'Watch mode');
    return { error: error.message };
  }
}

function youtubeId(url) {
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';
  if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtube-nocookie.com') return url.searchParams.get('v') || (/^\/(?:shorts|embed)\//.test(url.pathname) ? url.pathname.split('/')[2] : '');
  return '';
}

function spotifyEmbedUrl(url) {
  const host = url.hostname.replace(/^www\./, '');
  if (host !== 'open.spotify.com') return '';
  const [kind, id] = url.pathname.split('/').filter(Boolean);
  if (!['track', 'album', 'playlist', 'episode', 'show'].includes(kind) || !id) return '';
  return `https://open.spotify.com/embed/${kind}/${encodeURIComponent(id)}?utm_source=magic-mirror`;
}

function runVoiceNavigation(prompt) {
  if (closet.voice(prompt)) { setAssistantMode('ar'); return true; }
  if (/\b(?:return|go back) to (?:the )?mirror\b|\bclose (?:the )?(?:desktop browser|browser window)\b/i.test(prompt)) {
    window.mirrorBridge?.closeDesktop().catch((error) => showOracle(error.message, '', 'Desktop browser'));
    setAssistantMode('mirror');
    return true;
  }
  const urlMatch = prompt.match(/\b(?:open|visit|go to)\s+((?:https?:\/\/|www\.)[^\s]+)/i)
    || prompt.match(/\b(?:open|visit|go to)\s+([a-z0-9-]+\.[a-z]{2,}(?:\/[^\s]*)?)/i);
  if (urlMatch) {
    const url = urlMatch[1].replace(/[),.!?]+$/, '');
    window.mirrorBridge?.openWebpage(/^https?:\/\//i.test(url) ? url : `https://${url}`)
      .then(() => showGesture(`Opening ${url}`))
      .catch((error) => showOracle(error.message, prompt, 'Desktop browser'));
    return true;
  }
  const text = prompt.toLowerCase().replace(/[.,!?]/g, ' ');
  if (/\b(?:start|enable|show) (?:live ai|neural)(?: try on)?\b/.test(text)) {
    void adjustTryOn({ view: 'neural' }).then(result => showGesture(result.result));
    return true;
  }
  if (/\b(?:stop|disable|end) (?:live ai|neural)(?: try on)?\b/.test(text)) {
    liveTryOn.stop(); showGesture('Live AI stopped · camera sharing ended'); return true;
  }
  if (mode === 'watch' && !desktopActive) {
    const playback = text.match(/^(?:please\s+)?(pause|resume|play)(?:\s+(?:the\s+)?(?:video|movie|playback))?\s*$/);
    const seek = text.match(/^(?:please\s+)?(?:skip|seek|go)(?:\s+\w+)?\s+(forward|ahead|back|backward)(?:\s+(\d+)\s*(?:seconds?|secs?))?\s*$/);
    if (playback || seek) {
      const action = playback ? playback[1] === 'pause' ? 'pause' : 'play' : 'seek';
      const seconds = seek ? Number(seek[2] || 15) * (/back/.test(seek[1]) ? -1 : 1) : undefined;
      void handleWatchControl({ action, seconds }).then((result) => showGesture(result.error || result.result || 'Playback command sent')).catch((error) => showGesture(error.message));
      return true;
    }
  }
  const effect = text.match(/\b(?:try on|wear|apply|show me)\s+(?:(?:my|the|a|an)\s+)?(enchanted|crown|glasses|mask|halo|aura|runes)\b/);
  if (effect) { setArEffect(effect[1], { openStudio: true }); return true; }
  if (mode === 'ar' && closet.selectedId) {
    const viewMatch = text.match(/\b(?:show|switch to|return to)\s+(?:the\s+)?(live camera|live fit|rendered still)\b/);
    const fitMatch = text.match(/\b(?:make|move)\s+(?:it|the garment|the fit)\s+(wider|narrower|longer|shorter|up|down)\b/);
    if (viewMatch || fitMatch || /\breset (?:the )?fit\b/.test(text)) {
      const changes = { wider: { width: garmentOverlay.fit.width + .08 }, narrower: { width: garmentOverlay.fit.width - .08 }, longer: { length: garmentOverlay.fit.length + .08 }, shorter: { length: garmentOverlay.fit.length - .08 }, up: { offset: garmentOverlay.fit.offset - .03 }, down: { offset: garmentOverlay.fit.offset + .03 } };
      void adjustTryOn(viewMatch ? { view: viewMatch[1] === 'rendered still' ? 'rendered' : 'live' } : fitMatch ? changes[fitMatch[1]] : { reset: true }).then(result => showGesture(result.result));
      return true;
    }
    if (/\b(?:render|refine)\s+(?:(?:this|the|my)\s+)?(?:look|outfit|still)\b/.test(text)) {
      const selected = closet.items.find((item) => item.id === closet.selectedId);
      requestTryOnFromNavigation({ garmentName: selected?.name || '', renderStill: true }, prompt);
      return true;
    }
  }
  const tryOnMatch = text.match(/\b(?:try on|wear|put me in)\s+(?:my\s+|the\s+)?(.+)/)
    || text.match(/\b(?:render|refine)(?: a still of)?\s+(?:my|the)\s+(.+)/);
  if (tryOnMatch) {
    requestTryOnFromNavigation({ garmentName: tryOnMatch[1].trim(), renderStill: /\b(?:render|refine)\b/.test(tryOnMatch[0]) }, prompt);
    return true;
  }
  const searchMatch = text.match(/\b(?:search(?: the web)? for|look up)\s+(.+)/);
  if (searchMatch) {
    window.mirrorBridge?.searchWeb(searchMatch[1].trim())
      .then(() => showGesture('Opening web search'))
      .catch((error) => showOracle(error.message, '', 'Web search'));
    return true;
  }
  const positionMatch = text.match(/\bmove (?:yourself|your face|the face) to (center|left|right|upper|lower)\b/);
  if (positionMatch) {
    showAssistant();
    setAvatarPosition(positionMatch[1]);
    return true;
  }
  const ambientMusicMatch = text.match(/\b(?:show|switch to|go to|open)\s+(?:the\s+)?(?:spotify\s+)?(?:ambient\s+)?(?:music\s+)?(?:player|now playing|music mode|spotify ambient)\b|\bshow\s+(?:my\s+)?(?:spotify|music)\b/);
  if (ambientMusicMatch) { setAssistantMode('spotify'); return true; }
  const serviceMatch = text.match(/\b(?:open|show)\s+(?:my\s+)?(calendar|photos|maps|map|spotify|music|youtube|netflix)\b/);
  if (serviceMatch) {
    const service = { map: 'maps', music: 'spotify' }[serviceMatch[1]] || serviceMatch[1];
    window.mirrorBridge?.openService(service)
      .then(() => showGesture(`Opening ${service === 'spotify' ? 'Music' : service.replace(/^./, (letter) => letter.toUpperCase())}`))
      .catch((error) => showOracle(error.message, '', 'Service launcher'));
    return true;
  }
  if (/\b(?:open|show|where is)\s+(?:my\s+)?(?:find my|friends|family|people)\b/.test(text)) {
    window.mirrorBridge?.openService('findmy')
      .then(() => showGesture('Opening Find My'))
      .catch((error) => showOracle(error.message, '', 'Find My'));
    return true;
  }
  const modeMatch = text.match(/\b(?:show|open|go to|switch to|take me to)\s+(?:the\s+)?(ambient|home|mirror|converse|conversation|assistant|try\s*on|studio|watch|video|youtube|spotify|music)\b/);
  if (modeMatch) {
    const word = modeMatch[1].replace(/\s+/g, ' ');
    const next = /spotify|music/.test(word) ? 'spotify' : /ambient|home|mirror/.test(word) ? 'mirror' : /converse|conversation|assistant/.test(word) ? 'portal' : /try|studio/.test(word) ? 'ar' : 'watch';
    setAssistantMode(next);
    showOracle(`${{ mirror: 'Ambient', portal: 'Converse', ar: 'Try on', watch: 'Watch', spotify: 'Music' }[next]} mode is open.`, '', 'Voice navigation');
    return true;
  }
  return false;
}

function requestTryOnFromNavigation(args, prompt) {
  handleTryOnVoice(args).then((result) => {
    const answer = result?.error || result?.result || 'Try-on request handled.';
    appendCaption('assistant', answer);
    showOracle(answer, prompt, 'Try-on');
    if (!config.hasGeminiKey) speech.speak(answer);
  }).catch((error) => showOracle(error.message, prompt, 'Try-on'));
}

function handleGesture(type) {
  void dispatchGesture(type).catch((error) => showGesture(error.message));
}

async function dispatchSpotifyGesture(type) {
  let playing = false;
  if (type === 'pinch') {
    const current = await window.mirrorBridge.spotifyCurrent();
    if (current.error) throw new Error(current.error);
    if (!current.connected || typeof current.isPlaying !== 'boolean') throw new Error('Connect Spotify in Music before using playback gestures.');
    playing = current.isPlaying;
  }
  const action = type === 'pinch' ? playing ? 'pause' : 'play' : type === 'swipe-left' ? 'next' : 'previous';
  await window.mirrorBridge.spotifyControl(action);
  await refreshSpotify();
  showGesture({ play: 'Play requested', pause: 'Pause requested', next: 'Next track requested', previous: 'Previous track requested' }[action]);
}

async function dispatchGesture(type) {
  if (type !== 'palm' && closet.photo.gesture(type)) return;
  if (type === 'palm') {
    if (voiceStarting || gemini.listening || browserRecognition || speech.isSpeaking || ['thinking', 'speaking'].includes(state) || elements.awakening.classList.contains('active')) {
      stopAssistant();
      return;
    }
    if (desktopActive) {
      await window.mirrorBridge.closeDesktop();
      showGesture('Open palm · return to mirror');
    } else {
      setAssistantMode('portal');
      showGesture('Open palm · Converse');
    }
    return;
  }
  if (desktopActive) {
    if (desktopKind === 'native' && desktopLabel === 'Spotify' && ['pinch', 'swipe-left', 'swipe-right'].includes(type)) {
      await dispatchSpotifyGesture(type); return;
    }
    if (['swipe-up', 'swipe-down'].includes(type)) {
      // Dragging content upward reveals the next portion of the page.
      const result = await window.mirrorBridge.scrollDesktopGesture(type === 'swipe-up' ? 'down' : 'up');
      showGesture(result?.result || 'Scroll requested');
    } else showGesture('Swipe up/down to scroll · hold palm to return');
    return;
  }
  if (mode === 'spotify' && ['pinch', 'swipe-left', 'swipe-right'].includes(type)) {
    await dispatchSpotifyGesture(type); return;
  }
  if (mode === 'watch' && ['pinch', 'swipe-left', 'swipe-right'].includes(type)) {
    const action = type === 'pinch' ? watchPlayback.snapshot().playing ? 'pause' : 'play' : 'seek';
    const result = await watchPlayback.command(action, type === 'swipe-left' ? 15 : -15);
    showGesture(result.result || 'Playback command sent');
    return;
  }
  if (mode === 'ar' && closet.items.length && ['swipe-left', 'swipe-right'].includes(type)) {
    const current = closet.items.findIndex((item) => item.id === closet.selectedId);
    const delta = type === 'swipe-left' ? 1 : -1;
    const item = closet.items[(Math.max(0, current) + delta + closet.items.length) % closet.items.length];
    closet.select(item.id);
    showGesture(`Live fit · ${item.name}`);
    return;
  }
  if (type === 'pinch') {
    if (mode !== 'ar') { showGesture('Pinch: play/pause in Watch/Music · filter in Try on'); return; }
    const effects = ['enchanted', 'crown', 'glasses', 'mask', 'halo', 'aura', 'runes'];
    const current = effects.indexOf(arOverlay.effect);
    const next = effects[(current + 1) % effects.length];
    setArEffect(next);
    showGesture(`Pinch · ${next.replace(/^./, (letter) => letter.toUpperCase())}`);
    return;
  }
  // Vertical swipes always navigate modes outside the browser. Horizontal
  // swipes also navigate when there is no mode-specific media/garment action.
  if (!['swipe-left', 'swipe-right', 'swipe-up', 'swipe-down'].includes(type)) return;
  const modes = ['mirror', 'portal', 'watch', 'spotify'];
  const current = modes.indexOf(mode === 'ar' ? 'portal' : mode);
  const delta = ['swipe-left', 'swipe-up'].includes(type) ? 1 : -1;
  const next = modes[(current + delta + modes.length) % modes.length];
  setAssistantMode(next);
  const labels = { mirror: 'Ambient', portal: 'Converse', watch: 'Watch', spotify: 'Music' };
  showGesture(`Swipe · ${labels[next]}`);
}

function showGesture(text) {
  elements.gestureToast.textContent = text;
  elements.gestureToast.classList.add('show');
  clearTimeout(gestureToastTimer);
  gestureToastTimer = setTimeout(() => elements.gestureToast.classList.remove('show'), 1400);
}

function setPersona(persona, announce = true) {
  const hosts = {
    velora: { name: 'Evil Queen', image: 'assets/personas/evil-queen-head-v3.png' },
    solenne: { name: 'Snow', image: 'assets/personas/snow-head-v2.png' },
    rowan: { name: 'Advit', image: 'assets/personas/advit-head-reference.png' }
  };
  const selected = hosts[persona] ? persona : 'velora';
  localStorage.setItem('mirror.persona', selected);
  void avatar.setPersona(selected);
  speech.setPersona(selected);
  const personaVoice = gemini.setPersona(selected);
  if (personaVoice) {
    elements.voiceSelect.value = personaVoice;
    localStorage.setItem('mirror.voice', personaVoice);
  }
  elements.personaToggleImage.src = hosts[selected].image;
  elements.personaList.querySelectorAll('[data-persona]').forEach((card) => card.classList.toggle('active', card.dataset.persona === selected));
  elements.personaPanel.classList.remove('open');
  if (announce) showOracle(`${hosts[selected].name} is now your mirror host. The voice updates for the next live conversation.`, '', 'Host changed');
}

function updateRenderQuality(dt) {
  renderQuality.frames += 1;
  renderQuality.elapsed += dt;
  if (renderQuality.elapsed < 2) return;
  renderQuality.fps = renderQuality.frames / renderQuality.elapsed;
  const previous = renderQuality.pixelRatio;
  if (renderQuality.fps < renderBudget.targetFps * .7 && renderQuality.pixelRatio > .8) renderQuality.pixelRatio = Math.max(.8, renderQuality.pixelRatio - .1);
  else if (renderQuality.fps > renderBudget.targetFps * .95 && renderQuality.pixelRatio < renderQuality.maxPixelRatio) renderQuality.pixelRatio = Math.min(renderQuality.maxPixelRatio, renderQuality.pixelRatio + .05);
  if (renderQuality.pixelRatio !== previous) {
    renderer.setPixelRatio(renderQuality.pixelRatio);
    // Never let the adaptive DPR pass resize the canvas to the surrounding
    // desktop browser. The render surface is the portrait mirror shell.
    const viewport = viewportSize();
    renderer.setSize(viewport.width, viewport.height);
    sceneBudget.invalidate();
  }
  renderQuality.frames = 0;
  renderQuality.elapsed = 0;
}
