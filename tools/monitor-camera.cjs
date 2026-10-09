// Recorded input transport; the packaged app owns all actual tracking/rendering.
const path=require('path'),{pathToFileURL}=require('url');
async function setupMonitorCamera(client,root){
 await client.call('Emulation.setDeviceMetricsOverride',{width:720,height:1280,deviceScaleFactor:1,mobile:false});
 await client.evaluate(`(async()=>{
  const source=document.createElement('video');source.muted=true;source.loop=true;source.src=${JSON.stringify(pathToFileURL(path.join(root,'artifacts/rtv/sample_video2.mp4')).href)};
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d');
  const camera=__monitor.camera={source,canvas,stream:null,streams:[],pump:null,captures:0,phase:null,phaseAt:performance.now()};
  camera.pause=()=>{clearInterval(camera.pump);camera.pump=null;source.pause();};
  camera.start=async()=>{await source.play();ctx.drawImage(source,0,0,1280,720);if(!camera.pump)camera.pump=setInterval(()=>ctx.drawImage(source,0,0,1280,720),33);};
  navigator.mediaDevices.getUserMedia=async constraints=>{if(constraints.audio)throw Error('Recorded monitor has no microphone');await camera.start();camera.streams=camera.streams.filter(stream=>stream.active);camera.stream=canvas.captureStream(30);camera.streams.push(camera.stream);camera.captures++;return camera.stream;};
 })()`);
 // Actual DOM upload/cutout and native save keep closet state and displayed art
 // in agreement. Avoid selecting an ad hoc overlay unknown to the closet.
 await client.evaluate(`__mirrorDebug.gemini.onWardrobe({command:'add garment'})`);
 const doc=await client.call('DOM.getDocument'),field=await client.call('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#wardrobe-photo [data-field=file]'});
 await client.call('DOM.setFileInputFiles',{nodeId:field.nodeId,files:[path.join(root,'.tools/rtv/assets/garment_images/lab_08_white_bg.jpg')]});
 await until(client,`!document.querySelector('#wardrobe-photo [data-action=save]').disabled`,'garment cutout');
 await client.evaluate(`__mirrorDebug.gemini.onWardrobe({command:'name it Monitor plaid shirt'});__mirrorDebug.gemini.onWardrobe({command:'save garment'})`);
 await until(client,`__mirrorDebug.garmentOverlay.texture?.photoPattern?.kind==='photo-long-sleeve'&&__mirrorDebug.getMirrorState().tryOn.selected?.name==='Monitor plaid shirt'`,'saved wardrobe photo');
}
async function until(client,expression,label){
 for(let i=0;i<450;i++){if(await client.evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,100));}
 throw Error('Recorded monitor '+label+' timed out');
}
async function setMonitorCameraPhase(client,phase){
 // Restore the ordinary deadline outside the dedicated sleep phase. Only the
 // owned 180-second idle sleep timeout is shortened, never inference deadlines.
 await client.evaluate(`(()=>{const c=__monitor.camera;c.phase=${JSON.stringify(phase)};c.phaseAt=performance.now();if(!__monitor.originalTimeout){__monitor.originalTimeout=window.setTimeout.bind(window);window.setTimeout=(fn,ms,...args)=>__monitor.originalTimeout(fn,c.phase==='sleep'&&ms===180000?1500:ms,...args)}})()`);
 if(await client.evaluate('__mirrorDebug.getMirrorState().display.sleeping'))for(const type of ['keyDown','keyUp'])await client.call('Input.dispatchKeyEvent',{type,key:'1',windowsVirtualKeyCode:49});
 const mode=['camera-off','ar'].includes(phase)?'ar':'mirror';
 const p=await client.evaluate(`(()=>{const r=document.querySelector('.mode-btn[data-mode="${mode}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 for(const type of ['mousePressed','mouseReleased'])await client.call('Input.dispatchMouseEvent',{type,...p,button:'left',clickCount:1});
 if(phase==='camera-off'){
  await client.evaluate(`(()=>{if(__mirrorDebug.getMirrorState().camera.active)document.querySelector('#camera-toggle').click();__monitor.camera.pause()})()`);
 }else{
  // Sleep starts with a live camera so the app's actual idle transition releases
  // it and the following wake restores it through getUserMedia again.
  await client.evaluate(`(()=>{if(!__mirrorDebug.getMirrorState().camera.active)document.querySelector('#camera-toggle').click()})()`);
  await until(client,'__mirrorDebug.getMirrorState().camera.active','camera capture');
 }
 if(phase==='ar')await until(client,'__mirrorDebug.garmentOverlay.getLiveState().visible','actual worker fit');
}
const cameraSnapshot=`(()=>{const c=__monitor.camera,t=__mirrorDebug.garmentOverlay.tracker;return{phase:c.phase,phaseAgeMs:performance.now()-c.phaseAt,captures:c.captures,pumping:!!c.pump,sourcePaused:c.source.paused,streamActive:c.stream?.active===true,activeStreams:c.streams.filter(stream=>stream.active).length,video:{width:document.querySelector('#camera-feed').videoWidth,height:document.querySelector('#camera-feed').videoHeight},fit:__mirrorDebug.garmentOverlay.getLiveState(),garmentName:__mirrorDebug.garmentOverlay.item?.name,selectedName:__mirrorDebug.getMirrorState().tryOn.selected?.name,ui:{dashboardOpacity:Number(getComputedStyle(document.querySelector('#dashboard-container')).opacity),framingHidden:__mirrorDebug.framing.element.hidden,framingReady:__mirrorDebug.framing.element.dataset.ready,framingReason:__mirrorDebug.framing.element.dataset.reason},body:{enabled:t.enabled,ready:t.ready,busy:t.busy,requests:t.requestNumber,lastPoseAt:t.lastPoseAt,inferenceMs:t.inferenceMs,worker:!!t.worker}}})()`;
async function pauseUnusedMonitorCamera(client){
 await client.evaluate(`(()=>{if(!__mirrorDebug.getMirrorState().camera.active)__monitor.camera.pause()})()`);
}
async function cleanupMonitorCamera(client){
 await client.evaluate(`(()=>{const c=window.__monitor?.camera;if(!c)return;c.pause();c.streams.forEach(stream=>stream.getTracks().forEach(track=>track.stop()));c.source.removeAttribute('src');c.source.load()})()`);
}
function checkCameraSample(sample,previous){
 const c=sample.cameraWorkload,errors=[],fail=(type,detail={})=>errors.push({at:sample.at,type,...detail});
 if(c.fit.visible&&c.garmentName!==c.selectedName)fail('wardrobe-state-display-mismatch');
 if(!sample.cameraActive&&(c.pumping||!c.sourcePaused))fail('unused-camera-fixture-running');
 if(c.phase==='camera-off'&&c.phaseAgeMs>1500&&(sample.cameraActive||c.fit.visible||c.streamActive||c.activeStreams>0))fail('camera-off-retained-input-or-fit');
 if(previous?.cameraWorkload?.phase===c.phase&&c.phaseAgeMs>6000&&!sample.cameraActive&&previous.cameraActive===false&&c.body.requests!==previous.cameraWorkload.body.requests)fail('camera-off-inference-requests');
 if(sample.sleeping&&previous?.sleeping&&(sample.power.frames!==previous.power.frames||sample.power.scene?.frames!==previous.power.scene?.frames||sample.avatarRig?.frames!==previous.avatarRig?.frames))fail('sleep-drawing-continued');
 if(c.phaseAgeMs>6000&&c.activeStreams>1)fail('multiple-camera-fixture-streams',{activeStreams:c.activeStreams});
 if(sample.sleeping&&c.activeStreams>0)fail('sleep-camera-stream-retained');
 if(c.phase==='sleep'&&c.phaseAgeMs>6000&&!sample.sleeping)fail('camera-sleep-not-observed');
 return errors;
}
function checkCameraCoverage(samples,{speechFixture,graphicsRequest,avatarStyle,seconds,phaseSeconds}){
 const errors=[],fail=(type,detail={})=>errors.push({type,...detail});
 if(speechFixture&&!samples.some(s=>s.cameraActive&&s.cameraWorkload.fit.visible&&s.speech.active&&s.audio.playback.enabled&&s.audio.playback.source==='output-waveform'&&s.audio.playback.level>.03&&s.audio.playback.visemeModel==='ready'&&Number.isInteger(s.audio.playback.predictedViseme)&&s.audio.playback.predictedViseme>=0&&s.audio.playback.predictedViseme<15))fail('camera-and-speech-model-not-observed-together');
 if(graphicsRequest==='vulkan'&&avatarStyle==='rig'&&!samples.some(s=>/NVIDIA/i.test(s.avatarRig?.graphics?.renderer||'')))fail('requested-nvidia-not-observed');
 if(!samples.some(s=>s.cameraActive&&s.cameraWorkload.fit.visible&&s.cameraWorkload.body.requests>0))fail('recorded-camera-fit-not-observed');
 if(seconds>=phaseSeconds*5){
  for(const phase of ['ar','mirror','camera-off','sleep'])if(!samples.some(s=>s.cameraWorkload.phase===phase))fail('camera-phase-not-observed',{phase});
  if(!samples.some(s=>s.sleeping&&!s.cameraActive&&s.cameraWorkload.activeStreams===0))fail('camera-sleep-cleanup-not-observed');
  if(seconds>phaseSeconds*5){let slept=false,woke=false;for(const sample of samples){if(sample.sleeping)slept=true;else if(slept&&sample.cameraActive&&sample.cameraWorkload.fit.visible)woke=true;}if(!woke)fail('camera-wake-fit-not-observed');}
 }
 return errors;
}
module.exports={setupMonitorCamera,setMonitorCameraPhase,cameraSnapshot,pauseUnusedMonitorCamera,cleanupMonitorCamera,checkCameraSample,checkCameraCoverage};
