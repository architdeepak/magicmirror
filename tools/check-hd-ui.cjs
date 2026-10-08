// Production visual preview; explicit cue playback, not microphone recognition.
const fs=require('fs/promises'),path=require('path'),os=require('os'),assert=require('assert/strict');
const {spawn}=require('child_process'),{connect}=require('./cdp-client.cjs');
const root=path.resolve(__dirname,'..'),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'mirror-hd-')),out=path.join(root,'artifacts/hd-ui');await fs.mkdir(out,{recursive:true});
 const app=spawn(path.join(root,`dist/linux-${process.arch}-unpacked/magic-mirror-portal`),['--no-sandbox','--disable-gpu',`--user-data-dir=${profile}`,'--remote-debugging-address=127.0.0.1','--remote-debugging-port=0'],{cwd:profile,env:{...process.env,GEMINI_API_KEY:'',DECART_API_KEY:'',MIRROR_KIOSK:'false'},stdio:['ignore','pipe','pipe']});
 let logs='',client,exited=false;app.on('exit',()=>exited=true);for(const stream of[app.stdout,app.stderr])stream.on('data',bytes=>logs=(logs+bytes).slice(-8000));
 const until=async fn=>{for(let i=0;i<450;i++){if(exited)throw new Error('Preview exited');const value=await fn();if(value)return value;await delay(100)}throw new Error('Preview startup timed out '+logs.slice(-500))};
 try{
  const endpoint=await until(()=>logs.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/)?.[1]);
  const target=await until(async()=>(await fetch('http://'+new URL(endpoint).host+'/json/list').then(r=>r.json())).find(t=>t.url.includes('app.asar/src/index.html')));
  client=await connect(target.webSocketDebuggerUrl);await client.call('Page.enable');
  await client.call('Page.addScriptToEvaluateOnNewDocument',{source:`window.__magicPreview=true;window.__hdGeneration=Number(sessionStorage.getItem('hd-generation')||0)+1;sessionStorage.setItem('hd-generation',String(__hdGeneration));localStorage.setItem('mirror.hard-muted','true');localStorage.setItem('mirror.wake','false');localStorage.setItem('mirror.gestures','false');localStorage.setItem('mirror.depth-cube','false');`});await client.call('Page.reload');
  await until(()=>client.evaluate('!!window.__magicPreview&&!!window.__mirrorDebug&&document.querySelector("#loader").classList.contains("done")'));
  await client.call('Emulation.setDeviceMetricsOverride',{width:540,height:960,deviceScaleFactor:1,mobile:false});
  await client.evaluate('__mirrorDebug.gemini.onModeChange("portal")');await until(()=>client.evaluate('__mirrorDebug.getMirrorState().display.mode==="portal"'));await delay(1000);
  const shot=async name=>{const image=await client.call('Page.captureScreenshot',{format:'jpeg',quality:92});await fs.writeFile(path.join(out,name+'.jpg'),Buffer.from(image.data,'base64'));};
  const mode=id=>{const command='set '+(id==='hd'?'maximum detail':id==='eco'?'efficient quality':'balanced quality');return client.evaluate('__mirrorDebug.gemini.onMirrorCommand('+JSON.stringify(command)+')')};
  await client.evaluate(`document.querySelector('#mute-btn').click()`);await delay(300);
  console.log('Selecting HD');await mode('hd');assert.equal(await client.evaluate('__mirrorDebug.getMirrorState().display.quality'),'hd');
  console.log('High DPR viewport');await client.call('Emulation.setDeviceMetricsOverride',{width:1080,height:1920,deviceScaleFactor:2,mobile:false});console.log('Viewport applied');await delay(800);
  const face=await client.evaluate(`(()=>{const f=__mirrorDebug.avatar.faceHost;return{canvas:[f.canvas.width,f.canvas.height],source:[f.image.naturalWidth,f.image.naturalHeight],anchor:f.faceAnchor,profile:f.quality}})()`);assert(face.canvas[0]*face.canvas[1]<=4e6);assert.equal(face.profile,'hd');console.log('HD face',JSON.stringify(face));await shot('portrait-hd');console.log('HD portrait captured');
  // Exercise the compiled shader even on software GL, at a small bounded size.
  // This establishes the GPU implementation, not hardware acceleration on DGX.
  await client.call('Emulation.setDeviceMetricsOverride',{width:360,height:640,deviceScaleFactor:1,mobile:false});await delay(400);
  await client.evaluate(`__mirrorDebug.magic.softwareGraphics=false;document.querySelector('#awakening').classList.add('active');__mirrorDebug.magic.play('wake',{muted:true})`);await delay(1000);
  const gpu=await client.evaluate('__mirrorDebug.magic.snapshot()');assert.equal(gpu.backend,'gpu','Shader did not compile: '+gpu.fallbackReason);assert(gpu.frames>0);await shot('gpu-smoke');
  await client.evaluate(`__mirrorDebug.magic.play('wake',{muted:true});__mirrorDebug.magic.gpu.gl.getExtension('WEBGL_lose_context').loseContext()`);await delay(400);
  const fallback=await client.evaluate('__mirrorDebug.magic.snapshot()');assert.equal(fallback.backend,'cpu');assert.deepEqual(fallback.field,[320,480]);await shot('context-loss-fallback');await client.evaluate('__mirrorDebug.stopAssistant()');assert(await client.evaluate('__mirrorDebug.magic.frame===null&&__mirrorDebug.magic.canvas.hidden'));
  await mode('eco');await client.evaluate(`__mirrorDebug.magic.softwareGraphics=true;__mirrorDebug.magic.play('wake',{muted:true})`);const eco=await client.evaluate('__mirrorDebug.magic.snapshot()');assert.deepEqual(eco.field,[160,240]);await client.evaluate('__mirrorDebug.stopAssistant()');
  await mode('hd');await client.evaluate(`__mirrorDebug.gemini.onModeChange('ar');__mirrorDebug.experience.a.clarity('natural')`);assert.equal(await client.evaluate('__mirrorDebug.garmentOverlay.tracker.quality'),'hd');assert.equal(await client.evaluate('__mirrorDebug.garmentOverlay.cameraClarity.quality'),'hd');
  const generation=await client.evaluate('__hdGeneration');await client.call('Page.reload');await until(()=>client.evaluate('__hdGeneration>'+generation+'&&!!window.__mirrorDebug&&document.querySelector("#loader").classList.contains("done")'));await delay(1000);assert.equal(await client.evaluate('document.querySelector("#display-quality").value'),'hd');
  const result={passed:true,face,gpu,fallback,eco,scope:'Actual packaged Linux app. Native profile routing/persistence and high-DPR surface bounds; shader compiled/rendered on software GL with acceleration detection overridden for a small fixture; forced context loss; no physical GPU/Windows/camera proof.'};await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }catch(error){console.error('Application log:',logs.slice(-7000));const endpoint=logs.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/)?.[1];if(endpoint){try{console.error('Live targets:',JSON.stringify(await fetch('http://'+new URL(endpoint).host+'/json/list').then(r=>r.json())))}catch{}}throw error}finally{client?.close();app.kill('SIGTERM');await delay(200);if(!exited)app.kill('SIGKILL');await fs.rm(profile,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1});
