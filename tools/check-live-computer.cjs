// Real Gemini -> real packaged screen capture/input, on a local fixture only.
// Run on an isolated desktop: the whole display is sent to the live service.
const assert = require('assert/strict');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const { connect } = require('./cdp-client.cjs');
const root = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const environment = require('dotenv').parse(await fs.readFile(path.join(root, '.env')));
  const key = process.env.GEMINI_API_KEY || environment.GEMINI_API_KEY;
  assert(key, 'Configure Gemini before running this optional real-service check.');
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'mirror-computer-live-'));
  const profile = path.join(temporary, 'profile'); await fs.mkdir(profile);
  const choices = ['MOSS', 'FEATHER', 'QUILL', 'STONE'];
  for(let index=choices.length-1;index>0;index--){const other=Math.floor(Math.random()*(index+1));[choices[index],choices[other]]=[choices[other],choices[index]];}
  const clicks = [];
  const formMode = process.argv.includes('--form');
  const scrollMode = process.argv.includes('--scroll');
  const doubleMode = process.argv.includes('--double');
  const doubleClicks=[];
  assert([formMode,scrollMode,doubleMode].filter(Boolean).length<=1,'Choose one fixture mode.');
  const words=['RAVEN','OPAL','AMBER','IVORY','CROWN','VIOLET'];
  const secret=Array.from({length:2},()=>words[Math.floor(Math.random()*words.length)]).join(' ');
  const scrolls=[];
  const typedText = "Velora's café";
  const submissions = [];
  const page = http.createServer(async (request, response) => {
    if(request.url.startsWith('/double?')){doubleClicks.push(new URL(request.url,'http://fixture').searchParams.get('label'));response.end('ok');return;}
    if (request.url.startsWith('/click?')) { clicks.push(new URL(request.url, 'http://fixture').searchParams.get('label')); response.end('ok'); return; }
    if (request.url.startsWith('/save?')) { submissions.push(new URL(request.url, 'http://fixture').searchParams.get('text')); response.end('ok'); return; }
    if(request.url.startsWith('/scrolled?')){scrolls.push(Number(new URL(request.url,'http://fixture').searchParams.get('y')));response.end('ok');return;}
    response.setHeader('Content-Type', 'text/html');
    if(scrollMode){response.end(`<!doctype html><meta charset="utf-8"><title>Mirror scrolling fixture</title><style>body{margin:0;background:#16213c;color:white;font:28px sans-serif}header,section{padding:32px}h1{font-size:34px}.space{height:2400px;background:linear-gradient(#16213c,#34335c)}button{font:30px sans-serif;padding:28px;background:#ffd982;color:#16213c;width:100%}#result{font-size:32px}</style><header><h1>Local archive</h1><p>The sealed message is further down this page.</p></header><div class="space"></div><section><h2>Sealed message</h2><button onclick="document.querySelector('#result').textContent='REVEALED: ${secret}';fetch('/click?label=REVEAL')">REVEAL</button><p id="result">Sealed</p></section><script>addEventListener('scroll',()=>fetch('/scrolled?y='+scrollY));</script>`);return;}

    if(formMode){response.end(`<!doctype html><meta charset="utf-8"><title>Mirror keyboard fixture</title><style>body{margin:0;padding:36px;background:#16213c;color:white;font:24px sans-serif}h1{font-size:32px}input{box-sizing:border-box;width:100%;padding:20px;font:28px sans-serif}#result{font:30px sans-serif;overflow-wrap:anywhere}</style><h1>Local notebook</h1><form onsubmit="event.preventDefault();const text=this.elements.note.value;document.querySelector('#result').textContent='SAVED: '+text;fetch('/save?text='+encodeURIComponent(text))"><label for="note">Notebook name</label><input id="note" name="note" value="Old notebook"><p>Press Enter to save.</p></form><p id="result">No save yet</p>`);return;}

    response.end(`<!doctype html><title>Mirror computer fixture</title><style>body{margin:0;background:#16213c;color:white;font:24px sans-serif}h1{font-size:32px;text-align:center}main{display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:28px}button{height:150px;font-size:28px;font-weight:bold;background:#ffd982;color:#152036;border:4px solid white;border-radius:12px}#result{text-align:center;font:32px sans-serif;padding:30px}</style><h1>Local mirror input check</h1><main>${choices.map(label => `<button ondblclick="document.querySelector('#result').textContent='OPENED: '+this.textContent;fetch('/double?label='+this.textContent)" onclick="document.querySelector('#result').textContent='DONE: '+this.textContent;fetch('/click?label='+this.textContent)">${label}</button>`).join('')}</main><p id="result">Nothing clicked yet</p>`);
  });
  await new Promise(resolve => page.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${page.address().port}/`;
  let manager;
  if (process.env.MIRROR_TEST_WINDOW_MANAGER) manager = spawn(process.env.MIRROR_TEST_WINDOW_MANAGER, [], {
    stdio: 'ignore', env: { ...process.env, LD_LIBRARY_PATH: process.env.MIRROR_TEST_WM_LIBRARY_PATH || process.env.LD_LIBRARY_PATH, XDG_DATA_DIRS: process.env.MIRROR_TEST_WM_DATA_DIRS || process.env.XDG_DATA_DIRS }
  });
  const binary = path.join(root, `dist/linux-${process.arch}-unpacked/magic-mirror-portal`);
  let logs = '', exit = null, client;
  const child = spawn(binary, [...(process.argv.includes('--kiosk') ? ['--kiosk'] : []), '--no-sandbox', '--disable-gpu', `--user-data-dir=${profile}`, '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0'], {
    cwd: temporary, env: { ...process.env, GEMINI_API_KEY: '', DECART_API_KEY: '', MIRROR_SPOTIFY_CLIENT_ID: '', MIRROR_KIOSK: 'false' }, stdio: ['ignore', 'pipe', 'pipe']
  });
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
    await until(() => client.evaluate('Boolean(window.__mirrorDebug)&&document.querySelector("#loader").classList.contains("done")'), 45000, 'Initial startup');
    await client.call('Page.addScriptToEvaluateOnNewDocument', { source: `
      localStorage.setItem('mirror.hard-muted','true');localStorage.setItem('mirror.wake','false');localStorage.setItem('mirror.vision','false');localStorage.setItem('mirror.gestures','false');
      navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Physical sensors disabled in computer fixture','NotAllowedError')};window.__computerFixture=true;
    ` });
    await client.call('Page.reload');
    await until(() => client.evaluate('Boolean(window.__computerFixture)&&Boolean(window.__mirrorDebug)&&document.querySelector("#loader").classList.contains("done")'), 45000, 'Sensor-free startup');
    await client.evaluate(`window.mirrorBridge.saveConnections({geminiApiKey:${JSON.stringify(key)},remember:false})`);
    await client.evaluate(`(()=>{
      window.__computer={calls:[],responses:[],transcripts:[],complete:false,error:null};const assistant=__mirrorDebug.gemini;
      assistant.config.hasGeminiKey=true;assistant.setVisionEnabled(false);
      const open=assistant.onOpenWebpage;assistant.onOpenWebpage=url=>{if(url!==${JSON.stringify(url)})throw new Error('Only the supplied fixture URL is authorized for this check.');return open(url)};
      assistant.onSearch=async()=>{throw new Error('Search is outside this fixture check')};assistant.onOpenService=async()=>{throw new Error('Services are outside this fixture check')};
      assistant.onTranscript=(role,text)=>__computer.transcripts.push({role,text});assistant.onError=error=>__computer.error=error;assistant.onTurnComplete=()=>__computer.complete=true;
      const tools=assistant._handleToolCall.bind(assistant);assistant._handleToolCall=input=>{__computer.calls.push(...(input.functionCalls||[]).map(call=>({name:call.name,args:call.args})));if(__computer.calls.length>24){assistant.disconnect();throw new Error('Computer fixture tool limit reached')}return tools(input)};
      const capture=assistant.onCaptureScreen;assistant.onCaptureScreen=async()=>{const image=await capture();__computer.lastScreenshot=image.dataUrl;return image};
      const send=assistant._send.bind(assistant);assistant._send=message=>{if(message.toolResponse)__computer.responses.push(message.toolResponse.functionResponses.map(({parts,...result})=>({...result,imageParts:parts?.map(part=>({mimeType:part.inlineData?.mimeType,bytes:part.inlineData?.data?.length}))})));return send(message)};
    })()`);
    const task=doubleMode
      ? `Open this supplied URL using open_webpage: ${url}. Use see_screen to inspect the actual page. Use exactly one computer_action double_click on the button labeled FEATHER to open it. Inspect the resulting screen and report only the visible result line. Do not send two separate click commands. Do not use other websites or apps or guess coordinates.`
      : scrollMode
      ? `Open this supplied URL using open_webpage: ${url}. Inspect the page with see_screen. Use computer_action scroll to find the REVEAL button below the fold. Click it exactly once, inspect the resulting screen, and report only the revealed message. Never use another site, guess a hidden message, or claim success without seeing it. Observe before each action.`
      : formMode
      ? `Open this supplied URL using open_webpage: ${url}. Inspect the page with see_screen. Replace the Notebook name field's old contents with exactly ${JSON.stringify(typedText)}. Use ctrl+a to select its old contents, type_text to replace them, and Enter to save. Inspect the result and report only the visible SAVED result line. Save exactly once. Do not use other websites or apps. Observe before each action and do not guess coordinates or claim success without seeing the result.`
      : `Open this supplied URL using open_webpage: ${url}. Use see_screen to inspect the actual page. Click the button labeled FEATHER exactly once with computer_action. Inspect the resulting screen and report only the visible result line. Do not use any other website or app. Do not guess coordinates or claim success without seeing the result.`;
    await client.evaluate(`__mirrorDebug.gemini.askText(${JSON.stringify(task)})`);
    const report = await until(async () => {
      const value = await client.evaluate('__computer'); if (value.error) throw new Error(value.error); return value.complete && value;
    }, 90000, 'Live computer task');
    const directory = path.join(root, doubleMode ? 'artifacts/live-computer-double' : scrollMode ? 'artifacts/live-computer-scroll' : formMode ? 'artifacts/live-computer-form' : 'artifacts/live-computer'); await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'result.json'), JSON.stringify({ checkedAt: new Date().toISOString(), input: 'real display of local fixture, no physical sensors', kiosk: process.argv.includes('--kiosk'), choices, clicks, doubleClicks, submissions, scrolls, ...(scrollMode?{expectedSecret:secret}:{}), report: { ...report, lastScreenshot: undefined } }, null, 2) + '\n');
    if(report.lastScreenshot)await fs.writeFile(path.join(directory,'display.jpg'),Buffer.from(report.lastScreenshot.split(',')[1],'base64'));
    const capture = await client.call('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(directory, 'mirror.png'), Buffer.from(capture.data, 'base64'));
    if(doubleMode){assert.deepEqual(doubleClicks,['FEATHER']);assert.deepEqual(clicks,['FEATHER','FEATHER']);assert.equal(report.calls.filter(call=>call.args?.action==='double_click').length,1);assert(!report.calls.some(call=>call.args?.action==='click'));}
    else if(scrollMode){assert.deepEqual(clicks,['REVEAL']);assert(scrolls.some(y=>y>0),'Page did not scroll');assert(report.calls.some(call=>call.args?.action==='scroll'),'Agent did not use scroll');}
    else if(formMode)assert.deepEqual(submissions,[typedText],'Live model did not replace the field and submit the requested Unicode text exactly once');
    else assert.deepEqual(clicks, ['FEATHER'], 'Live model did not click the requested visible button exactly once');
    assert(report.calls.some(call => call.name === 'see_screen') && report.calls.some(call => call.name === 'computer_action'));
    const spoken=report.transcripts.filter(row => row.role === 'assistant').map(row => row.text).join('');
    if(doubleMode)assert.match(spoken,/OPENED\s*:?\s*FEATHER/i);
    else if(scrollMode)assert(spoken.toUpperCase().includes(secret),'Agent did not read the actual hidden message');
    else if(formMode){assert(/saved/i.test(spoken)&&spoken.includes(typedText), 'Spoken result did not match the saved Unicode text');assert(report.calls.some(call=>call.args?.action==='type_text'));assert(report.calls.some(call=>call.args?.action==='press_key'&&call.args?.key==='ctrl+a'));}
    else assert.match(spoken, /DONE\s*:?\s*FEATHER/i);
    console.log(doubleMode ? 'Real live double-click passed: model-selected shuffled target, one double_click command, actual Chromium dblclick, and visible result confirmation.' : scrollMode ? 'Real live scroll passed: below-fold discovery, actual wheel scroll, model-selected click, independent activation and randomized message readback.' : formMode ? 'Real live computer form passed: screenshot-selected field, Ctrl+A, Unicode replacement, Enter submission and visible result confirmation.' : 'Real live computer loop passed: actual packaged screenshot, model-selected coordinates, actual click, result observation and spoken confirmation on local fixture.');
  } finally {
    if (client) { await client.evaluate('__mirrorDebug?.stopAssistant()').catch(() => {}); client.close(); }
    if (!exit) child.kill('SIGTERM'); await delay(200); if (!exit) child.kill('SIGKILL');
    manager?.kill('SIGTERM'); await new Promise(resolve => page.close(resolve)); await fs.rm(temporary, { recursive: true, force: true });
  }
})().catch(error => { console.error(String(error.message).replace(/AIza[\w-]+/g, '[redacted]')); process.exitCode = 1; });
