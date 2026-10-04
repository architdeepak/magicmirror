// Connects only to a locally running mirror. No Gemini request is started.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

(async () => {
  const pages = await fetch('http://127.0.0.1:9347/json').then(r => r.json());
  const page = pages.find(page => page.url.includes('/src/index.html'));
  assert(page, 'Start the mirror with --remote-debugging-port=9347 first');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    const waiter = pending.get(message.id);
    if (waiter) { pending.delete(message.id); message.error ? waiter.reject(Error(message.error.message)) : waiter.resolve(message.result); }
  };
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const requestId = ++id;
      const timeout = setTimeout(() => { pending.delete(requestId); reject(Error(`${method} timed out`)); }, 15000);
      pending.set(requestId, { resolve: value => {clearTimeout(timeout); resolve(value);}, reject: error => {clearTimeout(timeout); reject(error);} });
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });
  }
  async function evaluate(expression) {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  }
  try {
    if (process.argv.includes('--reload')) { await send('Page.reload'); return; }
    const status = await evaluate(`(() => {
      const d = window.__mirrorDebug;
      if (!d) throw Error('Mirror failed to initialize');
      const video = document.querySelector('#camera-feed');
      return { tracking:d.getTrackingStatus(), hand:d.gestures.status, handInferenceMs:d.gestures.inferenceMs,
        video:{width:video.videoWidth,height:video.videoHeight,readyState:video.readyState,currentTime:video.currentTime},
        depth:document.querySelector('#app-shell').dataset.depth, fps:d.renderQuality.fps,
        cameraLabels:[...document.querySelector('#camera-select').options].map(o=>o.textContent) };
    })()`);
    console.log('Hardware runtime status:', JSON.stringify(status));
    assert(status.tracking.cameraActive, 'Camera did not start');
    assert(status.tracking.ready, 'Face model failed to initialize');
    assert(status.video.width > 0 && status.video.readyState >= 2, 'Camera frames unavailable');
    assert.notEqual(status.hand, 'unavailable', 'Hand model failed to initialize');
    if (process.argv.includes('--status')) return;
    if (process.argv.includes('--camera') || process.argv.includes('--depth')) {
      await evaluate(process.argv.includes('--camera') ? "window.__mirrorDebug.setMode('ar')" : "document.querySelector('[data-depth=cube]').click(); window.__mirrorDebug.setMode('mirror')");
      console.log('View selected');
      await new Promise(resolve => setTimeout(resolve, 600));
      await send('Page.bringToFront');
      const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: false });
      const output = path.join(os.tmpdir(), process.argv.includes('--camera') ? 'magicmirror-camera.png' : 'magicmirror-depth.png');
      await fs.writeFile(output, Buffer.from(shot.data, 'base64'));
      console.log('Visual capture:', output);
      return;
    }
    const checks = await evaluate(`(async () => {
      const d = window.__mirrorDebug;
      const shell = document.querySelector('#app-shell');
      d.setMode('ar');
      await new Promise(resolve => setTimeout(resolve, 450));
      const chip = document.querySelector('[data-effect="glasses"]');
      const a = chip.getBoundingClientRect(), b = shell.getBoundingClientRect();
      const p = {x:(a.left+a.width/2-b.left)/b.width, y:(a.top+a.height/2-b.top)/b.height};
      d.handleGesture('pointer-down', p);
      if (!chip.classList.contains('held')) throw Error('Glasses could not be picked up');
      d.handleGesture('pointer-up', {x:0,y:0});
      if (chip.classList.contains('held')) throw Error('Release did not clear held item');
      const oldVideoTracks = document.querySelector('#camera-feed').srcObject.getTracks();
      await d.sleep.enter();
      if (!d.sleep.sleeping || shell.dataset.sleeping !== 'true') throw Error('Sleep UI failed');
      if (d.getTrackingStatus().cameraActive || oldVideoTracks.some(t=>t.readyState!=='ended')) throw Error('Camera still active in sleep');
      if (d.gestures.enabled || d.gemini.listening) throw Error('Assistant or hands still listening in sleep');
      if (!d.wake.enabled || !d.wake.stream?.active) throw Error('Local wake microphone not armed');
      d.setMode('watch');
      d.handleGesture('pointer-click', p);
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'3'}));
      if (!d.sleep.sleeping || shell.dataset.mode !== 'ar') throw Error('Non-wake input escaped sleep');
      // Exercise the phrase transition without starting a billable AI voice session.
      if (!await d.sleep.wakeFromPhrase()) throw Error('Wake transition failed');
      if (d.sleep.sleeping || shell.dataset.sleeping || !d.getTrackingStatus().cameraActive) throw Error('Wake did not restore camera');
      d.setMode('mirror');
      return {pickUp:true,release:true,sleepCameraOff:true,wakeMicOnly:true,otherInputsBlocked:true,cameraRestored:true};
    })()`);
    console.log('Mirror integration checks passed:', JSON.stringify(checks));
    await send('Page.bringToFront');
    const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: false });
    const output = path.join(os.tmpdir(), 'magicmirror-runtime.png');
    await fs.writeFile(output, Buffer.from(screenshot.data, 'base64'));
    console.log('Visual capture:', output);
  } finally { socket.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
