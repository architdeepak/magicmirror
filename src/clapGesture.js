// A deliberate visual clap: separated open palms, fast contact, then separation.
// The detector stays active when pointer controls are toggled off.
export class ClapGesture {
  constructor() { this.reset(); this.lastClapAt = -Infinity; }
  reset() { this.phase = 'idle'; this.startedAt = 0; this.previous = null; }
  update(hands, now) {
    if (now - this.lastClapAt < 1600) return false;
    if (hands.length !== 2) {
      if (this.previous && now - this.previous.at > 350) this.reset();
      return false;
    }
    const palms = hands.map(hand => {
      const center = [0,5,9,13,17].reduce((sum, index) => ({ x: sum.x + hand[index].x / 5, y: sum.y + hand[index].y / 5 }), { x: 0, y: 0 });
      const width = Math.max(distance(hand[5], hand[17]), distance(hand[0], hand[9]) * .65, .025);
      const open = [[8,6],[12,10],[16,14],[20,18]].filter(([tip, joint]) => distance(hand[tip], hand[0]) > distance(hand[joint], hand[0]) * 1.08).length >= 3;
      return { center, width, open };
    });
    if (!palms.every(palm => palm.open)) { this.reset(); return false; }
    const separation = distance(palms[0].center, palms[1].center) / ((palms[0].width + palms[1].width) / 2);
    const elapsed = this.previous ? (now - this.previous.at) / 1000 : 0;
    const speed = elapsed > 0 ? (this.previous.separation - separation) / elapsed : 0;
    if (this.phase !== 'idle' && now - this.startedAt > 1100) this.reset();
    if (this.phase === 'idle' && separation > 2.8) { this.phase = 'apart'; this.startedAt = now; }
    else if (this.phase === 'apart' && separation < 1.5 && speed > 1.8) this.phase = 'contact';
    else if (this.phase === 'contact' && separation > 2.5) {
      this.lastClapAt = now;
      this.reset();
      return true;
    }
    this.previous = { separation, at: now };
    return false;
  }
}

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
