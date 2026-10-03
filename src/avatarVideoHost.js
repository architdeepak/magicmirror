// Future-facing output surface for a generative streaming avatar. It is kept
// separate from the rigged-host renderer: a video model owns every pixel of a
// frame, while the rig owns independent blendshape controls. Mixing both at
// once would make lips and identity fight each other.
export class AvatarVideoHost {
  constructor(host) {
    this.host = host;
    this.video = document.createElement('video');
    this.video.className = 'avatar-video-host';
    this.video.autoplay = true;
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.setAttribute('aria-hidden', 'true');
    this.video.style.display = 'none';
    host.appendChild(this.video);
    this.active = false;
    this.sourceKind = 'none';
    this.playbackState = 'idle';
    this.lastError = '';
    this.video.addEventListener('ended', () => this.clear());
    this.video.addEventListener('playing', () => { this.playbackState = 'playing'; });
    this.video.addEventListener('waiting', () => { if (this.active) this.playbackState = 'buffering'; });
    this.video.addEventListener('error', () => {
      this.playbackState = 'error';
      this.lastError = this.video.error?.message || 'Avatar video could not be decoded';
    });
  }

  async setStream(stream) {
    this.clear();
    this.video.srcObject = stream || null;
    this.sourceKind = stream ? 'stream' : 'none';
    if (!stream) return this.getStatus();
    await this._start();
    return this.getStatus();
  }

  async setUrl(url) {
    this.clear();
    this.video.src = url || '';
    this.sourceKind = url ? 'url' : 'none';
    if (!url) return this.getStatus();
    await this._start();
    return this.getStatus();
  }

  async _start() {
    this.lastError = '';
    this.playbackState = 'loading';
    try {
      await this.video.play();
      this.setActive(true);
    } catch (error) {
      this.lastError = error?.message || 'The browser did not allow avatar video playback';
      this.playbackState = 'error';
      this.setActive(false);
    }
  }

  setActive(active) {
    this.active = Boolean(active);
    this.video.style.display = this.active ? 'block' : 'none';
    this.host.dataset.avatarSource = this.active ? this.sourceKind : 'rig';
  }

  clear() {
    this.video.pause();
    this.video.srcObject = null;
    this.video.removeAttribute('src');
    this.video.load();
    this.sourceKind = 'none';
    this.playbackState = 'idle';
    this.lastError = '';
    this.setActive(false);
  }

  getStatus() {
    return {
      active: this.active,
      source: this.sourceKind,
      state: this.playbackState,
      readyState: this.video.readyState,
      width: this.video.videoWidth,
      height: this.video.videoHeight,
      error: this.lastError
    };
  }
}
