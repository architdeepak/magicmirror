import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let faceLandmarker = null;
let videoElement = null;
let mediaStream = null;
let currentDeviceId = '';
let lastVideoTime = -1;
let lastFaceAt = 0;
let latestLandmarks = null;
let latestMatrix = null;

const currentHead = { x: 0, y: 0, z: 1 };
const targetHead = { x: 0, y: 0, z: 1 };
const options = { sensitivity: 1, smoothing: 0.18 };
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
  mouseX = event.clientX / Math.max(window.innerWidth, 1);
  mouseY = event.clientY / Math.max(window.innerHeight, 1);
});

export async function initHeadTracking(video) {
  videoElement = video;
  try {
    const wasmRoot = new URL('../node_modules/@mediapipe/tasks-vision/wasm', import.meta.url).href;
    const vision = await FilesetResolver.forVisionTasks(wasmRoot);
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      minFaceDetectionConfidence: 0.55,
      minFacePresenceConfidence: 0.55,
      minTrackingConfidence: 0.5
    });
    status.ready = true;
  } catch (error) {
    status.error = `Face tracker unavailable: ${error.message}`;
    console.warn('[tracking]', status.error);
  }

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
  status.error = '';

  try {
    let requestedId = deviceId;
    if (!requestedId) {
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: 'user' },
        audio: false
      });
      permissionStream.getTracks().forEach((track) => track.stop());
      const cameras = (await getCameraDevices()).sort((a, b) => scoreCamera(b) - scoreCamera(a));
      requestedId = cameras[0]?.deviceId || '';
    }

    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        ...(requestedId ? { deviceId: { exact: requestedId } } : { facingMode: 'user' }),
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 30 }
      },
      audio: false
    });

    videoElement.srcObject = mediaStream;
    await videoElement.play();
    const track = mediaStream.getVideoTracks()[0];
    currentDeviceId = track?.getSettings().deviceId || requestedId;
    status.activeCameraLabel = track?.label || 'Camera';
    status.cameraActive = true;
    status.mode = status.ready ? 'camera' : 'camera-preview';
    return true;
  } catch (error) {
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
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  if (videoElement) videoElement.srcObject = null;
  status.cameraActive = false;
  status.faceDetected = false;
  status.mode = 'mouse';
  latestLandmarks = null;
  latestMatrix = null;
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
}

export function updateHeadTracking(now = performance.now()) {
  const canDetect = status.cameraActive && status.ready && videoElement?.readyState >= 2 &&
    videoElement.videoWidth > 0 && videoElement.currentTime !== lastVideoTime;

  if (canDetect) {
    lastVideoTime = videoElement.currentTime;
    try {
      const result = faceLandmarker.detectForVideo(videoElement, now);
      latestLandmarks = result.faceLandmarks?.[0] || null;
      latestMatrix = result.facialTransformationMatrixes?.[0]?.data || null;

      if (latestLandmarks) {
        lastFaceAt = now;
        status.faceDetected = true;
        const nose = latestLandmarks[1];
        const leftEye = latestLandmarks[33];
        const rightEye = latestLandmarks[263];
        const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);

        targetHead.x = clamp((0.5 - nose.x) * 2.1 * options.sensitivity, -1.25, 1.25);
        targetHead.y = clamp((nose.y - 0.47) * 1.8 * options.sensitivity, -1.1, 1.1);
        targetHead.z = clamp(0.14 / Math.max(eyeDistance, 0.045), 0.62, 1.55);
      }
    } catch (error) {
      console.debug('[tracking] skipped frame', error.message);
    }
  }

  if (now - lastFaceAt > 300) status.faceDetected = false;
  if (!status.faceDetected) {
    targetHead.x = (mouseX - 0.5) * 1.75 * options.sensitivity;
    targetHead.y = (mouseY - 0.5) * 1.5 * options.sensitivity;
    targetHead.z = 1;
  }

  currentHead.x += (targetHead.x - currentHead.x) * options.smoothing;
  currentHead.y += (targetHead.y - currentHead.y) * options.smoothing;
  currentHead.z += (targetHead.z - currentHead.z) * options.smoothing;
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
  camera.lookAt(eyeX * 0.12, eyeY * 0.12, -1.2);
}

export function getHeadPosition() { return currentHead; }
export function getTrackingStatus() { return { ...status }; }
export function getFaceLandmarks() { return latestLandmarks; }
export function getFaceMatrix() { return latestMatrix; }
export function getVideoElement() { return videoElement; }

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
