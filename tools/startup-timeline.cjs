// Startup timeline for the real window: when it appears, when the UI is ready,
// when each tracker and the wake word arm, and how much memory the Electron
// process tree holds once settled.
//   node tools/startup-timeline.cjs            (launches its own isolated instance)
//   STARTUP_PORT=9342 STARTUP_SETTLE_MS=8000 node tools/startup-timeline.cjs
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const { connect } = require('./cdp-client.cjs');
const root = path.join(__dirname, '..');
const port = Number(process.env.STARTUP_PORT) || 9342;
const settle = Number(process.env.STARTUP_SETTLE_MS) || 8000;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function treeMemoryMb(rootPid) {
  try {
    const script = `$ids=@(${rootPid}); do { $n=$ids.Count; $ids=@($ids + (Get-CimInstance Win32_Process | Where-Object { $ids -contains $_.ParentProcessId } | ForEach-Object { $_.ProcessId }) | Sort-Object -Unique) } while ($ids.Count -gt $n); Get-Process -Id $ids -ErrorAction SilentlyContinue | ForEach-Object { '{0}|{1}' -f $_.Id, [math]::Round($_.WorkingSet64/1MB) }`;
    const out = execFileSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8' }).trim().split(/\r?\n/);
    const rows = out.map(line => line.split('|')).map(([id, mb]) => ({ pid: Number(id), mb: Number(mb) })).filter(row => row.pid);
    return { rows, totalMb: rows.reduce((sum, row) => sum + row.mb, 0) };
  } catch { return { rows: [], totalMb: null }; }
}

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-startup-'));
  const electron = require('electron');
  let t0 = Date.now();
  const t0Reset = () => { t0 = Date.now(); for (const key of Object.keys(marks)) delete marks[key]; };
  const child = spawn(electron, [root, `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-features=CalculateNativeWinOcclusion'], { stdio: 'ignore' });
  var marks = {};
  const mark = (name) => { if (marks[name] === undefined) marks[name] = Date.now() - t0; };
  try {
    let client;
    for (let i = 0; i < 200 && !client; i++) {
      try {
        const page = (await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json())).find(t => t.url.includes('/src/index.html'));
        if (page) client = await connect(page.webSocketDebuggerUrl);
      } catch {}
      if (!client) await wait(50);
    }
    if (!client) throw new Error('window did not appear');
    if (process.env.STARTUP_QUALITY) {
      // Seed the tier, then restart the clock from a clean reload.
      for (let attempt = 0; attempt < 60; attempt++) {
        try { await client.evaluate(`localStorage.setItem('mirror.display-quality', ${JSON.stringify(process.env.STARTUP_QUALITY)})`); break; }
        catch { await wait(100); }
      }
      await client.call('Page.reload');
      await wait(200);
      t0Reset();
    }
    mark('windowMs');
    const probe = `JSON.stringify((()=>{const d=window.__mirrorDebug;const status=document.querySelector('#wake-status')?.textContent||'';return {debug:Boolean(d),state:document.querySelector('#state-label')?.textContent||'',wake:status,face:d?Boolean(d.getMirrorState().camera.faceTracking.ready):false,gestureWorker:d?Boolean(d.gestures.tracker.worker):false,gesture:d?Boolean(d.gestures.tracker.ready):false,wakeMic:d?Boolean(d.getWakeState().microphoneReady):false}})())`;
    const deadline = Date.now() + 90000;
    let last = {};
    while (Date.now() < deadline) {
      let state;
      try { state = JSON.parse(await client.evaluate(probe, 5000)); } catch { await wait(100); continue; }
      last = state;
      if (state.debug) mark('debugMs');
      if (/ready/i.test(state.state)) mark('uiReadyMs');
      if (state.face) mark('faceReadyMs');
      if (state.gestureWorker) mark('gestureWorkerStartMs');
      if (state.gesture) mark('gestureReadyMs');
      if (/loading/i.test(state.wake)) mark('wakeLoadingMs');
      if (/say .*mirror|unavailable|paused/i.test(state.wake) && state.debug && /ready/i.test(state.state)) mark('wakeArmedMs');
      if (marks.wakeArmedMs && marks.faceReadyMs && (marks.gestureReadyMs || !process.env.STARTUP_EXPECT_GESTURE)) break;
      await wait(100);
    }
    await wait(settle);
    const memory = treeMemoryMb(child.pid);
    console.log(JSON.stringify({ marks, last, memoryTotalMb: memory.totalMb, processes: memory.rows.sort((a, b) => b.mb - a.mb).slice(0, 6) }));
    client.close();
  } finally {
    try { process.platform === 'win32' ? execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }) : child.kill(); } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
})().catch(error => { console.error('startup timeline failed:', error.message); process.exit(1); });
