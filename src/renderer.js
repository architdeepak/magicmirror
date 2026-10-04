import { FaceNavigation } from './faceNavigation.js';
import { BodyTryOn } from './bodyTryOn.js';
import { findGarment } from './starterWardrobe.js';
import * as THREE from 'three';
import { AvatarController } from './avatarController.js';
import { ClosetStore } from './closetStore.js';
import { AROverlay } from './arOverlay.js';
import { createDepthScene } from './depthScene.js';
import { GeminiLiveAdapter } from './geminiLiveAdapter.js';
import { GestureNavigation } from './gestureNavigation.js';
import { MagicMirrorView } from './magicMirrorView.js';
import { StreamingCaption, lastTwoLines } from './streamingCaption.js';
import { SpeechEngine } from './speechEngine.js';
import { WakeWordListener, parseMirrorCommand } from './wakeWord.js';
import { parseMirrorAction, createMirrorActionDispatcher } from './mirrorActions.js';
import { TrackingDebugOverlay } from './trackingDebug.js';
import { MediaPanelController, assistantDisplayMode } from './mediaPanelController.js';
import { SleepController } from './sleepController.js';
import {
  applyOffAxisProjection,
  applyFlatProjection,
  calibrateDepth,
  getCameraDevices,
  getFaceBlendshapes,
  getFaceLandmarks,
  getFaceMatrix,
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
  canvas: document.querySelector('#scene-canvas'),
  video: document.querySelector('#camera-feed'),
  arCanvas: document.querySelector('#ar-canvas'),
  handOverlay: document.querySelector('#hand-overlay'),
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
  hardStop: document.querySelector('#hard-stop-btn'),
  sleepButton: document.querySelector('#sleep-btn'),
  sleepHint: document.querySelector('#sleep-hint'),
  dragLabel: document.querySelector('#effect-drag-label'),
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
  liveCaption: document.querySelector('#live-caption'),
  visionNotice: document.querySelector('#vision-notice'),
  clearMemory: document.querySelector('#clear-memory'),
  memoryStatus: document.querySelector('#memory-status'),
  sensitivity: document.querySelector('#sensitivity'),
  sensitivityValue: document.querySelector('#sensitivity-value'),
  smoothing: document.querySelector('#smoothing'),
  smoothingValue: document.querySelector('#smoothing-value'),
  cameraToggle: document.querySelector('#camera-toggle'),
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
  trackingHealth: document.querySelector('#tracking-health'),
  apiBadge: document.querySelector('#api-badge'),
  configNote: document.querySelector('#config-note'),
  dashboard: document.querySelector('#dashboard-container'),
  studioPanel: document.querySelector('#studio-panel'),
  watchPanel: document.querySelector('#watch-panel'),
  effectGrid: document.querySelector('#effect-grid'),
  watchUrl: document.querySelector('#watch-url'),
  watchLoad: document.querySelector('#watch-load'),
  watchVideo: document.querySelector('#watch-video'),
  watchFrame: document.querySelector('#watch-frame'),
  watchPlaceholder: document.querySelector('#watch-placeholder'),
  closetList: document.querySelector('#closet-list'),
  closetImport: document.querySelector('#closet-import'),
  tryOnConsent: document.querySelector('#tryon-consent'),
  tryOnRun: document.querySelector('#tryon-run'),
  tryOnStatus: document.querySelector('#tryon-status'),
  gestureToast: document.querySelector('#gesture-toast'),
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

configureEffectPalette();
const config = await loadConfig();
config.memory = await loadMemory();
const savedVoice = localStorage.getItem('mirror.voice') || config.geminiVoice;
const savedPace = localStorage.getItem('mirror.pace') || 'brisk';
const visionEnabled = localStorage.getItem('mirror.vision') !== 'false';
// Legacy mirror.wake=false was also written by STOP. Only the explicit
// wake setting persists across launches; STOP mutes this session.
const wakeEnabled = localStorage.getItem('mirror.wake.enabled') !== 'false';
const gesturesEnabled = localStorage.getItem('mirror.gestures') !== 'false';
const facePuppetEnabled = localStorage.getItem('mirror.face-puppet') === 'true';
const savedPersona = localStorage.getItem('mirror.persona') || 'velora';
const savedGlassProfile = localStorage.getItem('mirror.glass-profile') || 'glass';
const savedCameraMount = localStorage.getItem('mirror.camera-mount') || 'top';
// Start with parallax on for existing installations too; the former default
// stored `false`, which made the 3D control appear enabled in code but flat.
let depthEnabled = localStorage.getItem('mirror.depth-cube-v2') !== 'false';
config.geminiVoice = savedVoice;
elements.citySelect.value = config.city;
elements.cameraMount.value = savedCameraMount;
setTrackingOptions({ mount: savedCameraMount });
elements.glassProfile.value = savedGlassProfile;
elements.shell.dataset.glassProfile = savedGlassProfile;
elements.voiceSelect.value = savedVoice;
elements.paceSelect.value = savedPace;
elements.visionToggle.checked = visionEnabled;
elements.wakeToggle.checked = wakeEnabled;
elements.gestureToggle.checked = gesturesEnabled;
elements.facePuppetToggle.checked = facePuppetEnabled;
elements.visionNotice.textContent = visionEnabled
  ? 'Face tracking is local · vision sharing is active only while listening'
  : 'Camera frames stay on this device';
updateMemoryStatus(config.memory);
elements.apiBadge.textContent = config.hasGeminiKey ? 'GEMINI READY' : 'DEMO MODE';
elements.configNote.innerHTML = config.hasGeminiKey
  ? 'Live voice is configured. Camera sharing is controllable above. The local “mirror mirror” wake word uses Vosk and needs no API key.'
  : 'The mirror works offline. Add <b>GEMINI_API_KEY</b> to <b>.env</b> to unlock live conversation.';

const renderer = new THREE.WebGLRenderer({ canvas: elements.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
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
const arOverlay = new AROverlay(elements.arCanvas);
const bodyTryOn = new BodyTryOn(elements.video);
const handCtx = elements.handOverlay.getContext('2d');
let handHoverTarget = null;
const pinchSelections = new Set();
const handPointers = new Map();
const trackingDebug = new TrackingDebugOverlay(elements.shell, elements.video);
resizeHandOverlay();
const gestures = new GestureNavigation(elements.video, handleGesture);
const dashboard = new MagicMirrorView(elements.dashboard, { city: config.city, units: config.units });
const closet = new ClosetStore({
  container: elements.closetList,
  importButton: elements.closetImport,
  onSelect: (item) => {
    localStorage.setItem('mirror.closet.selected-name', item.name);
    bodyTryOn.wear(item);
    if (typeof mode !== 'undefined') setAssistantMode('ar');
    elements.tryOnStatus.textContent = `${item.name} selected. Show your shoulders and hips for a live preview.`;
    showGesture(`${item.name} selected`);
  },
  onNotice: (message) => showGesture(message)
});
const avatar = new AvatarController({
  scene,
  camera,
  host: elements.avatarHost,
  onStatus: (message) => { elements.loaderText.textContent = message.toUpperCase(); }
});

let mode = 'mirror';
let requestedMode = 'mirror';
const mediaPanel = new MediaPanelController({
  bridge: window.mirrorBridge, getBounds: mediaBounds,
  onVisibility: active => {
    elements.watchPanel.classList.toggle('active', active || mode === 'watch');
    elements.shell.dataset.mediaOpen = String(active);
    if (!active) setBrowserLayout({ fullscreen: false });
    localStorage.setItem('mirror.browser.open', String(active));
  }
});
const mediaResizeObserver = new ResizeObserver(() => mediaPanel.resize());
mediaResizeObserver.observe(document.querySelector('.watch-display'));
document.querySelector('#watch-close').addEventListener('click', () => {
  mediaPanel.close();
  elements.watchVideo.pause();
  elements.watchFrame.removeAttribute('src');
  if (mode === 'watch') setAssistantMode('mirror');
});
let state = 'starting';
let assistantTranscript = '';
let idleTimer = null;
let diagnosticsTimer = 0;
let liveCaptionTimer = null;
let gestureToastTimer = null;
const faceNavigation = new FaceNavigation();
let activeMediaService = '';
let mediaContentUrl = '';
const faceNavigationToggle = document.querySelector('#face-navigation-toggle');
faceNavigationToggle.checked = localStorage.getItem('mirror.face-navigation') !== 'false';
faceNavigationToggle.addEventListener('change', () => { localStorage.setItem('mirror.face-navigation', String(faceNavigationToggle.checked)); faceNavigation.reset(); });
const captionMeasure = document.createElement('canvas').getContext('2d');
const captions = new StreamingCaption({
  render: text => {
    elements.liveCaption.textContent = text;
    if (text) { elements.oracleText.textContent = ''; elements.oracleCard.classList.remove('empty'); }
    elements.liveCaption.classList.toggle('visible', Boolean(text));
    clearTimeout(liveCaptionTimer);
    if (text) liveCaptionTimer = setTimeout(() => captions.clear(), 6500);
  },
  fit: text => {
    const style = getComputedStyle(elements.liveCaption);
    captionMeasure.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return lastTwoLines(text, elements.liveCaption.clientWidth || 360, value => captionMeasure.measureText(value).width + value.length * (parseFloat(style.letterSpacing) || 0));
  }
});
let browserRecognition = null;
let userTranscriptBuffer = '';
let lastUserTranscriptAt = 0;
let lastVoiceAction = '';
let lastVoiceActionAt = 0;

const speech = new SpeechEngine(avatar, { onState: setState });
const avatarStyleSelect = document.querySelector('#avatar-style');
avatarStyleSelect.value = avatar.visualStyle;
avatarStyleSelect.addEventListener('change', () => avatar.setVisualStyle(avatarStyleSelect.value));
const gemini = new GeminiLiveAdapter({
  avatar,
  config,
  onState: setState,
  onTranscript: handleTranscript,
  onError: (message) => { window.mirrorBridge?.cancelCodex?.(); showOracle(message, '', 'Connection notice'); },
  onRemember: async (fact) => {
    const memory = await window.mirrorBridge.rememberFact(fact);
    updateMemoryStatus(memory);
    return memory;
  },
  onTurnComplete: () => {
    userTranscriptBuffer = '';
    lastVoiceAction = '';
    returnToRequestedMode();
    if (!gemini.listening && elements.wakeToggle.checked) { wake.setCommandsOnly(false); wake.resume(); }
  },
  onModeChange: async (nextMode) => dispatchAction({ type: 'mode', mode: nextMode }),
  onArEffect: async (effect) => dispatchAction({ type: 'effect', effect }),
  onMedia: async (action) => dispatchAction({ ...action, type: 'media' }),
  onCodexTask: async ({ task }) => window.mirrorBridge.codexTask(task),
  onBrowserAction: runBrowserAction,
  onGarment: async action => dispatchAction({ ...action, type: 'garment' }),
  onBrowserLayout: async action => setBrowserLayout(action)
});
gemini.setVideoSource(elements.video);
gemini.setPersona(savedPersona);
gemini.setVisionEnabled(visionEnabled);
gemini.setSpeakingPace(savedPace);

const wake = new WakeWordListener({
  phrase: 'mirror mirror',
  onWake: handleWakeWord,
  onCommand: handleLocalCommand,
  onCaption: (text) => setLiveCaption(text, 3600),
  onStatus: updateWakeStatus
});

let cameraBeforeSleep = true;
const sleep = new SleepController({
  wakeListener: wake,
  onSleep: enterMirrorSleep,
  onWake: async () => {
    delete elements.shell.dataset.sleeping;
    if (cameraBeforeSleep) await toggleCamera(true);
    if (sleep.sleeping) return;
    syncGestures();
    setMode('mirror');
    setState('ready');
    await populateCameras();
  },
  onError: () => { elements.sleepHint.textContent = 'Wake microphone unavailable. Check microphone access.'; }
});

async function enterMirrorSleep() {
  window.mirrorBridge?.cancelCodex?.();
  wake.setCommandsOnly(false);
  mediaPanel.close();
  trackingDebug.clear();
  bodyTryOn.resetTracking();
  cameraBeforeSleep = getTrackingStatus().cameraActive;
  elements.shell.dataset.sleeping = 'true';
  elements.sleepHint.textContent = 'Say “mirror mirror” to wake';
  gemini.disconnect();
  speech.stop();
  const recognition = browserRecognition;
  browserRecognition = null;
  recognition?.abort();
  gestures.setEnabled(false);
  cancelEffectDrag();
  clearHandPointer();
  elements.watchVideo.pause();
  elements.watchFrame.src = '';
  avatar.setVisible(false);
  clearTimeout(idleTimer);
  captions.clear();
  clearTimeout(liveCaptionTimer);
  elements.liveCaption.classList.remove('visible');
  elements.settings.classList.remove('open');
  elements.personaPanel.classList.remove('open');
  elements.launcherPanel.classList.remove('open');
  await toggleCamera(false);
}

const dispatchAction = createMirrorActionDispatcher({
  setMode: setAssistantMode, setEffect: setArEffect, openMedia: openMirrorMedia, setGarment: applyGarmentAction, setBrowserLayout: setBrowserLayout, stepMedia: stepMedia,
  getState: () => ({ mode, effect: arOverlay.effect, faceDetected: getTrackingStatus().faceDetected })
});

await initialize();

async function initialize() {
  setState('starting');
  // Begin downloading/initializing speech immediately, independent of avatar load.
  wake.prepare();
  if (elements.wakeToggle.checked) wake.start();
  initHeadTracking(elements.video)
    .then(async () => { if (sleep.sleeping) await toggleCamera(false); await populateCameras(); })
    .catch((error) => console.warn('[startup] tracking', error));
  gestures.init().then((available) => {
    gestures.setEnabled(available && !sleep.sleeping);
    gestures.setControlsEnabled(elements.gestureToggle.checked);
    if (available && elements.gestureToggle.checked) handleGesture('ready');
    if (!available) elements.gestureToggle.checked = false;
  });
  try { await avatar.init('assets/avatar.glb'); }
  catch (error) { console.warn('[startup] avatar', error); }
  depthScene.setAvatarCanvas(avatar.faceHost?.canvas);
  avatar.setDepthEnabled(depthEnabled);
  await closet.load();
  setMode('mirror');
  setPersona(savedPersona, false);
  avatar.setFacePuppetEnabled(facePuppetEnabled);
  elements.loader.classList.add('done');
  setState('ready');
  elements.oracleCard.classList.add('empty');
  if (localStorage.getItem('mirror.browser.open') === 'true') dispatchAction({ type: 'media', service: localStorage.getItem('mirror.browser.service') || 'spotify' });
}

window.__mirrorDebug = { scene, camera, avatar, depthScene, renderQuality, getTrackingStatus, getFaceLandmarks, gestures, sleep, wake, gemini, handleGesture, setMode, hardStopVoice, dispatchAction, handleTranscript, handleLocalCommand, trackingDebug, mediaPanel, bodyTryOn };

function setDepthMode(enabled, announce = true) {
  depthEnabled = Boolean(enabled);
  localStorage.setItem('mirror.depth-cube-v2', String(depthEnabled));
  elements.shell.dataset.depth = depthEnabled ? 'cube' : 'flat';
  elements.dimensionSwitch?.querySelectorAll('button').forEach((button) => button.classList.toggle('active', button.dataset.depth === (depthEnabled ? 'cube' : 'flat')));
  depthScene.setDepthEnabled(depthEnabled);
  avatar.setDepthEnabled(depthEnabled);
  if (announce) showGesture(depthEnabled ? 'Depth Cube · head tracking active' : '2D surface · stable front view');
}
setDepthMode(depthEnabled, false);

function setMode(nextMode) {
  if (sleep.sleeping) return;
  if (!['portal', 'mirror', 'ar', 'watch'].includes(nextMode)) return;
  if (nextMode !== mode) cancelEffectDrag();
  mode = nextMode;
  syncGestures();
  elements.shell.dataset.mode = nextMode;
  document.querySelectorAll('.mode-btn').forEach((button) => button.classList.toggle('active', button.dataset.mode === nextMode));
  elements.studioPanel.classList.toggle('active', nextMode === 'ar');
  elements.watchPanel.classList.toggle('active', nextMode === 'watch' || mediaPanel.active);
  depthScene.setMode(nextMode);
  avatar.setVisible(nextMode === 'portal' || nextMode === 'ar');
  avatar.setDisplayMode(nextMode);
  if (nextMode === 'mirror' && !elements.liveCaption.classList.contains('visible')) elements.oracleCard.classList.add('empty');
  resetIdle();
}

function setAssistantMode(nextMode) {
  if (sleep.sleeping) return;
  if (!['mirror', 'portal', 'ar', 'watch'].includes(nextMode)) return;
  requestedMode = nextMode;
  setMode(nextMode);
  if (nextMode === 'mirror' && !elements.liveCaption.classList.contains('visible')) elements.oracleCard.classList.add('empty');
}

function showAssistant() {
  setMode(assistantDisplayMode(requestedMode, mediaPanel.active));
}

function returnToRequestedMode() {
  setTimeout(() => {
    if (!gemini.listening && state !== 'speaking' && state !== 'thinking') setMode(requestedMode);
  }, 850);
}

function setArEffect(effect, { openStudio = false } = {}) {
  if (sleep.sleeping) return;
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
  showOracle(getTrackingStatus().faceDetected ? `${names[selected]} selected.` : `${names[selected]} selected. Face not detected ? look toward the camera to wear it.`, '', 'AR enchantment');
}

function setState(next) {
  if (sleep.sleeping) return;
  state = next;
  avatar.setConversationState(next);
  const labels = {
    starting: 'Awakening', connecting: 'Opening the veil', ready: config.hasGeminiKey ? 'AI ready' : 'Demo ready',
    listening: 'Listening', thinking: 'Consulting', speaking: 'Speaking', offline: 'Demo ready', error: 'Needs attention'
  };
  elements.stateLabel.textContent = labels[next] || next;
  elements.stateDot.className = `state-dot${['starting', 'connecting', 'thinking', 'speaking'].includes(next) ? ' busy' : next === 'error' ? ' error' : ''}`;
  elements.mic.classList.toggle('listening', next === 'listening');
  if (next === 'speaking' || next === 'thinking' || next === 'listening') showAssistant();
  if (next === 'listening' && !assistantTranscript) showOracle('Listening…', '', 'Speak to the mirror');
  if (next === 'ready' && !gemini?.listening) returnToRequestedMode();
}

function showOracle(text, user = '', eyebrow = 'The mirror answers') {
  if (sleep.sleeping) return;
  if (!text) return;
  elements.oracleText.textContent = text;
  elements.oracleUser.textContent = user ? `You asked: “${user}”` : '';
  elements.oracleEyebrow.textContent = eyebrow;
  elements.oracleCard.classList.remove('empty');
}

async function askMirror(text) {
  if (sleep.sleeping) return;
  const prompt = text.trim();
  if (!prompt) return;
  if (runVoiceNavigation(prompt)) return;
  showAssistant();
  showOracle('The answer is taking shape…', prompt, 'Your question enters the glass');
  assistantTranscript = '';
  if (config.hasGeminiKey) {
    try {
      await gemini.askText(prompt);
      return;
    } catch (error) {
      console.warn('[voice] using demo fallback', error);
    }
  }
  const response = speech.respond(prompt);
  showOracle(response, prompt);
  if (elements.wakeToggle.checked) wake.resume();
}

async function handleWakeWord(command) {
  if (sleep.sleeping && !(await sleep.wakeFromPhrase())) return;
  if (command && runVoiceNavigation(command)) { wake.setCommandsOnly(false); if (elements.wakeToggle.checked) wake.resume(); return; }
  wake.setCommandsOnly(true);
  wake.resume();
  showAssistant();
  showOracle(command ? 'I heard you…' : 'I am listening…', command, 'Mirror mirror');
  if (command) await askMirror(command);
  else await toggleVoice();
}

function updateWakeStatus(status) {
  if (sleep.sleeping) elements.sleepHint.textContent = status === 'unavailable' ? 'Wake microphone unavailable. Check microphone access.' : status === 'training' ? 'Preparing local wake listener…' : 'Say “mirror mirror” to wake';
  const labels = {
    armed: 'Say “mirror mirror”', heard: 'Wake word heard', paused: 'Wake word paused',
    training: 'Downloading local speech model…', unavailable: 'Wake word unavailable'
  };
  elements.wakeStatus.textContent = labels[status] || labels.armed;
  elements.wakeStatus.classList.toggle('armed', status === 'armed');
}

function handleTranscript(role, text) {
  if (sleep.sleeping) return;
  if (!text?.trim()) return;
  if (role === 'user') {
    const now = Date.now();
    userTranscriptBuffer = now - lastUserTranscriptAt > 2200 ? text : `${userTranscriptBuffer} ${text}`.slice(-400);
    lastUserTranscriptAt = now;
    const command = parseMirrorCommand(userTranscriptBuffer) || (/^\s*(?:please )?(?:stop|stop talking|be quiet|sleep|go to sleep)[.!?]*\s*$/i.test(text) ? (/sleep/i.test(text) ? 'sleep' : 'stop') : null);
    if (command) { handleLocalCommand(command); return; }
    const action = parseMirrorAction(text) || parseMirrorAction(userTranscriptBuffer);
    if (action) {
      const key = JSON.stringify(action);
      if (key !== lastVoiceAction || now - lastVoiceActionAt > 2500) {
        gemini.suppressCurrentReply();
        const commandGeneration = gemini.connectGeneration;
        Promise.resolve(dispatchAction(action)).then(result => {
          if (sleep.sleeping || commandGeneration !== gemini.connectGeneration) return;
          elements.liveCaption.dataset.speaker = 'assistant';
          captions.push(result?.error || result?.ok === false ? 'Not ready yet.' : 'Sure.', 'assistant', true);
        });
        lastVoiceAction = key; lastVoiceActionAt = now;
      }
      setLiveCaption(userTranscriptBuffer, 6500);
      return;
    }
  }
  if (role === 'assistant') {
    assistantTranscript = `${assistantTranscript} ${text}`.trim();
    elements.oracleText.textContent = '';
    elements.oracleUser.textContent = '';
    elements.oracleEyebrow.textContent = '';
    elements.liveCaption.dataset.speaker = 'assistant';
    elements.oracleCard.classList.remove('empty');
    captions.push(text, 'assistant');
  } else {
    setLiveCaption(userTranscriptBuffer, 6500);
    elements.oracleText.textContent = '';
    elements.oracleUser.textContent = '';
    elements.oracleEyebrow.textContent = '';
    elements.oracleCard.classList.remove('empty');
  }
}

function setLiveCaption(text, duration = 4200) {
  if (sleep.sleeping) return;
  elements.liveCaption.dataset.speaker = 'user';
  captions.push(text, 'user', true);
}

function handleLocalCommand(command) {
  if (command === 'stop') { hardStopVoice(); return; }
  if (command === 'sleep') { sleep.enter(); return; }
  if (command === 'debug-on' || command === 'debug-off') {
    if (sleep.sleeping) return;
    const enabled = command === 'debug-on';
    trackingDebug.setEnabled(enabled);
    syncGestures();
    elements.diagnostics.classList.toggle('open', enabled);
    if (enabled) setDepthMode(true, false);
    showGesture(enabled ? 'Tracking debug on' : 'Tracking debug off');
  }
}

function hardStopVoice() {
  window.mirrorBridge?.cancelCodex?.();
  mediaPanel.close();
  sleep.cancelPendingWake();
  elements.wakeToggle.checked = false;
  wake.pause();
  const recognition = browserRecognition;
  browserRecognition = null;
  recognition?.abort();
  speech.stop();
  gemini.disconnect();
  elements.mic.classList.remove('listening');
  captions.clear();
  clearTimeout(liveCaptionTimer);
  elements.liveCaption.textContent = '';
  elements.liveCaption.classList.remove('visible');
  assistantTranscript = '';
  userTranscriptBuffer = '';
  showOracle('Voice stopped. Press the mic to start again.', '', 'Microphone muted');
}

async function toggleVoice() {
  if (sleep.sleeping) return;
  if (!config.hasGeminiKey) {
    wake.pause();
    startBrowserRecognition();
    return;
  }
  try {
    if (!gemini.listening) { wake.setCommandsOnly(true); wake.resume(); }
    const active = await gemini.toggleMicrophone();
    elements.mic.classList.toggle('listening', active);
    if (!active && elements.wakeToggle.checked) { wake.setCommandsOnly(false); wake.resume(); }
  } catch (error) {
    setState('error');
    showOracle(error.message, '', 'Voice connection');
    if (elements.wakeToggle.checked) wake.resume();
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
  recognition.interimResults = false;
  recognition.onstart = () => setState('listening');
  recognition.onresult = (event) => {
    if (browserRecognition !== recognition) return;
    const transcript = event.results[0][0].transcript;
    setLiveCaption(transcript, 6500);
    askMirror(transcript);
  };
  recognition.onerror = () => setState('ready');
  recognition.onend = () => {
    if (browserRecognition === recognition) browserRecognition = null;
    if (state === 'listening') setState('ready');
    if (elements.wakeToggle.checked) wake.resume();
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
  const handState = gestures.status === 'tracking' ? 'Hand lock' : gestures.enabled ? 'Show your pointing hand' : 'Hands off';
  elements.trackingHealth.textContent = tracking.error || `${tracking.activeCameraLabel} · ${tracking.faceDetected ? 'Face lock' : tracking.cameraActive ? 'Looking for your face' : 'Camera off'} · ${handState}`;
  elements.trackingHealth.classList.toggle('error', Boolean(tracking.error));
  elements.trackingBadge.textContent = tracking.faceDetected ? 'FACE LOCK' : tracking.cameraActive ? 'SEARCHING' : 'MOUSE';
  elements.cameraToggle.textContent = tracking.cameraActive ? 'Camera off' : 'Camera on';
}

elements.mic.addEventListener('click', toggleVoice);
elements.hardStop.addEventListener('click', hardStopVoice);
window.mirrorBridge?.onStopRequested?.(hardStopVoice);
elements.sleepButton.addEventListener('click', () => sleep.enter());
elements.shell.addEventListener('click', (event) => {
  if (sleep.sleeping) { event.preventDefault(); event.stopImmediatePropagation(); }
}, true);
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
elements.cameraSelect.addEventListener('change', async () => { await switchCamera(elements.cameraSelect.value); updateTrackingUi(); });
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
document.querySelectorAll('[data-service]').forEach((button) => button.addEventListener('click', async () => {
  try {
    if (['spotify', 'youtube', 'netflix'].includes(button.dataset.service)) await dispatchAction({ type: 'media', service: button.dataset.service });
    else await window.mirrorBridge?.openService(button.dataset.service);
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
  elements.visionNotice.textContent = elements.visionToggle.checked
    ? 'Face tracking is local · vision sharing is active only while listening'
    : 'Camera frames stay on this device';
});
elements.wakeToggle.addEventListener('change', () => {
  localStorage.setItem('mirror.wake.enabled', String(elements.wakeToggle.checked));
  if (elements.wakeToggle.checked) wake.resume();
  else wake.pause();
});
elements.gestureToggle.addEventListener('change', () => {
  localStorage.setItem('mirror.gestures', String(elements.gestureToggle.checked));
  syncGestures();
  showGesture(elements.gestureToggle.checked ? 'Point with one finger · pinch over a control to select' : 'Hand pointer off');
});
elements.facePuppetToggle.addEventListener('change', () => {
  localStorage.setItem('mirror.face-puppet', String(elements.facePuppetToggle.checked));
  avatar.setFacePuppetEnabled(elements.facePuppetToggle.checked);
  showGesture(elements.facePuppetToggle.checked ? 'Face puppet on · webcam input' : 'Face puppet off · AI animation');
});
elements.tryOnConsent.addEventListener('change', () => {
  elements.tryOnRun.disabled = !elements.tryOnConsent.checked || !closet.selectedId;
  elements.tryOnStatus.textContent = elements.tryOnConsent.checked ? 'Consent confirmed · ready to capture one local frame.' : 'Consent is required before the camera frame is captured.';
});
elements.tryOnRun.addEventListener('click', async () => {
  if (!closet.selectedId || !elements.tryOnConsent.checked) return;
  if (!elements.video.videoWidth || !elements.video.videoHeight) {
    elements.tryOnStatus.textContent = 'Turn on the camera and stand in the frame first.';
    return;
  }
  elements.tryOnRun.disabled = true;
  elements.tryOnStatus.textContent = 'Capturing one local frame…';
  try {
    const canvas = document.createElement('canvas');
    const longestSide = 1024;
    const scale = Math.min(1, longestSide / Math.max(elements.video.videoWidth, elements.video.videoHeight));
    canvas.width = Math.round(elements.video.videoWidth * scale); canvas.height = Math.round(elements.video.videoHeight * scale);
    canvas.getContext('2d').drawImage(elements.video, 0, 0, canvas.width, canvas.height);
    const request = { garmentId: closet.selectedId, frameDataUrl: canvas.toDataURL('image/jpeg', .9) };
    const job = window.mirrorBridge?.queueTryOn
      ? await window.mirrorBridge.queueTryOn(request)
      : { id: `browser-preview-${Date.now()}`, providerConfigured: false, previewOnly: true };
    elements.tryOnStatus.textContent = job?.providerConfigured ? `Look prepared · job ${job.id}` : job?.previewOnly ? 'Browser preview complete. Nothing was saved or uploaded.' : 'Frame saved locally. Add a provider adapter to render the final look.';
    showOracle(job?.providerConfigured ? 'Your try-on job is ready for the configured renderer.' : job?.previewOnly ? 'Browser preview completed with one in-memory frame. Nothing was saved or uploaded.' : 'Your selected garment and one consented frame are saved locally. No provider is configured yet.', '', 'Try-on prepared');
  } catch (error) {
    elements.tryOnStatus.textContent = error.message;
  } finally { elements.tryOnRun.disabled = !elements.tryOnConsent.checked; }
});
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
  await toggleCamera(enable);
  await populateCameras();
});
elements.calibrateDepth.addEventListener('click', () => {
  faceNavigation.reset();
  const ready = calibrateDepth();
  if (ready) setDepthMode(true);
  showOracle(
    ready ? 'Re-centered from your current position. Move left, right, and up or down to test the window effect.' : 'Look toward the mirror from your usual viewing spot. Once Face Lock appears, hold still for two seconds and tap Re-center camera again.',
    '',
    ready ? 'Screen alignment saved' : 'Camera needed'
  );
});
elements.diagnosticsToggle.addEventListener('click', () => handleLocalCommand(trackingDebug.enabled ? 'debug-off' : 'debug-on'));
elements.fullscreenToggle.addEventListener('click', () => window.mirrorBridge?.toggleFullscreen());

function resetIdle() {
  if (sleep.sleeping) return;
  elements.form.classList.remove('dim');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (state === 'ready') elements.form.classList.add('dim');
  }, 6000);
}
window.addEventListener('pointermove', resetIdle);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { hardStopVoice(); return; }
  if (sleep.sleeping) return;
  resetIdle();
  if (event.key === '1') setMode('portal');
  if (event.key === '2') setMode('mirror');
  if (event.key === '3') setMode('ar');
  if (event.key === '4') setMode('watch');
  if (event.key.toLowerCase() === 'f') window.mirrorBridge?.toggleFullscreen();
  if (event.key.toLowerCase() === 'c') elements.cameraToggle.click();
  if (event.key.toLowerCase() === 'd' && !/input|select|textarea/i.test(event.target.tagName)) handleLocalCommand(trackingDebug.enabled ? 'debug-off' : 'debug-on');
});
resetIdle();

const clock = new THREE.Clock();
let statusTick = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  if (sleep.sleeping) return;
  const viewer = updateHeadTracking(performance.now());
  const matrix = getFaceMatrix();
  const step = faceNavigation.update({ viewer, pitch: matrix ? Math.atan2(matrix[6], matrix[10]) : null, faceDetected: getTrackingStatus().faceDetected, active: faceNavigationToggle.checked && mediaPanel.active && (activeMediaService === 'spotify' || mediaContentUrl.includes('/shorts/')) }, performance.now());
  if (step) stepMedia({ action: step });
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
  depthScene.update(dt, elapsed, viewer);
  avatar.setFaceBlendshapes(getFaceBlendshapes());
  avatar.setEyeGaze(getEyeGaze());
  avatar.update(dt, elapsed, viewer);
  arOverlay.render(getFaceLandmarks(), elements.video, elapsed, mode === 'ar');
  trackingDebug.draw({ face: getFaceLandmarks(), hands: gestures.debugHands || gestures.latestHands || [...handPointers.values()].map(d => ({ landmarks: d.hand, screenHand: d.screenHand })), status: getTrackingStatus(), viewer, handStatus: gestures.status, depthEnabled });
  bodyTryOn.update(performance.now(), mode === 'ar');
  if (mode === 'ar') { bodyTryOn.draw(arOverlay.ctx, viewportSize().width, viewportSize().height);
    if (bodyTryOn.items.size) elements.tryOnStatus.textContent = bodyTryOn.status === 'unavailable' ? 'Body tracking is unavailable. Check the camera and local model.' : bodyTryOn.pose ? 'Live garment preview: local 2D overlay' : 'Step back so the camera can see your shoulders and hips.';
  }
  renderer.render(scene, camera);
  updateRenderQuality(dt);
  diagnosticsTimer += dt;
  if (diagnosticsTimer > .25 && elements.diagnostics.classList.contains('open')) {
    diagnosticsTimer = 0;
    updateDiagnostics();
  }
  statusTick += dt;
  if (statusTick > 0.5) { statusTick = 0; updateTrackingUi(); }
}
animate();

