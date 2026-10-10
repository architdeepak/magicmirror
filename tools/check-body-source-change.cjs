// Real browser stream renegotiation and packaged offline tracking worker.
// Recorded input does not qualify physical camera firmware or garment realism.
const {app,BrowserWindow}=require('electron');
const fs=require('fs/promises'),path=require('path'),os=require('os'),assert=require('assert/strict');
const rawFs=require('original-fs').promises;
const {createHash}=require('crypto'),{pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..');app.disableHardwareAcceleration();
let completed=false;
app.on('window-all-closed',()=>{});
app.on('will-quit',()=>{if(!completed){console.error('Probe exited before writing verification');process.exitCode=1}});
app.whenReady().then(async()=>{
 const out=path.join(root,'artifacts/body-source-change');await fs.mkdir(out,{recursive:true});
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'mirror-body-source-'));
 const fixture=path.join(temp,'fixture.html');await fs.writeFile(fixture,'<video muted autoplay playsinline></video>');
 const archive=process.env.MIRROR_SOURCE_CHANGE_ARCHIVE||path.join(root,`dist/linux-${process.arch}-unpacked/resources/app.asar`);
 const win=new BrowserWindow({show:false,webPreferences:{offscreen:true,contextIsolation:true,nodeIntegration:false}});
 win.webContents.on('console-message',(_event,_level,message)=>console.log('[renderer]',message));
 win.webContents.on('render-process-gone',(_event,details)=>{console.error('Renderer exited',details);app.exit(1)});
 const watchdog=setTimeout(()=>{console.error('Source change probe timed out');app.exit(1)},90000);
 try{
  await win.loadFile(fixture);win.webContents.session.enableNetworkEmulation({offline:true});
  const result=await win.webContents.executeJavaScript(`(async()=>{
   console.log('Loading packaged tracker');
   const {BodyTracking}=await import(${JSON.stringify(pathToFileURL(path.join(archive,'src/bodyTracking.js')).href)});
   const source=document.createElement('video');source.muted=true;source.loop=true;source.src=${JSON.stringify(pathToFileURL(path.join(root,'artifacts/rtv/sample_video2.mp4')).href)};await source.play();
   const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
   const draw=()=>canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);draw();
   const pump=setInterval(draw,33),stream=canvas.captureStream(30),video=document.querySelector('video');video.srcObject=stream;await video.play();
   const tracker=new BodyTracking(video);tracker.setEnabled(true);
   const until=async(fn,label)=>{const start=performance.now();while(!fn()){if(performance.now()-start>40000)throw Error(label+' timed out');await new Promise(r=>setTimeout(r,25))}};
   const waitFrame=async()=>until(()=>{tracker.update();return Boolean(tracker.getCameraFrame())},'tracked frame');
   const snapshot=()=>({video:[video.videoWidth,video.videoHeight],frame:tracker.getCameraFrame()?[tracker.getCameraFrame().width,tracker.getCameraFrame().height]:null,pose:Boolean(tracker.getPose()),epoch:tracker.epoch});
   try{
    await waitFrame();const before=snapshot(),oldFrame=tracker.getCameraFrame();console.log('Tracked landscape',JSON.stringify(before));
    canvas.width=720;canvas.height=1280;draw();
    await until(()=>video.videoWidth===720&&video.videoHeight===1280,'actual stream format change');
    const rejected={pose:tracker.getPose()===null,world:tracker.getWorldPose()===null,mask:tracker.getSegmentation()===null,frame:tracker.getCameraFrame()===null};
    if(Object.values(rejected).some(v=>!v))throw Error('Old format exposed before tracker update: '+JSON.stringify(rejected));
    tracker.update();const oldFrameClosed=oldFrame.width===0;
    if(!oldFrameClosed)throw Error('Old camera bitmap retained after format change');
    await waitFrame();const after=snapshot();
    if(after.frame[0]!==720||after.frame[1]!==1280||after.epoch<=before.epoch)throw Error('New portrait packet did not match the bounded camera source: '+JSON.stringify(after));
    const retained=tracker.getCameraFrame();stream.getTracks().forEach(t=>t.stop());await until(()=>!stream.active,'stream stop');
    if(tracker.getCameraFrame()||tracker.getPose()||tracker.getWorldPose()||tracker.getSegmentation())throw Error('Stopped stream exposed tracking data');
    tracker.update();const stoppedFrameClosed=retained.width===0;if(!stoppedFrameClosed)throw Error('Stopped stream retained bitmap');
    return {before,rejected,after,oldFrameClosed,stoppedFrameClosed,workerReady:tracker.ready};
   }finally{clearInterval(pump);source.pause();tracker.destroy();stream.getTracks().forEach(t=>t.stop())}
  })()`);
  assert(result.oldFrameClosed&&result.stoppedFrameClosed);
  const hash=b=>createHash('sha256').update(b).digest('hex');
  const report={status:'passed',checkedAt:new Date().toISOString(),archiveSha256:hash(await rawFs.readFile(archive)),fixtureSha256:hash(await fs.readFile(path.join(root,'artifacts/rtv/sample_video2.mp4'))),scope:'Packaged BodyTracking module and actual offline MediaPipe worker in Electron software graphics; recorded video through a real canvas MediaStream changing landscape to portrait without replacing the stream.',result,limits:['No physical camera format negotiation or garment fit quality measured. Portrait phase deliberately changes the recorded image aspect ratio to test source ownership.']};
  await fs.writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));completed=true;
 }finally{clearTimeout(watchdog);win.destroy();await fs.rm(temp,{recursive:true,force:true})}
}).then(()=>app.quit()).catch(error=>{console.error(error);app.exit(1)});
