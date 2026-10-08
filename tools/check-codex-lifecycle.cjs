// Real packaged UI/IPC with a synthetic app-server, no model or paid service.
const assert=require('assert/strict'),fs=require('fs/promises'),path=require('path'),os=require('os');
const {spawn}=require('child_process'),{connect}=require('./cdp-client.cjs');
const root=path.resolve(__dirname,'..'),delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'mirror-agent-lifecycle-'));
 const executable=path.join(temp,'codex-fixture');
 await fs.writeFile(executable,`#!${process.execPath}\nconst rl=require('readline').createInterface({input:process.stdin});const send=m=>process.stdout.write(JSON.stringify(m)+'\\n');rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});if(m.method==='account/read')send({id:m.id,result:{account:{type:'chatgpt'}}});if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'fixture'}}});if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'turn'}}});send({method:'turn/started',params:{turn:{id:'turn'}}});send({id:100,method:'item/tool/call',params:{tool:'see_screen',arguments:{}}});}});`);await fs.chmod(executable,0o700);
 let logs='',client,exited=false;const errors=[];
 const child=spawn(path.join(root,`dist/linux-${process.arch}-unpacked/magic-mirror-portal`),['--no-sandbox','--disable-gpu',`--user-data-dir=${temp}/profile`,'--remote-debugging-address=127.0.0.1','--remote-debugging-port=0'],{cwd:temp,env:{...process.env,MIRROR_CODEX_PATH:executable,GEMINI_API_KEY:'',DECART_API_KEY:'',MIRROR_KIOSK:'false'},stdio:['ignore','pipe','pipe']});
 child.on('exit',()=>exited=true);for(const stream of [child.stdout,child.stderr])stream.on('data',b=>logs=(logs+b).slice(-12000));
 async function until(fn,label){const start=Date.now();while(Date.now()-start<45000){if(exited)throw new Error('App exited '+logs);const value=await fn();if(value)return value;await delay(100)}throw new Error(label+' timed out '+logs.slice(-1000))}
 try{
  const endpoint=await until(()=>logs.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/)?.[1],'endpoint');
  const target=await until(async()=>(await fetch('http://'+new URL(endpoint).host+'/json/list').then(r=>r.json())).find(t=>t.url.includes('app.asar/src/index.html')),'target');
  client=await connect(target.webSocketDebuggerUrl);await client.call('Page.enable');await client.call('Runtime.enable');
  client.onEvent(e=>{if(e.method==='Runtime.exceptionThrown')errors.push(e.params.exceptionDetails.exception?.description||e.params.exceptionDetails.text)});
  await client.call('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('mirror.hard-muted','false');localStorage.setItem('mirror.wake','false');localStorage.setItem('mirror.gestures','false');navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Sensors disabled in lifecycle fixture','NotAllowedError')};window.__lifecycleFixture=true;`});
  await client.call('Page.reload');await until(()=>client.evaluate('!!window.__lifecycleFixture&&!!window.__mirrorDebug&&document.querySelector("#loader").classList.contains("done")'),'startup');
  await client.evaluate(`window.__lifecycle={captures:0,actions:0};__mirrorDebug.gemini.onCaptureScreen=async()=>{__lifecycle.captures++;await new Promise(r=>setTimeout(r,1200));return{dataUrl:'data:image/jpeg;base64,QUJD',snapshotId:'late',width:540,height:960}};__mirrorDebug.gemini.onComputerAction=async()=>{__lifecycle.actions++};`);
  async function start(){await client.evaluate(`__lifecycle.result=null;void __mirrorDebug.runAgentTask('Inspect the fixture').then(r=>__lifecycle.result=r)`);await until(()=>client.evaluate('__mirrorDebug.getMirrorState().agent.active&&__lifecycle.captures>0'),'active task');assert.equal(await client.evaluate('document.querySelector("#mic-btn").textContent.includes("STOP")'),true);}
  await start();await client.evaluate('document.querySelector("#mic-btn").click()');
  assert.equal((await until(()=>client.evaluate('__lifecycle.result'),'Stop result')).cancelled,true);
  await delay(1500);assert.equal(await client.evaluate('__mirrorDebug.agentTools.observation'),null);assert.equal(await client.evaluate('__lifecycle.actions'),0);
  await client.evaluate('__lifecycle.captures=0');await start();await client.evaluate('document.querySelector("#mute-btn").click()');
  assert.equal((await until(()=>client.evaluate('__lifecycle.result'),'Mute result')).cancelled,true);
  await delay(1500);assert.equal(await client.evaluate('__mirrorDebug.getMirrorState().voice.hardMuted'),true);
  assert.equal((await client.evaluate('__mirrorDebug.runAgentTask("Must not start")')).cancelled,true);
  assert.equal(await client.evaluate('__mirrorDebug.agentTools.observation'),null);
  assert.equal(await client.evaluate('__lifecycle.actions'),0);
  assert.deepEqual(errors,[]);
  const report={checkedAt:new Date().toISOString(),passed:true,scope:'Packaged Linux app, synthetic Codex stdio server and delayed screenshot. Actual Stop/mute buttons and IPC; no real voice/physical sensors/Windows.',checks:['visible Stop while agent runs','Stop kills and resolves task','late screenshot discarded','hard mute kills task','hard mute rejects new task','no late input or renderer errors']};
  await fs.mkdir(path.join(root,'artifacts/codex-lifecycle'),{recursive:true});await fs.writeFile(path.join(root,'artifacts/codex-lifecycle/result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }finally{client?.close();child.kill('SIGTERM');await delay(200);if(!exited)child.kill('SIGKILL');await fs.rm(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e.message);process.exitCode=1});