function updateDiagnostics() {
  const tracking = getTrackingStatus();
  const blends = getFaceBlendshapes() || {};
  const gaze = getEyeGaze() || {};
  elements.diagRender.textContent = `${Math.round(renderQuality.fps)} fps · ${renderQuality.pixelRatio.toFixed(2)}× DPR`;
  elements.diagTracking.textContent = `${tracking.faceDetected ? 'Face lock' : tracking.cameraActive ? 'Searching' : 'Camera off'} · face ${Math.round(tracking.detectionMs || 0)}ms · hands ${Math.round(gestures.inferenceMs || 0)}ms`;
  const avatarVideo = avatar.getAvatarVideoStatus();
  const hostSource = avatarVideo.active
    ? `video · ${avatarVideo.state}${avatarVideo.width ? ` · ${avatarVideo.width}×${avatarVideo.height}` : ''}`
    : `${avatar.persona || 'velora'} · ${avatar.faceHost ? 'rig' : 'loading'}`;
  elements.diagRig.textContent = hostSource;
  elements.diagBlendshapes.textContent = `${Object.keys(blends).length} channels`;
  elements.diagGaze.textContent = gaze.confidence ? `${Math.round(gaze.confidence * 100)}% confidence` : 'No gaze lock';
}

window.addEventListener('resize', () => {
  mediaPanel.resize();
  const viewport = viewportSize();
  camera.aspect = viewport.width / viewport.height;
  camera.updateProjectionMatrix();
  renderQuality.maxPixelRatio = preferredPixelRatio();
  renderQuality.pixelRatio = Math.min(renderQuality.pixelRatio, renderQuality.maxPixelRatio);
  renderer.setPixelRatio(renderQuality.pixelRatio);
  renderer.setSize(viewport.width, viewport.height);
  arOverlay.resize();
  resizeHandOverlay();
});

