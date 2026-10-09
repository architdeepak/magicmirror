// Bounded local soak monitor. Temporary profile, no provider keys, no camera
// fixtures by default; optional recorded-camera workload. Logs metrics, never
// captions, credentials or screenshots of other apps.
const fs=require('fs/promises'),path=require('path'),os=require('os');
const {createReadStream}=require('fs'),{createHash}=require('crypto');
const {spawn,execFileSync,execFile}=require('child_process');const {promisify}=require('util');
const {connect}=require('./cdp-client.cjs');const run=promisify(execFile);
const root=path.resolve(__dirname,'..'),delay=ms=>new Promise(r=>setTimeout(r,ms));
const graphicsRequest=process.env.MIRROR_MONITOR_GRAPHICS==='vulkan'?'vulkan':'software';
const speechFixture=process.env.MIRROR_MONITOR_SPEECH==='true';
const cameraFixture=process.env.MIRROR_MONITOR_CAMERA==='true';
const clarityMode=process.env.MIRROR_MONITOR_CLARITY||'off';
if(!['off','natural','bright'].includes(clarityMode))throw Error('Use off, natural or bright camera clarity');
const cameraTools=require('./monitor-camera.cjs');
const phaseSeconds=Number(process.env.MIRROR_MONITOR_PHASE_SECONDS||(cameraFixture?120:240));
if(!Number.isFinite(phaseSeconds)||phaseSeconds<10||phaseSeconds>600)throw Error('Monitor phase duration must be 10–600 seconds');
const avatarStyle=process.env.MIRROR_MONITOR_AVATAR==='rig'?'rig':'portrait';
const seconds=Number(process.env.MIRROR_MONITOR_SECONDS||1800);
if(!Number.isFinite(seconds)||seconds<10||seconds>86400)throw new Error('Monitor duration must be 10–86400 seconds');
const hz=Number(execFileSync('getconf',['CLK_TCK'],{encoding:'utf8'}).trim());
const pageSize=Number(execFileSync('getconf',['PAGESIZE'],{encoding:'utf8'}).trim());
async function processTree(pid,output=[]){
 try{const raw=await fs.readFile(`/proc/${pid}/stat`,'utf8');const fields=raw.slice(raw.lastIndexOf(')')+2).trim().split(/\s+/);output.push({pid,ticks:Number(fields[11])+Number(fields[12]),rssBytes:Number(fields[21])*pageSize});
 const children=(await fs.readFile(`/proc/${pid}/task/${pid}/children`,'utf8')).trim().split(/\s+/).filter(Boolean).map(Number);for(const child of children)await processTree(child,output);
 }catch(error){if(!['ENOENT','ESRCH'].includes(error.code))throw error}return output;
}
(async()=>{
 const id=new Date().toISOString().replace(/[:.]/g,'-'),dir=path.join(root,'artifacts/monitor',id);await fs.mkdir(dir,{recursive:true});
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'mirror-monitor-'));
 const build=path.join(profile,'app'),sourceBuild=process.env.MIRROR_MONITOR_BUILD||path.join(root,`dist/linux-${process.arch}-unpacked`);
 try{await fs.cp(sourceBuild,build,{recursive:true})}catch(error){await fs.rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});throw error}
 const hash=createHash('sha256');for await(const chunk of createReadStream(path.join(build,'resources/app.asar')))hash.update(chunk);
 const fixtureHashes={};if(cameraFixture)for(const file of ['artifacts/rtv/sample_video2.mp4','.tools/rtv/assets/garment_images/lab_08_white_bg.jpg']){const h=createHash('sha256');for await(const bytes of createReadStream(path.join(root,file)))h.update(bytes);fixtureHashes[file]=h.digest('hex');}
 const monitorHashes={};for(const file of ['tools/monitor-mirror.cjs','tools/monitor-camera.cjs'])monitorHashes[file]=createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex');
 const buildInfo={archiveSha256:hash.digest('hex'),gitRevision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),isolatedCopy:true,avatarStyle,graphicsRequest,speechFixture,cameraFixture,clarityMode,phaseSeconds,fixtureHashes,monitorHashes};
 await fs.writeFile(path.join(dir,'build.json'),JSON.stringify(buildInfo,null,2));
 const manager=spawn(path.join(root,'.tools/native-companion-wm/root/usr/bin/openbox'),[],{stdio:'ignore',env:{...process.env,LD_LIBRARY_PATH:path.join(root,'.tools/native-companion-wm/root/usr/lib/aarch64-linux-gnu'),XDG_DATA_DIRS:path.join(root,'.tools/native-companion-wm/root/usr/share')+':/usr/share'}});
 const binary=path.join(build,'magic-mirror-portal');
 const child=spawn(binary,['--kiosk','--no-sandbox',...(graphicsRequest==='vulkan'?['--use-gl=angle','--use-angle=vulkan','--use-cmd-decoder=passthrough']:['--disable-gpu']),`--user-data-dir=${profile}`,'--remote-debugging-port=0','--remote-debugging-address=127.0.0.1'],{cwd:profile,env:{...process.env,GEMINI_API_KEY:'',DECART_API_KEY:'',MIRROR_TRYON_ENDPOINT:'',MIRROR_TRYON_API_KEY:'',MIRROR_SPOTIFY_CLIENT_ID:'',MIRROR_VERTEX_PROJECT:'',MIRROR_KIOSK:'true'},stdio:['ignore','pipe','pipe']});
 let logs='',client,appExit=null,stopping=false;for(const stream of [child.stdout,child.stderr])stream.on('data',b=>logs=(logs+b).slice(-12000));child.on('exit',(code,signal)=>appExit={code,signal});child.on('error',error=>appExit={error:error.message});
 const errors=[],samples=[],scope='Actual packaged Linux portrait app, graphics request '+graphicsRequest+', temporary profile, '+(speechFixture?'periodic local synthetic PCM through real playback/model':'no live voice')+(cameraFixture?', recorded source resampled into 1280x720 canvas at requested 30 Hz with actual local tracking/AR and DOM/native wardrobe ingestion; sleep deadline accelerated to 1.5 seconds during its dedicated phase; no physical camera/microphone/cloud/Internet media':', no microphone/cloud/camera/Internet media')+'; CPU is live process-tree work, RSS is summed and may double-count shared pages; GPU metrics cover the whole device, not only this app.';
 const write=async()=>fs.writeFile(path.join(dir,'summary.json'),JSON.stringify({scope,pid:child.pid,startedAt:id,updatedAt:new Date().toISOString(),status:stopping?'stopping':appExit?'app-exited':'monitoring',sampleCount:samples.length,errors,latest:samples.at(-1),appExit},null,2));
 const onStop=()=>stopping=true;process.on('SIGTERM',onStop);process.on('SIGINT',onStop);
 try{
  const start=Date.now();let endpoint;
  while(!(endpoint=logs.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/)?.[1])){if(appExit)throw new Error('App exited during startup');if(Date.now()-start>45000)throw new Error('Monitor app startup timed out');await delay(100)}
  let target;while(!target){target=(await fetch('http://'+new URL(endpoint).host+'/json/list').then(r=>r.json())).find(t=>t.url.includes('app.asar/src/index.html'));await delay(100)}
  client=await connect(target.webSocketDebuggerUrl);await client.call('Runtime.enable');await client.call('Page.enable');await client.call('Performance.enable');
  client.onEvent(e=>{if(e.method==='Runtime.exceptionThrown')errors.push({at:new Date().toISOString(),type:'renderer-exception',message:e.params.exceptionDetails.exception?.description||e.params.exceptionDetails.text})});
  await client.call('Page.addScriptToEvaluateOnNewDocument',{source:`window.__monitorDocument=true;localStorage.setItem('mirror.camera-clarity','${clarityMode}');localStorage.setItem('mirror.avatar-render-style','${avatarStyle}');localStorage.setItem('mirror.hard-muted','true');localStorage.setItem('mirror.wake','false');localStorage.setItem('mirror.gestures','false');localStorage.setItem('mirror.depth-cube','false');`});
  await client.call('Page.reload');
  while(!await client.evaluate('!!window.__monitorDocument&&!!window.__mirrorDebug&&document.querySelector("#loader").classList.contains("done")')){if(appExit)throw new Error('App exited');if(Date.now()-start>90000)throw new Error('Monitor UI startup timed out');await delay(200)}
  await client.evaluate(`window.__monitor={last:performance.now(),worstLagMs:0};setInterval(()=>{const now=performance.now();__monitor.worstLagMs=Math.max(__monitor.worstLagMs,Math.max(0,now-__monitor.last-500));__monitor.last=now},500)`);
  if(speechFixture)await client.evaluate(`(()=>{__monitor.speech={active:false,bursts:0,finishedAt:-1000};document.querySelector('#mute-btn').click()})()`);
  if(cameraFixture)await cameraTools.setupMonitorCamera(client,root);
  const modes=cameraFixture?['ar','mirror','ar','camera-off','sleep']:['mirror','portal','ar','watch','spotify'];let lastMode=cameraFixture?-1:0;const begun=Date.now();let lastAt=begun,previous=new Map((await processTree(child.pid)).map(p=>[p.pid,p.ticks]));
  console.log(JSON.stringify({status:'monitoring',pid:child.pid,directory:dir,durationSec:seconds,modeDurationSec:phaseSeconds,scope}));
  while(!stopping&&Date.now()-begun<seconds*1000){
   await delay(3000);if(appExit){errors.push({type:'app-exited',...appExit});break}
   const index=Math.floor((Date.now()-begun)/(phaseSeconds*1000))%modes.length;
   if(index!==lastMode){const mode=modes[index];if(cameraFixture)await cameraTools.setMonitorCameraPhase(client,mode);else {if(await client.evaluate('__mirrorDebug.getMirrorState().display.sleeping')){for(const type of ['keyDown','keyUp'])await client.call('Input.dispatchKeyEvent',{type,key:'1',windowsVirtualKeyCode:49})}if(mode==='portal'){for(const type of ['keyDown','keyUp'])await client.call('Input.dispatchKeyEvent',{type,key:'1',windowsVirtualKeyCode:49})}else{const p=await client.evaluate(`(()=>{const r=document.querySelector('[data-mode="${mode}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);for(const type of ['mousePressed','mouseReleased'])await client.call('Input.dispatchMouseEvent',{type,...p,button:'left',clickCount:1})}}lastMode=index;if(cameraFixture)await delay(1200);const shot=await client.call('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(dir,mode+'.png'),Buffer.from(shot.data,'base64'))}
   if(speechFixture&&samples.length%10===0){
    const started=await client.evaluate(`(async()=>{const d=__mirrorDebug,a=d.avatar;if(d.getMirrorState().display.sleeping||__monitor.speech.active)return false;await a.startAudioStream();if(!a.streaming)throw Error('Monitor speech stream unavailable');const rate=24000,pcm=new Int16Array(rate*2);for(let i=0;i<pcm.length;i++)pcm[i]=Math.round(.15*32767*Math.sin(2*Math.PI*180*i/rate));__monitor.speech.active=true;__monitor.speech.bursts++;a.pushPcm(pcm);a.endAudioTurn();setTimeout(()=>{d.stopAssistant();__monitor.speech.active=false;__monitor.speech.finishedAt=performance.now()},2200);return true})()`);if(started)await delay(250);
   }
   const now=Date.now(),tree=await processTree(child.pid);const ticks=tree.reduce((sum,p)=>sum+Math.max(0,p.ticks-(previous.get(p.pid)??p.ticks)),0);previous=new Map(tree.map(p=>[p.pid,p.ticks]));
   if(cameraFixture)await cameraTools.pauseUnusedMonitorCamera(client);
   const cameraWorkload=cameraFixture?await client.evaluate(cameraTools.cameraSnapshot):null;
   const ui=await client.evaluate(`(()=>{const s=__mirrorDebug.getMirrorState();const lag=__monitor.worstLagMs;__monitor.worstLagMs=0;return{mode:s.display.mode,sleeping:s.display.sleeping,avatarAppearance:s.display.avatarAppearance,avatarRig:s.display.avatarRig,power:__mirrorDebug.getPowerState(),eventLoopLagMs:lag,cameraActive:s.camera?.active===true,audio:{avatarClock:__mirrorDebug.avatar.head?.audioCtx?.state||null,hiddenAnimationRunning:__mirrorDebug.avatar.head?.isRunning===true,workletConnected:!!__mirrorDebug.avatar.head?.streamWorkletNode,playback:__mirrorDebug.avatar.getPlaybackStatus()},speech:__monitor.speech?{...__monitor.speech,idleMs:performance.now()-__monitor.speech.finishedAt}:null,hardMuted:document.querySelector('#mute-btn').getAttribute('aria-pressed')==='true'}})()`);
   const metric=Object.fromEntries((await client.call('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
   let gpu=null;try{const r=await run('nvidia-smi',['--query-gpu=power.draw,utilization.gpu,memory.used','--format=csv,noheader,nounits'],{timeout:2000});gpu={deviceWide:r.stdout.trim()}}catch{}
   const sample={at:new Date(now).toISOString(),elapsedSec:(now-begun)/1000,cpuPercent:100*ticks/hz/((now-lastAt)/1000),summedRssBytes:tree.reduce((n,p)=>n+p.rssBytes,0),processCount:tree.length,rendererHeapBytes:metric.JSHeapUsedSize,gpu,...ui,...(cameraFixture?{cameraWorkload}: {})};lastAt=now;samples.push(sample);
   if((ui.hardMuted||(speechFixture&&!ui.speech.active&&ui.speech.idleMs>500))&&(ui.audio.avatarClock==='running'||ui.audio.hiddenAnimationRunning||ui.audio.workletConnected))errors.push({at:sample.at,type:ui.hardMuted?'muted-avatar-audio-resource':'idle-avatar-audio-resource',audio:ui.audio});
   if(speechFixture&&ui.speech.active&&ui.audio.playback.visemeModel==='unavailable')errors.push({at:sample.at,type:'speech-model-unavailable'});
   if(speechFixture&&!ui.speech.active&&ui.speech.idleMs>500&&ui.audio.playback.visemeModel!=='idle')errors.push({at:sample.at,type:'idle-speech-detector',playback:ui.audio.playback});
   if(cameraFixture)errors.push(...cameraTools.checkCameraSample(sample,samples.at(-2)));
   if(ui.sleeping&&ui.power.targetFps!==0)errors.push({at:sample.at,type:'sleep-render-budget',targetFps:ui.power.targetFps});
   if(ui.eventLoopLagMs>1000)errors.push({at:sample.at,type:'event-loop-stall',lagMs:ui.eventLoopLagMs});
   await fs.appendFile(path.join(dir,'samples.ndjson'),JSON.stringify(sample)+'\n');await write();
   if(samples.length%20===0)console.log(JSON.stringify({status:'monitoring',minutes:Math.round(sample.elapsedSec/60),mode:ui.mode,sleeping:ui.sleeping,cpuPercent:Math.round(sample.cpuPercent),errors:errors.length}));
  }
  if(cameraFixture)errors.push(...cameraTools.checkCameraCoverage(samples,{speechFixture,graphicsRequest,avatarStyle,seconds,phaseSeconds}));
  if(speechFixture&&!samples.some(s=>s.audio.playback.visemeModel==='ready'&&s.audio.playback.predictedViseme!==null))errors.push({type:'speech-model-not-observed'});
 }catch(error){errors.push({at:new Date().toISOString(),type:'monitor-error',message:error.message});if(cameraFixture&&client){const state=await client.evaluate('({state:__mirrorDebug.getMirrorState(),camera:('+cameraTools.cameraSnapshot+')})').catch(()=>null);await fs.writeFile(path.join(dir,'failure-state.json'),JSON.stringify(state,null,2));const shot=await client.call('Page.captureScreenshot',{format:'png'}).catch(()=>null);if(shot)await fs.writeFile(path.join(dir,'failure.png'),Buffer.from(shot.data,'base64'));}process.exitCode=1}
 finally{stopping=true;await write();if(cameraFixture&&client)await cameraTools.cleanupMonitorCamera(client).catch(()=>{});client?.close();child.kill('SIGTERM');manager.kill('SIGTERM');await delay(500);if(!appExit)child.kill('SIGKILL');await fs.rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});await fs.writeFile(path.join(dir,'summary.json'),JSON.stringify({scope,status:'finished',sampleCount:samples.length,errors,latest:samples.at(-1),appExit,build:buildInfo},null,2));if(errors.length)process.exitCode=1;console.log(JSON.stringify({status:'finished',directory:dir,samples:samples.length,errors:errors.length}));}
})().catch(error=>{console.error(error.message);process.exitCode=1});
