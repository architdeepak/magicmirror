// Adversarial interaction coverage: overlapping voice requests (wake during a
// turn, barge-in, racing requests, Stop mid-turn) and managed apps (open, close
// and switch while a voice or search request is pending, late replies after Stop).
const assert = require('assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const read = name => fs.readFileSync(path.join(__dirname, '../src', name), 'utf8');
const renderer = read('renderer.js');
const slice = (from, to) => { const a = renderer.indexOf(from), b = renderer.indexOf(to, a); assert(a >= 0 && b > a, 'Missing renderer section ' + from); return renderer.slice(a, b); };

function adapter(globals = {}, options = {}) {
  const context = vm.createContext({ console, setTimeout, clearTimeout, setInterval, clearInterval, performance, AbortController, document: { createElement: () => ({}) }, WebSocket: { OPEN: 1 }, ...globals });
  vm.runInContext(read('audioTurnDetector.js').replace(/export class /g, 'class '), context);
  vm.runInContext(read('captionPacer.js').replace(/export class /g, 'class '), context);
  vm.runInContext(read('geminiLiveAdapter.js').replace(/^import .*;\r?\n/gm, '').replace(/export class /g, 'class ') + '\nglobalThis.Subject=GeminiLiveAdapter;', context);
  const sent = [], interrupts = { count: 0 }, pcm = [];
  const live = new context.Subject({ avatar: { interrupt() { interrupts.count++; }, stopAudioStream() {}, endAudioTurn() {}, streaming: true, pushPcm: value => pcm.push(value) }, config: {}, ...options });
  live.connected = true; live.listening = true; live._send = payload => sent.push(payload);
  return { live, sent, interrupts, pcm };
}

async function voiceRaces() {
  // Barge-in: the server withdraws pending tool calls. A queued call must not
  // run and no response may be sent for a withdrawn id; others still answer.
  const ran = [];
  const first = deferred();
  const f = adapter({}, { onOpenService: async service => { ran.push(service); if (service === 'youtube') await first.promise; }, onAvatarPosition: async position => { ran.push(position); } });
  const slow = f.live._queueToolCall({ functionCalls: [{ id: 'slow', name: 'open_service', args: { service: 'youtube' } }] });
  await tick();
  const queued = f.live._queueToolCall({ functionCalls: [{ id: 'queued', name: 'open_service', args: { service: 'maps' } }, { id: 'kept', name: 'set_avatar_position', args: { position: 'left' } }] });
  await f.live._handleMessage(JSON.stringify({ toolCallCancellation: { ids: ['slow', 'queued'] } }));
  first.resolve(); await slow; await queued;
  assert.deepEqual(ran, ['youtube', 'left'], 'Withdrawn queued tool still executed');
  const answers = f.sent.flatMap(message => message.toolResponse?.functionResponses || []);
  assert.deepEqual(answers.map(item => item.id), ['kept'], 'Withdrawn calls were answered or valid calls dropped');

  // Stop mid-turn: audio and tool results that arrive after Stop are inert.
  const g = adapter({}, { onOpenService: async () => {} });
  g.live.stopPlayback();
  await g.live._handleMessage(JSON.stringify({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: Buffer.from(new Int16Array([1, 2]).buffer).toString('base64') } }] } } }));
  assert.equal(g.pcm.length, 0, 'Late audio played after Stop');
  g.live.disconnect();
  await g.live._handleToolCall({ functionCalls: [{ id: 'late', name: 'open_service', args: { service: 'maps' } }] });
  assert.equal(g.sent.length, 0, 'Late tool response was sent after Stop');

  // Barge-in cuts current playback; a request raced by Stop sends no text.
  const h = adapter();
  h.live.outputSources.add({ stop() { this.stopped = true; }, disconnect() {} });
  await h.live._handleMessage(JSON.stringify({ serverContent: { interrupted: true } }));
  assert.equal(h.live.outputSources.size, 0); assert(h.interrupts.count >= 1, 'Interrupt did not cut avatar playback');
  const racing = h.live.askText('first question'); const second = h.live.askText('second question');
  h.live.stopMicrophone(); await racing; await second;
  assert(!h.sent.some(message => message.realtimeInput?.text), 'A request raced by Stop was still sent');
  // A request after Stop is a new turn and is delivered exactly once.
  h.live.listening = true; await h.live.askText('after stop');
  assert.equal(h.sent.filter(message => message.realtimeInput?.text === 'after stop').length, 1);
}

