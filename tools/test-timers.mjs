import assert from 'node:assert/strict';
import { parseTimerCommand, formatRemaining, MirrorTimers } from '../src/mirrorTimers.js';
assert.deepEqual(parseTimerCommand('set a timer for 10 minutes'), { seconds: 600, label: '' });
assert.deepEqual(parseTimerCommand('Timer for ninety seconds'.replace('ninety', '90')), { seconds: 90, label: '' });
assert.deepEqual(parseTimerCommand('set a timer for five minutes for the tea'), { seconds: 300, label: 'tea' });
assert.deepEqual(parseTimerCommand('start a one hour timer'), { seconds: 3600, label: '' });
assert.deepEqual(parseTimerCommand('timer for an hour and a half'), { seconds: 5400, label: '' });
for (const [command,seconds,label] of [
  ['timer for one and a half minutes',90,''],
  ['timer for two and a half minutes for the tea',150,'tea'],
  ['timer for two minutes and a half',150,''],
  ['timer for 2 and a half hours',9000,''],
  ['timer for half an hour',1800,''],
  ['timer for half a minute',30,''],
  ['Set a timer for 2.5 minutes.',150,''],
  ['Timer for 1.25 hours!',4500,''],
]) assert.deepEqual(parseTimerCommand(command),{seconds,label},command);
assert.match(parseTimerCommand('timer for 12 and a half hours').error,/twelve hours/);
for (const [command,seconds,label] of [
  ['timer for one hour and thirty minutes',5400,''],
  ['timer for 2 minutes 30 seconds for the tea',150,'tea'],
  ['timer for 1 hour, 2 minutes and 3 seconds',3723,''],
  ['timer for one and a half hours and fifteen minutes',6300,''],
  ['timer for 2 minutes for tea then wait 30 seconds',120,''],
]) assert.deepEqual(parseTimerCommand(command),{seconds,label},command);
assert.match(parseTimerCommand('timer for 12 hours and one minute').error,/twelve hours/);
for(const [phrase,seconds]of [['twenty five minutes',1500],['twenty-five minutes',1500],['thirty one seconds',31],['eleven minutes',660],['ninety minutes',5400],['one hundred and five seconds',105],['two hundred twenty seconds',220],['an hour and eleven minutes',4260]])assert.equal(parseTimerCommand('timer for '+phrase).seconds,seconds,phrase);
for(const phrase of ['one thousand twenty minutes','-5 minutes','negative five minutes'])assert.match(parseTimerCommand('timer for '+phrase).error,/digits/);
for(const [phrase,seconds]of [['.5 minutes',30],['one point five minutes',90],['zero point five minutes',30],['one point two five hours',4500]])assert.equal(parseTimerCommand('timer for '+phrase).seconds,seconds,phrase);
for(const phrase of ['half a second','.5 seconds','0.01 minutes','12.0001 hours'])assert.match(parseTimerCommand('timer for '+phrase).error,/one second to twelve hours/);
assert.deepEqual(parseTimerCommand('cancel the timer'), { cancel: true });
assert.equal(parseTimerCommand('what is the weather'), null);
assert.equal(parseTimerCommand('turn the camera on'), null);
assert.match(parseTimerCommand('timer for 99 hours').error, /twelve hours/);
assert.equal(formatRemaining(61000), '1:01');
assert.equal(formatRemaining(3661000), '1:01:01');
assert.equal(formatRemaining(-5), '0:00');
// Manager with a fake clock: completion once, cancellation clears, cap of four.
let clock = 0; const pending = new Map(); let id = 0; const done = [];
const timers = new MirrorTimers({ now: () => clock, onDone: timer => done.push(timer.label), setTimer: (fn, ms) => { pending.set(++id, { fn, at: clock + ms }); return id; }, clearTimer: handle => pending.delete(handle) });
for (const invalid of [NaN,Infinity,-1,0,.5,43201,'60',null]) assert.throws(()=>timers.add(invalid),/twelve hours/);
assert.equal(pending.size,0);assert.equal(timers.list().length,0);
timers.add(60, 'tea');
clock = 30000; assert.equal(timers.list()[0].remainingMs, 30000);
clock = 60000; for (const [handle, job] of [...pending]) if (job.at <= clock) { pending.delete(handle); job.fn(); }
assert.deepEqual(done, ['tea']); assert.equal(timers.list().length, 0);
for (let i = 0; i < 4; i++) timers.add(100);
assert.throws(() => timers.add(100), /four timers/);
assert.equal(timers.cancelAll(), 4); assert.equal(pending.size, 0);
console.log('Timers: spoken parsing, labels, limits, countdown, single completion, cancellation and cap passed.');
// Production defaults must survive being called as methods (browser timers throw "Illegal invocation" otherwise).
{
  const real = new MirrorTimers({ onDone() {} });
  const fakeWindowTimers = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  assert.doesNotThrow(() => { real.add(5, 'x'); real.cancelAll(); });
  assert.equal(typeof fakeWindowTimers.setTimeout, 'function');
}
