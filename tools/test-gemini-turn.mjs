import assert from 'node:assert/strict';
import { GeminiLiveAdapter } from '../src/geminiLiveAdapter.js';
globalThis.document = { createElement: () => ({}) };
let localAdapter;
let localPcm=0;
let localTools=0;
let localCaptions=0;
const localAvatar={streaming:true,audioPending:false,interrupt(){},endAudioTurn(){},setSpeechLevel(){},setViseme(){},setPerformance(){},pushPcm(){localPcm++;}};
localAdapter=new GeminiLiveAdapter({avatar:localAvatar,config:{},onTranscript(role){if(role==='user')localAdapter.suppressCurrentReply();else localCaptions++;},onArEffect(){localTools++;}});
localAdapter._send=()=>{};
await localAdapter._handleMessage(JSON.stringify({serverContent:{inputTranscription:{text:'next song'},outputTranscription:{text:'A long unnecessary confirmation'},modelTurn:{parts:[{inlineData:{mimeType:'audio/pcm',data:'AAA='}}]},turnComplete:true},toolCall:{functionCalls:[{name:'set_ar_effect',id:'duplicate',args:{effect:'crown'}}]}}));
assert.equal(localPcm,0,'A local command must suppress model narration in the same message');
assert.equal(localCaptions,0);
assert.equal(localTools,0,'The model must not execute an action again after it was handled locally');
assert.equal(localAdapter.suppressReply,false,'Ordinary conversation resumes after the command turn');
await localAdapter._handleMessage(JSON.stringify({serverContent:{outputTranscription:{text:'Hello'},modelTurn:{parts:[{inlineData:{mimeType:'audio/pcm',data:'AAA='}}]}}}));
assert.equal(localPcm,1);
assert.equal(localCaptions,1);
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

let delegatedRequest;
let sharedResponse;
const hybrid = new GeminiLiveAdapter({ avatar: localAvatar, config: {}, onCodexTask: async ({ task }) => {
  delegatedRequest = task; return { completed: true, summary: 'Draft created.' };
} });
hybrid._send = payload => { sharedResponse = payload; };
await hybrid._handleToolCall({ functionCalls: [{ name: 'delegate_codex_task', id: 'delegate1', args: { task: 'Draft an email to Alex, do not send.' } }] });
assert.equal(delegatedRequest, 'Draft an email to Alex, do not send.');
assert.equal(sharedResponse.toolResponse.functionResponses[0].response.summary, 'Draft created.');
let finishDelegation;
hybrid.onCodexTask = () => new Promise(resolve => { finishDelegation = resolve; });
sharedResponse = null;
const waiting = hybrid._handleToolCall({ functionCalls: [{ name: 'delegate_codex_task', id: 'delegate2', args: { task: 'Read page' } }] });
hybrid.disconnect();
finishDelegation({ completed: true, summary: 'Late result' });
await waiting;
assert.equal(sharedResponse, null, 'STOP must discard a late Codex result before Gemini can narrate it');
console.log('Hybrid delegation passed: full task context, verified tool result and late-result suppression.');

let setupPayload;
const setupAdapter = new GeminiLiveAdapter({ avatar: localAvatar, config: {} });
setupAdapter._send = payload => { setupPayload = payload; };
setupAdapter._sendSetup();
const names = setupPayload.setup.tools.flatMap(group => group.functionDeclarations || []).map(tool => tool.name);
assert.equal(new Set(names).size, names.length, 'Gemini setup must never declare duplicate functions');
assert.equal(names.filter(name => name === 'delegate_codex_task').length, 1);
console.log('Gemini setup passed: unique tool declarations including one Codex delegate.');
