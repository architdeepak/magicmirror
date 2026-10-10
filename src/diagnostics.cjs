const fs = require('fs/promises');
const path = require('path');

// Deliberately excludes console text, URLs, keys, names, transcripts and images.
const EVENTS = new Set(['app-start', 'app-ready', 'app-quit', 'renderer-ready', 'renderer-unresponsive', 'renderer-responsive', 'renderer-gone', 'renderer-reload', 'recovery-limit', 'load-failed', 'child-gone', 'console-error', 'cleanup-failed']);
const REASONS = new Set(['clean-exit', 'abnormal-exit', 'killed', 'crashed', 'oom', 'launch-failed', 'integrity-failure', 'memory-eviction', 'unresponsive', 'manual', 'reload-failed']);
function eventRecord(event, metadata = {}, at = new Date().toISOString()) {
  if (!EVENTS.has(event)) return null;
  const fields = {};
  if (REASONS.has(metadata.reason)) fields.reason = metadata.reason;
  for (const key of ['exitCode', 'errorCode', 'line', 'attempt']) if (Number.isSafeInteger(metadata[key])) fields[key] = metadata[key];
  if (['GPU', 'Utility', 'Zygote', 'Sandbox helper', 'Pepper Plugin', 'Pepper Plugin Broker'].includes(metadata.type)) fields.type = metadata.type;
  if (typeof metadata.source === 'string' && /^[a-zA-Z0-9_-]+\.(?:js|cjs|mjs|html)$/.test(metadata.source)) fields.source = metadata.source;
  return { at: /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(at) ? at : new Date().toISOString(), event, ...fields };
}

class DiagnosticLog {
  constructor(directory, { maxBytes = 128 * 1024, maxPending = 64 } = {}) {
    this.directory = directory; this.filename = path.join(directory, 'lifecycle.jsonl');
    this.maxBytes = maxBytes; this.maxPending = maxPending; this.pending = 0;
    this.queue = Promise.resolve(); this.dropped = 0; this.writeError = null;
  }
  record(event, metadata) {
    const entry = eventRecord(event, metadata);
    if (!entry) return;
    if (this.pending >= this.maxPending) { this.dropped++; return; }
    this.pending++;
    this.queue = this.queue.then(async () => {
      await fs.mkdir(this.directory, { recursive: true });
      const line = JSON.stringify(entry) + '\n';
      const size = await fs.stat(this.filename).then(stat => stat.size, error => { if (error.code === 'ENOENT') return 0; throw error; });
      if (size + Buffer.byteLength(line) > this.maxBytes) {
        await fs.rm(this.filename + '.previous', { force: true });
        await fs.rename(this.filename, this.filename + '.previous');
      }
      await fs.appendFile(this.filename, line, { mode: 0o600 });
      this.writeError = null;
    }).catch(error => { this.writeError = /^[A-Z0-9_]{1,32}$/.test(error.code || '') ? error.code : 'WRITE_FAILED'; })
      .finally(() => { this.pending--; });
  }
  async snapshot() {
    await this.queue;
    const entries = [];
    for (const filename of [this.filename + '.previous', this.filename]) {
      let handle;
      try {
        handle = await fs.open(filename, 'r');
        const { size } = await handle.stat(), start = Math.max(0, size - this.maxBytes);
        const buffer = Buffer.alloc(Math.min(size, this.maxBytes));
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
        const lines = buffer.subarray(0, bytesRead).toString().split('\n');
        if (start) lines.shift();
        for (const line of lines) {
          try { const parsed = JSON.parse(line), safe = eventRecord(parsed.event, parsed, parsed.at); if (safe) entries.push(safe); } catch { /* Truncated or corrupt entries are skipped. */ }
        }
      } catch (error) { if (error.code !== 'ENOENT') this.writeError = 'READ_FAILED'; }
      finally { await handle?.close().catch(() => {}); }
    }
    return { events: entries.slice(-200), dropped: this.dropped, storageError: this.writeError };
  }
}

function diagnosticSummary(input = {}) {
  if (!input || typeof input !== 'object') input = {};
  // Treat renderer input as untrusted. Only copy known primitive values.
  const pick = (object, booleans, numbers = [], enums = {}) => {
    const result = {};
    for (const key of booleans) if (typeof object?.[key] === 'boolean') result[key] = object[key];
    for (const key of numbers) if (typeof object?.[key] === 'number' && Number.isFinite(object[key]) && Math.abs(object[key]) <= 1e9) result[key] = object[key];
    for (const [key, values] of Object.entries(enums)) if (values.includes(object?.[key])) result[key] = object[key];
    return result;
  };
  return {
    display: pick(input.display, ['desktopActive', 'sleeping', 'visible', 'depthEnabled'], ['width', 'height'], { mode: ['mirror', 'portal', 'ar', 'watch', 'spotify'], quality: ['auto', 'hd', 'eco'], avatarAppearance: ['portrait', 'rig'], graphics: ['software', 'accelerated-or-unknown'] }),
    voice: pick(input.voice, ['connecting', 'listening', 'hardMuted', 'wakeEnabled'], [], { state: ['starting', 'connecting', 'error', 'ready', 'sleeping', 'listening', 'thinking', 'speaking', 'stopped', 'standby'] }),
    camera: { ...pick(input.camera, ['active', 'visionSharingEnabled', 'sharedWithAssistant']), faceTracking: pick(input.camera?.faceTracking, ['ready', 'detected'], ['frameAgeMs', 'lastInferenceMs']) },
    gestures: pick(input.gestures, ['requested', 'active'], ['lastInferenceMs']),
    tryOn: { ...pick(input.tryOn, ['rendering', 'previewReady', 'wardrobeControlsOpen'], ['trackingInferenceMs'], { view: ['live', 'still', 'neural'] }), photoEditor: pick(input.tryOn?.photoEditor, ['open', 'readyToSave', 'frontReady', 'backReady', 'extracting', 'saving'], ['quarterTurns', 'straightenDegrees'], { view: ['front', 'back'] }) },
    agent: pick(input.agent, ['active']),
    watch: pick(input.watch, ['castingEnabled', 'castActive']),
  };
}
module.exports = { DiagnosticLog, diagnosticSummary };
