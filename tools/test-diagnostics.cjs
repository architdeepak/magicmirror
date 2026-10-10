const assert = require('assert/strict'), fs = require('fs/promises'), path = require('path'), os = require('os');
const { DiagnosticLog, diagnosticSummary } = require('../src/diagnostics.cjs');
const { RendererRecovery } = require('../src/rendererRecovery.cjs');

async function testExport(directory) {
  const vm = require('vm'), crypto = require('crypto');
  const source = await fs.readFile(path.join(__dirname, '../src/main.js'), 'utf8');
  const handlers = new Map(), frame = {}, contents = { mainFrame: frame }, output = path.join(directory, 'export.json');
  let calls = 0, choose = async () => ({ canceled: false, filePath: output });
  const context = vm.createContext({ path, fs, crypto, process, os, diagnosticSummary, diagnosticLog: new DiagnosticLog(path.join(directory, 'ipc-log')), diagnosticSourceHashes: null, diagnosticExportPending: false, __dirname: path.join(__dirname, '../src'), mainWindow: { webContents: contents }, app: { getVersion: () => '1.0.0', getPath: () => directory, getGPUFeatureStatus: () => ({ webgl: 'enabled' }) }, screen: { getAllDisplays: () => [{ size: { width: 1080, height: 1920 }, scaleFactor: 1, rotation: 90 }] }, dialog: { showSaveDialog: async () => { calls++; return choose(); } }, ipcMain: { handle: (name, handler) => handlers.set(name, handler) } });
  let notifications = 0;
  context.mainWindow.isDestroyed = () => false; contents.isCrashed = () => true; contents.send = () => { notifications++; };
  context.desktopPresentation = () => ({ active: false });
  vm.runInContext(source.slice(source.indexOf('function notifyDesktopPresentation()'), source.indexOf('function prepareWatchPresentation()')), context);
  context.notifyDesktopPresentation(); assert.equal(notifications, 0, 'Cleanup notified a disposed renderer frame');
  contents.isCrashed = () => false; context.notifyDesktopPresentation(); assert.equal(notifications, 1);
  const guard = source.slice(source.indexOf('  const assertAgentFrame'), source.indexOf('  const toolWaiters'));
  const bridge = source.slice(source.indexOf('  const diagnosticsReport'), source.indexOf("  ipcMain.handle('mirror:codex-task'"));
  vm.runInContext(guard + bridge, context);
  const report = handlers.get('mirror:diagnostics-report'), save = handlers.get('mirror:save-diagnostics');
  const trusted = { sender: contents, senderFrame: frame };
  for (const bad of [{ sender: {}, senderFrame: frame }, { sender: contents, senderFrame: {} }]) {
    await assert.rejects(report(bad, {}), /only available/); await assert.rejects(save(bad, {}), /only available/);
  }
  assert.equal(calls, 0, 'Untrusted frame opened a native export dialog');
  const input = { camera: { active: true }, apiKey: 'PRIVATE_EXPORT_KEY', tryOn: { selected: { name: 'PRIVATE_EXPORT_GARMENT' } }, transcript: 'PRIVATE_EXPORT_TRANSCRIPT' };
  assert((await save(trusted, input)).saved);
  const exported = JSON.parse(await fs.readFile(output)); assert(exported.state.camera.active);
  assert(!JSON.stringify(exported).includes('PRIVATE_EXPORT')); assert.equal(exported.displays[0].rotation, 90);
  assert.equal(exported.sourceHashes['main.js'], crypto.createHash('sha256').update(source).digest('hex'));
  choose = async () => ({ canceled: true }); assert.equal((await save(trusted, null)).saved, false);
  let release;
  choose = () => new Promise(resolve => { release = resolve; });
  const pending = save(trusted, input); await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(save(trusted, input), /already open/); release({ canceled: true }); await pending;
  choose = async () => ({ canceled: false, filePath: directory }); await assert.rejects(save(trusted, {}));
  choose = async () => ({ canceled: true }); assert.equal((await save(trusted, {})).saved, false, 'Failed write left export locked');
  console.log('Diagnostic IPC/export: trusted main frame, native save/cancel, no overlapping dialogs, actual JSON privacy/build hashes, write failure and retry passed.');
}

