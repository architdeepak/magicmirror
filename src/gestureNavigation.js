import { ClapGesture } from './clapGesture.js';
﻿import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// A pinch has a complete lifecycle. Controls can consume pinch-down for
// immediate selection; other controls click on release without duplicate clicks.
export class GestureNavigation {
  constructor(video, onGesture = () => {}) {
    this.video = video;
    this.onGesture = onGesture;
    this.landmarker = null;
    this.enabled = false;
    this.lastDetectAt = 0;
    this.lastVideoTime = -1;
    this.inferenceMs = 0;
    this.cursor = { x: .5, y: .5 };
    this.pinchWasDown = false;
    this.lastPointAt = -Infinity;
    this.lastHandAt = -Infinity;
    this.previousWrist = null;
    this.pinchStart = null;
    this.status = 'off';
    this.handId = 'hand-0';
    this.handStates = new Map();
    this.latestHands = [];
    this.nextHandId = 1;
    this.handPreference = 'right';
    this.debugHands = [];
    this.controlsEnabled = true;
    this.clap = new ClapGesture();
  }

  async init() {
    try {
      const wasmRoot = new URL('../node_modules/@mediapipe/tasks-vision/wasm', import.meta.url).href;
      const vision = await FilesetResolver.forVisionTasks(wasmRoot);
      const options = {
        baseOptions: {
          modelAssetPath: new URL('./assets/models/hand_landmarker.task', import.meta.url).href,
          delegate: 'GPU'
        },
        runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: .45,
        minHandPresenceConfidence: .45,
        minTrackingConfidence: .45
      };
      try {
        this.landmarker = await HandLandmarker.createFromOptions(vision, options);
      } catch {
        options.baseOptions.delegate = 'CPU';
        this.landmarker = await HandLandmarker.createFromOptions(vision, options);
      }
      this.status = 'ready';
      return true;
    } catch (error) {
      this.status = 'unavailable';
      console.warn('[gestures]', error.message);
      return false;
    }
  }

  _cancel() {
    for (const state of this.handStates.values()) this._cancelHand(state);
    this.handStates.clear();
    this._cancelHand(this);
    this.latestHands = [];
  }

  _cancelHand(state) {
    const detail = { ...state.cursor, handId: state.handId };
    if (state.pinchWasDown) this.onGesture('pointer-cancel', detail);
    state.pinchWasDown = false;
    state.pinchStart = null;
    state.pinchConsumed = false;
    state.previousWrist = null;
    this.latestHands = this.latestHands.filter((hand) => hand.handId !== state.handId);
    this.onGesture('pointer-lost', detail);
  }

  setEnabled(enabled) {
    if (this.enabled === Boolean(enabled) && (enabled || (!this.pinchWasDown && !this.handStates.size))) return;
    this.clap.reset();
    this.enabled = Boolean(enabled);
    this._cancel();
    this.debugHands = [];
    this.lastVideoTime = -1;
    this.status = !this.enabled ? 'off' : this.landmarker ? 'ready' : 'unavailable';
  }

  setControlsEnabled(enabled) {
    if (this.controlsEnabled === Boolean(enabled)) return;
    this.controlsEnabled = Boolean(enabled);
    this._cancel();
  }

  setHandPreference(preference = 'right') {
    const selected = preference === 'both' ? 'both' : 'right';
    if (selected === this.handPreference) return;
    this.handPreference = selected;
    this._cancel();
  }

  update(now = performance.now()) {
    if (!this.enabled || !this.landmarker) return;
    if (!this.video?.videoWidth || this.video.readyState < 2) {
      this._cancel();
      this.status = 'searching';
      return;
    }
    // Searching invokes the more expensive palm detector; leave camera/face
    // tracking enough frame budget. Once locked, restore smooth dragging.
    const held = [...this.handStates.values()].some((state) => state.pinchWasDown);
    const interval = this.status === 'tracking' || held || this.debugHands.length || !this.controlsEnabled ? 50 : 100;
    if (this.video.currentTime === this.lastVideoTime || now - this.lastDetectAt < interval) return;
    this.lastDetectAt = now;
    this.lastVideoTime = this.video.currentTime;
    try {
      const inferenceStarted = performance.now();
      const result = this.landmarker.detectForVideo(this.video, now);
      this.inferenceMs = performance.now() - inferenceStarted;
      this._processHands(result, now);
    } catch (error) {
      this._expireHands(now);
      console.debug('[gestures] skipped frame', error.message);
    }
  }

  _expireHands(now) {
    for (const [id, state] of this.handStates) {
      if (now - state.lastHandAt <= 250) continue;
      this._cancelHand(state);
      this.handStates.delete(id);
    }
  }

