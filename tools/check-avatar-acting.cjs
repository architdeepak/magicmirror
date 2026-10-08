// Production visual preview; explicit cue playback, not microphone recognition.
const fs=require('fs/promises'),path=require('path'),os=require('os'),assert=require('assert/strict');
const {spawn}=require('child_process'),{connect}=require('./cdp-client.cjs');
const root=path.resolve(__dirname,'..'),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'mirror-acting-')),out=path.join(root,'artifacts/avatar-acting');await fs.mkdir(out,{recursive:true});
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
  await client.evaluate(`const p=__mirrorDebug.avatar.presence;p.nextBlink=1e9;p.nextGlance=1e9;p.setActivity('ready');__mirrorDebug.avatar.setEyeGaze({x:0,y:0,confidence:0})`);
  const shot=async name=>{const image=await client.call('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(out,name+'.png'),Buffer.from(image.data,'base64'));};
  await delay(800);await shot('neutral');
  const poses=[['blink',{eyeBlinkLeft:1,eyeBlinkRight:1}],['brow',{browOuterUpLeft:.8,browDownRight:.2}],['surprised',{browInnerUp:.7,eyeWideLeft:.5,eyeWideRight:.5}],['smile',{mouthSmileLeft:.6,mouthSmileRight:.4}]];
  for(const[name,expression]of poses){await client.evaluate('__mirrorDebug.avatar.setExpression('+JSON.stringify(expression)+')');await delay(450);await shot(name);await client.evaluate('__mirrorDebug.avatar.setExpression({})');await delay(450)}
  for(const[x,name]of[[-1,'look-left'],[1,'look-right']]){await client.evaluate('__mirrorDebug.avatar.setGazeOverride({x:'+x+',y:0,confidence:1})');await delay(500);assert.equal(await client.evaluate('__mirrorDebug.avatar.faceHost.gaze.x'),x,'Tracking overwrote requested gaze');await shot(name)}
  await client.evaluate('__mirrorDebug.avatar.setGazeOverride(null)');
  const anchors=[];
  for(const position of['center','left','right','upper','lower']){
    await client.evaluate('__mirrorDebug.gemini.onAvatarPosition('+JSON.stringify(position)+')');await delay(650);
    const anchor=await client.evaluate(`(()=>{const host=document.querySelector('#avatar-engine'),halo=host.querySelector('.host-aura'),a=halo.getBoundingClientRect(),h=host.getBoundingClientRect(),f=__mirrorDebug.avatar.faceHost.faceAnchor;return{dx:a.x+a.width/2-h.x-f.x,dy:a.y+a.height/2-h.y-f.y,position:document.querySelector('#app-shell').dataset.avatarPosition,visible:getComputedStyle(host).visibility,legacyRings:__mirrorDebug.scene.getObjectByName('depth-room').children.filter(c=>c.geometry?.type==='RingGeometry').length}})()`);
    assert(Math.abs(anchor.dx)<2&&Math.abs(anchor.dy)<2,'Halo drifted from face at '+position);assert.equal(anchor.position,position);assert.equal(anchor.legacyRings,0);anchors.push(anchor);await shot('position-'+position);
  }
  await client.evaluate('__mirrorDebug.gemini.onAvatarPosition("center")');
  await client.evaluate(`document.querySelector('#mute-btn').click()`);await delay(350);
  await client.evaluate(`__mirrorDebug.gemini.onMirrorCommand('look left')`);await delay(350);assert(await client.evaluate('__mirrorDebug.avatar.faceHost.gaze.x===-1'));await client.evaluate('__mirrorDebug.stopAssistant()');assert(await client.evaluate('__mirrorDebug.avatar.gazeOverride===null&&Object.keys(__mirrorDebug.avatar.expression).length===0'));
  await client.evaluate(`__mirrorDebug.gemini.onMirrorCommand('raise an eyebrow')`);assert(await client.evaluate('__mirrorDebug.avatar.expression.browOuterUpLeft>.5'));await client.evaluate(`document.querySelector('#mute-btn').click()`);assert(await client.evaluate('Object.keys(__mirrorDebug.avatar.expression).length===0'));
  const cadence=await client.evaluate(`new Promise(resolve=>{const times=[],fogTimes=[];const tick=now=>{times.push(now);if(times.length<90)requestAnimationFrame(tick);else{const intervals=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);resolve({medianMs:intervals[Math.floor(intervals.length/2)],p95Ms:intervals[Math.floor(intervals.length*.95)],fogPaintHz:1000*(fogTimes.length-1)/(fogTimes.at(-1)-fogTimes[0])})}};document.querySelector('#awakening').classList.add('active');__mirrorDebug.magic.play('wake',{muted:true});const f=__mirrorDebug.magic.fog,render=f.render.bind(f);f.render=(...args)=>{fogTimes.push(performance.now());return render(...args)};requestAnimationFrame(tick)})`);
  await client.evaluate('__mirrorDebug.stopAssistant()');assert(await client.evaluate('__mirrorDebug.magic.frame===null&&__mirrorDebug.magic.canvas.hidden'));
  const result={passed:true,anchors,cadence,scope:'Actual packaged Linux app, production textured feature poses and halo geometry at five positions. Explicit acting inputs, no physical tracking or live lip-sync. RAF cadence sampled without screenshot readback; software graphics.'};await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{client?.close();app.kill('SIGTERM');await delay(200);if(!exited)app.kill('SIGKILL');await fs.rm(profile,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1});
