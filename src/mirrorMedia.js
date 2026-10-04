const { WebContentsView, session } = require('electron');

const SERVICES = Object.freeze({
  spotify: { url: 'https://open.spotify.com/', liked: 'https://open.spotify.com/collection/tracks', domains: ['spotify.com'] },
  youtube: { url: 'https://www.youtube.com/', domains: ['youtube.com', 'google.com', 'youtu.be'] },
  netflix: { url: 'https://www.netflix.com/', domains: ['netflix.com'] }
});

function allowedNavigation(url, service) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && SERVICES[service]?.domains.some(domain => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`));
  } catch { return false; }
}

function clampBounds(input, contentBounds) {
  if (!input || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(input[key]))) throw new Error('Media needs valid mirror panel bounds.');
  const x = Math.min(Math.max(0, Math.round(input.x)), Math.max(0, contentBounds.width - 1));
  const y = Math.min(Math.max(0, Math.round(input.y)), Math.max(0, contentBounds.height - 1));
  return { x, y, width: Math.max(1, Math.min(Math.round(input.width), contentBounds.width - x)), height: Math.max(1, Math.min(Math.round(input.height), contentBounds.height - y)) };
}

// Only fixed scripts run inside remote pages; renderer strings never become JS.
const PLAYBACK_SCRIPT = `async (action, service) => {
  const visible = element => Boolean(element && element.getClientRects().length && !element.disabled);
  const buttons = [...document.querySelectorAll('button')].filter(visible);
  const label = element => (element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent || '').trim().toLowerCase();
  const pause = () => [...document.querySelectorAll('button')].find(element => visible(element) && /^(pause|pause playback)$/.test(label(element)));
  const media = [...document.querySelectorAll('video,audio')];
  if (action === 'pause') {
    for (const element of media) element.pause();
    pause()?.click();
    return { state: 'paused', playbackStarted: false, message: 'Playback paused.' };
  }
  if (pause() || media.some(element => !element.paused && !element.ended)) return { state: 'playing', playbackStarted: true, message: 'Playback is already active.' };
  const play = buttons.find(element => /^(play|play playback)$/.test(label(element)) || (service === 'spotify' && /^play liked songs/.test(label(element))));
  if (!play) {
    const needsSignIn = /login|\/accounts\//.test(location.pathname) || buttons.some(element => /^(log in|sign in|login)$/.test(label(element)));
    return { state: needsSignIn ? 'signin-required' : 'ready', playbackStarted: false, message: needsSignIn ? 'Sign in on the mirror to play your music.' : 'Player opened. Choose something to play on the mirror.' };
  }
  play.click();
  await new Promise(resolve => setTimeout(resolve, 800));
  const started = Boolean(pause() || media.some(element => !element.paused && !element.ended));
  return { state: started ? 'playing' : 'play-requested', playbackStarted: started, message: started ? 'Playback started on the mirror.' : 'Play was requested. Check the player for sign-in or playback restrictions.' };
}`;

class MirrorMedia {
  constructor(win) {
    this.win = win;
    this.view = null;
    this.service = '';
    this.visible = false;
    this.generation = 0;
    this.state = 'hidden';
    this.lastError = '';
    win.once('closed', () => this.dispose());
    win.webContents.on('did-start-navigation', (_event, _url, _inPlace, mainFrame) => { if (mainFrame) this.hide(); });
  }

  _ensureView() {
    if (this.view && !this.view.webContents.isDestroyed()) return this.view;
    const mediaSession = session.fromPartition('persist:mirror-media');
    mediaSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    mediaSession.setPermissionCheckHandler(() => false);
    mediaSession.on('will-download', event => event.preventDefault());
    const view = new WebContentsView({ webPreferences: { session: mediaSession, contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
    view.setBackgroundColor('#000000');
    this.win.contentView.addChildView(view);
    view.setVisible(false);
    view.webContents.setAudioMuted(true);
    const navigation = (event, url) => { if (!allowedNavigation(url, this.service)) event.preventDefault(); };
    view.webContents.on('will-navigate', navigation);
    view.webContents.on('will-redirect', navigation);
    view.webContents.setWindowOpenHandler(({ url }) => {
      if (allowedNavigation(url, this.service)) view.webContents.loadURL(url).catch(error => { this.lastError = error.message; });
      return { action: 'deny' };
    });
    view.webContents.on('did-fail-load', (_event, code, description, _url, mainFrame) => {
      if (mainFrame && code !== -3) { this.lastError = description; this.state = 'load-error'; }
    });
    view.webContents.on('render-process-gone', () => { this.lastError = 'The media player stopped. Open it again.'; this.state = 'load-error'; });
    this.view = view;
    return view;
  }

  resize(bounds) {
    if (!this.view || this.win.isDestroyed()) return false;
    this.view.setBounds(clampBounds(bounds, this.win.getContentBounds()));
    return true;
  }

  async open(input = {}) {
    const service = String(input.service || '').toLowerCase();
    if (!SERVICES[service]) throw new Error('That media service is unavailable.');
    const url = input.target === 'liked' && service === 'spotify' ? SERVICES.spotify.liked : SERVICES[service].url;
    const view = this._ensureView();
    const generation = ++this.generation;
    const changedService = this.service !== service;
    this.service = service;
    this.lastError = '';
    this.resize(input.bounds);
    this.visible = true;
    view.setVisible(true);
    view.webContents.setAudioMuted(false);
    this.state = 'loading';
    try {
      if (changedService || input.target === 'liked' || !allowedNavigation(view.webContents.getURL(), service)) await view.webContents.loadURL(url);
      if (generation !== this.generation || !this.visible) return { ok: false, state: 'cancelled', message: 'Media opening cancelled.' };
      this.state = 'ready';
      const outcome = input.play ? await this.control({ action: 'play' }) : { state: 'ready', playbackStarted: false, message: 'Player opened on the mirror. Sign in here if needed.' };
      return { ok: true, service, url: view.webContents.getURL(), ...outcome };
    } catch (error) {
      if (generation !== this.generation) return { ok: false, state: 'cancelled', message: 'Media opening cancelled.' };
      this.lastError = error.message;
      this.state = 'load-error';
      return { ok: false, service, state: this.state, playbackStarted: false, message: `Player could not load: ${this.lastError}` };
    }
  }

  async control(input = {}) {
    const action = input.action;
    if (!['play', 'pause'].includes(action)) throw new Error('Unknown media control.');
    if (!this.view || this.view.webContents.isDestroyed()) return { ok: false, state: 'hidden', playbackStarted: false, message: 'Open a player on the mirror first.' };
    if (action === 'play' && !this.visible) return { ok: false, state: 'hidden', playbackStarted: false, message: 'Open the player before starting playback.' };
    const generation = this.generation;
    const contents = this.view.webContents;
    if (action === 'pause') contents.setAudioMuted(true);
    else contents.setAudioMuted(false);
    try {
      const result = await contents.executeJavaScript(`(${PLAYBACK_SCRIPT})(${JSON.stringify(action)},${JSON.stringify(this.service)})`, true);
      if (generation !== this.generation) return { ok: false, state: 'cancelled', playbackStarted: false, message: 'Playback cancelled.' };
      this.state = result.state;
      return { ok: true, ...result };
    } catch {
      return { ok: false, state: 'unavailable', playbackStarted: false, message: 'The player is not ready. Use its on-screen controls after signing in.' };
    }
  }

  async pointer(input = {}) {
    if (!this.visible || !this.view || this.view.webContents.isDestroyed() || !Number.isFinite(input.x) || !Number.isFinite(input.y)) return { hit: false };
    const bounds = this.view.getBounds();
    const x = Math.round(input.x - bounds.x);
    const y = Math.round(input.y - bounds.y);
    const hit = x >= 0 && y >= 0 && x < bounds.width && y < bounds.height;
    const contents = this.view.webContents;
    if (!hit) {
      contents.executeJavaScript("document.getElementById('mirror-media-fingertip')?.remove()").catch(() => {});
      return { hit: false };
    }
    contents.sendInputEvent({ type: 'mouseMove', x, y });
    if (input.click === true) {
      contents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
      contents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
    }
    // Fixed code plus numeric JSON coordinates; the remote page has no access
    // to the mirror preload and cannot issue controls or arbitrary scripts.
    const point = { x, y, pinch: input.pinch === true };
    contents.executeJavaScript(`(() => {
      const point = ${JSON.stringify(point)};
      let ring = document.getElementById('mirror-media-fingertip');
      if (!ring) { ring = document.createElement('div'); ring.id = 'mirror-media-fingertip'; document.documentElement.appendChild(ring); }
      Object.assign(ring.style, { position: 'fixed', zIndex: '2147483647', pointerEvents: 'none', width: '28px', height: '28px', borderRadius: '50%', border: '3px solid ' + (point.pinch ? '#ffbf70' : '#7affbe'), background: 'rgba(0,0,0,.25)', transform: 'translate(-50%,-50%)', left: point.x + 'px', top: point.y + 'px' });
    })()`).catch(() => {});
    return { hit: true };
  }

  hide() {
    this.generation += 1;
    this.visible = false;
    this.state = 'hidden';
    if (!this.view || this.view.webContents.isDestroyed()) return true;
    this.view.setVisible(false);
    this.view.webContents.setAudioMuted(true);
    this.view.webContents.stop();
    this.view.webContents.executeJavaScript(`(${PLAYBACK_SCRIPT})('pause',${JSON.stringify(this.service)})`).catch(() => {});
    return true;
  }

  dispose() {
    this.generation += 1;
    if (this.view && !this.view.webContents.isDestroyed()) this.view.webContents.close();
    this.view = null;
  }
}

module.exports = { MirrorMedia, allowedNavigation, clampBounds };
