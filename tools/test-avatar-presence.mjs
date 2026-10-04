import assert from 'node:assert/strict';
import { AvatarPresence } from '../src/avatarPresence.js';

const presence = new AvatarPresence();
presence.setState('listening');
let frame;
for (let i = 0; i < 33; i++) frame = presence.update(1 / 60, { x: .4 });
assert.ok(frame.performance.nod < -.08, 'listening should acknowledge the user');
presence.setState('listening');
assert.ok(presence.age > .5, 'repeated state events must not restart choreography');
presence.setState('thinking');
frame = presence.update(1 / 60);
assert.ok(frame.gaze.x > .2 && frame.expression.browInnerUp > .15, 'thinking must differ from listening');
presence.setState('ready');
frame = presence.update(1 / 60);
assert.equal(frame.performance.lean, 0, 'thinking pose must release on ready');
assert.equal(frame.gaze.x, 0, 'ready must return attention to user');
let blinks = 0;
for (let i = 0; i < 600; i++) {
  frame = presence.update(1 / 60);
  if (frame.expression.eyeBlinkLeft > .1) blinks++;
  assert.ok(frame.expression.eyeBlinkLeft >= 0 && frame.expression.eyeBlinkLeft <= 1);
}
assert.ok(blinks > 0 && blinks < 40, 'automatic blinks should be brief, separated events');
const atRate = (rate) => {
  const performer = new AvatarPresence(); performer.setState('thinking');
  for (let i = 0; i < rate * 2; i++) frame = performer.update(1 / rate, { x: .2 });
  return frame;
};
assert.ok(Math.abs(atRate(30).performance.turn - atRate(120).performance.turn) < .00001, 'frame rates must not change pose timing');
console.log('Avatar presence passed: state transitions, attention, blinks, and frame-rate independence.');
