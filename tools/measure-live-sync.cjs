// Real-service lip-sync / caption pacing measurement. Drives the production
// adapter with a text prompt (no microphone) and records, on the audio clock:
//   - when each output-transcription delta ARRIVES (what the UI would show today)
//   - when the audio that contains that text is actually AUDIBLE
//   - when the avatar speech level / viseme first moves relative to audible start
// Usage: ./node_modules/.bin/electron --no-sandbox tools/measure-live-sync.cjs
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const directory = path.join(__dirname, '../artifacts/live-sync');
  await fs.mkdir(directory, { recursive: true });
  const source = await fs.readFile(path.join(__dirname, '../src/main.js'), 'utf8');
  const context = vm.createContext({ process, Date, fetch, integrationSettings: { value: (_f, fallback) => fallback } });
  vm.runInContext(source.slice(source.indexOf('async function createGeminiToken('), source.indexOf('function registerBridge(')), context);
  ipcMain.handle('mirror:create-gemini-token', () => context.createGeminiToken());
  const model = process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview';
  const adapterUrl = pathToFileURL(path.join(__dirname, '../src/geminiLiveAdapter.js')).href;
  const fixture = path.join(directory, 'sync.html');
  await fs.writeFile(fixture, `<!doctype html><body><script type="module">
    import {GeminiLiveAdapter} from ${JSON.stringify(adapterUrl)};
    const t0 = performance.now();
    const log = window.log = { deltas: [], chunks: [], scheduled: [], levelEvents: [], error: null, complete: false };
    let ctxRef = null;
    const avatar = { streaming:false, startAudioStream: async()=>{}, interrupt(){}, endAudioTurn(){}, setSpeechLevel(v){ log.levelEvents.push({ t: performance.now()-t0, v }); }, setViseme(){}, setPerformance(){},
      attachPlaybackNode(node){ ctxRef = node && node.context; }, beginPlayback(){}, finishPlayback(){} };
    const live = window.live = new GeminiLiveAdapter({ avatar, config:{hasGeminiKey:true,geminiModel:${JSON.stringify(model)},geminiVoice:'Gacrux'},
      onState(){}, onTranscript:(role,text)=>{ if(role==='assistant') log.deltas.push({ t: performance.now()-t0, chars: text.length, text }); },
      onError:e=>log.error=e, onTurnComplete:()=>log.complete=true,
      onMirrorState:()=>({display:{mode:'watch',avatarPosition:'center'},camera:{active:false},tryOn:{closet:[]}}),
      onAvatarPosition:async()=>{}, onWatchControl:async()=>({}) });
    live.setVisionEnabled(false);
    const play = live._playFallbackPcm.bind(live);
    live._playFallbackPcm = (pcm, rate) => {
      const arrive = performance.now()-t0;
      const before = live.outputCursor;
      play(pcm, rate);
      const ctx = live.outputContext;
      log.chunks.push({ t: arrive, seconds: pcm.length/rate, startCtx: live.outputCursor - pcm.length/rate, ctxNow: ctx.currentTime, wallNow: performance.now()-t0 });
      log.outputLatency = ctx.outputLatency; log.baseLatency = ctx.baseLatency;
    };
    window.run = async prompt => { try { await live.askText(prompt); } catch (e) { log.error = e.message; log.complete = true; } };
  </script>`);
  const win = new BrowserWindow({ width: 360, height: 640, show: false, webPreferences: { preload: path.join(__dirname, '../src/preload.js'), partition: 'live-sync-' + process.pid, contextIsolation: true, nodeIntegration: false } });
  const out = { turns: [] };
  try {
    await win.loadFile(fixture);
    for (const prompt of [
      'Say in about three sentences, with theatrical menace: who is the fairest of them all, and why does that matter to a queen?',
      'In two long sentences, describe a moonlit castle courtyard.']) {
      await win.webContents.executeJavaScript('(()=>{const l=window.log;l.deltas=[];l.chunks=[];l.levelEvents=[];l.complete=false;l.error=null;return 1})()');
      await win.webContents.executeJavaScript(`window.run(${JSON.stringify(prompt)})`);
      const started = Date.now();
      let log;
      for (;;) {
        log = await win.webContents.executeJavaScript('JSON.parse(JSON.stringify(window.log))');
        if (log.error) throw new Error(log.error);
        if (log.complete) break;
        if (Date.now() - started > 40000) throw new Error('turn timed out');
        await new Promise(r => setTimeout(r, 120));
      }
      await new Promise(r => setTimeout(r, 400));
      log = await win.webContents.executeJavaScript('JSON.parse(JSON.stringify(window.log))');
      // Analysis on the audio clock. The first chunk starts playing at its scheduled ctx time.
      const chunks = log.chunks;
      if (!chunks.length) throw new Error('no audio');
      const totalSeconds = chunks.reduce((s, c) => s + c.seconds, 0);
      const first = chunks[0];
      const audibleStartWall = first.wallNow + Math.max(0, first.startCtx - first.ctxNow) * 1000; // wall ms when chunk 0 starts at the context
      const totalChars = log.deltas.reduce((s, d) => s + d.chars, 0);
      let cumulative = 0;
      const rows = log.deltas.map(d => {
        cumulative += d.chars;
        const audibleAt = audibleStartWall + (cumulative / totalChars) * totalSeconds * 1000; // when audio reaches this text (proportional)
        return { arrive: Math.round(d.t), audibleAt: Math.round(audibleAt), lead: Math.round(audibleAt - d.t), chars: d.chars };
      });
      const leads = rows.map(r => r.lead).sort((a, b) => a - b);
      out.turns.push({ prompt: prompt.slice(0, 40), audioSeconds: +totalSeconds.toFixed(2), chunks: chunks.length, firstChunkArrive: Math.round(first.t),
        outputLatencyMs: Math.round((log.outputLatency || 0) * 1000), baseLatencyMs: Math.round((log.baseLatency || 0) * 1000),
        deltaCount: rows.length, captionLeadMs: { min: leads[0], p50: leads[Math.floor(leads.length / 2)], max: leads[leads.length - 1] },
        lastChunkArrive: Math.round(chunks[chunks.length - 1].t), audioEndsAt: Math.round(audibleStartWall + totalSeconds * 1000),
        firstLevelAfterFirstChunkMs: log.levelEvents.length ? Math.round(log.levelEvents[0].t - first.t) : null });
    }
    console.log('LIVE_SYNC ' + JSON.stringify(out, null, 1));
  } catch (error) {
    console.error('measure failed:', error.message);
    process.exitCode = 1;
  } finally { app.quit(); }
});
