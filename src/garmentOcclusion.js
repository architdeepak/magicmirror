import { foregroundLimbSegments, occlusionBodyWidth } from './garmentLimbOcclusion.js';
import { projectCameraPoint } from './garmentGeometry.js';

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
  erase(ctx, segmentation, pose, video, viewport, { coverForearms = false } = {}) {
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
    const shoulderWidth=occlusionBodyWidth(pose,project);
    limbs.save(); limbs.lineCap='round';limbs.lineJoin='round';
    for(const {from,to,part}of foregroundLimbSegments(pose,{coverForearms})){
      if(shoulderWidth<=0)break;
      const a=projectCameraPoint(from,video,viewport),b=projectCameraPoint(to,video,viewport);
      limbs.lineWidth=shoulderWidth*(part==='hand'?.28:.2);
      limbs.beginPath();limbs.moveTo(a.x,a.y);limbs.lineTo(b.x,b.y);limbs.stroke();
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
