// Production visual preview; explicit cue playback, not microphone recognition.
const fs=require('fs/promises'),path=require('path'),os=require('os'),assert=require('assert/strict');
const {spawn}=require('child_process'),{connect}=require('./cdp-client.cjs');
const root=path.resolve(__dirname,'..'),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'mirror-magic-preview-')),out=path.join(root,'artifacts/magic-animation');await fs.mkdir(out,{recursive:true});
 const app=spawn(path.join(root,`dist/linux-${process.arch}-unpacked/magic-mirror-portal`),['--no-sandbox','--disable-gpu',`--user-data-dir=${profile}`,'--remote-debugging-address=127.0.0.1','--remote-debugging-port=0'],{cwd:profile,env:{...process.env,GEMINI_API_KEY:'',DECART_API_KEY:'',MIRROR_KIOSK:'false'},stdio:['ignore','pipe','pipe']});
 let logs='',client,exited=false;app.on('exit',()=>exited=true);for(const stream of[app.stdout,app.stderr])stream.on('data',bytes=>logs=(logs+bytes).slice(-8000));
 const until=async fn=>{for(let i=0;i<450;i++){if(exited)throw new Error('Preview exited');const value=await fn();if(value)return value;await delay(100)}throw new Error('Preview startup timed out '+logs.slice(-500))};
 try{
  const endpoint=await until(()=>logs.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/)?.[1]);
  const target=await until(async()=>(await fetch('http://'+new URL(endpoint).host+'/json/list').then(r=>r.json())).find(t=>t.url.includes('app.asar/src/index.html')));
  client=await connect(target.webSocketDebuggerUrl);await client.call('Page.enable');
  await client.call('Page.addScriptToEvaluateOnNewDocument',{source:`window.__magicPreview=true;localStorage.setItem('mirror.hard-muted','true');localStorage.setItem('mirror.wake','false');localStorage.setItem('mirror.gestures','false');localStorage.setItem('mirror.depth-cube','false');`});await client.call('Page.reload');
  await until(()=>client.evaluate('!!window.__magicPreview&&!!window.__mirrorDebug&&document.querySelector("#loader").classList.contains("done")'));
  await client.call('Emulation.setDeviceMetricsOverride',{width:540,height:960,deviceScaleFactor:1,mobile:false});
  await client.evaluate('__mirrorDebug.gemini.onModeChange("portal")');await until(()=>client.evaluate('__mirrorDebug.getMirrorState().display.mode==="portal"'));await delay(1000);
  await client.evaluate(`document.querySelector('#awakening').classList.add('active');__mirrorDebug.magic.play('wake',{muted:true});window.__previewArrival=setTimeout(()=>{document.querySelector('#awakening').classList.remove('active');__mirrorDebug.magic.play('arrival',{muted:true})},2350)`);
  assert(await client.evaluate('getComputedStyle(document.querySelector("#dashboard-container")).visibility==="hidden"'));assert(await client.evaluate('getComputedStyle(document.querySelector("#mute-btn")).visibility==="visible"'));
  const started=Date.now(),times=[];
  for(let i=0;i<38;i++){await delay(Math.max(0,started+i*1000/12-Date.now()));const shot=await client.call('Page.captureScreenshot',{format:'jpeg',quality:80});times.push(Date.now()-started);await fs.writeFile(path.join(out,`frame-${String(i).padStart(3,'0')}.jpg`),Buffer.from(shot.data,'base64'));}
  assert(await client.evaluate('__mirrorDebug.getMirrorState().display.mode==="portal"&&getComputedStyle(document.querySelector("#avatar-engine")).visibility==="visible"'),'Preview did not reveal the host');await client.evaluate('__mirrorDebug.stopAssistant()');assert(await client.evaluate('__mirrorDebug.magic.frame===null&&__mirrorDebug.magic.canvas.hidden'));
  await client.evaluate(`__mirrorDebug.magic.reduced=true;__mirrorDebug.magic.applyPreferences();document.querySelector('#awakening').classList.add('active');__mirrorDebug.magic.play('wake',{muted:true})`);assert(await client.evaluate('__mirrorDebug.magic.frame===null&&__mirrorDebug.magic.canvas.hidden'));await client.evaluate('__mirrorDebug.stopAssistant()');
  const used=times.filter(time=>time<=times[0]+3400).length;const sequence=[];for(let i=0;i<used;i++){sequence.push("file 'frame-"+String(i).padStart(3,'0')+".jpg'",'duration '+((i+1<used?times[i+1]-times[i]:100)/1000))}sequence.push("file 'frame-"+String(used-1).padStart(3,'0')+".jpg'");await fs.writeFile(path.join(out,'frames.txt'),sequence.join('\n'));
  const encoder=spawn('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',path.join(out,'frames.txt'),'-vsync','vfr','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,'mirror-awakens.mp4')],{stdio:'ignore'});
  await new Promise((resolve,reject)=>{encoder.on('error',reject);encoder.on('exit',code=>code===0?resolve():reject(new Error('Preview encoding failed')))});
  const result={passed:true,scope:'Actual packaged production animation explicitly triggered; silent, no acoustic wake or physical-TV test. Screenshot capture target 12 fps; capture timings recorded.',frames:times.length,captureTimesMs:times,cancelledCleanly:true,reducedMotionNoParticleLoop:true};
  await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{client?.close();app.kill('SIGTERM');await delay(200);if(!exited)app.kill('SIGKILL');await fs.rm(profile,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1});
