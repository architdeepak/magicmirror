const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('src/renderer.js','utf8');
(async()=>{
 const changes=[];
 const displayGallery=()=>{};
 const wake=vm.createContext({sleeping:true,hardMuted:false,desktopActive:false,mode:'portal',state:'ready',cameraWasActiveBeforeSleep:false,elements:{shell:{dataset:{sleeping:'true'}}},restoreCameraAfterIdle(){},ambience:{setContext:context=>changes.push(context)},resumeRendering(){}});
 vm.runInContext(source.slice(source.indexOf('function syncAmbienceContext()'),source.indexOf('function setState(')),wake);
 wake.displayGallery=displayGallery;
 vm.runInContext(source.slice(source.indexOf('async function wakeFromSleep()'),source.indexOf("window.addEventListener('pointermove', resetIdle)")),wake);
 await wake.wakeFromSleep();assert.equal(changes.at(-1).muted,false);assert.equal(changes.at(-1).duck,false);
 for(const [hardMuted,mode,state,desktopActive]of [[true,'portal','ready',false],[false,'watch','ready',false],[false,'portal','speaking',false],[false,'portal','ready',true]]){
  Object.assign(wake,{sleeping:true,hardMuted,mode,state,desktopActive});await wake.wakeFromSleep();assert.equal(changes.at(-1).muted,hardMuted);assert.equal(changes.at(-1).duck,mode==='watch'||state==='speaking'||desktopActive);
 }
 let serial=0;const timers=new Map(),scope=vm.createContext({setTimeout:fn=>{const id=++serial;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(fs.readFileSync('src/mirrorAmbience.js','utf8').replace('export class','class')+';this.MirrorAmbience=MirrorAmbience;',scope);
 const ambience=new scope.MirrorAmbience();ambience.enabled=true;ambience.master={gain:{value:0}};ambience._ring=()=>{};ambience._ringLater();
 let contexts=0,resumes=0;scope.AudioContext=class{constructor(){contexts++;this.state='suspended'}async resume(){resumes++;this.state='running'}};
 const muted=new scope.MirrorAmbience();muted.setContext({muted:true});await muted.setEnabled(true);assert.equal(contexts,0,'Muted atmosphere must not create an audio context');assert(muted.enabled);
 muted._build=()=>{muted.master={}};muted.sync=()=>{};
 const enable=muted.setEnabled.bind(muted);let audioStart;muted.setEnabled=value=>(audioStart=enable(value));
 muted.setContext({muted:false});await audioStart;assert.equal(resumes,1);assert(muted.master,'Unmute must honor saved enabled preference');
 const pending=[];let suspends=0,builds=0;
 const racing=new scope.MirrorAmbience();racing.audio={state:'running',resume:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),suspend:async()=>{suspends++}};
 racing._build=()=>{builds++;racing.master={gain:{value:0}}};racing.sync=()=>{};
 const oldStart=racing.setEnabled(true),newStart=racing.setEnabled(true);
 pending[1].resolve();await newStart;const currentMaster=racing.master,currentEpoch=racing.epoch;
 pending[0].reject(Error('Old audio resume failed'));await oldStart;
 assert.equal(racing.master,currentMaster,'Old failure stopped newer audio');assert.equal(racing.epoch,currentEpoch);assert.equal(suspends,0);
 const lateSuccess=racing.setEnabled(true);await racing.setEnabled(false);pending[2].resolve();await lateSuccess;assert.equal(racing.master,null);assert.equal(builds,1,'Stopped startup rebuilt audio');
 const currentFailure=racing.setEnabled(true);pending[3].reject(Error('Current audio resume failed'));await currentFailure;assert.equal(racing.master,null);assert.equal(suspends,2,'Current startup failure must still retire audio');
 for(let ring=0;ring<10000;ring++){
  // A fresh enable request can supersede resume work while retaining this graph.
  ambience.epoch++;
  assert.equal(ambience.timers.length,1);const id=ambience.timers[0],callback=timers.get(id);timers.delete(id);callback();
 }
 assert.equal(ambience.timers.length,1);assert.equal(timers.size,1);
 const retired=timers.values().next().value;ambience.stop();assert.equal(timers.size,0);retired();assert.equal(ambience.timers.length,0,'Retired timer must not reschedule');
 ambience.master={gain:{value:0}};ambience._ringLater();retired();assert.equal(ambience.timers.length,1,'Old callback must not add a second bell loop after restart');ambience.stop();
 console.log('Ambience lifecycle: wake/mute/media guards, out-of-order resume success/failure, 10,000 bounded bell timers and stopped callback retirement passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
