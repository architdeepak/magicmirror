import { MirrorAgentTools } from './mirrorAgentTools.js';
import * as THREE from 'three';
import { displayProfile } from './displayQuality.js';
import { RenderBudget, SceneRenderBudget, displayMotionRate } from './renderBudget.js';
import { MotionQuality } from './motionQuality.js';
import { PopupPanels } from './popupPanels.js';
import { AvatarController } from './avatarController.js';
import { ClosetStore } from './closetStore.js';
import { matchGarment } from './garmentMatch.js';
import { AROverlay } from './arOverlay.js';
import { GarmentOverlay } from './garmentOverlay.js';
import { CAMERA_CLARITY } from './cameraClarity.js';
import { MirrorExperience } from './mirrorExperience.js';
import { MirrorAmbience } from './mirrorAmbience.js';
import { MirrorTimers, parseTimerCommand, formatRemaining } from './mirrorTimers.js';
import { suggestSceneFps } from './sceneBudgetPolicy.js';
import { initSettingsSections } from './settingsSections.js';
import { MagicTheatre } from './magicTheatre.js';
import { FramingGuide, evaluateFraming } from './framingGuide.js';
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
import { WatchAvatarLayout } from './watchAvatarLayout.js';
import { WatchAudioDucking } from './watchAudioDucking.js';
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
  setCameraQuality,
  switchCamera,
  toggleCamera,
  updateHeadTracking,
  setTrackingAmbient,
  setFaceDetail,
  setFaceRate,
  getFaceLatency
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
  cameraFormat: document.querySelector('#camera-format'),
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
  gestureHold: document.querySelector('#gesture-hold'),
  gestureHoldLabel: document.querySelector('#gesture-hold span'),
  awakening: document.querySelector('#awakening'),
  personaToggle: document.querySelector('#persona-toggle'),
  personaToggleImage: document.querySelector('#persona-toggle-image'),
  personaPanel: document.querySelector('#persona-panel'),
  personaList: document.querySelector('#persona-list'),
  launcherToggle: document.querySelector('#launcher-toggle'),
  launcherPanel: document.querySelector('#launcher-panel'),
  assistantTaskForm: document.querySelector('#assistant-task-form'),
  assistantTaskInput: document.querySelector('#assistant-task-input'),
  quickNoteForm: document.querySelector('#quick-note-form'),
  quickNoteInput: document.querySelector('#quick-note-input'),
  dimensionSwitch: document.querySelector('#dimension-switch')
};

const popupPanels = new PopupPanels([
  {panel:elements.settings,button:elements.settingsToggle},
  {panel:elements.personaPanel,button:elements.personaToggle},
  {panel:elements.launcherPanel,button:elements.launcherToggle}
],document);
window.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!event.defaultPrevented&&!event.isComposing&&event.keyCode!==229&&popupPanels.closeAll())event.preventDefault();
});
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


// Multisampling a 4K-class surface costs hundreds of ms at startup and tens of
// MB of GPU memory; the Efficient tier (chosen, or implied on a small PC)
// renders near 720p and is scaled by the compositor, so it skips MSAA.
const antialiasScene = (() => {
  const saved = localStorage.getItem('mirror.display-quality');
  const smallDevice = (navigator.hardwareConcurrency || 8) <= 4 && (navigator.deviceMemory || 8) <= 4;
  return !(saved === 'eco' || (!saved && smallDevice));
})();
const renderer = new THREE.WebGLRenderer({ canvas: elements.canvas, antialias: antialiasScene, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
// Geometry changes independently of animation. Keep layout reads off the hot
// path, including when caption and portrait writes have dirtied layout.
let cachedViewport = null;
function refreshViewportSize() {
  const width = elements.shell.clientWidth || window.innerWidth;
  const height = elements.shell.clientHeight || window.innerHeight;
  if (cachedViewport?.width === width && cachedViewport?.height === height) return false;
  cachedViewport = { width, height };
  return true;
}
const viewportSize = () => cachedViewport;
refreshViewportSize();
// Registered before the consumers below, so a native resize uses fresh geometry.
window.addEventListener('resize', refreshViewportSize);
const viewportObserver = new ResizeObserver(() => {
  // Shell-only layout changes also need to resize the projection and overlays.
  if (refreshViewportSize()) window.dispatchEvent(new Event('resize'));
});
viewportObserver.observe(elements.shell);
window.addEventListener('beforeunload', () => viewportObserver.disconnect());
// A native 4K portrait television is already 8.3MP at DPR 1.  Preserve that
// native detail, but cap Retina/browser scaling by a pixel budget rather than
// a blunt DPR value that can turn a 4K panel into a 33MP render target.
const RENDER_PIXEL_BUDGET = 12_000_000;
// A first run on a small, fanless PC (<=4 cores and <=4 GB) starts Efficient
// so the 4K panel never begins at a quality the hardware cannot hold.
// Integrated Atom/Celeron-class graphics (HD Graphics 4xx/5xx, UHD 6xx) are an
// order of magnitude slower than a laptop iGPU and share slow LPDDR memory, so
// they start Efficient regardless of core count or reported memory.
const weakGpuName = (() => {
  try {
    const probe = document.createElement('canvas').getContext('webgl');
    const info = probe?.getExtension('WEBGL_debug_renderer_info');
    const name = String(info ? probe.getParameter(info.UNMASKED_RENDERER_WEBGL) : '');
    probe?.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch { return ''; }
})();
const weakGpu = /Intel.*(?:HD Graphics\s*(?:4\d\d|5\d\d)\b|UHD Graphics\s*60[05]\b)/i.test(weakGpuName);
const smallPc = weakGpu || ((navigator.hardwareConcurrency || 8) <= 4 && (navigator.deviceMemory || 8) <= 4);
let displayQualityId=['eco','auto','hd'].includes(localStorage.getItem('mirror.display-quality'))?localStorage.getItem('mirror.display-quality'):smallPc?'eco':'auto';
let displayMotionFps=displayMotionRate(await window.mirrorBridge?.getDisplayCadence?.().catch(()=>60));
const requestedMotionFps = () => Math.min(displayMotionFps,softwareGraphics?30:displayProfile(displayQualityId).motionFps);
const preferredPixelRatio = () => {
  const { width, height } = viewportSize();
  const budgetRatio = Math.sqrt((softwareGraphics?2_000_000:displayQualityId==='eco'?1_200_000:displayQualityId==='auto'?4_500_000:RENDER_PIXEL_BUDGET) / Math.max(1, width * height));
  return Math.min(window.devicePixelRatio || 1,budgetRatio);
};
const softwareGraphics = (() => { try { const gl = renderer.getContext(); const info = gl.getExtension('WEBGL_debug_renderer_info'); return /swiftshader|llvmpipe|softpipe|software/i.test(String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : '')); } catch { return false; } })();
const sceneBudget = new SceneRenderBudget({ maxDynamicFps: softwareGraphics ? 15 : 30 });
// The 3D scene yields GPU time to the face model when the model is running late (see sceneBudgetPolicy.js).
const sceneFpsBase = softwareGraphics ? 15 : 30;
const sceneFpsTimer = setInterval(() => {
  const latency = getFaceLatency();
  sceneBudget.maxDynamicFps = Number.isFinite(latency) ? suggestSceneFps(sceneBudget.maxDynamicFps, latency, { base: sceneFpsBase }) : sceneFpsBase;
}, 1000);
window.addEventListener('beforeunload', () => clearInterval(sceneFpsTimer));
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
const motionQuality = new MotionQuality();
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
  if (tryOnView === 'live' && elements.shell.dataset.liveTryon !== 'true') elements.studioSummary.textContent = localFitSummary(message);
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
  ensureCamera: signal => getTrackingStatus().cameraActive ? Promise.resolve(true) : toggleCamera(true, { signal }),
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
    if (mode === 'ar' && !experience.capturing) { magic.play('selection', { muted: hardMuted }); cueQueen(); }
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
    else if (tryOnView === 'live') elements.studioSummary.textContent = localFitSummary();
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
  softwareGraphics,
  scene,
  camera,
  host: elements.avatarHost,
  onStatus: (message) => { elements.loaderText.textContent = message.toUpperCase(); }
});

let desktopActive = false;
let desktopKind = '';
let desktopLabel = '';
let mode = 'mirror';
setTrackingAmbient(true); // the app starts in the ambient mirror
// A stick compositing a 4K desktop spends most of its GPU time just presenting
// the window. A one-time, plain-language nudge to use 1080p output instead.
try {
  const physicalWidth = Math.max(screen.width, screen.height) * (window.devicePixelRatio || 1);
  if (smallPc && physicalWidth >= 3000 && localStorage.getItem('mirror.hint-1080p') !== 'shown') {
    localStorage.setItem('mirror.hint-1080p', 'shown');
    setTimeout(() => showGesture('Tip: set Windows display to 1920×1080 for smoother motion on this PC'), 8000);
  }
} catch {}
setFaceDetail(localStorage.getItem('mirror.face-puppet') === 'true');
function syncFaceRate() { setFaceRate((depthEnabled && mode === 'portal') || Boolean(elements.facePuppetToggle?.checked)); }
let requestedMode = 'mirror';
let modeRestoreTimer=null,modeRestoreGeneration=0;
let state = 'starting';
const watchAvatarLayout = new WatchAvatarLayout({shell:elements.shell,panel:elements.watchPanel,host:elements.avatarHost,getState:()=>({active:mode==='watch'&&!desktopActive&&avatar.visible,position:elements.shell.dataset.avatarPosition||'center'})});
const watchAudioDucking = new WatchAudioDucking(elements.watchVideo);
const castPlayer = new WatchCastPlayer({
  video: elements.watchVideo, frame: elements.watchFrame, placeholder: elements.watchPlaceholder, urlInput: elements.watchUrl,
  openWatch: () => setAssistantMode('watch'),
  setVolume: volume => watchAudioDucking.setUserVolume(volume),
  onState: (snapshot) => {
    if (snapshot.transport === 'NO_MEDIA_PRESENT') delete elements.watchPanel.dataset.casting;
    void window.mirrorBridge?.reportCastState?.(snapshot)?.catch(() => {});
  },
  onNotice: (message) => { elements.castingStatus.textContent = message; showGesture(message); }
});
const youtubePlayer = new YouTubeWatchPlayer(elements.watchFrame, (message) => showGesture(message));
const watchPlayback = new WatchPlaybackController({ video: elements.watchVideo, frame: elements.watchFrame, youtube: youtubePlayer, openWatch: () => setAssistantMode('watch'),setVolume:volume=>watchAudioDucking.setUserVolume(volume) });
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
let cameraListGeneration = 0;
let lastVoiceActivity = Date.now(), cameraIdlePaused = false;
let gesturesDeferred = true; // hand tracking waits for the wake word (see initialize)
let followX = 0, followMe = localStorage.getItem('mirror.follow') !== 'false';
const searchPool = { root: null, timer: 0, generation: 0, requestId: null }; // filled in once the card exists
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
  onSearch: query => searchMirror(query),
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
  onCameraControl: async (enabled, { signal } = {}) => {
    if (typeof enabled !== 'boolean') throw new Error('Specify camera enabled as true or false.');
    if (hardMuted || signal?.aborted) return { error: 'Camera request cancelled.' };
    if (!enabled) { cancelCameraCaptures(); liveTryOn.stop(); cancelTryOnRender(); }
    if (!enabled || !getTrackingStatus().cameraActive) await toggleCamera(enabled, { signal });
    if (signal?.aborted) return { error: 'Camera request cancelled.' };
    await populateCameras();
    const camera = getMirrorState().camera;
    return { result: camera.active ? 'Local camera is on.' : 'Local camera is off.', ...(enabled && !camera.active ? { error: camera.error || 'Camera unavailable.' } : {}), camera };
  },
  onOpenService: async (service) => openServiceFrame(service),
  onOpenWebpage: async (url) => {
    const outcome = await openDesktopPage(url);
    if (outcome.error) throw outcome.error;
    return outcome.result;
  },
  onCaptureScreen: async () => {
    const watchHost = (() => { try { return new URL(elements.watchFrame.src).hostname.toLowerCase(); } catch { return ''; } })();
    const watchIsSpotify = mode === 'watch' && elements.watchFrame.classList.contains('loaded')
      && (watchHost === 'spotify.com' || watchHost.endsWith('.spotify.com'));
    if (!desktopActive && (mode === 'spotify' || watchIsSpotify)) throw new Error('Spotify content stays on the mirror and is not shared with AI input.');
    return window.mirrorBridge.captureScreen();
  },
  onMirrorState: getMirrorState,
  onAgentTask: runAgentTask,
  onMirrorCommand: command => {
    if (hardMuted) return { error: 'The mirror is hard muted.' };
    return { result: runVoiceNavigation(String(command).slice(0, 400)) ? 'Local command requested. Read current state to verify completion.' : 'Local command not recognized.' };
  },
  onToolActivity: tool => { if (tool) showAgentProgress(tool); else if (!agentRunId) document.querySelector('#agent-progress').hidden = true; },
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

