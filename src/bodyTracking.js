import { BodyPoseFilter } from './bodyPoseFilter.js';

// Keep pose inference off the UI thread so speech, captions, and gestures stay
// responsive on the stick PC. Frames are transferred to a local worker only.
export class BodyTracking {
  constructor(video, onStatus = () => {}) {
    this.video = video;
    this.onStatus = onStatus;
    this.worker = null;
    this.ready = false;
    this.enabled = false;
    this.busy = false;
    this.epoch = 0;
    this.lastVideoTime = -1;
    this.lastFrameAt = 0;
    this.lastPoseAt = 0;
    this.pose = null; this.worldPose = null;
    this.cameraFrame = null; this.cameraFrameAt = 0;
    this.segmentation = null;
    this.stream = null;
    this.sourceWidth = 0; this.sourceHeight = 0; this.sourceAvailable = false;
    this.disposed = false;
    this.filter = new BodyPoseFilter();
    this.pending = null;
    this.requestNumber = 0;
    this.initTimeout = null;
    this.warmedUp = false;this.quality='auto';
  }

  setQuality(id) { this.quality=['eco','auto','hd'].includes(id)?id:'auto'; }

  setEnabled(enabled) {
    if (this.disposed) return;
    const next = Boolean(enabled);
    if (next !== this.enabled) {
      this.epoch += 1;
      this.pose = null; this.worldPose = null;
      this.clearCameraFrame();
      this.segmentation = null;
      this.filter.reset();
      this.lastVideoTime = -1;
    }
    this.enabled = next;
    if (next && !this.worker && !this.disposed) this._init();
  }

  _init() {
    this.onStatus('loading', 'Loading body tracking…');
    let worker;
    try { worker = new Worker(new URL('./poseTrackingWorker.js', import.meta.url)); }
    catch { this._fail('Body tracker unavailable. Select Live camera to retry.'); return; }
    this.worker = worker;
    this.warmedUp = false;
    const timeout = this.initTimeout = setTimeout(() => {
      if (this.worker === worker && !this.ready) this._fail('Body tracker could not load. Check your connection, then select Live camera to retry.');
    }, 60_000);
    worker.onmessage = ({ data }) => {
      if (this.worker !== worker) { data.frame?.close(); return; }
      if (data.type === 'ready') {
        clearTimeout(timeout);
        this.ready = true;
        this.segmentationAvailable = Boolean(data.segmentationAvailable);
        this.segmentationNotice = data.segmentationNotice || '';
        this.onStatus('searching', 'Step back so your shoulders and hips are visible.');
      } else if (data.type === 'pose') {
        if (!this.pending || data.requestId !== this.pending.id) { data.frame?.close(); return; }
        clearTimeout(this.pending.timeout); this.pending = null;
        this.busy = false;
        this.warmedUp = true;
        if (!this.enabled || data.epoch !== this.epoch || !this._sourceMatches()) { data.frame?.close(); return; }
        this.clearCameraFrame(); this.cameraFrame = data.frame || null; this.cameraFrameAt = data.timestamp;
        this.pose = this.filter.update(data.landmarks || null, data.timestamp);
        this.worldPose = this.pose?.length === 33 && Array.isArray(data.worldLandmarks) && data.worldLandmarks.length === 33 && data.worldLandmarks.every(p => p && [p.x,p.y,p.z].every(Number.isFinite)) ? data.worldLandmarks : null;
        const mask = data.segmentation;
        this.segmentation = this.pose && mask && Number.isInteger(mask.width) && Number.isInteger(mask.height)
          && mask.width > 0 && mask.height > 0 && mask.width * mask.height <= 960 * 720
          && mask.classes?.length === mask.width * mask.height ? mask : null;
        this.inferenceMs = data.inferenceMs || 0;
        this.lastPoseAt = data.timestamp;
        this.onStatus(this.pose ? 'tracking' : 'searching', this.pose ? 'Live fit · on-device tracking' : 'Step back so your shoulders and hips are visible.');
      } else if (data.type === 'occlusion-unavailable') {
        this.segmentationAvailable = false; this.segmentation = null; this.segmentationNotice = data.message;
      } else if (data.type === 'error') {
        clearTimeout(timeout);
        this._fail(data.message);
      }
    };
    worker.onerror = () => {
      clearTimeout(timeout);
      if (this.worker === worker) this._fail('Body tracker unavailable. Select Live camera to retry.');
    };
    worker.postMessage({ type: 'init' });
  }