function wakeHarness() {
  const timers = [], active = new Set(), opened = [];
  const context = vm.createContext({
    magic: { play() {}, cancel() {} }, agentRunId: null, hardMuted: false, sleeping: false, desktopActive: false, mode: 'portal', ambience: { setContext() {} },
    voiceStartGeneration: 0, wake: { pause() {}, setAssistantActive() {}, resume() {} }, wakeFromSleep: async () => {},
    renderQuality: { pixelRatio: 1 }, renderer: { setPixelRatio() {} }, sceneBudget: { invalidate() {} }, showAssistant() {},
    elements: { shell: { dataset: {} }, wakeToggle: { checked: true }, awakening: { classList: { add: x => active.add(x), remove: x => active.delete(x) } } },
    config: { hasGeminiKey: false }, setState() {}, appendCaption() {}, showOracle() {}, avatar: { persona: 'velora' },
    speech: { setPersona() {}, speak: async () => {} }, toggleVoice: async () => { opened.push(context.voiceStartGeneration); }, setTimeout: callback => timers.push(callback),
    askMirror: async () => {}
  });
  vm.runInContext(slice('async function handleWakeWord(', 'function releaseGestures('), context);
  return { context, timers, opened };
}

async function wakeRaces() {
  // Two wake events: only the newest reveal may open the microphone.
  const w = wakeHarness();
  const older = w.context.handleWakeWord(''); await tick();
  const newer = w.context.handleWakeWord(''); await tick();
  assert.equal(w.timers.length, 2);
  w.timers.shift()(); await older; assert.equal(w.opened.length, 0, 'Superseded wake sequence opened listening');
  w.timers.shift()(); await newer; assert.equal(w.opened.length, 1, 'Newest wake sequence failed to open listening');
  // A spoken command with the wake phrase must not also run the greeting.
  const commands = [];
  const c = wakeHarness(); c.context.askMirror = async text => { commands.push(text); };
  await c.context.handleWakeWord('what time is it'); assert.deepEqual(commands, ['what time is it']); assert.equal(c.timers.length, 0);
  // Wake pending when Stop arrives: Stop wins even if the timer later fires.
  const s = wakeHarness(); const pending = s.context.handleWakeWord(''); await tick();
  s.context.voiceStartGeneration++; s.timers.shift()(); await pending; assert.equal(s.opened.length, 0);
  // A wake word while hard muted is ignored without touching listeners.
  const m = wakeHarness(); m.context.hardMuted = true; await m.context.handleWakeWord(''); assert.equal(m.context.voiceStartGeneration, 0);
}

