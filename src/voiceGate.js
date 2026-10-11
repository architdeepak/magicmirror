// Energy gate for the always-on wake-word recogniser. Decoding silence cost
// about half a CPU core continuously, which a fanless 6 W stick cannot afford.
// The gate lets blocks through only around speech: when it opens it also asks
// for the blocks just before the onset (pre-roll) so the first word is not
// clipped, and it stays open for a hangover so the recogniser sees the trailing
// silence it needs to finalise a phrase.
export class VoiceGate {
  constructor({ hangoverBlocks = 5, prerollBlocks = 2, minLevel = .008, ratio = 2.6, initialFloor = .004 } = {}) {
    Object.assign(this, { hangoverBlocks, prerollBlocks, minLevel, ratio });
    this.floor = initialFloor;
    this.remaining = 0;
    this.open = false;
    this.run = 0;       // consecutive "speech" blocks
  }

  // Returns { feed, preroll } for one audio block of RMS `level`.
  // feed: pass this block to the recogniser; preroll: also pass the previous
  // `prerollBlocks` blocks first (only true on the block that opens the gate).
  push(level) {
    const value = Number.isFinite(level) ? Math.max(0, level) : 0;
    const speech = value > Math.max(this.minLevel, this.floor * this.ratio);
    if (speech) {
      this.run += 1;
      // Ten seconds of unbroken "speech" is a fan or a TV, not a phrase: let the
      // floor climb to it so the gate can close again.
      if (this.run > 40) this.floor = Math.min(.05, this.floor * .9 + value * .1);
      const opening = !this.open;
      this.open = true;
      this.remaining = this.hangoverBlocks;
      return { feed: true, preroll: opening };
    }
    this.run = 0;
    // Track the room's noise floor only while quiet, slowly and with a ceiling
    // so a long loud sound cannot raise the bar for the next phrase.
    this.floor = Math.min(.05, this.floor * .92 + value * .08);
    if (this.remaining > 0) {
      this.remaining -= 1;
      if (this.remaining === 0) this.open = false;
      return { feed: true, preroll: false };
    }
    this.open = false;
    return { feed: false, preroll: false };
  }

  reset() { this.remaining = 0; this.open = false; this.run = 0; }
}

export function blockLevel(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, samples.length));
}