  _fail(message) {
    clearTimeout(this.initTimeout);
    clearTimeout(this.pending?.timeout); this.pending = null;
    this.epoch += 1; this.filter.reset();
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.busy = false;
    this.pose = null; this.worldPose = null;
    this.clearCameraFrame();
    this.segmentation = null;
    this.onStatus('unavailable', message);
  }

  update(now = performance.now()) {
    if (this.disposed) return;
    const available = Boolean(this.video.srcObject && this.video.srcObject.active !== false && this.video.readyState >= 2 && this.video.videoWidth > 0 && this.video.videoHeight > 0);
    if (this.stream !== this.video.srcObject || this.sourceWidth !== this.video.videoWidth || this.sourceHeight !== this.video.videoHeight || this.sourceAvailable !== available) {
      this.stream = this.video.srcObject;
      this.sourceWidth = this.video.videoWidth; this.sourceHeight = this.video.videoHeight; this.sourceAvailable = available;
      this.epoch += 1;
      this.pose = null; this.worldPose = null;
      this.clearCameraFrame();
      this.segmentation = null;
      this.filter.reset();
      this.lastVideoTime = -1;
    }
    if (!available || !this.enabled || !this.ready || this.busy) return;
    // Submission ceilings only: busy inference and unchanged video still gate
    // capture. Eco retains its lower cost; faster profiles keep aligned frames.
    const interval = this.quality === 'hd' ? 1000 / 30 : this.quality === 'eco' ? 100 : 1000 / 15;
    if (now - this.lastFrameAt < interval - 1 || this.video.currentTime === this.lastVideoTime) return;
    this.lastFrameAt = now;
    this.lastVideoTime = this.video.currentTime;
    this.busy = true;
    const worker = this.worker;
    const epoch = this.epoch;
    const request = { id: ++this.requestNumber, timeout: null };
    this.pending = request;
    request.timeout = setTimeout(() => {
      if (this.pending === request) this._fail('Body tracking stalled. Select Live camera to retry.');
    }, this.warmedUp ? 5000 : 20000);
    const w=this.video.videoWidth,h=this.video.videoHeight;
    const longSide=this.quality==='hd'?3840:this.quality==='eco'?960:1280,shortSide=this.quality==='hd'?2160:this.quality==='eco'?720:720;
    const scale=Math.min(1,longSide/Math.max(w,h),shortSide/Math.min(w,h));
    createImageBitmap(this.video, {
      resizeWidth: Math.round(this.video.videoWidth * scale),
      resizeHeight: Math.round(this.video.videoHeight * scale), resizeQuality: 'high'
    }).then((frame) => {
      if (!this.enabled || this.worker !== worker || this.epoch !== epoch || !this._sourceMatches()) {
        frame.close();
        if (this.pending === request) { clearTimeout(request.timeout); this.pending = null; this.busy = false; }
        return;
      }
      worker.postMessage({ type: 'frame', frame, timestamp: now, epoch, requestId: request.id }, [frame]);
    }).catch(() => {
      if (this.pending !== request) return;
      clearTimeout(request.timeout); this.pending = null; this.busy = false; this.pose = null; this.worldPose = null; this.segmentation = null;
    });
  }

  _sourceMatches() {
    return this.sourceAvailable && this.stream === this.video.srcObject && this.video.srcObject?.active !== false
      && this.video.readyState >= 2 && this.sourceWidth === this.video.videoWidth && this.sourceHeight === this.video.videoHeight;
  }

  getPose(now = performance.now()) {
    return this.enabled && this._sourceMatches() && now - this.lastPoseAt < 400 ? this.pose : null;
  }

  clearCameraFrame() { this.cameraFrame?.close(); this.cameraFrame = null; this.cameraFrameAt = 0; }

  getCameraFrame(now = performance.now()) {
    return this.enabled && this._sourceMatches() && now - this.cameraFrameAt < 400 ? this.cameraFrame : null;
  }

  getWorldPose(now = performance.now()) { return this.getPose(now) ? this.worldPose : null; }

  getSegmentation(now = performance.now()) { return this.getPose(now) ? this.segmentation : null; }

  destroy() {
    clearTimeout(this.initTimeout);
    clearTimeout(this.pending?.timeout); this.pending = null;
    this.filter.reset();
    this.clearCameraFrame();
    this.disposed = true;
    this.enabled = false;
    this.ready = false; this.busy = false; this.stream = null;
    this.worker?.terminate();
    this.worker = null;
    this.pose = null; this.worldPose = null;
    this.segmentation = null;
  }
}
