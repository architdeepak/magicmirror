// Short, local theatrical cues. No permanent particle loop or additional model.
export class MagicTheatre {
  constructor(shell) {
    this.shell = shell; this.frame = null; this.nodes = []; this.epoch = 0;
    this.canvas = document.createElement('canvas'); this.canvas.className = 'magic-dust'; this.canvas.hidden = true; shell.append(this.canvas);
    this.reduced = localStorage.getItem('mirror.reduced-motion') === 'true' || matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.sound = localStorage.getItem('mirror.magic-sounds') === 'true';
    this.applyPreferences();
  }
  applyPreferences() { this.shell.dataset.reducedMotion = String(this.reduced); }
  play(kind = 'wake', { muted = false } = {}) {
    this.cancel(); this.shell.dataset.magicCue = kind;
    if (kind === 'wake' && this.sound && !muted) void this.chime();
    const bounds = this.shell.getBoundingClientRect(), scale = Math.min(1, 720 / bounds.width, 1100 / bounds.height);
    this.canvas.width = Math.max(1, Math.round(bounds.width * scale)); this.canvas.height = Math.max(1, Math.round(bounds.height * scale));
    if (this.reduced) { this.endTimer = setTimeout(() => this.cancel(), 650); return; }
    const ctx = this.canvas.getContext('2d'), w = this.canvas.width, h = this.canvas.height;
    this.canvas.hidden = false; const start = performance.now(), duration = kind === 'wake' ? 2200 : 650;
    let last = -Infinity;
    const draw = now => {
      const t = (now - start) / duration;
      if (t >= 1 || document.hidden) { this.cancel(); return; }
      this.frame = requestAnimationFrame(draw);
      if (now - last < 1000 / 24) return; last = now;
      ctx.clearRect(0, 0, w, h);
      const fade = Math.sin(t * Math.PI);
      if (kind === 'wake') for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3 + t * Math.PI * 2.7, radius = Math.min(w * .43, h * .3);
        const point = (offset, distance) => ({ x: w / 2 + Math.cos(angle + offset) * radius * distance, y: h * .45 + Math.sin(angle + offset) * radius * distance * 1.18 });
        const a = point(0, .3), b = point(.5, .8), c = point(1.8, .9), d = point(2.6, 1);
        const silk = ctx.createLinearGradient(a.x, a.y, d.x, d.y);
        silk.addColorStop(0, 'rgba(216,190,245,0)'); silk.addColorStop(.5, i % 2 ? 'rgba(234,211,166,.24)' : 'rgba(191,152,231,.23)'); silk.addColorStop(1, 'rgba(220,194,247,0)');
        ctx.globalAlpha = fade; ctx.strokeStyle = silk; ctx.lineCap = 'round';
        for (const width of [14, 5, 1]) { ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.bezierCurveTo(b.x,b.y,c.x,c.y,d.x,d.y); ctx.stroke(); }
      }
      const count = kind === 'wake' ? 32 : 12;
      for (let i = 0; i < count; i++) {
        const phase = i * 2.39996 + t * 7, radius = w * (.08 + i / 32 * .37) * (1 - t * .27);
        const x = w / 2 + Math.cos(phase) * radius, y = h * .45 + Math.sin(phase) * radius * 1.25;
        ctx.globalAlpha = fade * (.35 + i % 4 * .16); ctx.fillStyle = i % 3 ? '#f5d79e' : '#d4bbff';
        ctx.beginPath(); ctx.arc(x, y, 1 + i % 3, 0, Math.PI * 2); ctx.fill();
        if (i % 5 === 0) { ctx.fillRect(x - 6, y - .5, 12, 1); ctx.fillRect(x - .5, y - 6, 1, 12); }
      }
      ctx.globalAlpha = 1;
    };
    this.frame = requestAnimationFrame(draw);
  }
  async chime() {
    const epoch = this.epoch;
    try {
      this.audio ||= new AudioContext(); await this.audio.resume();
      if (epoch !== this.epoch || !this.shell.dataset.magicCue) return;
      const now = this.audio.currentTime;
      for (const [i, frequency] of [523.25, 622.25, 783.99, 1046.5].entries()) {
        const oscillator = this.audio.createOscillator(), gain = this.audio.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, now + i * .12); gain.gain.linearRampToValueAtTime(.035, now + i * .12 + .02); gain.gain.exponentialRampToValueAtTime(.0001, now + i * .12 + .65);
        oscillator.connect(gain); gain.connect(this.audio.destination); oscillator.start(now + i * .12); oscillator.stop(now + i * .12 + .7); this.nodes.push(oscillator);
      }
    } catch { /* A blocked audio context leaves visual feedback available. */ }
  }
  cancel() {
    this.epoch++;
    if (this.frame !== null) cancelAnimationFrame(this.frame); this.frame = null;
    clearTimeout(this.endTimer); this.canvas.hidden = true; delete this.shell.dataset.magicCue;
    for (const node of this.nodes) { try { node.stop(); node.disconnect(); } catch {} } this.nodes = [];
    if (this.audio?.state === 'running') void this.audio.suspend().catch(() => {});
  }
}
