import { CameraClarityGpu } from './cameraClarityGpu.js';
// Display-only enhancement. Tracking and garment extraction keep original pixels.
export const CAMERA_CLARITY = Object.freeze({
  off: { filter: 'none' },
  natural: { filter: 'brightness(1.03) saturate(1.02)', gamma: .97, gain: 1.01 },
  bright: { filter: 'brightness(1.14) saturate(1.02)', gamma: .86, gain: 1.02 }
});

export function enhanceCameraPixels(data, width, height, mode = 'natural') {
  const profile = CAMERA_CLARITY[mode];
  if (!profile?.gamma || width < 1 || height < 1 || data.length !== width * height * 4) return data;
  const light = new Float32Array(width * height);
  const curve = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) curve[i] = 255 * profile.gain * Math.pow(i / 255, profile.gamma);
  for (let p = 0; p < light.length; p++) {
    const i = p * 4;
    light[p] = .2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2];
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * width + x, i = p * 4;
    if (!data[i + 3]) continue;
    const left = y * width + Math.max(0, x - 1), right = y * width + Math.min(width - 1, x + 1);
    const top = Math.max(0, y - 1) * width + x, bottom = Math.min(height - 1, y + 1) * width + x;
    // Transparent cutout margins are not black fabric. Avoid edge halos.
    const detail = light[p] - ((data[left * 4 + 3] > 16 ? light[left] : light[p]) + (data[right * 4 + 3] > 16 ? light[right] : light[p])
      + (data[top * 4 + 3] > 16 ? light[top] : light[p]) + (data[bottom * 4 + 3] > 16 ? light[bottom] : light[p])) / 4;
    // Ignore low-amplitude sensor noise; limit ringing around high-contrast edges.
    const sharpen = Math.abs(detail) > 3 ? Math.max(-8, Math.min(8, detail * .28)) : 0;
    for (let channel = 0; channel < 3; channel++) data[i + channel] = curve[data[i + channel]] + sharpen;
  }
  return data;
}

export class CameraClarity {
  constructor(ownerDocument) {
    this.canvas = ownerDocument.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.destroyed=false;this.quality='auto';this.gpu=null;this.gpuUnavailable=false;this.output=null;this.backend='original';
    this.mode = 'off'; this.lastFrame = null; this.lastCostMs = 0; this.failed = false;
  }
  setQuality(id) { if(id==='hd')this.release();this.quality=id;this.lastFrame=null;this.lastCostMs=0;this.failed=false; }
  setMode(mode) {
    this.mode = CAMERA_CLARITY[mode] ? mode : 'off';
    if(this.mode==='off')this.release();else this.gpuUnavailable=false;
    this.lastFrame = null; this.failed = false; this.lastCostMs = 0;
  }
  process(frame) {
    if (this.destroyed || this.mode === 'off' || this.failed || this.quality==='hd') {this.backend='original';this.lastCostMs=0;return frame;} // Preserve HD source pixels; CSS tone remains active.
    if (this.lastFrame === frame && !this.gpu?.lost && !this.gpu?.gl?.isContextLost?.()) return this.output;
    const start = performance.now();
    // Upload once at captured resolution, without CPU readback or resizing.
    if(!this.gpuUnavailable&&frame.width*frame.height<=1280*720){
      try{this.gpu ||= new CameraClarityGpu(this.canvas.ownerDocument);this.output=this.gpu.process(frame,CAMERA_CLARITY[this.mode]);this.lastFrame=frame;this.lastCostMs=performance.now()-start;this.backend='gpu';return this.output;}
      catch{this.gpu?.dispose();this.gpu=null;this.gpuUnavailable=true;}
    }
    // Never replace a detailed frame with a smaller enhancement preview.
    // CSS tone remains available when native GPU enhancement cannot run.
    if(frame.width>960||frame.height>720){this.backend='original';this.lastCostMs=0;return frame;}
    // Process once per analyzed frame, bounded independently of TV resolution.
    const scale = Math.min(1, 960 / frame.width, 720 / frame.height);
    const width = Math.max(1, Math.round(frame.width * scale)), height = Math.max(1, Math.round(frame.height * scale));
    try {
      if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
      this.ctx.drawImage(frame, 0, 0, width, height);
      const pixels = this.ctx.getImageData(0, 0, width, height);
      enhanceCameraPixels(pixels.data, width, height, this.mode);
      this.ctx.putImageData(pixels, 0, 0);
      this.lastFrame = frame; this.lastCostMs = performance.now() - start;
      this.output=this.canvas;this.backend='cpu';return this.output;
    } catch {
      // A restricted source or unavailable canvas must still show the original.
      this.failed = true; return frame;
    }
  }
  release() { this.gpu?.dispose();this.gpu=null;this.gpuUnavailable=false;this.failed=false;this.output=null;this.lastFrame=null;this.lastCostMs=0;this.backend='original';if(this.canvas.width!==1||this.canvas.height!==1)this.canvas.width=this.canvas.height=1; }
  destroy() { this.destroyed=true;this.release(); }
}