  _processHands(result, now) {
    this._expireHands(now);
    const detected = (result.landmarks || []).map((hand, index) => ({ hand, label: result.handedness?.[index]?.[0]?.categoryName || '' }));
    // MediaPipe handedness assumes a mirrored selfie input. This camera is
    // supplied unmirrored; the physical right hand receives label Left.
    // Do not turn an unclassified or left hand into an interactive pointer.
    this.debugHands = detected.map(({ hand, label }) => ({ hand, screenHand: hand.map(point => this._project(point)), handedness: label === 'Left' ? 'right' : label === 'Right' ? 'left' : '', label }));
    if (this.clap.update(detected.map(item => item.hand), now)) this.onGesture('clap');
    if (!this.controlsEnabled) { this.latestHands = []; this.status = 'clap-ready'; return; }
    const detections = this.handPreference === 'both' ? detected : detected.filter(({ label }) => label === 'Left');
    const existing = [...this.handStates.values()];
    const candidates = [];
    detections.forEach((detection, index) => {
      existing.forEach((state) => {
        const movement = distance(detection.hand[0], state.previousWrist);
        // Model result order is not stable. Wrist continuity and handedness
        // keep independent pinches attached to the same physical hands.
        if (movement < .35) candidates.push({ state, index, cost: movement + (state.label && detection.label && state.label !== detection.label ? .16 : 0) });
      });
    });
    candidates.sort((a, b) => a.cost - b.cost);
    const assigned = new Map();
    const used = new Set();
    for (const candidate of candidates) {
      if (assigned.has(candidate.index) || used.has(candidate.state.handId)) continue;
      assigned.set(candidate.index, candidate.state);
      used.add(candidate.state.handId);
    }
    this.latestHands = [];
    detections.forEach(({ hand, label }, index) => {
      let state = assigned.get(index);
      if (!state) {
        state = { handId: `hand-${this.nextHandId++}`, cursor: { x: .5, y: .5 }, pinchWasDown: false, pinchStart: null, lastPointAt: -Infinity, lastHandAt: now, previousWrist: hand[0], label };
        this.handStates.set(state.handId, state);
      }
      state.lastHandAt = now;
      state.previousWrist = { ...hand[0] };
      if (label) state.label = label;
      this._point(hand, now, state);
    });
    this.status = detections.length ? 'tracking' : 'searching';
  }

  _point(hand, now, state = this) {
    const palmWidth = Math.max(distance(hand[5], hand[17]), distance(hand[0], hand[9]) * .65, .025);
    const pinchRatio = distance(hand[4], hand[8]) / palmWidth;
    const pinchDown = pinchRatio < (state.pinchWasDown ? .58 : .36);
    // Length-based pointing also works with a tilted hand and a top-mounted
    // camera; testing tip.y alone rejected normal horizontal pointing.
    const indexUp = distance(hand[8], hand[0]) > distance(hand[6], hand[0]) * 1.08;
    const active = indexUp || pinchDown || state.pinchWasDown;
    if (active) {
      state.lastPointAt = now;
      const projected = this._project(hand[8]);
      const target = { x: clamp(projected.x), y: clamp(projected.y) };
      const alpha = state.pinchWasDown ? .72 : .6;
      if (now - state.lastCursorAt > 300 || !state.lastCursorAt) Object.assign(state.cursor, target);
      else {
        state.cursor.x += (target.x - state.cursor.x) * alpha;
        state.cursor.y += (target.y - state.cursor.y) * alpha;
      }
      state.lastCursorAt = now;
    }
    const screenHand = hand.map((point) => this._project(point));
    const detail = { handId: state.handId, handedness: state.label === 'Left' ? 'right' : state.label === 'Right' ? 'left' : '', hand, screenHand, cursor: { ...state.cursor }, indexUp: active, pinchDown };
    this.latestHands = this.latestHands.filter((tracked) => tracked.handId !== state.handId);
    this.latestHands.push(detail);
    this.onGesture('pointer-move', detail);
    const pointer = { ...state.cursor, handId: state.handId, hand };
    if (pinchDown && !state.pinchWasDown && now - state.lastPointAt < 250) {
      state.pinchStart = { ...state.cursor };
      state.pinchConsumed = this.onGesture('pointer-down', pointer) === true;
    } else if (pinchDown && state.pinchWasDown) {
      this.onGesture('pointer-drag', pointer);
    } else if (!pinchDown && state.pinchWasDown) {
      // A renderer can consume the release when a held item exists; a
      // drag must never click an unrelated control underneath its release.
      const handled = this.onGesture('pointer-up', pointer);
      if (!handled && !state.pinchConsumed && state.pinchStart && distance(state.cursor, state.pinchStart) < .06) {
        this.onGesture('pointer-click', pointer);
      }
      state.pinchStart = null;
      state.pinchConsumed = false;
    }
    state.pinchWasDown = pinchDown;
  }

  _project(point) {
    const bounds = this.video?.closest?.('#app-shell')?.getBoundingClientRect();
    if (!bounds?.width || !bounds?.height || !this.video?.videoWidth || !this.video?.videoHeight) {
      return { x: 1 - point.x, y: point.y, z: point.z };
    }
    const scale = Math.max(bounds.width / this.video.videoWidth, bounds.height / this.video.videoHeight);
    const renderedWidth = this.video.videoWidth * scale;
    const renderedHeight = this.video.videoHeight * scale;
    const offsetX = (bounds.width - renderedWidth) / 2;
    const offsetY = (bounds.height - renderedHeight) / 2;
    return { x: 1 - (offsetX + point.x * renderedWidth) / bounds.width, y: (offsetY + point.y * renderedHeight) / bounds.height, z: point.z };
  }
}

function clamp(value) { return Math.max(0, Math.min(1, value)); }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
