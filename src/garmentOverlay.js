import { GarmentOcclusion } from './garmentOcclusion.js';
import { inferPhotoSleeves } from './photoSleeves.js';
import { BodyTracking } from './bodyTracking.js';
import { buildGarmentMesh, drawTexturedTriangle, projectCameraPoint, visiblePoint, distance } from './garmentGeometry.js';

export class GarmentOverlay {
  constructor(canvas, video, onStatus = () => {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cameraCanvas = canvas.ownerDocument?.createElement('canvas') || null;
    if (this.cameraCanvas) {
      this.cameraCanvas.className = 'garment-sync-camera';
      this.cameraCanvas.setAttribute('aria-hidden', 'true');
      Object.assign(this.cameraCanvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '0', display: 'none' });
      canvas.parentElement.insertBefore(this.cameraCanvas, canvas);
    }
    this.lastCameraFrame = null;
    this.video = video;
    this.onStatus = onStatus;
    this.tracker = new BodyTracking(video, (_state, message) => { this.trackingMessage = message; });
    this.occlusion = new GarmentOcclusion();
    this.enabled = false;
    this.item = null;
    this.texture = null;
    this.generation = 0;
    this.fit = { width: 1, length: 1, offset: 0 };
    this.imageMessage = '';
    this.lastStatus = '';
    this.hasPixels = false;
    this.lastDraw = null;
    this.outsideCrop = false; this.curvedTorso = false;
    this.drawPose = new Float64Array(33 * 4);
    this.resize();
  }

  resize() {
    const bounds = this.canvas.parentElement.getBoundingClientRect();
    this.viewport = { width: bounds.width, height: bounds.height };
    // The photographic camera layer sets the useful resolution here. Avoid
    // another full 4K/DPR canvas in addition to the face and 3D renderers.
    const scale = Math.min(window.devicePixelRatio || 1, 1280 / Math.max(bounds.width, 1), 2560 / Math.max(bounds.height, 1));
    this.canvas.width = Math.round(bounds.width * scale);
    this.canvas.height = Math.round(bounds.height * scale);
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    if (this.cameraCanvas) {
      this.cameraCanvas.width = this.canvas.width; this.cameraCanvas.height = this.canvas.height;
      this.cameraCanvas.getContext('2d').setTransform(scale, 0, 0, scale, 0, 0);
      this.lastCameraFrame = null;
    }
    this.hasPixels = false;
    this.lastDraw = null;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.tracker.setEnabled(this.enabled && Boolean(this.texture));
    if (!this.enabled) this.clear();
  }

  async select(item) {
    const generation = ++this.generation;
    this.item = item;
    this.texture = null;
    this.tracker.setEnabled(false);
    this.clear();
    this.imageMessage = '';
    this.fit = readFit(item.id);
    if (item.category === 'accessory') {
      this.imageMessage = 'Use the face effects above for accessories. Live garment fit supports tops, outerwear, dresses, and bottoms.';
      this._status(this.imageMessage);
      return false;
    }
    this._status(`Loading ${item.name} for live fit…`);
    try {
      const image = new Image();
      image.src = item.imageUrl;
      await image.decode();
      if (generation !== this.generation) return false;
      this.texture = prepareTexture(image);
      this.tracker.setEnabled(this.enabled);
      return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      this.imageMessage = error.message || 'This garment image could not load.';
      this._status(this.imageMessage);
      return false;
    }
  }

  setFit(next = {}) {
    for (const [key, min, max] of [['width', .7, 1.5], ['length', .7, 1.5], ['offset', -.25, .25]]) {
      if (Number.isFinite(next[key])) this.fit[key] = Math.max(min, Math.min(max, next[key]));
    }
    if (this.item) localStorage.setItem(`mirror.closet.fit.${this.item.id}`, JSON.stringify(this.fit));
    return { ...this.fit };
  }

