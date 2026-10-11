// Real app render counts and Chromium task metrics in an isolated profile.
// BENCH_QUICK=1 npm run bench: one short Efficient-tier pass.
// CPU throttling is a stress condition, not a simulation of the stick's GPU.
const { spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const assert = require('assert/strict');
const { connect } = require('./cdp-client.cjs');
const root = path.resolve(__dirname, '..');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function options(env) {
  const quick = env.BENCH_QUICK === '1';
  const throttles = (env.BENCH_THROTTLE || (quick ? '1' : '1,6')).split(',').map(Number);
  const qualities = (env.BENCH_QUALITY || (quick ? 'eco' : 'eco,auto,hd')).split(',');
  const duration = Number(env.BENCH_DURATION_MS || (quick ? 1000 : 3000));
  const width = Number(env.BENCH_WIDTH || (quick ? 540 : 1080));
  const height = Number(env.BENCH_HEIGHT || (quick ? 960 : 1920));
  assert(throttles.every(rate => Number.isFinite(rate) && rate >= 1 && rate <= 20), 'BENCH_THROTTLE must be between 1 and 20');
  assert(qualities.every(value => ['eco', 'auto', 'hd'].includes(value)), 'Unknown BENCH_QUALITY');
  assert(Number.isFinite(duration) && duration >= 500 && duration <= 10000, 'BENCH_DURATION_MS must be between 500 and 10000');
  assert([width, height].every(value => Number.isInteger(value) && value >= 320 && value <= 4096), 'Invalid benchmark dimensions');
  return { throttles, qualities, duration, width, height };
}

async function interactionAudit(client,output) {
  const press = async (key, extras = {}) => {
    await client.call('Input.dispatchKeyEvent', { type: 'keyDown', key, ...extras });
    await client.call('Input.dispatchKeyEvent', { type: 'keyUp', key, modifiers: extras.modifiers || 0 });
  };
  await client.evaluate('__mirrorDebug.setAssistantMode("mirror");document.activeElement?.blur()');
  for (let cycle = 0; cycle < 4; cycle++) for (const [key, mode] of [['1','portal'],['2','mirror'],['3','ar'],['4','watch']]) {
    await press(key); assert.equal(await client.evaluate('__mirrorDebug.getMirrorState().display.mode'), mode, 'Rapid mode shortcut failed');
    assert.equal(await client.evaluate('__mirrorDebug.getMirrorState().display.requestedMode'),mode,'Keyboard mode did not become the requested mode');
  }
  await client.evaluate('__mirrorDebug.setAssistantMode("mirror");const input=document.createElement("input");input.id="bench-focus";document.body.append(input);input.focus()');
  await press('3'); assert.equal(await client.evaluate('__mirrorDebug.getMirrorState().display.mode'), 'mirror', 'Typing changed mirror mode');
  await client.evaluate(`document.querySelector('#bench-focus').remove();window.__benchClicks=0;window.__benchCameraClick=()=>__benchClicks++;document.querySelector('#camera-toggle').addEventListener('click',__benchCameraClick)`);
  for(const modifiers of [1,2,4])await press('c',{modifiers});
  await press('c',{autoRepeat:true}); await press('3',{autoRepeat:true});
  assert.equal(await client.evaluate('__benchClicks'),0,'Modifier or held key clicked the camera');
  assert.equal(await client.evaluate('__mirrorDebug.getMirrorState().display.mode'),'mirror','Held key changed mode');
  await client.evaluate('window.__benchConsume=event=>event.preventDefault();window.addEventListener("keydown",__benchConsume,true)');
  await press('3');assert.equal(await client.evaluate('__mirrorDebug.getMirrorState().display.mode'),'mirror','Consumed event changed mode');
  await client.evaluate('window.removeEventListener("keydown",__benchConsume,true);document.querySelector("#camera-toggle").removeEventListener("click",__benchCameraClick);__mirrorDebug.showSearchResult({query:"Fixture search",answer:"A local answer, with no external lookup.",sources:[]})');
  assert.equal(await client.evaluate('document.querySelector("#search-pool").hidden'),false,'Search popup did not open');
  await client.evaluate('__mirrorDebug.showSearchResult({query:"Long fixture",answer:"A long answer. ".repeat(150),sources:[]});document.querySelector("#search-pool").scrollTop=99999');
  assert(await client.evaluate('document.querySelector("#search-pool").scrollTop>0'),'Answer scroll fixture did not overflow');
  await client.evaluate('__mirrorDebug.showSearchResult({query:"New answer",answer:"A replacement answer. ".repeat(150),sources:[]})');
  assert.equal(await client.evaluate('document.querySelector("#search-pool").scrollTop'),0,'New answer inherited old scroll position');
  await press('Escape');assert.equal(await client.evaluate('document.querySelector("#search-pool").hidden'),true,'Escape did not dismiss search popup');
  await client.evaluate('__mirrorDebug.setAssistantMode("mirror");__mirrorDebug.gemini.onState("ready");__mirrorDebug.showAssistant()');
  await wait(1050);assert.equal(await client.evaluate('__mirrorDebug.getMirrorState().display.mode'),'portal','Old ready callback hid a newer assistant');
  await press('4');await client.evaluate('__mirrorDebug.gemini.onState("ready")');await wait(1050);
  assert.equal(await client.evaluate('__mirrorDebug.getMirrorState().display.mode'),'watch','Voice completion lost keyboard mode selection');
  await client.evaluate('__mirrorDebug.showSearchResult({query:"Layered fixture",answer:"Keep this answer while closing Settings.",sources:[]});document.querySelector("#settings-toggle").click()');
  assert.equal(await client.evaluate('document.activeElement.closest("#settings-panel")!==null'),true,'Settings did not receive keyboard focus');
  await press('3');assert.equal(await client.evaluate('__mirrorDebug.getMirrorState().display.mode'),'watch','Settings input triggered mode shortcut');
  await press('Escape');
  assert.equal(await client.evaluate('document.activeElement.id'),'settings-toggle','Escape did not return settings focus');
  assert.equal(await client.evaluate('document.querySelector("#search-pool").hidden'),false,'Handled Settings Escape also dismissed answer');
  await press('Escape');assert.equal(await client.evaluate('document.querySelector("#search-pool").hidden'),true,'Second Escape did not dismiss answer');
  assert.equal(await client.evaluate('document.querySelector("#settings-panel").inert'),true,'Closed settings remains interactive');
  await client.evaluate('document.querySelector("#settings-panel input").focus()');
  assert.equal(await client.evaluate('document.activeElement.closest("#settings-panel")===null'),true,'Hidden settings captured focus');
  await client.evaluate('document.querySelector("#persona-toggle").click();document.querySelector("#launcher-toggle").click()');
  assert.equal(await client.evaluate('document.querySelectorAll(".persona-panel.open,.launcher-panel.open,.settings-panel.open").length'),1,'Dock panels overlap');
  await press('Escape');assert.equal(await client.evaluate('document.activeElement.id'),'launcher-toggle','Launcher focus was not restored');
  await client.evaluate('__mirrorDebug.gemini.onState("ready")');
  for(const [mode,duck] of [['portal',false],['watch',true],['spotify',true],['portal',false]]) {
    await client.evaluate(`__mirrorDebug.setAssistantMode(${JSON.stringify(mode)})`);
    assert.equal(await client.evaluate('__mirrorDebug.getAmbienceState().duck'),duck,'Atmosphere did not follow mode '+mode);
  }
  await client.evaluate('__mirrorDebug.gemini.onState("connecting")');
  assert.equal(await client.evaluate('__mirrorDebug.getAmbienceState().duck'),true,'Connection did not quiet atmosphere');
  await client.evaluate('__mirrorDebug.gemini.onState("ready");__mirrorDebug.setAssistantMode("mirror")');
  assert.equal(await client.evaluate('__mirrorDebug.getAmbienceState().duck'),false,'Atmosphere did not recover after voice');
  await client.evaluate('__mirrorDebug.mirrorTimers.add(60,"Fixture");window.__benchTimerNode=document.querySelector("#timer-chip span");window.__benchTimerText=__benchTimerNode.textContent');
  await wait(1200);
  assert.equal(await client.evaluate('document.querySelector("#timer-chip span")===__benchTimerNode'),true,'Countdown rebuilt timer chip');
  assert.equal(await client.evaluate('__benchTimerNode.textContent!==__benchTimerText'),true,'Countdown did not update');
  await client.evaluate('__mirrorDebug.mirrorTimers.cancelAll()');
  assert.equal(await client.evaluate('document.querySelector("#timer-chip").hidden'),true,'Cancelled timer chip remained visible');
  await client.evaluate('(()=>{const toast=document.querySelector("#gesture-toast");toast.textContent="Stopped · microphone muted";toast.classList.add("show")})()');
  await wait(250);
  assert.equal(await client.evaluate('(()=>{const toast=document.querySelector("#gesture-toast").getBoundingClientRect();return toast.top>=Math.max(...[...document.querySelectorAll(".mirror-clock,.mirror-weather")].map(node=>node.getBoundingClientRect().bottom))+8})()'),true,'Feedback overlaps clock/weather');
  if(output){const screenshot=await client.call('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,'feedback-layout.png'),Buffer.from(screenshot.data,'base64'));}
  assert.equal(await client.evaluate('(()=>{const p=document.querySelector("#privacy-chip").getBoundingClientRect();return [...document.querySelectorAll("#launcher-toggle,#persona-toggle,#mic-btn,#mute-btn")].every(node=>{const b=node.getBoundingClientRect();return !(p.right>b.left&&p.left<b.right&&p.bottom>b.top&&p.top<b.bottom)})})()'),true,'Privacy chip overlaps dock controls');
  await client.evaluate('document.querySelector("#gesture-toast").classList.remove("show")');
  const viewport=await client.evaluate('({width:innerWidth,height:innerHeight})');
  const verifyGeometry=async()=>{
    const geometry=await client.evaluate('(()=>{const shell=document.querySelector("#app-shell");return{aspect:__mirrorDebug.camera.aspect,expected:shell.clientWidth/shell.clientHeight}})()');
    assert(Math.abs(geometry.aspect-geometry.expected)<.001,'Projection uses stale shell dimensions');
  };
  await client.call('Emulation.setDeviceMetricsOverride',{width:viewport.width+120,height:viewport.height+80,deviceScaleFactor:1,mobile:false});await wait(150);await verifyGeometry();
  await client.evaluate('(()=>{const shell=document.querySelector("#app-shell");window.__benchShellStyle=shell.getAttribute("style");shell.style.setProperty("width","400px","important");shell.style.setProperty("height","600px","important")})()');
  await wait(150);await verifyGeometry();
  assert.equal(await client.evaluate('__mirrorDebug.camera.aspect'),2/3,'Shell-only resize failed');
  await client.evaluate('(()=>{const shell=document.querySelector("#app-shell");if(__benchShellStyle===null)shell.removeAttribute("style");else shell.setAttribute("style",__benchShellStyle)})()');
  await client.call('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:false});await wait(150);await verifyGeometry();
  return ['16 rapid mode switches and requested-mode retention','typing preserves mode','OS modifiers and held keys preserve camera/mode','consumed shortcut ignored','search popup opens and Escape dismisses','stale ready callback cannot hide newer assistant','keyboard Watch persists through ready restoration','dock panel focus, Escape, inert closure and exclusive opening','atmosphere follows mode and voice transitions','timer countdown retains node and cancellation hides chip','feedback stays below clock and weather','native and shell-only resize refresh projection'];
}

async function run(env = process.env) {
  const config = options(env);
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'mirror-bench-'));
  const output = path.join(root, 'artifacts/bench-perf', String(Date.now()));
  await fs.mkdir(output, { recursive: true });
  let child, client, exited = false, logs = '', spawnError, interrupted = false;
  const interrupt = () => { interrupted = true; child?.kill(); };
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  const errors = [], results = [];
  const until = async (fn, label, timeout = 60000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (spawnError) throw spawnError;
      if (interrupted) throw Error('Benchmark interrupted');
      if (exited) throw Error('Benchmark app exited: ' + logs.slice(-1000));
      const value = await fn(); if (value) return value;
      await wait(100);
    }
    throw Error(label + ' timed out: ' + logs.slice(-1000));
  };
  try {
    child = spawn(require('electron'), [root, `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', '--use-fake-device-for-media-stream'], {
      cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...env, GEMINI_API_KEY: '', DECART_API_KEY: '', MIRROR_KIOSK: 'false' }
    });
    child.once('exit', () => { exited = true; }); child.once('error', error => { spawnError = error; });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => { logs = (logs + bytes).slice(-12000); });
    const endpoint = await until(() => logs.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/)?.[1], 'Debug endpoint');
    const page = await until(async () => {
      const pages = await fetch('http://' + new URL(endpoint).host + '/json/list', { signal: AbortSignal.timeout(2000) }).then(response => response.json());
      return pages.find(target => target.url.endsWith('/src/index.html'));
    }, 'Mirror page');
    client = await connect(page.webSocketDebuggerUrl);
    await client.call('Page.enable'); await client.call('Performance.enable'); await client.call('Runtime.enable');
    await client.call('Page.addScriptToEvaluateOnNewDocument', { source: `
      localStorage.setItem('mirror.hard-muted','true'); localStorage.setItem('mirror.wake','false');
      localStorage.setItem('mirror.gestures','false'); localStorage.setItem('mirror.depth-cube','false');
      localStorage.setItem('mirror.avatar-render-style','portrait'); localStorage.setItem('mirror.magic-sounds','false');
      localStorage.setItem('mirror.reduced-motion','false');
      navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Benchmark sensors disabled','NotAllowedError')};
    ` });
    await client.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await client.call('Emulation.setDeviceMetricsOverride', { width: config.width, height: config.height, deviceScaleFactor: 1, mobile: false });
    await client.call('Page.reload');
    await until(() => client.evaluate('!!window.__mirrorDebug && document.querySelector("#loader").classList.contains("done") && __mirrorDebug.avatar.faceHost?.ready'), 'Ready portrait');
    client.onEvent(event => { if (event.method === 'Runtime.exceptionThrown') errors.push(event.params.exceptionDetails.exception?.description || event.params.exceptionDetails.text); });
    assert(await client.evaluate('!__mirrorDebug.getMirrorState().camera.active && !__mirrorDebug.gemini.connected'), 'Benchmark opened sensors or a voice service');
    await client.evaluate('mirrorBridge.rememberFact({fact:"Benchmark profile isolation fixture",category:"test"})');
    assert((await fs.readFile(path.join(profile, 'data/memory.json'), 'utf8')).includes('Benchmark profile isolation fixture'), 'Native writable data escaped benchmark profile');
    const interactionChecks = env.BENCH_INTERACTIONS === '1' ? await interactionAudit(client,output) : [];
    await client.evaluate(`(() => {
      const d=__mirrorDebug; window.__bench={scenePaints:0,speaking:false,lastCaption:0,shellDimensionReads:0,motionStyleWrites:0};
      const shell=document.querySelector('#app-shell');
      const setStyle=shell.style.setProperty.bind(shell.style);shell.style.setProperty=(name,...args)=>{if(['--follow-x','--viewer-x','--viewer-y'].includes(name))__bench.motionStyleWrites++;return setStyle(name,...args)};
      for(const key of ['clientWidth','clientHeight']){const get=Object.getOwnPropertyDescriptor(Element.prototype,key).get;Object.defineProperty(shell,key,{get(){__bench.shellDimensionReads++;return get.call(this)}})}
      const scenePaint=d.scene.onBeforeRender;
      d.scene.onBeforeRender=function(...args){__bench.scenePaints++;scenePaint?.apply(this,args)};
      const update=d.avatar.update.bind(d.avatar);
      d.avatar.update=(dt,elapsed,viewer)=>{
        if(__bench.speaking){d.avatar.setSpeechLevel(.25+.65*Math.abs(Math.sin(elapsed*12)));d.avatar.setViseme(Math.sin(elapsed*8)>0?'AA':'O');
          if(elapsed-__bench.lastCaption>.3){__bench.lastCaption=elapsed;d.appendCaption('assistant',' A little wonder awaits.',{delta:true})}}
        return update(dt,elapsed,viewer);
      };
      window.__benchCounters=()=>({at:performance.now(),frames:d.getPowerState().frames,scenePaints:__bench.scenePaints,shellDimensionReads:__bench.shellDimensionReads,motionStyleWrites:__bench.motionStyleWrites,facePaints:d.avatar.faceHost.drawCount,warpStrips:d.avatar.faceHost.features?.stats.strips||0,effectPaints:d.magic.snapshot().frames});
    })()`);
    const metrics = async () => Object.fromEntries((await client.call('Performance.getMetrics')).metrics.map(item => [item.name, item.value]));
    const measure = async (phase, rate, quality) => {
      const speaking = phase === 'speaking' || phase === 'recovery';
      await client.evaluate(`(() => {const d=__mirrorDebug;__bench.speaking=false;d.stopAssistant();d.setAssistantMode('${speaking ? 'portal' : 'mirror'}');})()`);
      await wait(500);
      if (speaking) await client.evaluate('__bench.speaking=true;__mirrorDebug.gemini.onState("speaking")');
      if (phase === 'reveal') await client.evaluate('__mirrorDebug.magic.play("wake",{muted:true})');
      const beforeMetrics = await metrics();
      const before = await client.evaluate('__benchCounters()');
      const duration = phase === 'recovery' ? 65000 : phase === 'reveal' ? Math.min(config.duration, 2500) : config.duration;
      await wait(duration);
      const after = await client.evaluate('__benchCounters()');
      const afterMetrics = await metrics(), seconds = (after.at - before.at) / 1000;
      const metricSeconds = afterMetrics.Timestamp - beforeMetrics.Timestamp;
      assert(Number.isFinite(metricSeconds) && metricSeconds > 0, 'Chromium metric clock is unavailable');
      assert.equal(await client.evaluate('__mirrorDebug.getMirrorState().display.mode'), speaking ? 'portal' : 'mirror', 'Benchmark mode changed during measurement');
      const perSecond = key => +(Math.max(0, after[key] - before[key]) / seconds).toFixed(2);
      const result = { cpuThrottle: rate, quality, phase, measuredMs: Math.round(seconds * 1000), appFramesPerSecond: perSecond('frames'), scenePaintsPerSecond: perSecond('scenePaints'), shellDimensionReadsPerSecond: perSecond('shellDimensionReads'), motionStyleWritesPerSecond: perSecond('motionStyleWrites'), facePaintsPerSecond: perSecond('facePaints'), warpStripsPerSecond: perSecond('warpStrips'), effectPaintsPerSecond: perSecond('effectPaints'),
        rendererTaskMsPerSecond: +((afterMetrics.TaskDuration-beforeMetrics.TaskDuration)*1000/metricSeconds).toFixed(2), layoutMsPerSecond: +((afterMetrics.LayoutDuration-beforeMetrics.LayoutDuration)*1000/metricSeconds).toFixed(2), styleMsPerSecond: +((afterMetrics.RecalcStyleDuration-beforeMetrics.RecalcStyleDuration)*1000/metricSeconds).toFixed(2),
        displayFrequency: await client.evaluate('mirrorBridge.getDisplayCadence()'), graphics: await client.evaluate('__mirrorDebug.getMirrorState().display.graphics'), effectBackend: await client.evaluate('__mirrorDebug.magic.snapshot().backend'), adaptiveQuality: await client.evaluate('__mirrorDebug.getPowerState().adaptive'), portraitSurface: await client.evaluate('({width:__mirrorDebug.avatar.faceHost.canvas.width,height:__mirrorDebug.avatar.faceHost.canvas.height,scale:__mirrorDebug.avatar.faceHost.renderScale??1,featureDetail:__mirrorDebug.avatar.faceHost.features.detail})') };
      if(speaking)assert(result.facePaintsPerSecond>0,'Speaking portrait did not paint');
      if(phase==='recovery'){assert.equal(result.adaptiveQuality.avatarScale,1,'Portrait detail did not recover');assert(result.adaptiveQuality.motionFps >= Math.min(Math.round(result.displayFrequency),quality==='eco'||result.graphics==='software'?30:60),'Motion cadence did not recover')}
      if(phase==='reveal')assert(result.effectPaintsPerSecond>0,'Reveal did not paint');
      const shot = await client.call('Page.captureScreenshot', { format: 'png' });
      await fs.writeFile(path.join(output, `${rate}-${quality}-${phase}.png`), Buffer.from(shot.data, 'base64'));
      results.push(result); console.log(JSON.stringify(result));
      await client.evaluate('__bench.speaking=false;__mirrorDebug.stopAssistant()');
    };
    for (const rate of config.throttles) {
      await client.call('Emulation.setCPUThrottlingRate', { rate });
      for (const quality of config.qualities) {
        await client.evaluate(`(() => {const select=document.querySelector('#display-quality');select.value=${JSON.stringify(quality)};select.dispatchEvent(new Event('change'))})()`);
        await wait(700);
        for (const phase of ['idle', 'speaking', 'reveal']) await measure(phase, rate, quality);
      }
    }
    if (env.BENCH_RECOVERY === '1') {
      await client.call('Emulation.setCPUThrottlingRate', { rate: 1 });
      await measure('recovery', 1, config.qualities.at(-1));
    }
    assert.deepEqual(errors, [], 'Renderer exceptions during benchmark');
    await fs.writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: true, checkedAt: new Date().toISOString(), config, results, interactionChecks, profileIsolation: true, rendererErrors: errors, scope: 'Real app, isolated profile, sensors and live services off; synthetic speaking energy and captions. CPU stress does not emulate PC stick GPU or camera workloads.' }, null, 2));
    console.log('Benchmark report: ' + output);
    return results;
  } catch (error) {
    await fs.writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: false, checkedAt: new Date().toISOString(), config, results, rendererErrors: errors, error: error.message }, null, 2));
    throw error;
  } finally {
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
    client?.close();
    if (child && !exited && !spawnError) {
      child.kill();
      for (let index = 0; index < 50 && !exited; index++) await wait(100);
      if (!exited) { child.kill('SIGKILL'); for(let index=0;index<50&&!exited;index++)await wait(100); }
    }
    if (!child || exited || spawnError) {
      assert(path.dirname(path.resolve(profile)) === path.resolve(os.tmpdir()) && path.basename(profile).startsWith('mirror-bench-'), 'Refusing to remove an unexpected profile path');
      await fs.rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
    }
    else console.error('Benchmark process is still running; preserved profile: ' + profile);
  }
}
if (require.main === module) run().catch(error => { console.error('bench failed:', error); process.exitCode = 1; });
module.exports = { options, run, interactionAudit };
