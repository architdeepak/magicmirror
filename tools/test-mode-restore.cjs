const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('src/renderer.js','utf8');const timers=new Map(),moves=[];let id=0;
const scope=vm.createContext({modeRestoreTimer:null,modeRestoreGeneration:0,requestedMode:'mirror',state:'ready',sleeping:false,desktopActive:false,voiceStarting:false,agentRunId:null,browserRecognition:null,speech:{isSpeaking:false},gemini:{listening:false},setTimeout:fn=>{timers.set(++id,fn);return id},clearTimeout:id=>timers.delete(id),setMode:mode=>{scope.cancelModeRestore();moves.push(mode)}});
vm.runInContext(source.slice(source.indexOf('function cancelModeRestore('),source.indexOf('function setArEffect(')),scope);
const fire=()=>{const [key,fn]=timers.entries().next().value;timers.delete(key);fn()};
scope.returnToRequestedMode();scope.returnToRequestedMode();assert.equal(timers.size,1);fire();assert.deepEqual(moves,['mirror']);
scope.returnToRequestedMode();const stale=[...timers.values()][0];scope.showAssistant();const count=moves.length;stale();assert.equal(moves.length,count,'Old ready callback hid a newer assistant interaction');assert.equal(timers.size,0);
for(const state of ['starting','connecting','listening','speaking','thinking','error']){scope.state=state;scope.returnToRequestedMode();const count=moves.length;fire();assert.equal(moves.length,count,'Restored during '+state)}scope.state='ready';
for(const [key,value]of [['sleeping',true],['desktopActive',true],['voiceStarting',true],['agentRunId','task'],['browserRecognition',{}]]){scope[key]=value;scope.returnToRequestedMode();const count=moves.length;fire();assert.equal(moves.length,count);scope[key]=key==='agentRunId'||key==='browserRecognition'?null:false;}
scope.speech.isSpeaking=true;scope.returnToRequestedMode();const before=moves.length;fire();assert.equal(moves.length,before);scope.speech.isSpeaking=false;
scope.requestedMode='watch';scope.returnToRequestedMode();fire();assert.equal(moves.at(-1),'watch');
(async()=>{
 let release;scope.beginUserControl=()=>({wait:new Promise(resolve=>release=resolve),current:()=>true});scope.setAssistantMode=mode=>{scope.requestedMode=mode;scope.setMode(mode)};
 vm.runInContext(source.slice(source.indexOf('async function requestUserMode('),source.indexOf('const wake =')),scope);
 scope.returnToRequestedMode();const stale=[...timers.values()][0],before=moves.length;const request=scope.requestUserMode('ar');assert.equal(timers.size,0,'User intent left a restore pending while awaiting cancellation');stale();assert.equal(moves.length,before);release();await request;assert.equal(moves.at(-1),'ar');scope.returnToRequestedMode();fire();assert.equal(moves.at(-1),'ar');
 console.log('Mode restore: one pending callback, stale callback cancellation, active voice/agent/desktop/sleep guards, queued user intent and requested-mode retention passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