window.addEventListener('beforeunload', () => { window.mirrorBridge?.cancelCodex?.(); window.mirrorBridge?.hideMirrorMedia?.(); bodyTryOn.dispose(); mediaResizeObserver.disconnect(); wake.destroy(); gemini.disconnect(); });

function syncGestures() {
  gestures.setEnabled(!sleep.sleeping && Boolean(gestures.landmarker));
  gestures.setControlsEnabled(elements.gestureToggle.checked);
  if (!elements.gestureToggle.checked) clearHandPointer();
}

function applyGarmentAction(action) {
  const removing = action.remove || action.action === 'remove';
  const query = action.garment || action.name || '';
  const item = findGarment(closet.items, query);
  if (!item && !(removing && query === 'all')) return { handled: true, error: 'Garment not found', available: closet.items.map(item => ({ name: item.name, id: item.id })) };
  const result = removing ? bodyTryOn.remove(item) : bodyTryOn.wear(item);
  if (!removing) { closet.selectedId = item.id; closet.render(); }
  elements.tryOnStatus.textContent = removing ? 'Garment removed.' : `${item.name} selected. Show your shoulders and hips.`;
  showGesture(removing ? 'Garment removed' : `${item.name} selected`);
  return { handled: true, ...result };
}

function setBrowserLayout(action) {
  const fullscreen = Boolean(action.fullscreen);
  elements.watchPanel.dataset.fullscreen = String(fullscreen);
  elements.shell.dataset.browserFullscreen = String(fullscreen);
  document.querySelector('#browser-expand').textContent = fullscreen ? 'Minimize' : 'Fullscreen';
  document.querySelector('#browser-expand').setAttribute('aria-pressed', String(fullscreen));
  mediaPanel.resize();
  return { handled: true, fullscreen };
}

