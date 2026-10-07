import { FaceTracking } from './faceTracking.js';

let faceTracking = null;
let videoElement = null;
let mediaStream = null;
let cameraGeneration = 0;
let cameraEndCleanup = null;
let currentDeviceId = '';
let lastFaceAt = 0;
let latestLandmarks = null;
let latestMatrix = null;
let latestBlendshapes = Object.freeze({});

const currentHead = { x: 0, y: 0, z: 1 };
const targetHead = { x: 0, y: 0, z: 1 };
const currentGaze = { x: 0, y: 0, confidence: 0 };
const options = { sensitivity: 1, smoothing: 0.18, mount: 'top' };
let depthCalibration = null;
const calibrationSamples = [];
let lastHeadUpdateAt = 0;
const calibrationStorageKey = 'mirror.depth-calibration.v2';
const status = {
  mode: 'mouse',
  ready: false,
  faceDetected: false,
  cameraActive: false,
  activeCameraLabel: 'Mouse fallback',
  error: ''
};

let mouseX = 0.5;
let mouseY = 0.5;

window.addEventListener('pointermove', (event) => {
  // The mirror can be letterboxed inside a wide browser window.  Use the
  // actual portrait display bounds so fallback parallax never treats the
  // black margins as part of the physical mirror.
  const rect = videoElement?.getBoundingClientRect();
  if (rect?.width && rect?.height) {
    mouseX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    mouseY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    return;
  }
  mouseX = event.clientX / Math.max(window.innerWidth, 1);
  mouseY = event.clientY / Math.max(window.innerHeight, 1);
});

export async function initHeadTracking(video) {
  videoElement = video;
  const generation = cameraGeneration;
  faceTracking?.destroy();
  const tracker = new FaceTracking(video, acceptFaceResult, (state, message) => {
    if (faceTracking !== tracker) return;
    status.ready = state === 'ready' || (state !== 'unavailable' && Boolean(faceTracking?.ready));
    if (state === 'unavailable') status.error = message;
    if (status.cameraActive) status.mode = status.ready ? 'camera' : 'camera-preview';
  });
  faceTracking = tracker;
  const ready = await tracker.init();
  if (faceTracking !== tracker) return status.cameraActive;
  status.ready = ready;

  if (generation !== cameraGeneration) return status.cameraActive;
  return startCamera();
}

export async function getCameraDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === 'videoinput');
}

function scoreCamera(camera) {
  const label = camera.label.toLowerCase();
  let score = 0;
  if (/integrated|front|facetime|webcam|camera/.test(label)) score += 4;
  if (/phone|virtual|obs|camo|droid|continuity/.test(label)) score -= 8;
  return score;
}

export async function startCamera(deviceId = '') {
  if (!navigator.mediaDevices?.getUserMedia || !videoElement) {
    status.error = 'No camera API available';
    return false;
  }

  stopCamera();
  const generation = cameraGeneration;
  let stream = null;
  calibrationSamples.length = 0;
  status.error = '';

  try {
    let requestedId = deviceId;
    if (!requestedId) {
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: 'user' },
        audio: false
      });
      permissionStream.getTracks().forEach((track) => track.stop());
      if (generation !== cameraGeneration) return false;
      const cameras = (await getCameraDevices()).sort((a, b) => scoreCamera(b) - scoreCamera(a));
      if (generation !== cameraGeneration) return false;
      requestedId = cameras[0]?.deviceId || '';
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        ...(requestedId ? { deviceId: { exact: requestedId } } : { facingMode: 'user' }),
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 30 }
      },
      audio: false
    });

    if (generation !== cameraGeneration) { stream.getTracks().forEach(track => track.stop()); return false; }
    mediaStream = stream;
    videoElement.srcObject = stream;
    const tracks = stream.getVideoTracks();
    if (!tracks.length || tracks.some(track => track.readyState === 'ended') || stream.active === false) throw new Error('The camera stream has ended.');
    const onEnded = () => {
      if (generation !== cameraGeneration || mediaStream !== stream) return;
      stopCamera();
      status.error = 'Camera disconnected. Reconnect it, then choose Camera on.';
    };
    tracks.forEach(track => track.addEventListener?.('ended', onEnded));
    cameraEndCleanup = () => tracks.forEach(track => track.removeEventListener?.('ended', onEnded));
    await videoElement.play();
    if (generation !== cameraGeneration) { stream.getTracks().forEach(track => track.stop()); return false; }
    if (tracks.some(track => track.readyState === 'ended') || stream.active === false) throw new Error('The camera stream has ended.');
    const track = stream.getVideoTracks()[0];
    currentDeviceId = track?.getSettings().deviceId || requestedId;
    depthCalibration = loadCalibration(currentDeviceId);
    status.activeCameraLabel = track?.label || 'Camera';
    status.cameraActive = true;
    faceTracking?.setEnabled(true);
    status.mode = status.ready ? 'camera' : 'camera-preview';
    return true;
  } catch (error) {
    stream?.getTracks().forEach(track => track.stop());
    if (generation !== cameraGeneration) return false;
    stopCamera();
    status.error = error.name === 'NotAllowedError'
      ? 'Camera permission was denied'
      : `Camera unavailable: ${error.message}`;
    status.mode = 'mouse';
    status.cameraActive = false;
    console.warn('[tracking]', status.error);
    return false;
  }
}

