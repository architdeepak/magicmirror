// Own only the canvas stream. The camera remains owned by headTracking.
// Every garment gets a new session, so late frames cannot show an old outfit.
export function portraitCrop(width, height) {
  const aspect = 720 / 1280;
  const w = Math.min(width, height * aspect);
  const h = Math.min(height, width / aspect);
  return [(width - w) / 2, (height - h) / 2, w, h];
}

export function createPortraitInput(video) {
  const source = video.srcObject;
  const track = source?.getVideoTracks()[0];
  if (!track || track.readyState !== 'live' || video.readyState < 2) throw new Error('Turn on the camera and wait for its live image first.');
  const canvas = document.createElement('canvas');
  canvas.width = 720; canvas.height = 1280;
  const context = canvas.getContext('2d', { alpha: false });
  const stream = canvas.captureStream(0);
  const output = stream.getVideoTracks()[0];
  if (!output?.requestFrame) { stream.getTracks().forEach(t => t.stop()); throw new Error('Live video capture is unavailable on this device.'); }
  let timer;
  const draw = () => {
    if (track.readyState !== 'live' || video.srcObject !== source || video.readyState < 2) return;
    context.drawImage(video, ...portraitCrop(video.videoWidth, video.videoHeight), 0, 0, 720, 1280);
    output.requestFrame();
  };
  draw();
  timer = setInterval(draw, 1000 / 30);
  return { stream, sourceTrack: track,
    isCurrent: () => video.srcObject === source && track.readyState === 'live',
    dispose() { clearInterval(timer); stream.getTracks().forEach(t => t.stop()); } };
}

