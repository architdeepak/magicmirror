const {app,BrowserWindow}=require('electron');const fs=require('fs/promises');const path=require('path');const {pathToFileURL}=require('url');const assert=require('assert/strict');
app.disableHardwareAcceleration();
const root=path.resolve(__dirname,'..');
app.whenReady().then(async()=>{
  const directory=path.join(root,'artifacts/hand-tracking');await fs.mkdir(directory,{recursive:true});
  const response=await fetch('https://storage.googleapis.com/mediapipe-assets/right_hands.jpg');assert(response.ok,'Google hand fixture unavailable');
  const image='data:image/jpeg;base64,'+Buffer.from(await response.arrayBuffer()).toString('base64');
  const fixture=path.join(directory,'fixture.html');await fs.writeFile(fixture,'<!doctype html><video muted autoplay playsinline></video>');
  const win=new BrowserWindow({width:540,height:960,show:false,webPreferences:{offscreen:true,contextIsolation:true,nodeIntegration:false}});
  try{
    await win.loadFile(fixture);
    win.webContents.session.enableNetworkEmulation({offline:true}); // Fixtures were downloaded above; workers must now initialize offline.
    const evidence=await win.webContents.executeJavaScript(`(async()=>{
      const {GestureNavigation}=await import(${JSON.stringify(pathToFileURL(path.join(root,'src/gestureNavigation.js')).href)});
      const image=new Image();image.src=${JSON.stringify(image)};await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
      const video=document.querySelector('video');const stream=canvas.captureStream(15);video.srcObject=stream;await video.play();
      let heartbeatAt=performance.now(),maxGapMs=0,beats=0;const heartbeat=setInterval(()=>{const now=performance.now();maxGapMs=Math.max(maxGapMs,now-heartbeatAt);heartbeatAt=now;beats++},25);
      const repaint=setInterval(()=>ctx.drawImage(image,0,0),70);const results=[];
      const actions=[];const gesture=new GestureNavigation(video,type=>actions.push(type));const tracker=gesture.tracker;
      const consume=tracker.onHand;tracker.onHand=(hand,timestamp)=>{results.push({landmarks:hand?.length||0,timestamp,receivedAt:performance.now()});consume(hand,timestamp)};
      try{
        if(!await gesture.init())throw new Error('Actual hand worker initialization failed');
        gesture.setEnabled(true);const started=performance.now();
        while(!actions.includes('palm')){
          if(performance.now()-started>30000)throw new Error('No held-palm action from actual hand photo: '+JSON.stringify({results,actions}));
          gesture.update(performance.now());await new Promise(resolve=>setTimeout(resolve,30));
        }
        const holdUntil=performance.now()+1000;while(performance.now()<holdUntil){gesture.update(performance.now());await new Promise(resolve=>setTimeout(resolve,30));}
        const accepted=results.find(result=>result.landmarks===21);gesture.setEnabled(false);
        return{runtime:'Electron worker',input:'Google public hand photo through synthetic camera stream',landmarks:accepted.landmarks,actions,delegate:tracker.delegate,warmInferenceMs:tracker.inferenceMs,resultAgeMs:accepted.receivedAt-accepted.timestamp,heartbeatCount:beats,maxHeartbeatGapMs:maxGapMs,rejectedColdFrames:results.filter(result=>result.landmarks===0).length};
      }finally{gesture.destroy();clearInterval(heartbeat);clearInterval(repaint);stream.getTracks().forEach(track=>track.stop());video.srcObject=null;}
    })()`);
    assert.equal(evidence.landmarks,21);assert.deepEqual(evidence.actions,['palm']);assert(evidence.resultAgeMs<=350,'Gesture frame was accepted past its freshness limit');assert(evidence.heartbeatCount>10,'UI heartbeat did not advance during model work');
    await fs.writeFile(path.join(directory,'result.json'),JSON.stringify(evidence,null,2)+'\n');console.log('Actual hand worker passed:',JSON.stringify(evidence));
  }finally{win.destroy()}
}).then(()=>app.quit()).catch(error=>{console.error(error);app.exit(1)});
