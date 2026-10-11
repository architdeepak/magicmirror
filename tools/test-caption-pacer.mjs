import assert from 'node:assert/strict';
import { CaptionPacer } from '../src/captionPacer.js';

const make = () => {
  const state = { now: 0, shown: '', done: 0 };
  const pacer = new CaptionPacer({ clock: () => state.now, reveal: text => { state.shown += text; }, lookahead: 0 });
  return { state, pacer };
};
const sentence = 'The fairest of them all is whoever dares to ask the mirror again tomorrow';

// 1. A burst of audio and text (server faster than real time): captions follow the voice.
{
  const { state, pacer } = make();
  pacer.text(sentence + ' ');
  pacer.audio(0, 10);                       // 10 s of speech scheduled immediately
  pacer.tick();
  assert.equal(state.shown, '', 'nothing may be visible before the voice starts');
  state.now = 5; pacer.tick();
  const half = state.shown.length / sentence.length;
  assert.ok(half > .35 && half < .65, `about half visible at half the audio, got ${half}`);
  assert.ok(sentence.startsWith(state.shown.trimEnd()), 'reveal is a prefix');
  assert.ok(/\s$/.test(state.shown) || sentence.startsWith(state.shown) && sentence[state.shown.length] === ' ', 'only whole words');
  let finished = 0;
  pacer.endTurn(() => { finished++; });
  state.now = 9; pacer.tick();
  assert.equal(finished, 0, 'turn is not complete while audio is still playing');
  assert.ok(state.shown.length < sentence.length + 1);
  state.now = 10; pacer.tick();
  assert.equal(state.shown, sentence + ' ');
  assert.equal(finished, 1, 'completion runs exactly once, after the audio ends');
  state.now = 11; pacer.tick();
  assert.equal(finished, 1);
}

// 2. Never splits a word and never shows a half-typed final word mid-turn.
{
  const { state, pacer } = make();
  pacer.audio(0, 2);
  pacer.text('Hello wor');                  // "wor" is still being typed
  state.now = 2; pacer.tick();
  assert.equal(state.shown, 'Hello ', 'partial word held back');
  pacer.text('ld again ');
  state.now = 2; pacer.audio(2, 2); state.now = 3.9; pacer.tick();
  assert.ok(/world\s*$/.test(state.shown) || /again\s*$/.test(state.shown));
}

// 3. Text with no audio scheduled (typed reply / offline) shows as it arrives.
{
  const { state, pacer } = make();
  pacer.text('Typed answer without audio.');
  pacer.tick();
  assert.equal(state.shown, 'Typed answer without ', 'whole words shown at once; the word being typed waits');
  pacer.endTurn();
  assert.equal(state.shown, 'Typed answer without audio.');
}
{
  const { state, pacer } = make();
  let done = 0;
  pacer.text('Quick one.');
  pacer.endTurn(() => { done++; });
  assert.equal(state.shown, 'Quick one.', 'ended text-only turn flushes immediately');
  assert.equal(done, 1);
}

// 4. Barge-in drops what has not been said and still releases waiters.
{
  const { state, pacer } = make();
  let done = 0;
  pacer.text(sentence + ' '); pacer.audio(0, 10);
  state.now = 2; pacer.tick();
  const before = state.shown;
  pacer.endTurn(() => { done++; });
  pacer.cancel();
  state.now = 9; pacer.tick();
  assert.equal(state.shown, before, 'nothing further after cancel');
  assert.equal(done, 1);
}

// 5. Audio and text arriving interleaved keep a stable rate (no early burst).
{
  const { state, pacer } = make();
  const words = sentence.split(' ');
  let maxLead = 0;
  for (let i = 0; i < words.length; i++) {
    state.now = i * 0.3;
    pacer.text(words[i] + ' ');
    pacer.audio(i * 0.3, 0.3);
    pacer.tick();
    const spokenChars = (state.now / 0.3) * (sentence.length / words.length);
    maxLead = Math.max(maxLead, state.shown.length - spokenChars);
  }
  assert.ok(maxLead < 12, `captions must not run far ahead of speech, lead ${maxLead} chars`);
}

console.log('Caption pacer: voice-proportional reveal, whole words, text-only grace, single completion, barge-in and interleaved arrival passed.');