async function runBrowserAction(action) {
  const result = await window.mirrorBridge.browserAction(action);
  if (result?.page?.url && result.page.url.startsWith('https://')) { mediaContentUrl = result.page.url; elements.watchUrl.value = mediaContentUrl; }
  return result;
}

async function stepMedia(input) {
  const result = await window.mirrorBridge.controlMirrorMedia({ action: input.action });
  showGesture(result?.executed ? (input.action === 'next' ? 'Next' : 'Previous') : result?.message || 'Open Spotify or a Short first');
  return { handled: true, ...result };
}

async function browserToolbar(action) {
  if (!mediaPanel.active) return;
  const result = await runBrowserAction({ action });
  if (result?.page?.url) elements.watchUrl.value = result.page.url;
  if (result?.error) showGesture(result.error);
}
document.querySelector('#browser-back').addEventListener('click', () => browserToolbar('back'));
document.querySelector('#browser-forward').addEventListener('click', () => browserToolbar('forward'));
document.querySelector('#browser-reload').addEventListener('click', () => browserToolbar('reload'));
document.querySelector('#browser-expand').addEventListener('click', () => setBrowserLayout({ fullscreen: elements.watchPanel.dataset.fullscreen !== 'true' }));
document.querySelector('#wardrobe-clear').addEventListener('click', () => applyGarmentAction({ remove: true, garment: 'all' }));

