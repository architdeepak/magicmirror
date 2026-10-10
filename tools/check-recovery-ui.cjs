// Real packaged renderer crash/reload and native IPC; no physical sensors/cloud.
const assert = require('assert/strict'), fs = require('fs/promises'), path = require('path'), os = require('os'), http = require('http');
const { spawn } = require('child_process'), { createHash } = require('crypto'), { connect } = require('./cdp-client.cjs');
const root = path.resolve(__dirname, '..'), delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'mirror-recovery-')), profile = path.join(temp, 'profile');
  const out = path.join(root, 'artifacts/recovery'); await fs.mkdir(out, { recursive: true });
  let pendingRequest = false;
  const server = http.createServer((_request, _response) => { pendingRequest = true; });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const fixture = `http://127.0.0.1:${server.address().port}/pending`;
  const binary = path.join(root, `dist/linux-${process.arch}-unpacked/magic-mirror-portal`);
  const archiveSha256 = createHash('sha256').update(await fs.readFile(path.join(path.dirname(binary), 'resources/app.asar'))).digest('hex');
  const app = spawn(binary, ['--no-sandbox', '--disable-gpu', `--user-data-dir=${profile}`, '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0'], { cwd: temp, env: { ...process.env, GEMINI_API_KEY: '', DECART_API_KEY: '', MIRROR_KIOSK: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '', client, exited = false; app.on('exit', () => { exited = true; });
  for (const stream of [app.stdout, app.stderr]) stream.on('data', bytes => { logs = (logs + bytes).slice(-12000); });
  async function until(fn, label) {
    const start = Date.now();
    while (Date.now() - start < 45000) { if (exited) throw Error('App exited: '+logs.slice(-1000)); const value = await fn(); if (value) return value; await delay(100); }
    throw Error(label+' timed out: '+logs.slice(-1000));
  }
  try {
    const endpoint = await until(() => logs.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/)?.[1], 'endpoint');
    const targets = () => fetch('http://'+new URL(endpoint).host+'/json/list').then(response => response.json());
    const target = await until(async () => (await targets()).find(target => target.url.includes('app.asar/src/index.html')), 'target');
    client = await connect(target.webSocketDebuggerUrl); await client.call('Page.enable');
    await client.call('Page.addScriptToEvaluateOnNewDocument', { source: `if(location.protocol==='file:'&&location.pathname.endsWith('/src/index.html')){localStorage.setItem('mirror.hard-muted','true');localStorage.setItem('mirror.wake','false');localStorage.setItem('mirror.gestures','false');navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Synthetic denial','NotAllowedError')};window.__recoveryFixture=true;}` });
    await client.call('Page.reload'); await until(() => client.evaluate('!!window.__recoveryFixture&&!!window.__mirrorDebug&&document.querySelector("#loader").classList.contains("done")'), 'startup');
    await client.evaluate('document.querySelector("#settings-toggle").click()');
    assert(await client.evaluate('!document.querySelector("#save-diagnostics").disabled'));
    const report = await client.evaluate(`window.mirrorBridge.diagnosticsReport({...__mirrorDebug.getMirrorState(),apiKey:'PRIVATE_RECOVERY_KEY',transcript:'PRIVATE_RECOVERY_TRANSCRIPT'})`);
    assert(!JSON.stringify(report).includes('PRIVATE_RECOVERY')); assert(!Object.hasOwn(report.state.tryOn, 'closet')); assert(report.sourceHashes['main.js']);
    assert(report.lifecycle.events.some(event => event.event === 'renderer-ready'));
    const shot = await client.call('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(out, 'diagnostics-settings.png'), Buffer.from(shot.data, 'base64'));
    const phone = await client.evaluate('window.mirrorBridge.startPhoneLink()');
    const second = spawn(binary, ['--no-sandbox', '--disable-gpu', `--user-data-dir=${profile}`, '--dev'], { cwd: temp, env: { ...process.env, GEMINI_API_KEY: '', DECART_API_KEY: '', MIRROR_KIOSK: 'false' }, stdio: 'ignore' });
    await until(async () => (await targets()).some(target => target.url.startsWith('devtools://')), 'Debug launcher on existing instance');
    await until(() => second.exitCode !== null, 'second instance exit');
    const knownTargets = new Set((await targets()).map(target => target.id));
    await client.evaluate(`void window.mirrorBridge.openWebpage(${JSON.stringify(fixture)}).catch(()=>{});true`);
    await until(() => pendingRequest, 'pending browser navigation');
    const pendingBrowser = await until(async () => (await targets()).find(target => target.type === 'page' && !knownTargets.has(target.id)), 'pending browser target');
    await client.call('Page.crash', {}, 5000).catch(() => {}); client.close(); client = null;
    const recovered = await until(async () => (await targets()).find(target => target.url.includes('app.asar/src/index.html')), 'recovered target');
    client = await connect(recovered.webSocketDebuggerUrl);
    await until(() => client.evaluate('!!window.__recoveryFixture&&!!window.__mirrorDebug&&document.querySelector("#loader").classList.contains("done")').catch(() => false), 'renderer recovered');
    assert(!(await targets()).some(target => target.id === pendingBrowser.id), 'Recovery left a pending desktop browser alive');
    await assert.rejects(fetch(new URL(phone.url).origin));
    const after = await client.evaluate('window.mirrorBridge.diagnosticsReport(__mirrorDebug.getMirrorState())');
    assert(after.lifecycle.events.some(event => event.event === 'renderer-gone'));
    assert(after.lifecycle.events.some(event => event.event === 'renderer-reload'));
    assert(!after.state.display.desktopActive && !after.state.agent.active && after.state.voice.hardMuted);
    for (let attempt = 0; attempt < 2; attempt++) {
      // New-document scripts belong to the CDP session; reinstall after reconnect.
      await client.call('Page.addScriptToEvaluateOnNewDocument', { source: `if(location.protocol==='file:'&&location.pathname.endsWith('/src/index.html')){localStorage.setItem('mirror.hard-muted','true');localStorage.setItem('mirror.wake','false');localStorage.setItem('mirror.gestures','false');navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Synthetic denial','NotAllowedError')};window.__recoveryFixture=true;}` });
      await client.call('Page.crash', {}, 500).catch(() => {}); client.close(); client = null;
      const target = await until(async () => (await targets()).find(target => target.url.includes('app.asar/src/index.html')), 'next recovered target');
      client = await connect(target.webSocketDebuggerUrl);
      await until(() => client.evaluate('!!window.__mirrorDebug&&__mirrorDebug.getMirrorState().voice.hardMuted&&document.querySelector("#loader").classList.contains("done")').catch(() => false), 'next renderer recovered');
    }
    await client.call('Page.crash', {}, 500).catch(() => {}); client.close(); client = null;
    const journalPath = path.join(profile, 'diagnostics/lifecycle.jsonl');
    await until(async () => (await fs.readFile(journalPath, 'utf8')).includes('recovery-limit'), 'crash-loop limit');
    await delay(1000);
    const journal = (await fs.readFile(journalPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    const reloads = journal.filter(event => event.event === 'renderer-reload').length;
    assert.equal(reloads, 3, 'Packaged watchdog kept reloading after repeated crashes'); assert(!exited);
    await fs.writeFile(path.join(out, 'result.json'), JSON.stringify({ passed: true, checkedAt: new Date().toISOString(), archiveSha256, checks: ['diagnostics Settings control', 'report privacy/build fingerprints', 'Debug launcher opens DevTools on existing instance', 'actual Page.crash and renderer reload', 'pending managed navigation and phone pairing retired', 'hard mute retained after crash', 'four actual renderer crashes permit only three automatic reloads; main process stays alive'], report: after, crashLoop: { forcedCrashes: 4, automaticReloads: reloads, recoveryLimitRecorded: true }, lifecycle: journal, scope: 'Packaged Linux software graphics, synthetic denied sensors, local pending HTTP fixture; no Windows execution or physical hardware.' }, null, 2)+'\n');
    console.log(JSON.stringify({ passed: true, archiveSha256, rendererRecovered: true, navigationRetired: true, phoneRetired: true, automaticReloads: reloads }));
  } finally {
    client?.close(); app.kill('SIGTERM'); await delay(300); if (!exited) app.kill('SIGKILL');
    await fs.writeFile(path.join(out, 'runtime.log'), logs);
    await fs.cp(path.join(profile, 'diagnostics'), path.join(out, 'diagnostics'), { recursive: true }).catch(() => {});
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await fs.rm(temp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
