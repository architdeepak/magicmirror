#!/usr/bin/env node
// Read-only machine check for an AVTR-style local video-avatar backend. It
// deliberately never logs in, downloads gated weights, or changes drivers.
const { spawnSync } = require('child_process');

const run = (command, args) => spawnSync(command, args, { encoding: 'utf8' });
const architecture = run('uname', ['-m']).stdout.trim() || 'unknown';
const gpu = run('nvidia-smi', ['--query-gpu=name,driver_version,compute_cap', '--format=csv,noheader']);
const trtexec = run('sh', ['-lc', 'command -v trtexec || true']);
const python = run('python3', ['-c', 'import tensorrt as trt; print(trt.__version__)']);

const rows = [
  ['Host architecture', architecture],
  ['NVIDIA GPU', gpu.status === 0 ? gpu.stdout.trim() : 'not detected'],
  ['TensorRT CLI', trtexec.stdout.trim() || 'not installed'],
  ['TensorRT Python', python.status === 0 ? python.stdout.trim() : 'not installed'],
  ['AVTR weights', 'not checked — gated download requires the owner to log in and accept conditions'],
  ['WebRTC mirror seam', 'ready — AvatarController accepts a MediaStream or video URL']
];

console.log('Magic Mirror · live avatar preflight');
for (const [label, value] of rows) console.log(`${label}: ${value}`);

const avtrPlatformSupported = architecture === 'x86_64';
const ready = avtrPlatformSupported && gpu.status === 0 && python.status === 0;
if (!ready) {
  if (!avtrPlatformSupported) {
    console.log('\nStatus: AVTR-1 cannot currently be installed natively here. Its checked-in Pixi workspace supports linux-64 (x86-64), while this host is ARM64. Use an x86-64 NVIDIA host for AVTR inference and stream it to this mirror over the existing WebRTC seam.');
  } else {
    console.log('\nStatus: preparation needed. GPU is detectable, but TensorRT Python bindings are required before building a local AVTR engine. `trtexec` is optional for the pip/Pixi route.');
  }
  if (process.argv.includes('--strict')) process.exitCode = 1;
} else {
  console.log('\nStatus: ready for approved model weights and a local TensorRT engine build.');
}
