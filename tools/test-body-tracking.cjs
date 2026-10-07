const assert=require('assert/strict');const fs=require('fs');const path=require('path');const vm=require('vm');const {pathToFileURL}=require('url');
const read=name=>fs.readFileSync(path.join(__dirname,'../src',name),'utf8');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  const timers=new Map(),workers=[],bitmaps=[];let nextTimer=0;
  class Worker{constructor(){workers.push(this);this.messages=[];}postMessage(message){this.messages.push(message);}terminate(){this.terminated=true;}send(data){this.onmessage({data});}}
  const context=vm.createContext({console,URL,Worker,performance:{now:()=>1200},setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),createImageBitmap:()=>{const pending=deferred();bitmaps.push(pending);return pending.promise;}});
  vm.runInContext(read('bodyPoseFilter.js').replace('export class ','class '),context);
  vm.runInContext(read('bodyTracking.js').replace(/^import .*;\n/,'').replace('export class ','class ').replaceAll('import.meta.url',JSON.stringify(pathToFileURL(path.join(__dirname,'../src/bodyTracking.js')).href))+'\nglobalThis.Subject=BodyTracking;globalThis.Filter=BodyPoseFilter;',context);
  const video={srcObject:{id:1},readyState:2,videoWidth:640,videoHeight:480,currentTime:0};
  const tracker=new context.Subject(video);tracker.setEnabled(true);workers[0].send({type:'ready'});tracker.update(1000);
  assert.equal(timers.get(tracker.pending.timeout).ms,20000,'Cold inference lacked warmup allowance');
  const old=tracker.pending.id;video.srcObject={id:2};tracker.update(1001);assert.equal(tracker.getPose(1001),null);
  const frame=()=>({closed:false,close(){this.closed=true;}});const obsolete=frame();bitmaps[0].resolve(obsolete);await tick();assert(obsolete.closed&&!tracker.busy,'Old bitmap held the new camera busy');
  tracker.update(1101);const current=tracker.pending.id;
  workers[0].send({type:'pose',requestId:old,epoch:tracker.epoch,landmarks:[{x:.1,y:.1,z:0}],timestamp:1000});
  assert.equal(tracker.pending.id,current,'Old result released the current inference slot');
  bitmaps[1].resolve(frame());await tick();assert.equal(workers[0].messages.at(-1).requestId,current);
  const displayFrame=frame();
  workers[0].send({type:'pose',frame:displayFrame,requestId:current,epoch:tracker.epoch,landmarks:Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:1})),worldLandmarks:Array.from({length:33},()=>({x:.1,y:.2,z:.3})),segmentation:{width:2,height:2,classes:new Uint8Array([1,2,3,4])},timestamp:1101});
  assert.equal(tracker.getPose(1200).length,33);assert.equal(tracker.getWorldPose(1200).length,33);assert.equal(tracker.getWorldPose(1600),null,'Stale world pose remained available');
  assert.equal(tracker.getCameraFrame(1200),displayFrame);assert.equal(tracker.getCameraFrame(1600),null,'Expired camera frame remained displayed');
  assert.equal(tracker.getSegmentation(1200).classes.length,4);
  assert.equal(tracker.getSegmentation(1600),null,'Stale segmentation remained visible');
  video.srcObject={id:3};assert.equal(tracker.getWorldPose(1201),null,'Camera change retained a 3D body');assert.equal(tracker.getSegmentation(1201),null,'Camera change retained a segmentation mask');assert.equal(tracker.getPose(1201),null,'Old pose was visible after switching cameras');
  video.currentTime=1;tracker.update(1300);const stuck=tracker.pending;assert(displayFrame.closed,'Camera switch leaked a displayed bitmap');
  assert.equal(timers.get(stuck.timeout).ms,5000,'Warm inference watchdog was too permissive');
  timers.get(stuck.timeout).fn();assert(workers[0].terminated&&!tracker.ready&&!tracker.busy,'Stalled inference did not recover');
  tracker.setEnabled(true);workers[1].send({type:'ready'});video.currentTime=2;tracker.update(1400);
  const fresh=tracker.pending.id;bitmaps[2].resolve(frame());await tick();assert.equal(tracker.pending.id,fresh,'Late bitmap cleared a newer request');
  tracker.destroy();bitmaps[3].resolve(frame());await tick();assert.equal(timers.size,0,'Disposal left inference timers running');tracker.setEnabled(true);tracker.update(1500);assert.equal(tracker.enabled,false,'Disposed tracker restarted');
  const filter=new context.Filter();const pose=x=>[{x,y:.5,z:.1,visibility:1}];
  filter.update(pose(.5),0);const jitter=filter.update(pose(.51),100);assert(jitter[0].x>.5&&jitter[0].x<.51,'Jitter was not smoothed');
  assert.equal(filter.update(pose(.9),200)[0].x,.9,'Large movement left a garment trail');
  filter.update(null,250);assert.equal(filter.update(pose(.2),300)[0].x,.2,'Reappearing body blended with a lost pose');
  assert.equal(filter.update(pose(.7),1000)[0].x,.7,'Long frame gap blended stale body state');
  const workerMessages=[];let clock=0,delegate='GPU',switches=0,segmentationClosed=0;
  const segmenter={getLabels:()=>['background','hair','body-skin','face-skin','clothes','others'],
    segmentForVideo:()=>{clock+=delegate==='GPU'?500:20;return{categoryMask:{width:2,height:2,getAsUint8Array:()=>new Uint8Array([1,2,3,4])},close:()=>{}}},
    setOptions:async options=>{delegate=options.baseOptions.delegate;switches++},close:()=>segmentationClosed++};
  const landmarker={detectForVideo:()=>{clock+=70;return{landmarks:[[{x:.5,y:.5,visibility:1}]],close:()=>{}}}};
  const workerContext=vm.createContext({URL,Uint8Array,performance:{now:()=>clock},self:{location:{href:'file:///fixture/worker.js'},postMessage:message=>workerMessages.push(message)},Vision:{FilesetResolver:{forVisionTasks:async()=>({})},PoseLandmarker:{createFromOptions:async()=>landmarker},ImageSegmenter:{createFromOptions:async()=>segmenter}}});
  vm.runInContext(read('poseTrackingWorker.js').replace("await import('../node_modules/@mediapipe/tasks-vision/vision_bundle.mjs')",'Vision'),workerContext);
  await workerContext.self.onmessage({data:{type:'init'}});
  assert.equal(workerMessages[0].segmentationAvailable,true);
  for(let i=0;i<5;i++) {
    const bitmap=frame();await workerContext.self.onmessage({data:{type:'frame',frame:bitmap,timestamp:i*1000,requestId:i,epoch:1}});assert(bitmap.closed);
  }
  assert.equal(switches,1,'Slow software GPU was not switched to CPU');
  assert.equal(workerMessages.at(-1).segmentationDelegate,'CPU');
  assert.equal(workerMessages.at(-1).inferenceMs,90,'CPU delegate did not restore the frame budget');
  assert.equal(workerMessages.at(-1).segmentation.classes.length,4);
  segmenter.segmentForVideo=()=>{clock+=500;return{categoryMask:{width:2,height:2,getAsUint8Array:()=>new Uint8Array([1,2,3,4])},close:()=>{}}};
  for(let i=5;i<14;i++)await workerContext.self.onmessage({data:{type:'frame',frame:frame(),timestamp:i*1000,requestId:i,epoch:1}});
  assert.equal(segmentationClosed,1,'Slow CPU occlusion kept starving pose tracking');
  assert(workerMessages.some(message=>message.type==='occlusion-unavailable'&&message.message.includes('too slow')));
  assert.equal(workerMessages.at(-1).inferenceMs,70);
  assert.equal(workerMessages.at(-1).segmentation,null);
  let initialDelegate,probeClosed=false;
  const softwareContext=vm.createContext({URL,performance:{now:()=>0},Uint8Array,self:{location:{href:'file:///fixture/worker.js'},postMessage:()=>{}},
    OffscreenCanvas:class {getContext(){return{getExtension:name=>name==='WEBGL_debug_renderer_info'?{UNMASKED_RENDERER_WEBGL:123}:{loseContext:()=>probeClosed=true},getParameter:()=> 'ANGLE SwiftShader software GPU'}}},
    Vision:{FilesetResolver:{forVisionTasks:async()=>({})},PoseLandmarker:{createFromOptions:async()=>landmarker},ImageSegmenter:{createFromOptions:async(_vision,options)=>{initialDelegate=options.baseOptions.delegate;return segmenter}}}});
  vm.runInContext(read('poseTrackingWorker.js').replace("await import('../node_modules/@mediapipe/tasks-vision/vision_bundle.mjs')",'Vision'),softwareContext);
  await softwareContext.self.onmessage({data:{type:'init'}});assert.equal(initialDelegate,'CPU');assert(probeClosed,'Renderer probe leaked its WebGL context');
  console.log('Body tracking passed: immediate camera invalidation, request identity, worker watchdog, late bitmap isolation, disposal, motion-adaptive pose smoothing, mask freshness across camera changes, and GPU/CPU frame-budget recovery.');
})().catch(error=>{console.error(error);process.exitCode=1;});
