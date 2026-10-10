import assert from 'node:assert/strict';
import { reflectionTransform } from '../src/reflectionMap.js';
const video = { width: 720, height: 1280 }, viewport = { width: 1080, height: 1920 };
const pose = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 1 }));
// Shoulders 100 px apart in the camera image; eyes at image centre.
pose[11] = { x: .5 + 50 / 720, y: .5, visibility: 1 }; pose[12] = { x: .5 - 50 / 720, y: .5, visibility: 1 };
pose[2] = { x: .5 - 10 / 720, y: .5, visibility: 1 }; pose[5] = { x: .5 + 10 / 720, y: .5, visibility: 1 };
const t = reflectionTransform({ pose, video, viewport, screenWidthM: .51, mount: 'top' });
// camera field at the wearer = .38*720/100 = 2.736 m; g = .5 * 2.736 / .51
assert.ok(Math.abs(t.g - .5 * 2.736 / .51) < 1e-6, 'scale follows shoulder width');
// The eye's own position maps to the glass point in front of it (screen top for a top camera at eye height).
const eyeScreen = { x: 540, y: 960 };
const mapped = { x: t.g * eyeScreen.x + t.tx, y: t.g * eyeScreen.y + t.ty };
assert.ok(Math.abs(mapped.x - 540) < 1e-6 && Math.abs(mapped.y) < 1e-6, 'eye maps in front of itself');
// A point 100 camera-display px below the eyes lands g*100 px below it on the glass.
const below = { x: 540, y: 1060 }; const out = { y: t.g * below.y + t.ty };
assert.ok(Math.abs(out.y - t.g * 100) < 1e-6);
// Wider screen => smaller scale; unreliable shoulders keep the previous transform; clamp.
assert.ok(reflectionTransform({ pose, video, viewport, screenWidthM: 1.02 }).g < t.g);
const hidden = pose.map(p => ({ ...p, visibility: .1 }));
assert.equal(reflectionTransform({ pose: hidden, video, viewport, previous: t }), t);
const tiny = pose.map(p => ({ ...p })); tiny[11].x = tiny[12].x + .0001;
assert.equal(reflectionTransform({ pose: tiny, video, viewport, previous: null }), null);
const smoothed = reflectionTransform({ pose, video, viewport, screenWidthM: .3, previous: t, smoothing: .5 });
assert.ok(smoothed.g > t.g && smoothed.g < Math.min(4, .5 * 2.736 / .3), 'smoothing moves part of the way');
console.log('Reflection map: scale from shoulders, eye/plane alignment, limits, smoothing and fallback passed.');
