// Real packaged renderer + real Chromium mouse/keyboard input. Sensor denial
// and accelerated test environments are explicit; no production account use.
const assert=require('assert/strict'),fs=require('fs/promises'),path=require('path'),os=require('os');
const {spawn}=require('child_process'),{connect}=require('./cdp-client.cjs');
const root=path.resolve(__dirname,'..'),delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'mirror-ui-audit-')),out=path.join(root,'artifacts/adversarial-ui');await fs.mkdir(out,{recursive:true});
 const child=spawn(path.join(root,`dist/linux-${process.arch}-unpacked/magic-mirror-portal`),['--no-sandbox','--disable-gpu',`--user-data-dir=${temp}/profile`,'--remote-debugging-address=127.0.0.1','--remote-debugging-port=0'],{cwd:temp,env:{...process.env,GEMINI_API_KEY:'',DECART_API_KEY:'',MIRROR_KIOSK:'false'},stdio:['ignore','pipe','pipe']});
 let logs='',client,exited=false;const errors=[],checks=[];child.on('exit',()=>exited=true);for(const stream of[child.stdout,child.stderr])stream.on('data',b=>logs=(logs+b).slice(-14000));
 const until=async(fn,label)=>{const start=Date.now();while(Date.now()-start<45000){if(exited)throw new Error('App exited '+logs);const value=await fn();if(value)return value;await delay(100)}throw new Error(label+' timed out '+logs.slice(-1200))};
 const click=async selector=>{
  const point=await client.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing ${selector}');el.scrollIntoView({block:'nearest'});const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(!hit||!el.contains(hit))throw new Error('Covered control: ${selector}');return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  for(const type of['mousePressed','mouseReleased'])await client.call('Input.dispatchMouseEvent',{type,...point,button:'left',clickCount:1});await delay(300);
 };
 const shot=async name=>{const image=await client.call('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(out,name+'.png'),Buffer.from(image.data,'base64'))};
 const fits=async selector=>client.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}),r=el.getBoundingClientRect(),s=document.querySelector('#app-shell').getBoundingClientRect();return r.width>0&&r.left>=s.left-2&&r.right<=s.right+2})()`);
 try{
  const endpoint=await until(()=>logs.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/)?.[1],'endpoint');
  const target=await until(async()=>(await fetch('http://'+new URL(endpoint).host+'/json/list').then(r=>r.json())).find(t=>t.url.includes('app.asar/src/index.html')),'target');client=await connect(target.webSocketDebuggerUrl);await client.call('Page.enable');await client.call('Runtime.enable');
  client.onEvent(e=>{if(e.method==='Runtime.exceptionThrown')errors.push(e.params.exceptionDetails.exception?.description||e.params.exceptionDetails.text)});
  await client.call('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('mirror.hard-muted','true');localStorage.setItem('mirror.wake','false');localStorage.setItem('mirror.gestures','false');navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Sensors disabled for layout audit','NotAllowedError')};window.__uiAuditFixture=true;`});await client.call('Page.reload');await until(()=>client.evaluate('!!window.__uiAuditFixture&&!!window.__mirrorDebug&&document.querySelector("#loader").classList.contains("done")'),'startup');
  for(const [width,height] of[[1280,1024],[400,710],[540,960],[1080,1920]]){
   await client.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await delay(400);
   for(const mode of['mirror','ar','watch','spotify']){
    await click(`[data-mode="${mode}"]`);assert.equal(await client.evaluate('__mirrorDebug.getMirrorState().display.mode'),mode);
    assert(await fits('.mode-switch'),`Mode bar spills out at ${width}`);
    for(const selector of['#mic-btn','#mute-btn','#settings-toggle'])assert(await fits(selector),`${selector} spills out at ${width}`);
    if(mode==='mirror')assert(await client.evaluate(`(()=>{const a=document.querySelector('.clock-time').getBoundingClientRect(),b=document.querySelector('.mirror-weather').getBoundingClientRect();return a.right<=b.left||a.bottom<=b.top||b.bottom<=a.top})()`),`Clock/weather overlap at ${width}`);
    if(mode==='ar')assert(await fits('.studio-tray'),`Wardrobe spills out at ${width}`);
    if(mode==='watch'){assert(await fits('.watch-card'),`Watch card spills out at ${width}`);await click('#watch-url');await client.call('Input.insertText',{text:'not a media URL'});await click('#watch-load');await client.evaluate('document.querySelector("#watch-url").value=""');}
    if(mode==='spotify')assert(await fits('.spotify-card'),`Music spills out at ${width}`);
    await click('#settings-toggle');assert(await client.evaluate('document.querySelector("#settings-panel").classList.contains("open")'));assert(await fits('#settings-panel'),`Settings spills out at ${width}`);await click('#settings-toggle');
    if(width===1280||width===540)await shot(`${width}-${mode}`);
   }
   checks.push({width,height,checks:['all four mode buttons','mode/Stop/mute/settings bounds','clock/weather separation','wardrobe/watch/music bounds','invalid media URL','settings accessible in every mode']});
  }
  await client.call('Emulation.setDeviceMetricsOverride',{width:540,height:960,deviceScaleFactor:1,mobile:false});await click('[data-mode="ar"]');await client.evaluate('__mirrorDebug.gemini.onWardrobe({command:"add garment"})');
  await click('#wardrobe-photo [data-field=name]');await client.call('Input.insertText',{text:'Dress 1234 cf'});
  for(const key of['1','2','3','4','c','f'])await client.call('Input.dispatchKeyEvent',{type:'keyDown',key,text:key});
  assert.equal(await client.evaluate('__mirrorDebug.getMirrorState().display.mode'),'ar','Typing triggered global shortcuts');
  assert(await client.evaluate('document.querySelector("#wardrobe-photo").open'));
  await client.evaluate('__mirrorDebug.gemini.onTranscript("user","long heard caption ".repeat(100));__mirrorDebug.gemini.onTranscript("assistant","long spoken caption ".repeat(100))');
  assert.equal(await client.evaluate('document.querySelectorAll(".caption-line.visible").length'),2);assert.equal(await client.evaluate('document.querySelectorAll("#live-captions").length'),1);
  await shot('long-editor-captions');await click('#wardrobe-photo [data-voice-control=stop]');assert(await client.evaluate('document.querySelector("#wardrobe-photo").open'));
  await client.evaluate('__mirrorDebug.gemini.onWardrobe({command:"cancel photo"})');

  // Exercise production navigation without a cloud model. It must explain the
  // unsupported people connector instead of silently opening device locations.
  await click('[data-mode="mirror"]');
  await click('#launcher-toggle');await shot('command-center');await click('#assistant-task-input');await client.call('Input.insertText',{text:'show my friends'});await click('#assistant-task-form button');assert.equal(await client.evaluate('document.querySelector("#assistant-task-input").value'),'show my friends','Muted submit lost the draft');await click('#mute-btn');await click('#launcher-toggle');await click('#assistant-task-form button');assert(await client.evaluate('document.querySelector("#oracle-text").textContent.includes("Friends’ shared locations")'),'Friends request silently opened device locations');await click('#mute-btn');
  checks.push({checks:['typing does not invoke mode/camera/fullscreen shortcuts','two long colored caption rows and one caption container','editor Stop leaves review open','command center accessible','typed task draft retained while muted','friends request explains missing Apple People bridge']});
  await click('#settings-toggle'); await click('#camera-clarity');
  for (const type of ['keyDown','keyUp']) await client.call('Input.dispatchKeyEvent',{type,key:'ArrowDown',windowsVirtualKeyCode:40});
  for (const type of ['keyDown','keyUp']) await client.call('Input.dispatchKeyEvent',{type,key:'Enter',windowsVirtualKeyCode:13});
  assert.equal(await client.evaluate('__mirrorDebug.garmentOverlay.getLiveState().cameraClarity'),'natural');
  await click('#settings-toggle'); await click('#mute-btn'); await click('#launcher-toggle');
  await click('#assistant-task-input'); await client.call('Input.insertText',{text:'brighten the camera'}); await click('#assistant-task-form button');
  assert.equal(await client.evaluate('__mirrorDebug.garmentOverlay.getLiveState().cameraClarity'),'bright');
  await click('#launcher-toggle');
  await click('#assistant-task-input'); await client.call('Input.insertText',{text:'camera clarity off'}); await click('#assistant-task-form button');
  assert.equal(await client.evaluate('__mirrorDebug.garmentOverlay.getLiveState().cameraClarity'),'off');
  assert.equal(await client.evaluate('localStorage.getItem("mirror.camera-clarity")'),'off');
  checks.push({checks:['camera clarity selectable by real keyboard input','typed voice navigation bright/off updates renderer and persistence']});
  assert.deepEqual(errors,[]);
  const report={checkedAt:new Date().toISOString(),passed:true,scope:'Actual packaged Linux app, Chromium input, synthetic viewport sizes and denied physical sensors. No account sign-in or physical input recognition.',checks,rendererErrors:errors};await fs.writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }catch(error){if(client)await shot('failure').catch(()=>{});throw error;}finally{client?.close();child.kill('SIGTERM');await delay(200);if(!exited)child.kill('SIGKILL');await fs.rm(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e.message);process.exitCode=1});