function mediaBounds() {
  const bounds = document.querySelector('.watch-display').getBoundingClientRect();
  return { x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.max(1, Math.round(bounds.width)), height: Math.max(1, Math.round(bounds.height)) };
}

async function openMirrorMedia(action) {
  try {
    activeMediaService = action.service;
    faceNavigation.reset();
    localStorage.setItem('mirror.browser.service', action.service);
    elements.watchVideo.pause();
    elements.watchFrame.removeAttribute('src');
    if (action.fullscreen != null) setBrowserLayout(action);
    const result = await mediaPanel.open(action);
    if (result?.url) { elements.watchUrl.value = result.url; mediaContentUrl = result.url; }
    if (result.cancelled || sleep.sleeping) return { handled: true, cancelled: true };
    showGesture(result?.message || 'Media opened on the mirror');
    return { handled: true, ...result };
  } catch (error) {
    showOracle(error.message, '', 'Media playback');
    return { handled: true, error: error.message };
  }
}

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

function loadWatchVideo() {
  const value = elements.watchUrl.value.trim();
  if (!value) return;
  try {
    let parsed;
    try { parsed = new URL(value.includes('://') ? value : `https://${value}`); if (!parsed.hostname.includes('.')) throw new Error('search'); }
    catch { parsed = new URL(`https://www.google.com/search?q=${encodeURIComponent(value)}`); }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Use a web address.');
    if (/\.(mp4|webm)(?:$|\?)/i.test(parsed.href)) {
      mediaPanel.close();elements.watchFrame.removeAttribute('src');elements.watchVideo.src=parsed.href;elements.watchVideo.classList.add('loaded');elements.watchPlaceholder.style.display='none';elements.watchVideo.play().catch(()=>{});return;
    }
    if (parsed.protocol !== 'https:') throw new Error('Browser pages require HTTPS.');
    const host=parsed.hostname.replace(/^www\./,'');
    const service=host==='open.spotify.com'?'spotify':/^(youtube\.com|youtu\.be)$/.test(host)?'youtube':host==='netflix.com'?'netflix':'browser';
    dispatchAction({ type:'media',service,url:parsed.href });
  } catch(error) { showGesture(error.message); }
}

