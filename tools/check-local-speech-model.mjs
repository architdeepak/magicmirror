// Offline classifier/cost probe. No microphone, API or GPU; not accuracy proof.
import fs from 'node:fs/promises';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {Processor} from '../src/vendor/headaudio/processor.mjs';
import {Training} from '../src/vendor/headaudio/training.mjs';
import {RECORD_OFFSET,RECORD_LEN} from '../src/vendor/headaudio/parameters.mjs';
const input=process.argv[2]||'artifacts/gemini-live/greeting.wav',bytes=await fs.readFile(input);
if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw Error('Expected RIFF WAV');
let rate,data,channels,format,bits;
for(let pos=12;pos+8<=bytes.length;){const size=bytes.readUInt32LE(pos+4),end=pos+8+size;if(end>bytes.length)throw Error('Truncated WAV');const id=bytes.toString('ascii',pos,pos+4);if(id==='fmt '){if(size<16)throw Error('Invalid WAV format');format=bytes.readUInt16LE(pos+8);channels=bytes.readUInt16LE(pos+10);rate=bytes.readUInt32LE(pos+12);bits=bytes.readUInt16LE(pos+22);}if(id==='data')data=bytes.subarray(pos+8,end);pos=end+(size%2);}
if(format!==1||channels!==1||bits!==16||!data||!rate||data.length%2)throw Error('Expected mono PCM16 WAV');
const samples=Float32Array.from({length:data.length/2},(_,i)=>data.readInt16LE(i*2)/32768),b=await fs.readFile(new URL('../src/vendor/headaudio/model-en-mixed.bin',import.meta.url)),buffer=b.buffer.slice(b.byteOffset,b.byteOffset+b.length),training=new Training(),model=[];
for(let pos=0;pos<buffer.byteLength;pos+=RECORD_OFFSET)model.push(training.decodeBinaryRecord(new Float32Array(buffer,pos,RECORD_LEN)));
const events=[],processor=new Processor({sampleRate:rate,parameterData:{silMode:0}},{port:{postMessage:e=>events.push(e)}});processor._onmessage({data:{event:'model',model}});
const timings=[],start=performance.now();for(let i=0;i<samples.length;i+=128){const at=performance.now();processor.process(samples.subarray(i,i+128));timings.push(performance.now()-at);}const wallMs=performance.now()-start;
const histogram={};for(const e of events)if(e.event==='viseme')histogram[e.viseme]=(histogram[e.viseme]||0)+1;timings.sort((a,b)=>a-b);
const result={checkedAt:new Date().toISOString(),input:path.basename(input),inputSha256:createHash('sha256').update(bytes).digest('hex'),modelSha256:createHash('sha256').update(b).digest('hex'),sampleRate:rate,durationSec:samples.length/rate,modelBytes:buffer.byteLength,prototypes:model.length,wallMs,blockMs:{mean:timings.reduce((a,b)=>a+b,0)/timings.length,p99:timings[Math.floor((timings.length-1)*.99)],max:timings.at(-1)},histogram,events,host:{platform:process.platform,arch:process.arch,node:process.version},scope:'Offline upstream processor on recorded audio, 128-sample blocks, shared DGX Spark CPU. Wall cost and predictions only; no labeled accuracy, browser audio-thread deadline or PC-stick power proof.'};
await fs.mkdir('artifacts/local-speech-model',{recursive:true});await fs.writeFile('artifacts/local-speech-model/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,events:undefined}));