  clear(keepCamera = false) {
    if (this.hasPixels) this.ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);
    this.hasPixels = false;
    this.lastDraw = null;
    this.outsideCrop = false; this.curvedTorso = false;
    if (!keepCamera) { if (this.cameraCanvas) this.cameraCanvas.style.display = 'none'; this.lastCameraFrame = null; }
  }

  getLiveState(now = performance.now()) {
    const cameraActive = Boolean(this.video.srcObject && this.video.srcObject.active !== false && this.video.readyState >= 2 && this.video.videoWidth);
    const pose = cameraActive ? this.tracker.getPose(now) : null;
    const visible = Boolean(this.enabled && this.texture && cameraActive && pose && this.hasPixels);
    const status = !this.enabled ? 'Live fit is hidden.' : !cameraActive ? 'Turn on the camera to see your live fit.'
      : !this.texture ? this.imageMessage || 'The garment image is loading.' : !pose
        ? (!this.tracker.ready && this.trackingMessage) || `Step back so your ${this.item?.category === 'bottoms' ? 'hips, knees, and feet' : 'shoulders and hips'} are visible.`
        : this.outsideCrop ? 'Center yourself in the portrait camera view.' : visible ? 'The garment overlay is visible on the live camera.' : 'Body detected; positioning the garment.';
    return { imageReady: Boolean(this.texture), visible, curvedTorso: visible && this.curvedTorso, cameraActive, trackingReady: Boolean(this.tracker.ready),
      bodyDetected: Boolean(pose), frameAgeMs: pose ? Math.max(0, now - this.tracker.lastPoseAt) : null, status };
  }

  _sameDraw(pose, segmentation, worldPose) {
    const previous = this.lastDraw;
    if (!previous || !pose || previous.texture !== this.texture || previous.category !== this.item.category
      || previous.stream !== this.video.srcObject || previous.width !== this.video.videoWidth || previous.height !== this.video.videoHeight
      || previous.worldPose !== worldPose || previous.segmentation !== segmentation || previous.notice !== this.tracker.segmentationNotice
      || previous.fitWidth !== this.fit.width || previous.fitLength !== this.fit.length || previous.fitOffset !== this.fit.offset) return false;
    for (let index = 0; index < 33; index += 1) {
      const point = pose[index]; const start = index * 4;
      if ((point?.x ?? 0) !== this.drawPose[start] || (point?.y ?? 0) !== this.drawPose[start + 1]
        || (point?.z ?? 0) !== this.drawPose[start + 2] || (point?.visibility ?? 1) !== this.drawPose[start + 3]) return false;
    }
    return true;
  }

  _rememberDraw(pose, segmentation, worldPose) {
    for (let index = 0; index < 33; index += 1) {
      const point = pose[index]; const start = index * 4;
      this.drawPose[start] = point?.x ?? 0; this.drawPose[start + 1] = point?.y ?? 0;
      this.drawPose[start + 2] = point?.z ?? 0; this.drawPose[start + 3] = point?.visibility ?? 1;
    }
    this.lastDraw = { texture: this.texture, category: this.item.category,
      stream: this.video.srcObject, width: this.video.videoWidth, height: this.video.videoHeight,
      segmentation, worldPose, notice: this.tracker.segmentationNotice,
      fitWidth: this.fit.width, fitLength: this.fit.length, fitOffset: this.fit.offset };
  }

  render(now = performance.now()) {
    if (!this.enabled || !this.item) { this.clear(); return; }
    if (!this.texture) { this.clear(); if (this.imageMessage) this._status(this.imageMessage); return; }
    if (!this.video.srcObject || this.video.srcObject.active === false || !this.video.videoWidth || this.video.readyState < 2) {
      this.clear();
      this._status('Turn on the camera to see your live fit.');
      return;
    }
    this.tracker.update(now);
    this.drawCameraFrame(now);
    const pose = this.tracker.getPose(now);
    const segmentation = this.tracker.getSegmentation(now);
    const worldPose = this.tracker.getWorldPose(now);
    // Tracking still advances and freshness is checked on every display tick.
    // Reuse only the raster drawing, not the camera or inference lifecycle.
    if (this._sameDraw(pose, segmentation, worldPose)) return;
    const mesh = buildGarmentMesh(pose, { width: this.video.videoWidth, height: this.video.videoHeight }, this.viewport, this.item.category, { ...this.fit, worldPose, photoPattern: this.item.starter ? null : this.texture.photoPattern, sleeveStyle: this.item.starter ? this.item.style : '', textureBounds: this.texture.sourceBounds });
    if (!mesh) {
      this.clear();
      this.occlusion.clear();
      this._status(this.tracker.ready ? `Step back so your ${this.item.category === 'bottoms' ? 'hips, knees, and feet' : 'shoulders and hips'} are visible.` : this.trackingMessage || 'Loading body tracking…');
      return;
    }
    const vertices = mesh.flat();
    const outside = Math.max(...vertices.map(p => p.x)) < 0 || Math.min(...vertices.map(p => p.x)) > this.viewport.width
      || Math.max(...vertices.map(p => p.y)) < 0 || Math.min(...vertices.map(p => p.y)) > this.viewport.height;
    if (outside) {
      this.clear(); this.outsideCrop = true; this._rememberDraw(pose, segmentation, worldPose);
      this._status('Center yourself in the portrait camera view.');
      return;
    }
    this.clear(true);
    this.hasPixels = true; this.curvedTorso = Boolean(mesh.curvedTorso);
    for (const triangle of mesh) drawTexturedTriangle(this.ctx, this.texture, triangle);
    const coverage = { coverForearms: mesh.sleeveStyle === 'long sleeve' };
    const detailedOcclusion = this.occlusion.erase(this.ctx, segmentation, pose,
      { width: this.video.videoWidth, height: this.video.videoHeight }, this.viewport, coverage);
    if (!detailedOcclusion) this._occludeForearms(pose, coverage);
    this._rememberDraw(pose, segmentation, worldPose);
    this._status(`Live fit · ${this.item.name} · ${detailedOcclusion ? 'local contour occlusion' : this.tracker.segmentationNotice || 'on-device tracking'}`);
  }

  _occludeForearms(pose, { coverForearms = false } = {}) {
    const project = (index) => projectCameraPoint(pose[index], { width: this.video.videoWidth, height: this.video.videoHeight }, this.viewport);
    const torsoDepth = (pose[11].z + pose[12].z + pose[23].z + pose[24].z) / 4;
    const shoulderWidth = visiblePoint(pose[11]) && visiblePoint(pose[12]) ? distance(project(11), project(12)) : distance(project(23), project(24)) * 1.5;
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round';
    // Reveal the actual forearm and hand only when they are nearer than the
    // torso. Erasing the garment keeps the underlying live camera untouched.
    for (const [elbow, wrist, finger] of [[13, 15, 19], [14, 16, 20]]) {
      if (!visiblePoint(pose[elbow]) || !visiblePoint(pose[wrist]) || pose[wrist].z >= torsoDepth - .035) continue;
      const a = project(elbow); const b = project(wrist);
      this.ctx.lineWidth = shoulderWidth * .12;
      if (!coverForearms) { this.ctx.beginPath(); this.ctx.moveTo(a.x, a.y); this.ctx.lineTo(b.x, b.y); this.ctx.stroke(); }
      if (visiblePoint(pose[finger])) {
        const c = project(finger);
        this.ctx.lineWidth = shoulderWidth * .17;
        this.ctx.beginPath(); this.ctx.moveTo(b.x, b.y); this.ctx.lineTo(c.x, c.y); this.ctx.stroke();
      }
    }
    this.ctx.restore();
  }

  drawCameraFrame(now) {
    if (!this.cameraCanvas) return;
    const frame = this.tracker.getCameraFrame(now);
    if (!frame) { this.cameraCanvas.style.display = 'none'; this.lastCameraFrame = null; return; }
    this.cameraCanvas.style.display = 'block';
    if (frame === this.lastCameraFrame) return;
    const { width, height } = this.viewport;
    const scale = Math.max(width/frame.width, height/frame.height), w = frame.width*scale, h = frame.height*scale;
    const ctx = this.cameraCanvas.getContext('2d');
    ctx.save(); ctx.translate(width, 0); ctx.scale(-1, 1);
    ctx.drawImage(frame, (width-w)/2, (height-h)/2, w, h); ctx.restore();
    this.lastCameraFrame = frame;
  }

  _status(message) {
    if (message === this.lastStatus) return;
    this.lastStatus = message;
    this.onStatus(message);
  }

  destroy() { this.generation += 1; this.tracker.destroy(); this.texture = null; this.clear(); this.cameraCanvas?.remove(); }
}

