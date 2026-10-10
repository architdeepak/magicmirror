// Spoken kitchen timers for a mirror in a bathroom or hallway: "set a timer
// for 10 minutes", "timer for 90 seconds for the tea", "cancel the timer".
const UNITS = { second: 1, sec: 1, minute: 60, min: 60, hour: 3600, hr: 3600 };
const WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty five': 45, sixty: 60, half: .5 };

export function parseTimerCommand(input) {
  const text = String(input || '').toLowerCase().replace(/[.,!?]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/\b(?:cancel|stop|clear|dismiss)\b.*\btimers?\b|\btimers?\b.*\b(?:cancel|stop|off)\b/.test(text)) return { cancel: true };
  if (!/\btimer\b|\bremind me in\b|\bcount ?down\b/.test(text)) return null;
  const match = text.match(/(\d+(?:\.\d+)?|half|an?|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty five|forty|sixty)(?: and a half)?\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)(?: and a (half))?\b/);
  if (!match) return null;
  const quantity = /^\d/.test(match[1]) ? Number(match[1]) : WORDS[match[1]];
  const unit = UNITS[match[2].replace(/s$/, '')];
  if (!Number.isFinite(quantity) || !unit) return null;
  const seconds = Math.round((quantity + (match[3] ? .5 : 0)) * unit);
  if (seconds < 1 || seconds > 12 * 3600) return { error: 'Timers can run from one second to twelve hours.' };
  const label = (text.match(/.*\bfor (?:the |my )?([a-z]{2,24}(?: [a-z]+)?)$/) || [])[1];
  return { seconds, label: label && !/\d|minute|second|hour/.test(label) ? label.trim() : '' };
}

export function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(total / 3600), m = Math.floor(total % 3600 / 60), s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export class MirrorTimers {
  constructor({ now = () => Date.now(), onChange = () => {}, onDone = () => {}, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = handle => clearTimeout(handle) } = {}) {
    Object.assign(this, { now, onChange, onDone, setTimer, clearTimer, timers: [], next: 1 });
  }
  add(seconds, label = '') {
    if (this.timers.length >= 4) throw new Error('The mirror can only keep four timers at once.');
    const timer = { id: this.next++, label, endsAt: this.now() + seconds * 1000, handle: null };
    timer.handle = this.setTimer(() => this._finish(timer.id), seconds * 1000);
    this.timers.push(timer); this.onChange(this.list());
    return timer.id;
  }
  _finish(id) {
    const index = this.timers.findIndex(timer => timer.id === id);
    if (index < 0) return;
    const [timer] = this.timers.splice(index, 1);
    this.onChange(this.list()); this.onDone(timer);
  }
  cancelAll() {
    for (const timer of this.timers) this.clearTimer(timer.handle);
    const count = this.timers.length; this.timers = []; this.onChange([]);
    return count;
  }
  list() { return this.timers.map(({ id, label, endsAt }) => ({ id, label, remainingMs: Math.max(0, endsAt - this.now()) })); }
  destroy() { this.cancelAll(); }
}