function youtubeId(url) {
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';
  if (host.endsWith('youtube.com')) return url.searchParams.get('v') || (url.pathname.startsWith('/shorts/') ? url.pathname.split('/')[2] : '');
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
  if (/^\s*(?:please )?(?:stop|stop talking|be quiet|mute)[.!?]*\s*$/i.test(prompt)) { hardStopVoice(); return true; }
  const command = parseMirrorCommand(prompt);
  if (command) { handleLocalCommand(command); return true; }
  const action = parseMirrorAction(prompt);
  if (action) { dispatchAction(action); return true; }
  if (/^(?:go to sleep|sleep|sleep mode|mirror sleep)[.!?]*$/i.test(prompt.trim())) { sleep.enter(); return true; }
  const text = prompt.toLowerCase().replace(/[.,!?]/g, ' ');
  const serviceMatch = text.match(/\b(?:open|show)\s+(?:my\s+)?(calendar|photos|maps|map|spotify|music|youtube)\b/);
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
  const modeMatch = text.match(/\b(?:show|open|go to|switch to|take me to)\s+(?:the\s+)?(ambient|home|mirror|converse|conversation|assistant|try\s*on|studio|watch|video|youtube)\b/);
  if (modeMatch) {
    const word = modeMatch[1].replace(/\s+/g, ' ');
    const next = /ambient|home|mirror/.test(word) ? 'mirror' : /converse|conversation|assistant/.test(word) ? 'portal' : /try|studio/.test(word) ? 'ar' : 'watch';
    setAssistantMode(next);
    showOracle(`${{ mirror: 'Ambient', portal: 'Converse', ar: 'Try on', watch: 'Watch' }[next]} mode is open.`, '', 'Voice navigation');
    return true;
  }
  const effect = text.match(/\b(?:try on|wear|apply|show me)\s+(?:an?\s+)?(enchanted|crown|glasses|mask|halo|aura|runes)\b/);
  if (effect) {
    const map = { enchanted: 'enchanted', crown: 'crown', glasses: 'glasses', mask: 'mask', halo: 'halo', aura: 'aura', runes: 'runes' };
    setArEffect(map[effect[1]]);
    return true;
  }
  return false;
}

