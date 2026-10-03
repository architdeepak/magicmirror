import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// Deliberately small gesture vocabulary. A mirror should never react to every
// casual hand movement: swipes change modes, an open palm enters Converse, and
// a pinch advances an effect while in Try On.
export class GestureNavigation {
  constructor(video, onGesture = () => {}) {
    this.video = video;
    this.onGesture = onGesture;
    this.landmarker = null;
    this.enabled = false;
    this.lastDetectAt = 0;
    this.lastVideoTime = -1;
    this.lastGestureAt = 0;
    this.samples = [];
    this.openSince = 0;
    this.status = 'off';
  }

  async init() {
    try {
      const wasmRoot = new URL('../node_modules/@mediapipe/tasks-vision/wasm', import.meta.url).href;
      const vision = await FilesetResolver.forVisionTasks(wasmRoot);
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: .7,
        minHandPresenceConfidence: .7,
        minTrackingConfidence: .65
      });
      this.status = 'ready';
      return true;
    } catch (error) {
      this.status = 'unavailable';
      console.warn('[gestures]', error.message);
      return false;
    }
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.samples = [];
    this.openSince = 0;
    if (!this.enabled) this.status = 'off';
    else if (this.landmarker) this.status = 'ready';
  }

  update(now = performance.now()) {
    if (!this.enabled || !this.landmarker || !this.video?.videoWidth || this.video.currentTime === this.lastVideoTime) return;
    // Ten inference passes per second is responsive while leaving room for face tracking.
    if (now - this.lastDetectAt < 95) return;
    this.lastDetectAt = now;
    this.lastVideoTime = this.video.currentTime;
    try {
      const result = this.landmarker.detectForVideo(this.video, now);
      const hand = result.landmarks?.[0];
      if (!hand) { this.samples = []; this.openSince = 0; this.status = 'searching'; return; }
      this.status = 'tracking';
      this._interpret(hand, now);
    } catch (error) {
      console.debug('[gestures] skipped frame', error.message);
    }
  }

  _interpret(hand, now) {
    const palmWidth = distance(hand[5], hand[17]);
    const centerX = (hand[0].x + hand[9].x) / 2;
    const pinch = distance(hand[4], hand[8]) < palmWidth * .42;
    const extended = [8, 12, 16, 20].filter((tip) => hand[tip].y < hand[tip - 2].y - .025).length;

    if (now - this.lastGestureAt < 1050) return;
    if (pinch) {
      this._emit('pinch', now);
      return;
    }
    if (extended >= 3) {
      if (!this.openSince) this.openSince = now;
      if (now - this.openSince > 650) {
        this._emit('palm', now);
        return;
      }
      this.samples.push({ x: centerX, at: now });
      this.samples = this.samples.filter((sample) => now - sample.at < 430);
      const first = this.samples[0];
      if (first && Math.abs(centerX - first.x) > .24) this._emit(centerX > first.x ? 'swipe-right' : 'swipe-left', now);
    } else {
      this.openSince = 0;
      this.samples = [];
    }
  }

  _emit(type, now) {
    this.lastGestureAt = now;
    this.samples = [];
    this.openSince = 0;
    this.onGesture(type);
  }
}

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