const agentTools = new MirrorAgentTools(gemini);
let agentRunId = null;
window.mirrorBridge?.onCodexTool?.(async payload => {
  if (!agentRunId || payload.runId !== agentRunId || hardMuted) return;
  let result;
  showAgentProgress(payload.tool);
  try { result = await agentTools.execute(payload.tool, payload.args); }
  catch (error) { result = { error: error.message }; }
  if (payload.runId !== agentRunId) return;
  if (result.error && /sign.in|credential|password|authentication/i.test(result.error)) showAgentProgress('sign_in');
  await window.mirrorBridge.codexToolResult({ id: payload.id, runId: payload.runId, result }).catch(() => {});
});
window.mirrorBridge?.onCodexCancelled?.(payload => {
  if (payload?.all || (agentRunId && payload?.runId === agentRunId)) { agentRunId = null; agentTools.cancel(); document.querySelector('#agent-progress').hidden = true; }
});
async function runAgentTask(task) {
  if (hardMuted) return { cancelled: true };
  if (agentRunId) return { error: 'An agent task is already running.' };
  if (!window.mirrorBridge?.codexTask) return { error: 'Install and sign in to Codex on the mirror PC.' };
  const runId = crypto.randomUUID(); agentRunId = runId; agentTools.cancel(); setState('thinking');
  showAgentProgress('thinking');
  try { return await window.mirrorBridge.codexTask({ task, runId }); }
  catch (error) { return { error: error.message }; }
  finally { if (agentRunId === runId) { agentRunId = null; agentTools.cancel(); document.querySelector('#agent-progress').hidden = true; } if (!agentRunId && !gemini.listening && state === 'thinking') setState('ready'); }
}
function cancelAgentTask() {
  agentRunId = null; agentTools.cancel();
  return window.mirrorBridge?.cancelCodex?.()?.catch(() => {});
}
async function takeOverAgentTask() {
  if(!agentRunId)return;
  voiceStartGeneration++;
  document.querySelector('#agent-progress').hidden=true;
  await cancelAgentTask();
  if(!agentRunId&&!gemini.listening&&state==='thinking')setState('ready');
}
let manualControlGeneration=0;
let manualDesktopRequest=null;
function beginUserControl(){
  cancelPendingSearch();
  const generation=++manualControlGeneration;
  const pending=manualDesktopRequest;manualDesktopRequest=null;
  const agent=agentRunId?takeOverAgentTask():null;
  const desktop=pending?window.mirrorBridge?.closeDesktop?.()?.catch(()=>{}):null;
  return {current:()=>generation===manualControlGeneration,wait:agent||desktop?Promise.all([agent,desktop]):null};
}
async function requestUserMode(nextMode) {
  cancelModeRestore();
  const control=beginUserControl();if(control.wait)await control.wait;
  if(control.current())setAssistantMode(nextMode);
}

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
let gestureHoldValue = null;
let queenCueTimer = null;
let avatarExpressionTimer;
const ambience = new MirrorAmbience();
const magic = new MagicTheatre(elements.shell,{softwareGraphics,quality:displayQualityId});
avatar.setQuality(displayQualityId);
depthScene.setQuality(displayQualityId);
const framing = new FramingGuide(elements.shell, garmentOverlay, elements.video);
const experience = new MirrorExperience({
  shell: elements.shell, bridge: { ...window.mirrorBridge, openService: service => openServiceFrame(service) }, magic, closet,
  context: () => ({ mode, muted: hardMuted, sleeping, desktopActive }),
  editorOpen: () => closet.photo.open,
  notice: showGesture, help: text => showOracle(text, '', 'A little guidance'), stop: stopAssistant,
  mode: setAssistantMode, clarity: setCameraClarity,
  ensureCamera: () => getTrackingStatus().cameraActive ? Promise.resolve(true) : toggleCamera(true),
  note: text => saveQuickNote(text),
  prepareCapture: async (signal) => {
    if (desktopActive) await window.mirrorBridge.closeDesktop();
    if (signal?.aborted) return;
    if (!closet.selectedId) throw new Error('Choose a garment before taking a look photo.');
    setMode('ar');
    if (tryOnView !== 'live' || liveTryOn.session) throw new Error('Use the local Live camera view to take a look photo.');
    if (!getTrackingStatus().cameraActive && !await toggleCamera(true, { signal })) throw new Error('Turn on the camera to take a look photo.');
    await garmentSelection;
  },
  captureContext: () => ({ garmentId: closet.selectedId, revision: garmentRevision, mode, clarity: garmentOverlay.cameraClarity?.mode || 'off' }),
  captureLook: snapshot => {
    if (mode !== 'ar' || desktopActive || snapshot.garmentId !== closet.selectedId || snapshot.revision !== garmentRevision || liveTryOn.session || tryOnView !== 'live') throw new Error('The view changed. Take another photo when your look is ready.');
    const fit = garmentOverlay.getLiveState();
    if (!fit.visible || fit.frameAgeMs > 400 || garmentOverlay.cameraCanvas?.style.display !== 'block') throw new Error('Hold your pose until the garment is visible, then try again.');
    const frame = evaluateFraming(garmentOverlay.tracker.getPose(), { width: elements.video.videoWidth, height: elements.video.videoHeight }, garmentOverlay.viewport, garmentOverlay.item?.category);
    if (!frame.ready) throw new Error(frame.message);
    const canvas = document.createElement('canvas'), aspect = garmentOverlay.viewport.width / garmentOverlay.viewport.height;
    canvas.width = Math.round(aspect > 1 ? 1024 : 1024 * aspect); canvas.height = Math.round(aspect > 1 ? 1024 / aspect : 1024);
    const context = canvas.getContext('2d');
    for (const layer of [garmentOverlay.cameraCanvas, elements.garmentCanvas, elements.arCanvas]) {
      context.save(); context.filter = getComputedStyle(layer).filter || 'none';
      context.drawImage(layer, 0, 0, canvas.width, canvas.height); context.restore();
    }
    const item = closet.items.find(item => item.id === closet.selectedId);
    return { imageDataUrl: canvas.toDataURL('image/png'), garment: item?.name || 'My outfit', name: `My look · ${new Date().toLocaleDateString()}` };
  }
});
document.querySelector('#capture-cancel').addEventListener('click', stopAssistant);
document.querySelector('#closet-favorite').addEventListener('click', () => closet.favoriteCurrent(closet.favorites.has(closet.selectedId)));
document.querySelector('#closet-filter').addEventListener('click', () => { closet.favoritesOnly = !closet.favoritesOnly; closet.render(); });
for (const [selector, key, object, property] of [['#framing-toggle','mirror.framing',framing,'enabled'],['#reduced-motion-toggle','mirror.reduced-motion',magic,'reduced'],['#magic-sounds-toggle','mirror.magic-sounds',magic,'sound']]) {
  const field = document.querySelector(selector); field.checked = object[property]; field.addEventListener('change', () => { object[property] = field.checked; localStorage.setItem(key, String(field.checked)); magic.applyPreferences(); if (property === 'reduced' || property === 'sound') magic.cancel(); });
}
const followToggle=document.querySelector('#follow-toggle');followToggle.checked=followMe;followToggle.addEventListener('change',()=>{followMe=followToggle.checked;localStorage.setItem('mirror.follow',String(followMe));});
const atmosphereToggle=document.querySelector('#atmosphere-toggle');
atmosphereToggle.checked=localStorage.getItem('mirror.atmosphere')==='true';
atmosphereToggle.addEventListener('change',()=>{localStorage.setItem('mirror.atmosphere',String(atmosphereToggle.checked));syncAmbienceContext();void ambience.setEnabled(atmosphereToggle.checked);});
window.addEventListener('pointerdown',()=>{if(atmosphereToggle.checked&&!ambience.master)void ambience.setEnabled(true);},{once:true});
const idleBackgroundSelect=document.querySelector('#idle-background');
elements.shell.dataset.idleBackground=localStorage.getItem('mirror.idle-background')||'weather';idleBackgroundSelect.value=elements.shell.dataset.idleBackground;
idleBackgroundSelect.addEventListener('change',()=>{galleryEpoch++;elements.shell.dataset.idleBackground=idleBackgroundSelect.value;localStorage.setItem('mirror.idle-background',idleBackgroundSelect.value);void displayGallery();});
let galleryImages=[],galleryIndex=0,galleryLayer=0,galleryEpoch=0;
let galleryRevision=0,galleryImportBusy=false;
function galleryVisible(){return mode==='mirror'&&!sleeping&&!document.hidden&&!desktopActive&&elements.shell.dataset.idleBackground==='gallery';}
async function displayGallery(){
  if(!galleryImages.length||!galleryVisible())return;
  const epoch=++galleryEpoch,next=1-galleryLayer,image=document.querySelectorAll('#idle-gallery img')[next];image.src=galleryImages[galleryIndex++%galleryImages.length];
  try{await image.decode();}catch{return;}if(epoch!==galleryEpoch||!galleryVisible())return;
  document.querySelectorAll('#idle-gallery img').forEach((item,i)=>item.classList.toggle('active',i===next));galleryLayer=next;
}
async function loadGallery(){
  const revision=galleryRevision;
  try{
    const result=await window.mirrorBridge?.idleGallery?.();
    if(!result||revision!==galleryRevision)return;
    galleryEpoch++;galleryImages=result.images||[];galleryIndex=0;void displayGallery();
  }catch{}
}
void loadGallery();
const galleryTimer=setInterval(()=>{void displayGallery();},45000);
document.addEventListener('visibilitychange',()=>{galleryEpoch++;if(!document.hidden)void displayGallery();});
window.addEventListener('beforeunload',()=>{galleryRevision++;galleryEpoch++;clearInterval(galleryTimer);});
async function importGallery(){
  if(galleryImportBusy)return;
  const button=document.querySelector('#idle-gallery-import'),revision=galleryRevision;
  galleryImportBusy=true;button.disabled=true;
  try{
    const result=await window.mirrorBridge.importIdleGallery();
    if(result.cancelled||revision!==galleryRevision)return;
    galleryRevision++;galleryEpoch++;galleryImages=result.images||[];galleryIndex=0;
    idleBackgroundSelect.value='gallery';idleBackgroundSelect.dispatchEvent(new Event('change'));
    showGesture('Idle photos saved on this device');
  }catch(error){if(revision===galleryRevision)showOracle(error.message,'','Photo gallery');}
  finally{galleryImportBusy=false;button.disabled=false;}
}
document.querySelector('#idle-gallery-import').addEventListener('click',()=>{void importGallery();});
const displayQualitySelect=document.querySelector('#display-quality');displayQualitySelect.value=displayQualityId;
function applyDisplayQuality(id) {
  motionQuality.reset();avatar.faceHost?.setRenderScale(1);
  displayQualityId=['eco','auto','hd'].includes(id)?id:'auto';localStorage.setItem('mirror.display-quality',displayQualityId);
  elements.shell.dataset.quality=displayQualityId;window.dispatchEvent(new Event('resize'));
  displayQualitySelect.value=displayQualityId;avatar.setQuality(displayQualityId);garmentOverlay.setQuality(displayQualityId);void setCameraQuality(displayQualityId).then(()=>updateTrackingUi()).catch(()=>{});magic.setQuality(displayQualityId);depthScene.setQuality(displayQualityId);sceneBudget.maxDynamicFps=softwareGraphics?15:displayProfile(displayQualityId).motionFps;sceneBudget.invalidate();
  syncAdaptiveQuality();
}
function syncAdaptiveQuality() {
  const adjusted = motionQuality.motionFps < requestedMotionFps() || motionQuality.avatarScale < 1;
  elements.shell.dataset.adaptiveMotion=adjusted?'calm':'full';
  magic.setMotionFps(Math.min(motionQuality.motionFps,requestedMotionFps()));
  document.querySelector('#display-quality-status').textContent=displayQualityId==='hd'?'More texture detail and smooth motion when available':displayQualityId==='eco'?'Lower graphics work for a small PC':'Detail and smoothness balanced for this display';
  if(softwareGraphics)document.querySelector('#display-quality-status').textContent+=' · Software graphics use simpler 3D lighting';
  if(adjusted)document.querySelector('#display-quality-status').textContent+=' · Motion and rendering adjusted for responsiveness';
}
displayQualitySelect.addEventListener('change',event=>applyDisplayQuality(event.target.value));applyDisplayQuality(displayQualityId);
document.querySelector('#routine-movie').value = localStorage.getItem('mirror.routine.movie') || 'youtube';
document.querySelector('#routine-movie').addEventListener('change', event => localStorage.setItem('mirror.routine.movie', event.target.value));
const avatarStyleSelect=document.querySelector('#avatar-render-style');
avatar.onStyleFallback=reason=>{avatarStyleSelect.value='portrait';localStorage.setItem('mirror.avatar-render-style','portrait');document.querySelector('#avatar-render-status').textContent=reason+' · portrait restored';};
let avatarStyleRequest=0;
async function applyAvatarStyle(style){
  const request=++avatarStyleRequest;
  document.querySelector('#avatar-render-status').textContent=style==='rig'?'Preparing 3D face…':'Restoring portrait…';
  const ok=await avatar.setRenderStyle(style);
  if(request!==avatarStyleRequest)return false;
  avatarStyleSelect.value=avatar.renderStyle;localStorage.setItem('mirror.avatar-render-style',avatar.renderStyle);
  document.querySelector('#avatar-render-status').textContent=ok?'Appearance updated':(avatar.lastRigError||'Portrait fallback active');
  return ok;
}
avatarStyleSelect.addEventListener('change',event=>void applyAvatarStyle(event.target.value));
document.querySelector('#routine-music').checked = localStorage.getItem('mirror.routine.music') === 'true';
document.querySelector('#routine-music').addEventListener('change', event => localStorage.setItem('mirror.routine.music', String(event.target.checked)));
elements.citySelect.value = dashboard.city;
await initialize();

async function initialize() {
  setState('starting');
  initHeadTracking(elements.video)
    .then(populateCameras)
    .catch((error) => console.warn('[startup] tracking', error));
  // Heavy loads are staggered so the first thing the person needs (face lock,
  // then the wake word) is not slowed by a hand model nobody has used yet.
  // Hand tracking starts once the wake word has armed, or after a short grace.
  setTimeout(releaseGestures, 9000);
  try { await avatar.init('assets/avatar.glb'); }
  catch (error) { console.warn('[startup] avatar', error); }
  avatar.onSurfaceChange=canvas=>depthScene.setAvatarCanvas(canvas);
  depthScene.setAvatarCanvas(avatar.getVisibleCanvas());

  avatar.setDepthEnabled(depthEnabled && mode === 'portal' && !desktopActive);
  await closet.load();
  setMode('mirror');
  setPersona(savedPersona, false);
  await applyAvatarStyle(localStorage.getItem('mirror.avatar-render-style')==='rig'?'rig':'portrait');
  avatar.setFacePuppetEnabled(facePuppetEnabled);
  elements.loader.classList.add('done');
  setState('ready');
  elements.oracleCard.classList.add('empty');
  if (elements.wakeToggle.checked && !hardMuted) wake.start();
  else updateWakeStatus('paused');
}

window.__mirrorDebug = { watchAvatarLayout, scene, camera, avatar, gestures, depthScene, renderQuality, garmentOverlay, liveTryOn, gemini, getMirrorState, stopAssistant, runAgentTask, agentTools, experience, framing, magic, sceneBudget, showAssistant, setAssistantMode, handleWakeWord, runVoiceNavigation, showSearchResult,
  getWakeState: () => ({ enabled: wake.enabled, assistantActive: wake.assistantActive, microphoneReady: Boolean(wake.processor && wake.stream?.active), generation: wake.generation }),
  getAmbienceState: () => ({...ambience.context,enabled:ambience.enabled,active:Boolean(ambience.master)}),
  getPowerState: () => ({ ...renderBudget.snapshot(), scene: sceneBudget.snapshot(), adaptive: motionQuality.snapshot() }) };

