import assert from 'node:assert/strict';
import { MediaPanelController, assistantDisplayMode } from '../src/mediaPanelController.js';

let release;
let hides = 0;
let visible = false;
const bounds = { x: 380, y: 900, width: 640, height: 620 };
const bridge = {
  openMirrorMedia: input => {
    assert.deepEqual(input.bounds, bounds);
    return new Promise(resolve => { release = resolve; });
  },
  hideMirrorMedia: () => { hides++; },
  resizeMirrorMedia: value => assert.deepEqual(value, bounds)
};
const panel = new MediaPanelController({ bridge, getBounds: () => bounds, onVisibility: value => { visible = value; } });
const opening = panel.open({ service: 'spotify' });
assert.equal(visible, true, 'Sign-in view must become visible before waiting for navigation');
for (const state of ['listening', 'thinking', 'speaking', 'ready']) {
  assert.equal(assistantDisplayMode('watch', panel.active), 'watch', state);
  assert.equal(assistantDisplayMode('mirror', panel.active), 'watch', state);
  assert.equal(hides, 0, 'Assistant state transitions must never close media');
}
release({ ok: true, state: 'signin-required', playbackStarted: false });
assert.equal((await opening).state, 'signin-required');
assert.equal(panel.active, true, 'Sign-in-required must leave the panel open');
panel.resize();
panel.close();
assert.equal(visible, false);
assert.equal(hides, 1);
const pending = panel.open({ service: 'youtube' });
const previousRelease = release;
panel.close();
const newer = panel.open({ service: 'spotify' });
previousRelease({ ok: true });
assert.equal((await pending).cancelled, true);
assert.equal(panel.active, true, 'An old navigation result must not close the new player');
release({ ok: false, state: 'load-error' });
await newer;
assert.equal(panel.active, true, 'A navigation error must stay visible for recovery');
assert.equal(assistantDisplayMode('ar', true), 'ar');
console.log('Media panel passed: assistant turns preserve sign-in, resize, close and stale navigation isolation.');
