// Production visual preview; explicit cue playback, not microphone recognition.
const fs=require('fs/promises'),path=require('path'),os=require('os'),assert=require('assert/strict');
const {createHash}=require('crypto');
const {spawn}=require('child_process'),{connect}=require('./cdp-client.cjs');
const root=path.resolve(__dirname,'..'),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const {execFileSync}=require('child_process');const hz=Number(execFileSync('getconf',['CLK_TCK'],{encoding:'utf8'}));
async function tree(pid,rows=[]){try{const raw=await fs.readFile('/proc/'+pid+'/stat','utf8'),f=raw.slice(raw.lastIndexOf(')')+2).trim().split(/\s+/);rows.push({pid,ticks:Number(f[11])+Number(f[12])});const children=(await fs.readFile('/proc/'+pid+'/task/'+pid+'/children','utf8')).trim().split(/\s+/).filter(Boolean);for(const c of children)await tree(Number(c),rows)}catch(e){if(!['ENOENT','ESRCH'].includes(e.code))throw e}return rows}
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'mirror-rig-v2-')),out=path.join(root,'artifacts/rig-benchmark',process.env.MIRROR_BENCH_LABEL||'current');await fs.mkdir(out,{recursive:true});
 const build=path.join(profile,'app');await fs.cp(path.join(root,`dist/linux-${process.arch}-unpacked`),build,{recursive:true});const archiveSha256=createHash('sha256').update(await fs.readFile(path.join(build,'resources/app.asar'))).digest('hex');
 const app=spawn(path.join(build,'magic-mirror-portal'),['--no-sandbox',...(process.env.MIRROR_BENCH_GL==='vulkan'?['--use-gl=angle','--use-angle=vulkan','--use-cmd-decoder=passthrough',...(process.env.MIRROR_BENCH_COMPOSITOR==='gpu'?[]:['--disable-gpu-compositing'])]:['--disable-gpu']),`--user-data-dir=${profile}`,'--remote-debugging-address=127.0.0.1','--remote-debugging-port=0'],{cwd:profile,env:{...process.env,GEMINI_API_KEY:'',DECART_API_KEY:'',MIRROR_KIOSK:'false'},stdio:['ignore','pipe','pipe']});
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
  const mode=id=>{const command='set '+(id==='hd'?'maximum detail':id==='eco'?'efficient quality':'balanced quality');return client.evaluate('__mirrorDebug.gemini.onMirrorCommand('+JSON.stringify(command)+')')};
  await client.evaluate(`document.querySelector('#mute-btn').click()`);await delay(300);
  await client.evaluate(`document.querySelector('#avatar-render-style').value='rig';document.querySelector('#avatar-render-style').dispatchEvent(new Event('change'))`);
  await until(()=>client.evaluate('__mirrorDebug.avatar.rigHost?.ready&&__mirrorDebug.avatar.renderStyle==="rig"'));
  if(process.env.MIRROR_BENCH_MSAA==='false')await client.evaluate(`(async()=>{const a=__mirrorDebug.avatar;await a.setRenderStyle('portrait');a.rigHost.dispose();const {RigFaceHost}=await import('./rigFaceHost.js');a.rigHost=new RigFaceHost(a.host,{antialias:false});a.rigHost.setQuality(a.quality);await a.setRenderStyle('rig')})()`);
  const run=async(style,activity)=>{
   await client.evaluate(`(async()=>{const a=__mirrorDebug.avatar;await a.setRenderStyle(${JSON.stringify(style)});a.presence.update=()=>({expression:{},gaze:{x:0,y:0,confidence:1},performance:{turn:0,nod:0,lean:0}});a.setExpression({});a.setPerformance({});a.setGazeOverride(null);a.setSpeechLevel(0);a.setViseme('rest');clearInterval(window.__benchTimer);window.__benchStarted=performance.now();if(${JSON.stringify(activity)}==='moving')window.__benchTimer=setInterval(()=>{const t=(performance.now()-__benchStarted)/1000;a.setPerformance({turn:.5*Math.sin(t),nod:.15*Math.sin(t*.5),lean:0});a.setGazeOverride({x:.5*Math.sin(t*.7),y:.1*Math.sin(t)});a.setSpeechLevel(.4+.2*Math.sin(t*8));a.setViseme(Math.sin(t*3)>0?'AA':'O')},33)})()`);
   await delay(2000);
   await client.evaluate(`(()=>{window.__benchDraws=[];const r=__mirrorDebug.avatar.rigHost;if(r&&!r.__benchWrapped){const draw=r.renderer.render.bind(r.renderer);r.renderer.render=(...args)=>{const t=performance.now();const value=draw(...args);__benchDraws.push(performance.now()-t);return value};r.__benchWrapped=true}})()`);
   const start=await tree(app.pid),at=Date.now(),before=await client.evaluate('({rig:__mirrorDebug.avatar.rigHost?.snapshot(),power:__mirrorDebug.getPowerState()})');await delay(8000);const end=await tree(app.pid),ms=Date.now()-at;
   const stats=await client.evaluate(`(()=>{const values=__benchDraws.slice().sort((a,b)=>a-b),pct=p=>values[Math.min(values.length-1,Math.floor(values.length*p))]||0;return{rig:__mirrorDebug.avatar.rigHost?.snapshot(),power:__mirrorDebug.getPowerState(),draws:values.length,drawMedianMs:pct(.5),drawP95Ms:pct(.95)}})()`);
   const ticks=end.reduce((sum,p)=>sum+Math.max(0,p.ticks-(start.find(s=>s.pid===p.pid)?.ticks??p.ticks)),0);
   const row={style,activity,cpuPercent:100*ticks/hz/(ms/1000),seconds:ms/1000,before,stats};console.log(JSON.stringify(row));return row;
  };
  const results=[];for(const [style,activity]of[['portrait','settled'],['rig','settled'],['portrait','moving'],['rig','moving'],['rig','settled']])results.push(await run(style,activity));
  const result={archiveSha256,graphicsRequest:process.env.MIRROR_BENCH_GL||'software',antialias:process.env.MIRROR_BENCH_MSAA!=='false',checkedAt:new Date().toISOString(),results,scope:'Actual packaged app, isolated profile, requested graphics path recorded and actual backend in snapshots, fixed 720x1280 DPR1.5 viewport and deterministic acting, camera/voice providers off. Process-tree CPU; renderer synchronous draw timings exclude asynchronous completion. Shared host, no physical Windows/wattage proof.'};await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));
 }catch(error){console.error('Application log:',logs.slice(-7000));const endpoint=logs.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/)?.[1];if(endpoint){try{console.error('Live targets:',JSON.stringify(await fetch('http://'+new URL(endpoint).host+'/json/list').then(r=>r.json())))}catch{}}throw error}finally{client?.close();app.kill('SIGTERM');await delay(200);if(!exited)app.kill('SIGKILL');await fs.rm(profile,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1});
