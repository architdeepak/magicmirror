// Production packaged renderer and real video frames; ONLY the cloud transport
// is a local fixture. This does not evaluate generated garment quality.
const assert = require('assert/strict');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { connect } = require('./cdp-client.cjs');
const root = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'mirror-live-ui-'));
  const profile = path.join(temporary, 'profile');
  const assetPath = path.join(profile, 'data/closet/shirt.png');
  await fs.mkdir(path.dirname(assetPath), { recursive: true });
  await fs.writeFile(assetPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGZkAAAAASUVORK5CYII=', 'base64'));
  await fs.writeFile(path.join(profile, 'data/closet.json'), JSON.stringify({ version: 1, garments: [
    { id: 'blue', name: 'Blue shirt fixture', category: 'top', assetPath },
    { id: 'green', name: 'Green shirt fixture', category: 'top', assetPath }
  ] }));
  const binary = path.join(root, `dist/linux-${process.arch}-unpacked/magic-mirror-portal`);
  let logs = '', exit = null, client;
  const child = spawn(binary, ['--no-sandbox', '--disable-gpu', `--user-data-dir=${profile}`, '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0'], {
    cwd: temporary, env: { ...process.env, DECART_API_KEY: '', GEMINI_API_KEY: '', MIRROR_SPOTIFY_CLIENT_ID: '', MIRROR_TRYON_ENDPOINT: '', MIRROR_VERTEX_PROJECT: '', MIRROR_KIOSK: 'false' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  for (const pipe of [child.stdout, child.stderr]) pipe.on('data', bytes => logs = (logs + bytes.toString()).slice(-16000));
  child.on('exit', (code, signal) => exit = { code, signal });
  const until = async (predicate, timeout, label) => {
    const started = Date.now();
    while (true) { if (exit) throw new Error(JSON.stringify(exit)); const value = await predicate(); if (value) return value;
      if (Date.now() - started > timeout) throw new Error(label + ' timed out; ' + logs.slice(-3000)); await delay(80); }
  };
  const state = () => client.evaluate('__mirrorDebug.getMirrorState()');
  try {
    const debug = await until(() => logs.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/)?.[1], 30000, 'Debug endpoint');
    const target = await until(async () => (await fetch(`http://${new URL(debug).host}/json/list`).then(r => r.json())).find(t => t.url.includes('app.asar/src/index.html')), 30000, 'Renderer');
    client = await connect(target.webSocketDebuggerUrl);
    await client.call('Page.enable');
    await until(() => client.evaluate('Boolean(window.__mirrorDebug)&&document.querySelector("#loader").classList.contains("done")'), 45000, 'Initial startup');
    await client.call('Page.addScriptToEvaluateOnNewDocument', { source: `
      localStorage.setItem('mirror.hard-muted','true');localStorage.setItem('mirror.wake','false');localStorage.setItem('mirror.gestures','false');localStorage.setItem('mirror.vision','false');
      window.__fixture={connections:[],disconnects:0,streams:[],timers:[]};
      __fixture.video=color=>{
        const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const context=canvas.getContext('2d');let tick=0;
        const draw=()=>{context.fillStyle=color;context.fillRect(0,0,1280,720);context.fillStyle='white';context.fillRect(20+(tick++%200),20,40,40)};draw();
        const timer=setInterval(draw,33), stream=canvas.captureStream(30);__fixture.streams.push(stream);__fixture.timers.push(timer);return {stream,timer};
      };
      navigator.mediaDevices.getUserMedia=async constraints=>{if(!constraints.video)throw new DOMException('No microphone in camera fixture','NotAllowedError');return __fixture.video('#222').stream};
    ` });
    await client.call('Page.reload');
    await until(() => client.evaluate('Boolean(window.__fixture)&&Boolean(window.__mirrorDebug)&&document.querySelector("#loader").classList.contains("done")'), 45000, 'Startup');
    console.log('Live try-on UI: synthetic camera startup passed');
    await client.evaluate(`(async()=>{
      document.querySelector('#decart-key').value='synthetic-decart-fixture';document.querySelector('#remember-connections').checked=false;document.querySelector('#connection-form').requestSubmit();
      const controller=__mirrorDebug.liveTryOn;
      controller.token=async()=>({apiKey:'ephemeral-local-fixture',model:'lucy-vton-3.5',maxSessionSeconds:600});controller.cancelToken=()=>{};
      controller.loadSdk=async()=>({noopLogger:{},models:{realtime:name=>({name})},createDecartClient:()=>({realtime:{connect:(stream,options)=>new Promise(resolve=>{
        const record={stream,options,resolve};__fixture.connections.push(record);
      })}})});
      __fixture.complete=index=>{const record=__fixture.connections[index],output=__fixture.video(index===0?'blue':'green');record.remote=output;
        record.options.onRemoteStream(output.stream);record.resolve({on(){},disconnect(){__fixture.disconnects++;clearInterval(output.timer);output.stream.getTracks().forEach(track=>track.stop())}})};
      __fixture.captureVision=async()=>{
        const assistant=__mirrorDebug.gemini, previousSocket=assistant.ws, previousEnabled=assistant.visionEnabled;let message;
        assistant.ws={readyState:WebSocket.OPEN,send:value=>message=JSON.parse(value)};assistant.visionEnabled=true;
        try {
          const sent=await assistant._sendVideoFrame();if(!sent)return {sent:false};
          const image=new Image();image.src='data:image/jpeg;base64,'+message.realtimeInput.video.data;await image.decode();
          const pixel=document.createElement('canvas');pixel.width=1;pixel.height=1;const context=pixel.getContext('2d');
          context.drawImage(image,image.width/2,image.height/2,1,1,0,0,1,1);
          return {sent:true,source:assistant.getVideoSourceSnapshot().lastSentSource,color:Array.from(context.getImageData(0,0,1,1).data),dimensions:[image.width,image.height]};
        } finally {assistant.ws=previousSocket;assistant.visionEnabled=previousEnabled}
      };
    })()`);
    await until(async () => (await state()).tryOn.liveAI.configured, 10000, 'Settings');
    console.log('Live try-on UI: Settings passed');
    await client.evaluate(`document.querySelector('[data-mode="ar"].mode-btn').click();document.querySelector('[data-closet-id="blue"]').click()`);
    assert(await client.evaluate('document.querySelector("#live-tryon-start").disabled'), 'Start allowed without consent');
    await client.evaluate(`(()=>{const consent=document.querySelector('#live-tryon-consent');consent.checked=true;consent.dispatchEvent(new Event('change'));document.querySelector('#live-tryon-start').click()})()`);
    await until(() => client.evaluate('__fixture.connections.length===1'), 10000, 'First connection');
    assert.equal((await state()).tryOn.liveAI.state, 'connecting');
    assert(await client.evaluate('document.querySelector("#live-tryon-video").hidden'));
    assert.equal((await client.evaluate('__fixture.captureVision()')).sent, false, 'Connecting outfit sent raw camera imagery');
    await client.evaluate('__fixture.complete(0)');
    await until(async () => (await state()).tryOn.liveAI.state === 'streaming', 10000, 'First presented frame');
    const first = await state(); assert.equal(first.tryOn.view, 'neural'); assert(first.tryOn.liveAI.frameAgeMs < 1000);
    const blueVision = await client.evaluate('__fixture.captureVision()');
    assert.equal(blueVision.source, 'live-ai-try-on'); assert(blueVision.color[2] > 200 && blueVision.color[0] < 40 && blueVision.color[1] < 40, 'Assistant received raw camera instead of blue output');
    assert(Math.max(...blueVision.dimensions) <= 640, 'Vision frame exceeded its resolution budget');
    assert(await client.evaluate('getComputedStyle(document.querySelector("#garment-canvas")).display==="none"'));
    await client.evaluate(`document.querySelector('[data-closet-id="green"]').click()`);
    await until(() => client.evaluate('__fixture.connections.length===2'), 10000, 'Garment change');
    assert.equal((await state()).tryOn.liveAI.garment, 'Green shirt fixture');
    assert(await client.evaluate('document.querySelector("#live-tryon-video").hidden'));
    await client.evaluate(`__fixture.complete(1);const late=__fixture.video('red');__fixture.connections[0].options.onRemoteStream(late.stream);__fixture.late=late`);
    await until(async () => (await state()).tryOn.liveAI.state === 'streaming', 10000, 'Replacement stream');
    const greenVision = await client.evaluate('__fixture.captureVision()');
    assert.equal(greenVision.source, 'live-ai-try-on'); assert(greenVision.color[1] > 100 && greenVision.color[0] < 40 && greenVision.color[2] < 40, 'Assistant received old outfit pixels after garment change');
    assert(await client.evaluate('__fixture.late.stream.getVideoTracks()[0].readyState==="ended"'));
    // Freeze returned frames without emitting an ended event or disconnect.
    await client.evaluate('clearInterval(__fixture.connections[1].remote.timer)');
    await until(async () => (await state()).tryOn.liveAI.state === 'error', 8000, 'Frozen output watchdog');
    assert.match((await state()).tryOn.liveAI.error, /stalled/);
    assert(await client.evaluate('document.querySelector("#live-tryon-video").hidden&&document.querySelector("#live-tryon-video").srcObject===null'));
    assert(await client.evaluate('document.querySelector("#camera-feed").srcObject.getVideoTracks()[0].readyState==="live"'));
    await client.evaluate('document.querySelector("#live-tryon-start").click()');
    await until(() => client.evaluate('__fixture.connections.length===3'), 10000, 'Restart');
    await client.evaluate('__fixture.complete(2)');
    await until(async () => (await state()).tryOn.liveAI.state === 'streaming', 10000, 'Restart frames');
    await client.evaluate('__mirrorDebug.stopAssistant()');
    assert.equal((await state()).tryOn.liveAI.active, false);
    assert(await client.evaluate('__fixture.connections.every(record=>record.stream.getVideoTracks()[0].readyState==="ended")'));
    const restart = async index => {
      await client.evaluate(`document.querySelector('[data-mode="ar"].mode-btn').click();document.querySelector('#live-tryon-start').click()`);
      await until(() => client.evaluate(`__fixture.connections.length===${index + 1}`), 10000, 'Connection ' + index);
      await client.evaluate(`__fixture.complete(${index})`);
      await until(async () => (await state()).tryOn.liveAI.state === 'streaming', 10000, 'Presented frames ' + index);
    };
    // Toggle out of the startup hard mute, then verify the real Mute control.
    await client.evaluate('document.querySelector("#mute-btn").click()');
    await restart(3);
    await client.evaluate('document.querySelector("#mute-btn").click()');
    assert.equal((await state()).tryOn.liveAI.active, false);
    assert.equal((await state()).voice.hardMuted, true);
    await restart(4);
    await client.evaluate(`(()=>{const consent=document.querySelector('#live-tryon-consent');consent.checked=false;consent.dispatchEvent(new Event('change'))})()`);
    assert.equal((await state()).tryOn.liveAI.active, false);
    assert(await client.evaluate('document.querySelector("#live-tryon-start").disabled'));
    await client.evaluate(`(()=>{const consent=document.querySelector('#live-tryon-consent');consent.checked=true;consent.dispatchEvent(new Event('change'))})()`);
    await restart(5);
    await client.evaluate(`document.querySelector('[data-mode="watch"].mode-btn').click()`);
    assert.equal((await state()).tryOn.liveAI.active, false);
    await restart(6);
    await client.evaluate(`document.querySelector('#camera-feed').srcObject.getVideoTracks()[0].dispatchEvent(new Event('ended'))`);
    await until(async () => !(await state()).tryOn.liveAI.active, 5000, 'Camera loss');
    assert.equal((await state()).camera.active, false);
    assert(await client.evaluate('__fixture.connections.every(record=>record.stream.getVideoTracks()[0].readyState==="ended")'));
    const directory = path.join(root, 'artifacts/live-tryon-ui'); await fs.mkdir(directory, { recursive: true });
    const result = { transport: 'local synthetic fixture', generatedQualityVerified: false, portraitVideo: 'passed', consent: 'passed', garmentChange: 'passed', staleOutput: 'passed', frameFreshness: 'passed', sharedCameraOwnership: 'passed', assistantStop: 'passed', hardMute: 'passed', consentWithdrawal: 'passed', modeExit: 'passed', cameraLoss: 'passed', assistantVisionPixels: 'passed with local socket fixture; no Gemini image upload' };
    await fs.writeFile(path.join(directory, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
  } finally { client?.close(); if (!exit) child.kill('SIGTERM'); await delay(200); if (!exit) child.kill('SIGKILL'); await fs.rm(temporary, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
