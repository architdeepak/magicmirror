const assert=require('assert/strict'),{checkCameraSample,checkCameraCoverage}=require('./monitor-camera.cjs');
const sample=()=>({at:'fixture',cameraActive:true,sleeping:false,power:{frames:1,scene:{frames:1}},avatarRig:{frames:1,graphics:{renderer:'NVIDIA'}},speech:{active:true},audio:{playback:{enabled:true,source:'output-waveform',level:.1,visemeModel:'ready',predictedViseme:0}},cameraWorkload:{phase:'ar',phaseAgeMs:7000,pumping:true,sourcePaused:false,streamActive:true,activeStreams:1,fit:{visible:true},garmentName:'Test shirt',selectedName:'Test shirt',body:{requests:10}}});
assert.deepEqual(checkCameraSample(sample(),sample()),[]);
const inactive=()=>{const s=sample();s.cameraActive=false;s.cameraWorkload={...s.cameraWorkload,phase:'camera-off',pumping:false,sourcePaused:true,streamActive:false,activeStreams:0,fit:{visible:false}};return s};
assert.deepEqual(checkCameraSample(inactive(),inactive()),[]);
const mismatch=sample();mismatch.cameraWorkload.selectedName='Different shirt';assert(checkCameraSample(mismatch,sample()).some(e=>e.type==='wardrobe-state-display-mismatch'));
for(const [field,value,type]of [['pumping',true,'unused-camera-fixture-running'],['streamActive',true,'camera-off-retained-input-or-fit'],['activeStreams',1,'camera-off-retained-input-or-fit']]){const s=inactive();s.cameraWorkload[field]=value;assert(checkCameraSample(s,inactive()).some(e=>e.type===type));}
const busy=inactive();busy.cameraWorkload.body.requests++;assert(checkCameraSample(busy,inactive()).some(e=>e.type==='camera-off-inference-requests'));
const sleeping=()=>{const s=inactive();s.sleeping=true;s.cameraWorkload.phase='sleep';return s};
assert.deepEqual(checkCameraSample(sleeping(),sleeping()),[]);
for(const field of ['power','scene','rig']){const s=sleeping();if(field==='power')s.power.frames++;if(field==='scene')s.power.scene.frames++;if(field==='rig')s.avatarRig.frames++;assert(checkCameraSample(s,sleeping()).some(e=>e.type==='sleep-drawing-continued'));}
const leaked=sample();leaked.cameraWorkload.activeStreams=2;assert(checkCameraSample(leaked,sample()).some(e=>e.type==='multiple-camera-fixture-streams'));
const missed=inactive();missed.cameraWorkload.phase='sleep';assert(checkCameraSample(missed,inactive()).some(e=>e.type==='camera-sleep-not-observed'));
const mirror=sample();mirror.cameraWorkload.phase='mirror';mirror.cameraWorkload.fit.visible=false;
const rows=[sample(),mirror,inactive(),sleeping(),sample()],options={speechFixture:true,graphicsRequest:'vulkan',avatarStyle:'rig',seconds:65,phaseSeconds:10};
assert.deepEqual(checkCameraCoverage(rows,options),[],'Valid zero-ID prediction or complete camera cycle rejected');
for(const [change,type]of [[s=>s.audio.playback.predictedViseme=null,'camera-and-speech-model-not-observed-together'],[s=>s.avatarRig.graphics.renderer='software','requested-nvidia-not-observed'],[s=>s.cameraWorkload.fit.visible=false,'recorded-camera-fit-not-observed']]){const copy=structuredClone(rows);copy.forEach(change);assert(checkCameraCoverage(copy,options).some(e=>e.type===type));}
for(const [key,value]of [['enabled',false],['source','manual'],['level',0]]){const copy=structuredClone(rows);copy.forEach(s=>s.audio.playback[key]=value);assert(checkCameraCoverage(copy,options).some(e=>e.type==='camera-and-speech-model-not-observed-together'));}
for(const value of [undefined,-1,15,.5]){const copy=structuredClone(rows);copy.forEach(s=>s.audio.playback.predictedViseme=value);assert(checkCameraCoverage(copy,options).some(e=>e.type==='camera-and-speech-model-not-observed-together'));}
assert(checkCameraCoverage(rows.slice(0,-1),options).some(e=>e.type==='camera-wake-fit-not-observed'));
assert(checkCameraCoverage(rows.filter(s=>s.cameraWorkload.phase!=='camera-off'),options).some(e=>e.type==='camera-phase-not-observed'));
console.log('Recorded-camera monitor: active/off/sleep ownership, input/worker/draw leaks, combined model (including ID zero), backend/phase/sleep/wake coverage guards passed.');
