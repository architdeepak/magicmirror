const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');
const { CodexMirrorAgent } = require('../src/codexMirrorAgent');
function runtime({ auth = 'chatgpt', hold = false, tool = 'see_screen', duplicate = false, collide = false } = {}) {
  const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.killed = false;
  let toolResult; const requestId = collide ? 4 : 99;
  const emit = message => child.stdout.write(JSON.stringify(message) + '\n');
  child.kill = () => { child.killed = true; };
  child.stdin = new Writable({ write(chunk, _encoding, callback) {
    const m = JSON.parse(chunk.toString());
    queueMicrotask(() => {
      if (m.method === 'initialize') emit({ id: m.id, result: {} });
      if (m.method === 'account/read') emit({ id: m.id, result: { account: { type: auth } } });
      if (m.method === 'thread/start') {
        assert.equal(m.params.sandbox, 'read-only'); assert.equal(m.params.config['features.shell_tool'], false);
        emit({ id: m.id, result: { thread: { id: 'thread1' } } });
      }
      if (m.method === 'turn/start') {
        if (collide && !hold) emit({ id: requestId, method: 'item/tool/call', params: { tool, arguments: {} } });
        emit({ id: m.id, result: { turn: { id: 'turn1' } } });
        emit({ method: 'turn/started', params: { turn: { id: 'turn1' } } });
        if (!hold && !collide) { const call = { id: requestId, method: 'item/tool/call', params: { tool, arguments: {} } }; emit(call); if (duplicate) emit(call); }
      }
      if (!m.method && m.id === requestId) {
        toolResult = m.result;
        emit({ method: 'item/agentMessage/delta', params: { delta: 'Page is ready.' } });
        emit({ method: 'turn/completed', params: { turn: { id: 'turn1', status: 'completed' } } });
      }
    }); callback();
  } });
  return { child, getToolResult: () => toolResult };
}
(async () => {
  const fixture = runtime(); let calls = 0;
  const agent = new CodexMirrorAgent({ cwd: process.cwd(), spawnProcess: () => fixture.child, executeTool: async (name, args) => {
    calls++; assert.equal(name, 'see_screen'); return { ok: true, imageUrl: 'data:image/jpeg;base64,QUJD', observation: { snapshotId: 'fresh' } };
  } });
  assert.deepEqual(await agent.run('Inspect page'), { completed: true, summary: 'Page is ready.' });
  assert.equal(calls, 1); assert.equal(fixture.getToolResult().success, true); assert.equal(fixture.getToolResult().contentItems[1].type, 'inputImage'); assert(!fixture.getToolResult().contentItems[0].text.includes('base64')); assert.equal(fixture.child.killed, true);
  const denied = runtime({ auth: 'apiKey' });
  const apiAgent = new CodexMirrorAgent({ spawnProcess: () => denied.child });
  assert.match((await apiAgent.run('Inspect page')).error, /API billing is disabled/);
  const blocked = runtime({ hold: true });
  const cancelAgent = new CodexMirrorAgent({ spawnProcess: () => blocked.child });
  const task = cancelAgent.run('Wait');
  await new Promise(resolve => setImmediate(resolve));
  assert.match((await cancelAgent.run('Another')).error, /already running/);
  cancelAgent.cancel(); assert.deepEqual(await task, { cancelled: true }); assert.equal(blocked.child.killed, true);
  const repeated = runtime({ duplicate: true }); let repeatedCalls = 0;
  const repeatedAgent = new CodexMirrorAgent({ spawnProcess: () => repeated.child, executeTool: async () => { repeatedCalls++; return { ok: true }; } });
  assert((await repeatedAgent.run('Inspect once')).completed); assert.equal(repeatedCalls, 1);
  const collision = runtime({ collide: true }); let collisionCalls = 0;
  const collisionAgent = new CodexMirrorAgent({ spawnProcess: () => collision.child, executeTool: async () => { collisionCalls++; return {}; } });
  assert((await collisionAgent.run('Inspect overlapping RPC ids')).completed); assert.equal(collisionCalls, 1);
  const timeout = runtime({ hold: true });
  const timeoutAgent = new CodexMirrorAgent({ spawnProcess: () => timeout.child, timeoutMs: 20 });
  assert.match((await timeoutAgent.run('Wait')).error, /timed out/); assert(timeout.child.killed);
  const unknown = runtime({ tool: 'shell' }); let unsafeCalls = 0;
  const unknownAgent = new CodexMirrorAgent({ spawnProcess: () => unknown.child, executeTool: async () => { unsafeCalls++; } });
  await unknownAgent.run('Unsupported tool'); assert.equal(unsafeCalls, 0); assert.equal(unknown.getToolResult().success, false);
  console.log('Codex passed: subscription-only auth, shared tools, verified result, concurrent-task guard, duplicate delivery, overlapping RPC ids, unknown tools, timeout and immediate cancellation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
