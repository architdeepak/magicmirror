class RendererRecovery {
  constructor({ reload, retire, log = () => {}, onLimit = () => {}, now = Date.now, schedule = setTimeout, unschedule = clearTimeout, delayMs = 5000, windowMs = 60000, maxRecoveries = 3 }) {
    Object.assign(this, { reload, retire, log, onLimit, now, schedule, unschedule, delayMs, windowMs, maxRecoveries });
    this.attempts = []; this.timer = null; this.closed = false; this.blocked = false;
  }
  unresponsive() {
    if (this.closed || this.blocked || this.timer !== null) return;
    this.log('renderer-unresponsive');
    this.timer = this.schedule(() => { this.timer = null; this.recover('unresponsive'); }, this.delayMs);
  }
  responsive() {
    if (this.timer !== null) { this.unschedule(this.timer); this.timer = null; this.log('renderer-responsive'); }
  }
  gone(reason, exitCode) {
    if (this.closed) return;
    this.responsive();
    this.log('renderer-gone', { reason, exitCode });
    this.recover(reason);
  }
  recover(reason) {
    if (this.closed || this.blocked) return;
    this.responsive();
    try { this.retire(); } catch { this.log('cleanup-failed'); }
    const now = this.now();
    this.attempts = this.attempts.filter(at => now - at < this.windowMs);
    if (this.attempts.length >= this.maxRecoveries) { this.limit(reason); return; }
    this.attempts.push(now);
    this.log('renderer-reload', { reason, attempt: this.attempts.length });
    try { this.reload(); } catch { this.limit('reload-failed'); }
  }
  limit(reason) {
    if (this.closed || this.blocked) return;
    this.blocked = true; this.log('recovery-limit', { reason }); this.onLimit();
  }
  retry() {
    if (this.closed) return;
    this.blocked = false; this.attempts = []; this.recover('manual');
  }
  close() { this.closed = true; this.responsive(); }
}
module.exports = { RendererRecovery };
