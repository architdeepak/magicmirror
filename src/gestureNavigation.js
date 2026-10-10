import { HandTracking } from './handTracking.js';

// Intentional holds and release-to-rearm keep one pose from repeatedly
// activating controls. Directions match the mirrored camera preview.
export class GestureNavigation {
  constructor(video, onGesture = () => {}, onStatus = () => {}) {
    this.video = video;
    this.onGesture = onGesture;
    this.tracker = new HandTracking(video, (hand, now) => this._consume(hand, now), (status, message) => {
      this.status = this.enabled ? status : 'off';
      onStatus(status, message);
    });
    this.stream = null;
    this.enabled = false;
    this.lastGestureAt = 0;
    this.samples = [];
    this.openSince = 0;
    this.pinchSince = 0;
    this.latched = false;
    this.absentSince = 0;
    this.lastSampleAt = 0;
    this.status = 'off';
  }

  init() { return this.tracker.init(); }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.tracker.setEnabled(this.enabled);
    this._reset(); this.latched = false; this.absentSince = 0; this.lastSampleAt = 0;
    this.status = this.enabled ? this.tracker.ready ? 'ready' : 'loading' : 'off';
  }

  update(now = performance.now()) {
    if (this.stream !== this.video.srcObject) {
      this.stream = this.video.srcObject;
      this._reset(); this.latched = false; this.absentSince = 0; this.lastSampleAt = 0;
      if (this.enabled && this.tracker.ready) this.status = 'searching';
    }
    if (!this.enabled || !this.stream || this.stream.active === false || this.video.readyState < 2) {
      if (!this.enabled) this.status = 'off';
      else if (this.status !== 'unavailable') this.status = 'camera-off';
      this._reset(); this.latched = false; this.absentSince = 0; this.lastSampleAt = 0;
    }
    this.tracker.update(now);
  }

  _consume(hand, now) {
    if (!this.enabled || !this.video.srcObject || this.video.srcObject.active === false || this.video.srcObject !== this.stream || this.video.readyState < 2) return;
    if (this.lastSampleAt && now - this.lastSampleAt > 400) this._reset();
    this.lastSampleAt = now;
    if (!hand) {
      if (!this.absentSince) this.absentSince = now;
      if (now - this.absentSince > 250) this._reset();
      this.status = 'searching'; return;
    }
    this.absentSince = 0; this.status = 'tracking'; this._interpret(hand, now);
  }

  destroy() { this.enabled = false; this.tracker.destroy(); this._reset(); this.latched = false; this.status = 'off'; }

  _reset() {
    this.samples = [];
    this.openSince = 0;
    this.pinchSince = 0;
    this.latched = false;
  }

  _interpret(hand, now) {
    if (hand.length < 21) { this._reset(); return; }
    const aspect = this.video.videoWidth / Math.max(1, this.video.videoHeight);
    const measure = (a, b) => Math.hypot((a.x - b.x) * aspect, a.y - b.y);
    const palmWidth = measure(hand[5], hand[17]);
    if (palmWidth < .025) { this._reset(); return; }
    const extended = [8, 12, 16, 20].filter((tip) =>
      measure(hand[tip], hand[0]) > measure(hand[tip - 2], hand[0]) * 1.12
      && measure(hand[tip], hand[tip - 3]) > measure(hand[tip - 2], hand[tip - 3]) * 1.25
    ).length;
    const pinch = extended >= 2 && measure(hand[4], hand[8]) < palmWidth * .42;
    const open = extended >= 3 && !pinch;
    if (!pinch && !open) { this._reset(); return; }
    if (this.latched || now - this.lastGestureAt < 800) return;
    if (pinch) {
      this.openSince = 0;
      this.samples = [];
      if (!this.pinchSince) this.pinchSince = now;
      if (now - this.pinchSince >= 250) this._emit('pinch', now);
      return;
    }
    this.pinchSince = 0;
    const point = { x: 1 - (hand[0].x + hand[9].x) / 2, y: (hand[0].y + hand[9].y) / 2, at: now };
    if (!this.openSince) this.openSince = now;
    this.samples.push(point);
    this.samples = this.samples.filter((sample) => now - sample.at < 430);
    const first = this.samples[0];
    const dx = point.x - first.x;
    const dy = point.y - first.y;
    if (now - first.at >= 95 && Math.abs(dx) > .18 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      this._emit(dx > 0 ? 'swipe-right' : 'swipe-left', now);
    } else if (now - first.at >= 95 && Math.abs(dy) > .16 && Math.abs(dy) > Math.abs(dx) * 1.4) {
      this._emit(dy > 0 ? 'swipe-down' : 'swipe-up', now);
    } else if (now - this.openSince >= 700) {
      // A palm must be held still; a slow swipe must not be read as Stop.
      const spread = Math.max(...this.samples.map((sample) => Math.hypot(sample.x - point.x, sample.y - point.y)));
      if (spread < .05) this._emit('palm', now);
    }
  }

  _emit(type, now) {
    this.lastGestureAt = now;
    this._reset();
    this.latched = true;
    this.onGesture(type);
  }
}