export function stopCamera() {
  faceTracking?.setEnabled(false);
  cameraGeneration += 1;
  cameraEndCleanup?.();
  cameraEndCleanup = null;
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  if (videoElement) videoElement.srcObject = null;
  status.cameraActive = false;
  status.faceDetected = false;
  status.mode = 'mouse';
  status.activeCameraLabel = 'Mouse fallback';
  lastFaceAt = 0;
  calibrationSamples.length = 0;
  currentGaze.x = 0; currentGaze.y = 0; currentGaze.confidence = 0;
  latestLandmarks = null;
  latestMatrix = null;
  latestBlendshapes = Object.freeze({});
}

export async function toggleCamera(enable) {
  if (enable) return startCamera(currentDeviceId);
  stopCamera();
  return false;
}

export function switchCamera(deviceId) { return startCamera(deviceId); }

export function setTrackingOptions(next) {
  if (Number.isFinite(next.sensitivity)) options.sensitivity = Math.min(2, Math.max(0.5, next.sensitivity));
  if (Number.isFinite(next.smoothing)) options.smoothing = Math.min(0.35, Math.max(0.05, next.smoothing));
  if (['top', 'center'].includes(next.mount) && options.mount !== next.mount) {
    options.mount = next.mount;
    calibrationSamples.length = 0;
    depthCalibration = loadCalibration(currentDeviceId);
  }
}

function acceptFaceResult(landmarks, timestamp, data = {}) {
  if (!status.cameraActive || !videoElement?.srcObject) return;
  latestLandmarks = landmarks;
  latestMatrix = data.matrix || null;
  latestBlendshapes = categoriesToBlendshapes(data.blendshapes);
  if (!latestLandmarks?.[33] || !latestLandmarks?.[263]) {
    status.faceDetected = false;
    latestLandmarks = null; latestMatrix = null; latestBlendshapes = Object.freeze({});
    currentGaze.x = 0; currentGaze.y = 0; currentGaze.confidence = 0;
    return;
  }
  const now = timestamp;
  lastFaceAt = now;
  status.faceDetected = true;
  const leftEye = latestLandmarks[33];
  const rightEye = latestLandmarks[263];
  const eyeCenter = { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 };
  const aspect = videoElement.videoWidth / Math.max(1, videoElement.videoHeight);
  const eyeDistance = Math.hypot(rightEye.x - leftEye.x, (rightEye.y - leftEye.y) / aspect);
  calibrationSamples.push({ x: eyeCenter.x, y: eyeCenter.y, eyeDistance, at: now });
  if (calibrationSamples.length > 120) calibrationSamples.shift();
  const reference = depthCalibration || { x: .5, y: .47, eyeDistance: .14 };

  // Eye midpoint is more stable than nose position for the virtual-window
  // illusion. Calibration gives a real viewer a centered, comfortable
  // neutral position rather than assuming every camera is mounted alike.
  targetHead.x = clamp((reference.x - eyeCenter.x) * 2.1 * options.sensitivity, -1.25, 1.25);
  // A camera above a portrait display sees vertical movement more
  // aggressively than a centred camera. Its calibrated baseline handles
  // the static offset; this factor keeps movement comfortable afterward.
  const verticalResponse = options.mount === 'top' ? 1.42 : 1.8;
  targetHead.y = clamp((eyeCenter.y - reference.y) * verticalResponse * options.sensitivity, -1.1, 1.1);
  targetHead.z = clamp(reference.eyeDistance / Math.max(eyeDistance, 0.045), 0.62, 1.55);
  updateEyeGaze(latestLandmarks);
}

