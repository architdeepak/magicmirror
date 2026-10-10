// The casting protocol lives in main; this adapter reports actual HTML media
// events rather than claiming playback succeeded when a URL was merely set.
export class WatchCastPlayer {
  constructor({ video, frame, placeholder, urlInput, openWatch, onState, onNotice = () => {}, setVolume = value => { video.volume = value; } }) {
    Object.assign(this, { video, frame, placeholder, urlInput, openWatch, onState, onNotice, setVolume });
    this.active = false;
    this.pendingSeek = null;
    this.listeners = [];
    this.lastReportAt = 0;
    this.playGeneration = 0;
    for (const event of ['playing', 'pause', 'ended', 'waiting', 'error', 'loadedmetadata', 'seeked', 'volumechange', 'timeupdate']) {
      const listener = () => {
        if (event === 'loadedmetadata' && this.pendingSeek !== null) { this.video.currentTime = this.pendingSeek; this.pendingSeek = null; }
        if (event === 'error' && this.active) this.onNotice('The cast could not play. Try a video format supported by this PC.');
        this.report(event);
      };
      video.addEventListener(event, listener); this.listeners.push([event, listener]);
    }
  }

  async command(input) {
    const action = input?.action;
    if (action === 'load') {
      const url = new URL(input.uri);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('The cast requires an HTTP(S) media URL without credentials.');
      this.playGeneration += 1;
      this.video.pause(); this.frame.removeAttribute('src'); this.frame.classList.remove('loaded');
      this.active = true; this.pendingSeek = null;
      this.urlInput.value = url.href;
      this.video.src = url.href; this.video.classList.add('loaded');
      this.placeholder.classList.add('hidden'); this.video.load(); this.openWatch();
      this.report('load');
      return;
    }
    if (!this.active && !['volume', 'mute'].includes(action)) throw new Error('Load a cast before controlling playback.');
    if (action === 'play') {
      this.openWatch();
      const generation = ++this.playGeneration;
      // Completion is reported by playing/error events; waiting for the play
      // promise here can hold the phone's SOAP request through slow buffering.
      this.video.play().catch((error) => { if (error.name === 'AbortError' || !this.active || generation !== this.playGeneration) return; this.onNotice(error.message); this.report('error'); });
    } else if (action === 'pause') { this.playGeneration += 1; this.video.pause(); }
    else if (action === 'stop') { this.playGeneration += 1; this.video.pause(); if (this.video.readyState) this.video.currentTime = 0; this.pendingSeek = 0; }
    else if (action === 'seek') {
      if (!Number.isFinite(input.position) || input.position < 0) throw new Error('Invalid cast seek position.');
      if (this.video.readyState) this.video.currentTime = input.position;
      else this.pendingSeek = input.position;
    } else if (action === 'volume') {
      if (!Number.isFinite(input.volume) || input.volume < 0 || input.volume > 100) throw new Error('Invalid cast volume.');
      this.setVolume(input.volume / 100);
    } else if (action === 'mute') this.video.muted = Boolean(input.muted);
    else throw new Error('Unsupported cast playback command.');
    this.report(action);
  }

  report(event) {
    if (!this.active) return;
    const now = performance.now();
    if (event === 'timeupdate' && now - this.lastReportAt < 1000) return;
    this.lastReportAt = now;
    const transport = event === 'error' || this.video.ended || event === 'stop' ? 'STOPPED'
      : event === 'waiting' || event === 'play' ? 'TRANSITIONING'
        : this.video.paused ? this.video.currentTime > 0 ? 'PAUSED_PLAYBACK' : 'STOPPED' : 'PLAYING';
    this.onState({ transport, position: this.video.currentTime || 0, duration: Number.isFinite(this.video.duration) ? this.video.duration : 0, volume: Math.round(this.video.volume * 100), muted: this.video.muted, error: event === 'error' || Boolean(this.video.error) });
  }

  detach({ stop = true } = {}) {
    this.playGeneration += 1;
    if (this.active && stop) { this.video.pause(); this.report('stop'); }
    if (this.active) this.onState({ transport: 'NO_MEDIA_PRESENT', position: 0, duration: 0, error: false });
    this.active = false; this.pendingSeek = null;
  }
  destroy() { this.detach(); for (const [event, listener] of this.listeners) this.video.removeEventListener(event, listener); }
}
