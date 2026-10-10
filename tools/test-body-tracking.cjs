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
  // Quality sets a maximum submission cadence; pending work and unchanged
  // video frames still prevent additional captures at every quality.
  for(const [quality,interval] of [['eco',100],['auto',1000/15],['hd',1000/30]]) {
    const feed={srcObject:{active:true},readyState:2,videoWidth:640,videoHeight:480,currentTime:1};
    const subject=new context.Subject(feed);subject.setQuality(quality);subject.setEnabled(true);
    const worker=workers.at(-1);worker.send({type:'ready'});subject.lastFrameAt=1000;
    const count=bitmaps.length;subject.update(1000+interval-2);
    assert.equal(bitmaps.length,count,quality+' submitted before its cadence');
    subject.update(1000+interval);assert.equal(bitmaps.length,count+1,quality+' missed its due frame');
    feed.currentTime=2;subject.update(1200);assert.equal(bitmaps.length,count+1,quality+' queued while busy');
    bitmaps.at(-1).resolve(frame());await tick();
    worker.send({type:'pose',requestId:subject.pending.id,epoch:subject.epoch,timestamp:1000+interval,landmarks:null});
    feed.currentTime=1;subject.update(1300);assert.equal(bitmaps.length,count+1,quality+' duplicated an unchanged video frame');
    subject.destroy();
  }
  // A camera can renegotiate dimensions without replacing its MediaStream.
  // Public snapshots must reject its old pose/frame before the next render tick.
  for(const change of ['dimensions','inactive','unready']) {
    const feed={srcObject:{active:true},readyState:2,videoWidth:640,videoHeight:480,currentTime:1};
    const subject=new context.Subject(feed);subject.setEnabled(true);const worker=workers.at(-1);worker.send({type:'ready'});subject.update(2000);
    const bitmap=frame();bitmaps.at(-1).resolve(bitmap);await tick();
    const request=subject.pending.id,epoch=subject.epoch;
    worker.send({type:'pose',requestId:request,epoch,timestamp:2000,frame:bitmap,landmarks:Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:1})),worldLandmarks:Array.from({length:33},()=>({x:0,y:0,z:0})),segmentation:{width:1,height:1,classes:new Uint8Array([2])}});
    assert(subject.getPose(2001)&&subject.getCameraFrame(2001));
    if(change==='dimensions')feed.videoWidth=480;
    if(change==='inactive')feed.srcObject.active=false;
    if(change==='unready')feed.readyState=1;
    assert.equal(subject.getPose(2002),null,change+' exposed old pose before update');
    assert.equal(subject.getWorldPose(2002),null,change+' exposed old world pose');
    assert.equal(subject.getSegmentation(2002),null,change+' exposed old mask');
    assert.equal(subject.getCameraFrame(2002),null,change+' exposed old camera frame');
    subject.update(2002);assert(bitmap.closed,change+' retained its display bitmap');
    subject.destroy();
  }
  for(const phase of ['bitmap','worker']) {
    const feed={srcObject:{active:true},readyState:2,videoWidth:640,videoHeight:480,currentTime:1};
    const subject=new context.Subject(feed);subject.setEnabled(true);const worker=workers.at(-1);worker.send({type:'ready'});subject.update(3000);
    const bitmap=frame(),pendingBitmap=bitmaps.at(-1),request=subject.pending.id,epoch=subject.epoch;
    if(phase==='worker'){pendingBitmap.resolve(bitmap);await tick();}
    feed.videoHeight=640;
    if(phase==='bitmap'){pendingBitmap.resolve(bitmap);await tick();assert.equal(worker.messages.filter(m=>m.type==='frame').length,0,'Old dimensions reached inference');}
    else worker.send({type:'pose',requestId:request,epoch,timestamp:3000,frame:bitmap,landmarks:Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:1}))});
    assert(bitmap.closed&&!subject.busy,phase+' retained an obsolete bitmap or inference slot');
    assert.equal(subject.pose,null,phase+' accepted old dimensions');
    feed.currentTime=2;subject.update(3100);assert(subject.pending,'Renegotiated source did not recover');
    const fresh=frame();bitmaps.at(-1).resolve(fresh);await tick();worker.send({type:'pose',requestId:subject.pending.id,epoch:subject.epoch,timestamp:3100,frame:fresh,landmarks:Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:1}))});
    assert(subject.getPose(3101)&&subject.getCameraFrame(3101),'New dimensions failed to recover');subject.destroy();assert(fresh.closed);
  }
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
  // Full HD display and smaller analysis must refer to the same captured image.
  const captured=[],analysis=[],messages=[];let outputFrame;
  context.createImageBitmap=(video,options)=>{captured.push(options);const pending=deferred();bitmaps.push(pending);return pending.promise};
  const hd=new context.Subject({srcObject:{active:true},readyState:2,videoWidth:3840,videoHeight:2160,currentTime:1});hd.setQuality('hd');hd.setEnabled(true);workers.at(-1).send({type:'ready'});hd.update(2000);assert.equal(captured[0].resizeWidth,3840);assert.equal(captured[0].resizeHeight,2160);bitmaps.at(-1).resolve(frame());await tick();hd.destroy();
  workerContext.createImageBitmap=async(original,options)=>{const image={...options,width:options.resizeWidth,height:options.resizeHeight,close(){this.closed=true}};analysis.push(image);return image};
  landmarker.detectForVideo=image=>{assert(image.width<=960&&image.height<=720,'HD source enlarged ML work');return{landmarks:[[{x:.5,y:.5,visibility:1}]],close(){}}};
  const full={width:3840,height:2160,close(){this.closed=true}};await workerContext.self.onmessage({data:{type:'frame',frame:full,timestamp:15000,requestId:100,epoch:1}});assert.equal(workerMessages.at(-1).frame,full,'Worker substituted analysis pixels for HD display');assert(analysis[0].closed,'Resized analysis bitmap leaked');
  console.log('Body tracking passed: immediate camera invalidation, request identity, worker watchdog, late bitmap isolation, disposal, motion-adaptive pose smoothing, mask freshness across camera changes, and GPU/CPU frame-budget recovery.');
})().catch(error=>{console.error(error);process.exitCode=1;});
