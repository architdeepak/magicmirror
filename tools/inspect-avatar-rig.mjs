#!/usr/bin/env node
// Small dependency-free gate for avatar assets. Run:
// npm run rig:check -- src/assets/personas/evil-queen.glb
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

const required = [
  'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight', 'eyeBlinkLeft', 'eyeBlinkRight',
  'eyeLookDownLeft', 'eyeLookDownRight', 'eyeLookInLeft', 'eyeLookInRight', 'eyeLookOutLeft', 'eyeLookOutRight',
  'eyeLookUpLeft', 'eyeLookUpRight', 'eyeSquintLeft', 'eyeSquintRight', 'eyeWideLeft', 'eyeWideRight',
  'jawForward', 'jawLeft', 'jawOpen', 'jawRight', 'mouthClose', 'mouthDimpleLeft', 'mouthDimpleRight',
  'mouthFrownLeft', 'mouthFrownRight', 'mouthFunnel', 'mouthLeft', 'mouthLowerDownLeft', 'mouthLowerDownRight',
  'mouthPressLeft', 'mouthPressRight', 'mouthPucker', 'mouthRight', 'mouthRollLower', 'mouthRollUpper',
  'mouthShrugLower', 'mouthShrugUpper', 'mouthSmileLeft', 'mouthSmileRight', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight', 'noseSneerLeft', 'noseSneerRight', 'tongueOut'
];
const lipSyncMinimum = ['jawOpen', 'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthSmileLeft', 'mouthSmileRight'];

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run rig:check -- path/to/avatar.glb');
  process.exit(2);
}

const bytes = await readFile(file);
let gltf;
if (bytes.subarray(0, 4).toString('utf8') === 'glTF') {
  const jsonLength = bytes.readUInt32LE(12);
  const jsonType = bytes.readUInt32LE(16);
  if (jsonType !== 0x4e4f534a) throw new Error('Invalid GLB: first chunk is not JSON.');
  gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8').trim());
} else {
  gltf = JSON.parse(bytes.toString('utf8'));
}

const names = new Set();
let targetCount = 0;
for (const mesh of gltf.meshes || []) {
  for (const name of mesh.extras?.targetNames || []) names.add(name);
  for (const primitive of mesh.primitives || []) targetCount += primitive.targets?.length || 0;
}
const missing = required.filter((name) => !names.has(name));
const lipSyncMissing = lipSyncMinimum.filter((name) => !names.has(name));
const images = gltf.images?.length || 0;

console.log(`Rig: ${basename(file)}`);
console.log(`Meshes: ${gltf.meshes?.length || 0} · images: ${images} · morph targets: ${targetCount}`);
console.log(`Named ARKit targets: ${required.length - missing.length}/${required.length}`);
console.log(`Lip-sync essentials: ${lipSyncMinimum.length - lipSyncMissing.length}/${lipSyncMinimum.length}`);
if (missing.length) console.log(`Missing ARKit: ${missing.join(', ')}`);
if (lipSyncMissing.length) console.error(`FAIL — no production lip-sync: ${lipSyncMissing.join(', ')}`);
if (images === 0) console.warn('WARN — no embedded texture images; this is likely a clay/prototype rig.');
if (lipSyncMissing.length || required.length - missing.length < 48) process.exitCode = 1;