export function updateHeadTracking(now = performance.now()) {
  faceTracking?.update(now);

  if (now - lastFaceAt > 300) {
    status.faceDetected = false;
    latestLandmarks = null; latestMatrix = null;
    latestBlendshapes = Object.freeze({});
    currentGaze.x = 0;
    currentGaze.y = 0;
    currentGaze.confidence = 0;
  }
  if (!status.faceDetected) {
    const useMouse = !status.cameraActive || !status.ready;
    targetHead.x = useMouse ? (mouseX - 0.5) * 1.75 * options.sensitivity : 0;
    targetHead.y = useMouse ? (mouseY - 0.5) * 1.5 * options.sensitivity : 0;
    targetHead.z = 1;
  }

  const elapsed = lastHeadUpdateAt ? clamp(now - lastHeadUpdateAt, 1, 100) : 1000 / 60;
  lastHeadUpdateAt = now;
  const smoothing = 1 - Math.pow(1 - options.smoothing, elapsed / (1000 / 60));
  currentHead.x += (targetHead.x - currentHead.x) * smoothing;
  currentHead.y += (targetHead.y - currentHead.y) * smoothing;
  currentHead.z += (targetHead.z - currentHead.z) * smoothing;
  return currentHead;
}

export function applyOffAxisProjection(camera, head, screenWidth = 1.8, screenHeight = 3.2) {
  const eyeDistance = 3.1;
  const eyeX = head.x * screenWidth * 0.42;
  const eyeY = -head.y * screenHeight * 0.34;
  const eyeZ = eyeDistance * head.z;
  camera.position.set(eyeX, eyeY, eyeZ);

  const scale = camera.near / Math.max(eyeZ, 0.1);
  camera.projectionMatrix.makePerspective(
    (-screenWidth / 2 - eyeX) * scale,
    (screenWidth / 2 - eyeX) * scale,
    (screenHeight / 2 - eyeY) * scale,
    (-screenHeight / 2 - eyeY) * scale,
    camera.near,
    camera.far
  );
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  // The frustum already accounts for eye displacement. Rotating toward the
  // screen center would move the physical screen plane a second time.
  camera.lookAt(eyeX, eyeY, eyeZ - 1);
}

export function applyFlatProjection(camera, aspect = window.innerWidth / window.innerHeight) {
  camera.position.set(0, 0, 3.1);
  // Match the neutral 3D window so toggling depth does not change its scale.
  camera.fov = 2 * Math.atan(1.6 / 3.1) * 180 / Math.PI;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  camera.lookAt(0, 0, -1.2);
}

export function getHeadPosition() { return currentHead; }
export function getTrackingStatus() {
  const calibration = calibrationSample(performance.now());
  return { ...status, lastInferenceMs: faceTracking?.inferenceMs || 0, delegate: faceTracking?.delegate || '',
    frameAgeMs: status.faceDetected ? Math.max(0, performance.now() - lastFaceAt) : null, calibrated: Boolean(depthCalibration), canCalibrate: calibration.ready, calibrationReason: calibration.reason };
}
export function getFaceLandmarks() { return latestLandmarks; }
export function getFaceMatrix() { return latestMatrix; }
export function getFaceBlendshapes() { return latestBlendshapes; }
export function getEyeGaze() { return { ...currentGaze }; }
export function getVideoElement() { return videoElement; }

