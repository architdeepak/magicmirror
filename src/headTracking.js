import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let faceLandmarker = null;
let videoElement = null;
let mediaStream = null;
let cameraGeneration = 0;
let currentDeviceId = '';
let lastVideoTime = -1;
let lastUpdateAt = 0;
let lastDetectionAt = -Infinity;
let sessionReference = null;
let detectionFailures = 0;
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
const calibrationStorageKey = 'mirror.depth-calibration.v2';
const status = {
  mode: 'mouse',
  ready: false,
  faceDetected: false,
  cameraActive: false,
  detectionMs: 0,
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
  const initGeneration = cameraGeneration;
  try {
    const wasmRoot = new URL('../node_modules/@mediapipe/tasks-vision/wasm', import.meta.url).href;
    const vision = await FilesetResolver.forVisionTasks(wasmRoot);
    const trackerOptions = {
      baseOptions: {
        modelAssetPath: new URL('./assets/models/face_landmarker.task', import.meta.url).href,
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      minFaceDetectionConfidence: 0.45,
      minFacePresenceConfidence: 0.45,
      minTrackingConfidence: 0.45
    };
    try {
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, trackerOptions);
    } catch (gpuError) {
      console.warn('[tracking] GPU unavailable, using CPU:', gpuError.message);
      trackerOptions.baseOptions.delegate = 'CPU';
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, trackerOptions);
    }
    status.ready = true;
  } catch (error) {
    status.error = `Face tracker unavailable: ${error.message}`;
    console.warn('[tracking]', status.error);
  }

  if (initGeneration !== cameraGeneration) return false;
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
  // A dedicated USB camera mounted above the mirror is a better installation
  // default than the laptop's integrated camera when both are present.
  if (/aukey|usb|external/.test(label)) score += 8;
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
  let openedStream = null;
  calibrationSamples.length = 0;
  lastVideoTime = -1;
  lastDetectionAt = -Infinity;
  lastFaceAt = 0;
  sessionReference = null;
  detectionFailures = 0;
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

    openedStream = await navigator.mediaDevices.getUserMedia({
      video: {
        ...(requestedId ? { deviceId: { exact: requestedId } } : { facingMode: 'user' }),
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 30 }
      },
      audio: false
    });

    if (generation !== cameraGeneration) {
      openedStream.getTracks().forEach((track) => track.stop());
      return false;
    }
    mediaStream = openedStream;
    videoElement.srcObject = openedStream;
    await videoElement.play();
    if (generation !== cameraGeneration) {
      openedStream.getTracks().forEach((track) => track.stop());
      return false;
    }
    const track = openedStream.getVideoTracks()[0];
    currentDeviceId = track?.getSettings().deviceId || requestedId;
    depthCalibration = loadCalibration(currentDeviceId);
    status.activeCameraLabel = track?.label || 'Camera';
    status.cameraActive = true;
    status.mode = status.ready ? 'camera' : 'camera-preview';
    console.info('[tracking] Camera active:', status.activeCameraLabel, videoElement.videoWidth, videoElement.videoHeight);
    return true;
  } catch (error) {
    openedStream?.getTracks().forEach((track) => track.stop());
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
  cameraGeneration += 1;
  lastVideoTime = -1;
  lastDetectionAt = -Infinity;
  lastFaceAt = 0;
  calibrationSamples.length = 0;
  sessionReference = null;
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  if (videoElement) videoElement.srcObject = null;
  status.cameraActive = false;
  status.faceDetected = false;
  status.mode = 'mouse';
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
  if (['top', 'center'].includes(next.mount)) options.mount = next.mount;
}

