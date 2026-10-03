import * as THREE from 'three';
import { AvatarController } from './avatarController.js';
import { ClosetStore } from './closetStore.js';
import { AROverlay } from './arOverlay.js';
import { createDepthScene } from './depthScene.js';
import { GeminiLiveAdapter } from './geminiLiveAdapter.js';
import { GestureNavigation } from './gestureNavigation.js';
import { MagicMirrorView } from './magicMirrorView.js';
import { SpeechEngine } from './speechEngine.js';
import { WakeWordListener } from './wakeWord.js';
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
  canvas: document.querySelector('#scene-canvas'),
  video: document.querySelector('#camera-feed'),
  arCanvas: document.querySelector('#ar-canvas'),
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
  settingsToggle: document.querySelector('#settings-toggle'),
  settings: document.querySelector('#settings-panel'),
  cameraSelect: document.querySelector('#camera-select'),
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
let depthEnabled = localStorage.getItem('mirror.depth-cube') === 'true';
config.geminiVoice = savedVoice;
elements.citySelect.value = config.city;
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
const gestures = new GestureNavigation(elements.video, handleGesture);
const dashboard = new MagicMirrorView(elements.dashboard, { city: config.city, units: config.units });
const closet = new ClosetStore({
  container: elements.closetList,
  importButton: elements.closetImport,
  onSelect: (item) => {
    localStorage.setItem('mirror.closet.selected-name', item.name);
    elements.tryOnRun.disabled = !elements.tryOnConsent.checked;
    elements.tryOnStatus.textContent = `${item.name} selected · consent to prepare a frame.`;
    showOracle(`${item.name} is selected. When the virtual try-on renderer is connected, this is the garment it will receive.`, '', 'Closet ready');
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
let state = 'starting';
let assistantTranscript = '';
let idleTimer = null;
let diagnosticsTimer = 0;

const speech = new SpeechEngine(avatar, { onState: setState });
const gemini = new GeminiLiveAdapter({
  avatar,
  config,
  onState: setState,
  onTranscript: handleTranscript,
  onError: (message) => showOracle(message, '', 'Connection notice'),
  onRemember: async (fact) => {
    const memory = await window.mirrorBridge.rememberFact(fact);
    updateMemoryStatus(memory);
    return memory;
  },
  onTurnComplete: () => {
    returnToRequestedMode();
    if (!gemini.listening && elements.wakeToggle.checked) wake.resume();
  },
  onModeChange: async (nextMode) => setAssistantMode(nextMode),
  onArEffect: async (effect) => setArEffect(effect)
});
gemini.setVideoSource(elements.video);
gemini.setPersona(savedPersona);
gemini.setVisionEnabled(visionEnabled);
gemini.setSpeakingPace(savedPace);

const wake = new WakeWordListener({
  phrase: 'mirror mirror',
  onWake: handleWakeWord,
  onStatus: updateWakeStatus
});

await initialize();

async function initialize() {
  setState('starting');
  initHeadTracking(elements.video)
    .then(populateCameras)
    .catch((error) => console.warn('[startup] tracking', error));
  gestures.init().then((available) => {
    gestures.setEnabled(available && elements.gestureToggle.checked);
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
  if (elements.wakeToggle.checked) wake.start();
}

window.__mirrorDebug = { scene, camera, avatar, depthScene, renderQuality };

function setDepthMode(enabled, announce = true) {
  depthEnabled = Boolean(enabled);
  localStorage.setItem('mirror.depth-cube', String(depthEnabled));
  elements.shell.dataset.depth = depthEnabled ? 'cube' : 'flat';
  elements.dimensionSwitch?.querySelectorAll('button').forEach((button) => button.classList.toggle('active', button.dataset.depth === (depthEnabled ? 'cube' : 'flat')));
  depthScene.setDepthEnabled(depthEnabled);
  avatar.setDepthEnabled(depthEnabled);
  if (announce) showGesture(depthEnabled ? 'Depth Cube · head tracking active' : '2D surface · stable front view');
}
setDepthMode(depthEnabled, false);

function setMode(nextMode) {
  if (!['portal', 'mirror', 'ar', 'watch'].includes(nextMode)) return;
  mode = nextMode;
  elements.shell.dataset.mode = nextMode;
  document.querySelectorAll('.mode-btn').forEach((button) => button.classList.toggle('active', button.dataset.mode === nextMode));
  elements.studioPanel.classList.toggle('active', nextMode === 'ar');
  elements.watchPanel.classList.toggle('active', nextMode === 'watch');
  depthScene.setMode(nextMode);
  avatar.setVisible(nextMode === 'portal' || nextMode === 'ar');
  avatar.setDisplayMode(nextMode);
  if (nextMode === 'mirror') elements.oracleCard.classList.add('empty');
  resetIdle();
}

function setAssistantMode(nextMode) {
  if (!['mirror', 'portal', 'ar', 'watch'].includes(nextMode)) return;
  requestedMode = nextMode;
  setMode(nextMode);
  if (nextMode === 'mirror') elements.oracleCard.classList.add('empty');
}

function showAssistant() {
  setMode(requestedMode === 'ar' ? 'ar' : 'portal');
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
  if (!text) return;
  elements.oracleText.textContent = text;
  elements.oracleUser.textContent = user ? `You asked: “${user}”` : '';
  elements.oracleEyebrow.textContent = eyebrow;
  elements.oracleCard.classList.remove('empty');
}

async function askMirror(text) {
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
  wake.pause();
  showAssistant();
  showOracle(command ? 'I heard you…' : 'I am listening…', command, 'Mirror mirror');
  if (command) await askMirror(command);
  else await toggleVoice();
}

function updateWakeStatus(status) {
  const labels = {
    armed: 'Say “mirror mirror”', heard: 'Wake word heard', paused: 'Wake word paused',
    training: 'Downloading local speech model…', unavailable: 'Wake word unavailable'
  };
  elements.wakeStatus.textContent = labels[status] || labels.armed;
  elements.wakeStatus.classList.toggle('armed', status === 'armed');
}

function handleTranscript(role, text) {
  if (!text?.trim()) return;
  if (role === 'assistant') {
    assistantTranscript = `${assistantTranscript} ${text}`.trim();
    showOracle(assistantTranscript, '', 'The mirror answers');
  } else {
    showOracle('Listening…', text.trim(), 'You said');
  }
}

async function toggleVoice() {
  if (!config.hasGeminiKey) {
    wake.pause();
    startBrowserRecognition();
    return;
  }
  try {
    if (!gemini.listening) wake.pause();
    const active = await gemini.toggleMicrophone();
    elements.mic.classList.toggle('listening', active);
    if (!active && elements.wakeToggle.checked) wake.resume();
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
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.onstart = () => setState('listening');
  recognition.onresult = (event) => askMirror(event.results[0][0].transcript);
  recognition.onerror = () => setState('ready');
  recognition.onend = () => {
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
  elements.trackingBadge.textContent = tracking.faceDetected ? 'FACE LOCK' : tracking.cameraActive ? 'SEARCHING' : 'MOUSE';
  elements.cameraToggle.textContent = tracking.cameraActive ? 'Camera off' : 'Camera on';
}

elements.mic.addEventListener('click', toggleVoice);
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
  elements.visionNotice.textContent = elements.visionToggle.checked
    ? 'Face tracking is local · vision sharing is active only while listening'
    : 'Camera frames stay on this device';
});
elements.wakeToggle.addEventListener('change', () => {
  localStorage.setItem('mirror.wake', String(elements.wakeToggle.checked));
  if (elements.wakeToggle.checked) wake.resume();
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
  const ready = calibrateDepth();
  showOracle(
    ready ? 'Depth is calibrated to your current eye position. Move side to side to test the window effect.' : 'Stand in front of the camera until Face Lock appears, then calibrate again.',
    '',
    ready ? 'Depth calibrated' : 'Camera needed'
  );
});
elements.diagnosticsToggle.addEventListener('click', () => elements.diagnostics.classList.toggle('open'));
elements.fullscreenToggle.addEventListener('click', () => window.mirrorBridge?.toggleFullscreen());

function resetIdle() {
  elements.form.classList.remove('dim');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (state === 'ready') elements.form.classList.add('dim');
  }, 6000);
}
window.addEventListener('pointermove', resetIdle);
window.addEventListener('keydown', (event) => {
  resetIdle();
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
let statusTick = 0;
let cubeContentTick = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
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
  depthScene.update(dt, elapsed, viewer);
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
  avatar.update(dt, elapsed, viewer);
  arOverlay.render(getFaceLandmarks(), elements.video, elapsed, mode === 'ar');
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
  arOverlay.resize();
});

window.addEventListener('beforeunload', () => { wake.destroy(); gemini.disconnect(); });

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
  const url = elements.watchUrl.value.trim();
  if (!url) return;
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Use an http(s) video URL.');
    const videoId = youtubeId(parsed);
    const spotifyEmbed = spotifyEmbedUrl(parsed);
    if (videoId || spotifyEmbed) {
      elements.watchVideo.pause();
      elements.watchVideo.removeAttribute('src');
      elements.watchVideo.classList.remove('loaded');
      elements.watchFrame.src = videoId
        ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`
        : spotifyEmbed;
      elements.watchFrame.classList.add('loaded');
    } else {
      elements.watchFrame.removeAttribute('src');
      elements.watchFrame.classList.remove('loaded');
      elements.watchVideo.src = parsed.href;
      elements.watchVideo.classList.add('loaded');
      elements.watchVideo.play().catch(() => {});
    }
    elements.watchPlaceholder.classList.add('hidden');
  } catch (error) {
    showOracle(error.message, '', 'Watch mode');
  }
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

function handleGesture(type) {
  // Swipes are inherently noisy in a living room. Keep the camera/AR studio
  // out of this cycle; it is opened intentionally by its control or voice.
  const modes = ['mirror', 'portal', 'watch'];
  if (type === 'palm') {
    setAssistantMode('portal');
    showGesture('Open palm · Converse');
    return;
  }
  if (type === 'pinch') {
    // A casual hand pose can resemble a pinch. Never let that abruptly open
    // Try On; pinches advance effects only after the studio is already open.
    if (mode !== 'ar') {
      showGesture('Pinch · available in Try on');
      return;
    }
    const effects = ['enchanted', 'crown', 'glasses', 'mask', 'halo', 'aura', 'runes'];
    const current = effects.indexOf(arOverlay.effect);
    const next = effects[(current + 1) % effects.length];
    setArEffect(next);
    showGesture(`Pinch · ${next.replace(/^./, (letter) => letter.toUpperCase())}`);
    return;
  }
  const current = modes.indexOf(mode);
  const delta = type === 'swipe-right' ? 1 : -1;
  const next = modes[(current + delta + modes.length) % modes.length];
  setAssistantMode(next);
  const labels = { mirror: 'Ambient', portal: 'Converse', ar: 'Try on', watch: 'Watch' };
  showGesture(`${type === 'swipe-right' ? 'Swipe right' : 'Swipe left'} · ${labels[next]}`);
}

let gestureToastTimer = null;
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
