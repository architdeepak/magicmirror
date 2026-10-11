// Quiet enchanted-hall atmosphere, synthesised locally: a slow detuned pad,
// a breath of air, and sparse crystal bells. One AudioContext graph that ducks
// under speech/media and is retired immediately on mute, sleep, disabling, or
// renderer shutdown. Nothing loops audibly: every layer drifts on its own LFO.
const PAD = [110, 164.81, 220, 261.63, 329.63];        // A2 E3 A3 C4 E4  (A minor add9 feel)
const BELLS = [440, 523.25, 587.33, 659.25, 783.99];   // A4 C5 D5 E5 G5   (minor pentatonic)

export class MirrorAmbience {
  constructor() { this.enabled = false; this.volume = .09; this.epoch = 0; this.nodes = []; this.timers = []; this.context = { muted: false, duck: false }; }

  async setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled || this.context.muted) { this.stop(); return; }
    const epoch = ++this.epoch;
    try {
      this.audio ||= new AudioContext(); await this.audio.resume();
      if (epoch !== this.epoch || !this.enabled || this.context.muted) return;
      if (!this.master) this._build();
      this.sync();
    } catch { if (epoch === this.epoch) this.stop(); }
  }

  _build() {
    const audio = this.audio, keep = (...nodes) => { this.nodes.push(...nodes); return nodes[0]; };
    const master = this.master = keep(audio.createGain()); master.gain.value = 0; master.connect(audio.destination);
    // Shared tail: two feedback delays give cheap, soft space.
    const room = keep(audio.createGain()); room.gain.value = .5; room.connect(master);
    for (const [time, feedback] of [[.29, .42], [.47, .36]]) {
      const delay = keep(audio.createDelay(1)), loop = keep(audio.createGain()), tone = keep(audio.createBiquadFilter());
      delay.delayTime.value = time; loop.gain.value = feedback; tone.type = 'lowpass'; tone.frequency.value = 2400;
      room.connect(delay); delay.connect(tone); tone.connect(loop); loop.connect(delay); tone.connect(master);
    }
    // Pad: each note is two slightly detuned voices breathing on its own slow LFO.
    const padBus = keep(audio.createGain()), padFilter = keep(audio.createBiquadFilter());
    padBus.gain.value = .5; padFilter.type = 'lowpass'; padFilter.frequency.value = 850; padFilter.Q.value = .4;
    padBus.connect(padFilter); padFilter.connect(master); padFilter.connect(room);
    const sweep = keep(audio.createOscillator()), sweepDepth = keep(audio.createGain());
    sweep.frequency.value = .031; sweepDepth.gain.value = 380; sweep.connect(sweepDepth); sweepDepth.connect(padFilter.frequency); sweep.start();
    PAD.forEach((frequency, index) => {
      for (const cents of [-5, 6]) {
        const voice = keep(audio.createOscillator()), level = keep(audio.createGain()), lfo = keep(audio.createOscillator()), depth = keep(audio.createGain());
        voice.type = index % 2 ? 'sine' : 'triangle'; voice.frequency.value = frequency; voice.detune.value = cents;
        level.gain.value = .045 / (1 + index * .35);
        lfo.frequency.value = .05 + index * .017 + (cents > 0 ? .011 : 0); depth.gain.value = level.gain.value * .8;
        lfo.connect(depth); depth.connect(level.gain);
        voice.connect(level); level.connect(padBus); voice.start(); lfo.start();
      }
    });
    // Air: smoothed noise, band-passed, slowly breathing.
    const length = audio.sampleRate * 6, noise = audio.createBuffer(1, length, audio.sampleRate), samples = noise.getChannelData(0);
    let low = 0; for (let i = 0; i < length; i++) { low = .93 * low + .07 * (Math.random() * 2 - 1); samples[i] = low * 3; }
    const air = keep(audio.createBufferSource()), airBand = keep(audio.createBiquadFilter()), airLevel = keep(audio.createGain()), airLfo = keep(audio.createOscillator()), airDepth = keep(audio.createGain());
    air.buffer = noise; air.loop = true; airBand.type = 'bandpass'; airBand.frequency.value = 1500; airBand.Q.value = .5;
    airLevel.gain.value = .035; airLfo.frequency.value = .07; airDepth.gain.value = .025; airLfo.connect(airDepth); airDepth.connect(airLevel.gain);
    air.connect(airBand); airBand.connect(airLevel); airLevel.connect(master); air.start(); airLfo.start();
    this._ringLater();
  }

  _ringLater() {
    const master = this.master;
    const wait = 7000 + Math.random() * 13000;
    const timer = setTimeout(() => {
      this.timers = this.timers.filter(pending => pending !== timer);
      if (master !== this.master || !this.master || !this.enabled || this.context.muted) return;
      this._ring(); this._ringLater();
    }, wait);
    this.timers.push(timer);
  }

  _ring() {
    if (!this.master || this.context.duck || this.context.muted || !this.audio) return;
    const audio = this.audio, now = audio.currentTime, base = BELLS[Math.floor(Math.random() * BELLS.length)];
    const out = audio.createGain(); out.gain.value = .5; out.connect(this.master);
    for (const [ratio, weight, decay] of [[1, 1, 3.6], [2.76, .35, 2.2], [5.4, .12, 1.2]]) {
      const tone = audio.createOscillator(), level = audio.createGain();
      tone.type = 'sine'; tone.frequency.value = base * ratio;
      level.gain.setValueAtTime(0, now); level.gain.linearRampToValueAtTime(.05 * weight, now + .01);
      level.gain.exponentialRampToValueAtTime(.0001, now + decay);
      tone.connect(level); level.connect(out); tone.start(now); tone.stop(now + decay + .05);
      tone.onended = () => { try { tone.disconnect(); level.disconnect(); } catch {} };
    }
    setTimeout(() => { try { out.disconnect(); } catch {} }, 4200);
  }

  setContext(context) {
    const wasMuted = this.context.muted; Object.assign(this.context, context);
    if (this.context.muted) { this.stop(); return; }
    if (wasMuted && this.enabled) void this.setEnabled(true); else this.sync();
  }
  sync() { if (this.master) this.master.gain.setTargetAtTime(this.enabled && !this.context.duck ? this.volume : 0, this.audio.currentTime, .6); }
  stop() {
    this.epoch++;
    for (const timer of this.timers) clearTimeout(timer); this.timers = [];
    if (this.master) this.master.gain.value = 0;
    for (const node of this.nodes) { try { node.stop?.(); node.disconnect(); } catch {} }
    this.nodes = []; this.master = null;
    if (this.audio?.state === 'running') void this.audio.suspend().catch(() => {});
  }
  destroy() { this.enabled = false; this.stop(); void this.audio?.close().catch(() => {}); }
}
