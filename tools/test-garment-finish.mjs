// Garment finishing passes: they must only ever touch garment pixels
// (source-atop / destination-in), stay skipped on the Efficient tier, and never
// throw on a limited canvas.
import assert from 'node:assert/strict';
import { GarmentOverlay } from '../src/garmentOverlay.js';

function fakeContext(log) {
  const gradient = { addColorStop() {} };
  const context = {
    globalCompositeOperation: 'source-over', globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt',
    imageSmoothingEnabled: true, imageSmoothingQuality: 'high', filter: 'none',
    save() { log.push('save'); }, restore() { log.push('restore'); },
    translate() {}, scale() {}, beginPath() {}, moveTo() {}, lineTo() {},
    stroke() { log.push(`stroke:${this.globalCompositeOperation}`); },
    fillRect() { log.push(`fillRect:${this.globalCompositeOperation}`); },
    drawImage() { log.push(`drawImage:${this.globalCompositeOperation}`); },
    clearRect() {}, setTransform() {},
    createLinearGradient: () => gradient, createRadialGradient: () => gradient,
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
  };
  return context;
}

function overlayWith(context, quality) {
  const overlay = Object.create(GarmentOverlay.prototype);
  overlay.ctx = context;
  overlay.canvas = { width: 800, height: 1000 };
  overlay.quality = quality;
  overlay.video = { videoWidth: 720, videoHeight: 1280 };
  overlay.viewport = { width: 540, height: 960 };
  overlay.fit = { width: 1, length: 1, offset: 0 };
  overlay.item = { starter: true };
  return overlay;
}

const pose = Array.from({ length: 33 }, () => ({ x: .5, y: .5, z: 0, visibility: 1 }));
Object.assign(pose[11], { x: .62, y: .35 }); Object.assign(pose[12], { x: .38, y: .35 });
Object.assign(pose[13], { x: .72, y: .5 }); Object.assign(pose[14], { x: .28, y: .5 });
Object.assign(pose[23], { x: .58, y: .62 }); Object.assign(pose[24], { x: .42, y: .62 });
const vertices = [{ x: 100, y: 100 }, { x: 440, y: 100 }, { x: 440, y: 700 }, { x: 100, y: 700 }];

// Cues and hems are source-atop only.
{
  const log = [];
  const overlay = overlayWith(fakeContext(log), 'eco');
  global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => fakeContext([]) }) };
  overlay._finishGarment(vertices, pose, { sleeveStyle: 't-shirt' });
  assert(log.some(entry => entry.startsWith('stroke:source-atop')), 'hem lines were not drawn source-atop');
  assert(log.every(entry => !/^(?:fillRect|stroke|drawImage):source-over$/.test(entry)), 'a finishing pass drew over transparent pixels');
  assert(!log.some(entry => entry.startsWith('drawImage:destination-in')), 'edge softening ran on the Efficient tier');
}

// Balanced tier softens the silhouette with destination-in then a source-atop rim.
{
  const log = [];
  const overlay = overlayWith(fakeContext(log), 'auto');
  global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => fakeContext([]) }) };
  overlay._finishGarment(vertices, pose, { sleeveStyle: 'blouse' });
  const feather = log.indexOf('drawImage:destination-in'), rim = log.indexOf('drawImage:source-atop');
  assert(feather >= 0 && rim > feather, 'feather must precede the rim shadow');
}

// A limited context (no gradients) is skipped without throwing; bad pose too.
{
  const overlay = overlayWith({ createLinearGradient: undefined }, 'auto');
  assert.doesNotThrow(() => overlay._finishGarment(vertices, pose, { sleeveStyle: 't-shirt' }));
  const log = [];
  const sparse = overlayWith(fakeContext(log), 'auto');
  assert.doesNotThrow(() => sparse._finishGarment(vertices, null, { sleeveStyle: 't-shirt' }));
  assert.doesNotThrow(() => sparse._finishGarment([], pose, {}));
}

console.log('Garment finishing: source-atop-only cues and hems, feather before rim, Efficient-tier skip and limited-canvas safety passed.');
