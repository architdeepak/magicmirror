// Paces output captions to the audible voice.
//
// A live model streams audio faster than real time and the transcript arrives
// with it, so captions used to run seconds ahead of the words being spoken (a
// 20 s reply measured 0.5-4.4 s early, median 2.4-2.9 s). The pacer holds
// transcript text and reveals it, word by word, in proportion to how much of
// the turn's audio has actually played on the audio clock.
//
// Pure logic with an injected clock so it can be unit tested without audio.
export class CaptionPacer {
  /**
   * @param {object} options
   * @param {() => number} options.clock        current audio-context time, seconds
   * @param {(text: string) => void} options.reveal  receives each newly visible slice
   * @param {number} [options.lookahead=0.12]   seconds captions may lead the voice
   */
  constructor({ clock, reveal, lookahead = 0.12 }) {
    Object.assign(this, { clock, reveal, lookahead });
    this.reset();
  }

  reset() {
    this.pending = '';          // text received but not yet shown
    this.shown = 0;             // characters of this turn already shown
    this.received = 0;          // characters of this turn received
    this.turnStart = null;      // audio time of the first chunk
    this.audioEnd = 0;          // audio time at which the last scheduled chunk ends
    this.turnEnded = false;
    this.onDrained = null;
  }

  get active() { return this.pending.length > 0 || (this.turnEnded && Boolean(this.onDrained)); }

  /** A transcript delta arrived. */
  text(value) {
    const text = String(value || '');
    if (!text) return;
    this.pending += text;
    this.received += text.length;
  }

  /** An audio chunk was scheduled to play from `start` for `duration` seconds. */
  audio(start, duration) {
    if (!(duration > 0)) return;
    if (this.turnStart === null) this.turnStart = start;
    this.audioEnd = Math.max(this.audioEnd, start + duration);
  }

  /** The server finished the turn; `done` runs once everything is visible. */
  endTurn(done) {
    this.turnEnded = true;
    this.onDrained = typeof done === 'function' ? done : null;
    this.tick();
  }

  /** Drop everything not yet shown (barge-in, mute, stop). */
  cancel() {
    this.pending = '';
    const done = this.onDrained;
    this.reset();
    done?.();
  }

  /** Advance the reveal to the current audio position. Call every ~50 ms. */
  tick() {
    if (this.pending.length) {
      const target = this._revealTarget();
      if (target > 0) {
        const take = this._wordBoundary(target);
        if (take > 0) {
          const slice = this.pending.slice(0, take);
          this.pending = this.pending.slice(take);
          this.shown += slice.length;
          this.reveal(slice);
        }
      }
    }
    if (this.turnEnded && !this.pending.length) {
      const done = this.onDrained;
      this.reset();
      done?.();
    }
  }

  // How many of the pending characters should be visible now.
  _revealTarget() {
    const now = this.clock();
    const total = this.shown + this.pending.length;
    // Text with no audio scheduled yet (typed reply, offline voice, or the very
    // first words of a turn whose audio follows): show it as it arrives. The
    // adapter handles the audio parts of a message before its transcript, so
    // a normal spoken turn is paced from its first word.
    if (this.turnStart === null) return this.pending.length;
    // After the whole turn has been scheduled and its audio is over, show the rest.
    if (this.turnEnded && now >= this.audioEnd - 0.02) return this.pending.length;
    const received = Math.max(1, this.audioEnd - this.turnStart);   // seconds of audio known so far
    const rate = this.received / received;                          // characters per second of speech
    const position = Math.max(0, now - this.turnStart) + this.lookahead;
    const visible = Math.min(total, Math.floor(rate * position));
    return Math.max(0, visible - this.shown);
  }

  // Largest prefix length <= target that ends a whole word (plus the spaces
  // after it). A word still being typed by the model is held back until the
  // turn has ended.
  _wordBoundary(target) {
    const text = this.pending;
    const limit = Math.min(target, text.length);
    for (let end = limit; end > 0; end -= 1) {
      const atEnd = end === text.length;
      const wordEnds = atEnd ? (this.turnEnded || /\s$/.test(text)) : /\s/.test(text[end]);
      if (!wordEnds) continue;
      let take = end;
      while (take < text.length && /\s/.test(text[take])) take += 1;
      return take;
    }
    return 0;
  }
}
