// Prefer fewer, evenly timed frames before sacrificing portrait sharpness.
// Measurements exclude standby, hidden pauses and transitions between targets.
export class MotionQuality {
  constructor() { this.reset(); }
  reset() {
    this.motionFps = 60; this.avatarScale = 1; this.changes = 0;
    this.measuredFps = null; this.workMs = null; this.healthyWindows = 0;
    this.resetWindow();
  }
  resetWindow() { this.elapsed = 0; this.frames = 0; this.work = 0; this.requestedFps = null; }
  observe({ dt, workMs, requestedFps, active }) {
    if (!active || !Number.isFinite(dt) || dt <= 0 || !Number.isFinite(workMs) || workMs < 0
      || (dt > .5 && workMs < dt * 1000 * .5)) {
      this.resetWindow(); this.healthyWindows = 0; return false;
    }
    if (this.requestedFps !== requestedFps) { this.resetWindow(); this.requestedFps = requestedFps; this.healthyWindows = 0; }
    this.elapsed += dt; this.frames++; this.work += workMs;
    if (this.elapsed < 2) return false;
    const target = Math.min(requestedFps, this.motionFps);
    this.measuredFps = this.frames / this.elapsed;
    this.workMs = this.work / this.frames;
    const beforeFps = this.motionFps, beforeScale = this.avatarScale;
    if (this.measuredFps < target * .75) {
      this.healthyWindows = 0;
      if (target > 30) this.motionFps = 30;
      else this.avatarScale = Math.max(.6, +(this.avatarScale - .1).toFixed(1));
    } else if (this.measuredFps >= target * .95 && this.workMs < 1000 / requestedFps * .35) {
      // Recovery requires twelve seconds of steady cadence and spare work time.
      if (++this.healthyWindows >= 6) {
        if (this.avatarScale < 1) this.avatarScale = Math.min(1, +(this.avatarScale + .1).toFixed(1));
        else if (requestedFps > this.motionFps) this.motionFps = requestedFps;
        this.healthyWindows = 0;
      }
    } else this.healthyWindows = 0;
    this.elapsed = 0; this.frames = 0; this.work = 0;
    const changed = beforeFps !== this.motionFps || beforeScale !== this.avatarScale;
    if (changed) this.changes++;
    return changed;
  }
  snapshot() { return { motionFps: this.motionFps, avatarScale: this.avatarScale, measuredFps: this.measuredFps, workMs: this.workMs, changes: this.changes }; }
}
