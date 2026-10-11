// Delays a stream of {level, viseme} samples by a fixed time, so the mouth can
// be aligned with the moment sound leaves the speakers rather than the moment
// it reaches the analyser. Wireless speakers add 100-250 ms between the two.
export class DelayLine {
  constructor(capacity = 64) { this.capacity = capacity; this.items = []; }

  /** Record a sample taken at `time` (ms) and return the one that is `delay` ms old. */
  push(time, value, delay) {
    this.items.push({ time, value });
    if (this.items.length > this.capacity) this.items.shift();
    if (!(delay > 0)) { this.items.length = 0; this.items.push({ time, value }); return value; }
    const wanted = time - delay;
    let chosen = null;
    for (const item of this.items) { if (item.time <= wanted) chosen = item; else break; }
    // Not enough history yet (start of speech): stay closed rather than jump.
    return chosen ? chosen.value : null;
  }

  clear() { this.items.length = 0; }
}

/**
 * Extra delay to apply to visuals given the audio output latency (ms). The
 * render pipeline after the analyser already adds roughly `pipelineMs`.
 */
export function visualDelayMs(outputLatencyMs, pipelineMs = 45, maxMs = 400) {
  const extra = (Number.isFinite(outputLatencyMs) ? outputLatencyMs : 0) - pipelineMs;
  return extra > 8 ? Math.min(maxMs, Math.round(extra)) : 0;
}
