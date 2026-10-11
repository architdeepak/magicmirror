// Rendering cadence follows visible work. Audio and wake recognition own their
// independent clocks; a sleeping or hidden page needs no scene frames.
export function displayMotionRate(frequency) {
  return Number.isFinite(frequency) && frequency >= 15 ? Math.min(60,Math.round(frequency)) : 60;
}
// Frame pacing against vsync. A strict `elapsed >= 1000/fps - 1` test drops
// every other callback when the target equals the display rate: on a 30 Hz
// panel rAF fires every 33.33 ms and 1000/30 - 1 is 32.3, but a target of 29
// (or any 30 Hz TV that reports 29.97) wants 33.5 ms, so half the frames were
// skipped and talking ran at ~15-23 fps. The gate now allows up to half a
// refresh period of slack, measured from the callbacks it actually sees.
export class FramePacer {
  constructor() { this.lastCallAt = null; this.period = null; }
  reset() { this.lastCallAt = null; }
  observe(now) {
    if (this.lastCallAt !== null) {
      const delta = now - this.lastCallAt;
      if (delta > 4 && delta <= 40) this.period = this.period === null ? delta : this.period * .8 + delta * .2;
    }
    this.lastCallAt = now;
  }
  due(now, lastAt, fps) {
    if (lastAt === null || !Number.isFinite(lastAt)) return true;
    const interval = 1000 / fps;
    const slack = this.period === null ? 1 : Math.max(1, Math.min(this.period * .5, interval * .4));
    return now - lastAt >= interval - slack;
  }
}
export function renderFrameRate({ hidden, sleeping, mode, depthEnabled, avatarVisible, motionFps = 30 }) {
  if (hidden || sleeping) return 0;
  const motion = Number.isFinite(motionFps) ? Math.min(60,Math.max(15,motionFps)) : 30;
  if (mode==='ar')return Math.min(30,motion);
  if (depthEnabled || avatarVisible)return motion;
  return 12;
}

export class RenderBudget {
  constructor() { this.lastFrameAt = null; this.targetFps = 0; this.frames = 0; this.pacer = new FramePacer(); }
  shouldRender(now, context) {
    this.pacer.observe(now);
    const target = renderFrameRate(context);
    if (target !== this.targetFps) this.lastFrameAt = null;
    this.targetFps = target;
    if (!target) return false;
    if (!this.pacer.due(now, this.lastFrameAt, target)) return false;
    this.lastFrameAt = now;
    this.frames++;
    return true;
  }
  reset() { this.lastFrameAt = null; this.pacer.reset(); }
  snapshot() { return { targetFps: this.targetFps, frames: this.frames }; }
}

// Flat UI, video and the 2D avatar own their animation clocks. The room needs
// new pixels only after a change, during the reveal, or while depth is enabled.
export class SceneRenderBudget {
  constructor({ maxDynamicFps = 30 } = {}) { this.dirty = true; this.dynamic = false; this.frames = 0; this.maxDynamicFps = maxDynamicFps; this.lastDrawAt = null; this.pacer = new FramePacer(); }
  invalidate() { this.dirty = true; }
  shouldRender({ hidden, sleeping, depthEnabled, awakening, mode, now }) {
    if (hidden || sleeping) return false;
    if (Number.isFinite(now)) this.pacer.observe(now);
    const dynamic = Boolean(awakening || (depthEnabled && mode !== 'ar'));
    const changed = this.dirty || dynamic !== this.dynamic;
    if (!changed && dynamic && Number.isFinite(now) && this.lastDrawAt !== null && !this.pacer.due(now, this.lastDrawAt, this.maxDynamicFps)) return false;
    const draw = this.dirty || dynamic || this.dynamic;
    this.dynamic = dynamic;
    this.dirty = false;
    if (draw) { this.frames++; if (Number.isFinite(now)) this.lastDrawAt = now; }
    return draw;
  }
  snapshot() { return { frames: this.frames, dynamic: this.dynamic, dirty: this.dirty, maxDynamicFps: this.maxDynamicFps }; }
}