export function updateHeadTracking(now = performance.now()) {
  // Inference blocks the renderer thread. Search less often until a face is
  // found, then run at 20 Hz while interpolation still updates every frame.
  const detectionInterval = status.faceDetected ? 50 : 100;
  const canDetect = status.cameraActive && status.ready && videoElement?.readyState >= 2 &&
    videoElement.videoWidth > 0 && videoElement.currentTime !== lastVideoTime &&
    now - lastDetectionAt >= detectionInterval;

  if (canDetect) {
    lastVideoTime = videoElement.currentTime;
    lastDetectionAt = now;
    try {
      const started = performance.now();
      const result = faceLandmarker.detectForVideo(videoElement, now);
      const detectionMs = performance.now() - started;
      status.detectionMs = status.detectionMs ? status.detectionMs * .8 + detectionMs * .2 : detectionMs;
      detectionFailures = 0;
      latestLandmarks = result.faceLandmarks?.[0] || null;
      latestMatrix = result.facialTransformationMatrixes?.[0]?.data || null;
      latestBlendshapes = categoriesToBlendshapes(result.faceBlendshapes?.[0]?.categories);

      if (latestLandmarks) {
        lastFaceAt = now;
        status.faceDetected = true;
        const leftEye = latestLandmarks[33];
        const rightEye = latestLandmarks[263];
        const eyeCenter = { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 };
        // Normalize x and y in the same camera pixel units. A 16:9 sensor
        // otherwise misreads eye separation as the user tilts their head.
        const sensorAspect = videoElement.videoWidth / videoElement.videoHeight;
        const eyeDistance = Math.hypot(rightEye.x - leftEye.x, (rightEye.y - leftEye.y) / sensorAspect);
        if (!sessionReference) sessionReference = { ...eyeCenter, eyeDistance };
        calibrationSamples.push({ x: eyeCenter.x, y: eyeCenter.y, eyeDistance });
        if (calibrationSamples.length > 60) calibrationSamples.shift();
        const reference = depthCalibration || sessionReference;

        // Eye midpoint is more stable than nose position for the virtual-window
        // illusion. Calibration gives a real viewer a centered, comfortable
        // neutral position rather than assuming every camera is mounted alike.
        // Raw camera x increases when the viewer moves left. Reverse the
        // scene response so moving left reveals motion to the right.
        targetHead.x = clamp((eyeCenter.x - reference.x) * 3.2 * options.sensitivity, -1.25, 1.25);
        // A camera above a portrait display sees vertical movement more
        // aggressively than a centred camera. Its calibrated baseline handles
        // the static offset; this factor keeps movement comfortable afterward.
        const verticalResponse = options.mount === 'top' ? 2.1 : 2.6;
        targetHead.y = clamp((eyeCenter.y - reference.y) * verticalResponse * options.sensitivity, -1.1, 1.1);
        targetHead.z = clamp(reference.eyeDistance / Math.max(eyeDistance, 0.012), 0.62, 1.55);
        updateEyeGaze(latestLandmarks);
      }
    } catch (error) {
      detectionFailures += 1;
      if (detectionFailures === 1) console.warn('[tracking] skipped frame:', error.message);
      if (detectionFailures >= 30) status.error = `Face detection failed: ${error.message}`;
    }
  }

  if (now - lastFaceAt > 300) {
    status.faceDetected = false;
    latestLandmarks = null;
    latestMatrix = null;
    latestBlendshapes = Object.freeze({});
    currentGaze.x = 0;
    currentGaze.y = 0;
    currentGaze.confidence = 0;
  }
  if (!status.faceDetected) {
    // A camera losing lock must not jump to the unrelated mouse cursor.
    targetHead.x = status.cameraActive ? currentHead.x : (0.5 - mouseX) * 1.75 * options.sensitivity;
    targetHead.y = status.cameraActive ? currentHead.y : (mouseY - 0.5) * 1.5 * options.sensitivity;
    targetHead.z = 1;
  }

  const frameDelta = lastUpdateAt ? Math.min((now - lastUpdateAt) / 1000, .1) : 1 / 60;
  lastUpdateAt = now;
  const alpha = 1 - Math.pow(1 - options.smoothing, frameDelta * 60);
  currentHead.x += (targetHead.x - currentHead.x) * alpha;
  currentHead.y += (targetHead.y - currentHead.y) * alpha;
  currentHead.z += (targetHead.z - currentHead.z) * alpha;
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
  // Off-axis projection assumes a camera parallel to the physical glass.
  // Looking back toward the origin rotates away the head-motion parallax.
  camera.rotation.set(0, 0, 0);
  camera.updateMatrixWorld();
}

export function applyFlatProjection(camera, aspect = window.innerWidth / window.innerHeight) {
  camera.position.set(0, 0, 3.1);
  camera.fov = 45;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  camera.lookAt(0, 0, -1.2);
}

export function getHeadPosition() { return currentHead; }
export function getTrackingStatus() { return { ...status }; }
export function getFaceLandmarks() { return latestLandmarks; }
export function getFaceMatrix() { return latestMatrix; }
export function getFaceBlendshapes() { return latestBlendshapes; }
export function getEyeGaze() { return { ...currentGaze }; }
export function getVideoElement() { return videoElement; }

export function calibrateDepth() {
  if (!status.faceDetected || !latestLandmarks || latestLandmarks.length < 264 || calibrationSamples.length < 8) return false;
  // Use approximately two seconds of recent tracking samples instead of one
  // frame. This eliminates the visible depth jump caused by blinking or a
  // momentary head turn during calibration.
  const samples = calibrationSamples.slice(-45);
  const average = (key) => samples.reduce((total, sample) => total + sample[key], 0) / samples.length;
  depthCalibration = {
    x: average('x'),
    y: average('y'),
    eyeDistance: Math.max(.012, average('eyeDistance')),
    mount: options.mount,
    calibratedAt: new Date().toISOString()
  };
  saveCalibration(currentDeviceId, depthCalibration);
  return true;
}

function loadCalibration(deviceId) {
  try {
    const all = JSON.parse(localStorage.getItem(calibrationStorageKey) || '{}');
    const saved = all[deviceId];
    if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y) || !Number.isFinite(saved.eyeDistance)) return null;
    return saved;
  } catch { return null; }
}

function saveCalibration(deviceId, calibration) {
  if (!deviceId) return;
  try {
    const all = JSON.parse(localStorage.getItem(calibrationStorageKey) || '{}');
    all[deviceId] = calibration;
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
