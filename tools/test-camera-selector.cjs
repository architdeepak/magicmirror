const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('src/renderer.js','utf8');
(async()=>{
 const jobs=[];let updates=0;const tracking={activeCameraId:'second',activeCameraLabel:'Webcam'};
 const scope=vm.createContext({cameraListGeneration:0,getCameraDevices:()=>new Promise((resolve,reject)=>jobs.push({resolve,reject})),getTrackingStatus:()=>tracking,elements:{cameraSelect:{value:'first',innerHTML:''},cameraNotice:{}},escapeHtml:value=>value,updateTrackingUi:()=>updates++});
 vm.runInContext(source.slice(source.indexOf('async function populateCameras()'),source.indexOf('function updateTrackingUi()')),scope);
 const older=scope.populateCameras(),newer=scope.populateCameras();
 jobs[1].resolve([{deviceId:'first',label:'Webcam'},{deviceId:'second',label:'Webcam'}]);await newer;
 assert.equal(scope.elements.cameraSelect.value,'second','Duplicate camera label selected wrong device');const options=scope.elements.cameraSelect.innerHTML;
 jobs[0].resolve([{deviceId:'stale',label:'Old camera'}]);await older;assert.equal(scope.elements.cameraSelect.innerHTML,options);assert.equal(updates,1);
 const failed=scope.populateCameras();jobs[2].reject(Error('Permission denied'));await failed;assert.equal(scope.elements.cameraSelect.innerHTML,options);assert.equal(scope.elements.cameraNotice.hidden,false);
 const staleFailure=scope.populateCameras(),current=scope.populateCameras();scope.elements.cameraNotice.hidden=true;
 jobs[3].reject(Error('Old failure'));await staleFailure;assert.equal(scope.elements.cameraNotice.hidden,true);
 tracking.activeCameraId='first';jobs[4].resolve([{deviceId:'first',label:'Webcam'}]);await current;assert.equal(scope.elements.cameraSelect.value,'first');
 console.log('Camera selector: latest list ownership, identical labels use active ID, changed active camera and current/stale enumeration failures passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
