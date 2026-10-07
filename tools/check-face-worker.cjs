const {app,BrowserWindow}=require('electron');const fs=require('fs/promises');const path=require('path');const {pathToFileURL}=require('url');const assert=require('assert/strict');
app.disableHardwareAcceleration();const root=path.resolve(__dirname,'..');
app.whenReady().then(async()=>{
  const directory=path.join(root,'artifacts/face-tracking');await fs.mkdir(directory,{recursive:true});
  const response=await fetch('https://storage.googleapis.com/mediapipe-assets/portrait.jpg');assert(response.ok,'Google face fixture unavailable');
  const encoded='data:image/jpeg;base64,'+Buffer.from(await response.arrayBuffer()).toString('base64');
  const fixture=path.join(directory,'fixture.html');await fs.writeFile(fixture,'<!doctype html><video muted autoplay playsinline></video>');
  const win=new BrowserWindow({width:540,height:960,show:false,webPreferences:{partition:`face-worker-${process.pid}`,offscreen:true,contextIsolation:true,nodeIntegration:false}});
  try{
    await win.loadFile(fixture);
    win.webContents.session.enableNetworkEmulation({offline:true}); // Fixtures were downloaded above; workers must now initialize offline.
    const evidence=await win.webContents.executeJavaScript(`(async()=>{
      const head=await import(${JSON.stringify(pathToFileURL(path.join(root,'src/headTracking.js')).href)});
      const image=new Image();image.src=${JSON.stringify(encoded)};await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
      const source=canvas.captureStream(30);const tracks=[];
      navigator.mediaDevices.getUserMedia=async()=>{const clone=source.clone();tracks.push(...clone.getTracks());return clone};navigator.mediaDevices.enumerateDevices=async()=>[];
      const video=document.querySelector('video');let previous=performance.now(),maxGapMs=0,beats=0;
      const heartbeat=setInterval(()=>{const now=performance.now();maxGapMs=Math.max(maxGapMs,now-previous);previous=now;beats++},25);
      const repaint=setInterval(()=>ctx.drawImage(image,0,0),33);
      try{
        if(!await head.initHeadTracking(video))throw new Error('Synthetic camera did not start');
        const started=performance.now();
        while(!head.getTrackingStatus().faceDetected){if(performance.now()-started>30000)throw new Error('No fresh face result: '+JSON.stringify(head.getTrackingStatus()));head.updateHeadTracking(performance.now());await new Promise(resolve=>setTimeout(resolve,20));}
        head.updateHeadTracking(performance.now());
        const landmarks=head.getFaceLandmarks(),matrix=head.getFaceMatrix(),shapes=head.getFaceBlendshapes();
        const result={runtime:'Electron worker through production head tracking',input:'Google public portrait through synthetic camera',landmarks:landmarks.length,matrixValues:matrix.length,blendshapes:Object.keys(shapes).length,head:{...head.getHeadPosition()},inferenceMs:head.getTrackingStatus().lastInferenceMs,frameAgeMs:head.getTrackingStatus().frameAgeMs,heartbeatCount:beats,maxHeartbeatGapMs:maxGapMs};
        video.srcObject.getVideoTracks()[0].dispatchEvent(new Event('ended'));head.updateHeadTracking(performance.now());
        if(head.getFaceLandmarks()||head.getTrackingStatus().faceDetected||tracks.some(track=>track.readyState==='live'))throw new Error('Camera off retained tracking or camera tracks');
        if(head.getTrackingStatus().cameraActive||video.srcObject||!head.getTrackingStatus().error.includes('disconnected'))throw new Error('Camera disconnection retained an active preview');
        result.cameraDisconnected='synthetic ended event; tracking cleared; tracks closed';return result;
      }finally{head.stopCamera();clearInterval(heartbeat);clearInterval(repaint);source.getTracks().forEach(track=>track.stop())}
    })()`);
    assert(evidence.landmarks>=468);assert.equal(evidence.matrixValues,16);assert(evidence.blendshapes>=50);assert(Math.abs(evidence.head.x)+Math.abs(evidence.head.y)+Math.abs(evidence.head.z-1)>.001,'Worker face did not drive the virtual viewer');assert(evidence.frameAgeMs<=300);assert(evidence.heartbeatCount>5);
    await fs.writeFile(path.join(directory,'result.json'),JSON.stringify(evidence,null,2)+'\n');console.log('Actual face worker passed:',JSON.stringify(evidence));
  }finally{win.destroy()}
}).then(()=>app.quit()).catch(error=>{console.error(error);app.exit(1)});
