import assert from 'node:assert/strict';
import { SleepController } from '../src/sleepController.js';
import { containsWakePhrase, parseMirrorCommand, WakeWordListener } from '../src/wakeWord.js';
import { GeminiLiveAdapter } from '../src/geminiLiveAdapter.js';

assert.equal(containsWakePhrase('Mirror, mirror!'), true);
assert.equal(containsWakePhrase('hello mirror mirror please'), true);
for (const speech of ['near near', 'mere mirror', 'miracle miracle', 'mirror mirrored', 'a mirror']) {
  assert.equal(containsWakePhrase(speech), false, speech);
}

let releasePause;
let starts = 0;
let stoppedImmediately = false;
const sleeper = new SleepController({
  wakeListener: {
    pause: () => new Promise((resolve) => { releasePause = resolve; }),
    start: async () => { starts += 1; }
  },
  onSleep: () => { stoppedImmediately = true; }
});
const entering = sleeper.enter();
assert.equal(sleeper.sleeping, true);
assert.equal(stoppedImmediately, true);
sleeper.cancelPendingWake();
releasePause();
assert.equal(await entering, false);
assert.equal(starts, 0, 'STOP must prevent a pending sleep from rearming the mic');

let wakeCalls = 0;
let commandsOnly = true;
const normal = new SleepController({
  wakeListener: {
    pause: async () => {}, start: async () => {},
    setCommandsOnly: (enabled) => { commandsOnly = enabled; }
  },
  onWake: () => { wakeCalls += 1; }
});
assert.equal(await normal.wakeFromPhrase(), false);
assert.equal(await normal.enter(), true);
assert.equal(commandsOnly, false, 'Sleep must restore bare-wake detection');
assert.equal(await normal.wakeFromPhrase(), true);
assert.equal(wakeCalls, 1);
assert.equal(await normal.wakeFromPhrase(), false);

// STOP during a queued recognizer callback must invalidate its wake request.
const listener = new WakeWordListener({ onWake: () => { wakeCalls += 1; } });
listener.enabled = true;
listener._wake();
await listener.pause();
await Promise.resolve();
assert.equal(wakeCalls, 1);
for (const [speech, command] of [
  ['mirror mirror stop', 'stop'], ['mirror mirror please stop talking', 'stop'],
  ['mirror mirror go to sleep', 'sleep'], ['mirror mirror sleep', 'sleep'],
  ['mirror mirror debug on', 'debug-on'], ['hello mirror mirror turn debug off', 'debug-off']
]) assert.equal(parseMirrorCommand(speech), command, speech);
assert.equal(parseMirrorCommand('please stop'), null);

let commands = [];
const controls = new WakeWordListener({
  onCommand: (command) => commands.push(command),
  onWake: () => { throw new Error('Control command incorrectly woke assistant'); }
});
controls.enabled = true;
controls._check('mirror mirror');
controls._check('mirror mirror stop');
assert.deepEqual(commands, ['stop']);
assert.equal(controls.pendingWake, null);
controls.setCommandsOnly(true);
controls._check('mirror mirror');
assert.equal(controls.pendingWake, null);
controls._check('mirror mirror sleep');
assert.deepEqual(commands, ['stop', 'sleep']);
await controls.pause();

let request = '';
const requestListener = new WakeWordListener({ onWake: (suffix) => { request = suffix; } });
requestListener.enabled = true;
requestListener._check('mirror mirror');
requestListener._check("mirror mirror let's try on astral crown");
await new Promise((resolve) => setTimeout(resolve, 900));
assert.equal(request, "let's try on astral crown", 'Wake must retain the latest requested action');
await requestListener.pause();

// Input transcription and reply audio can share one server event. Cancelling
// during transcription must discard the remaining audio in that same event.
let audioPlayed = false;
const adapter = Object.create(GeminiLiveAdapter.prototype);
adapter.connectGeneration = 0;
adapter.onTranscript = () => { adapter.connectGeneration += 1; };
adapter._playFallbackPcm = () => { audioPlayed = true; };
await adapter._handleMessage(JSON.stringify({ serverContent: {
  inputTranscription: { text: 'mirror mirror stop' },
  modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm', data: 'AAA=' } }] }
} }));
assert.equal(audioPlayed, false);
console.log('Sleep transitions, STOP races, and strict wake phrase checks passed.');

// Startup preload must initialize once and never request a microphone itself.
let modelLoads = 0;
let releaseModel;
globalThis.window = { Vosk: { createModel: () => {
  modelLoads++;
  return new Promise(resolve => { releaseModel = resolve; });
} } };
const preloadListener = new WakeWordListener({});
let microphoneStarts = 0;
preloadListener._resetRecognizer = () => {};
preloadListener._startMicrophone = async () => { microphoneStarts++; return true; };
const preparing = preloadListener.prepare();
assert.equal(modelLoads, 1, 'The model starts loading without pressing Record');
assert.equal(preloadListener.enabled, false, 'Preloading must respect mute');
const arming = preloadListener.start();
assert.equal(modelLoads, 1, 'Startup arming must share the preload download');
releaseModel({ setLogLevel() {} });
assert.equal(await preparing, true);
await arming;
assert.equal(microphoneStarts, 1);
await preloadListener.prepare();
assert.equal(modelLoads, 1, 'A ready model must be reused');
console.log('Wake startup passed: immediate preload, one shared download, automatic arming and model reuse.');
