// Recorded human motion through the real offline pose/segmentation worker.
// Does not replace physical camera or clothing fit validation.
const {app,BrowserWindow}=require('electron');const fs=require('fs/promises'),path=require('path'),assert=require('assert/strict');const {pathToFileURL}=require('url');
app.disableHardwareAcceleration();const root=path.resolve(__dirname,'..');
app.whenReady().then(async()=>{
 const dir=path.join(root,'artifacts/photo-fit-motion');await fs.mkdir(dir,{recursive:true});
 const fixture=path.join(dir,'fixture.html');await fs.writeFile(fixture,'<style>body{margin:0}#stage{position:relative;width:540px;height:960px}#camera,canvas.overlay{position:absolute;inset:0;width:100%;height:100%}#camera{object-fit:cover;transform:scaleX(-1)}</style><div id="stage"><video id="camera" muted autoplay playsinline></video><canvas class="overlay"></canvas></div>');
 const win=new BrowserWindow({width:540,height:960,show:false,webPreferences:{offscreen:true,contextIsolation:true,nodeIntegration:false}});
 try{
  await win.loadFile(fixture);win.webContents.session.enableNetworkEmulation({offline:true});
  const result=await win.webContents.executeJavaScript(`(async()=>{
   const {GarmentOverlay}=await import(${JSON.stringify(pathToFileURL(path.join(root,'src/garmentOverlay.js')).href)});
   const {buildGarmentMesh,drawTexturedTriangle}=await import(${JSON.stringify(pathToFileURL(path.join(root,'src/garmentGeometry.js')).href)});
   const source=document.createElement('video');source.muted=true;source.loop=true;source.src=${JSON.stringify(pathToFileURL(path.join(root,'artifacts/rtv/sample_video2.mp4')).href)};await source.play();
   const canvas=document.createElement('canvas');canvas.width=source.videoWidth;canvas.height=source.videoHeight;const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0);
   const stream=canvas.captureStream(30),camera=document.querySelector('#camera');camera.srcObject=stream;await camera.play();
   const overlay=new GarmentOverlay(document.querySelector('.overlay'),camera);await overlay.select({id:'motion-photo',name:'Photo polo',category:'top',imageUrl:${JSON.stringify(pathToFileURL(path.join(root,'.tools/rtv/assets/garment_images/lab_06_white_bg.jpg')).href)}});
   if(!overlay.texture?.photoPattern)throw new Error('Photo sleeve pattern missing');overlay.setEnabled(true);
   let blank=false,visible=0,ticks=0,beats=0,previousBeat=performance.now(),maxBeatGap=0,lastPose=0;const samples=[],shots=[],inferences=[];
   const pump=setInterval(()=>{if(blank){ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height)}else ctx.drawImage(source,0,0)},33);
   const heartbeat=setInterval(()=>{const now=performance.now();maxBeatGap=Math.max(maxBeatGap,now-previousBeat);previousBeat=now;beats++},25);
   const draw=setInterval(()=>{overlay.render();ticks++;if(overlay.getLiveState().visible)visible++;if(overlay.tracker.lastPoseAt!==lastPose){lastPose=overlay.tracker.lastPoseAt;inferences.push(overlay.tracker.inferenceMs||0)}},33);
   try{
    const start=performance.now();while(!overlay.getLiveState().visible){if(performance.now()-start>30000)throw new Error('No live photo fit: '+overlay.getLiveState().status);await new Promise(r=>setTimeout(r,50))}
    const warm=performance.now();ticks=0;visible=0;for(let second=0;second<20;second++){
     overlay.setCameraClarity(second < 7 ? 'natural' : second < 14 ? 'bright' : 'off');await new Promise(r=>setTimeout(r,1000));const pose=overlay.tracker.getPose();samples.push({second,visible:overlay.getLiveState().visible,poseAgeMs:overlay.getLiveState().frameAgeMs,shoulderX:pose?.[11]?.x,elbowX:pose?.[13]?.x,worldLandmarks:overlay.tracker.getWorldPose()?.length||0,curvedTorso:overlay.getLiveState().curvedTorso,cameraClarity:overlay.getLiveState().cameraClarity,clarityCostMs:overlay.getLiveState().clarityCostMs,inferenceMs:overlay.tracker.inferenceMs,status:overlay.getLiveState().status});
     if([1,6,12,18].includes(second)){
      overlay.render();
      const out=document.createElement('canvas');out.width=540;out.height=960;const c=out.getContext('2d');const cover=Math.max(540/canvas.width,960/canvas.height),w=canvas.width*cover,h=canvas.height*cover;
      c.save();c.translate(540,0);c.scale(-1,1);c.drawImage(camera,(540-w)/2,(960-h)/2,w,h);c.restore();if(overlay.cameraCanvas?.style.display==='block')c.drawImage(overlay.cameraCanvas,0,0,540,960);
      const background=out.toDataURL();
      const flat=document.createElement('canvas');flat.width=540;flat.height=960;const fc=flat.getContext('2d');fc.drawImage(out,0,0);
      const layer=document.createElement('canvas');layer.width=540;layer.height=960;const lc=layer.getContext('2d'),currentPose=overlay.tracker.getPose(),mask=overlay.tracker.getSegmentation();
      const flatMesh=buildGarmentMesh(currentPose,{width:camera.videoWidth,height:camera.videoHeight},{width:540,height:960},'top',{...overlay.fit,photoPattern:overlay.texture.photoPattern});
      if(flatMesh){for(const triangle of flatMesh)drawTexturedTriangle(lc,overlay.texture,triangle);if(!overlay.occlusion.erase(lc,mask,currentPose,{width:camera.videoWidth,height:camera.videoHeight},{width:540,height:960}))GarmentOverlay.prototype._occludeForearms.call({ctx:lc,video:camera,viewport:{width:540,height:960}},currentPose);}
      fc.drawImage(layer,0,0);c.drawImage(overlay.canvas,0,0,540,960);
      const pair=document.createElement('canvas');pair.width=1080;pair.height=960;const pc=pair.getContext('2d');pc.drawImage(flat,0,0);pc.drawImage(out,540,0);pc.font='20px sans-serif';pc.fillStyle='black';pc.fillText('Flat photo front',18,28);pc.fillText('Curved photo front',558,28);
      shots.push({second,png:out.toDataURL(),comparison:pair.toDataURL(),background,replay:{pose:currentPose?.map(p=>({...p})),worldPose:overlay.tracker.getWorldPose()?.map(p=>({...p})),segmentation:mask?{width:mask.width,height:mask.height,classes:Array.from(mask.classes)}:null,fit:{...overlay.fit,normalHistory:{...overlay.sleeveNormalHistory}},video:{width:camera.videoWidth,height:camera.videoHeight},viewport:{width:540,height:960},cameraClarity:overlay.getLiveState().cameraClarity,frameAt:overlay.tracker.lastPoseAt,source:'Recorded public motion; saved camera projection and pose/mask from current tracker packet.'}});
     }
    }
    const trackingTicks=ticks,visibleTrackingTicks=visible;
    blank=true;await new Promise(r=>setTimeout(r,1800));overlay.render();const lost=overlay.getLiveState();
    if(lost.visible)throw new Error('Blank camera left the garment visible');
    stream.getTracks().forEach(t=>t.stop());camera.srcObject=null;overlay.render();if(overlay.getLiveState().visible)throw new Error('Camera-off left garment visible');
    return{scope:'Recorded public human motion through actual offline workers and camera stream, software graphics; no physical input or sizing accuracy validation.',inputWidth:canvas.width,inputHeight:canvas.height,seconds:(performance.now()-warm)/1000,trackingTicks,visibleTrackingTicks,ticks,visibleTicks:visible,beats,maxBeatGapMs:maxBeatGap,samples,inferences,shots,lossCleared:!lost.visible};
   }finally{clearInterval(pump);clearInterval(heartbeat);clearInterval(draw);source.pause();overlay.destroy();stream.getTracks().forEach(t=>t.stop())}
  })()`);
  for(const shot of result.shots){await fs.writeFile(path.join(dir,`camera-${shot.second}.png`),Buffer.from(shot.background.split(',')[1],'base64'));await fs.writeFile(path.join(dir,`replay-${shot.second}.json`),JSON.stringify(shot.replay));await fs.writeFile(path.join(dir,`second-${shot.second}.png`),Buffer.from(shot.png.split(',')[1],'base64'));await fs.writeFile(path.join(dir,`comparison-${shot.second}.png`),Buffer.from(shot.comparison.split(',')[1],'base64'));}
  delete result.shots;await fs.writeFile(path.join(dir,'result.json'),JSON.stringify(result,null,2));assert(result.visibleTrackingTicks/result.trackingTicks>.8,'Garment visible on fewer than 80% of the replay display ticks');assert(result.inferences.length>20);assert(result.samples.some(s=>s.worldLandmarks===33&&s.curvedTorso),'Actual world pose did not drive the curved torso');assert(result.lossCleared);console.log(JSON.stringify(result));
 }finally{win.destroy()}
}).then(()=>app.quit()).catch(error=>{console.error(error);app.exit(1)});
