// Spoken kitchen timers for a mirror in a bathroom or hallway: "set a timer
// for 10 minutes", "timer for 90 seconds for the tea", "cancel the timer".
const UNITS = { second: 1, sec: 1, minute: 60, min: 60, hour: 3600, hr: 3600 };
const WORDS = { a: 1, an: 1, zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, half: .5 };
const ONES='one|two|three|four|five|six|seven|eight|nine';
const UNDER100=`(?:(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[ -](?:${ONES}))?|zero|${ONES}|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)`;
const QUANTITY=`(?:(?:${ONES}|a) hundred(?: (?:and )?${UNDER100})?|${UNDER100}|half(?: an?)?|an?)`;
const DURATION=new RegExp(`\\b(?<quantity>(?:\\d+(?:\\.\\d+)?|${QUANTITY})(?: point (?:zero|${ONES})(?: (?:zero|${ONES}))*)?)(?: and a (?<beforeHalf>half))?\\s*(?<unit>seconds?|secs?|minutes?|mins?|hours?|hrs?)(?: and a (?<afterHalf>half))?\\b`,'g');
function spokenNumber(text){
  if(text.includes(' point ')){const [whole,fraction]=text.split(' point ');return spokenNumber(whole)+Number('0.'+fraction.split(' ').map(word=>WORDS[word]).join(''));}
  if(/^\d/.test(text))return Number(text);
  if(text.startsWith('half'))return .5;
  let value=0;
  for(const word of text.split(/[ -]/)){if(word==='and')continue;if(word==='hundred')value*=100;else value+=WORDS[word];}
  return value;
}

export function parseTimerCommand(input) {
  const text = String(input || '').toLowerCase().replace(/(?<![\w.])\.(?=\d)/g,'0.').replace(/(?<!\d)\.|\.(?!\d)|[,!?]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/\b(?:cancel|stop|clear|dismiss)\b.*\btimers?\b|\btimers?\b.*\b(?:cancel|stop|off)\b/.test(text)) return { cancel: true };
  if (!/\btimer\b|\bremind me in\b|\bcount ?down\b/.test(text)) return null;
  const parts = text.matchAll(DURATION);
  let total = 0, end = null;
  for (const part of parts) {
    if(end===null&&/(?:\b(?:thousand|million|minus|negative|hundred)|[\d.\-])\s*$/.test(text.slice(0,part.index)))return {error:'Use digits for this timer duration.'};
    // Only combine adjacent duration parts, not numbers in a later instruction.
    if (end !== null && !/^\s*(?:and\s*)?$/.test(text.slice(end, part.index))) break;
    const { quantity:spokenQuantity, unit:spokenUnit, beforeHalf, afterHalf } = part.groups;
    const quantity = spokenNumber(spokenQuantity);
    const unit = UNITS[spokenUnit.replace(/s$/, '')];
    if (!Number.isFinite(quantity) || !unit) return null;
    total += (quantity + (beforeHalf || afterHalf ? .5 : 0)) * unit;
    end = part.index + part[0].length;
  }
  if (end === null) return null;
  if (total < 1 || total > 12 * 3600) return { error: 'Timers can run from one second to twelve hours.' };
  const seconds = Math.round(total);
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
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > 12 * 3600) throw new Error('Timers can run from one second to twelve hours.');
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