function setDepthMode(enabled, announce = true) {
  depthEnabled = Boolean(enabled);
  sceneBudget.invalidate();
  localStorage.setItem('mirror.depth-cube', String(depthEnabled));
  elements.shell.dataset.depth = depthEnabled ? 'cube' : 'flat';
  elements.dimensionSwitch?.querySelectorAll('button').forEach((button) => button.classList.toggle('active', button.dataset.depth === (depthEnabled ? 'cube' : 'flat')));
  depthScene.setDepthEnabled(depthEnabled);
  avatar.setDepthEnabled(depthEnabled && mode === 'portal' && !desktopActive);
  syncFaceRate();
  if (announce) { const tracking = getTrackingStatus(); showGesture(depthEnabled ? !tracking.cameraActive ? '3D enabled · turn camera on for head tracking' : !tracking.faceDetected ? '3D enabled · looking for your face' : '3D enabled · head tracking active' : '2D surface · stable front view'); }
}
setDepthMode(depthEnabled, false);

function setMode(nextMode) {
  if (!['portal', 'mirror', 'ar', 'watch', 'spotify'].includes(nextMode)) return;
  cancelModeRestore();
  const changed = mode !== nextMode;
  if (mode === 'ar' && nextMode !== 'ar') { setWardrobePanelOpen(false); cancelTryOnRender(); liveTryOn.stop(); }
  if (mode === 'watch' && nextMode !== 'watch') { elements.watchVideo.pause(); youtubePlayer.pause(); }
  mode = nextMode;
  if(changed){galleryEpoch++;if(nextMode==='mirror')void displayGallery();}
  syncAmbienceContext();
  setTrackingAmbient(nextMode === 'mirror');
  if (nextMode !== 'mirror') void restoreCameraAfterIdle();
  if (experience.capturing && nextMode !== 'ar') experience.cancel();
  if (changed) magic.cancel();
  sceneBudget.invalidate();
  elements.shell.dataset.mode = nextMode;
  document.querySelectorAll('.mode-btn').forEach((button) => button.classList.toggle('active', button.dataset.mode === nextMode));
  elements.studioPanel.classList.toggle('active', nextMode === 'ar');
  elements.watchPanel.classList.toggle('active', nextMode === 'watch');
  elements.spotifyPanel.classList.toggle('active', nextMode === 'spotify');
  garmentOverlay.setEnabled(nextMode === 'ar' && tryOnView === 'live' && !desktopActive && !liveTryOn.session);
  if (nextMode === 'spotify') { void refreshSpotify(); }
  depthScene.setMode(desktopActive ? 'mirror' : nextMode);
  avatar.setVisible(desktopActive || nextMode === 'portal' || nextMode === 'ar' || nextMode === 'watch' && Boolean(gemini.listening || browserRecognition || ['connecting', 'listening', 'thinking', 'speaking'].includes(state)));
  avatar.setDisplayMode(nextMode);
  avatar.setDepthEnabled(depthEnabled && nextMode === 'portal' && !desktopActive);
  syncFaceRate();
  if (nextMode === 'mirror') elements.oracleCard.classList.add('empty');
  watchAvatarLayout.schedule();
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
  galleryEpoch++;
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
  if(!desktopActive)void displayGallery();
  if (desktopActive) {
    popupPanels.closeAll({restoreFocus:false});
  }
}
const removeDesktopListener = window.mirrorBridge?.onDesktopPresentation?.(applyDesktopPresentation);
window.mirrorBridge?.desktopPresentation?.().then(applyDesktopPresentation).catch(() => {});
elements.desktopReturn.addEventListener('click', async () => {
  const control=beginUserControl();if(control.wait)await control.wait;if(!control.current())return;
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
  const watchState = watchPlayback.snapshot();
  return {
    observedAt: new Date().toISOString(),
    display: { mode, requestedMode, desktopActive, desktopKind, desktopLabel, sleeping, visible: document.visibilityState === 'visible', width: innerWidth, height: innerHeight,
      quality:displayQualityId,avatarAppearance:avatar.renderStyle,avatarRig:avatar.rigHost?.snapshot()||null,avatarPlayback:avatar.getPlaybackStatus(),graphics:softwareGraphics?'software':'accelerated-or-unknown',effects:magic.snapshot(),avatarPosition: elements.shell.dataset.avatarPosition || 'center', depthEnabled },
    agent: { active: Boolean(agentRunId), provider: 'codex' },
    lookbook: { open: experience.dialog.open, capturing: experience.capturing, draftReady: Boolean(experience.draft), saving: experience.saving, savedCount: experience.looks.length, comparison: Boolean(experience.comparing) },
    localTimers: experience.timers.tick().map(item => ({ label: item.label, seconds: item.seconds, state: item.state })),
    routine: { active: experience.routineActive },
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
      wardrobeControlsOpen: mode==='ar'&&!desktopActive&&elements.shell.dataset.wardrobeOpen==='true',
      photoEditor: { open: closet.photo.open, readyToSave: closet.photo.readyToSave, view: closet.photo.activeView, quarterTurns:closet.photo.quarterTurns||0,straightenDegrees:Number(closet.photo.field('angle').value), frontReady: Boolean(closet.photo.views.front?.output), backReady: Boolean(closet.photo.views.back?.output), extracting: Boolean(closet.photo.extracting), saving: Boolean(closet.photo.saving) },
      closet: closet.items.slice(0, 80).map((item) => ({ name: item.name, category: item.category, favorite: closet.favorites.has(item.id) })) },
    watch: { ...watchState, audioDucking: watchState.source === 'media' ? watchAudioDucking.snapshot() : watchState.audioDucking||{ supported: false }, castingEnabled, castActive: castPlayer.active },
    services: { findmy: { web: 'Apple Find Devices', peopleLocations: false, note: 'No Find My People bridge is configured; friends locations require the Find My app on an Apple device.' }, browserSignIn: 'User enters credentials directly; agent observation/input pauses on sign-in prompts.' },
    music: { view: elements.spotifyCard.dataset.view || 'classic', metadataKeptLocal: true }
  };
}

function cancelModeRestore() {
  modeRestoreGeneration++;clearTimeout(modeRestoreTimer);modeRestoreTimer=null;
}
function showAssistant() {
  setMode(['ar', 'watch'].includes(requestedMode) ? requestedMode : 'portal');
}

