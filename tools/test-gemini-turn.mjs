import assert from 'node:assert/strict';
import { GeminiLiveAdapter } from '../src/geminiLiveAdapter.js';
globalThis.document = { createElement: () => ({}) };
let ended = 0;
let interrupted = 0;
const states = [];
const avatar = {
  audioPending: true,
  endAudioTurn() {},
  resetSpeech() {},
  interrupt() { this.audioPending = false; interrupted++; }
};
const adapter = new GeminiLiveAdapter({ avatar, config: {}, onState: value => states.push(value), onTurnComplete: () => ended++ });
await adapter._handleMessage(JSON.stringify({ serverContent: { turnComplete: true } }));
assert.equal(ended, 0, 'server completion must not hide a still-speaking character');
avatar.audioPending = false;
avatar.onAudioPlaybackEnd();
assert.equal(ended, 1, 'finish after audible playback drains');
assert.equal(states.at(-1), 'ready');
adapter.listening = true;
await adapter._handleMessage(JSON.stringify({ serverContent: { interrupted: true } }));
assert.equal(interrupted, 1, 'interruption must stop playback');
assert.equal(states.at(-1), 'listening', 'interruption must restore attention to user');
console.log('Gemini turn timing passed: playback drain and interruption.');

let resolveMedia;
let stoppedTrack = false;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
  mediaDevices: { getUserMedia: () => new Promise(resolve => { resolveMedia = resolve; }) }
} });
adapter.connected = true;
const openingMic = adapter.startMicrophone();
adapter.disconnect();
resolveMedia({ getTracks: () => [{ stop() { stoppedTrack = true; } }] });
assert.equal(await openingMic, false, 'STOP must cancel a pending microphone request');
assert.equal(stoppedTrack, true, 'Late microphone stream must be stopped');
assert.equal(adapter.listening, false);

let resolveMessage;
const lateMessage = adapter._handleMessage({ text: () => new Promise(resolve => { resolveMessage = resolve; }) });
adapter.disconnect();
const stateCount = states.length;
resolveMessage(JSON.stringify({ serverContent: { turnComplete: true } }));
await lateMessage;
assert.equal(states.length, stateCount, 'A stopped session must ignore deferred server messages');
adapter.connect = async () => false;
assert.equal(await adapter.toggleMicrophone(), false, 'Cancelled connection must not start microphone capture');
console.log('Gemini STOP cancellation passed: pending microphone, connection and server message.');
