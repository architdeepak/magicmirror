import assert from 'node:assert/strict';
import { StreamingCaption, lastTwoLines } from '../src/streamingCaption.js';

assert.equal(lastTwoLines('one two three four five six', 9), 'four five\nsix');
const frames = [];
const caption = new StreamingCaption({ render: text => frames.push(text), fit: text => lastTwoLines(text, 9), interval: 2 });
async function drain() {
  const deadline = Date.now() + 1500;
  while (caption.pending.length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(caption.pending.length, 0);
}
caption.push('one two three four five six', 'assistant');
assert.equal(frames.at(-1), 'one', 'An arriving chunk must not appear all at once');
await drain();
assert.equal(frames.at(-1), 'four five\nsix', 'Older lines roll away to show current speech');
assert.ok(frames.every(text => text.split('\n').length <= 2));
caption.push('hello', 'user', true);
assert.equal(frames.at(-1), 'hello', 'New speaker clears the old response');
caption.push('hello there', 'user', true);
await drain();
assert.equal(frames.at(-1), 'hello\nthere');
caption.push('pending words must disappear', 'assistant');
caption.clear();
await new Promise(resolve => setTimeout(resolve, 20));
assert.equal(frames.at(-1), '', 'STOP cancels pending caption words');
console.log('Streaming captions passed: incremental words, latest two lines, speaker changes and cancellation.');
