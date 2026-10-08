const assert = require('assert/strict'), fs = require('fs'), vm = require('vm');
const context = vm.createContext({ performance, Uint8ClampedArray, Float32Array });
vm.runInContext(fs.readFileSync('src/cameraClarity.js', 'utf8').replaceAll('export ', ''), context);
const run = (data, w, h, mode) => context.enhanceCameraPixels(data, w, h, mode);
const original = new Uint8ClampedArray([20, 40, 60, 0, 128, 128, 128, 255, 250, 250, 250, 100]);
assert.deepEqual(run(original.slice(), 3, 1, 'off'), original);
assert.deepEqual(run(original.slice(), 3, 1, 'unknown'), original);
for (const mode of ['natural', 'bright']) {
  const out = run(original.slice(), 3, 1, mode);
  for (let i = 3; i < out.length; i += 4) assert.equal(out[i], original[i], 'Alpha changed');
  assert(out[4] === out[5] && out[5] === out[6], 'Neutral turned colored');
}
assert(run(original.slice(), 3, 1, 'bright')[4] > run(original.slice(), 3, 1, 'natural')[4]);
assert.deepEqual(run(original.slice(), 2, 2, 'bright'), original, 'Invalid dimensions changed data');
const uniform = new Uint8ClampedArray(40 * 30 * 4).fill(80);
const out = run(uniform, 40, 30, 'natural');
for (let i = 0; i < out.length; i += 4) assert.equal(out[i], out[0], 'Flat source acquired texture');
let draws = 0, reads = 0;
const ctx = { drawImage() { draws++; }, getImageData() { reads++; return { data: original.slice() }; }, putImageData() {} };
context.fixture = { createElement() { return { width: 3, height: 1, getContext() { return ctx; } }; } };
const processor = vm.runInContext('new CameraClarity(fixture)', context), frame = { width: 3, height: 1 };
assert.equal(processor.process(frame), frame); assert.equal(draws, 0, 'Off mode did work');
processor.setMode('natural'); processor.process(frame); processor.process(frame); assert.equal(draws, 1, 'Repeated frame reprocessed');
processor.setMode('bright'); processor.process(frame); assert.equal(draws, 2, 'Preset failed to invalidate');
ctx.getImageData = () => { throw new Error('Restricted source'); };
processor.setMode('natural'); assert.equal(processor.process(frame), frame); processor.process(frame); assert.equal(draws, 3, 'Failed enhancement retried each tick');
processor.destroy(); assert.equal(processor.canvas.width, 1);
console.log('Camera clarity: original bypass, shadow lift, neutral colors, alpha, dimensions, no invented flat texture, frame cache, preset invalidation, error fallback and disposal passed.');