function calibrationSample(now) {
  if (!status.cameraActive || !status.faceDetected || !latestLandmarks || now - lastFaceAt > 300) {
    return { ready: false, reason: 'Stand where you will use the mirror until Face Lock appears.', samples: [] };
  }
  const samples = calibrationSamples.filter((sample) => now - sample.at <= 2200);
  if (samples.length < 8 || samples[samples.length - 1].at - samples[0].at < 1600) {
    return { ready: false, reason: 'Hold still at your viewing spot for two seconds.', samples };
  }
  if (samples.some((sample, index) => index > 0 && sample.at - samples[index - 1].at > 350)) {
    return { ready: false, reason: 'Keep your face in view continuously for two seconds.', samples };
  }
  const spread = (key) => Math.max(...samples.map((sample) => sample[key])) - Math.min(...samples.map((sample) => sample[key]));
  const eyeMean = samples.reduce((sum, sample) => sum + sample.eyeDistance, 0) / samples.length;
  if (spread('x') > .035 || spread('y') > .035 || spread('eyeDistance') > eyeMean * .13) {
    return { ready: false, reason: 'Keep your head still for two seconds, then calibrate again.', samples };
  }
  return { ready: true, reason: 'Stable face sample ready for calibration.', samples };
}

export function calibrateDepth() {
  const sample = calibrationSample(performance.now());
  if (!sample.ready) return false;
  const samples = sample.samples;
  const average = (key) => samples.reduce((total, item) => total + item[key], 0) / samples.length;
  depthCalibration = {
    x: average('x'), y: average('y'), eyeDistance: Math.max(.045, average('eyeDistance')),
    mount: options.mount, calibratedAt: new Date().toISOString()
  };
  saveCalibration(currentDeviceId, depthCalibration);
  return true;
}

function loadCalibration(deviceId) {
  try {
    const all = JSON.parse(localStorage.getItem(calibrationStorageKey) || '{}');
    const saved = all[`${deviceId}:${options.mount}`] || all[deviceId];
    if (!saved || saved.mount !== options.mount || !Number.isFinite(saved.x) || !Number.isFinite(saved.y) || !Number.isFinite(saved.eyeDistance)) return null;
    return saved;
  } catch { return null; }
}

function saveCalibration(deviceId, calibration) {
  if (!deviceId) return;
  try {
    const all = JSON.parse(localStorage.getItem(calibrationStorageKey) || '{}');
    all[`${deviceId}:${options.mount}`] = calibration;
    localStorage.setItem(calibrationStorageKey, JSON.stringify(all));
  } catch { /* local storage is an optional convenience */ }
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function categoriesToBlendshapes(categories = []) {
  const shapes = {};
  for (const category of categories) {
    const name = category?.categoryName;
    if (!name || name === '_neutral') continue;
    shapes[name] = clamp(Number(category.score) || 0, 0, 1);
  }
  return Object.freeze(shapes);
}

function updateEyeGaze(landmarks) {
  // Face Landmarker provides iris points 468–477 when refinement is available.
  // This is deliberately separate from head position: looking sideways should
  // not bend the virtual window, but can inform subtle character eye response.
  if (landmarks.length < 478) return;
  const leftIris = averagePoint(landmarks.slice(468, 473));
  const rightIris = averagePoint(landmarks.slice(473, 478));
  const left = normalizeIris(leftIris, landmarks[33], landmarks[133], landmarks[159], landmarks[145]);
  const right = normalizeIris(rightIris, landmarks[362], landmarks[263], landmarks[386], landmarks[374]);
  if (!left || !right) return;
  const targetX = clamp(((left.x + right.x) / 2 - .5) * 2, -1, 1);
  const targetY = clamp(((left.y + right.y) / 2 - .5) * 2, -1, 1);
  currentGaze.x += (targetX - currentGaze.x) * .22;
  currentGaze.y += (targetY - currentGaze.y) * .22;
  currentGaze.confidence = .8;
}

function normalizeIris(iris, outer, inner, top, bottom) {
  const width = Math.abs(outer.x - inner.x);
  const height = Math.abs(bottom.y - top.y);
  if (width < .005 || height < .003) return null;
  return {
    x: clamp((iris.x - Math.min(outer.x, inner.x)) / width, 0, 1),
    y: clamp((iris.y - Math.min(top.y, bottom.y)) / height, 0, 1)
  };
}

function averagePoint(points) {
  const total = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  return { x: total.x / points.length, y: total.y / points.length };
}