function handleGesture(type, detail) {
  if (sleep.sleeping) return;
  if (type === 'clap') { elements.gestureToggle.checked = !elements.gestureToggle.checked; elements.gestureToggle.dispatchEvent(new Event('change')); return; }
  if (!elements.gestureToggle.checked) return;
  const handId = detail?.handId ?? 'default';
  if (type === 'pointer-down') {
    const chip = handControlAt(detail)?.closest('[data-effect], [data-closet-id]');
    if (mode === 'ar' && chip) {
      pinchSelections.add(handId);
      chip.click();
      showGesture(getTrackingStatus().faceDetected ? 'Filter selected' : 'Filter selected ? look toward the camera');
      return true;
    }
    return;
  }
  if (type === 'pointer-up') return pinchSelections.delete(handId);
  if (type === 'pointer-cancel') { cancelEffectDrag(handId); handPointers.delete(handId); redrawHands(); return; }
  if (type === 'pointer-move') {
    if (mediaPanel.active && detail.indexUp) {
      const bounds = elements.shell.getBoundingClientRect();
      window.mirrorBridge?.mirrorMediaPointer?.({ x: bounds.left + detail.cursor.x * bounds.width, y: bounds.top + detail.cursor.y * bounds.height, pinch: detail.pinchDown });
    }
    handPointers.set(handId, detail);
    redrawHands();
    return;
  }
  if (type === 'pointer-lost') {
    window.mirrorBridge?.mirrorMediaPointer?.({ clear: true });
    cancelEffectDrag(detail?.handId);
    if (detail?.handId != null) handPointers.delete(handId); else handPointers.clear();
    redrawHands();
    return;
  }
  if (type === 'pointer-click') {
    const shell = elements.shell.getBoundingClientRect();
    const x = shell.left + detail.x * shell.width;
    const y = shell.top + detail.y * shell.height;
    if (mediaPanel.active) {
      window.mirrorBridge.mirrorMediaPointer({ x, y, click: true }).then(result => { if (!result.hit && !sleep.sleeping && elements.gestureToggle.checked) clickMirrorControl(x, y); });
      return;
    }
    clickMirrorControl(x, y);
    return;
  }
  if (type === 'ready') showGesture('Right hand: point and pinch. Clap to toggle controls.');
}

function clickMirrorControl(x, y) {
    const target = document.elementFromPoint(x, y)?.closest('button, a, [role="button"], input[type="button"], input[type="checkbox"], select, summary, label[for]');
    if (target && !target.disabled && elements.shell.contains(target)) {
      target.click();
      showGesture(`Selected · ${target.getAttribute('aria-label') || target.textContent.trim().replace(/\s+/g, ' ').slice(0, 32) || 'control'}`);
    } else showGesture('Move fingertip over a control, then pinch');
}

function configureEffectPalette() {
  const paths = {
    glasses: '<rect x="4" y="15" width="16" height="13" rx="5"/><rect x="28" y="15" width="16" height="13" rx="5"/><path d="M20 19q4-4 8 0M4 18l-3-3m43 3 3-3"/>',
    mask: '<path d="M3 13q21 10 42 0l-4 20q-8 6-17-3-9 9-17 3z"/><path d="M10 21q5-4 9 0-4 5-9 0zm19 0q5-4 9 0-4 5-9 0z"/>',
    crown: '<path d="M6 34 3 13l12 9 9-16 9 16 12-9-3 21zM6 39h36"/>',
    halo: '<ellipse cx="24" cy="15" rx="20" ry="7"/><path d="M13 32q11-12 22 0"/>',
    aura: '<circle cx="24" cy="24" r="9"/><circle cx="24" cy="24" r="19" stroke-dasharray="3 6"/>',
    runes: '<path d="m24 4 16 20-16 20L8 24zM24 4v40M8 24h32"/>',
    scan: '<path d="M4 16V4h12m16 0h12v12M4 32v12h12m16 0h12V32M5 24h38"/>',
    none: '<circle cx="24" cy="24" r="19"/><path d="m10 10 28 28"/>',
    enchanted: '<path d="m24 3 5 15 15 6-15 5-5 16-6-16-15-5 15-6z"/>'
  };
  const names = {glasses:'Glasses',mask:'Mask',crown:'Crown',halo:'Halo',aura:'Aura',runes:'Runes',scan:'Scan',none:'Remove',enchanted:'Glow'};
  elements.effectGrid.querySelectorAll('[data-effect]').forEach((chip) => {
    const effect = chip.dataset.effect;
    chip.innerHTML = `<svg viewBox="0 0 48 48" aria-hidden="true">${paths[effect] || paths.enchanted}</svg><span>${names[effect] || effect}</span>`;
    chip.setAttribute('aria-label', `Try ${names[effect] || effect}`);
  });
  const intro = elements.studioPanel.querySelector('.mode-intro');
  intro.querySelector('h1').textContent = 'Choose a look.';
  intro.querySelector('p').textContent = 'Point with your right hand. Pinch an effect to wear it.';
  elements.studioPanel.querySelector('.tray-head span').textContent = 'Pinch · drag · release';
  const shelf = elements.studioPanel.querySelector('.closet-shelf');
  const details = document.createElement('details');
  details.className = 'wardrobe-details';
  details.open = true;
  const summary = document.createElement('summary');
  summary.textContent = 'Wardrobe';
  shelf.before(details);
  details.append(summary, shelf);
}

