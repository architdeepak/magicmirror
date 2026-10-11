import assert from 'node:assert/strict';
import { DelayLine, visualDelayMs } from '../src/delayLine.js';

// No delay: pass-through, history cleared.
{
  const line = new DelayLine();
  assert.equal(line.push(0, 'a', 0), 'a');
  assert.equal(line.push(16, 'b', 0), 'b');
  assert.equal(line.items.length, 1);
}
// 100 ms delay at 16 ms frames: output trails input by ~100 ms and starts closed.
{
  const line = new DelayLine();
  const out = [];
  for (let i = 0; i < 20; i++) out.push(line.push(i * 16, i, 100));
  assert.equal(out[0], null, 'nothing audible yet at the start of speech');
  assert.equal(out[5], null);
  const first = out.findIndex(v => v !== null);
  assert.ok(first >= 6 && first <= 7, `first output after ~100 ms, got frame ${first}`);
  for (let i = first; i < 20; i++) {
    const lag = i - out[i];
    assert.ok(lag >= 6 && lag <= 7, `steady lag of ~6 frames (96-112 ms), got ${lag}`);
  }
}
// Capacity bounds memory.
{
  const line = new DelayLine(8);
  for (let i = 0; i < 100; i++) line.push(i, i, 5);
  assert.ok(line.items.length <= 8);
}
// Policy: built-in/wired latency needs none; Bluetooth gets the excess, capped.
assert.equal(visualDelayMs(0), 0);
assert.equal(visualDelayMs(42), 0);
assert.equal(visualDelayMs(60), 15);
assert.equal(visualDelayMs(250), 205);
assert.equal(visualDelayMs(2000), 400);
assert.equal(visualDelayMs(NaN), 0);
console.log('Delay line: pass-through, steady ~100 ms lag with quiet start, bounded memory and latency policy passed.');
