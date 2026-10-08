// Rendering cadence follows visible work. Audio and wake recognition own their
// independent clocks; a sleeping or hidden page needs no scene frames.
export function renderFrameRate({ hidden, sleeping, mode, depthEnabled, avatarVisible, motionFps = 30 }) {
  if (hidden || sleeping) return 0;
  if (mode==='ar')return 30;
  if (depthEnabled || avatarVisible)return motionFps>=60?60:30;
  return 12;
}

export class RenderBudget {
  constructor() { this.lastFrameAt = null; this.targetFps = 0; this.frames = 0; }
  shouldRender(now, context) {
    const target = renderFrameRate(context);
    if (target !== this.targetFps) this.lastFrameAt = null;
    this.targetFps = target;
    if (!target) return false;
    if (this.lastFrameAt !== null && now - this.lastFrameAt < 1000 / target - 1) return false;
    this.lastFrameAt = now;
    this.frames++;
    return true;
  }
  reset() { this.lastFrameAt = null; }
  snapshot() { return { targetFps: this.targetFps, frames: this.frames }; }
}

// Flat UI, video and the 2D avatar own their animation clocks. The room needs
// new pixels only after a change, during the reveal, or while depth is enabled.
export class SceneRenderBudget {
  constructor({ maxDynamicFps = 30 } = {}) { this.dirty = true; this.dynamic = false; this.frames = 0; this.maxDynamicFps = maxDynamicFps; this.lastDrawAt = null; }
  invalidate() { this.dirty = true; }
  shouldRender({ hidden, sleeping, depthEnabled, awakening, mode, now }) {
    if (hidden || sleeping) return false;
    const dynamic = Boolean(awakening || (depthEnabled && mode !== 'ar'));
    const changed = this.dirty || dynamic !== this.dynamic;
    if (!changed && dynamic && Number.isFinite(now) && this.lastDrawAt !== null && now - this.lastDrawAt < 1000 / this.maxDynamicFps - 1) return false;
    const draw = this.dirty || dynamic || this.dynamic;
    this.dynamic = dynamic;
    this.dirty = false;
    if (draw) { this.frames++; if (Number.isFinite(now)) this.lastDrawAt = now; }
    return draw;
  }
  snapshot() { return { frames: this.frames, dynamic: this.dynamic, dirty: this.dirty, maxDynamicFps: this.maxDynamicFps }; }
}
