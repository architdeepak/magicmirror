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
  setMotionFps(fps) { this.motionFps=Math.max(15,Math.min(60,Number(fps)||60)); }
  targetFps() { return Math.min(this.motionFps??60,displayProfile(this.quality).fogFps,this.backend==='gpu'?60:30); }
  selectSurface(allowGpu = true) {
    const profile=displayProfile(this.quality),previous=this.canvas;previous.hidden=true;
    // The shader field is the default on any real GPU (measured 60 fps at 4K once
    // the full-screen blend layers were removed); software rendering, lost
    // contexts and an explicit mirror.cpu-smoke flag fall back to the CPU field.
    const cpuSmoke=typeof localStorage!=='undefined'&&localStorage.getItem('mirror.cpu-smoke')==='true';
    if(!cpuSmoke&&allowGpu&&!this.softwareGraphics&&!this.gpuFailed){
      try{if(!this.gpu){const canvas=document.createElement('canvas');canvas.className='magic-dust';canvas.hidden=true;this.gpu=new GpuMirrorFog(canvas);this.shell.append(canvas);}if(this.gpu.lost)throw new Error('Smoke graphics unavailable');this.canvas=this.gpu.canvas;this.backend='gpu';}
      catch(error){this.gpuFailed=true;this.fallbackReason=error.message;this.gpu?.dispose();this.gpu=null;this.canvas=this.cpuCanvas;this.backend='cpu';}
    }else{this.canvas=this.cpuCanvas;this.backend='cpu';}
    const bounds=this.shell.getBoundingClientRect(),dpr=typeof window==='undefined'?1:window.devicePixelRatio||1;
    const surface=boundedSurface(bounds.width,bounds.height,dpr,this.backend==='gpu'?profile.fogPixels:Math.min(profile.fogPixels,1_500_000),2);
    this.canvas.width=surface.width;this.canvas.height=surface.height;
    if(this.backend==='cpu'&&!this.fog){const width=this.quality==='eco'?112:this.quality==='hd'?256:216;this.fog=new MirrorFog(width,width*1.5,{lowDetail:this.quality==='eco'});}
  }
  snapshot() { return { quality:this.quality,backend:this.backend,resolution:[this.canvas.width,this.canvas.height],field:this.backend==='cpu'?[this.fog?.canvas.width||0,this.fog?.canvas.height||0]:null,frames:this.backend==='gpu'?this.gpu?.frames||0:this.fog?.frames||0,targetFps:this.targetFps(),fallbackReason:this.fallbackReason||null }; }
  applyPreferences() { this.shell.dataset.reducedMotion = String(this.reduced); }
  play(kind = 'wake', { muted = false } = {}) {
    this.cancel(); this.shell.dataset.magicCue = kind;
    if (this.sound && !muted && ['wake','arrival','capture','select'].includes(kind)) void this.chime(kind);
    if (this.reduced) { this.endTimer = setTimeout(() => this.cancel(), 650); return; }
    this.selectSurface(['wake','arrival'].includes(kind));

    this.canvas.hidden = false; const start = performance.now(), duration = kind === 'wake' ? 3000 : kind === 'arrival' ? 1100 : 650;
    let last = -Infinity;
    const draw = now => {
      const t = (now - start) / duration;
      if (t >= 1 || document.hidden) { this.cancel(); return; }
      this.frame = requestAnimationFrame(draw);
      const fps=this.targetFps();
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
  async chime(kind = 'wake') {
    const epoch = this.epoch;
    try {
      this.audio ||= new AudioContext(); await this.audio.resume();
      if (epoch !== this.epoch || !this.shell.dataset.magicCue) return;
      const now = this.audio.currentTime;
      const master = this.audio.createGain(), filter = this.audio.createBiquadFilter();
      master.gain.value = kind === 'wake' ? .85 : .5;
      filter.type = 'lowpass'; filter.frequency.value = 3200;
      filter.connect(master); master.connect(this.audio.destination);
      const delay = this.audio.createDelay(.5), feedback = this.audio.createGain();
      delay.delayTime.value=.21; feedback.gain.value=.19;
      master.connect(delay); delay.connect(feedback); feedback.connect(delay); delay.connect(this.audio.destination);
      this.soundGraph = [master, filter, delay, feedback];
      // A breath of wind that rises with the cloud: band-passed noise swept
      // upward with a soft low swell under it. Synthesised; nothing to load.
      if (kind === 'wake' || kind === 'arrival') {
        const length = kind === 'wake' ? 2.4 : 1.1;
        const buffer = this.audio.createBuffer(1, Math.ceil(this.audio.sampleRate * length), this.audio.sampleRate), data = buffer.getChannelData(0);
        let low = 0; for (let i = 0; i < data.length; i++) { low = .86 * low + .14 * (Math.random() * 2 - 1); data[i] = low * 2.2; }
        const wind = this.audio.createBufferSource(), band = this.audio.createBiquadFilter(), air = this.audio.createGain();
        wind.buffer = buffer; band.type = 'bandpass'; band.Q.value = .9;
        band.frequency.setValueAtTime(260, now); band.frequency.exponentialRampToValueAtTime(kind === 'wake' ? 2600 : 1800, now + length * .8);
        air.gain.setValueAtTime(0.0001, now); air.gain.exponentialRampToValueAtTime(kind === 'wake' ? .5 : .22, now + length * .55); air.gain.exponentialRampToValueAtTime(.0001, now + length);
        wind.connect(band); band.connect(air); air.connect(master); wind.start(now); wind.stop(now + length + .05);
        const swell = this.audio.createOscillator(), swellGain = this.audio.createGain();
        swell.type = 'sine'; swell.frequency.setValueAtTime(55, now); swell.frequency.exponentialRampToValueAtTime(98, now + length * .7);
        swellGain.gain.setValueAtTime(0.0001, now); swellGain.gain.linearRampToValueAtTime(kind === 'wake' ? .22 : .1, now + length * .5); swellGain.gain.exponentialRampToValueAtTime(.0001, now + length);
        swell.connect(swellGain); swellGain.connect(master); swell.start(now); swell.stop(now + length + .05);
        this.nodes.push(wind, swell); this.soundGraph.push(band, air, swellGain);
      }
      const notes = kind === 'wake' ? [196,293.66,392,466.16] : kind === 'arrival' ? [293.66,392] : [392];
      for (const [i, frequency] of notes.entries()) for (const [partial, weight] of [[1,1],[2.01,.25],[3.97,.07]]) {
        const oscillator = this.audio.createOscillator(), gain = this.audio.createGain();
        const at=now+i*.105,tail=kind==='wake'?1.25:.55;
        oscillator.type='sine';oscillator.frequency.value=frequency*partial;
        gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.035*weight,at+.018);
        gain.gain.exponentialRampToValueAtTime(.0001,at+tail);
        oscillator.connect(gain);gain.connect(filter);oscillator.start(at);oscillator.stop(at+tail+.04);
        this.nodes.push(oscillator);this.soundGraph.push(gain);
      }
    } catch { /* A blocked audio context leaves visual feedback available. */ }
  }
  cancel() {
    this.epoch++;
    if (this.frame !== null) cancelAnimationFrame(this.frame); this.frame = null;
    clearTimeout(this.endTimer); this.canvas.hidden = true; delete this.shell.dataset.magicCue;
    for (const node of this.nodes) { try { node.stop(); node.disconnect(); } catch {} } this.nodes = [];
    for (const node of this.soundGraph || []) { try { node.disconnect(); } catch {} } this.soundGraph = [];
    if (this.audio?.state === 'running') void this.audio.suspend().catch(() => {});
  }
}
