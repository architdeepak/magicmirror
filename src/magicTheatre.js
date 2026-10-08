import { GpuMirrorFog } from './gpuMirrorFog.js';
import { displayProfile, boundedSurface } from './displayQuality.js';
import { MirrorFog } from './mirrorFog.js';
// Short, local theatrical cues. No permanent particle loop or additional model.
export class MagicTheatre {
  constructor(shell, { softwareGraphics = true, quality = 'auto' } = {}) {
    this.shell = shell; this.frame = null; this.nodes = []; this.epoch = 0;
    this.canvas = document.createElement('canvas'); this.canvas.className = 'magic-dust'; this.canvas.hidden = true; shell.append(this.canvas);
    this.reduced = localStorage.getItem('mirror.reduced-motion') === 'true' || matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.sound = localStorage.getItem('mirror.magic-sounds') === 'true';
    this.cpuCanvas=this.canvas;this.softwareGraphics=softwareGraphics;this.quality=quality;this.backend='cpu';
    this.applyPreferences();
  }
  setQuality(id) { this.cancel();this.quality=['eco','auto','hd'].includes(id)?id:'auto';this.fog=null; }
  selectSurface(allowGpu = true) {
    const profile=displayProfile(this.quality),previous=this.canvas;previous.hidden=true;
    if(allowGpu&&!this.softwareGraphics&&this.quality!=='eco'&&!this.gpuFailed){
      try{if(!this.gpu){const canvas=document.createElement('canvas');canvas.className='magic-dust';canvas.hidden=true;this.gpu=new GpuMirrorFog(canvas);this.shell.append(canvas);}if(this.gpu.lost)throw new Error('Smoke graphics unavailable');this.canvas=this.gpu.canvas;this.backend='gpu';}
      catch(error){this.gpuFailed=true;this.fallbackReason=error.message;this.gpu?.dispose();this.gpu=null;this.canvas=this.cpuCanvas;this.backend='cpu';}
    }else{this.canvas=this.cpuCanvas;this.backend='cpu';}
    const bounds=this.shell.getBoundingClientRect(),dpr=typeof window==='undefined'?1:window.devicePixelRatio||1;
    const surface=boundedSurface(bounds.width,bounds.height,dpr,this.backend==='gpu'?profile.fogPixels:Math.min(profile.fogPixels,1_500_000),2);
    this.canvas.width=surface.width;this.canvas.height=surface.height;
    if(this.backend==='cpu'&&!this.fog){const width=this.quality==='eco'?160:this.quality==='hd'?320:240;this.fog=new MirrorFog(width,width*1.5);}
  }
  snapshot() { return { quality:this.quality,backend:this.backend,resolution:[this.canvas.width,this.canvas.height],field:this.backend==='cpu'?[this.fog?.canvas.width||0,this.fog?.canvas.height||0]:null,frames:this.backend==='gpu'?this.gpu?.frames||0:this.fog?.frames||0,targetFps:this.backend==='gpu'?displayProfile(this.quality).fogFps:30,fallbackReason:this.fallbackReason||null }; }
  applyPreferences() { this.shell.dataset.reducedMotion = String(this.reduced); }
  play(kind = 'wake', { muted = false } = {}) {
    this.cancel(); this.shell.dataset.magicCue = kind;
    if (kind === 'wake' && this.sound && !muted) void this.chime();
    if (this.reduced) { this.endTimer = setTimeout(() => this.cancel(), 650); return; }
    this.selectSurface(['wake','arrival'].includes(kind));

    this.canvas.hidden = false; const start = performance.now(), duration = kind === 'wake' ? 3000 : kind === 'arrival' ? 1100 : 650;
    let last = -Infinity;
    const draw = now => {
      const t = (now - start) / duration;
      if (t >= 1 || document.hidden) { this.cancel(); return; }
      this.frame = requestAnimationFrame(draw);
      const fps=this.backend==='gpu'?displayProfile(this.quality).fogFps:30;
      if (now - last < 1000 / fps - .5) return; last = now;
      this.renderCue(kind,t);
    };
    this.frame = requestAnimationFrame(draw);
  }
  renderCue(kind, t) {
    if(this.backend==='gpu'){
      try{this.gpu.render(t,kind==='arrival',displayProfile(this.quality).fogSlices);return;}
      catch(error){this.gpuFailed=true;this.fallbackReason=error.message;this.selectSurface(false);this.canvas.hidden=false;}
    }
    const ctx=this.canvas.getContext('2d'), w=this.canvas.width, h=this.canvas.height;
      ctx.clearRect(0, 0, w, h);
      if (kind === 'wake' || kind === 'arrival') {
        ctx.drawImage(this.fog.render(t, kind === 'arrival'), 0, 0, w, h);
      } else {
        // Brief diffuse reflection when selecting/capturing, without symbols.
        const light = ctx.createRadialGradient(w * .5, h * .5, 0, w * .5, h * .5, w * .48);
        light.addColorStop(0, 'rgba(210,222,235,0)'); light.addColorStop(.65, 'rgba(204,214,225,.09)'); light.addColorStop(1, 'rgba(210,222,235,0)');
        ctx.globalAlpha = Math.sin(t * Math.PI); ctx.fillStyle = light; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
      }
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
