import assert from 'node:assert/strict';
import { VoiceGate, blockLevel } from '../src/voiceGate.js';

// Silence never feeds the recogniser.
{
  const gate = new VoiceGate();
  let fed = 0;
  for (let i = 0; i < 200; i++) if (gate.push(.002 + (i % 3) * .0005).feed) fed++;
  assert.equal(fed, 0, 'silence should be gated');
}
// Speech opens the gate with pre-roll once, stays open through the hangover, then closes.
{
  const gate = new VoiceGate({ hangoverBlocks: 4, prerollBlocks: 2 });
  for (let i = 0; i < 10; i++) gate.push(.003);
  const first = gate.push(.06);
  assert.deepEqual(first, { feed: true, preroll: true });
  assert.deepEqual(gate.push(.07), { feed: true, preroll: false });
  const tail = [];
  for (let i = 0; i < 6; i++) tail.push(gate.push(.003).feed);
  assert.deepEqual(tail, [true, true, true, true, false, false], 'hangover is exactly four blocks');
  assert.equal(gate.push(.003).feed, false);
}
// A second phrase re-opens with pre-roll again.
{
  const gate = new VoiceGate({ hangoverBlocks: 1 });
  gate.push(.05); gate.push(.003); gate.push(.003);
  assert.equal(gate.push(.05).preroll, true);
}
// A noisy room raises the bar, but speech well above it still passes; a loud
// burst cannot ratchet the floor beyond its ceiling.
{
  const gate = new VoiceGate();
  for (let i = 0; i < 90; i++) gate.push(.02);               // steady fan noise
  assert.ok(gate.floor > .01, 'floor should rise toward steady noise');
  for (let i = 0; i < 8; i++) gate.push(.02);
  assert.equal(gate.push(.02).feed, false, 'sustained noise stops opening the gate');
  assert.equal(gate.push(.2).feed, true, 'loud speech passes in a noisy room');
  for (let i = 0; i < 400; i++) gate.push(.5);
  assert.ok(gate.floor <= .05, 'floor is capped');
}
// Bad input is treated as silence.
{
  const gate = new VoiceGate();
  assert.equal(gate.push(NaN).feed, false);
  assert.equal(gate.push(-1).feed, false);
}
assert.ok(Math.abs(blockLevel(new Float32Array(4096).fill(.1)) - .1) < 1e-6);
assert.equal(blockLevel(new Float32Array(0)), 0);
console.log('Voice gate: silence gated, onset pre-roll, hangover tail, noise floor and bad input passed.');
