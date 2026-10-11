import { foregroundLimbSegments, occlusionBodyWidth } from './garmentLimbOcclusion.js';
import { GarmentOcclusion } from './garmentOcclusion.js';
import { GarmentFacing } from './garmentFacing.js';
import { inferPhotoSleeves } from './photoSleeves.js';
import { BodyTracking } from './bodyTracking.js';
import { CameraClarity, CAMERA_CLARITY } from './cameraClarity.js';
import { buildGarmentMesh, drawTexturedTriangle, projectCameraPoint } from './garmentGeometry.js';
import { reflectionTransform } from './reflectionMap.js';

export class GarmentOverlay {
  constructor(canvas, video, onStatus = () => {}) {
    this.sleeveNormalHistory={};
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cameraCanvas = canvas.ownerDocument?.createElement('canvas') || null;
    if (this.cameraCanvas) {
      this.cameraCanvas.className = 'garment-sync-camera';
      this.cameraCanvas.setAttribute('aria-hidden', 'true');
      Object.assign(this.cameraCanvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '0', display: 'none' });
      canvas.parentElement.insertBefore(this.cameraCanvas, canvas);
    }
    this.quality='auto';
    this.lastCameraFrame = null;
    this.cameraClarity = this.cameraCanvas ? new CameraClarity(canvas.ownerDocument) : null;
    this.video = video;
    this.onStatus = onStatus;
    this.tracker = new BodyTracking(video, (_state, message) => { this.trackingMessage = message; });
    this.occlusion = new GarmentOcclusion();
    this.enabled = false;
    this.item = null;
    this.texture = null; this.backTexture = null; this.backMessage = ''; this.facing = new GarmentFacing();
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

  // Behind two-way glass the garment is drawn where the wearer's reflection is.
  setReflection(options) {
    const next = options && options.enabled ? { screenWidthM: options.screenWidthCm / 100, mount: options.mount, sizePercent: options.sizePercent, nudgeYPercent: options.nudgeYPercent } : null;
    if (JSON.stringify(next) !== JSON.stringify(this.reflection)) { this.reflection = next; this.reflectionState = null; this.clear(true); }
  }

  setQuality(id) { this.quality=id;this.tracker.setQuality(id);this.cameraClarity?.setQuality(id);this.resize(); }

