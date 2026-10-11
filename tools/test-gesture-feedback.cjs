const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('src/renderer.js','utf8');
(async()=>{
 let rejectTask;const notices=[];
 const scope=vm.createContext({voiceStartGeneration:0,manualControlGeneration:0,dispatchGesture:()=>new Promise((_,reject)=>rejectTask=reject),showGesture:message=>notices.push(message)});
 vm.runInContext(source.slice(source.indexOf('function handleGesture('),source.indexOf('async function dispatchSpotifyGesture(')),scope);
 scope.handleGesture('pinch');scope.voiceStartGeneration++;rejectTask(Error('Stopped failure'));await new Promise(setImmediate);assert.equal(notices.length,0);
 scope.handleGesture('swipe-up');scope.manualControlGeneration++;rejectTask(Error('Replaced failure'));await new Promise(setImmediate);assert.equal(notices.length,0);
 // Dispatch itself advances the handoff generation before its first await.
 scope.dispatchGesture=()=>{scope.manualControlGeneration++;return new Promise((_,reject)=>rejectTask=reject)};
 scope.handleGesture('pinch');rejectTask(Error('Current failure'));await new Promise(setImmediate);assert.deepEqual(notices,['Current failure']);
 console.log('Gesture feedback: stopped/replaced failures stay silent; current failure survives its own handoff generation.');
})().catch(error=>{console.error(error);process.exitCode=1});
