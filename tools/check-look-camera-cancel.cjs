// Actual renderer/camera ownership with deferred permission and real canvas tracks.
const fs=require('fs/promises'),path=require('path'),os=require('os'),assert=require('assert/strict'),{createHash}=require('crypto');
const {spawn}=require('child_process'),{connect}=require('./cdp-client.cjs');
const root=path.resolve(__dirname,'..'),delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'mirror-photo-camera-'));
 const label=process.env.MIRROR_LOOK_CANCEL_LABEL||'look-camera-cancel',out=path.join(root,'artifacts',label);await fs.mkdir(out,{recursive:true});
 const build=process.env.MIRROR_PHOTO_CANCEL_BUILD||path.join(root,`dist/linux-${process.arch}-unpacked`);
 const archiveSha256=createHash('sha256').update(await fs.readFile(path.join(build,'resources/app.asar'))).digest('hex');
 const child=spawn(path.join(build,'magic-mirror-portal'),['--no-sandbox','--disable-gpu',`--user-data-dir=${profile}`,'--remote-debugging-port=0'],{cwd:profile,env:{...process.env,GEMINI_API_KEY:'',DECART_API_KEY:'',MIRROR_KIOSK:'false'},stdio:['ignore','pipe','pipe']});
 let logs='',client,exited=false;child.on('exit',()=>exited=true);for(const stream of[child.stdout,child.stderr])stream.on('data',b=>logs=(logs+b).slice(-8000));
 const until=async(fn)=>{for(let i=0;i<450;i++){if(exited)throw Error('App exited');const r=await fn();if(r)return r;await delay(100)}throw Error('Camera fixture timed out '+logs.slice(-800))};
 try{
  const endpoint=await until(()=>logs.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/)?.[1]);
  const target=await until(async()=>(await fetch('http://'+new URL(endpoint).host+'/json/list').then(r=>r.json())).find(t=>t.url.includes('app.asar/src/index.html')));
  client=await connect(target.webSocketDebuggerUrl);await client.call('Page.enable');
  await client.call('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('mirror.hard-muted','true');localStorage.setItem('mirror.wake','false');localStorage.setItem('mirror.gestures','false');navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Fixture has no physical camera','NotAllowedError')};window.__photoCancelFixture=true;`});await client.call('Page.reload');
  await until(()=>client.evaluate('window.__photoCancelFixture&&window.__mirrorDebug&&document.querySelector("#loader").classList.contains("done")'));
  await client.evaluate('__mirrorDebug.gemini.onWardrobe({command:"next garment"})');
  const results=[];
  for(const action of (process.env.MIRROR_LOOK_BASELINE==='true'?['stop','mute']:['stop','mute','off'])){
   if(await client.evaluate('document.querySelector("#mute-btn").getAttribute("aria-pressed")==="true"'))await client.evaluate('document.querySelector("#mute-btn").click()');
   await client.evaluate(`(async()=>{const {toggleCamera}=await import('./headTracking.js');await toggleCamera(false);window.__cameraJobs=[];window.__cameraTracks=[];navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>__cameraJobs.push(resolve));window.__releaseCamera=()=>{const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;canvas.getContext('2d').fillRect(0,0,640,480);const stream=canvas.captureStream(1);__cameraTracks.push(...stream.getTracks());__cameraJobs.shift()(stream)};window.__lookCaptureDone=false;void __mirrorDebug.experience.capture().then(()=>__lookCaptureDone=true);})()`);
   await until(()=>client.evaluate('__cameraJobs.length===1'));
   if(action==='stop')await client.evaluate('__mirrorDebug.stopAssistant()');
   else if(action==='mute')await client.evaluate('document.querySelector("#mute-btn").click()');
   else await client.evaluate('__mirrorDebug.gemini.onCameraControl(false)');
   const immediateHidden=await client.evaluate('document.querySelector("#look-countdown").hidden');
   await client.evaluate('__releaseCamera()');await delay(500);
   // A broken baseline opens another stream after the canceled permission probe.
   if(await client.evaluate('__cameraJobs.length')){await client.evaluate('__releaseCamera()');await delay(500);}
   const row=await client.evaluate(`({action:${JSON.stringify(action)},pending:__cameraJobs.length,cameraActive:!!document.querySelector('#camera-feed').srcObject?.active,liveTracks:__cameraTracks.filter(t=>t.readyState==='live').length,capturing:__mirrorDebug.experience.capturing,countdownHidden:document.querySelector('#look-countdown').hidden,done:__lookCaptureDone})`);row.immediateHidden=immediateHidden;results.push(row);
   await client.evaluate('(async()=>{const {toggleCamera}=await import("./headTracking.js");await toggleCamera(false);__mirrorDebug.gemini.onWardrobe({command:"cancel photo"})})()');
  }
  const result={archiveSha256,results,passed:results.every(r=>!r.cameraActive&&r.liveTracks===0&&r.pending===0&&!r.capturing&&r.countdownHidden&&r.done&&r.immediateHidden),scope:'Actual packaged Linux lookbook capture, deferred browser permission and real canvas tracks. No physical camera or acoustic commands.'};await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(process.env.MIRROR_LOOK_BASELINE!=='true')assert(result.passed,'Cancelled look startup retained camera or countdown');

 }finally{client?.close();child.kill('SIGTERM');await delay(200);if(!exited)child.kill('SIGKILL');await fs.rm(profile,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
