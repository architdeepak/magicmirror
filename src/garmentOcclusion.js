import { projectCameraPoint, visiblePoint, distance } from './garmentGeometry.js';

// Segmentation and landmarks come from the same worker frame. Never reuse a
// cached mask after tracking loss or a camera change; the tracker owns freshness.
export class GarmentOcclusion {
  constructor() {
    this.hair = document.createElement('canvas');
    this.skin = document.createElement('canvas');
    this.mask = document.createElement('canvas');
    this.limbs = document.createElement('canvas');
    this.lastMask = null;
  }
  erase(ctx, segmentation, pose, video, viewport) {
    if (!segmentation) { this.lastMask = null; return false; }
    if (this.lastMask !== segmentation) {
      this.lastMask = segmentation;
      for (const [canvas, categories] of [[this.hair, [1, 3]], [this.skin, [2]]]) {
        canvas.width = segmentation.width; canvas.height = segmentation.height;
        const pixels = canvas.getContext('2d').createImageData(canvas.width, canvas.height);
        for (let i = 0; i < segmentation.classes.length; i += 1) {
          pixels.data[i * 4 + 3] = categories.includes(segmentation.classes[i]) ? 255 : 0;
        }
        canvas.getContext('2d').putImageData(pixels, 0, 0);
      }
    }
    const scale = Math.min(1, 640 / viewport.width, 1280 / viewport.height);
    const width = Math.max(1, Math.round(viewport.width * scale));
    const height = Math.max(1, Math.round(viewport.height * scale));
    for (const canvas of [this.mask, this.limbs]) {
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      canvas.getContext('2d').setTransform(scale, 0, 0, scale, 0, 0);
      canvas.getContext('2d').clearRect(0, 0, viewport.width, viewport.height);
    }
    const mask = this.mask.getContext('2d'); const limbs = this.limbs.getContext('2d');
    const drawCameraMask = (context, source) => {
      const cover = Math.max(viewport.width / video.width, viewport.height / video.height);
      const w = video.width * cover; const h = video.height * cover;
      context.save(); context.translate(viewport.width, 0); context.scale(-1, 1);
      context.drawImage(source, (viewport.width - w) / 2, (viewport.height - h) / 2, w, h);
      context.restore();
    };
    // Hair and face remain visible even if a wide garment reaches their pixels.
    drawCameraMask(mask, this.hair);
    const project = index => projectCameraPoint(pose[index], video, viewport);
    const torsoDepth = (pose[11].z + pose[12].z + pose[23].z + pose[24].z) / 4;
    const shoulderWidth = visiblePoint(pose[11]) && visiblePoint(pose[12]) ? distance(project(11), project(12)) : distance(project(23), project(24)) * 1.5;
    limbs.save(); limbs.lineCap = 'round'; limbs.lineJoin = 'round';
    for (const [elbow, wrist, finger] of [[13, 15, 19], [14, 16, 20]]) {
      if (!visiblePoint(pose[elbow]) || !visiblePoint(pose[wrist]) || pose[wrist].z >= torsoDepth - .035) continue;
      const a = project(elbow); const b = project(wrist);
      limbs.lineWidth = shoulderWidth * .2;
      limbs.beginPath(); limbs.moveTo(a.x, a.y); limbs.lineTo(b.x, b.y); limbs.stroke();
      if (visiblePoint(pose[finger])) {
        const c = project(finger); limbs.lineWidth = shoulderWidth * .28;
        limbs.beginPath(); limbs.moveTo(b.x, b.y); limbs.lineTo(c.x, c.y); limbs.stroke();
      }
    }
    // Broad pose regions only select the foreground limb. The skin mask defines
    // the actual contour, so the garment isn't erased from adjacent clothes.
    limbs.globalCompositeOperation = 'source-in'; drawCameraMask(limbs, this.skin); limbs.restore();
    mask.drawImage(this.limbs, 0, 0, viewport.width, viewport.height);
    ctx.save(); ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(this.mask, 0, 0, viewport.width, viewport.height); ctx.restore();
    return true;
  }
  clear() { this.lastMask = null; }
}
