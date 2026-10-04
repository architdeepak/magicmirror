import assert from 'node:assert/strict';
import { parseMirrorAction, createMirrorActionDispatcher } from '../src/mirrorActions.js';

for (const phrase of ["let's try on", 'mirror mirror lets try on', 'open try on mode']) {
  assert.deepEqual(parseMirrorAction(phrase), { type: 'mode', mode: 'ar' });
}
for (const phrase of ['apply the astral crown', 'apply astra crown', 'wear the crown', 'try on the magic crown']) {
  assert.deepEqual(parseMirrorAction(phrase), { type: 'effect', effect: 'crown' });
}
assert.deepEqual(parseMirrorAction('Spotify start it'), { type: 'media', service: 'spotify', play: true });
assert.deepEqual(parseMirrorAction('play my liked songs'), { type: 'media', service: 'spotify', target: 'liked', play: true });
assert.equal(parseMirrorAction('what is the weather'), null);
const calls = [];
let state = { mode: 'mirror', effect: 'none' };
const dispatch = createMirrorActionDispatcher({
  setMode: mode => { calls.push(['mode', mode]); state.mode = mode; },
  setEffect: effect => { calls.push(['effect', effect]); state.effect = effect; },
  openMedia: action => { calls.push(['media', action.service]); return { handled: true }; },
  getState: () => state
});
assert.deepEqual(dispatch(parseMirrorAction('apply the astral crown')), { handled: true, mode: 'ar', effect: 'crown' });
assert.deepEqual(calls, [['mode','ar'], ['effect','crown']]);
calls.length = 0;
dispatch(parseMirrorAction('play my liked songs'));
assert.deepEqual(calls, [['mode','watch'], ['media','spotify']]);
console.log('Speech actions passed: try-on, effect visibility, and mirror media routing.');
