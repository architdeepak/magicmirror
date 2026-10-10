// Local turn boundaries keep microphone turns independent of text greetings.
// Preserve the onset and tolerate natural pauses before finishing an utterance.
export class AudioTurnDetector {
  constructor({ silenceMs = 700, minimumSpeechMs = 120, prefixMs = 300 } = {}) {
    Object.assign(this, { silenceMs, minimumSpeechMs, prefixMs });
    this.reset();
  }
  reset() {
    this.active = false; this.speechMs = 0; this.quietMs = 0;
    this.noise = .001; this.prefix = []; this.prefixDuration = 0;
  }
  accept(samples, sampleRate) { return this.process(samples, sampleRate).end; }
  process(samples, sampleRate) {
    const result = { start: false, end: false, frames: [] };
    if (!samples.length || !Number.isFinite(sampleRate) || sampleRate <= 0) return result;
    let sum = 0;
    for (const sample of samples) { const value = sample / 32768; sum += value * value; }
    const rms = Math.sqrt(sum / samples.length);
    const duration = samples.length / sampleRate * 1000;
    const voiced = rms >= Math.max(.012, this.noise * 3);
    if (!this.active) {
      this.prefix.push({ samples: samples.slice(), duration }); this.prefixDuration += duration;
      while (this.prefix.length > 1 && this.prefixDuration - this.prefix[0].duration >= this.prefixMs) this.prefixDuration -= this.prefix.shift().duration;
      if (voiced) { this.speechMs += duration; this.quietMs = 0; }
      else {
        this.quietMs += duration;
        if (this.quietMs >= 160) this.speechMs = 0;
        this.noise += (Math.min(rms, .008) - this.noise) * .08;
      }
      if (this.speechMs >= this.minimumSpeechMs) {
        this.active = true; result.start = true;
        result.frames = this.prefix.map(frame => frame.samples);
        this.prefix = []; this.prefixDuration = 0;
      }
      return result;
    }
    result.frames = [samples];
    this.quietMs = voiced ? 0 : this.quietMs + duration;
    if (this.quietMs >= this.silenceMs) {
      result.end = true; this.active = false; this.speechMs = 0; this.quietMs = 0;
    }
    return result;
  }
}
