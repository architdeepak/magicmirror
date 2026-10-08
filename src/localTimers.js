export function parseMinutes(text) {
  const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, sixty: 60 };
  const match = String(text).match(/\b(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty|sixty)[ -]*(minutes?|mins?|hours?)\b/i);
  if (!match) return null;
  const value = (words[match[1].toLowerCase()] || Number(match[1])) * (/hour/i.test(match[2]) ? 60 : 1);
  return Number.isFinite(value) && value >= 1 && value <= 360 ? value : null;
}
export class LocalTimers {
  constructor(storage, onExpire = () => {}, now = () => Date.now()) {
    this.storage = storage; this.onExpire = onExpire; this.now = now;
    try { this.items = JSON.parse(storage.getItem('mirror.timers') || '[]').filter(item => typeof item.id === 'string' && Number.isFinite(item.deadline) && ['pending', 'done'].includes(item.state)).slice(0, 4); } catch { this.items = []; }
  }
  persist() { this.storage.setItem('mirror.timers', JSON.stringify(this.items)); }
  add(minutes, label = 'Getting ready') {
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 360) throw new Error('Choose a timer from 1 minute to 6 hours.');
    if (this.items.length >= 4) throw new Error('Four timers are already saved. Clear one first.');
    const item = { id: String(this.now()) + '-' + Math.random().toString(36).slice(2, 7), deadline: this.now() + minutes * 60000, label: String(label).slice(0, 40), state: 'pending' };
    this.items.push(item); this.persist(); return item;
  }
  tick() {
    for (const item of this.items) if (item.state === 'pending' && item.deadline <= this.now()) { item.state = 'done'; this.persist(); this.onExpire(item); }
    return this.items.map(item => ({ ...item, seconds: Math.max(0, Math.ceil((item.deadline - this.now()) / 1000)) }));
  }
  clear(all = false, id = null) { if (all) this.items = []; else if (id) this.items = this.items.filter(item => item.id !== id); else this.items.pop(); this.persist(); }
}
