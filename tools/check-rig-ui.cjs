// Production visual preview; explicit cue playback, not microphone recognition.
const fs=require('fs/promises'),path=require('path'),os=require('os'),assert=require('assert/strict');
const {spawn}=require('child_process'),{connect}=require('./cdp-client.cjs');
const root=path.resolve(__dirname,'..'),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'mirror-rig-v2-')),out=path.join(root,'artifacts',process.env.MIRROR_RIG_BACKEND==='vulkan'?'rig-vulkan':'rig-v2');await fs.mkdir(out,{recursive:true});
 const app=spawn(path.join(root,`dist/linux-${process.arch}-unpacked/magic-mirror-portal`),['--no-sandbox',...(process.env.MIRROR_RIG_BACKEND==='vulkan'?['--use-gl=angle','--use-angle=vulkan','--use-cmd-decoder=passthrough']:['--disable-gpu']),`--user-data-dir=${profile}`,'--remote-debugging-address=127.0.0.1','--remote-debugging-port=0'],{cwd:profile,env:{...process.env,GEMINI_API_KEY:'',DECART_API_KEY:'',MIRROR_KIOSK:'false'},stdio:['ignore','pipe','pipe']});
 let logs='',client,exited=false;app.on('exit',()=>exited=true);for(const stream of[app.stdout,app.stderr])stream.on('data',bytes=>logs=(logs+bytes).slice(-8000));
 const until=async fn=>{for(let i=0;i<450;i++){if(exited)throw new Error('Preview exited');const value=await fn();if(value)return value;await delay(100)}throw new Error('Preview startup timed out '+logs.slice(-500))};
 try{
  const endpoint=await until(()=>logs.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/)?.[1]);
  const target=await until(async()=>(await fetch('http://'+new URL(endpoint).host+'/json/list').then(r=>r.json())).find(t=>t.url.includes('app.asar/src/index.html')));
  client=await connect(target.webSocketDebuggerUrl);await client.call('Page.enable');
  await client.call('Page.addScriptToEvaluateOnNewDocument',{source:`window.__magicPreview=true;window.__hdGeneration=Number(sessionStorage.getItem('hd-generation')||0)+1;sessionStorage.setItem('hd-generation',String(__hdGeneration));localStorage.setItem('mirror.hard-muted','true');localStorage.setItem('mirror.wake','false');localStorage.setItem('mirror.gestures','false');localStorage.setItem('mirror.depth-cube','false');`});await client.call('Page.reload');
  await until(()=>client.evaluate('!!window.__magicPreview&&!!window.__mirrorDebug&&document.querySelector("#loader").classList.contains("done")'));
  await client.call('Emulation.setDeviceMetricsOverride',{width:720,height:1280,deviceScaleFactor:1.5,mobile:false});
  await client.evaluate('__mirrorDebug.gemini.onModeChange("portal")');await until(()=>client.evaluate('__mirrorDebug.getMirrorState().display.mode==="portal"'));await delay(1000);
  const shot=async name=>{const image=await client.call('Page.captureScreenshot',{format:'jpeg',quality:92});await fs.writeFile(path.join(out,name+'.jpg'),Buffer.from(image.data,'base64'));};
  const motionCaptures=[];
  const motion=async name=>{
   if(process.env.MIRROR_RIG_MOTION!=='true')return;
   const captured=await client.evaluate(`(async()=>{
    const a=__mirrorDebug.avatar,stream=a.rigHost.canvas.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'}),chunks=[];
    recorder.ondataavailable=e=>chunks.push(e.data);const ended=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=e=>reject(new Error(e.error?.message||'Rig motion recording failed'))});
    let frame,maxBlink=0,t0=performance.now(),firstFrame=a.rigHost.frames;const animate=t=>{const phase=(t-t0)/1000,age=phase%2-.8,blink=age<0||age>.32?0:age<.08?Math.sin(Math.PI*.5*age/.08)**2:age<.2?1:Math.cos(Math.PI*.5*(age-.2)/.12)**2;maxBlink=Math.max(maxBlink,...['Left','Right'].map(side=>a.rigHost.face.morphTargetInfluences[a.rigHost.face.morphTargetDictionary['eyeBlink'+side]]));a.setGazeOverride({x:Math.sin(phase*1.7)*.35,y:0});a.setExpression({eyeBlinkLeft:blink,eyeBlinkRight:blink,browInnerUp:.15+.15*Math.sin(phase*2),mouthSmileLeft:.12,mouthSmileRight:.12});a.setPerformance({turn:Math.sin(phase*1.3)*.8});frame=requestAnimationFrame(animate)};
    try{recorder.start();frame=requestAnimationFrame(animate);await new Promise(resolve=>setTimeout(resolve,4500));recorder.stop();await ended;let result='';for(const b of new Uint8Array(await new Blob(chunks).arrayBuffer()))result+=String.fromCharCode(b);return {encoded:btoa(result),maxBlink,submittedFrames:a.rigHost.frames-firstFrame,durationMs:performance.now()-t0}}
    finally{cancelAnimationFrame(frame);if(recorder.state!=='inactive')recorder.stop();stream.getTracks().forEach(t=>t.stop());a.setExpression({});a.setPerformance({});a.setGazeOverride(null)}
   })()`);assert(captured.encoded.length>1000,'Motion capture was empty');assert(captured.maxBlink>.98,'Uninterrupted acting never closes the lids');assert(captured.submittedFrames>30,'Motion capture lacks actual renderer submissions');const {encoded,...metrics}=captured;motionCaptures.push({name,...metrics,scope:'Actual canvas stream of explicit blink/gaze/turn cues; no acoustic speech or physical display FPS proof.'});await fs.writeFile(path.join(out,name+'-motion.webm'),Buffer.from(encoded,'base64'));await delay(1000);
  };
  const mode=id=>{const command='set '+(id==='hd'?'maximum detail':id==='eco'?'efficient quality':'balanced quality');return client.evaluate('__mirrorDebug.gemini.onMirrorCommand('+JSON.stringify(command)+')')};
  await client.evaluate(`document.querySelector('#mute-btn').click()`);await delay(300);
  await client.evaluate(`document.querySelector('#avatar-render-style').value='rig';document.querySelector('#avatar-render-style').dispatchEvent(new Event('change'))`);
  await until(()=>client.evaluate('__mirrorDebug.avatar.rigHost?.ready&&__mirrorDebug.avatar.renderStyle==="rig"'));
  let neutralLidUv;
  console.log(await client.evaluate(`(()=>{const r=__mirrorDebug.avatar.rigHost,f=r.face;return{visible:f.visible,position:f.position.toArray(),scale:f.scale.toArray(),material:{visible:f.material.visible,opacity:f.material.opacity,color:f.material.color.toArray(),map:!!f.material.map},camera:r.camera.position.toArray(),bounds:f.geometry.boundingSphere}})()`));
  await client.evaluate(`const r=__mirrorDebug.avatar.rigHost;r.accessories.group.visible=false;r.signature=null`);await delay(400);await shot('face-only');await client.evaluate(`__mirrorDebug.avatar.rigHost.accessories.group.visible=true;__mirrorDebug.avatar.rigHost.signature=null`);
  const poses=[['neutral',{},{}],['blink',{eyeBlinkLeft:1,eyeBlinkRight:1},{}],['half-blink',{eyeBlinkLeft:.5,eyeBlinkRight:.5},{}],['left-blink',{eyeBlinkLeft:1},{}],['right-blink',{eyeBlinkRight:1},{}],['blink-left-30',{eyeBlinkLeft:1,eyeBlinkRight:1},{turn:-1.6}],['blink-right-30',{eyeBlinkLeft:1,eyeBlinkRight:1},{turn:1.6}],['wide',{eyeWideLeft:.6,eyeWideRight:.6},{}],['squint',{eyeSquintLeft:.8,eyeSquintRight:.8},{}],['brow',{browOuterUpLeft:.8},{}],['aa',{jawOpen:.65},{}],['oh',{jawOpen:.30,mouthFunnel:.7},{}],['ee',{jawOpen:.18,mouthStretchLeft:.44,mouthStretchRight:.44},{}],['mbp',{mouthClose:1,mouthPressLeft:.3,mouthPressRight:.3},{}],['fv',{jawOpen:.24,mouthRollLower:.7,mouthUpperUpLeft:.12,mouthUpperUpRight:.12},{}],['smile',{mouthSmileLeft:.8,mouthSmileRight:.8},{}],['left',{}, {turn:-.9}],['right',{}, {turn:.9}],['left-30',{}, {turn:-1.6}],['right-30',{}, {turn:1.6}]];
  const frames=[];
  const errors=[];await client.call('Runtime.enable');client.onEvent(e=>{if(e.method==='Runtime.exceptionThrown')errors.push(e.params.exceptionDetails.text)});
  for(const[name,blend,performance]of poses){
   await client.evaluate(`(()=>{const a=__mirrorDebug.avatar;a.presence.update=()=>({expression:{},gaze:{x:0,y:0,confidence:1},performance:{turn:0,nod:0,lean:0}});a.setExpression(${JSON.stringify(blend)});a.setPerformance(${JSON.stringify(performance)});a.setSpeechLevel(0)})()`);
   await delay(550);if(name==='neutral')neutralLidUv=await client.evaluate('(()=>{const uv=__mirrorDebug.avatar.rigHost.face.geometry.attributes.uv;return [159,145,386,374].map(i=>[uv.getX(i),uv.getY(i)])})()');await shot(name);const frame=await client.evaluate('(()=>{const r=__mirrorDebug.avatar.rigHost;let expectedTriangles=r.composer?2:0,expectedDraws=r.composer?2:0;r.scene.traverseVisible(n=>{if(n.isMesh&&n.material.visible){expectedTriangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;expectedDraws++}});return{...r.snapshot(),expectedTriangles,expectedDraws,pose:'+JSON.stringify(name)+',turn:r.smooth.turn,mouth:{upperTeeth:r.accessories.upperTeeth.visible,lowerTeeth:r.accessories.lowerTeeth.visible,lowerY:r.accessories.lowerTeeth.position.y,tongue:r.accessories.tongue.visible}}})()');if(name.includes('-30'))assert(Math.abs(frame.turn)>=Math.PI/6);if(name==='mbp'||name==='neutral')assert(!frame.mouth.upperTeeth&&!frame.mouth.lowerTeeth&&!frame.mouth.tongue,'Closed pose leaks interior');if(name==='aa')assert(frame.mouth.upperTeeth&&frame.mouth.lowerTeeth&&frame.mouth.tongue);if(name==='fv')assert(frame.mouth.upperTeeth&&!frame.mouth.tongue);frames.push(frame);
  }
  assert(frames.every(f=>f.ready&&f.triangles===f.expectedTriangles&&f.drawCalls===f.expectedDraws&&f.triangles<35000),'Rig render differs from visible scene geometry or exceeds the current bound');
  await client.evaluate('__mirrorDebug.avatar.setPerformance({});__mirrorDebug.avatar.setExpression({eyeBlinkLeft:1,eyeBlinkRight:1})');await delay(600);
  const lidDiagnostic=await client.evaluate(`(()=>{const r=__mirrorDebug.avatar.rigHost,f=r.face,p=f.geometry.attributes.position;return ['Left','Right'].map((side,k)=>{const i=f.morphTargetDictionary['eyeBlink'+side],m=f.geometry.morphAttributes.position[i],a=k?386:159,b=k?374:145,w=f.morphTargetInfluences[i];return{side,weight:w,delta:[0,1,2].map(axis=>p.getComponent(a,axis)+m.getComponent(a,axis)*w-p.getComponent(b,axis)-m.getComponent(b,axis)*w)}})})()`);
  assert(lidDiagnostic.every(l=>l.weight>.99&&Math.hypot(...l.delta)<.002),'Live blink does not fully close its 3D aperture');
  console.log(JSON.stringify({lidDiagnostic}));
  const closedLidUv=await client.evaluate('(()=>{const uv=__mirrorDebug.avatar.rigHost.face.geometry.attributes.uv;return [159,145,386,374].map(i=>[uv.getX(i),uv.getY(i)])})()');
  assert(closedLidUv.every((pair,index)=>pair.some((value,axis)=>value!==neutralLidUv[index][axis])),'Live closure did not update each upper/lower lid texture mapping');
  if(process.env.MIRROR_LID_DIAGNOSTIC==='true'){
   await shot('lid-material-original');
   await client.evaluate('(()=>{const r=__mirrorDebug.avatar.rigHost;r.__lidMap=r.face.material.map;r.face.material.map=null;r.face.material.needsUpdate=true;r.signature=null})()');await delay(500);await shot('lid-material-no-map');
   await client.evaluate('(()=>{const r=__mirrorDebug.avatar.rigHost;r.accessories.headVolume.visible=false;r.signature=null})()');await delay(500);await shot('lid-material-no-map-no-head');
   await client.evaluate('(()=>{const r=__mirrorDebug.avatar.rigHost;r.accessories.eyes.forEach(e=>e.group.visible=false);r.signature=null})()');await delay(500);await shot('lid-material-no-map-no-head-no-eyes');
   await client.evaluate('(()=>{const r=__mirrorDebug.avatar.rigHost;r.face.material.map=r.__lidMap;delete r.__lidMap;r.face.material.needsUpdate=true;r.accessories.headVolume.visible=true;r.accessories.eyes.forEach(e=>e.group.visible=true);r.signature=null})()');
  }
  await client.evaluate(`__mirrorDebug.avatar.setExpression({});__mirrorDebug.avatar.setPerformance({})`);await delay(1000);
  assert.deepEqual(await client.evaluate('(()=>{const uv=__mirrorDebug.avatar.rigHost.face.geometry.attributes.uv;return [159,145,386,374].map(i=>[uv.getX(i),uv.getY(i)])})()'),neutralLidUv,'Live reopening did not restore neutral texture exactly');
  await motion('queen');
  const before=await client.evaluate('__mirrorDebug.avatar.rigHost.frames');await delay(600);const after=await client.evaluate('__mirrorDebug.avatar.rigHost.frames');assert.equal(after,before,'Settled rig still draws');
  if(process.env.MIRROR_RIG_MOVIE==='true'){
   await client.evaluate('__mirrorDebug.avatar.visible=false');
   for(let i=0;i<96;i++){
    await client.evaluate(`(()=>{const a=__mirrorDebug.avatar,r=a.rigHost,t=${i}/24;const blink=t>1.1&&t<1.25?1:0;const energy=t>1.8&&t<3.5?.4+.3*Math.sin(t*15):0;r.update({eyeBlinkLeft:blink,eyeBlinkRight:blink,browOuterUpLeft:t>2?.35:0,jawOpen:energy,mouthFunnel:t>2.6&&t<3?.4:0},{x:Math.sin(t*1.8)*.7,y:0},{turn:Math.sin(t*1.5)*.8,nod:0,lean:0},1/24,{})})()`);
    await shot('movie-'+String(i).padStart(3,'0'));
   }
   const {execFileSync}=require('child_process');execFileSync('ffmpeg',['-y','-framerate','24','-i',path.join(out,'movie-%03d.jpg'),'-c:v','libx264','-crf','20','-pix_fmt','yuv420p',path.join(out,'rig-preview.mp4')],{stdio:'ignore'});
   await client.evaluate('__mirrorDebug.avatar.visible=true');
  }
  for(const [x,name]of[[-1,'gaze-left'],[1,'gaze-right']]){await client.evaluate(`__mirrorDebug.avatar.setGazeOverride({x:${x},y:0})`);await delay(500);await shot(name);assert(Math.abs(await client.evaluate('__mirrorDebug.avatar.rigHost.accessories.eyes[0].group.rotation.y'))>.20);}
  await client.evaluate('__mirrorDebug.avatar.setGazeOverride(null)');
  await client.evaluate(`document.querySelector('#display-quality').value='hd';document.querySelector('#display-quality').dispatchEvent(new Event('change'))`);assert.equal(await client.evaluate('__mirrorDebug.avatar.rigHost.quality'),'hd');assert(await client.evaluate('__mirrorDebug.avatar.rigHost.canvas.width*__mirrorDebug.avatar.rigHost.canvas.height<=4e6'));
  await client.evaluate(`__mirrorDebug.avatar.setPersona('solenne')`);
  await until(()=>client.evaluate('__mirrorDebug.avatar.rigHost?.ready&&__mirrorDebug.avatar.rigHost.persona==="solenne"'));
  await delay(600);await shot('solenne');assert.equal(await client.evaluate('__mirrorDebug.avatar.rigHost.persona'),'solenne');
  await client.evaluate('__mirrorDebug.avatar.setExpression({eyeBlinkLeft:1,eyeBlinkRight:1})');await delay(550);await shot('solenne-blink');
  if(process.env.MIRROR_LID_DIAGNOSTIC==='true'){
   await client.evaluate('(()=>{const r=__mirrorDebug.avatar.rigHost;r.accessories.eyes.forEach(e=>e.group.visible=false);if(r.composer)r.composer.render();else r.renderer.render(r.scene,r.camera)})()');await shot('solenne-eyes-hidden');
   await client.evaluate('(()=>{const r=__mirrorDebug.avatar.rigHost;r.__lidMap=r.face.material.map;r.face.material.map=null;r.face.material.needsUpdate=true;if(r.composer)r.composer.render();else r.renderer.render(r.scene,r.camera)})()');await shot('solenne-no-map');
   await client.evaluate('(()=>{const r=__mirrorDebug.avatar.rigHost;r.face.material.map=r.__lidMap;delete r.__lidMap;r.face.material.needsUpdate=true;r.accessories.eyes.forEach(e=>e.group.visible=true);r.signature=null})()');
  }
  const snowLids=await client.evaluate('(()=>{const f=__mirrorDebug.avatar.rigHost.face;return ["Left","Right"].map(side=>f.morphTargetInfluences[f.morphTargetDictionary["eyeBlink"+side]])})()');
  assert(snowLids.every(w=>w>.99),'Snow closed screenshot did not use full blink');console.log(JSON.stringify({snowLids}));
  await client.evaluate('__mirrorDebug.avatar.setExpression({eyeBlinkLeft:.5,eyeBlinkRight:.5})');await delay(550);await shot('solenne-half-blink');
  await client.evaluate('__mirrorDebug.avatar.setExpression({})');await delay(550);
  await motion('solenne');
  await client.evaluate(`__mirrorDebug.avatar.setPersona('rowan')`);assert.equal(await client.evaluate('__mirrorDebug.avatar.renderStyle'),'portrait');
  await client.evaluate(`__mirrorDebug.avatar.setPersona('velora')`);await client.evaluate(`document.querySelector('#avatar-render-style').value='rig';document.querySelector('#avatar-render-style').dispatchEvent(new Event('change'))`);await until(()=>client.evaluate('__mirrorDebug.avatar.rigHost.ready&&__mirrorDebug.avatar.renderStyle==="rig"'));
  const reloadGeneration=await client.evaluate('__hdGeneration');await client.call('Page.reload');await until(()=>client.evaluate('window.__hdGeneration>'+reloadGeneration+'&&!!window.__mirrorDebug&&document.querySelector("#loader").classList.contains("done")&&__mirrorDebug.avatar.rigHost?.ready'));assert.equal(await client.evaluate('__mirrorDebug.avatar.renderStyle'),'rig');
  await client.evaluate('__mirrorDebug.gemini.onModeChange("portal")');const anchors=[];
  for(const position of['center','left','right','upper','lower']){
   await client.evaluate('__mirrorDebug.gemini.onAvatarPosition('+JSON.stringify(position)+')');await delay(650);
   const a=await client.evaluate(`(()=>{const r=__mirrorDebug.avatar.rigHost,h=r.host.getBoundingClientRect(),g=r.host.querySelector('.host-aura').getBoundingClientRect();return{dx:g.x+g.width/2-h.x-r.faceAnchor.x,dy:g.y+g.height/2-h.y-r.faceAnchor.y}})()`);assert(Math.abs(a.dx)<2&&Math.abs(a.dy)<2);anchors.push({position,...a});
  }
  await client.evaluate('__mirrorDebug.stopAssistant()');await delay(300);const stopped=await client.evaluate('({label:document.querySelector("#mic-label").textContent,playback:__mirrorDebug.avatar.getPlaybackStatus(),energy:__mirrorDebug.avatar.speechLevel})');assert.equal(stopped.label,'LISTEN');assert(!stopped.playback.enabled&&stopped.energy===0);await delay(400);assert(!(await client.evaluate('__mirrorDebug.avatar.getPlaybackStatus().enabled')),'Idle acting revived voice after Stop');
  await client.evaluate('__mirrorDebug.avatar.rigHost.renderer.forceContextLoss()');await delay(250);assert.equal(await client.evaluate('__mirrorDebug.avatar.renderStyle'),'portrait');
  assert.deepEqual(errors,[]);
  const result={passed:true,errors,anchors,frames,motionCaptures,settledPaints:after-before,scope:'Packaged Linux actual 3D preview, graphics backend recorded per frame; explicit expressions/turns, context loss, no physical camera or accelerated-device throughput proof.'};await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }catch(error){console.error('Application log:',logs.slice(-7000));const endpoint=logs.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/)?.[1];if(endpoint){try{console.error('Live targets:',JSON.stringify(await fetch('http://'+new URL(endpoint).host+'/json/list').then(r=>r.json())))}catch{}}throw error}finally{client?.close();app.kill('SIGTERM');await delay(200);if(!exited)app.kill('SIGKILL');await fs.rm(profile,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1});
