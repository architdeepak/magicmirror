// Actual renderer/camera ownership with deferred permission and real canvas tracks.
const fs=require('fs/promises'),path=require('path'),os=require('os'),assert=require('assert/strict'),{createHash}=require('crypto');
const {spawn}=require('child_process'),{connect}=require('./cdp-client.cjs');
const root=path.resolve(__dirname,'..'),delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'mirror-photo-camera-'));
 const label='live-camera',out=path.join(root,'artifacts',label);await fs.mkdir(out,{recursive:true});
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
  for(const action of ['stop-permission','stop-stream','mute-stream','off-stream']){
   if(await client.evaluate('__mirrorDebug.getMirrorState().voice.hardMuted'))await client.evaluate('document.querySelector("#mute-btn").click()');
   await client.evaluate(`(async()=>{const {toggleCamera}=await import('./headTracking.js');await toggleCamera(false);window.__cameraJobs=[];window.__cameraTracks=[];navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>__cameraJobs.push(resolve));window.__releaseCamera=()=>{const c=document.createElement('canvas');c.width=640;c.height=480;c.getContext('2d').fillRect(0,0,640,480);const s=c.captureStream(1);__cameraTracks.push(...s.getTracks());__cameraJobs.shift()(s)};const g=__mirrorDebug.gemini;g.connected=true;g.listening=true;g.intentionalDisconnect=false;g.playbackSuppressed=false;window.__voiceResponses=[];g._send=p=>{if(p.toolResponse)__voiceResponses.push(p)};window.__cameraDone=false;void g._handleMessage(JSON.stringify({toolCall:{functionCalls:[{id:'start-'+${JSON.stringify(action)},name:'control_camera',args:{enabled:true}}]}})).then(()=>__cameraDone=true)})()`);
   await until(()=>client.evaluate('__cameraJobs.length===1'));
   if(action.endsWith('stream')){await client.evaluate('__releaseCamera()');await until(()=>client.evaluate('__cameraJobs.length===1'))}
   if(action.startsWith('stop'))await client.evaluate('__mirrorDebug.stopAssistant()');
   else if(action.startsWith('mute'))await client.evaluate('document.querySelector("#mute-btn").click()');
   else {await client.evaluate(`__mirrorDebug.gemini._handleMessage(JSON.stringify({toolCall:{functionCalls:[{id:'off-now',name:'control_camera',args:{enabled:false}}]}}))`);assert.equal(await client.evaluate('__voiceResponses.length'),1,'Off stayed behind permission');}
   await until(()=>client.evaluate('__cameraDone'));await client.evaluate('__releaseCamera()');await delay(300);
   const row=await client.evaluate(`({action:${JSON.stringify(action)},pending:__cameraJobs.length,camera:__mirrorDebug.getMirrorState().camera,liveTracks:__cameraTracks.filter(t=>t.readyState==='live').length,responses:__voiceResponses})`);assert.equal(row.pending,0);assert.equal(row.liveTracks,0);assert.equal(row.camera.active,false);assert.equal(row.responses.length,action.startsWith('off')?1:0);results.push(row);
  }
  if(await client.evaluate('__mirrorDebug.getMirrorState().voice.hardMuted'))await client.evaluate('document.querySelector("#mute-btn").click()');
  const stable=await client.evaluate(`(async()=>{window.__stableTracks=[];navigator.mediaDevices.getUserMedia=async()=>{const c=document.createElement('canvas');c.width=640;c.height=480;c.getContext('2d').fillRect(0,0,640,480);const s=c.captureStream(1);__stableTracks.push(...s.getTracks());return s};const g=__mirrorDebug.gemini;g.connected=true;g.listening=true;g.intentionalDisconnect=false;g.playbackSuppressed=false;__voiceResponses=[];const call=enabled=>g._handleMessage(JSON.stringify({toolCall:{functionCalls:[{id:enabled?'completed-on':'completed-off',name:'control_camera',args:{enabled}}]}}));await call(true);const on=__mirrorDebug.getMirrorState().camera.active,original=document.querySelector('#camera-feed').srcObject;g.stopPlayback();const preserved=original.active;g.playbackSuppressed=false;await call(false);const off=!__mirrorDebug.getMirrorState().camera.active,released=__stableTracks.every(t=>t.readyState==='ended');await call(true);return{on,preserved,off,released,duplicate:__voiceResponses.at(-1),streamCount:__stableTracks.length}})()`);assert(stable.on&&stable.preserved&&stable.off&&stable.released);assert.equal(stable.duplicate.toolResponse.functionResponses[0].response.camera.active,false);assert(stable.duplicate.toolResponse.functionResponses[0].response.replayed);assert(await client.evaluate('__stableTracks.every(t=>t.readyState==="ended")'));
  const report={passed:true,archiveSha256,results,stable,scope:'Actual packaged Linux live-adapter toolCall JSON parsing/queue and real canvas MediaStream tracks/deferred permission. No provider connection, acoustic commands, physical camera or Windows proof.'};await fs.writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));

 }finally{client?.close();child.kill('SIGTERM');await delay(200);if(!exited)child.kill('SIGKILL');await fs.rm(profile,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
