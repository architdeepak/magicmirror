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

const poses={};for(const viseme of['AA','O','OU','EE','MBP','FV','rest']){
 const subject=new ExpressionMixer();subject.setMood('happy');for(let frame=0;frame<60;frame++)poses[viseme]=subject.update({tracking:{jawOpen:.95,mouthSmileLeft:.9,eyeBlinkLeft:.8,browInnerUp:.3},speech:.9,viseme,dt:1/60});
 assert(poses[viseme].eyeBlinkLeft>.79&&poses[viseme].browInnerUp>.29,'Speech stole tracked upper-face channels');
}
assert(poses.AA.jawOpen>.69);assert(poses.O.jawOpen<.28&&poses.O.jawOpen>.26,'Rounded vowel inherited generic jaw floor');assert(poses.OU.mouthPucker>.62);assert(poses.EE.mouthStretchLeft>.39);
assert((poses.MBP.jawOpen||0)<.001&&poses.MBP.mouthClose>.89,'Tracked jaw reopened bilabial closure');assert((poses.rest.jawOpen||0)<.001,'Quiet shape opened jaw');assert(poses.FV.mouthRollLower>.62&&poses.FV.jawOpen<.22,'F/V lip roll missing');assert((poses.MBP.mouthSmileLeft||0)<.001,'Smile broke consonant closure');
const cadence=[];for(const fps of[30,60,120]){const subject=new ExpressionMixer();for(let f=0;f<fps;f++)subject.update({speech:1,viseme:'AA',dt:1/fps});for(let f=0;f<fps/10;f++)subject.update({speech:1,viseme:'MBP',dt:1/fps});cadence.push(subject.values.jawOpen);}assert(Math.max(...cadence)-Math.min(...cadence)<1e-10,'Speech response changes with refresh rate');
console.log('Speech shapes: distinct vowels, tracked-mouth ownership, MBP closure, F/V roll, upper-face independence and 30/60/120 Hz timing passed');