function returnToRequestedMode() {
  cancelModeRestore();const generation=modeRestoreGeneration;
  modeRestoreTimer=setTimeout(() => {
    if(generation!==modeRestoreGeneration)return;
    modeRestoreTimer=null;
    if (!sleeping && !desktopActive && !voiceStarting && !agentRunId && !browserRecognition && !speech.isSpeaking
      && !gemini.listening && ['ready','offline'].includes(state)) setMode(requestedMode);
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

function syncAmbienceContext() {
  ambience.setContext({muted:hardMuted||sleeping,duck:desktopActive||['watch','spotify'].includes(mode)||['connecting','listening','thinking','speaking'].includes(state)});
}
function setState(next) {
  state = next;
  queueMicrotask(updatePrivacyChip);
  if (next !== 'ready' && next !== 'listening') lastVoiceActivity = Date.now();
  syncAmbienceContext();
  elements.shell.dataset.voiceActive = String(Boolean(gemini?.listening || browserRecognition || ['connecting','listening','thinking','speaking'].includes(next)));
  watchAvatarLayout.schedule();
  watchAudioDucking.setActive(Boolean(gemini?.listening || browserRecognition || ['listening', 'thinking', 'speaking'].includes(next)));
  youtubePlayer.setDucking(Boolean(gemini?.listening || browserRecognition || ['listening', 'thinking', 'speaking'].includes(next)));
  avatar.setActivity?.(next);
  if (mode === 'watch') avatar.setVisible(desktopActive || Boolean(gemini.listening || browserRecognition || ['connecting', 'listening', 'thinking', 'speaking'].includes(next)));
  const labels = {
    starting: 'Awakening', connecting: 'Opening the veil', ready: config.hasGeminiKey ? 'AI ready' : 'Local ready',
    listening: 'Listening', thinking: 'Consulting', speaking: 'Speaking', offline: 'Local ready', error: 'Needs attention'
  };
  elements.stateLabel.textContent = labels[next] || next;
  elements.stateDot.className = `state-dot${['starting', 'connecting', 'thinking', 'speaking'].includes(next) ? ' busy' : next === 'error' ? ' error' : ''}`;
  const micActive = Boolean(agentRunId || voiceStarting || gemini?.listening || browserRecognition || speech.isSpeaking || elements.awakening.classList.contains('active'));
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
  cancelPendingSearch();
  if (hardMuted) { showOracle('Unmute the mirror before starting an assistant task.', '', 'Hard muted'); return; }
  captionUserTurnActive = false; captionAssistantTurnActive = false;
  appendCaption('user', prompt, { replace: true });
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
  const result = await runAgentTask(prompt);
  if (hardMuted || generation !== voiceStartGeneration || result.cancelled) return;
  if (!result.completed || !result.summary?.trim()) { showOracle(result.error || 'The assistant did not return a completed answer.', prompt, 'Assistant unavailable'); return; }
  const response = result.summary.trim();
  appendCaption('assistant', response);
  showOracle(response, prompt);
  speech.speak(response);
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
  // The host is already standing behind the cloud: it billows over the whole
  // glass, then thins to reveal her, so the face is never missing.
  showAssistant();
  // The room is under the cloud: let the governor draw it at 1x for the cue.
  if (renderQuality.pixelRatio > 1) { renderQuality.pixelRatio = 1; renderer.setPixelRatio(1); sceneBudget.invalidate(); }
  elements.awakening.classList.add('active');
  magic.play('wake', { muted: hardMuted });
  setState('starting');
  await new Promise((resolve) => setTimeout(resolve, magic.reduced ? 700 : 3100));
  if (cancelled()) return;
  elements.awakening.classList.remove('active');
  magic.play('arrival', { muted: hardMuted });
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

function releaseGestures() {
  if (!gesturesDeferred) return;
  gesturesDeferred = false;
  gestures.setEnabled(elements.gestureToggle.checked);
}

function updateWakeStatus(status) {
  queueMicrotask(updatePrivacyChip);
  if (status === 'armed' || status === 'paused' || status === 'unavailable') releaseGestures();
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
  captionAssistantTurnActive = false;
  localCaptionEpoch = wake.startCaptionTurn();
}

function handleLocalTranscript(text, { epoch }) {
  if (hardMuted || !gemini.listening || !localCaptionsAllowed || epoch !== localCaptionEpoch || !text?.trim()) return;
  appendCaption('user', text.trim(), { replace: true });
  userCaptionFromLocal = true;
}

function handleTranscript(role, text, { delta = false } = {}) {
  if (!text?.trim() && !(delta && captionState[role])) return;
  const replace = role === 'user' && userCaptionFromLocal;
  if (role === 'user') {
    localCaptionsAllowed = false;
    userCaptionFromLocal = false;
    wake.stopCaptionTurn();
  }
  appendCaption(role, delta ? text : text.trim(), { replace, delta });
  if (role === 'user' && !hardMuted && /\bmirror\s+(?:stop|mute|quiet|cancel)\b/i.test(captionState.user)) {
    stopAssistant();
    return;
  }
  if (role === 'assistant') {
    assistantTranscript = captionState.assistant;
    showOracle(assistantTranscript, '', 'The mirror answers');
  } else if (!delta || !captionAssistantTurnActive) {
    assistantTranscript = '';
    showOracle('Listening…', text.trim(), 'You said');
  }
}

async function toggleVoice() {
  if (hardMuted) return;
  if (agentRunId || voiceStarting || browserRecognition || gemini.listening || speech.isSpeaking || elements.awakening.classList.contains('active')) {
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

function appendCaption(role, text, { replace = false, delta = false } = {}) {
  lastVoiceActivity = Date.now();
  if (!['user', 'assistant'].includes(role)) return;
  const row = role === 'user' ? elements.captionUser : elements.captionAssistant;
  if (role === 'user' && !captionUserTurnActive) {
    captionUserTurnActive = true;
    if (!delta) captionAssistantTurnActive = false;
    captionState.user = '';
    elements.captionUser.querySelector('span').textContent = '';
    elements.captionUser.classList.remove('visible');
    if (!delta || !captionAssistantTurnActive) {
      captionState.assistant = '';
      elements.captionAssistant.querySelector('span').textContent = '';
      elements.captionAssistant.classList.remove('visible');
    }
  } else if (role === 'assistant' && !captionAssistantTurnActive) {
    captionAssistantTurnActive = true;
    if (!delta) captionUserTurnActive = false;
    captionState.assistant = '';
  }
  const valueNode = row.querySelector('span');
  const previous = captionState[role];
  const merged = replace ? text : delta ? previous + text : text === previous || previous.startsWith(text) ? previous
    : text.startsWith(previous) ? text : `${previous} ${text}`.trim();
  // Keep a bounded transcript and scroll wrapped rows to the newest words.
  const next = Array.from(merged).slice(-2000).join('');
  // Cumulative transcripts commonly repeat. Preserve the DOM and avoid scroll
  // geometry reads when neither the transcript nor its rendered text changed.
  if (next === previous && valueNode.textContent === next) return;
  captionState[role] = next;
  if (!decorateCaptionWords(valueNode, next)) valueNode.textContent = next;
  row.classList.toggle('visible', Boolean(next));
  elements.captions.classList.toggle('visible', Boolean(captionState.user || captionState.assistant));
  followCaptionTail(valueNode);
}

// Reading scrollWidth/Height right after a DOM write forces a synchronous layout.
// Coalesce the follow-the-latest-word scroll into one pass per animation frame.
const captionTailNodes = new Set();
let captionTailFrame = 0;
function followCaptionTail(node) {
  if (typeof requestAnimationFrame !== 'function') { node.scrollLeft = node.scrollWidth; node.scrollTop = node.scrollHeight; return; }
  captionTailNodes.add(node);
  if (captionTailFrame) return;
  captionTailFrame = requestAnimationFrame(() => {
    captionTailFrame = 0;
    for (const tail of captionTailNodes) { tail.scrollLeft = tail.scrollWidth; tail.scrollTop = tail.scrollHeight; }
    captionTailNodes.clear();
  });
}

// Words arrive a few at a time; render each as its own element so only the new
// ones animate in (opacity/transform). span.textContent still equals the text,
// and nodes without DOM methods (tests) fall back to plain text.
function decorateCaptionWords(node, text) {
  if (typeof node.replaceChildren !== 'function' || !node.ownerDocument) return false;
  const tokens = text.match(/\S+|\s+/g) || [];
  let cache = node.__captionTokens;
  const intact = cache && node.childNodes.length === cache.length;
  if (intact && node.textContent === text) return true;
  let keep = 0;
  if (intact) {
    while (keep < cache.length && keep < tokens.length && cache[keep] === tokens[keep]) keep++;
    // Extend the same element while a word streams in, preserving its animation.
    if (keep < cache.length && keep < tokens.length && !/\s/.test(cache[keep])
      && tokens[keep].startsWith(cache[keep]) && node.childNodes[keep]?.nodeType === 1) {
      node.childNodes[keep].textContent = tokens[keep];
      keep++;
    }
  }
  while (node.childNodes.length > keep) node.removeChild(node.lastChild);
  for (let i = keep; i < tokens.length; i++) {
    const token = tokens[i];
    if (/^\s+$/.test(token)) { node.appendChild(node.ownerDocument.createTextNode(token)); continue; }
    const word = node.ownerDocument.createElement('i');
    word.textContent = token;
    if (!intact && keep === 0 && tokens.length > 8 && i < tokens.length - 3) word.className = 'settled';
    node.appendChild(word);
  }
  const latest = node.lastElementChild;
  if (node.__captionLatest !== latest) {
    node.__captionLatest?.classList.remove('latest');
    latest?.classList.add('latest');
    node.__captionLatest = latest;
  }
  node.__captionTokens = tokens;
  return true;
}

window.addEventListener('resize', () => {
  for (const row of [elements.captionUser, elements.captionAssistant]) {
    const value = row.querySelector('span');
    value.scrollLeft = value.scrollWidth;
    value.scrollTop = value.scrollHeight;
  }
});

function stopAssistant() {
  for (const role of ['user','assistant']) captionState[role] = '';
  for (const row of [elements.captionUser,elements.captionAssistant]) { row.querySelector('span').textContent = ''; row.classList.remove('visible'); }
  elements.captions.classList.remove('visible');
  hideSearchResult();
  experience.cancel(); magic.cancel();closet.photo.cancelWork();
  clearTimeout(queenCueTimer); clearTimeout(avatarExpressionTimer); avatar.setExpression({}); avatar.setGazeOverride?.(null); avatar.setEyeGaze({x:0,y:0,confidence:0}); avatar.setPerformance({ turn: 0, nod: 0, lean: 0 });
  document.querySelector('#agent-progress').hidden = true;
  cancelAgentTask();
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
  if(muted)stopBell();
  if(muted)hideSearchResult();
  if (muted) { experience.cancel(); magic.cancel();closet.photo.cancelWork(); clearTimeout(queenCueTimer); clearTimeout(avatarExpressionTimer); avatar.setExpression({}); avatar.setGazeOverride?.(null); avatar.setEyeGaze({x:0,y:0,confidence:0}); avatar.setPerformance({ turn: 0, nod: 0, lean: 0 }); document.querySelector('#agent-progress').hidden = true; }
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
  queueMicrotask(updatePrivacyChip);
  syncAmbienceContext();
  if(hardMuted){void watchPlayback.command('pause').catch(()=>{});void window.mirrorBridge.spotifyControl('pause').catch(()=>{});}
  elements.mic.disabled = hardMuted;
  localStorage.setItem('mirror.hard-muted', String(hardMuted));
  elements.mute.setAttribute('aria-pressed', String(hardMuted));
  elements.muteLabel.textContent = hardMuted ? 'MUTED' : 'MUTE';
  elements.mute.querySelector('span').textContent = hardMuted ? '⊘' : '◉';
  elements.mute.setAttribute('aria-label', hardMuted ? 'Unmute and arm wake word' : 'Hard mute microphone');
  if (hardMuted) {
    cancelAgentTask();
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
    showOracle('Open Command Center to type a question. Live voice can be connected in Settings.', '', 'Microphone conversation unavailable');
    return;
  }
  let recognition;
  try{recognition=new Recognition();}
  catch(error){setState('ready');showOracle(error.message||'Browser speech recognition is unavailable. Use Command Center to type a question.','','Voice input');return;}
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
    if (hardMuted || browserRecognition !== recognition || submitted) return;
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
      else {
        submitted = finalPrompt;
        try{recognition.stop();}catch{try{recognition.abort();}catch{}}
        void askMirror(finalPrompt);
      }
    }
  };
  recognition.onerror = event => {
    if(browserRecognition!==recognition)return;
    if(submitted){browserRecognition=null;if(state==='listening'){wake.setAssistantActive(false);setState('ready');}return;}
    browserRecognition=null;wake.setAssistantActive(false);setState('ready');
    if(event.error==='aborted')return;
    const messages={'not-allowed':'Microphone permission was denied. Allow it, then use Listen to retry.','service-not-allowed':'Browser speech recognition is unavailable. Use Command Center to type a question.','audio-capture':'No microphone is available. Connect one, then use Listen to retry.','no-speech':'No speech was heard. Use Listen to try again.',network:'Browser speech recognition could not connect. Use Listen to retry or type in Command Center.'};
    showOracle(messages[event.error]||event.message||'Speech recognition failed. Use Listen to retry or type in Command Center.','','Voice input');
    if(!hardMuted&&elements.wakeToggle.checked&&['no-speech','network'].includes(event.error))wake.resume();
  };
  recognition.onend = () => {
    if (browserRecognition !== recognition) return;
    browserRecognition = null;
    if (state === 'listening') { wake.setAssistantActive(false);setState('ready'); }
    if (!hardMuted && elements.wakeToggle.checked) wake.resume();
  };
  try{recognition.start();}catch(error){recognition.onerror({error:'startup',message:error.message});try{recognition.abort();}catch{}}
}

async function populateCameras() {
  const generation=++cameraListGeneration;
  let cameras;
  try{cameras=await getCameraDevices();}
  catch{if(generation===cameraListGeneration){elements.cameraNotice.textContent='Camera list unavailable. Reopen Settings to retry.';elements.cameraNotice.hidden=false;}return;}
  if(generation!==cameraListGeneration)return;
  const tracking = getTrackingStatus();
  const previous=elements.cameraSelect.value;
  elements.cameraSelect.innerHTML = cameras.length
    ? cameras.map((device, i) => `<option value="${escapeHtml(device.deviceId)}">${escapeHtml(device.label || `Camera ${i + 1}`)}</option>`).join('')
    : '<option value="">No camera detected</option>';
  const active = tracking.activeCameraId
    ? cameras.find(device=>device.deviceId===tracking.activeCameraId)
    : cameras.find(device=>device.deviceId===previous) || cameras.find(device=>device.label===tracking.activeCameraLabel);
  if (active) elements.cameraSelect.value = active.deviceId;
  updateTrackingUi();
}

function updateTrackingUi() {
  const write = (element, text) => { if (element.textContent !== text) element.textContent = text; };
  updatePrivacyChip();
  const tracking = getTrackingStatus();
  if (liveTryOn.session && !tracking.cameraActive) liveTryOn.stop('Camera disconnected. Live AI try-on stopped.');
  write(elements.trackingBadge, tracking.faceDetected ? 'FACE LOCK' : tracking.cameraActive ? 'SEARCHING' : 'MOUSE');
  write(elements.cameraToggle, tracking.cameraActive ? 'Camera off' : 'Camera on');
  const quickCamera=document.querySelector('#studio-camera-toggle');
  if(quickCamera){write(quickCamera,elements.cameraToggle.textContent);const pressed=String(tracking.cameraActive);if(quickCamera.getAttribute?.('aria-pressed')!==pressed)quickCamera.setAttribute('aria-pressed',pressed);}
  write(elements.cameraNotice, tracking.error || '');
  if(elements.cameraNotice.hidden !== !tracking.error) elements.cameraNotice.hidden = !tracking.error;
  if (elements.cameraFormat) {
    const settings = elements.video.srcObject?.getVideoTracks?.()[0]?.getSettings?.() || {};
    const width = settings.width || elements.video.videoWidth, height = settings.height || elements.video.videoHeight;
    const hidden = !tracking.cameraActive || !width || !height;
    if(elements.cameraFormat.hidden !== hidden) elements.cameraFormat.hidden = hidden;
    const format = width && height ? `Camera capture · ${width} × ${height}${Number.isFinite(settings.frameRate) ? ` · ${Math.round(settings.frameRate)} fps negotiated` : ''}. Portrait view crops the sides.` : '';
    if (elements.cameraFormat.textContent !== format) elements.cameraFormat.textContent = format;
  }
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
document.querySelectorAll('.mode-btn').forEach((button) => button.addEventListener('click', () => requestUserMode(button.dataset.mode)));
elements.settingsToggle.addEventListener('click', (event) => { event.stopPropagation(); if(popupPanels.toggle(elements.settings))populateCameras(); });
elements.personaToggle.addEventListener('click', (event) => { event.stopPropagation(); popupPanels.toggle(elements.personaPanel); });
elements.launcherToggle.addEventListener('click', (event) => { event.stopPropagation(); popupPanels.toggle(elements.launcherPanel); });
elements.settings.addEventListener('click', (event) => event.stopPropagation());
elements.personaPanel.addEventListener('click', (event) => event.stopPropagation());
elements.launcherPanel.addEventListener('click', (event) => event.stopPropagation());
document.addEventListener('click', () => popupPanels.closeAll());
elements.personaList.addEventListener('click', (event) => {
  const card = event.target.closest('[data-persona]');
  if (card) {
    setPersona(card.dataset.persona);
    setAssistantMode('portal');
  }
});
elements.cameraSelect.addEventListener('change', async () => { liveTryOn.stop(); cancelTryOnRender(); await switchCamera(elements.cameraSelect.value); updateTrackingUi(); });
function setCameraClarity(preset, announce = true) {
  const mode = CAMERA_CLARITY[preset] ? preset : 'off';
  document.querySelector('#camera-clarity').value = mode;
  elements.shell.style.setProperty('--camera-clarity-filter', CAMERA_CLARITY[mode].filter);
  garmentOverlay.setCameraClarity(mode);
  localStorage.setItem('mirror.camera-clarity', mode);
  if (announce) showGesture(mode === 'off' ? 'Original camera · clarity off' : `${mode === 'bright' ? 'Bright' : 'Natural'} camera clarity · local enhancement`);
}
setCameraClarity(localStorage.getItem('mirror.camera-clarity') || 'off', false);
document.querySelector('#camera-clarity').addEventListener('change', event => setCameraClarity(event.target.value));
const cameraFlipToggle = document.querySelector('#camera-flip-toggle');
cameraFlipToggle.checked = localStorage.getItem('mirror.camera-flip') === 'true';
function setCameraFlip(flipped) {
  localStorage.setItem('mirror.camera-flip', String(flipped));
  cameraFlipToggle.checked = flipped;
  showGesture(flipped ? 'Camera flipped · restarting' : 'Camera upright · restarting');
  setTimeout(() => location.reload(), 600);
}
cameraFlipToggle.addEventListener('change', () => setCameraFlip(cameraFlipToggle.checked));
elements.cameraMount.addEventListener('change', () => {
  const mount = elements.cameraMount.value === 'center' ? 'center' : 'top';
  localStorage.setItem('mirror.camera-mount', mount);
  setTrackingOptions({ mount });
  showGesture(mount === 'top' ? 'Top-mounted camera profile selected' : 'Centered camera profile selected');
});
elements.citySelect.addEventListener('change', () => {
  const request = dashboard.setCity(elements.citySelect.value);
  if (dashboard.citySessionOnly) showGesture('Weather city changed for this session. The preference could not be saved.');
  void request;
});
initSettingsSections(elements.settings);
// Behind one-way glass, black is the mirror and any lit pixel is light leaking
// through; clothes are placed on the reflection instead of the camera picture.
const screenWidthInput = document.querySelector('#screen-width-cm');
screenWidthInput.value = localStorage.getItem('mirror.screen-width-cm') || '51';
const glassSize = document.querySelector('#glass-size'), glassNudge = document.querySelector('#glass-nudge');
glassSize.value = localStorage.getItem('mirror.glass-size') || '100';
glassNudge.value = localStorage.getItem('mirror.glass-nudge') || '0';
function applyGlassGeometry() {
  const widthCm = Math.min(200, Math.max(20, Number(screenWidthInput.value) || 51));
  garmentOverlay.setReflection({ enabled: elements.shell.dataset.glassProfile !== 'monitor', screenWidthCm: widthCm, mount: elements.cameraMount.value === 'center' ? 'center' : 'top', sizePercent: Number(glassSize.value) || 100, nudgeYPercent: Number(glassNudge.value) || 0 });
}
for (const [input, key] of [[glassSize, 'mirror.glass-size'], [glassNudge, 'mirror.glass-nudge']]) input.addEventListener('input', () => { localStorage.setItem(key, input.value); applyGlassGeometry(); });
applyGlassGeometry();
screenWidthInput.addEventListener('change', () => { localStorage.setItem('mirror.screen-width-cm', screenWidthInput.value); applyGlassGeometry(); showGesture('Mirror size saved'); });
elements.cameraMount.addEventListener('change', applyGlassGeometry);
elements.glassProfile.addEventListener('change', () => {
  const profile = ['night', 'monitor'].includes(elements.glassProfile.value) ? elements.glassProfile.value : 'glass';
  elements.shell.dataset.glassProfile = profile;
  localStorage.setItem('mirror.glass-profile', profile);
  applyGlassGeometry();
  showGesture({ glass: 'One-way mirror · pure black', night: 'One-way mirror · night calm', monitor: 'Plain monitor · camera picture shown' }[profile]);
});
elements.arEffect.addEventListener('change', () => setArEffect(elements.arEffect.value));
elements.effectGrid.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-effect]');
  if (chip) setArEffect(chip.dataset.effect);
});
elements.watchLoad.addEventListener('click', loadWatchVideo);
elements.watchUrl.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229 && !event.repeat && !event.defaultPrevented) void loadWatchVideo(); });
const spotifyDevicePicker = new SpotifyDevices({ select: elements.spotifyDeviceSelect, use: elements.spotifyDeviceUse,
  refresh: elements.spotifyDeviceRefresh, status: elements.spotifyDeviceStatus, bridge: window.mirrorBridge,
  onTransfer: () => refreshSpotify() });
