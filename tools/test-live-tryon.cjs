const assert = require('assert/strict');
const fs = require('fs/promises');
const path = require('path');
const { LiveTryOnTokens, DESTINATION, MODEL } = require('../src/liveTryOnTokens.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };

(async () => {
  let key = 'permanent-fixture'; let request; let calls = 0;
  const pending = deferred();
  const broker = new LiveTryOnTokens({ key: () => key, fetchImpl: async (url, options) => { calls++; request = { url, ...options }; return pending.promise; } });
  await assert.rejects(broker.create({ consent: false, destinationId: DESTINATION }), /sharing/);
  assert.equal(calls, 0);
  const token = broker.create({ consent: true, destinationId: DESTINATION });
  assert.equal(request.url, 'https://api.decart.ai/v1/client/tokens');
  assert.equal(request.headers['X-API-KEY'], key);
  assert.deepEqual(JSON.parse(request.body).allowedModels, [MODEL]);
  broker.cancel(); assert(request.signal.aborted);
  pending.resolve({ ok: true, text: async () => JSON.stringify({ apiKey: 'ephemeral-fixture' }) });
  await assert.rejects(token, /abort/i);
  const good = new LiveTryOnTokens({ key: () => key, fetchImpl: async () => ({ ok: true, text: async () => JSON.stringify({ apiKey: 'ephemeral-fixture' }) }) });
  assert.equal((await good.create({ consent: true, destinationId: DESTINATION })).apiKey, 'ephemeral-fixture');
  key = ''; await assert.rejects(good.create({ consent: true, destinationId: DESTINATION }), /API key/);

  const source = await fs.readFile(path.join(__dirname, '../src/liveTryOn.js'), 'utf8');
  const { LiveTryOn, portraitCrop, garmentPrompt } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  assert.deepEqual(portraitCrop(1280, 720), [437.5, 0, 405, 720]);
  assert.match(garmentPrompt({ name: 'Blue jeans', category: 'bottoms' }), /current bottoms/);
  const sourceTrack = new EventTarget(); sourceTrack.readyState = 'live';
  let disposals = 0; let disconnects = 0; let tokens = 0; const connects = [];
  const sdk = { noopLogger: {}, models: { realtime: model => ({ name: model }) }, createDecartClient: () => ({ realtime: { connect: (stream, options) => {
    const waiting = deferred(); connects.push({ options, waiting }); return waiting.promise;
  } } }) };
  let presented; let clock = 0; let cameraCurrent = true;
  const output = { hidden: true, srcObject: null, pause() {}, play: async () => {}, requestVideoFrameCallback: callback => { presented = callback; return 1; }, cancelVideoFrameCallback() {} };
  const mirror = new LiveTryOn({ video: {}, output, loadSdk: async () => sdk,
    token: async () => { tokens++; return { apiKey: 'ephemeral-fixture', model: MODEL, maxSessionSeconds: 600 }; },
    cancelToken() {}, loadGarment: async () => new Blob(['fixture'], { type: 'image/png' }),
    now: () => clock, createInput: () => ({ stream: {}, sourceTrack, isCurrent: () => cameraCurrent, dispose: () => disposals++ }) });
  const item = { name: 'Black shirt', imageUrl: 'local-fixture', category: 'top' };
  assert.equal(await mirror.start(item, false), false); assert.equal(tokens, 0);
  const first = mirror.start(item, true); await tick();
  const remote = { on() {}, disconnect: () => disconnects++ };
  connects[0].options.onRemoteStream({ getTracks: () => [], getVideoTracks: () => [] });
  assert(output.hidden, 'Pending connection displayed video before its session was accepted');
  mirror.stop(); connects[0].waiting.resolve(remote); assert.equal(await first, false);
  assert.equal(disconnects, 1); assert.equal(disposals, 1); assert.equal(output.srcObject, null);
  const second = mirror.start(item, true); await tick();
  connects[1].options.onRemoteStream({ getTracks: () => [], getVideoTracks: () => [] });
  connects[1].waiting.resolve(remote); assert(await second); await tick();
  assert.equal(mirror.state, 'connecting'); assert(output.hidden, 'Playback promise alone claimed streaming');
  presented();
  assert.equal(mirror.state, 'streaming'); assert.equal(output.hidden, false);
  assert.equal(mirror.snapshot().latencyMs, null);
  connects[1].options.onConnectionQuality({ quality: 'good', metrics: { g2gMs: 140, fps: 25 } });
  assert.equal(mirror.snapshot().latencyMs, 140); assert.equal(mirror.snapshot().fps, 25);
  const currentStream = output.srcObject;
  let staleTrackStopped = false;
  connects[0].options.onRemoteStream({ getTracks: () => [{ stop: () => staleTrackStopped = true }] });
  assert(staleTrackStopped); assert.equal(output.srcObject, currentStream);
  sourceTrack.dispatchEvent(new Event('ended')); assert.equal(mirror.state, 'error'); assert.equal(output.srcObject, null); assert(output.hidden);
  assert.equal(disconnects, 2); assert.equal(disposals, 2);
  assert.equal(sourceTrack.readyState, 'live', 'Cloud cleanup stopped the shared camera');
  const third = mirror.start(item, true); await tick();
  connects[2].options.onRemoteStream({ getTracks: () => [], getVideoTracks: () => [] });
  connects[2].waiting.resolve(remote); await third; presented();
  clock = 3501; mirror.checkFreshness();
  assert.equal(mirror.state, 'error'); assert.match(mirror.error, /stalled/); assert(output.hidden); assert.equal(output.srcObject, null);
  const fourth = mirror.start(item, true); await tick();
  cameraCurrent = false; mirror.checkFreshness();
  connects[3].waiting.resolve(remote); assert.equal(await fourth, false);
  assert.match(mirror.error, /Camera changed/);
  console.log('Live AI try-on lifecycle passed: consent, scoped tokens, cancellation, portrait crop, presented-frame gating, stalled/late output, reported latency, camera loss/change, and separate camera ownership. Cloud quality is unverified.');
})().catch(error => { console.error(error); process.exitCode = 1; });
