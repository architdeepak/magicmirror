// Real packaged transcription packet path; deterministic text, no paid provider.
const fs=require('fs/promises'),path=require('path'),os=require('os'),assert=require('assert/strict'),{createHash}=require('crypto');
const {spawn}=require('child_process'),{connect}=require('./cdp-client.cjs');
const root=path.resolve(__dirname,'..'),delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'mirror-captions-')),out=path.join(root,'artifacts',process.env.MIRROR_CAPTION_LABEL||'caption-stream');await fs.mkdir(out,{recursive:true});
 const build=process.env.MIRROR_CAPTION_BUILD||path.join(root,`dist/linux-${process.arch}-unpacked`),archiveSha256=createHash('sha256').update(await fs.readFile(path.join(build,'resources/app.asar'))).digest('hex');
 const child=spawn(path.join(build,'magic-mirror-portal'),['--no-sandbox','--disable-gpu',`--user-data-dir=${profile}`,'--remote-debugging-port=0'],{cwd:profile,env:{...process.env,GEMINI_API_KEY:'',DECART_API_KEY:'',MIRROR_VERTEX_PROJECT:'',MIRROR_KIOSK:'false'},stdio:['ignore','pipe','pipe']});
 let logs='',client,exited=false;child.on('exit',()=>exited=true);for(const stream of[child.stdout,child.stderr])stream.on('data',b=>logs=(logs+b).slice(-8000));
 const until=async fn=>{for(let i=0;i<450;i++){if(exited)throw Error('App exited');const r=await fn();if(r)return r;await delay(100)}throw Error('Caption startup timed out '+logs.slice(-800))};
 try{
  const endpoint=await until(()=>logs.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/)?.[1]),target=await until(async()=>(await fetch('http://'+new URL(endpoint).host+'/json/list').then(r=>r.json())).find(t=>t.url.includes('app.asar/src/index.html')));
  client=await connect(target.webSocketDebuggerUrl);await client.call('Page.enable');await client.call('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('mirror.hard-muted','true');localStorage.setItem('mirror.wake','false');localStorage.setItem('mirror.gestures','false');navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Fixture denies physical sensors','NotAllowedError')};window.__captionFixture=true;`});await client.call('Page.reload');
  await until(()=>client.evaluate('window.__captionFixture&&window.__mirrorDebug&&document.querySelector("#loader").classList.contains("done")'));await client.call('Emulation.setDeviceMetricsOverride',{width:540,height:960,deviceScaleFactor:1,mobile:false});
  const result=await client.evaluate(`(async()=>{
   const g=__mirrorDebug.gemini,rows=[];document.querySelector('#mute-btn').click();
   const send=(role,text)=>g._handleMessage(JSON.stringify({serverContent:{[role==='user'?'inputTranscription':'outputTranscription']:{text}}}));
   const reset=()=>{__mirrorDebug.stopAssistant();g.intentionalDisconnect=false;g.onTurnComplete()};
   const state=()=>({user:document.querySelector('#caption-user span').textContent,assistant:document.querySelector('#caption-assistant span').textContent,card:document.querySelector('#oracle-text').textContent,visibleRows:document.querySelectorAll('.caption-line.visible').length});
   for(const [name,chunks,expected]of [['word',['Hel','lo',',',' ','world','.'],'Hello, world.'],['repeat',['no',' no',' no','.'],'no no no.'],['chinese',['你','好','，','世界','。'],'你好，世界。']]){reset();for(const text of chunks)await send('assistant',text);rows.push({name,expected,...state()});}
   reset();await send('user','Show me ');await send('assistant','Here is your outfit.');await send('user','the blue shirt.');const interleaved=state();
   reset();await send('assistant','👑'.repeat(3000));const bounded={caption:Array.from(state().assistant).length,card:Array.from(state().card).length};
   reset();await send('user','mirror');await send('user',' stop');const splitStop={stopped:g.intentionalDisconnect,...state()};
   reset();await send('user','Show me the blue shirt.');await send('assistant','Here is your outfit.');return{rows,interleaved,bounded,splitStop};
  })()`);
  result.passed=result.rows.every(r=>r.assistant===r.expected&&r.card===r.expected&&r.visibleRows<=2)&&result.interleaved.user==='Show me the blue shirt.'&&result.interleaved.assistant==='Here is your outfit.'&&result.interleaved.visibleRows===2&&result.bounded.caption===2000&&result.bounded.card===2000&&result.splitStop.stopped;
  result.archiveSha256=archiveSha256;result.scope='Actual packaged Linux Gemini packet parser -> renderer -> caption/card DOM. Deterministic fragments, no cloud provider, physical speech, audio sync or TV-distance proof.';
  await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));const shot=await client.call('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(out,'captions.png'),Buffer.from(shot.data,'base64'));
  console.log(JSON.stringify(result));if(process.env.MIRROR_CAPTION_BASELINE!=='true')assert(result.passed,'Streaming captions failed');
 }finally{client?.close();child.kill('SIGTERM');await delay(200);if(!exited)child.kill('SIGKILL');await fs.rm(profile,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
