// Rendering cadence follows visible work. Audio and wake recognition own their
// independent clocks; a sleeping or hidden page needs no scene frames.
export function renderFrameRate({ hidden, sleeping, mode, depthEnabled, avatarVisible }) {
  if (hidden || sleeping) return 0;
  if (depthEnabled || avatarVisible || mode === 'ar') return 30;
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
