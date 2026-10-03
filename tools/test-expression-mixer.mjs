import assert from 'node:assert/strict';
import { ExpressionMixer } from '../src/expressionMixer.js';

const mixer = new ExpressionMixer();
let values = {};
// Let the smoother settle, then verify a speech viseme does not suppress a
// simultaneously tracked blink—the regression that makes puppet faces uncanny.
for (let frame = 0; frame < 18; frame += 1) {
  values = mixer.update({
    tracking: { eyeBlinkLeft: .82, eyeBlinkRight: .76, eyeLookOutLeft: .3 },
    speech: .9,
    viseme: 'AA',
    dt: 1 / 60
  });
}
assert.ok(values.eyeBlinkLeft > .7, 'tracked blink must survive speech');
assert.ok(values.jawOpen > .6, 'AA must open the jaw');
assert.ok(values.mouthLowerDownLeft > .16, 'AA must deform lips, not only a mouth hole');
assert.ok(values.eyeLookOutLeft > .2, 'tracked gaze must survive speech');

mixer.setMood('happy');
for (let frame = 0; frame < 18; frame += 1) values = mixer.update({ speech: 0, viseme: 'rest', dt: 1 / 60 });
assert.ok(values.mouthSmileLeft > .3 && values.mouthSmileRight > .3, 'mood should drive symmetric smile');
console.log('Expression mixer passed: independent blink, gaze, viseme, and mood channels.');
