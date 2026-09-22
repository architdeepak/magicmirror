// Reads live amplitude from either the mic or an <audio>/<video> element,
// so the puppet mouth can react to whatever's actually playing - your own
// test file today, the Realtime API's output audio stream later (just
// route that stream's HTMLAudioElement or MediaStream through here).

export class AudioLevel {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.data = null;
  }

  async fromMic() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this._setup(stream);
  }

  fromAudioElement(audioEl) {
    // Note: an element can only be connected to one AudioContext source once.
    const source = this.ctx
      ? this.ctx.createMediaElementSource(audioEl)
      : null;
    if (!this.ctx) this._initCtx();
    const src = this.ctx.createMediaElementSource(audioEl);
    src.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  fromStream(mediaStream) {
    this._setup(mediaStream);
  }

  _initCtx() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
  }

  _setup(mediaStream) {
    if (!this.ctx) this._initCtx();
    const source = this.ctx.createMediaStreamSource(mediaStream);
    source.connect(this.analyser);
  }

  /** Returns a rough 0..1 amplitude for this frame */
  getAmplitude() {
    if (!this.analyser) return 0;
    this.analyser.getByteTimeDomainData(this.data);
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) {
      const v = (this.data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.data.length);
    return Math.min(1, rms * 4); // gain so normal speech reads in a useful range
  }
}
