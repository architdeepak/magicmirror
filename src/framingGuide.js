import { projectCameraPoint, visiblePoint } from './garmentGeometry.js';
export function evaluateFraming(pose, video, viewport, category = 'top') {
  const ids = category === 'bottoms' ? [23, 24, 25, 26, 27, 28] : category === 'skirt' ? [23, 24, 25, 26] : [11, 12, 23, 24];
  if (!pose || !ids.every(i => visiblePoint(pose[i]))) return { ready: false, reason: 'missing', message: category === 'bottoms' ? 'Step back until your hips, knees and feet are visible' : 'Step back until your shoulders and hips are visible' };
  const points = ids.map(i => projectCameraPoint(pose[i], video, viewport));
  const x0 = Math.min(...points.map(p => p.x)), x1 = Math.max(...points.map(p => p.x));
  const y0 = Math.min(...points.map(p => p.y)), y1 = Math.max(...points.map(p => p.y));
  if (y0 < viewport.height * .06 || y1 > viewport.height * .9 || x1 - x0 > viewport.width * .88) return { ready: false, reason: 'close', message: 'Take a small step back · keep the whole garment in view' };
  if (x0 < viewport.width * .07 || x1 > viewport.width * .93) return { ready: false, reason: 'center', message: 'Move toward the center of the mirror' };
  if (x1 - x0 < viewport.width * .13) return { ready: false, reason: 'far', message: 'Step a little closer' };
  return { ready: true, reason: 'ready', message: 'Nicely framed · hold your pose for a look photo' };
}
export class FramingGuide {
  constructor(shell, overlay, video) {
    this.shell = shell; this.overlay = overlay; this.video = video; this.lastAt = 0; this.lastMessage = '';
    this.enabled = localStorage.getItem('mirror.framing') !== 'false';
    this.element = document.createElement('div'); this.element.className = 'framing-guide'; this.element.hidden = true;
    this.element.innerHTML = '<svg viewBox="0 0 300 420" aria-hidden="true"><path class="frame-brackets" d="M45 95V35H105 M195 35H255V95 M255 325V385H195 M105 385H45V325"/><path class="frame-person" d="M125 95Q125 58 150 58Q175 58 175 95Q175 122 150 122Q125 122 125 95 M95 195Q88 140 128 135 M172 135Q212 140 205 195 M113 170L109 297Q150 318 191 297L187 170 M109 297L95 380 M191 297L205 380"/></svg><p role="status"></p>';
    shell.append(this.element);
  }
  update({ mode, desktopActive, sleeping, liveAI, rendered, editorOpen }, now = performance.now()) {
    const active = this.enabled && mode === 'ar' && !desktopActive && !sleeping && !liveAI && !rendered && !editorOpen;
    this.element.hidden = !active;
    if (!active || now - this.lastAt < 250) return;
    this.lastAt = now;
    const tray = this.shell.querySelector('.studio-tray')?.getBoundingClientRect(), shell = this.shell.getBoundingClientRect();
    if (tray) this.element.style.bottom = `${Math.max(shell.height * .2, shell.bottom - tray.top + 12)}px`;
    const camera = this.overlay.getLiveState(now);
    const state = !camera.cameraActive ? { ready: false, reason: 'camera', message: 'Turn on the camera to frame your look' }
      : evaluateFraming(this.overlay.tracker.getPose(now), { width: this.video.videoWidth, height: this.video.videoHeight }, this.overlay.viewport, this.overlay.item?.category);
    this.element.dataset.ready = String(state.ready);
    this.element.dataset.reason = state.reason;
    if (state.message !== this.lastMessage) { this.lastMessage = state.message; this.element.querySelector('p').textContent = state.message; }
  }
}