  resize() {
    const bounds = this.canvas.parentElement.getBoundingClientRect();
    this.viewport = { width: bounds.width, height: bounds.height };
    // The photographic camera layer sets the useful resolution here. Avoid
    // another full 4K/DPR canvas in addition to the face and 3D renderers.
    const budget=this.quality==='hd'?6_000_000:this.quality==='eco'?1_500_000:3_000_000;
    const scale=Math.min(window.devicePixelRatio||1,Math.sqrt(budget/Math.max(1,bounds.width*bounds.height)));
    this.canvas.width = Math.round(bounds.width * scale);
    this.canvas.height = Math.round(bounds.height * scale);
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.ctx.imageSmoothingEnabled = true; this.ctx.imageSmoothingQuality = 'high';
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
    this.texture = null; this.backTexture = null; this.backMessage = ''; this.facing.reset();
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
      this.texture = prepareTexture(image, { vector: Boolean(item.starter), mirror: !item.starter });
      if (item.backImageUrl) {
        try { const back = new Image(); back.src = item.backImageUrl; await back.decode(); if (generation !== this.generation) return false; this.backTexture = prepareTexture(back,{mirror:true}); }
        catch (error) { if (generation !== this.generation) return false; this.backMessage = `Back photo unavailable: ${error.message}`; }
      }
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
    if(!keepCamera&&this.sleeveNormalHistory)for(const key in this.sleeveNormalHistory)delete this.sleeveNormalHistory[key];
    if (this.hasPixels) this.ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);
    this.hasPixels = false;
    this.lastDraw = null;
    this.outsideCrop = false; this.curvedTorso = false;
    if (!keepCamera) { this.cameraClarity?.release(); if (this.cameraCanvas) this.cameraCanvas.style.display = 'none'; this.lastCameraFrame = null; }
  }

  getLiveState(now = performance.now()) {
    const cameraActive = Boolean(this.video.srcObject && this.video.srcObject.active !== false && this.video.readyState >= 2 && this.video.videoWidth);
    const pose = cameraActive ? this.tracker.getPose(now) : null;
    const visible = Boolean(this.enabled && this.texture && cameraActive && pose && this.hasPixels);
    const status = !this.enabled ? 'Live fit is hidden.' : !cameraActive ? 'Turn on the camera to see your live fit.'
      : !this.texture ? this.imageMessage || 'The garment image is loading.' : !pose
        ? (!this.tracker.ready && this.trackingMessage) || `Step back so your ${this.item?.category === 'bottoms' ? 'hips, knees, and feet' : 'shoulders and hips'} are visible.`
        : this.facing.view === 'back' && !this.backTexture ? this.backMessage || 'Add a back photo to see this garment from behind.' : this.outsideCrop ? 'Center yourself in the portrait camera view.' : visible ? this.missingSleeves?'Torso fitted; keep elbows'+(this.renderedSleeveStyle==='photo-long-sleeve'?' and wrists':'')+' visible for full sleeves.':this.renderedSleeveStyle==='torso-only'&&!this.item?.starter&&['top','outerwear'].includes(this.item?.category)?'Torso photo fit is visible; this photo has no articulated sleeves.':'The garment overlay is visible on the live camera.' : this.lastStatus||'Body detected; positioning the garment.';
    return { sleeveStyle:visible?(this.renderedSleeveStyle||'torso-only'):null,missingSleeves:visible?(this.missingSleeves||0):null,imageReady: Boolean(this.texture), visible, garmentView: this.facing.view, backImageReady: Boolean(this.backTexture), curvedTorso: visible && this.curvedTorso, cameraActive, trackingReady: Boolean(this.tracker.ready),
      cameraClarity: this.cameraClarity?.mode || 'off', clarityBackend:this.cameraClarity?.backend||'original', clarityCostMs: this.cameraClarity?.lastCostMs || 0,
      bodyDetected: Boolean(pose), frameAgeMs: pose ? Math.max(0, now - this.tracker.lastPoseAt) : null, status };
  }

  _sameDraw(pose, segmentation, worldPose) {
    const previous = this.lastDraw;
    if (!previous || !pose || previous.texture !== this.texture || previous.backTexture !== this.backTexture || previous.category !== this.item.category
      || previous.stream !== this.video.srcObject || previous.width !== this.video.videoWidth || previous.height !== this.video.videoHeight
      || previous.view !== this.facing.view || previous.worldPose !== worldPose || previous.segmentation !== segmentation || previous.notice !== this.tracker.segmentationNotice
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
    this.lastDraw = { texture: this.texture, backTexture: this.backTexture, category: this.item.category,
      stream: this.video.srcObject, width: this.video.videoWidth, height: this.video.videoHeight,
      segmentation, worldPose, view: this.facing.view, notice: this.tracker.segmentationNotice,
      fitWidth: this.fit.width, fitLength: this.fit.length, fitOffset: this.fit.offset };
  }

  render(now = performance.now()) {
    if (!this.enabled || !this.item) { this.clear(); return; }
    if (!this.texture) { this.clear(); if (this.imageMessage) this._status(this.imageMessage); return; }
    if (!this.video.srcObject || this.video.srcObject.active === false || !this.video.videoWidth || this.video.readyState < 2) {
      this.tracker.update(now);
      this.clear();
      this._status('Turn on the camera to see your live fit.');
      return;
    }
    this.tracker.update(now);
    const pose = this.tracker.getPose(now);
    const segmentation = this.tracker.getSegmentation(now);
    const worldPose = this.tracker.getWorldPose(now);
    if (pose && !this.item.starter) this.facing.update(pose,worldPose,this.tracker.lastPoseAt);
    const texture = this.facing.view === 'back' ? this.backTexture : this.texture;
    if (!texture) { this.clear(); this._status(this.backMessage || 'Add a back photo to see this garment from behind.'); return; }
    // Tracking still advances and freshness is checked on every display tick.
    // Reuse only the raster drawing, not the camera or inference lifecycle.
    if (this._sameDraw(pose, segmentation, worldPose)) { if(!this.outsideCrop)this.drawCameraFrame(now);return; }
    const mesh = buildGarmentMesh(pose, { width: this.video.videoWidth, height: this.video.videoHeight }, this.viewport, this.item.category, { ...this.fit, normalHistory:this.sleeveNormalHistory, worldPose, photoPattern: this.item.starter ? null : texture.photoPattern, sleeveStyle: this.item.starter ? this.item.style : '', textureBounds: texture.sourceBounds });
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
    this.drawCameraFrame(now);
    this.clear(true);
    const glass = this.reflection
      ? (this.reflectionState = reflectionTransform({ pose, video: { width: this.video.videoWidth, height: this.video.videoHeight }, viewport: this.viewport, screenWidthM: this.reflection.screenWidthM, mount: this.reflection.mount, sizePercent: this.reflection.sizePercent, nudgeYPercent: this.reflection.nudgeYPercent, previous: this.reflectionState }))
      : null;
    if (glass) { this.ctx.save(); this.ctx.translate(glass.tx, glass.ty); this.ctx.scale(glass.g, glass.g); }
    this.hasPixels = true;this.missingSleeves=mesh.missingSleeves||0;this.renderedSleeveStyle=mesh.sleeveStyle||'torso-only'; this.curvedTorso = Boolean(mesh.curvedTorso);
    for (const triangle of mesh) drawTexturedTriangle(this.ctx, texture, triangle);
    this._finishGarment(vertices, pose, mesh);
    const coverage = { coverForearms: mesh.coverForearms?.length?mesh.coverForearms:mesh.sleeveStyle === 'long sleeve' };
    const detailedOcclusion = this.occlusion.erase(this.ctx, segmentation, pose,
      { width: this.video.videoWidth, height: this.video.videoHeight }, this.viewport, coverage);
    if (!detailedOcclusion) this._occludeForearms(pose, coverage);
    if (glass) this.ctx.restore();
    this._rememberDraw(pose, segmentation, worldPose);
    this._status(`Live fit · ${this.item.name}${mesh.missingSleeves?' · Keep elbows'+(texture.photoPattern?.long?' and wrists':'')+' visible for full sleeves':!this.item.starter&&!texture.photoPattern&&['top','outerwear'].includes(this.item.category)?' · Torso photo fit':''} · ${detailedOcclusion ? 'local contour occlusion' : this.tracker.segmentationNotice || 'on-device tracking'}`);
  }

  // Finishing passes that make the cutout read as cloth rather than a sticker.
  // Every pass is procedural and works through the garment's own alpha, so none
  // of it can leak the wearer's clothing, and everything is drawn in garment
  // space so the mirror's reflection transform applies to it unchanged.
  _finishGarment(vertices, pose, mesh) {
    if (!vertices.length || this.item?.noShading) return;
    const context = this.ctx;
    if (typeof context.createLinearGradient !== 'function') return;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const point of vertices) { if (point.x < left) left = point.x; if (point.x > right) right = point.x; if (point.y < top) top = point.y; if (point.y > bottom) bottom = point.y; }
    const bounds = { left, top, right, bottom, width: right - left, height: bottom - top };
    if (!(bounds.width > 24 && bounds.height > 24)) return;
    try {
      if (this.quality !== 'eco') this._softenEdges(bounds);
      this._relight(vertices);
      this._fabricCues(bounds, pose);
      if (this.item?.starter && mesh?.sleeveStyle) this._sleeveHems(pose, mesh.sleeveStyle);
    } catch { /* decoration must never break the live fit */ }
  }

  // Feather the silhouette and add a soft rim shadow just inside it, using a
  // small blurred copy of the garment's alpha (cheap: ~280 px wide).
  _softenEdges(bounds) {
    const context = this.ctx;
    if (typeof context.getTransform !== 'function' || typeof document === 'undefined') return;
    const t = context.getTransform();
    if (!t.a || !t.d || Math.abs(t.b) > 1e-6 || Math.abs(t.c) > 1e-6) return;
    const x0 = Math.max(0, Math.floor(t.a * bounds.left + t.e - 2)), y0 = Math.max(0, Math.floor(t.d * bounds.top + t.f - 2));
    const x1 = Math.min(this.canvas.width, Math.ceil(t.a * bounds.right + t.e + 2)), y1 = Math.min(this.canvas.height, Math.ceil(t.d * bounds.bottom + t.f + 2));
    const sw = x1 - x0, sh = y1 - y0;
    if (sw < 24 || sh < 24) return;
    const smallWidth = Math.min(280, sw), smallHeight = Math.max(8, Math.min(480, Math.round(sh * smallWidth / sw)));
    const make = key => {
      const canvas = this[key] ||= document.createElement('canvas');
      if (canvas.width !== smallWidth || canvas.height !== smallHeight) { canvas.width = smallWidth; canvas.height = smallHeight; }
      const c = canvas.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.filter = 'none'; c.clearRect(0, 0, smallWidth, smallHeight);
      return { canvas, c };
    };
    const base = make('_edgeBase'), tight = make('_edgeTight'), wide = make('_edgeWide');
    base.c.drawImage(this.canvas, x0, y0, sw, sh, 0, 0, smallWidth, smallHeight);
    tight.c.filter = 'blur(0.9px)'; tight.c.drawImage(base.canvas, 0, 0); tight.c.filter = 'none';
    wide.c.filter = 'blur(2.6px)'; wide.c.drawImage(base.canvas, 0, 0); wide.c.filter = 'none';
    // The region in garment space that the small canvases represent.
    const gx = (x0 - t.e) / t.a, gy = (y0 - t.f) / t.d, gw = sw / t.a, gh = sh / t.d;
    context.save();
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
    // 1) Feather: alpha follows the lightly blurred silhouette, so the cut edge
    //    fades over ~1-2 px instead of stair-stepping.
    context.globalCompositeOperation = 'destination-in';
    context.drawImage(tight.canvas, gx, gy, gw, gh);
    // 2) Rim shadow: darkness proportional to how close the pixel is to an edge.
    wide.c.globalCompositeOperation = 'source-out';
    wide.c.fillStyle = 'rgb(14,10,22)'; wide.c.fillRect(0, 0, smallWidth, smallHeight);
    wide.c.globalCompositeOperation = 'source-over';
    context.globalCompositeOperation = 'source-atop';
    context.globalAlpha = .42;
    context.drawImage(wide.canvas, gx, gy, gw, gh);
    context.restore();
  }

  // Cheap fabric cues from the pose: soft vertical folds that shift as the torso
  // leans or turns, and shadow in the armpits where cloth gathers.
  _fabricCues(bounds, pose) {
    const context = this.ctx;
    if (!pose || typeof context.createRadialGradient !== 'function') return;
    const video = { width: this.video.videoWidth, height: this.video.videoHeight };
    const need = [11, 12, 23, 24];
    if (!need.every(index => pose[index] && (pose[index].visibility ?? 1) >= .5)) return;
    const [ls, rs, lh, rh] = need.map(index => projectCameraPoint(pose[index], video, this.viewport));
    const shoulderWidth = Math.hypot(ls.x - rs.x, ls.y - rs.y), hipWidth = Math.hypot(lh.x - rh.x, lh.y - rh.y);
    if (shoulderWidth < 20) return;
    const shoulderMid = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 }, hipMid = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
    const lean = Math.atan2(hipMid.x - shoulderMid.x, Math.max(1, hipMid.y - shoulderMid.y));          // radians, + = leaning toward the viewer's right on screen
    const turn = Math.max(-1, Math.min(1, (shoulderWidth / Math.max(1, hipWidth) - 1.15) * 2));        // narrower shoulders vs hips = turned away
    context.save();
    context.globalCompositeOperation = 'source-atop';
    // Folds: a few soft vertical bands, offset by lean and turn so they travel
    // with the body rather than sitting still on the screen.
    const phase = (lean * 2.4 + turn * .35) * bounds.width * .18;
    const folds = context.createLinearGradient(bounds.left + phase, 0, bounds.right + phase, 0);
    const count = 5;
    for (let i = 0; i <= count * 2; i += 1) {
      // Alternating soft bands, weaker toward the garment edges so they never
      // fight the rim shadow.
      const edge = Math.sin(Math.PI * i / (count * 2));
      folds.addColorStop(i / (count * 2), i % 2 ? `rgba(10,8,16,${(.05 * edge).toFixed(3)})` : `rgba(255,255,255,${(.03 * edge).toFixed(3)})`);
    }
    context.fillStyle = folds;
    context.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
    // Armpit gathers: tall, soft ellipses where the sleeve meets the body.
    for (const [shoulder, hip] of [[ls, lh], [rs, rh]]) {
      const x = shoulder.x + (shoulderMid.x - shoulder.x) * .1 + (hip.x - shoulder.x) * .18, y = shoulder.y + (hip.y - shoulder.y) * .3;
      const radiusX = shoulderWidth * .07, radiusY = shoulderWidth * .16;
      context.save();
      context.translate(x, y); context.scale(radiusX / radiusY, 1);
      const gather = context.createRadialGradient(0, 0, 0, 0, 0, radiusY);
      gather.addColorStop(0, 'rgba(10,8,16,.17)'); gather.addColorStop(1, 'rgba(10,8,16,0)');
      context.fillStyle = gather; context.fillRect(-radiusY, -radiusY, radiusY * 2, radiusY * 2);
      context.restore();
    }
    context.restore();
  }

  // Hem lines at the sleeve ends and along the bottom hem of bundled garments,
  // placed from the same pose points the starter sleeve mesh is built on.
  _sleeveHems(pose, style) {
    const context = this.ctx;
    const reach = { 't-shirt': .65, blouse: .9, 'long sleeve': 1 }[style];
    if (!reach || !pose) return;
    const video = { width: this.video.videoWidth, height: this.video.videoHeight };
    const project = index => (pose[index] && (pose[index].visibility ?? 1) >= .5) ? projectCameraPoint(pose[index], video, this.viewport) : null;
    const longSleeve = style === 'long sleeve';
    const ls = project(11), rs = project(12);
    if (!ls || !rs) return;
    const shoulderWidth = Math.hypot(ls.x - rs.x, ls.y - rs.y);
    if (shoulderWidth < 20) return;
    const radius = shoulderWidth * (this.fit.width || 1) * .095 * 1.05;
    context.save();
    context.globalCompositeOperation = 'source-atop';
    context.lineCap = 'butt';
    for (const [shoulderId, elbowId, wristId] of [[11, 13, 15], [12, 14, 16]]) {
      const shoulder = project(shoulderId), elbow = project(elbowId), wrist = longSleeve ? project(wristId) : null;
      if (!shoulder || !elbow || (longSleeve && !wrist)) continue;
      const length = this.fit.length || 1;
      const from = longSleeve ? elbow : shoulder, to = longSleeve ? wrist : elbow;
      const fraction = longSleeve ? length : reach * length;
      const end = longSleeve ? { x: elbow.x + (wrist.x - elbow.x) * Math.min(1, length), y: elbow.y + (wrist.y - elbow.y) * Math.min(1, length) }
        : { x: shoulder.x + (elbow.x - shoulder.x) * fraction, y: shoulder.y + (elbow.y - shoulder.y) * fraction };
      const dx = to.x - from.x, dy = to.y - from.y, norm = Math.hypot(dx, dy) || 1;
      const ux = dx / norm, uy = dy / norm, nx = -uy, ny = ux;
      const band = Math.max(1.5, radius * .22);
      // A darker turned-hem band just inside the cuff, then a thin lighter
      // stitch line inside that.
      for (const [offset, width, color] of [[band * .55, band, 'rgba(14,10,22,.30)'], [band * 1.5, Math.max(1, band * .22), 'rgba(255,255,255,.22)']]) {
        const cx = end.x - ux * offset, cy = end.y - uy * offset;
        context.beginPath();
        context.moveTo(cx - nx * radius * 1.15, cy - ny * radius * 1.15);
        context.lineTo(cx + nx * radius * 1.15, cy + ny * radius * 1.15);
        context.lineWidth = width; context.strokeStyle = color; context.stroke();
      }
    }
    context.restore();
  }

  // Volume shading: soft darkening toward the sides and hem plus a faint
  // shoulder highlight, drawn source-atop so only garment pixels change. This is
  // procedural on purpose: sampling the camera picked up the wearer's own
  // clothing and read as blotches rather than light.
  _relight(vertices) {
    if (!vertices.length || this.item?.noShading) return;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const point of vertices) { if (point.x < left) left = point.x; if (point.x > right) right = point.x; if (point.y < top) top = point.y; if (point.y > bottom) bottom = point.y; }
    const width = right - left, height = bottom - top;
    if (!(width > 16 && height > 16)) return;
    const context = this.ctx;
    if (typeof context.createLinearGradient !== 'function') return;
    context.save();
    context.globalCompositeOperation = 'source-atop';
    const sides = context.createLinearGradient(left, 0, right, 0);
    sides.addColorStop(0, 'rgba(12,10,20,.30)'); sides.addColorStop(.22, 'rgba(12,10,20,.05)');
    sides.addColorStop(.5, 'rgba(255,255,255,.05)');
    sides.addColorStop(.78, 'rgba(12,10,20,.05)'); sides.addColorStop(1, 'rgba(12,10,20,.30)');
    context.fillStyle = sides; context.fillRect(left, top, width, height);
    const hem = context.createLinearGradient(0, top, 0, bottom);
    hem.addColorStop(0, 'rgba(255,255,255,.07)'); hem.addColorStop(.35, 'rgba(0,0,0,0)');
    hem.addColorStop(.8, 'rgba(12,10,20,.06)'); hem.addColorStop(1, 'rgba(12,10,20,.22)');
    context.fillStyle = hem; context.fillRect(left, top, width, height);
    context.restore();
  }

  _occludeForearms(pose, { coverForearms = false } = {}) {
    const project = (index) => projectCameraPoint(pose[index], { width: this.video.videoWidth, height: this.video.videoHeight }, this.viewport);
    const shoulderWidth=occlusionBodyWidth(pose,project);
    this.ctx.save();this.ctx.globalCompositeOperation='destination-out';this.ctx.lineCap='round';this.ctx.lineJoin='round';
    for(const {from,to,part}of foregroundLimbSegments(pose,{coverForearms})){
      if(shoulderWidth<=0)break;
      const a=projectCameraPoint(from,{width:this.video.videoWidth,height:this.video.videoHeight},this.viewport),b=projectCameraPoint(to,{width:this.video.videoWidth,height:this.video.videoHeight},this.viewport);
      this.ctx.lineWidth=shoulderWidth*(part==='hand'?.17:.12);
      this.ctx.beginPath();this.ctx.moveTo(a.x,a.y);this.ctx.lineTo(b.x,b.y);this.ctx.stroke();
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
    const displayFrame = this.cameraClarity?.process(frame) || frame;
    this.cameraCanvas.style.filter=this.cameraClarity?.backend==='original'?(CAMERA_CLARITY[this.cameraClarity.mode]?.filter||'none'):'none';
    const scale = Math.max(width/displayFrame.width, height/displayFrame.height), w = displayFrame.width*scale, h = displayFrame.height*scale;
    const ctx = this.cameraCanvas.getContext('2d');
    ctx.save(); ctx.translate(width, 0); ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(displayFrame, (width-w)/2, (height-h)/2, w, h); ctx.restore();
    this.lastCameraFrame = frame;
  }

  _status(message) {
    if (message === this.lastStatus) return;
    this.lastStatus = message;
    this.onStatus(message);
  }

  setCameraClarity(mode) { this.cameraClarity?.setMode(mode); this.lastCameraFrame = null; }

  destroy() { this.generation += 1; this.tracker.destroy(); this.texture = null; this.backTexture = null; this.clear(); this.cameraClarity?.destroy(); this.cameraCanvas?.remove(); }
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
export function prepareTexture(image, { vector = false, mirror = false } = {}) {
  // Known bundled SVGs can genuinely rasterize more detail; small photos
  // remain at their source resolution instead of inventing extra pixels.
  const scale = Math.min(vector ? 2 : 1, 1024 / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.save();if(mirror){ctx.translate(canvas.width,0);ctx.scale(-1,1);}ctx.drawImage(image, 0, 0, canvas.width, canvas.height);ctx.restore();
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
  cropped.mirrored=mirror;
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