function handControlAt(point) {
  const bounds = elements.shell.getBoundingClientRect();
  const browserBounds = document.querySelector('.watch-display').getBoundingClientRect();
  const px = bounds.left + point.x * bounds.width, py = bounds.top + point.y * bounds.height;
  if (mediaPanel.active && px >= browserBounds.left && px < browserBounds.right && py >= browserBounds.top && py < browserBounds.bottom) return null;
  const target = document.elementFromPoint(bounds.left + point.x * bounds.width, bounds.top + point.y * bounds.height)?.closest('button, a, [role="button"], input, select, summary, label[for]');
  return target && elements.shell.contains(target) && !target.disabled ? target : null;
}

function cancelEffectDrag(handId) {
  if (handId == null) pinchSelections.clear();
  else pinchSelections.delete(handId);
  elements.dragLabel.classList.remove('visible');
}

function resizeHandOverlay() {
  const { width, height } = viewportSize();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  elements.handOverlay.width = Math.round(width * dpr);
  elements.handOverlay.height = Math.round(height * dpr);
  handCtx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function clearHandPointer() {
  handPointers.clear();
  window.mirrorBridge?.mirrorMediaPointer?.({ clear: true });
  if (!handCtx) return;
  const { width, height } = viewportSize();
  handCtx.clearRect(0, 0, width, height);
  elements.handOverlay.dataset.state = '';
  handHoverTarget?.classList.remove('hand-hover');
  handHoverTarget = null;
}

function redrawHands() {
  const { width, height } = viewportSize();
  handCtx?.clearRect(0, 0, width, height);
  for (const detail of handPointers.values()) drawHandPointer(detail);
}

function drawHandPointer(detail) {
  if (!handCtx || !detail) return;
  const { width, height } = viewportSize();
  const hand = detail.screenHand || detail.hand;
  const point = (landmark) => ({ x: (detail.screenHand ? landmark.x : 1 - landmark.x) * width, y: landmark.y * height });
  elements.handOverlay.dataset.state = detail.pinchDown ? 'pinch' : 'point';

  if (detail.indexUp && hand) {
    const bones = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17],[5,17]];
    handCtx.lineWidth = Math.max(2, width * .002);
    handCtx.lineCap = 'round';
    handCtx.strokeStyle = 'rgba(181,255,212,.72)';
    for (const [a, b] of bones) {
      handCtx.beginPath(); handCtx.moveTo(...Object.values(point(hand[a]))); handCtx.lineTo(...Object.values(point(hand[b]))); handCtx.stroke();
    }
    for (const id of [4, 8]) {
      const tip = point(hand[id]);
      handCtx.beginPath(); handCtx.arc(tip.x, tip.y, id === 8 ? Math.max(12, width * .013) : Math.max(5, width * .005), 0, Math.PI * 2);
      handCtx.fillStyle = detail.pinchDown ? '#fff1a8' : id === 8 ? '#c5ffe0' : 'rgba(255,241,168,.75)';
      handCtx.fill();
      handCtx.strokeStyle = 'rgba(4,12,10,.8)'; handCtx.lineWidth = 2; handCtx.stroke();
    }
  }

  if (detail.indexUp) {
    handCtx.beginPath();
    handCtx.arc(detail.cursor.x * width, detail.cursor.y * height, Math.max(14, width * .016), 0, Math.PI * 2);
    handCtx.strokeStyle = detail.pinchDown ? '#fff1a8' : '#c5ffe0';
    handCtx.lineWidth = 3;
    handCtx.stroke();
  }

  const shell = elements.shell.getBoundingClientRect();
  const screenX = shell.left + detail.cursor.x * shell.width;
  const screenY = shell.top + detail.cursor.y * shell.height;
  const target = detail.indexUp ? document.elementFromPoint(screenX, screenY)?.closest('button, a, [role="button"], input[type="button"], input[type="checkbox"], select, summary, label[for]') : null;
  if (target !== handHoverTarget) {
    handHoverTarget?.classList.remove('hand-hover');
    handHoverTarget = target && elements.shell.contains(target) && !target.disabled ? target : null;
    handHoverTarget?.classList.add('hand-hover');
  }
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
  if (renderQuality.fps < 42 && renderQuality.pixelRatio > .8) renderQuality.pixelRatio = Math.max(.8, renderQuality.pixelRatio - .1);
  else if (renderQuality.fps > 57 && renderQuality.pixelRatio < renderQuality.maxPixelRatio) renderQuality.pixelRatio = Math.min(renderQuality.maxPixelRatio, renderQuality.pixelRatio + .05);
  if (renderQuality.pixelRatio !== previous) {
    renderer.setPixelRatio(renderQuality.pixelRatio);
    // Never let the adaptive DPR pass resize the canvas to the surrounding
    // desktop browser. The render surface is the portrait mirror shell.
    const viewport = viewportSize();
    renderer.setSize(viewport.width, viewport.height);
  }
  renderQuality.frames = 0;
  renderQuality.elapsed = 0;
}

window.mirrorBridge?.onCodexTool?.(async ({ id, tool, args }) => {
  let result;
  try {
    if (sleep.sleeping || !gemini.connected) throw new Error('Voice task cancelled');
    if (tool === 'browser_action') result = await runBrowserAction(args);
    else if (tool === 'open_mirror_media') result = await dispatchAction({ ...args, type: 'media' });
    else if (tool === 'set_browser_layout') result = setBrowserLayout(args);
    else if (tool === 'set_garment') result = await dispatchAction({ ...args, type: 'garment' });
    else throw new Error('Unknown mirror tool');
  } catch (error) { result = { error: error.message }; }
  await window.mirrorBridge.codexToolResult({ id, result });
});
