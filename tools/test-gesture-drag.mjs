import assert from 'node:assert/strict';
import { GestureNavigation } from '../src/gestureNavigation.js';
import { AROverlay } from '../src/arOverlay.js';

function hand(x = .45, pinched = false) {
  const points = Array.from({ length: 21 }, () => ({ x: .5, y: .65, z: 0 }));
  points[0] = { x: .5, y: .8 };
  points[5] = { x: .45, y: .65 };
  points[17] = { x: .6, y: .65 };
  points[9] = { x: .5, y: .6 };
  points[6] = { x, y: .45 };
  points[8] = { x, y: .3 };
  points[4] = pinched ? { x, y: .3 } : { x: .7, y: .55 };
  return points;
}

const events = [];
let consumeDrop = false;
const gestures = new GestureNavigation(null, (type, detail) => {
  events.push({ type, detail });
  return type === 'pointer-up' && consumeDrop;
});
gestures._point(hand(), 100);
gestures._point(hand(.45, true), 150);
gestures._point(hand(.55, true), 200);
gestures._point(hand(.55), 250);
assert.deepEqual(events.filter(e => e.type !== 'pointer-move').map(e => e.type), ['pointer-down', 'pointer-drag', 'pointer-up']);
assert.ok(events.find(e => e.type === 'pointer-drag').detail.x < events.find(e => e.type === 'pointer-down').detail.x, 'Cursor follows a held item');
events.length = 0;
gestures._point(hand(.55, true), 300);
gestures._point(hand(.55), 350);
assert.ok(events.some(e => e.type === 'pointer-click'), 'A stationary pinch clicks on release');
events.length = 0;
consumeDrop = true;
gestures._point(hand(.55, true), 400);
gestures._point(hand(.55), 450);
assert.ok(!events.some(e => e.type === 'pointer-click'), 'Consumed drop never clicks the underlying control');
events.length = 0;
gestures._point(hand(.55, true), 500);
gestures.setEnabled(false);
assert.ok(events.some(e => e.type === 'pointer-cancel'), 'Disabling tracking cancels held items');
console.log('Gesture drag lifecycle passed.');

// Both hands have their own cursor and pinch state, even if MediaPipe
// changes result ordering. Losing one must not release the other hand.
const dualEvents = [];
const dual = new GestureNavigation(null, (type, detail) => {
  dualEvents.push({ type, detail });
  return type === 'pointer-up';
});
dual.setHandPreference('both');
const shiftedHand = (shift, pinched = false) => hand(.45, pinched).map(point => ({ ...point, x: point.x + shift }));
const result = (leftPinch, rightPinch, swapped = false) => {
  const landmarks = [shiftedHand(-.25, leftPinch), shiftedHand(.25, rightPinch)];
  const handedness = [[{ categoryName: 'Left' }], [{ categoryName: 'Right' }]];
  return { landmarks: swapped ? landmarks.reverse() : landmarks, handedness: swapped ? handedness.reverse() : handedness };
};
dual._processHands(result(false, false), 100);
const rightId = dual.latestHands.find(item => item.handedness === 'right').handId;
const leftId = dual.latestHands.find(item => item.handedness === 'left').handId;
assert.notEqual(rightId, leftId, 'Each hand gets an independent identity');
assert.ok(Math.abs(dual.latestHands[0].cursor.x - dual.latestHands[1].cursor.x) > .4, 'Cursors are independent');
dual._processHands(result(true, true, true), 150);
assert.deepEqual(new Set(dualEvents.filter(event => event.type === 'pointer-down').map(event => event.detail.handId)), new Set([rightId, leftId]), 'Both hands can pinch simultaneously');
assert.equal(dual.latestHands.find(item => item.handedness === 'right').handId, rightId, 'Result order changes do not swap identity');
dualEvents.length = 0;
dual._processHands(result(false, true), 200);
assert.deepEqual(dualEvents.filter(event => event.type === 'pointer-up').map(event => event.detail.handId), [rightId], 'Only the released hand emits pointer-up');
assert.ok(dualEvents.some(event => event.type === 'pointer-drag' && event.detail.handId === leftId), 'Other hand continues holding');
dual._processHands({ landmarks: [shiftedHand(-.25)], handedness: [[{ categoryName: 'Left' }]] }, 250);
dualEvents.length = 0;
dual._processHands({ landmarks: [shiftedHand(-.25)], handedness: [[{ categoryName: 'Left' }]] }, 451);
assert.ok(dualEvents.some(event => event.type === 'pointer-cancel' && event.detail.handId === leftId), 'Lost hand cancels its own held item');
assert.ok(!dualEvents.some(event => event.type === 'pointer-lost' && event.detail.handId === rightId), 'Tracked hand survives the other hand disappearing');
assert.equal(dual.latestHands.length, 1, 'Latest hands expose only currently visible hands');
console.log('Independent dual-hand gestures passed.');

