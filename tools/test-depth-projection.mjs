import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';

// The tracker is a browser module. Load its projection function without opening
// a camera so the physical-window geometry can be checked on every machine.
const source = (await readFile(new URL('../src/headTracking.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const projectionCode = source.slice(source.indexOf('export function applyOffAxisProjection'), source.indexOf('export function applyFlatProjection')).replace('export ', '');
const applyOffAxisProjection = new Function(`${projectionCode}; return applyOffAxisProjection;`)();
const camera = new THREE.PerspectiveCamera(45, 9 / 16, .1, 100);
const project = (point) => point.clone().project(camera);
const corners = [
  new THREE.Vector3(-.9, -1.6, 0), new THREE.Vector3(.9, -1.6, 0),
  new THREE.Vector3(.9, 1.6, 0), new THREE.Vector3(-.9, 1.6, 0)
];
const expected = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
for (const head of [{ x: 0, y: 0, z: 1 }, { x: .6, y: -.3, z: .7 }, { x: -.7, y: .5, z: 1.4 }]) {
  applyOffAxisProjection(camera, head);
  corners.forEach((corner, index) => {
    const screen = project(corner);
    assert.ok(Math.abs(screen.x - expected[index][0]) < 1e-6, 'The glass x edge must remain fixed');
    assert.ok(Math.abs(screen.y - expected[index][1]) < 1e-6, 'The glass y edge must remain fixed');
  });
  assert.equal(camera.rotation.x, 0);
  assert.equal(camera.rotation.y, 0);
}
const rear = new THREE.Vector3(0, 0, -4);
applyOffAxisProjection(camera, { x: 0, y: 0, z: 1 });
const centered = project(rear);
applyOffAxisProjection(camera, { x: .45, y: .2, z: 1 });
const moved = project(rear);
assert.ok(moved.x - centered.x > .15, 'Moving right must reveal the rear wall toward the right');
assert.ok(moved.y - centered.y < -.05, 'Moving down must reveal the rear wall toward the bottom');
console.log('Depth projection passed: glass edges remain fixed and the rear world responds to head motion.');
