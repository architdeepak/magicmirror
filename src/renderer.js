import * as THREE from 'three';
import { AvatarController } from './avatarController.js';
import { AROverlay } from './arOverlay.js';
import { createDepthScene } from './depthScene.js';
import { GeminiLiveAdapter } from './geminiLiveAdapter.js';
import { MagicMirrorView } from './magicMirrorView.js';
import { SpeechEngine } from './speechEngine.js';
import { WakeWordListener } from './wakeWord.js';
import {
  applyOffAxisProjection,
  getCameraDevices,
  getFaceLandmarks,
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
  arEffect: document.querySelector('#ar-effect'),
  voiceSelect: document.querySelector('#voice-select'),
  paceSelect: document.querySelector('#pace-select'),
  wakeToggle: document.querySelector('#wake-toggle'),
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
  fullscreenToggle: document.querySelector('#fullscreen-toggle'),
  trackingBadge: document.querySelector('#tracking-badge'),
  apiBadge: document.querySelector('#api-badge'),
  configNote: document.querySelector('#config-note'),
  dashboard: document.querySelector('#dashboard-container')
};

const config = await loadConfig();
config.memory = await loadMemory();
const savedVoice = localStorage.getItem('mirror.voice') || config.geminiVoice;
const savedPace = localStorage.getItem('mirror.pace') || 'brisk';
const visionEnabled = localStorage.getItem('mirror.vision') !== 'false';
const wakeEnabled = localStorage.getItem('mirror.wake') !== 'false';
config.geminiVoice = savedVoice;
elements.citySelect.value = config.city;
elements.voiceSelect.value = savedVoice;
elements.paceSelect.value = savedPace;
elements.visionToggle.checked = visionEnabled;
elements.wakeToggle.checked = wakeEnabled;
elements.visionNotice.textContent = visionEnabled
  ? 'Face tracking is local · vision sharing is active only while listening'
  : 'Camera frames stay on this device';
updateMemoryStatus(config.memory);
elements.apiBadge.textContent = config.hasGeminiKey ? 'GEMINI READY' : 'DEMO MODE';
elements.configNote.innerHTML = config.hasGeminiKey
  ? 'Live voice is configured. Camera sharing is controllable above. The local “mirror mirror” wake word uses Vosk and needs no API key.'
  : 'The mirror works offline. Add <b>GEMINI_API_KEY</b> to <b>.env</b> to unlock live conversation.';

const renderer = new THREE.WebGLRenderer({ canvas: elements.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.06, 30);
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
const arOverlay = new AROverlay(elements.arCanvas);
const dashboard = new MagicMirrorView(elements.dashboard, { city: config.city, units: config.units });
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
  try { await avatar.init('assets/avatar.glb'); }
  catch (error) { console.warn('[startup] avatar', error); }
  setMode('mirror');
  elements.loader.classList.add('done');
  setState('ready');
  elements.oracleCard.classList.add('empty');
  if (elements.wakeToggle.checked) wake.start();
}

window.__mirrorDebug = { scene, camera, avatar, depthScene };

function setMode(nextMode) {
  if (!['portal', 'mirror', 'ar'].includes(nextMode)) return;
  mode = nextMode;
  elements.shell.dataset.mode = nextMode;
  document.querySelectorAll('.mode-btn').forEach((button) => button.classList.toggle('active', button.dataset.mode === nextMode));
  depthScene.setMode(nextMode);
  avatar.setVisible(nextMode !== 'mirror');
  avatar.setDisplayMode(nextMode);
  if (nextMode === 'mirror') elements.oracleCard.classList.add('empty');
  resetIdle();
}

function setAssistantMode(nextMode) {
  if (!['mirror', 'portal', 'ar'].includes(nextMode)) return;
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

function setArEffect(effect) {
  const effects = ['crown', 'runes', 'aura', 'glasses', 'mask', 'cat', 'halo', 'emoji', 'scan', 'none'];
  const selected = effects.includes(effect) ? effect : 'crown';
  arOverlay.setEffect(selected);
  if (elements.arEffect.querySelector(`option[value="${selected}"]`)) elements.arEffect.value = selected;
  if (selected === 'none') {
    setAssistantMode('mirror');
    showOracle('The enchantment fades.', '', 'AR filter removed');
    return;
  }
  setAssistantMode('ar');
  const names = { crown: 'Astral crown', runes: 'Oracle runes', aura: 'Violet aura', glasses: 'Arcane glasses', mask: 'Masquerade mask', cat: 'Familiar cat', halo: 'Celestial halo', emoji: 'Magic emojis', scan: 'Mystic face scan' };
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
elements.oracleCard.addEventListener('click', () => elements.oracleCard.classList.add('empty'));
elements.oracleClose.addEventListener('click', () => elements.oracleCard.classList.add('empty'));
document.querySelectorAll('.mode-btn').forEach((button) => button.addEventListener('click', () => setAssistantMode(button.dataset.mode)));
elements.settingsToggle.addEventListener('click', (event) => { event.stopPropagation(); elements.settings.classList.toggle('open'); populateCameras(); });
elements.settings.addEventListener('click', (event) => event.stopPropagation());
document.addEventListener('click', () => elements.settings.classList.remove('open'));
elements.cameraSelect.addEventListener('change', async () => { await switchCamera(elements.cameraSelect.value); updateTrackingUi(); });
elements.citySelect.addEventListener('change', () => dashboard.setCity(elements.citySelect.value));
elements.arEffect.addEventListener('change', () => setArEffect(elements.arEffect.value));
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
  if (event.key.toLowerCase() === 'f') window.mirrorBridge?.toggleFullscreen();
  if (event.key.toLowerCase() === 'c') elements.cameraToggle.click();
});
resetIdle();

const clock = new THREE.Clock();
let statusTick = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  const viewer = updateHeadTracking(performance.now());
  applyOffAxisProjection(camera, viewer);
  depthScene.update(dt, elapsed, viewer);
  avatar.update(dt, elapsed, viewer);
  arOverlay.render(getFaceLandmarks(), elements.video, elapsed, mode === 'ar');
  renderer.render(scene, camera);
  statusTick += dt;
  if (statusTick > 0.5) { statusTick = 0; updateTrackingUi(); }
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
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
