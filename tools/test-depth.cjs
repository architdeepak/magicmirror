const assert=require('assert/strict');const fs=require('fs');const path=require('path');const vm=require('vm');const THREE=require('three');
let now=5000;const storage=new Map();
const source=fs.readFileSync(path.join(__dirname,'../src/headTracking.js'),'utf8').replace(/^import .*;\n/,'').replace(/\bexport /g,'').replaceAll('import.meta.url',JSON.stringify(require('url').pathToFileURL(path.join(__dirname,'../src/headTracking.js')).href));
const context=vm.createContext({console,URL,performance:{now:()=>now},window:{innerWidth:1080,innerHeight:1920,addEventListener(){}},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)}});
vm.runInContext(source,context);
const camera=new THREE.PerspectiveCamera(45,9/16,.1,100);
for(const head of [{x:0,y:0,z:1},{x:.8,y:.4,z:.62},{x:-.8,y:-.4,z:1.55}]){
  context.applyOffAxisProjection(camera,head);camera.updateMatrixWorld(true);
  for(const [x,y]of [[-.9,-1.6],[.9,-1.6],[-.9,1.6],[.9,1.6]]){
    const point=new THREE.Vector3(x,y,0).project(camera);
    assert(Math.abs(point.x-Math.sign(x))<1e-8&&Math.abs(point.y-Math.sign(y))<1e-8,'Physical screen corner drifted with head motion');
  }
}
context.applyOffAxisProjection(camera,{x:0,y:0,z:1});camera.updateMatrixWorld(true);const neutral=camera.projectionMatrix.clone();
context.applyFlatProjection(camera,9/16);camera.updateMatrixWorld(true);
for(let i=0;i<16;i++)assert(Math.abs(camera.projectionMatrix.elements[i]-neutral.elements[i])<1e-9,'2D/3D toggle changed the neutral window scale');
context.applyOffAxisProjection(camera,{x:0,y:0,z:1});camera.updateMatrixWorld(true);const center=new THREE.Vector3(0,0,-1).project(camera).x;
context.applyOffAxisProjection(camera,{x:.5,y:0,z:1});camera.updateMatrixWorld(true);const projected=new THREE.Vector3(0,0,-1).project(camera).x;
assert(Math.abs(projected-(.5*1.8*.42)/(3.1+1)/.9)<1e-8&&projected!==center,'Distant scene did not match the eye-to-window ray intersection');
vm.runInContext(`status.cameraActive=true;status.faceDetected=true;latestLandmarks=Array(468).fill({x:.5,y:.5});lastFaceAt=5000;currentDeviceId='fixture-camera';`,context);
const sample=(moving=false,duration=2000)=>Array.from({length:25},(_,i)=>({x:.5+(moving?i*.003:0),y:.47,eyeDistance:.14,at:now-duration+i*duration/24}));
context.fixture=sample(false,300);vm.runInContext('calibrationSamples.splice(0,calibrationSamples.length,...fixture)',context);assert.equal(context.calibrateDepth(),false,'Short sample passed calibration');
context.fixture=sample(true);vm.runInContext('calibrationSamples.splice(0,calibrationSamples.length,...fixture)',context);assert.equal(context.calibrateDepth(),false,'Moving head passed calibration');
context.fixture=sample();vm.runInContext('calibrationSamples.splice(0,calibrationSamples.length,...fixture)',context);assert.equal(context.calibrateDepth(),true);
assert(storage.get('mirror.depth-calibration.v2').includes('fixture-camera:top'));
context.setTrackingOptions({mount:'center'});assert.equal(context.getTrackingStatus().calibrated,false,'Top-camera baseline leaked into center mounting');
context.setTrackingOptions({mount:'top'});assert.equal(context.getTrackingStatus().calibrated,true,'Mount-specific saved calibration was not restored');
now=7000;assert.equal(context.calibrateDepth(),false,'Stale face tracking passed calibration');
const simulate=(fps)=>{
  vm.runInContext('status.cameraActive=false;status.ready=false;status.faceDetected=false;mouseX=1;mouseY=.5;lastHeadUpdateAt=1;currentHead.x=0;currentHead.y=0;currentHead.z=1;',context);
  for(let i=1;i<=fps;i++)context.updateHeadTracking(1+i*1000/fps);
  return context.getHeadPosition().x;
};
assert(Math.abs(simulate(30)-simulate(60))<1e-8,'Smoothing changed with rendering frame rate');
vm.runInContext('status.cameraActive=true;status.ready=true;status.faceDetected=false;lastFaceAt=0;currentHead.x=0;currentHead.y=0;',context);
context.updateHeadTracking(8000);assert.equal(context.getHeadPosition().x,0,'Lost face jumped to the last pointer position');
console.log('Depth geometry passed: fixed screen corners, parallax direction, matched 2D/3D scale, stable timed calibration, camera-mount isolation, and stale-face rejection. Physical camera alignment remains unverified.');