const rightOnlyEvents = [];
const rightOnly = new GestureNavigation(null, (type, detail) => rightOnlyEvents.push({ type, detail }));
assert.equal(rightOnly.handPreference, 'right', 'Only the right hand controls the mirror by default');
rightOnly._processHands(result(true, true), 100);
assert.equal(rightOnly.latestHands.length, 1, 'Default preference filters the physical left hand');
assert.equal(rightOnly.latestHands[0].handedness, 'right', 'Unmirrored Left model label maps to physical right hand');
assert.equal(rightOnly.debugHands.length, 2, 'Debug data retains both raw detections');
assert.ok(rightOnlyEvents.filter(event => event.type === 'pointer-down').length === 1, 'Left-hand pinches cannot activate controls');
rightOnlyEvents.length = 0;
rightOnly._processHands({ landmarks: [shiftedHand(.25, true)], handedness: [[{ categoryName: 'Right' }]] }, 200);
assert.equal(rightOnly.latestHands.length, 0, 'A sole physical left hand creates no cursor');
assert.ok(!rightOnlyEvents.some(event => event.type === 'pointer-down'), 'Left hand cannot replace the right-hand pointer');
rightOnly._processHands({ landmarks: [shiftedHand(.25, true)] }, 250);
assert.equal(rightOnly.latestHands.length, 0, 'Unclassified hands cannot control the mirror');
console.log('Default right-hand filtering passed.');

// A wide webcam is center-cropped onto a portrait TV. Drops must use the
// same crop and mirror transform as face effects, including letterboxing.
globalThis.window = { innerWidth: 1080, innerHeight: 1920, devicePixelRatio: 1 };
const bounds = { left: 200, top: 0, width: 1080, height: 1920 };
const ctx = { setTransform() {}, clearRect() {} };
const canvas = { getContext: () => ctx, style: {}, parentElement: { getBoundingClientRect: () => bounds } };
const overlay = new AROverlay(canvas);
overlay.setEffect('none');
const video = { videoWidth: 1280, videoHeight: 720, closest: () => ({ getBoundingClientRect: () => bounds }) };
const projectedGestures = new GestureNavigation(video);
assert.equal(projectedGestures._project({ x: .5, y: .5 }).x, .5, 'Hand projection preserves camera center');
assert.ok(projectedGestures._project({ x: .4, y: .5 }).x > .8, 'Hand projection uses portrait cover crop rather than stretching');
const face = Array.from({ length: 468 }, () => ({ x: .5, y: .5 }));
face[234] = { x: .4, y: .5 }; face[454] = { x: .6, y: .5 };
face[10] = { x: .5, y: .3 }; face[152] = { x: .5, y: .7 };
face[33] = { x: .44, y: .4 }; face[263] = { x: .56, y: .4 };
overlay.render(face, video, 0, true);
assert.ok(overlay.containsFacePoint({ x: .5, y: .5 }), 'Screen center drops on centered face');
assert.ok(!overlay.containsFacePoint({ x: 0, y: .5 }), 'A tray-side drop does not apply');
assert.ok(overlay.containsCameraFacePoint({ x: .5, y: .5 }, video), 'Physical fingertip over face applies through crop');
assert.ok(!overlay.containsCameraFacePoint({ x: .9, y: .5 }, video), 'Camera point outside face does not apply');
overlay.render(null, video, 0, true);
assert.ok(!overlay.containsFacePoint({ x: .5, y: .5 }), 'Lost face invalidates the drop target');
console.log('Portrait face-drop geometry passed.');
