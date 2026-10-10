// Repeatable performance benchmark for the real mirror window.
//   npm run bench                 # all tiers, 1x and 6x CPU throttle
//   BENCH_THROTTLE=1,4 npm run bench
// 6x CPU throttle approximates a fanless Apollo Lake stick's CPU (GPU is not
// throttled, so verify on the real device). Output is one JSON line per case.
const { spawn } = require('child_process');
const path = require('path');
const { connect } = require('./cdp-client.cjs');
const root = path.join(__dirname, '..');
const port = Number(process.env.BENCH_PORT) || 9338;
const throttles = (process.env.BENCH_THROTTLE || '1,6').split(',').map(Number);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
      const page = list.find(t => t.url.includes('/src/index.html'));
      if (page) return page;
    } catch {}
    await wait(500);
  }
  throw new Error('Mirror window did not start');
}

(async () => {
  const electron = require('electron');
  const child = spawn(electron, [root, `--remote-debugging-port=${port}`], { stdio: 'ignore' });
  try {
    const page = await target();
    await wait(9000);
    const c = await connect(page.webSocketDebuggerUrl);
    const fps = ms => c.evaluate(`new Promise(res=>{let n=0,t0=performance.now();const f=t=>{n++;if(t-t0<${ms})requestAnimationFrame(f);else res(+(n/((t-t0)/1000)).toFixed(1))};requestAnimationFrame(f)})`, 60000);
    const quality = async q => { await c.evaluate(`(()=>{const s=document.querySelector('#display-quality');s.value='${q}';s.dispatchEvent(new Event('change'))})()`); await wait(2500); };
    const cloud = () => c.evaluate(`new Promise(res=>{const m=__mirrorDebug.magic;m.cancel();m.play('wake',{muted:true});let n=0,t0=performance.now();const f=t=>{n++;if(t-t0<2500)requestAnimationFrame(f);else res({fps:+(n/((t-t0)/1000)).toFixed(1),backend:m.snapshot().backend})};requestAnimationFrame(f)})`, 60000);
    for (const rate of throttles) {
      await c.call('Emulation.setCPUThrottlingRate', { rate });
      await wait(500);
      for (const q of ['eco', 'auto', 'hd']) {
        await quality(q);
        const idle = await fps(3000);
        const wake = await cloud();
        await wait(600);
        console.log(JSON.stringify({ cpuThrottle: rate, quality: q, idleFps: idle, wakeCloudFps: wake.fps, cloudBackend: wake.backend }));
      }
    }
    await c.call('Emulation.setCPUThrottlingRate', { rate: 1 });
    c.close();
  } finally { child.kill(); }
})().catch(error => { console.error('bench failed:', error.message); process.exit(1); });
