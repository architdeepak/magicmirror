// Temporary gain reduction through the media element's own volume property.
// No Web Audio interception: HTTP media without CORS must keep its sound.
export class WatchAudioDucking {
  constructor(video, factor = .25) {
    this.video = video;
    this.factor = Number.isFinite(factor) ? Math.max(0, Math.min(1, factor)) : .25;
    this.active = false; this.original = null; this.applied = null; this.overridden = false;
    this.onVolume = () => {
      // User/phone controls win over temporary automation. Never restore an
      // old volume after the user deliberately changed it during conversation.
      if (this.active && this.applied !== null && Math.abs(video.volume - this.applied) > 1e-6) {
        this.overridden = true; this.original = null; this.applied = null;
      }
    };
    this.onReady = () => this.sync();
    video.addEventListener('volumechange', this.onVolume);
    video.addEventListener('loadedmetadata', this.onReady);
  }
  setActive(active) {
    const next = Boolean(active);
    if (next !== this.active) {
      if (!next && this.original !== null && this.applied !== null && Math.abs(this.video.volume - this.applied) <= 1e-6) this.video.volume = this.original;
      this.active = next; this.original = null; this.applied = null; this.overridden = false;
    }
    this.sync();
  }
  sync() {
    if (!this.active || this.overridden || this.original !== null || !this.video.classList.contains('loaded')) return;
    const volume = this.video.volume;
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) return;
    this.original = volume; this.applied = volume * this.factor;
    this.video.volume = this.applied;
  }
  setUserVolume(volume) {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) throw new Error('Use a volume between zero and one.');
    // Explicit commands can equal our reduced value and emit no DOM event.
    if (this.active) { this.overridden = true; this.original = null; this.applied = null; }
    this.video.volume = volume;
  }
  snapshot() {
    return { supported: true, requested: this.active, active: this.original !== null,
      userOverride: this.overridden, volume: this.video.volume, muted: this.video.muted };
  }
  destroy() {
    this.setActive(false);
    this.video.removeEventListener('volumechange', this.onVolume);
    this.video.removeEventListener('loadedmetadata', this.onReady);
  }
}
