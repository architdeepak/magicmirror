// One bounded camera frame at a time; inference runs outside the UI thread.
export class FrameTracking {
  constructor(video, onResult = () => {}, onStatus = () => {}, options = {}) {
    this.task = options.task || 'hand';
    this.label = options.label || 'Hand';
    this.retry = options.retry || 'Toggle gesture controls to retry.';
    this.interval = options.interval ?? 95;
    this.maxAge = options.maxAge ?? 350;
    this.maxWidth = options.maxWidth ?? 640;
    this.maxHeight = options.maxHeight ?? 480;
    Object.assign(this, { video, onResult, onStatus, worker: null, enabled: false, ready: false,
      disposed: false, epoch: 0, stream: null, pending: null, requestNumber: 0,
      lastVideoTime: -1, lastFrameAt: 0, warmedUp: false, initializing: null, resolveInit: null, initTimeout: null });
  }
  init() {
    if (this.disposed) return Promise.resolve(false);
    if (this.ready) return Promise.resolve(true);
    if (this.initializing) return this.initializing;
    const promise = new Promise(resolve => { this.resolveInit = resolve; });
    this.initializing = promise;
    this.onStatus('loading');
    try {
      const worker = this.worker = new Worker(new URL(`./${this.task}TrackingWorker.js`, import.meta.url));
      this.initTimeout = setTimeout(() => { if (this.worker === worker) this._fail(`${this.label} tracking could not load. ${this.retry}`); }, 60000);
      worker.onmessage = ({ data }) => {
        if (this.worker !== worker || this.disposed) return;
        if (data.type === 'ready') {
          clearTimeout(this.initTimeout); this.initTimeout = null; this.ready = true;
          this.delegate = data.delegate; this._finishInit(true); this.onStatus('ready');
        } else if (data.type === this.task) {
          const request = this.pending;
          if (!request || request.id !== data.requestId) return;
          clearTimeout(request.timeout); this.pending = null; this.warmedUp = true;
          if (!this.enabled || data.epoch !== this.epoch || request.stream !== this.video.srcObject || request.stream?.active === false) return;
          this.inferenceMs = data.inferenceMs;
          // Reject results that are already too old to drive the current view or controls.
          if (!Number.isFinite(data.timestamp) || performance.now() - data.timestamp > this.maxAge) { this.onResult(null, performance.now()); return; }
          this.onResult(data.landmarks || null, data.timestamp, data);
        } else if (data.type === 'error') this._fail(data.message);
      };
      worker.onerror = () => { if (this.worker === worker) this._fail(`${this.label} tracking unavailable. ${this.retry}`); };
      worker.postMessage({ type: 'init' });
    } catch { this._fail(`${this.label} tracking unavailable. ${this.retry}`); }
    return promise;
  }
  _finishInit(value) { this.resolveInit?.(value); this.resolveInit = null; this.initializing = null; }
  _fail(message) {
    clearTimeout(this.initTimeout); clearTimeout(this.pending?.timeout);
    this.initTimeout = null; this.pending = null; this.epoch += 1;
    this.worker?.terminate(); this.worker = null; this.ready = false; this.warmedUp = false;
    this._finishInit(false); this.onResult(null, performance.now()); this.onStatus('unavailable', message);
  }
  setEnabled(enabled) {
    if (this.disposed) return;
    if (this.enabled !== Boolean(enabled)) { this.epoch += 1; this.lastVideoTime = -1; }
    this.enabled = Boolean(enabled);
    if (this.enabled && !this.worker) void this.init();
  }
  update(now = performance.now()) {
    if (this.disposed) return;
    if (this.stream !== this.video.srcObject) { this.stream = this.video.srcObject; this.epoch += 1; this.lastVideoTime = -1; }
    if (!this.enabled || !this.ready || this.pending || !this.stream || this.stream.active === false || this.video.readyState < 2 || !this.video.videoWidth || !this.video.videoHeight) return;
    if (now - this.lastFrameAt < this.interval || this.video.currentTime === this.lastVideoTime) return;
    this.lastFrameAt = now; this.lastVideoTime = this.video.currentTime;
    const worker = this.worker; const epoch = this.epoch;
    const request = this.pending = { id: ++this.requestNumber, stream: this.stream, timeout: null };
    request.timeout = setTimeout(() => { if (this.pending === request) this._fail(`${this.label} tracking stalled. ${this.retry}`); }, this.warmedUp ? 5000 : 20000);
    const scale = Math.min(1, this.maxWidth / this.video.videoWidth, this.maxHeight / this.video.videoHeight);
    createImageBitmap(this.video, { resizeWidth: Math.max(1, Math.round(this.video.videoWidth * scale)), resizeHeight: Math.max(1, Math.round(this.video.videoHeight * scale)), resizeQuality: 'low' }).then(frame => {
      if (!this.enabled || this.worker !== worker || this.epoch !== epoch || this.video.srcObject !== request.stream || request.stream.active === false) {
        frame.close();
        if (this.pending === request) { clearTimeout(request.timeout); this.pending = null; }
        return;
      }
      try { worker.postMessage({ type: 'frame', frame, timestamp: now, epoch, requestId: request.id }, [frame]); }
      catch (error) { frame.close(); throw error; }
    }).catch(() => {
      if (this.pending !== request) return;
      clearTimeout(request.timeout); this.pending = null; this.onResult(null, now);
    });
  }
  destroy() {
    this.disposed = true; this.enabled = false; this.ready = false; this.epoch += 1;
    clearTimeout(this.initTimeout); clearTimeout(this.pending?.timeout); this.pending = null;
    this.worker?.terminate(); this.worker = null; this._finishInit(false);
  }
}