export class LiveTryOn {
  constructor({ video, output, token, cancelToken, onState = () => {},
    loadSdk = () => import('./vendor/decart-sdk.js'), createInput = createPortraitInput, now = () => performance.now(),
    loadGarment = async item => {
      const response = await fetch(item.imageUrl);
      if (!response.ok) throw new Error('The garment image could not be read.');
      const blob = await response.blob();
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type) || blob.size > 10000000) throw new Error('Choose a PNG, JPEG, or WebP garment image up to 10 MB.');
      return blob;
    } }) {
    Object.assign(this, { video, output, token, cancelToken, onState, loadSdk, createInput, loadGarment, now });
    this.generation = 0; this.session = null; this.state = 'idle'; this.garment = '';
    this.output.hidden = true;
  }
  snapshot() { return { state: this.state, active: Boolean(this.session), garment: this.garment, provider: 'Decart', quality: this.quality || '',
    frameAgeMs: Number.isFinite(this.session?.lastFrameAt) ? Math.max(0, this.now() - this.session.lastFrameAt) : null,
    latencyMs: this.session?.latencyMs ?? null, fps: this.session?.fps ?? null, error: this.error || '' }; }
  publish(state, error = '') { this.state = state; this.error = error; this.onState(this.snapshot()); }
  stop(reason = '') {
    ++this.generation;
    const session = this.session; this.session = null;
    if (session) {
      clearTimeout(session.timeout); clearTimeout(session.limit);
      clearInterval(session.watchdog);
      if (session.frameCallback != null) this.output.cancelVideoFrameCallback?.(session.frameCallback);
      for (const [track, listener] of session.remoteListeners || []) track.removeEventListener('ended', listener);
      session.input?.sourceTrack?.removeEventListener('ended', session.ended);
      session.input?.dispose();
      try { session.client?.disconnect(); } catch {}
    }
    try { Promise.resolve(this.cancelToken?.()).catch(() => {}); } catch {}
    this.output.pause(); this.output.srcObject = null; this.output.hidden = true;
    this.garment = ''; this.quality = '';
    this.publish(reason ? 'error' : 'idle', reason);
  }
  checkFreshness() {
    const session = this.session;
    if (!session) return;
    if (session.input?.isCurrent?.() === false) this.stop('Camera changed or disconnected. Live AI try-on stopped.');
    else if (this.state === 'streaming' && this.now() - session.lastFrameAt > 3000) this.stop('Live AI video stalled. Camera sharing stopped; start again when your connection is ready.');
  }
  async start(item, consent) {
    this.stop();
    if (!consent) { this.publish('error', 'Confirm live camera sharing with Decart first.'); return false; }
    if (!item) { this.publish('error', 'Select a garment first.'); return false; }
    const session = { generation: this.generation };
    this.session = session; this.garment = item.name;
    const current = () => this.session === session && this.generation === session.generation;
    const fail = message => { if (current()) this.stop(message); };
    const show = () => {
      if (!current() || !session.client || !session.videoReady) return;
      clearTimeout(session.timeout);
      this.output.hidden = false;
      if (this.state !== 'streaming') this.publish('streaming');
    };
    this.publish('connecting');
    session.watchdog = setInterval(() => this.checkFreshness(), 250);
    session.timeout = setTimeout(() => fail('Live try-on timed out. Start again when your connection is ready.'), 45000);
    try {
      // Load the image before opening any cloud video session.
      const [sdk, image] = await Promise.all([this.loadSdk(), this.loadGarment(item)]);
      if (!current()) return false;
      session.input = this.createInput(this.video);
      session.ended = () => fail('Camera disconnected. Live AI try-on stopped.');
      session.input.sourceTrack.addEventListener('ended', session.ended, { once: true });
      const credentials = await this.token({ consent: true, destinationId: 'decart:lucy-vton-3.5' });
      if (!current()) return false;
      const client = sdk.createDecartClient({ apiKey: credentials.apiKey, telemetry: false, logger: sdk.noopLogger });
      const prompt = garmentPrompt(item);
      const remote = await client.realtime.connect(session.input.stream, {
        model: sdk.models.realtime(credentials.model), mirror: false, retries: 0,
        initialState: { image, prompt: { text: prompt, enhance: true } },
        onRemoteStream: stream => {
          if (!current()) { stream.getTracks().forEach(t => t.stop()); return; }
          if (session.frameCallback != null) this.output.cancelVideoFrameCallback?.(session.frameCallback);
          for (const [track, listener] of session.remoteListeners || []) track.removeEventListener('ended', listener);
          session.videoReady = false;
          this.output.hidden = true;
          this.output.srcObject = stream;
          this.publish('connecting');
          clearTimeout(session.timeout);
          session.timeout = setTimeout(() => fail('Live AI video did not produce a frame. Camera sharing stopped.'), 45000);
          session.remoteListeners = stream.getVideoTracks().map(track => {
            const ended = () => { if (current() && this.output.srcObject === stream) fail('Live AI video ended. Camera sharing stopped.'); };
            track.addEventListener('ended', ended, { once: true });
            return [track, ended];
          });
          const presented = () => {
            if (!current() || this.output.srcObject !== stream) return;
            session.lastFrameAt = this.now(); session.videoReady = true; show();
            session.frameCallback = this.output.requestVideoFrameCallback(presented);
          };
          if (!this.output.requestVideoFrameCallback) { fail('Live frame monitoring is unavailable on this device.'); return; }
          session.frameCallback = this.output.requestVideoFrameCallback(presented);
          Promise.resolve(this.output.play()).then(() => {
            if (!current() || this.output.srcObject !== stream) return;
            show();
          }).catch(() => fail('The returned try-on video could not play.'));
        },
        onConnectionChange: state => {
          if (!current()) return;
          if (state === 'disconnected') fail('Live AI try-on disconnected. Start again to reconnect.');
          else if (state === 'reconnecting') fail('Live AI try-on lost its connection. Start again to reconnect.');
        },
        onConnectionQuality: report => {
          if (!current()) return;
          this.quality = report.quality;
          const latency = report.metrics?.g2gMs, fps = report.metrics?.fps;
          session.latencyMs = Number.isFinite(latency) && latency >= 0 ? latency : null;
          session.fps = Number.isFinite(fps) && fps >= 0 ? fps : null;
          this.onState(this.snapshot());
        }
      });
      if (!current()) { remote.disconnect(); return false; }
      session.client = remote;
      remote.on('error', () => fail('Live AI try-on failed. Check your Decart account and connection.'));
      remote.on('sessionEnded', () => fail('Live AI try-on session ended. Start again when ready.'));
      session.limit = setTimeout(() => fail('The 10-minute live try-on session ended. Start again to continue.'), credentials.maxSessionSeconds * 1000);
      show();
      return true;
    } catch (error) { fail(error?.message || 'Live AI try-on could not connect.'); return false; }
  }
}

export function garmentPrompt(item) {
  const name = String(item.name || 'selected garment').slice(0, 200);
  const category = String(item.category || '').toLowerCase();
  if (category === 'accessory') return `Add the ${name} from the reference image to the person. Preserve the person's face, identity, motion, and background.`;
  const target = category === 'bottoms' ? 'bottoms' : category === 'dress' ? 'outfit' : 'top';
  return `Substitute the current ${target} with the ${name} from the reference image. Preserve garment details and the person's face, identity, motion, and background.`;
}
