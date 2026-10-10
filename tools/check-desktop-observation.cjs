// Real local managed Chromium navigation and one-use screenshot/input checks.
const fs=require('fs/promises'),path=require('path'),os=require('os'),http=require('http');
const assert=require('assert/strict'),{createHash}=require('crypto'),{spawn}=require('child_process');
const {connect}=require('./cdp-client.cjs');
const root=path.resolve(__dirname,'..'),delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const baseline=process.env.MIRROR_OBSERVATION_BASELINE==='true';
 const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'mirror-observation-'));
 const out=path.join(root,'artifacts',baseline?'desktop-observation-before':'desktop-observation');await fs.mkdir(out,{recursive:true});
 const build=path.join(temporary,'app');await fs.cp(process.env.MIRROR_OBSERVATION_BUILD||path.join(root,`dist/linux-${process.arch}-unpacked`),build,{recursive:true});
 const archiveSha256=createHash('sha256').update(await fs.readFile(path.join(build,'resources/app.asar'))).digest('hex');
 let loads=0;
 const server=http.createServer((request,response)=>{
  response.setHeader('Content-Type','text/html');
  if(request.url.startsWith('/sub')){response.end('<title>Subframe</title>subframe');return;}
  response.end(`<!doctype html><title>Observation fixture</title><style>body{margin:0;background:#123039;color:white;font:24px sans-serif}h1{padding:12px}button{display:block;margin:24px;width:240px;height:130px;background:#ceffdf;font:28px sans-serif}iframe{display:none}</style><body data-load="${++loads}" data-clicks="0"><h1>Local observation test</h1><button onclick="document.body.dataset.clicks=String(Number(document.body.dataset.clicks)+1)">Activate current page</button><iframe id="frame" src="/sub?initial"></iframe>`);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/`;
 const wm=spawn(path.join(root,'.tools/native-companion-wm/root/usr/bin/openbox'),[],{stdio:'ignore',env:{...process.env,LD_LIBRARY_PATH:path.join(root,'.tools/native-companion-wm/root/usr/lib/aarch64-linux-gnu'),XDG_DATA_DIRS:path.join(root,'.tools/native-companion-wm/root/usr/share')+':/usr/share'}});
 const child=spawn(path.join(build,'magic-mirror-portal'),['--no-sandbox','--disable-gpu',`--user-data-dir=${temporary}/profile`,'--remote-debugging-address=127.0.0.1','--remote-debugging-port=0'],{cwd:temporary,env:{...process.env,GEMINI_API_KEY:'',DECART_API_KEY:'',MIRROR_KIOSK:'false'},stdio:['ignore','pipe','pipe']});
 let logs='',exit=null,mirror,browser;const cases=[];child.on('exit',(code,signal)=>exit={code,signal});for(const pipe of [child.stdout,child.stderr])pipe.on('data',b=>logs=(logs+b).slice(-12000));
 const until=async(fn,label)=>{const start=Date.now();while(Date.now()-start<45000){if(exit)throw Error('App exited '+JSON.stringify(exit));const value=await fn();if(value)return value;await delay(100);}throw Error(label+' timed out');};
 const report=()=>({archiveSha256,baseline,cases,passed:!baseline&&cases.length===6&&cases.filter(c=>c.stale).every(c=>!c.delivered),scope:'Actual isolated packaged Linux app, local managed Chromium page, real TV-display capture and production IPC input. Reload, same-URL history, subframe navigation and fresh input; no AI inference, physical sensor, native Windows application or external account proof.'});
 try{
  const endpoint=await until(()=>logs.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/)?.[1],'endpoint');const host=new URL(endpoint).host;
  const targets=()=>fetch('http://'+host+'/json/list').then(r=>r.json());const target=await until(async()=>(await targets()).find(t=>t.url.includes('app.asar/src/index.html')),'mirror target');
  mirror=await connect(target.webSocketDebuggerUrl);await mirror.call('Page.enable');
  await mirror.call('Page.addScriptToEvaluateOnNewDocument',{source:`window.__observationFixture=true;localStorage.setItem('mirror.hard-muted','true');localStorage.setItem('mirror.wake','false');localStorage.setItem('mirror.gestures','false');navigator.mediaDevices.getUserMedia=async()=>{throw Error('No physical sensors in this fixture')};`});await mirror.call('Page.reload');
  await until(()=>mirror.evaluate('!!window.__observationFixture&&!!window.__mirrorDebug&&document.querySelector("#loader").classList.contains("done")'),'ready');
  await mirror.evaluate(`window.mirrorBridge.openWebpage(${JSON.stringify(url)})`);
  const page=await until(async()=>(await targets()).find(t=>t.url===url),'managed target');browser=await connect(page.webSocketDebuggerUrl);await browser.call('Page.enable');await browser.call('Runtime.enable');
  const capture=()=>mirror.evaluate('window.mirrorBridge.captureScreen()');
  const counts=()=>browser.evaluate('({load:document.body.dataset.load,clicks:Number(document.body.dataset.clicks),url:location.href})');
  const point=async shot=>{const r=await browser.evaluate('(()=>{const r=document.querySelector("button").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,width:innerWidth,height:innerHeight}})()');return{x:Math.floor(shot.browserRect.x+r.x*shot.browserRect.width/r.width),y:Math.floor(shot.browserRect.y+r.y*shot.browserRect.height/r.height)};};
  const deliver=async(shot,p)=>{try{return{delivered:true,result:await mirror.evaluate(`window.mirrorBridge.desktopAction(${JSON.stringify({action:'click',snapshotId:shot.snapshotId,...p})})`)}}catch(error){return{delivered:false,error:error.message}}};
  const stale=async(name,transition)=>{
   const shot=await capture(),p=await point(shot),before=await counts();await transition();await delay(150);const ready=await counts(),delivery=await deliver(shot,p),after=await counts();cases.push({name,stale:true,before,ready,after,...delivery});await fs.writeFile(path.join(out,'result.json'),JSON.stringify(report(),null,2));
   if(!baseline){assert(!delivery.delivered,name+' accepted an old observation');assert.equal(after.clicks,ready.clicks,name+' sent input');}
  };
  await stale('same-url-reload',async()=>{const before=await counts();await browser.call('Page.reload');await until(async()=>{try{return(await counts()).load!==before.load}catch{return false}},'reload');});
  await stale('same-url-history',()=>browser.evaluate('history.pushState({stage:2},"",location.href);document.querySelector("button").textContent="Different page state"'));
  const shot=await capture(),p=await point(shot),before=await counts();await browser.evaluate('document.querySelector("iframe").src="/sub?next"');await delay(300);const delivery=await deliver(shot,p);assert(delivery.delivered,'Hidden subframe wrongly invalidated main observation');await until(async()=>(await counts()).clicks===before.clicks+1,'subframe click');cases.push({name:'hidden-subframe',stale:false,...delivery,after:await counts()});
  const fresh=await capture(),freshPoint=await point(fresh),previous=await counts(),freshDelivery=await deliver(fresh,freshPoint);assert(freshDelivery.delivered);await until(async()=>(await counts()).clicks===previous.clicks+1,'fresh click');const reused=await deliver(fresh,freshPoint);assert(!reused.delivered,'Reused observation accepted');cases.push({name:'fresh-single-use',stale:false,...freshDelivery,reused,after:await counts()});
  if(!baseline){
   const observeAgent=()=>mirror.evaluate('__mirrorDebug.agentTools.execute("see_screen").then(r=>r.observation)');
   const agentInput=async observation=>{const p=await point(observation),args={action:'click',snapshotId:observation.snapshotId,x:Math.round(p.x/observation.width*1000),y:Math.round(p.y/observation.height*1000)};try{return{delivered:true,result:await mirror.evaluate(`__mirrorDebug.agentTools.execute("computer_action",${JSON.stringify(args)}).then(r=>({result:r.result,observation:r.observation}))`)}}catch(error){return{delivered:false,error:error.message}}};
   const first=await observeAgent(),before=await counts(),activated=await agentInput(first);assert(activated.delivered);await until(async()=>(await counts()).clicks===before.clicks+1,'agent click');
   const repeat=await agentInput(await observeAgent());assert(!repeat.delivered);assert.equal((await counts()).clicks,before.clicks+1);cases.push({name:'agent-repeat-same-document',stale:false,documentId:first.documentId,activated,delivered:repeat.delivered,error:repeat.error});
   const previousLoad=(await counts()).load;await browser.call('Page.reload');await until(async()=>{try{return(await counts()).load!==previousLoad}catch{return false}},'agent next document');
   const next=await observeAgent();assert(first.documentId&&next.documentId&&first.documentId!==next.documentId,'Navigation did not change document identity');const nextBefore=await counts(),nextAction=await agentInput(next);assert(nextAction.delivered,'Fresh document blocked same-position input');await until(async()=>(await counts()).clicks===nextBefore.clicks+1,'agent next-page click');const nextRepeat=await agentInput(await observeAgent());assert(!nextRepeat.delivered);cases.push({name:'agent-new-document',stale:false,previousDocumentId:first.documentId,documentId:next.documentId,...nextAction,repeat:nextRepeat,after:await counts()});
  }
  const screenshot=await capture();await fs.writeFile(path.join(out,'visible-display.jpg'),Buffer.from(screenshot.dataUrl.split(',')[1],'base64'));await fs.writeFile(path.join(out,'result.json'),JSON.stringify(report(),null,2));console.log(JSON.stringify({passed:report().passed,baseline,cases:cases.map(({name,delivered})=>({name,delivered})),archiveSha256}));
 }finally{browser?.close();mirror?.close();child.kill('SIGTERM');wm.kill('SIGTERM');await delay(300);if(!exit)child.kill('SIGKILL');server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(temporary,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(error=>{console.error(error);process.exitCode=1;});
