const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');
const { CodexMirrorAgent } = require('../src/codexMirrorAgent');
function runtime({ auth = 'chatgpt', hold = false } = {}) {
  const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.killed = false;
  let toolResult;
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
        emit({ id: m.id, result: { turn: { id: 'turn1' } } });
        emit({ method: 'turn/started', params: { turn: { id: 'turn1' } } });
        if (!hold) emit({ id: 99, method: 'item/tool/call', params: { tool: 'browser_action', arguments: { action: 'read' } } });
      }
      if (m.id === 99) {
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
    calls++; assert.equal(name, 'browser_action'); assert.equal(args.action, 'read'); return { ok: true, page: { title: 'Test' } };
  } });
  assert.deepEqual(await agent.run('Inspect page'), { completed: true, summary: 'Page is ready.' });
  assert.equal(calls, 1); assert.equal(fixture.getToolResult().success, true); assert.equal(fixture.child.killed, true);
  const denied = runtime({ auth: 'apiKey' });
  const apiAgent = new CodexMirrorAgent({ spawnProcess: () => denied.child });
  assert.match((await apiAgent.run('Inspect page')).error, /API billing is disabled/);
  const blocked = runtime({ hold: true });
  const cancelAgent = new CodexMirrorAgent({ spawnProcess: () => blocked.child });
  const task = cancelAgent.run('Wait');
  await new Promise(resolve => setImmediate(resolve));
  assert.match((await cancelAgent.run('Another')).error, /already running/);
  cancelAgent.cancel(); assert.deepEqual(await task, { cancelled: true }); assert.equal(blocked.child.killed, true);
  console.log('Codex passed: subscription-only auth, shared tools, verified result, concurrent-task guard and immediate cancellation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