function testRecovery() {
  let clock = 0, reloads = 0, retires = 0, limits = 0, nextTimer = 0;
  const timers = new Map(), events = [];
  const recovery = new RendererRecovery({ now: () => clock, reload: () => reloads++, retire: () => retires++, log: event => events.push(event), onLimit: () => limits++, schedule: fn => { timers.set(++nextTimer, fn); return nextTimer; }, unschedule: id => timers.delete(id) });
  recovery.unresponsive(); recovery.unresponsive(); assert.equal(timers.size, 1, 'Repeated events postponed recovery');
  recovery.responsive(); assert.equal(timers.size, 0); assert.equal(reloads, 0, 'A recovered renderer still reloaded');
  recovery.unresponsive(); const timer = timers.values().next().value; timers.clear(); timer();
  assert.equal(retires, 1); assert.equal(reloads, 1);
  recovery.gone('crashed', 1); recovery.gone('oom', 2); recovery.gone('crashed', 1);
  assert.equal(reloads, 3, 'Repeated renderer crashes caused unlimited reloads'); assert.equal(limits, 1); assert.equal(retires, 4);
  recovery.gone('crashed', 1); recovery.unresponsive(); assert.equal(reloads, 3); assert.equal(limits, 1); assert.equal(timers.size, 0);
  recovery.retry(); assert.equal(reloads, 4); assert(!recovery.blocked);
  clock = 61000; recovery.gone('crashed', 1); assert.equal(reloads, 5, 'Older attempts never aged out');
  recovery.unresponsive(); recovery.close(); assert.equal(timers.size, 0); recovery.gone('crashed', 1); recovery.retry(); assert.equal(reloads, 5);
  assert(events.includes('renderer-gone') && events.includes('recovery-limit'));
  let failedLimits = 0;
  new RendererRecovery({ retire() { throw Error('Cleanup failed'); }, reload() { throw Error('Renderer gone'); }, onLimit() { failedLimits++; } }).recover('crashed');
  assert.equal(failedLimits, 1, 'Cleanup/reload exceptions escaped recovery');
  console.log('Renderer recovery: transient stalls, duplicate events, retirement before reload, crash-loop cap, retry, aging, closed-window cleanup and failure paths passed.');
}

(async () => {
  testRecovery();
  const privateText = 'PRIVATE_TRANSCRIPT_TOKEN_URL_GARMENT';
  const input = { display: { mode: 'ar', quality: 'eco', width: 540, height: Infinity, desktopLabel: privateText }, camera: { active: true, error: privateText, faceTracking: { ready: true, frameAgeMs: 31 } }, voice: { hardMuted: true, state: privateText }, tryOn: { selected: { name: privateText }, closet: [{ name: privateText }], previewReady: true, rendererHost: privateText, photoEditor: { view: 'back', straightenDegrees: -3, output: privateText } }, transcript: privateText, apiKey: privateText };
  const safe = diagnosticSummary(input);
  assert.equal(safe.display.mode, 'ar'); assert.equal(safe.display.width, 540); assert(!Object.hasOwn(safe.display, 'height'));
  assert(safe.camera.active && safe.camera.faceTracking.ready); assert.equal(safe.tryOn.photoEditor.straightenDegrees, -3);
  assert(!JSON.stringify(safe).includes(privateText)); assert.deepEqual(diagnosticSummary(null), diagnosticSummary({}));
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mirror-diagnostics-test-'));
  try {
    await testExport(directory);
    const log = new DiagnosticLog(directory, { maxBytes: 700, maxPending: 4 });
    log.record('app-start', { token: privateText, message: privateText }); await log.queue;
    for (let index = 0; index < 24; index++) { log.record('renderer-gone', { reason: 'crashed', exitCode: index, url: privateText }); await log.queue; }
    for (const filename of [log.filename, log.filename + '.previous']) assert((await fs.stat(filename)).size <= 700, 'Lifecycle journal grew without bound');
    for (let index = 0; index < 30; index++) log.record('console-error', { message: privateText });
    assert(log.dropped >= 26, 'Pending writes grew without bound');
    const snapshot = await log.snapshot(); assert(snapshot.events.length); assert(!JSON.stringify(snapshot).includes(privateText));
    const restarted = new DiagnosticLog(directory, { maxBytes: 700 }); assert((await restarted.snapshot()).events.length, 'Previous-run diagnostics disappeared');
    await fs.appendFile(log.filename, '\nCORRUPT\n'+JSON.stringify({ event: 'renderer-gone', at: privateText, reason: privateText, message: privateText })+'\n');
    assert(!JSON.stringify(await restarted.snapshot()).includes(privateText), 'Corrupt/private disk metadata entered the export');
    const unwritable = new DiagnosticLog(path.join(log.filename, 'not-a-directory')); unwritable.record('app-start');
    assert((await unwritable.snapshot()).storageError, 'Logging failure crashed or was hidden');
    console.log('Diagnostics: privacy allowlist, finite values, bounded files/write queue, previous-run retention, corrupt input and unavailable storage passed.');
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