window.__mirrorDebug.spotifyDevicePicker = spotifyDevicePicker;
let spotifySnapshot = null;
let spotifyLastFetchedAt = 0;
let spotifyLastRefreshAttemptAt = 0;
let spotifyRefreshBusy = false;
function renderSpotifyStatus(message) { elements.spotifyStatus.textContent = message; }
function clearSpotifyControls() {
  const focused = document.activeElement;
  const restoreFocus = focused === elements.spotifyTrackLink || focused === elements.spotifyPlay || focused?.matches?.('[data-spotify-action]');
  spotifyDevicePicker.clear();
  spotifySnapshot = null;
  elements.spotifyPlay.disabled = true;
  elements.spotifyCover.hidden = true;
  elements.spotifyCover.removeAttribute('src');
  elements.spotifyTrackLink.hidden = true;
  elements.spotifyTrackLink.dataset.url = '';
  elements.spotifyTrackLink.dataset.uri = '';
  elements.spotifyTitle.textContent = 'Nothing playing';
  elements.spotifyArtist.textContent = 'Playback unavailable';
  elements.spotifyAlbum.textContent = 'Spotify ambient player';
  elements.spotifyDevice.textContent = '';
  elements.spotifyProgress.value = '0';
  document.querySelectorAll('[data-spotify-action]').forEach(button => { button.disabled = true; });
  if (restoreFocus) document.querySelector('#spotify-open-app')?.focus({preventScroll:true});
}

