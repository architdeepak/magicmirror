// Actual renderer/camera ownership with deferred permission and real canvas tracks.
const fs=require('fs/promises'),path=require('path'),os=require('os'),assert=require('assert/strict'),{createHash}=require('crypto');
const {spawn}=require('child_process'),{connect}=require('./cdp-client.cjs');
const root=path.resolve(__dirname,'..'),delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'mirror-photo-camera-'));
 const label=process.env.MIRROR_PHOTO_CANCEL_LABEL||'photo-camera-cancel',out=path.join(root,'artifacts',label);await fs.mkdir(out,{recursive:true});
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
  const results=[];
  for(const action of ['stop','mute','close']){
   if(action==='mute'&&await client.evaluate('document.querySelector("#mute-btn").getAttribute("aria-pressed")==="true"'))await client.evaluate('document.querySelector("#mute-btn").click()');
   await client.evaluate(`(async()=>{const {toggleCamera}=await import('./headTracking.js');await toggleCamera(false);window.__cameraJobs=[];window.__cameraTracks=[];navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>__cameraJobs.push(resolve));window.__releaseCamera=()=>{const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;canvas.getContext('2d').fillRect(0,0,640,480);const stream=canvas.captureStream(1);__cameraTracks.push(...stream.getTracks());__cameraJobs.shift()(stream)};__mirrorDebug.gemini.onWardrobe({command:'add garment'});void __mirrorDebug.gemini.onWardrobe({command:'take photo'});})()`);
   await until(()=>client.evaluate('__cameraJobs.length===1'));
   if(action==='stop')await client.evaluate('document.querySelector("#wardrobe-photo [data-voice-control=stop]").click()');
   else if(action==='mute')await client.evaluate('document.querySelector("#wardrobe-photo [data-voice-control=mute]").click()');
   else await client.evaluate('__mirrorDebug.gemini.onWardrobe({command:"cancel photo"})');
   await client.evaluate('__releaseCamera()');await delay(500);
   // A broken baseline opens another stream after the canceled permission probe.
   if(await client.evaluate('__cameraJobs.length')){await client.evaluate('__releaseCamera()');await delay(500);}
   const row=await client.evaluate(`({action:${JSON.stringify(action)},pending:__cameraJobs.length,cameraActive:!!document.querySelector('#camera-feed').srcObject?.active,liveTracks:__cameraTracks.filter(t=>t.readyState==='live').length,editorOpen:document.querySelector('#wardrobe-photo').open,status:document.querySelector('#wardrobe-photo [data-field=status]').textContent})`);results.push(row);
   await client.evaluate('(async()=>{const {toggleCamera}=await import("./headTracking.js");await toggleCamera(false);__mirrorDebug.gemini.onWardrobe({command:"cancel photo"})})()');
  }
  const activeCamera=await client.evaluate(`(async()=>{const {startCamera,toggleCamera}=await import('./headTracking.js');navigator.mediaDevices.getUserMedia=async()=>{const c=document.createElement('canvas');c.width=640;c.height=480;c.getContext('2d').fillRect(0,0,640,480);return c.captureStream(1)};await startCamera('fixture');const video=document.querySelector('#camera-feed');await new Promise(r=>setTimeout(r,150));const original=video.srcObject;__mirrorDebug.gemini.onWardrobe({command:'add garment'});void __mirrorDebug.gemini.onWardrobe({command:'take photo'});document.querySelector('#wardrobe-photo [data-voice-control=stop]').click();await new Promise(r=>setTimeout(r,150));const kept=video.srcObject===original&&original.active;await toggleCamera(false);__mirrorDebug.gemini.onWardrobe({command:'cancel photo'});return{keptExistingStream:kept,tracksReleasedAfterExplicitOff:original.getTracks().every(t=>t.readyState==='ended')}})()`);
  const result={archiveSha256,results,activeCamera,passed:results.every(r=>!r.cameraActive&&r.liveTracks===0&&r.pending===0)&&activeCamera.keptExistingStream&&activeCamera.tracksReleasedAfterExplicitOff,scope:'Actual packaged Linux renderer and head-tracking camera startup, real canvas MediaStream tracks, deferred permission; Stop/hard mute/editor close through production callbacks, plus existing-camera preservation. No physical camera or microphone recognition.'};
  await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  if(process.env.MIRROR_PHOTO_CANCEL_BASELINE!=='true')assert(result.passed,'Canceled photo startup left camera/track active');
 }finally{client?.close();child.kill('SIGTERM');await delay(200);if(!exited)child.kill('SIGKILL');await fs.rm(profile,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
