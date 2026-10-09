// Optional real Codex subscription turn against a local fixture on an isolated
// display. No camera, microphone, real accounts, or production website actions.
const assert = require('assert/strict');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const { createHash } = require('crypto');
const { connect } = require('./cdp-client.cjs');
const root = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'mirror-codex-computer-'));
  const clicks = [];
  const typedMode = process.argv.includes('--typed');
  const mapMode = process.argv.includes('--map');
  const place = 'Opal Meadow ' + Math.floor(Math.random()*900+100);
  const age = Math.floor(Math.random()*15+10);
  const labels = ['MOSS', 'FEATHER', 'STONE', 'QUILL'].sort(() => Math.random() - .5);
  const secret = `OPAL ${Math.floor(Math.random() * 900 + 100)}`;
  const server = http.createServer((request, response) => {
    if (request.url.startsWith('/click?')) { clicks.push(new URL(request.url, 'http://fixture').searchParams.get('label')); response.end('ok'); return; }
    response.setHeader('Content-Type', 'text/html');
    if(mapMode){response.end(`<!doctype html><title>Shared map fixture</title><style>body{margin:0;padding:24px;background:#122b30;color:white;font:22px sans-serif}h1{font-size:28px}.map{height:180px;border-radius:18px;background:repeating-linear-gradient(30deg,#203b42 0 50px,#4a646b 51px 56px,#203b42 57px 100px);display:grid;place-items:center}.pin{padding:14px;border-radius:16px;background:#bcffdf;color:#08251b}article{padding:18px;margin-top:18px;border:1px solid #789;border-radius:12px}small{font-size:17px;color:#cbd8e0}</style><h1>Shared locations</h1><p>Synthetic audit map</p><div class="map"><span class="pin">Lena · ${place}</span></div><article><strong>Lena</strong><p>Last known: ${place}</p><p>Updated ${age} minutes ago</p><small>Current location unavailable. Accuracy: approximately 200 metres.</small></article>`);return;}

    response.end(`<!doctype html><title>Local Codex mirror check</title><style>body{margin:0;background:#16213c;color:white;font:24px sans-serif}h1{text-align:center}main{display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:28px}button{height:150px;font-size:28px;background:#ffd982;color:#152036;border:4px solid white;border-radius:12px}#result{text-align:center;font:32px sans-serif;padding:30px}</style><h1>Local mirror input check</h1><main>${labels.map(label => `<button onclick="document.querySelector('#result').textContent=this.textContent==='FEATHER'?'REVEALED: ${secret}':'Wrong button';fetch('/click?label='+this.textContent)">${label}</button>`).join('')}</main><p id="result">Nothing clicked yet</p>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const build = path.join(temporary, 'app');
  await fs.cp(path.join(root, `dist/linux-${process.arch}-unpacked`), build, {recursive:true});
  const archiveSha256 = createHash('sha256').update(await fs.readFile(path.join(build, 'resources/app.asar'))).digest('hex');
  const binary = path.join(build, 'magic-mirror-portal');
  let logs = '', exit = null, client;
  const child = spawn(binary, ['--no-sandbox','--disable-gpu', `--user-data-dir=${temporary}/profile`, '--remote-debugging-address=127.0.0.1','--remote-debugging-port=0'], { cwd: temporary, env: { ...process.env, GEMINI_API_KEY: '', DECART_API_KEY: '', MIRROR_KIOSK: 'false' }, stdio: ['ignore','pipe','pipe'] });
  for (const pipe of [child.stdout, child.stderr]) pipe.on('data', bytes => logs = (logs + bytes.toString()).slice(-12000));
  child.on('exit', (code, signal) => exit = { code, signal });
  const until = async (predicate, timeout, label) => {
    const started = Date.now();
    while (true) { if (exit) throw new Error(JSON.stringify(exit)); const value = await predicate(); if (value) return value;
      if (Date.now() - started > timeout) throw new Error(label + ' timed out; ' + logs.slice(-1500)); await delay(100); }
  };
  try {
    const debug = await until(() => logs.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/)?.[1], 30000, 'Debug endpoint');
    const target = await until(async () => (await fetch(`http://${new URL(debug).host}/json/list`).then(r => r.json())).find(t => t.url.includes('app.asar/src/index.html')), 30000, 'Renderer');
    client = await connect(target.webSocketDebuggerUrl); await client.call('Page.enable');
    await until(() => client.evaluate('Boolean(window.__mirrorDebug)'), 45000, 'Startup');
    await client.call('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('mirror.hard-muted','false');localStorage.setItem('mirror.wake','false');localStorage.setItem('mirror.vision','false');localStorage.setItem('mirror.gestures','false');navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Physical sensors disabled in Codex fixture','NotAllowedError')};window.__codexFixture=true;` });
    await client.call('Page.reload');
    await until(() => client.evaluate('Boolean(window.__codexFixture)&&Boolean(window.__mirrorDebug)&&document.querySelector("#loader").classList.contains("done")'), 45000, 'Sensor-free startup');
    await client.evaluate(`(()=>{
      window.__codexCheck={calls:[],errors:[]};const a=__mirrorDebug.gemini;
      const open=a.onOpenWebpage;a.onOpenWebpage=u=>{if(u!==${JSON.stringify(url)})throw new Error('Only the local fixture URL is authorized.');return open(u)};
      a.onSearch=async()=>{throw new Error('Search is outside this fixture')};
      const capture=a.onCaptureScreen;a.onCaptureScreen=async()=>{const image=await capture();__codexCheck.lastScreenshot=image.dataUrl;return image};
      const tools=__mirrorDebug.agentTools;const execute=tools.execute.bind(tools);tools.execute=async(name,args)=>{__codexCheck.calls.push({name,args});try{return await execute(name,args)}catch(e){__codexCheck.errors.push(e.message);throw e}};
    })()`);
    const task = mapMode ? `Open this user-supplied shared map using open_webpage: ${url}. Inspect the actual screen. Where is Lena? Report the displayed place and freshness honestly; never claim a last-known position is current. Do not use other websites or apps.` : `Open this URL using open_webpage: ${url}. Inspect it with see_screen. Use exactly one computer_action click on the visible FEATHER button, then inspect the resulting screen. If the result is off-screen, scroll to read it. Report only the revealed message. Do not use other websites, other tools or apps, repeat the click, or guess the hidden message.`;
    let result;
    if(typedMode){
      const click=async selector=>{const point=await client.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);for(const type of['mousePressed','mouseReleased'])await client.call('Input.dispatchMouseEvent',{type,...point,button:'left',clickCount:1})};
      await click('#launcher-toggle');await delay(300);await click('#assistant-task-input');await client.call('Input.insertText',{text:task});await click('#assistant-task-form button');
      const summary=await until(()=>client.evaluate(`(()=>{const text=document.querySelector('#oracle-text').textContent;return !__mirrorDebug.getMirrorState().agent.active&&text.includes(${JSON.stringify(mapMode?place:secret)})?text:null})()`),200000,'Typed Codex answer');result={completed:true,summary};
    }else{
      await client.evaluate(`void __mirrorDebug.runAgentTask(${JSON.stringify(task)}).then(result => __codexCheck.result = result).catch(error => __codexCheck.result = {error:error.message})`);
      result = await until(() => client.evaluate('__codexCheck.result || null'), 200000, 'Codex task');
    }
    const report = await client.evaluate('__codexCheck');
    const directory = path.join(root,mapMode?'artifacts/codex-location':'artifacts/codex-computer'); await fs.mkdir(directory,{recursive:true});
    const metadata = { archiveSha256, checkedAt: new Date().toISOString(), scope: 'Actual installed Codex, packaged Linux app, real display screenshots and Chromium input, local synthetic fixture. No physical sensors, Windows input or production account actions.', typedMode, labels, secret, clicks, ...(mapMode?{place,age}:{}), result, report: { ...report, lastScreenshot: undefined } };
    await fs.writeFile(path.join(directory,'result.json'),JSON.stringify(metadata,null,2)+'\n');
    if (report.lastScreenshot) await fs.writeFile(path.join(directory,'display.jpg'),Buffer.from(report.lastScreenshot.split(',')[1],'base64'));
    assert(result.completed, JSON.stringify(result));
    assert(report.calls.some(c=>c.name==='see_screen'));
    if(mapMode){
      assert.deepEqual(clicks,[]);assert(result.summary.includes(place));assert(result.summary.includes(String(age)));assert(/last.known|last.seen|current.*unavailable/i.test(result.summary),'A stale location was reported without freshness caveat');
    }else{
      assert.deepEqual(clicks,['FEATHER']);assert(result.summary.includes(secret),'The agent did not read the randomized visible result.');
      assert(report.calls.some(c=>c.name==='computer_action'));
      assert.equal(report.calls.filter(c=>c.name==='computer_action'&&c.args.action==='click').length,1);
    }
    console.log(JSON.stringify({ passed: true, result, clicks, calls: report.calls.length, scope: metadata.scope }));
  } finally {
    if (client) { await client.evaluate('__mirrorDebug?.stopAssistant()').catch(()=>{}); client.close(); }
    if (!exit) child.kill('SIGTERM'); await delay(200); if (!exit) child.kill('SIGKILL');
    await new Promise(resolve=>server.close(resolve)); await fs.rm(temporary,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
})().catch(error=>{console.error(error.message);process.exitCode=1});
