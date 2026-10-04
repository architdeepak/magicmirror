export function lastTwoLines(text, maxWidth, measure = value => value.length) {
  const lines = [''];
  for (const word of String(text || '').trim().split(/\s+/).filter(Boolean)) {
    const last = lines.length - 1;
    const next = lines[last] ? `${lines[last]} ${word}` : word;
    if (lines[last] && measure(next) > maxWidth) lines.push(word);
    else lines[last] = next;
  }
  return lines.slice(-2).join('\n');
}

// Reveal arriving words gradually, then discard older lines rather than
// displaying the full conversation or clamping its first two lines.
export class StreamingCaption {
  constructor({ render, fit = text => lastTwoLines(text, 60), interval = 100 }) {
    this.render = render;
    this.fit = fit;
    this.interval = interval;
    this.words = [];
    this.pending = [];
    this.role = null;
    this.timer = null;
    this.source = '';
  }

  push(text, role = 'user', replace = false) {
    const value = String(text || '').trim();
    if (!value) return;
    if (role !== this.role) { this.clear(); this.role = role; }
    if (replace) {
      if (value === this.source) return;
      const previous = this.source;
      this.source = value;
      if (previous && value.startsWith(`${previous} `)) this.pending.push(...value.slice(previous.length).trim().split(/\s+/));
      else { this.words = []; this.pending = value.split(/\s+/); }
    } else {
      this.pending.push(...value.split(/\s+/));
      this.source = `${this.source} ${value}`.trim();
    }
    if (!this.timer) this.tick();
  }

  tick() {
    this.timer = null;
    const word = this.pending.shift();
    if (word) {
      this.words.push(word);
      this.words = this.words.slice(-100);
      this.render(this.fit(this.words.join(' ')));
    }
    if (this.pending.length) this.timer = setTimeout(() => this.tick(), this.interval);
  }

  clear() {
    clearTimeout(this.timer);
    this.timer = null;
    this.words = [];
    this.pending = [];
    this.source = '';
    this.role = null;
    this.render('');
  }
}