function readFit(id) {
  try {
    const saved = JSON.parse(localStorage.getItem(`mirror.closet.fit.${id}`) || '{}');
    return { width: clamp(saved.width, .7, 1.5, 1), length: clamp(saved.length, .7, 1.5, 1), offset: clamp(saved.offset, -.25, .25, 0) };
  } catch { return { width: 1, length: 1, offset: 0 }; }
}
function clamp(value, min, max, fallback) { return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback; }

// Preserve photographic pixels. Transparent product images work directly; a
// uniform pale backdrop can be removed with a border-connected flood fill.
// Complex backgrounds require a cutout rather than showing a floating photo.
export function prepareTexture(image) {
  const scale = Math.min(1, 1024 / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  const count = canvas.width * canvas.height;
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 16) transparent += 1;
  if (transparent / count < .005) removePaleBackdrop(data, canvas.width, canvas.height);
  let left = canvas.width; let right = -1; let top = canvas.height; let bottom = -1; let visible = 0;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (data[(y * canvas.width + x) * 4 + 3] <= 16) continue;
      visible += 1; left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (visible / count < .06 || right < left) throw new Error('This image needs a garment cutout. Use a front-facing transparent PNG for live fit.');
  ctx.putImageData(pixels, 0, 0);
  const cropped = document.createElement('canvas');
  cropped.width = right - left + 1; cropped.height = bottom - top + 1;
  cropped.getContext('2d').drawImage(canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
  cropped.sourceBounds = { left, top, width: cropped.width, height: cropped.height, scale };
  cropped.photoPattern = inferPhotoSleeves(cropped.getContext('2d').getImageData(0, 0, cropped.width, cropped.height));
  return cropped;
}

function removePaleBackdrop(data, width, height) {
  const corners = [0, width - 1, (height - 1) * width, width * height - 1].map((index) => Array.from(data.slice(index * 4, index * 4 + 3)));
  const color = [0, 1, 2].map((channel) => corners.reduce((sum, corner) => sum + corner[channel], 0) / 4);
  if (Math.min(...color) < 205 || corners.some((corner) => corner.some((channel, i) => Math.abs(channel - color[i]) > 18))) {
    throw new Error('Use a transparent PNG or a garment photo on a plain white background for live fit.');
  }
  const queue = new Uint32Array(width * height);
  const visited = new Uint8Array(width * height);
  let read = 0; let write = 0;
  const enqueue = (index) => {
    if (visited[index]) return;
    visited[index] = 1;
    const offset = index * 4;
    if ([0, 1, 2].some((channel) => Math.abs(data[offset + channel] - color[channel]) > 32)) return;
    queue[write++] = index;
  };
  for (let x = 0; x < width; x += 1) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y += 1) { enqueue(y * width); enqueue(y * width + width - 1); }
  while (read < write) {
    const index = queue[read++];
    data[index * 4 + 3] = 0;
    if (index % width > 0) enqueue(index - 1);
    if (index % width < width - 1) enqueue(index + 1);
    if (index >= width) enqueue(index - width);
    if (index + width < width * height) enqueue(index + width);
  }
}
