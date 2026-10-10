const assert=require('assert/strict');const fs=require('fs');const vm=require('vm');const path=require('path');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/audioTurnDetector.js'),'utf8').replace('export class ','class ')+';globalThis.Subject=AudioTurnDetector',context);
const detector=new context.Subject();const frame=amplitude=>new Int16Array(1600).fill(Math.round(amplitude*32768));
for(let i=0;i<50;i++)assert.equal(detector.accept(frame(.001),16000),false,'Silence/noise produced an end-of-turn signal');
for(let i=0;i<3;i++)assert.equal(detector.accept(frame(.08),16000),false);
for(let i=0;i<6;i++)assert.equal(detector.accept(frame(0),16000),false,'Natural pause was cut off');
assert.equal(detector.accept(frame(0),16000),true);
for(let i=0;i<20;i++)assert.equal(detector.accept(frame(0),16000),false,'Silence repeatedly finalized a turn');
detector.accept(frame(.3),16000);for(let i=0;i<8;i++)assert.equal(detector.accept(frame(0),16000),false,'A short click was treated as an utterance');
detector.accept(frame(.08),16000);detector.accept(frame(.08),16000);for(let i=0;i<4;i++)detector.accept(frame(0),16000);detector.accept(frame(.08),16000);
for(let i=0;i<6;i++)assert.equal(detector.accept(frame(0),16000),false);assert.equal(detector.accept(frame(0),16000),true);
detector.accept(frame(.08),16000);detector.accept(frame(.08),16000);detector.reset();for(let i=0;i<8;i++)assert.equal(detector.accept(frame(0),16000),false,'Reset kept an old speech turn active');
assert.equal(detector.accept(new Int16Array(),16000),false);assert.equal(detector.accept(frame(.1),0),false);
const turns=new context.Subject();const silence=frame(0);turns.process(silence,16000);turns.process(silence,16000);
turns.process(frame(.08),16000);const start=turns.process(frame(.08),16000);
assert(start.start&&!start.end);assert(start.frames.length>=3,'Turn start clipped buffered speech onset');
assert(start.frames.at(-1)[0]>0);for(let i=0;i<7;i++){const result=turns.process(silence,16000);assert.equal(result.end,i===6)}
assert(!turns.active);assert.equal(turns.process(silence,16000).frames.length,0,'Idle silence was uploaded');
console.log('Audio turn hints passed: quiet/noise, minimum speech, natural pauses, one finalization per utterance, continued speech, and reset on session changes. Buffered onset, explicit boundaries, and no idle silence upload also passed.');