async function managedApps() {
  const pendingOpen = [], pendingService = [], closed = [], gestures = [], notices = [], frames = [], modes = [];
  const context = vm.createContext({
    URL, voiceStartGeneration: 0, manualControlGeneration: 0, manualDesktopRequest: null, watchLoadGeneration: 0,
    castPlayer: { detach() {} }, youtubePlayer: { detach() {} },
    elements: { watchVideo: { pause() {}, removeAttribute() {}, classList: { remove() {} } }, watchFrame: { classList: { add() {} }, set src(v) { frames.push(v); } }, watchPlaceholder: { classList: { add() {} } } },
    setAssistantMode: mode => modes.push(mode), showGesture: text => gestures.push(text), showOracle: text => notices.push(text),
    window: { mirrorBridge: {
      openWebpage: url => { const job = deferred(); pendingOpen.push({ ...job, url }); return job.promise; },
      openService: service => { const job = deferred(); pendingService.push({ ...job, service }); return job.promise; },
      closeDesktop: async () => { closed.push('closed'); }
    } },
    searchPool: { requestId: null, root: { hidden: true } }, parseTimerCommand: () => null, experience: { voice: () => false }, closet: { voice: () => false, selectedId: null },
    avatar: { react() {} }, hideSearchResult() {}, document: { querySelector: () => null }, mirrorTimers: {}, applyAvatarStyle() {}, applyDisplayQuality() {}, setCameraClarity() {},
    mode: 'portal', desktopActive: false, clearTimeout, setTimeout
  });
  vm.runInContext(slice('async function openServiceFrame(', '// ---- Timers'), context);
  vm.runInContext(slice('function runVoiceNavigation(', 'function requestTryOnFromNavigation('), context);

  // Stop while a spoken "open site" load is pending: the late success/failure is silent.
  for (const fail of [false, true]) {
    gestures.length = 0; notices.length = 0;
    assert.equal(context.runVoiceNavigation('open example.com'), true);
    assert.equal(pendingOpen.at(-1).url, 'https://example.com');
    context.voiceStartGeneration++; // Stop
    if (fail) pendingOpen.at(-1).reject(Error('Desktop navigation cancelled or superseded.')); else pendingOpen.at(-1).resolve({ ok: true });
    await tick(); assert.deepEqual([gestures, notices], [[], []], 'Late page result surfaced after Stop');
    assert.equal(context.manualDesktopRequest, null, 'Pending page owner leaked');
  }
  // Two pages in a row: the superseded first rejection stays silent, the second reports.
  context.runVoiceNavigation('open first.example.org'); const firstJob = pendingOpen.at(-1);
  context.runVoiceNavigation('open second.example.org'); const secondJob = pendingOpen.at(-1);
  firstJob.reject(Error('Desktop navigation cancelled or superseded.')); secondJob.resolve({ ok: true }); await tick();
  assert.deepEqual(notices, [], 'Superseded page error was shown'); assert.deepEqual(gestures, ['Opening second.example.org']);
  // A manual app choice made while a page loads closes that page: it carries the page token.
  context.runVoiceNavigation('open slow.example.org'); const slow = pendingOpen.at(-1);
  assert(context.manualDesktopRequest?.page, 'Pending assistant page is invisible to manual control');
  closed.length = 0; gestures.length = 0;
  const choice = context.openServiceFrame('youtube'); pendingService.at(-1).resolve({ url: 'https://www.youtube.com/' }); await choice;
  assert.deepEqual(closed, ['closed'], 'Choosing an app left the loading page free to open over it');
  assert.equal(frames.at(-1), 'https://www.youtube.com/');
  slow.resolve({ ok: true }); await tick(); assert.deepEqual(gestures, [], 'Superseded page announced itself');
  // Stop or a manual choice while the launcher lookup is pending: no takeover.
  for (const field of ['voiceStartGeneration', 'manualControlGeneration']) {
    frames.length = 0; modes.length = 0;
    const late = context.openServiceFrame('maps'); context[field]++;
    pendingService.at(-1).resolve({ url: 'https://maps.example.test/' });
    assert.equal((await late).cancelled, true); assert.deepEqual([frames.length, modes.length], [0, 0], field + ' did not retire the launcher request');
  }
  // Voice calendar: stale after Stop, current success reported.
  const before = gestures.length;
  context.runVoiceNavigation('open the calendar'); context.voiceStartGeneration++;
  pendingService.at(-1).resolve({ url: 'https://calendar.example.test/' }); await tick(); await tick();
  assert.equal(gestures.length, before, 'Calendar announced itself after Stop');
  context.runVoiceNavigation('open the calendar'); pendingService.at(-1).resolve({ url: 'https://calendar.example.test/' }); await tick(); await tick();
  assert.equal(gestures.at(-1), 'Your calendar');
  // Insecure launcher targets are still refused after the ownership check.
  const insecure = context.openServiceFrame('maps'); pendingService.at(-1).resolve({ url: 'http://maps.example.test/' });
  await assert.rejects(insecure, /https/);
}

(async () => {
  await voiceRaces();
  await wakeRaces();
  await managedApps();
  console.log('Interaction races: withdrawn tool calls, Stop/barge-in/racing requests, superseded wakes, and managed page/app open/switch/late-result ownership passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