async function refreshSpotify() {
  if (spotifyRefreshBusy || !window.mirrorBridge?.spotifyStatus) return;
  spotifyRefreshBusy = true;
  spotifyLastRefreshAttemptAt = performance.now();
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
    spotifyLastFetchedAt = performance.now();
    const item = snapshot.item;
    elements.spotifyTitle.textContent = item?.name || 'Nothing playing';
    elements.spotifyArtist.textContent = item?.artists?.join(' · ') || (snapshot.source === 'windows-native' ? 'Open Spotify app on this PC and start a song' : 'Start playback in Spotify on a connected device');
    elements.spotifyAlbum.textContent = item?.album || 'Spotify ambient player';
    elements.spotifyDevice.textContent = snapshot.device ? `${snapshot.isPlaying ? 'Playing on' : 'Device:'} ${snapshot.device}` : '';
    const art = item?.imageUrl;
    const safeArt = Boolean(art && (/^https:\/\//i.test(art) || (snapshot.source === 'windows-native' && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(art) && art.length < 1500000)));
    if (safeArt) {
      if (elements.spotifyCover.getAttribute('src') !== art) elements.spotifyCover.src = art;
    } else if (elements.spotifyCover.hasAttribute('src')) elements.spotifyCover.removeAttribute('src');
    elements.spotifyCover.hidden = !safeArt || Boolean(elements.spotifyCover.complete && elements.spotifyCover.naturalWidth === 0);
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
elements.spotifyCover.addEventListener('error', () => {
  if (elements.spotifyCover.complete && elements.spotifyCover.naturalWidth === 0) elements.spotifyCover.hidden = true;
});
document.querySelector('#spotify-open-app').addEventListener('click', async () => {
  try { await openServiceFrame('spotify'); } catch (error) { renderSpotifyStatus(error.message); }
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
function tickSpotify() {
  if (document.hidden || sleeping) return;
  if (mode === 'spotify' && performance.now() - spotifyLastRefreshAttemptAt >= 8000) void refreshSpotify();
  if (mode === 'spotify' && spotifySnapshot?.isPlaying && spotifySnapshot.durationMs) {
    const progress = Math.min(spotifySnapshot.durationMs, (spotifySnapshot.progressMs || 0) + Math.max(0, performance.now() - spotifyLastFetchedAt));
    elements.spotifyProgress.value = String(progress);
  }
}
const spotifyTimer = setInterval(tickSpotify, 1000);
window.addEventListener('beforeunload', () => clearInterval(spotifyTimer));
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
    if(['load','play'].includes(command.action)){const control=beginUserControl();if(control.wait)await control.wait;if(!control.current())throw new Error('Cast request superseded by a newer choice.');}
    if (command.action === 'load') { watchLoadGeneration += 1; youtubePlayer.detach(); }
    await castPlayer.command(command);
    if (command.action === 'load') {
      elements.watchPanel.dataset.casting = 'true';
      elements.castingStatus.textContent = 'Media connected · use your phone to play, pause, seek, or adjust volume.';
    }
    await window.mirrorBridge.completeCastCommand({ id: command.id });
  } catch (error) { await window.mirrorBridge.completeCastCommand({ id: command.id, error: error.message }).catch(() => {}); }
});
const removePhoneMediaListener = window.mirrorBridge?.onPhoneMedia?.(async (url) => {
  const control=beginUserControl();if(control.wait)await control.wait;if(!control.current())return;
  elements.watchUrl.value = url;
  setAssistantMode('watch');
  await loadWatchVideo();
  if(control.current())showGesture('Phone sent a media link');
});
document.querySelectorAll('[data-service]').forEach((button) => button.addEventListener('click', async () => {
  const service=button.dataset.service,label=button.textContent,control=beginUserControl();if(control.wait)await control.wait;if(!control.current())return;
  manualDesktopRequest=control;
  try {
    await openServiceFrame(service);
    if(control.current())showGesture(`Opening ${label}`);
  } catch (error) {
    if(control.current())showOracle(error.message, '', 'Service launcher');
  } finally {if(manualDesktopRequest===control)manualDesktopRequest=null;}
}));
elements.assistantTaskForm.addEventListener('submit', event => {
  event.preventDefault();
  const prompt = elements.assistantTaskInput.value.trim();
  if (!prompt) return;
  if (hardMuted) { showOracle('Unmute the mirror before starting an assistant task.', '', 'Hard muted'); return; }
  if (agentRunId) { showOracle('The current task is still running. Use Stop before starting another.', '', 'Task in progress'); return; }
  elements.assistantTaskInput.value = '';
  popupPanels.closePanel(elements.launcherPanel);
  void askMirror(prompt);
});

elements.quickNoteInput.value = localStorage.getItem('mirror.quick-note') || '';
elements.quickNoteForm.addEventListener('submit', (event) => {
  event.preventDefault();
  saveQuickNote(elements.quickNoteInput.value.trim());
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
  setFaceDetail(elements.facePuppetToggle.checked);
  syncFaceRate();
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
      return { result: `${job.garmentName} was rendered. Ask the user to review the look in the studio.`, userMessage: `${job.garmentName} was rendered. Take a look in Try On.` };
    } else {
      elements.tryOnStatus.textContent = job?.providerConfigured ? `Provider returned no preview · job ${job.id}` : job?.previewOnly ? 'Browser preview complete. Nothing was saved or uploaded.' : 'Frame saved locally. Configure a try-on renderer to generate the outfit preview.';
      showOracle(job?.providerConfigured ? 'The try-on provider completed without an image preview.' : job?.previewOnly ? 'Browser preview completed with one in-memory frame. Nothing was saved or uploaded.' : 'Your selected garment and one consented frame are saved locally. No provider is configured yet.', '', 'Try-on prepared');
      return { result: job?.providerConfigured ? 'The rendering provider completed without an outfit image preview.' : 'No rendered outfit image is available. Rendering is not configured.', providerConfigured: Boolean(job?.providerConfigured), userMessage: 'There’s no rendered preview to show. You can use the live camera fit.' };
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
  if (!query) return { result: 'Ask which garment to try on.', userMessage: 'Which garment would you like to try on?' };
  const { item, choices } = matchGarment(closet.items, query);
  if (!item && choices.length) return { result: 'Several closet items match. Ask which one to try on.', userMessage: `Which one: ${choices.slice(0, 4).map(candidate => candidate.name).join(', ')}?`, choices: choices.map(candidate => ({ name: candidate.name, category: candidate.category })) };
  if (!item) return { result: 'No matching item is in the local closet. Ask the user to add it or choose an existing closet item.', userMessage: 'I couldn’t find that in your wardrobe. Add a photo, or choose another garment.' };
  if (item.id !== closet.selectedId || !garmentOverlay.texture) closet.select(item.id);
  setAssistantMode('ar');
  if (!renderStill) {
    if (liveAIActive) return { result: `Selected ${item.name} for the consented live AI session. Check current mirror state before claiming the outfit is visible.`, userMessage: `${item.name} is selected. Check the camera view for the update.`, liveAI: liveTryOn.snapshot() };
    setTryOnView('live');
    const ready = await garmentSelection;
    if (closet.selectedId !== item.id) return { result: 'The garment selection changed while loading. Use the current mirror state before continuing.' };
    const liveFit = garmentOverlay.getLiveState();
    const userMessage = !ready ? garmentOverlay.imageMessage || 'I couldn’t load that garment photo. Try another garment, or add the photo again.'
      : liveFit.visible ? `${item.name} is on the mirror.`
      : !liveFit.cameraActive ? `${item.name} is selected. Turn on the camera to see your fit.`
      : liveFit.trackingReady === false ? `${item.name} is selected. The camera fit is getting ready.`
      : !liveFit.bodyDetected ? `${item.name} is selected. Step back so your body is in view.`
      : `${item.name} is selected.`;
    return { result: ready ? `Selected ${item.name} for a local live camera fit. ${liveFit.status} Body tracking estimates placement; it does not simulate fabric or measure size. No frame was saved or uploaded.` : garmentOverlay.imageMessage || 'The garment image is not ready for live fit.', userMessage, liveFit };
  }
  if (!config.hasTryOnProvider) return { result: `Selected ${item.name}, but no rendering provider is configured. Do not claim a try-on was rendered.`, userMessage: `${item.name} is selected. Photo rendering isn’t connected; live camera fitting is available.` };
  if (!elements.tryOnConsent.checked) {
    setStudioToolsOpen(true);
    elements.tryOnConsent.focus();
    showOracle(`I selected ${item.name}. Confirm the consent box in Try On, then ask me to render it.`, '', 'Consent needed');
    return { result: `Selected ${item.name}. Ask the user to confirm the consent box in the Try On panel, then they can ask you to render it.`, userMessage: `I selected ${item.name}. Confirm photo-sharing in Try On, then ask me to render it.` };
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

function setWardrobePanelOpen(open) {
  const panel=document.querySelector('#studio-wardrobe'),button=document.querySelector('#studio-wardrobe-toggle');
  panel.hidden=!open;button.setAttribute('aria-expanded',String(Boolean(open)));button.textContent=open?'Done':'Wardrobe';elements.shell.dataset.wardrobeOpen=String(Boolean(open));
}
document.querySelector('#studio-wardrobe-toggle').addEventListener('click',()=>setWardrobePanelOpen(document.querySelector('#studio-wardrobe').hidden));
document.querySelector('#studio-camera-toggle').addEventListener('click',()=>elements.cameraToggle.click());

function setStudioToolsOpen(open) {
  if(open)setWardrobePanelOpen(true);
  elements.studioTools.hidden = !open;
  elements.studioToolsToggle.setAttribute('aria-expanded', String(open));
  elements.studioToolsToggle.textContent = open ? 'Hide tools' : 'Show tools';
}

function localFitSummary(message = garmentOverlay.lastStatus) {
  const name = garmentOverlay.item?.name;
  const status = message || 'Turn on the camera to see your live fit.';
  if (!name) return message || 'Choose a garment to see your live fit.';
  return status.startsWith(`Loading ${name} for live fit`) || status.startsWith(`Live fit · ${name}`)
    ? status : `${name} · ${status}`;
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
    : localFitSummary();
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
function cancelCameraCaptures() {
  if (experience.capturing) experience.cancel();
  if (closet.photo.capturePending) closet.photo.cancelWork();
}
elements.cameraToggle.addEventListener('click', async () => {
  const enable = !getTrackingStatus().cameraActive;
  cameraIdlePaused = false; // an explicit choice always wins over the idle pause
  if (!enable) { cancelCameraCaptures(); liveTryOn.stop(); }
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
document.querySelector('#save-diagnostics').addEventListener('click', async event => {
  const button = event.currentTarget, status = document.querySelector('#diagnostics-status');
  button.disabled = true; status.textContent = 'Preparing report…';
  try {
    const result = await window.mirrorBridge.saveDiagnostics(getMirrorState());
    status.textContent = result.saved ? 'Diagnostic report saved.' : 'Export canceled.';
  } catch { status.textContent = 'Could not save diagnostics. Try another folder.'; }
  finally { button.disabled = false; }
});
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
    if (agentRunId || desktopActive || state !== 'ready' || !['mirror', 'portal'].includes(mode) || gemini.listening || closet.photo.open || experience.dialog.open || experience.capturing || experience.routineActive ||
        elements.settings.classList.contains('open') || elements.personaPanel.classList.contains('open') ||
        elements.launcherPanel.classList.contains('open')) return;
    sleeping = true;
    galleryEpoch++;
    syncAmbienceContext();
    resumeRendering();
    cameraWasActiveBeforeSleep = getTrackingStatus().cameraActive;
    elements.shell.dataset.sleeping = 'true';
    gestures.setEnabled(false);
    if (cameraWasActiveBeforeSleep) void toggleCamera(false);
  }, 180000);
}

// Privacy. Say plainly what is being recorded and release devices that are not
// needed: the camera is only for tracking/try-on, and a live conversation ends
// on its own after a quiet stretch. The wake-word microphone is on-device only
// (switch it off in Settings to disable all listening).
function updatePrivacyChip() {
  const live = Boolean(gemini?.listening || browserRecognition);
  const wakeOn = !hardMuted && elements.wakeToggle.checked && !live && Boolean(wake.enabled && wake.processor && wake.stream?.active && !wake.assistantActive);
  const mic = document.querySelector('#privacy-mic'), cam = document.querySelector('#privacy-cam');
  if (!mic || !cam) return;
  const level = hardMuted ? 'off' : live ? 'cloud' : wakeOn ? 'device' : voiceStarting ? 'pending' : 'off';
  if(mic.dataset.level!==level)mic.dataset.level = level;
  const micLabel=mic.querySelector('b'),micText={off:'Mic off',device:'Mic · wake word, on this device',pending:'Microphone requested',cloud:gemini?.listening?'Mic · live, sent to Gemini':'Mic · browser speech recognition'}[level];
  const compactMic={off:'Mic off',device:'Mic · wake',pending:'Mic requested',cloud:gemini?.listening?'Mic · Gemini':'Mic · browser'}[level];
  if(micLabel.textContent!==compactMic){micLabel.textContent=compactMic;mic.setAttribute('aria-label',micText);}
  const cameraOn = Boolean(getTrackingStatus().cameraActive);
  const cameraLevel=cameraOn?'on':'off';
  if(cam.dataset.level!==cameraLevel)cam.dataset.level=cameraLevel;
  const camLabel=cam.querySelector('b'),camText=cameraOn?'Camera on · stays on device':'Camera off';
  const compactCam=cameraOn?'Camera on':'Camera off';
  if(camLabel.textContent!==compactCam){camLabel.textContent=compactCam;cam.setAttribute('aria-label',camText);}
}
async function restoreCameraAfterIdle() {
  if (!cameraIdlePaused) return;
  cameraIdlePaused = false;
  if (!hardMuted || true) { await toggleCamera(true).catch(() => {}); updateTrackingUi(); updatePrivacyChip(); }
}
// Always-on installation care: drift the static furniture by a few pixels so
// no element sits on the same pixels for hours (panel burn-in), and dim the
// whole picture late at night so a lit mirror does not glare in a dark room.
function applyPanelCare() {
  const minute = Math.floor(Date.now() / 60000), hour = new Date().getHours();
  const wander = (seed, range) => Math.round(Math.sin(minute * .37 + seed) * range);
  elements.shell.style.setProperty('--shift-x', `${wander(0, 6)}px`);
  elements.shell.style.setProperty('--shift-y', `${wander(2.1, 6)}px`);
  const night = (hour >= 22 || hour < 6) && localStorage.getItem('mirror.auto-dim') !== 'false';
  if (night) elements.shell.dataset.dim = 'night'; else delete elements.shell.dataset.dim;
}
applyPanelCare();
const panelCareTimer = setInterval(applyPanelCare, 60000);
window.addEventListener('beforeunload', () => clearInterval(panelCareTimer));
const privacyTimer = setInterval(() => {
  const quiet = Date.now() - lastVoiceActivity;
  if (gemini.listening && state === 'listening' && quiet > 45000 && !agentRunId) { void stopAssistant(); showGesture('Listening paused · say “mirror mirror”'); }
  if (!sleeping && !cameraIdlePaused && mode === 'mirror' && !desktopActive && !gemini.listening && state === 'ready' && quiet > 30000 && getTrackingStatus().cameraActive) {
    cameraIdlePaused = true; void toggleCamera(false).then(() => updateTrackingUi());
  }
  updatePrivacyChip();
}, 2000);
window.addEventListener('beforeunload', () => clearInterval(privacyTimer));

async function wakeFromSleep() {
  void restoreCameraAfterIdle();
  if (!sleeping) return;
  sleeping = false;
  void displayGallery();
  delete elements.shell.dataset.sleeping;
  syncAmbienceContext();
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
  if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
  if (/input|select|textarea/i.test(event.target.tagName) || event.target.isContentEditable) return;
  if (event.key === '1') void requestUserMode('portal');
  if (event.key === '2') void requestUserMode('mirror');
  if (event.key === '3') void requestUserMode('ar');
  if (event.key === '4') void requestUserMode('watch');
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
const motionStyleValues = new Map();
function setMotionStyle(name,value) {
  if(motionStyleValues.get(name)===value)return;
  elements.shell.style.setProperty(name,value);
  motionStyleValues.set(name,value);
}
function animate() {
  animationFrame = null;
  animationTimer = null;
  if (document.hidden || sleeping) {
    renderBudget.shouldRender(performance.now(), { hidden: document.hidden, sleeping });
    animationTimer = setTimeout(animate, 500);
    return;
  }
  // The ambient mirror has nothing to animate (the clock is DOM text): wake the
  // frame loop ~15 times a second instead of 60. Every wake costs main-thread
  // and compositor time, which a fanless stick would rather not spend.
  const ambientIdle = mode === 'mirror' && !desktopActive && !elements.shell.dataset.magicCue && !elements.awakening.classList.contains('active');
  if (ambientIdle) animationTimer = setTimeout(() => { animationTimer = null; animationFrame = requestAnimationFrame(animate); }, 64);
  else animationFrame = requestAnimationFrame(animate);
  if (!renderBudget.shouldRender(performance.now(), { hidden: false, sleeping: false, mode, depthEnabled:depthEnabled&&mode!=='mirror', avatarVisible: avatar.visible,motionFps:Math.min(motionQuality.motionFps,requestedMotionFps()) })) return;
  const frameStartedAt = performance.now();
  // Resize before the visible portrait paints, avoiding an empty compositor frame.
  if (avatar.visible) avatar.faceHost?.setRenderScale(motionQuality.avatarScale);
  const frameDelta = clock.getDelta();
  const dt = Math.min(frameDelta, 0.05);
  const elapsed = clock.elapsedTime;
  // Shell geometry is maintained by resize events rather than per-frame reads.
  const viewport = viewportSize();
  const viewer = updateHeadTracking(performance.now());
  // Re-centre on the person: the host eases toward where the viewer stands,
  // ignoring small sways (dead zone) and moving slowly enough to feel calm.
  {
    const raw = viewer.x, dead = .12, outside = Math.abs(raw) < dead ? 0 : (raw - Math.sign(raw) * dead);
    const wants = followMe && mode === 'portal' && elements.shell.dataset.avatarPosition === 'center' && getTrackingStatus().faceDetected;
    followX += ((wants ? Math.max(-1, Math.min(1, outside)) : 0) - followX) * (1 - Math.exp(-dt / .9));
    setMotionStyle('--follow-x', `${Math.round(followX * viewport.width * .22)}px`);
    depthScene.setAvatarFollow(followX * .5);
  }
  if (depthEnabled) {
    setMotionStyle('--viewer-x', `${Math.round(viewer.x * 42)}px`);
    setMotionStyle('--viewer-y', `${Math.round(viewer.y * 30)}px`);
  } else {
    setMotionStyle('--viewer-x', '0px');
    setMotionStyle('--viewer-y', '0px');
  }
  gestures.update(performance.now());
  if (depthEnabled) applyOffAxisProjection(camera, viewer);
  else {
    applyFlatProjection(camera, viewport.width / Math.max(viewport.height, 1));
  }
  if ((depthEnabled&&mode!=='mirror') || sceneBudget.dirty || elements.awakening.classList.contains('active')) depthScene.update(dt, elapsed, depthEnabled ? viewer : { x: 0, y: 0, z: 1 });
  if (depthEnabled && mode!=='mirror' && elapsed - cubeContentTick > 1) {
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
  framing.update({ mode, desktopActive, sleeping, liveAI: Boolean(liveTryOn.session), rendered: tryOnView !== 'live', editorOpen: closet.photo.open || experience.dialog.open });
  updateGestureHold();
  // Canvas resizing clears its backing store. Adapt before drawing so the
  // compositor never sees the empty surface between animation frames.
  updateRenderQuality(frameDelta, viewport);
  if (sceneBudget.shouldRender({ hidden: document.hidden, sleeping, depthEnabled:depthEnabled&&mode!=='mirror', awakening: elements.awakening.classList.contains('active'), mode, now: performance.now() })) renderer.render(scene, camera);
  if (motionQuality.observe({ dt: frameDelta, workMs: performance.now()-frameStartedAt, requestedFps: requestedMotionFps(), active: avatar.visible && mode !== 'mirror' && mode !== 'ar' })) syncAdaptiveQuality();
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
  motionQuality.resetWindow();
  sceneBudget.invalidate();
  if (animationFrame !== null) cancelAnimationFrame(animationFrame);
  if (animationTimer !== null) clearTimeout(animationTimer);
  renderBudget.reset();
  clock.getDelta();
  animate();
}
document.addEventListener('visibilitychange', resumeRendering);
let displayCadenceVersion=0;
function acceptDisplayCadence(frequency) {
  const next=displayMotionRate(frequency);if(next===displayMotionFps)return;
  displayMotionFps=next;syncAdaptiveQuality();resumeRendering();
}
const removeDisplayCadenceListener=window.mirrorBridge?.onDisplayCadence?.(frequency=>{displayCadenceVersion++;acceptDisplayCadence(frequency)});
const initialCadenceVersion=displayCadenceVersion;
void window.mirrorBridge?.getDisplayCadence?.().then(frequency=>{if(displayCadenceVersion===initialCadenceVersion)acceptDisplayCadence(frequency)}).catch(()=>{});
window.addEventListener('pointerdown', resumeRendering);
window.addEventListener('keydown', resumeRendering);
window.addEventListener('beforeunload', () => {
  removeDisplayCadenceListener?.();
  cancelModeRestore();
  displayCadenceVersion++;
  hideSearchResult();
  if (animationFrame !== null) cancelAnimationFrame(animationFrame);
  if (animationTimer !== null) clearTimeout(animationTimer);
});

function updateDiagnostics() {
  const write = (element, text) => { if (element.textContent !== text) element.textContent = text; };
  const tracking = getTrackingStatus();
  const blends = getFaceBlendshapes() || {};
  const gaze = getEyeGaze() || {};
  write(elements.diagRender, `${Math.round(renderQuality.fps)} fps · ${renderQuality.pixelRatio.toFixed(2)}× DPR`);
  write(elements.diagTracking, tracking.faceDetected ? 'Face lock' : tracking.cameraActive ? 'Searching' : 'Mouse fallback');
  const avatarVideo = avatar.getAvatarVideoStatus();
  const hostSource = avatarVideo.active
    ? `video · ${avatarVideo.state}${avatarVideo.width ? ` · ${avatarVideo.width}×${avatarVideo.height}` : ''}`
    : `${avatar.persona || 'velora'} · ${avatar.renderStyle==='rig'?'3D face':avatar.faceHost?'portrait':'loading'}`;
  write(elements.diagRig, hostSource);
  write(elements.diagBlendshapes, `${Object.keys(blends).length} channels`);
  write(elements.diagGaze, gaze.confidence ? `${Math.round(gaze.confidence * 100)}% confidence` : 'No gaze lock');
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
  // Resize events can land between animation frames: repaint synchronously.
  if (!document.hidden && !sleeping) renderer.render(scene, camera);
  arOverlay.resize();
  garmentOverlay.resize();
});

window.addEventListener('beforeunload', () => { ambience.destroy(); removePhoneMediaListener?.(); removeCastCommandListener?.(); watchAvatarLayout.destroy(); watchAudioDucking.destroy(); castPlayer.destroy(); youtubePlayer.destroy(); removeDesktopListener?.(); garmentOverlay.destroy(); wake.destroy(); gemini.disconnect(); });

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
  return watchPlayback.command(action, action==='volume'?args.volume:args.seconds === undefined ? 15 : Number(args.seconds));
}

// Apps live in the mirror's own frame so the mirror never loses the screen.
async function openServiceFrame(service) {
  // Stop, mute, a new voice session or a manual choice made while the launcher
  // lookup was pending retires this request; it must not take over the screen.
  const voice = voiceStartGeneration, control = manualControlGeneration;
  const info = await window.mirrorBridge.openService(service);
  if (voice !== voiceStartGeneration || control !== manualControlGeneration) return { cancelled: true };
  // Choosing an app retires an assistant page that is still loading, which
  // would otherwise open over it later.
  if (manualDesktopRequest?.page) { manualDesktopRequest = null; void window.mirrorBridge.closeDesktop?.()?.catch(() => {}); }
  return showUrlInFrame(info);
}
// Assistant-opened pages share the manual-request slot so a later manual choice
// closes (and so cancels) a page that is still loading. `current` is false when
// the request was superseded, stopped or muted, so its outcome stays silent.
async function openDesktopPage(url) {
  const token = { page: true }, voice = voiceStartGeneration, control = manualControlGeneration;
  manualDesktopRequest = token;
  const current = () => manualDesktopRequest === token && voice === voiceStartGeneration && control === manualControlGeneration;
  try {
    const result = await window.mirrorBridge.openWebpage(url);
    return { result, current: current() };
  } catch (error) { return { error, current: current() }; }
  finally { if (manualDesktopRequest === token) manualDesktopRequest = null; }
}

async function showUrlInFrame(info) {
  if (!info?.url) return info;
  try { if (new URL(info.url).protocol !== 'https:') throw new Error('Only https pages can open inside the mirror.'); }
  catch (error) { throw new Error(error.message || 'That link cannot be shown.'); }
  const generation = ++watchLoadGeneration;
  castPlayer.detach(); youtubePlayer.detach();
  elements.watchVideo.pause(); elements.watchVideo.removeAttribute('src'); elements.watchVideo.classList.remove('loaded');
  setAssistantMode('watch');
  if (generation !== watchLoadGeneration) return { cancelled: true };
  elements.watchFrame.src = info.url;
  elements.watchFrame.classList.add('loaded', 'app');
  elements.watchPlaceholder.classList.add('hidden');
  return { ok: true, target: 'mirror-frame', url: info.url };
}

// ---- Timers: spoken countdowns shown as chips; the bell respects hard mute.
const timerChip = document.querySelector('#timer-chip');
let timerTick = null;
const timerNodes = new Map();
function renderTimers(list) {
  timerChip.hidden = list.length === 0;
  const active = new Set(list.map(item => item.id));
  for (const id of timerNodes.keys()) if (!active.has(id)) timerNodes.delete(id);
  const nodes = list.map(item => {
    let chip = timerNodes.get(item.id);
    if (!chip) { chip = document.createElement('span'); timerNodes.set(item.id, chip); }
    const text = `${item.label ? item.label + ' · ' : ''}${formatRemaining(item.remainingMs)}`;
    if (chip.textContent !== text) chip.textContent = text;
    return chip;
  });
  if (nodes.length !== timerChip.childNodes.length || nodes.some((node,index) => node !== timerChip.childNodes[index])) timerChip.replaceChildren(...nodes);
  if (list.length && timerTick === null) timerTick = setInterval(() => { if (!document.hidden) renderTimers(mirrorTimers.list()); }, 1000);
  else if (!list.length && timerTick !== null) { clearInterval(timerTick); timerTick = null; }
}
let bellContext = null;
let bellGeneration = 0;
let bellWanted = false;
const bellNodes = new Set();
function stopBell() {
  bellGeneration++;
  bellWanted=false;
  for(const {osc,gain} of bellNodes){try{osc.stop();}catch{}try{osc.disconnect();}catch{}try{gain.disconnect();}catch{}}
  bellNodes.clear();
  if(bellContext?.state==='running')void bellContext.suspend().catch(()=>{});
}
async function ringBell() {
  stopBell();
  if (hardMuted) return;
  bellWanted=true;
  const generation = bellGeneration;
  try {
    bellContext ||= new AudioContext(); await bellContext.resume();
    if(generation!==bellGeneration||hardMuted){
      if(!bellWanted||hardMuted)void bellContext.suspend().catch(()=>{});
      return;
    }
    const now = bellContext.currentTime;
    [660, 880, 1100].forEach((frequency, index) => {
      const osc = bellContext.createOscillator(), gain = bellContext.createGain();
      const nodes={osc,gain};bellNodes.add(nodes);
      osc.onended=()=>{
        if(!bellNodes.delete(nodes))return;
        osc.disconnect();gain.disconnect();
        if(!bellNodes.size&&generation===bellGeneration){bellWanted=false;void bellContext.suspend().catch(()=>{});}
      };
      osc.type = 'sine'; osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now + index * .18);
      gain.gain.linearRampToValueAtTime(.18, now + index * .18 + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, now + index * .18 + 1.2);
      osc.connect(gain).connect(bellContext.destination); osc.start(now + index * .18); osc.stop(now + index * .18 + 1.3);
    });
  } catch {if(generation===bellGeneration)stopBell();}
}
const mirrorTimers = new MirrorTimers({
  onChange: renderTimers,
  onDone: timer => {
    ringBell(); avatar.react?.('delight');
    const message = `Your ${timer.label ? timer.label + ' ' : ''}timer is done.`;
    showOracle(message, '', 'Timer'); showGesture(message);
  }
});
window.addEventListener('beforeunload', () => { mirrorTimers.destroy(); clearInterval(timerTick); stopBell();void bellContext?.close().catch(()=>{}); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderTimers(mirrorTimers.list()); });
window.__mirrorDebug.mirrorTimers = mirrorTimers;
window.__mirrorDebug.wake = wake;
window.__mirrorDebug.appendCaption = appendCaption;

// ---- Search pool: grounded answers and their sources as a dismissible card.
searchPool.root = document.querySelector('#search-pool');
function hideSearchResult() {
  cancelPendingSearch();
  clearTimeout(searchPool.timer);
  searchPool.timer = 0;
  if (searchPool.root) searchPool.root.hidden = true;
}
function scheduleSearchDismissal(renew = true) {
  if(searchPool.root.hidden)return;
  if(renew)searchPool.dismissAt=performance.now()+60000;
  if(searchPool.timer)return;
  const timer=setTimeout(()=>{
    if(searchPool.timer!==timer||searchPool.root.hidden)return;
    searchPool.timer=0;
    if(performance.now()<searchPool.dismissAt)scheduleSearchDismissal(false);
    else if(searchPool.root.contains?.(document.activeElement)||searchPool.root.matches?.(':hover'))scheduleSearchDismissal();
    else hideSearchResult();
  },Math.max(0,searchPool.dismissAt-performance.now()));
  searchPool.timer=timer;
}
function cancelPendingSearch() {
  searchPool.generation++;const id=searchPool.requestId;searchPool.requestId=null;
  if(id)void window.mirrorBridge?.cancelSearch?.(id).catch(()=>{});
}
async function searchMirror(query,{decorate=result=>result,onSuccess,onError}={}) {
  cancelPendingSearch();const generation=searchPool.generation,voice=voiceStartGeneration,control=manualControlGeneration;
  const id=crypto.randomUUID();searchPool.requestId=id;
  const current=()=>generation===searchPool.generation&&voice===voiceStartGeneration&&control===manualControlGeneration;
  try {
    const found=await window.mirrorBridge.searchWeb(query,id);
    if(!current())return {cancelled:true};
    const result=await showSearchResult(decorate(found),{retainRequest:true});
    if(!current())return {cancelled:true};
    onSuccess?.(result);return result;
  } catch(error) {
    if(!current())return {cancelled:true};
    if(onError){onError(error);return {error:error.message}}throw error;
  } finally {if(searchPool.requestId===id)searchPool.requestId=null;}
}
function showSearchResult(result,{retainRequest=false}={}) {
  if(!retainRequest)cancelPendingSearch();
  if (!result) return result;
  if (!result.answer) {
    // No grounded answer: show ordinary results inside the mirror frame.
    return showUrlInFrame({ url: result.url }).then(() => ({ result: `Showing search results for ${result.query}.`, query: result.query }));
  }
  document.querySelector('#search-pool-eyebrow').textContent = result.eyebrow || (result.fromMemory ? 'From memory · may be out of date' : 'The mirror found');
  document.querySelector('#search-pool-query').textContent = result.query;
  document.querySelector('#search-pool-answer').textContent = result.answer;
  const holder = document.querySelector('#search-pool-sources');
  const replacingFocusedSource = holder.contains?.(document.activeElement);
  holder.replaceChildren(...(result.sources || []).map(source => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = source.host; button.title = source.title;
    button.addEventListener('click', () => { hideSearchResult(); void showUrlInFrame({ url: source.url }).catch(error => showOracle(error.message, '', 'Search')); });
    return button;
  }));
  searchPool.root.hidden = false;
  if (replacingFocusedSource) document.querySelector('#search-pool-close').focus({preventScroll:true});
  searchPool.root.scrollTop = 0;
  searchPool.root.scrollLeft = 0;
  scheduleSearchDismissal();
  avatar.react?.('ponder');
  return result;
}
document.querySelector('#search-pool-close').addEventListener('click', hideSearchResult);
for(const event of ['pointerdown','pointerleave','scroll','focusin','focusout'])searchPool.root.addEventListener(event,scheduleSearchDismissal);
window.addEventListener('keydown', event => { if (event.key === 'Escape' && !event.defaultPrevented && !event.isComposing && event.keyCode !== 229) hideSearchResult(); });

async function loadWatchVideo() {
  let generation = null;
  const url = elements.watchUrl.value.trim();
  if (!url) return;
  try {
    let parsed; try { parsed = new URL(url); } catch { throw new Error('Paste a complete YouTube, Spotify, or video link beginning with https://.'); }
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Use an http(s) video URL.');
    const videoId = youtubeId(parsed);
    if (videoId && !/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error('Paste a complete YouTube video link.');
    generation = ++watchLoadGeneration;
    elements.watchFrame.classList.remove('app');
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
    if (generation !== null && generation !== watchLoadGeneration) return;
    if (generation !== null) youtubePlayer.detach();
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
  const wardrobeCommand=prompt.toLowerCase().replace(/[.,!?]/g,'').trim().match(/^(open|show|close|hide) (?:the )?(?:wardrobe|closet|fitting controls)$/);
  if(wardrobeCommand){const open=['open','show'].includes(wardrobeCommand[1]);if(open)setAssistantMode('ar');setWardrobePanelOpen(open);showGesture(open?'Wardrobe opened':'Wardrobe closed');return true;}
  const spoken = prompt.toLowerCase().replace(/[.,!?']/g, '').replace(/\s+/g, ' ').trim();
  if (/^(?:close|dismiss|hide|clear|go away|never ?mind)(?: (?:that|this|it|the (?:result|answer|card|search)))?$/.test(spoken) && (searchPool.requestId || !searchPool.root.hidden)) { hideSearchResult(); avatar.react?.('dismiss'); return true; }
  // Glanceable pop-ups. Weather reads what the dashboard already fetched;
  // news goes through grounded search; the calendar opens inside the frame.
  if (/^(?:whats|what is|hows|how is|show me|tell me)?(?: the)? ?(?:weather|forecast|temperature)(?: like)?(?: today| now| outside| right now| tomorrow)?$|^(?:do i need|should i (?:bring|take)) (?:an |a |my )?(?:umbrella|jacket|coat)$|^is it (?:cold|hot|warm|raining|going to rain)(?: outside| today)?$/.test(spoken)) {
    const read = id => document.querySelector(id)?.textContent?.trim() || '';
    const temperature = read('#weather-temp'), condition = read('#weather-condition'), advice = read('#weather-advice'), city = read('#weather-city');
    if (!temperature || temperature.startsWith('--')) { showOracle('The forecast has not reached the glass yet. Try again in a moment.', '', 'Weather'); return true; }
    showSearchResult({ grounded: true, eyebrow: 'The sky over ' + city.toLowerCase().replace(/(^| )./g, match => match.toUpperCase()), query: `${temperature} · ${condition.toLowerCase()}`, answer: advice || 'No hourly advice available.', sources: [] });
    return true;
  }
  if (/^(?:whats|what is|show me|tell me|read me)? ?(?:the )?(?:news|headlines|top stories|latest news)(?: today| for today)?$|^whats happening (?:in the world|today)$/.test(spoken)) {
    showOracle('Consulting the glass…', '', 'Headlines');
    void searchMirror('top news headlines today, three bullet-free sentences',{decorate:result=>result.grounded?{...result,eyebrow:'Headlines',query:'Today in the world'}:result,onError:error=>showOracle(error.message,'','Headlines')});
    return true;
  }
  if (/^(?:whats|what is|show me|open|check)? ?(?:on )?(?:my |the )?(?:calendar|schedule|agenda|plans)(?: today| tomorrow)?$|^what do i have (?:on |today|tomorrow|planned)/.test(spoken)) {
    const voice = voiceStartGeneration, control = manualControlGeneration, current = () => voice === voiceStartGeneration && control === manualControlGeneration;
    openServiceFrame('calendar').then(result => { if (current() && !result?.cancelled) showGesture('Your calendar'); }).catch(error => { if (current()) showOracle(error.message, '', 'Calendar'); });
    return true;
  }
  const timerCommand = parseTimerCommand(prompt);
  if (timerCommand) {
    if (timerCommand.cancel) { const count = mirrorTimers.cancelAll(); showOracle(count ? 'The timers are cleared.' : 'There are no timers running.', '', 'Timer'); return true; }
    if (timerCommand.error) { showOracle(timerCommand.error, '', 'Timer'); return true; }
    try { mirrorTimers.add(timerCommand.seconds, timerCommand.label); showGesture(`Timer set · ${formatRemaining(timerCommand.seconds * 1000)}`); avatar.react?.('smug'); }
    catch (error) { showOracle(error.message, '', 'Timer'); }
    return true;
  }
  if (/\b(?:who(?:s| is) the fairest|fairest of (?:them )?all|am i the fairest|who(?:s| is) the (?:prettiest|most beautiful))\b/.test(spoken)) {
    const answers = [
      'You, my dear, are the fairest here — but do keep your voice down. I have an image to maintain.',
      'Fairest? Flattery will get you everywhere. Today, it is you. Tomorrow, we shall see.',
      'Oh, the answer is obvious. Ask me again and I may even sound sincere.'
    ];
    const reply = answers[Math.floor(Math.random() * answers.length)];
    showAssistant(); avatar.react?.('smug'); magic.play('arrival', { muted: hardMuted });
    appendCaption('assistant', reply, { replace: true }); showOracle(reply, prompt, 'The mirror answers');
    speech.setPersona(avatar.persona || 'velora'); void speech.speak(reply).catch(() => {});
    return true;
  }
  if (experience.voice(prompt)) return true;
  const qualityCommand=prompt.toLowerCase().replace(/[.,!?]/g,'').trim();
  if(/^(?:use |show |switch to )?(?:3d (?:face|avatar)|portrait (?:face|avatar))$/.test(qualityCommand)){void applyAvatarStyle(qualityCommand.includes('3d')?'rig':'portrait');showGesture('Avatar appearance updated');return true;}
  if(/^(?:set |use |switch to )?(?:maximum detail|hd quality|balanced quality|efficient quality)$/.test(qualityCommand)) {applyDisplayQuality(/maximum|hd/.test(qualityCommand)?'hd':/efficient/.test(qualityCommand)?'eco':'auto');showGesture('Display quality updated');return true;}
  const faceCommand = prompt.toLowerCase().replace(/[.,!?]/g, '').trim();
  const expressionCommands = {
    blink: {eyeBlinkLeft:1,eyeBlinkRight:1}, 'raise an eyebrow': {browOuterUpLeft:.65},
    'look surprised': {browInnerUp:.55,eyeWideLeft:.4,eyeWideRight:.4}, smile: {mouthSmileLeft:.5,mouthSmileRight:.5,cheekSquintLeft:.18,cheekSquintRight:.18},
    'look thoughtful': {browOuterUpLeft:.4,browInnerUp:.12}, 'look at me': {},
    smirk: {mouthSmileLeft:.7,mouthSmileRight:.08,browOuterUpLeft:.35,eyeSquintLeft:.25,eyeSquintRight:.3,noseSneerLeft:.15},
    'look menacing': {browDownLeft:.55,browDownRight:.55,eyeSquintLeft:.4,eyeSquintRight:.4,mouthSmileLeft:.22,mouthSmileRight:.22,noseSneerLeft:.2,noseSneerRight:.2},
    'look angry': {browDownLeft:.7,browDownRight:.7,eyeSquintLeft:.3,eyeSquintRight:.3,noseSneerLeft:.35,noseSneerRight:.35,mouthFrownLeft:.3,mouthFrownRight:.3},
    'look amused': {mouthSmileLeft:.55,mouthSmileRight:.4,cheekSquintLeft:.3,cheekSquintRight:.25,eyeSquintLeft:.2,eyeSquintRight:.2,browOuterUpRight:.25},
    'look unimpressed': {eyeBlinkLeft:.35,eyeBlinkRight:.35,browDownLeft:.15,mouthPressLeft:.35,mouthPressRight:.35,mouthFrownLeft:.12,mouthFrownRight:.12}
  };
  if (Object.hasOwn(expressionCommands,faceCommand) || /^(?:look|glance) (?:left|right)$/.test(faceCommand)) {
    showAssistant();clearTimeout(avatarExpressionTimer);avatar.setExpression(expressionCommands[faceCommand] || {});
    if (/^(?:look|glance) (?:left|right)$/.test(faceCommand)) avatar.setGazeOverride({x:faceCommand.endsWith('left')?-1:1,y:0});
    else avatar.setGazeOverride(faceCommand==='look at me'?{x:0,y:0}:null);
    avatarExpressionTimer=setTimeout(()=>{avatar.setExpression({});avatar.setGazeOverride(null)},faceCommand==='blink'?160:1800);
    return true;
  }

  const clarity = prompt.toLowerCase().replace(/[.,!?]/g, ' ');
  if (/\b(?:camera clarity|enhance (?:the )?camera|brighten (?:the )?camera|natural camera|original camera)\b/.test(clarity)) {
    const preset = /\b(?:off|original|disable)\b/.test(clarity) ? 'off' : /\b(?:bright|brighten)\b/.test(clarity) ? 'bright' : 'natural';
    setCameraClarity(preset); return true;
  }
  if (closet.voice(prompt)) { setAssistantMode('ar'); return true; }
  if (/\b(?:return|go back) to (?:the )?mirror\b|\bclose (?:the )?(?:desktop browser|browser window)\b/i.test(prompt)) {
    window.mirrorBridge?.closeDesktop().catch((error) => showOracle(error.message, '', 'Desktop browser'));
    setAssistantMode('mirror');
    return true;
  }
  const urlMatch = prompt.match(/\b(?:open|visit|go to)\s+((?:https?:\/\/|www\.)[^\s]+)/i)
    || prompt.match(/\b(?:open|visit|go to)\s+([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/[^\s]*)?)/i);
  if (urlMatch) {
    const url = urlMatch[1].replace(/[),.!?]+$/, '');
    void openDesktopPage(/^https?:\/\//i.test(url) ? url : `https://${url}`).then(outcome => {
      if (!outcome.current) return;
      if (outcome.error) showOracle(outcome.error.message, prompt, 'Desktop browser');
      else showGesture(`Opening ${url}`);
    });
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
    showOracle('Consulting the glass…', searchMatch[1].trim(), 'Searching');
    void searchMirror(searchMatch[1].trim(),{onSuccess:()=>showGesture('The mirror has found something'),onError:error=>showOracle(error.message,'','Web search')});
    return true;
  }
  const positionMatch = text.match(/\bmove (?:yourself|your face|the face) (?:to )?(center|left|right|upper|lower)\b/);
  if (positionMatch) {
    showAssistant();
    setAvatarPosition(positionMatch[1]);
    return true;
  }
  if (/\b(?:flip|rotate)\s+(?:the\s+)?camera\b|\bcamera\s+(?:is\s+)?upside\s*down\b/.test(text)) { setCameraFlip(localStorage.getItem('mirror.camera-flip') !== 'true'); return true; }
  const ambientMusicMatch = text.match(/\b(?:show|switch to|go to|open)\s+(?:the\s+)?(?:spotify\s+)?(?:ambient\s+)?(?:music\s+)?(?:player|now playing|music mode|spotify ambient)\b|\bshow\s+(?:my\s+)?(?:spotify|music)\b/);
  if (ambientMusicMatch) { setAssistantMode('spotify'); return true; }
  const serviceMatch = text.match(/\b(?:open|show|start|launch)\s+(?:my\s+)?(calendar|photos|maps|map|spotify|music|youtube|netflix)\b/) || text.match(/\b(spotify|music)\s+(?:start|open|launch)\b/);
  if (serviceMatch) {
    const service = { map: 'maps', music: 'spotify' }[serviceMatch[1]] || serviceMatch[1];
    openServiceFrame(service)
      .then(() => showGesture(`Opening ${service === 'spotify' ? 'Music' : service.replace(/^./, (letter) => letter.toUpperCase())}`))
      .catch((error) => showOracle(error.message, '', 'Service launcher'));
    return true;
  }
  if (!/\bgoogle(?: maps)?\b/.test(text) && /\b(?:open|show|where is|where are)\s+(?:my\s+)?(?:find my|friends|family|people)\b/.test(text)) {
    if (/\b(?:friends|family|people)\b/.test(text) && !/\b(?:google|maps)\b/.test(text)) {
      const response = 'Apple’s website locates devices. Friends’ shared locations need the Find My app on an Apple device; a friends-map connection is not configured on this mirror yet.';
      appendCaption('assistant', response, { replace: true });
      showOracle(response, prompt, 'Friends map');
      return true;
    }
    openServiceFrame('findmy')
      .then(() => showGesture('Opening Apple Find Devices · sign in directly'))
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

let wardrobeReplyGeneration = 0;
function requestTryOnFromNavigation(args, prompt) {
  const request = ++wardrobeReplyGeneration;
  const voice = voiceStartGeneration;
  const control = manualControlGeneration;
  // Selection happens synchronously before image/render work awaits. Capture
  // its revision afterward, so this request owns its own selection but is
  // retired by direct closet, color, style, pointer and gesture changes too.
  const pending = handleTryOnVoice(args);
  const selection = garmentRevision;
  const current = () => !hardMuted && request === wardrobeReplyGeneration
    && voice === voiceStartGeneration && control === manualControlGeneration
    && selection === garmentRevision;
  return pending.then((result) => {
    if (!current()) return;
    const answer = result?.error || result?.userMessage || result?.result || 'Try-on request handled.';
    appendCaption('assistant', answer);
    showOracle(answer, prompt, 'Try-on');
    if (!config.hasGeminiKey) speech.speak(answer);
  }).catch((error) => {
    if (current()) showOracle(error.message, prompt, 'Try-on');
  });
}

function handleGesture(type) {
  const task=dispatchGesture(type),voice=voiceStartGeneration,control=manualControlGeneration;
  void task.catch(error=>{if(voice===voiceStartGeneration&&control===manualControlGeneration)showGesture(error.message);});
}

async function dispatchSpotifyGesture(type,currentRequest=()=>true) {
  try{
  if(!currentRequest())return {cancelled:true};
  let playing = false;
  if (type === 'pinch') {
    const current = await window.mirrorBridge.spotifyCurrent();
    if(!currentRequest())return {cancelled:true};
    if (current.error) throw new Error(current.error);
    if (!current.connected || typeof current.isPlaying !== 'boolean') throw new Error('Connect Spotify in Music before using playback gestures.');
    playing = current.isPlaying;
  }
  const action = type === 'pinch' ? playing ? 'pause' : 'play' : type === 'swipe-left' ? 'next' : 'previous';
  await window.mirrorBridge.spotifyControl(action);
  if(!currentRequest())return {cancelled:true};
  await refreshSpotify();
  if(!currentRequest())return {cancelled:true};
  showGesture({ play: 'Play requested', pause: 'Pause requested', next: 'Next track requested', previous: 'Previous track requested' }[action]);
  }catch(error){if(!currentRequest())return {cancelled:true};throw error;}
}

async function dispatchGesture(type) {
  const initialVoice=voiceStartGeneration,initialControl=manualControlGeneration;
  let gestureCurrent=()=>initialVoice===voiceStartGeneration&&initialControl===manualControlGeneration;
  if (type === 'palm' && (agentRunId || experience.capturing || experience.routineActive)) { stopAssistant(); return; }
  if(['swipe-left','swipe-right','swipe-up','swipe-down'].includes(type)||type==='pinch'&&(desktopActive||['ar','watch','spotify'].includes(mode)||experience.dialog?.open||experience.capturing||closet.photo.open)){const control=beginUserControl();if(control.wait)await control.wait;if(!control.current())return;const voice=voiceStartGeneration;gestureCurrent=()=>control.current()&&voice===voiceStartGeneration;}
  if (experience.gesture(type)) return;
  if (type !== 'palm' && closet.photo.gesture(type)) return;
  if (type === 'palm') {
    if (voiceStarting || gemini.listening || browserRecognition || speech.isSpeaking || ['thinking', 'speaking'].includes(state) || elements.awakening.classList.contains('active')) {
      stopAssistant();
      return;
    }
    if (desktopActive) {
      await window.mirrorBridge.closeDesktop();
      if(!gestureCurrent())return;
      showGesture('Open palm · return to mirror');
    } else {
      setAssistantMode('portal');
      showGesture('Open palm · Converse');
    }
    return;
  }
  if (desktopActive) {
    if (desktopKind === 'native' && desktopLabel === 'Spotify' && ['pinch', 'swipe-left', 'swipe-right'].includes(type)) {
      await dispatchSpotifyGesture(type,gestureCurrent); return;
    }
    if (['swipe-up', 'swipe-down'].includes(type)) {
      // Dragging content upward reveals the next portion of the page.
      const result = await window.mirrorBridge.scrollDesktopGesture(type === 'swipe-up' ? 'down' : 'up');
      if(!gestureCurrent())return;
      showGesture(result?.result || 'Scroll requested');
    } else showGesture('Swipe up/down to scroll · hold palm to return');
    return;
  }
  if (mode === 'spotify' && ['pinch', 'swipe-left', 'swipe-right'].includes(type)) {
    await dispatchSpotifyGesture(type,gestureCurrent); return;
  }
  if (mode === 'watch' && ['pinch', 'swipe-left', 'swipe-right'].includes(type)) {
    const action = type === 'pinch' ? watchPlayback.snapshot().playing ? 'pause' : 'play' : 'seek';
    const result = await watchPlayback.command(action, type === 'swipe-left' ? 15 : -15);
    if(!gestureCurrent())return;
    showGesture(result.result || 'Playback command sent');
    return;
  }
  if (mode === 'ar' && closet.items.length && ['swipe-left', 'swipe-right'].includes(type)) {
    const item = closet.cycle(type === 'swipe-left' ? 1 : -1);
    if (!item) return;
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
  if(mode==='ar'&&['swipe-up','swipe-down'].includes(type)){setWardrobePanelOpen(type==='swipe-up');showGesture(type==='swipe-up'?'Wardrobe opened':'Wardrobe closed');return;}
  // Vertical swipes navigate modes outside the browser and Try On. Horizontal
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

function saveQuickNote(text) {
  try { localStorage.setItem('mirror.quick-note', text); }
  catch { showGesture('The note could not be saved. Keep your text and try again.'); return false; }
  elements.quickNoteInput.value = text;
  dashboard.refreshNow();
  showGesture(text ? 'Note saved to this mirror' : 'Note cleared');
  return true;
}

function showGesture(text) {
  elements.gestureToast.textContent = text;
  elements.gestureToast.classList.add('show');
  clearTimeout(gestureToastTimer);
  const duration = Math.min(7000, Math.max(1800, 900 + Array.from(String(text)).length * 45));
  const timer = setTimeout(() => {
    if (gestureToastTimer !== timer) return;
    gestureToastTimer = null;
    elements.gestureToast.classList.remove('show');
  }, duration);
  gestureToastTimer = timer;
}

function showAgentProgress(tool) {
  const messages = { thinking: 'A little thought behind the glass…', see_screen: 'Looking at what is on your screen…', get_mirror_state: 'Checking your mirror…', computer_action: 'Working on the page…', search_web: 'Finding what you asked for…', open_service: 'Opening your app…', open_webpage: 'Opening the page…', wardrobe_command: 'Choosing your clothes…', request_try_on: 'Preparing your look…', set_display_mode: 'Setting the scene…', set_avatar_position: 'Making room for you…', sign_in: 'Waiting for you to sign in directly' };
  const element = document.querySelector('#agent-progress'); element.textContent = messages[tool] || 'Conjuring your request…'; element.hidden = false;
}

function cueQueen() {
  if (magic.reduced || !avatar.visible) return;
  clearTimeout(queenCueTimer);
  const pose = { turn: .16, nod: .45, lean: -.035 };
  avatar.setPerformance(pose);
  queenCueTimer = setTimeout(() => { if (avatar.performance === pose) avatar.setPerformance({ turn: 0, nod: 0, lean: 0 }); }, 600);
}

function updateGestureHold() {
  const element = elements.gestureHold, now = performance.now();
  const active = gestures.enabled && !gestures.latched && now - gestures.lastSampleAt < 250 && !sleeping;
  const start = gestures.pinchSince || gestures.openSince;
  const hidden = !active || !start || now - start < 70;
  if(element.hidden!==hidden)element.hidden=hidden;
  if (element.hidden) return;
  const pinch = Boolean(gestures.pinchSince), progress = Math.min(1, (now - start) / (pinch ? 250 : 700));
  const value=String(Math.round(progress*20)/20);
  if(gestureHoldValue!==value){element.style.setProperty('--hold',value);gestureHoldValue=value;}
  let label;
  if(pinch){
    if(experience.dialog.open)label=experience.draft?'Hold pinch · save look':'Hold pinch · take photo';
    else if(closet.photo.open)label=closet.photo.saving||closet.photo.capturePending||closet.photo.extracting?'Photo busy · wait':closet.photo.output?'Hold pinch · save photo':'Hold pinch · take photo';
    else if(desktopActive)label=desktopKind==='native'&&desktopLabel==='Spotify'?'Hold pinch · play / pause':'Pinch · use on-screen controls';
    else if(['watch','spotify'].includes(mode))label='Hold pinch · play / pause';
    else label=mode==='ar'?'Hold pinch · next effect':'Pinch · use Watch, Music or Try on';
  }else{
    const stopping=experience.capturing||experience.routineActive||agentRunId||gemini.listening||browserRecognition||speech.isSpeaking||voiceStarting||['thinking','speaking'].includes(state)||elements.awakening?.classList.contains('active')||experience.dialog.open;
    label=stopping?'Hold palm · Stop':desktopActive?'Hold palm · return to mirror':'Hold palm · Converse';
  }
  if(elements.gestureHoldLabel.textContent!==label)elements.gestureHoldLabel.textContent=label;
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
  popupPanels.closePanel(elements.personaPanel);
  if (announce) showOracle(`${hosts[selected].name} is now your mirror host. The voice updates for the next live conversation.`, '', 'Host changed');
}

function updateRenderQuality(dt, viewport) {
  renderQuality.frames += 1;
  renderQuality.elapsed += dt;
  if (renderQuality.elapsed < 2) return;
  renderQuality.fps = renderQuality.frames / renderQuality.elapsed;
  if (!(depthEnabled && !['mirror','ar'].includes(mode)) && !elements.awakening.classList.contains('active')) {
    // A cached background cannot fix missed portrait frames. In standby the
    // slower heartbeat is intentional and must not degrade its resolution.
    renderQuality.frames = 0; renderQuality.elapsed = 0; return;
  }
  const previous = renderQuality.pixelRatio;
  if (renderQuality.fps < renderBudget.targetFps * .7 && renderQuality.pixelRatio > (softwareGraphics?.3:.8)) renderQuality.pixelRatio = Math.max(softwareGraphics?.3:.8, renderQuality.pixelRatio - .1);
  else if (renderQuality.fps > renderBudget.targetFps * .95 && renderQuality.pixelRatio < renderQuality.maxPixelRatio) renderQuality.pixelRatio = Math.min(renderQuality.maxPixelRatio, renderQuality.pixelRatio + .05);
  if (renderQuality.pixelRatio !== previous) {
    renderer.setPixelRatio(renderQuality.pixelRatio);
    // Never let the adaptive DPR pass resize the canvas to the surrounding
    // desktop browser. The render surface is the portrait mirror shell.
    renderer.setSize(viewport.width, viewport.height);
    sceneBudget.invalidate();
  }
  renderQuality.frames = 0;
  renderQuality.elapsed = 0;
}
