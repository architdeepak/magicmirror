// Actual Chromium timer receiver contract; phase DOM/CDP controls are fixtures.
const {app,BrowserWindow}=require('electron'),assert=require('assert/strict'),fs=require('fs/promises'),os=require('os'),path=require('path');
const {setMonitorCameraPhase}=require('./monitor-camera.cjs');app.disableHardwareAcceleration();app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mirror-monitor-timer-')),file=path.join(dir,'fixture.html');await fs.writeFile(file,'<button class="mode-btn" data-mode="mirror">Mirror</button>');const win=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 try{await win.loadFile(file);const client={evaluate:expression=>win.webContents.executeJavaScript(expression),call:async()=>{}};
  const baseline=await client.evaluate(`(()=>{const holder={timeout:window.setTimeout};try{const id=holder.timeout(()=>{},1);clearTimeout(id);return{threw:false}}catch(error){return{threw:true,message:error.message}}})()`);assert(baseline.threw);assert.match(baseline.message,/Illegal invocation/);
  await client.evaluate(`(()=>{window.__monitor={camera:{}};window.__mirrorDebug={getMirrorState:()=>({display:{sleeping:false},camera:{active:true}})};return true})()`);
  await setMonitorCameraPhase(client,'mirror');const ordinary=await client.evaluate(`(async()=>{const start=performance.now();await new Promise(resolve=>setTimeout(resolve,20));return performance.now()-start})()`);assert(ordinary>=10);
  await setMonitorCameraPhase(client,'sleep');const accelerated=await client.evaluate(`(async()=>{const start=performance.now();await new Promise(resolve=>setTimeout(resolve,180000));return performance.now()-start})()`);assert(accelerated>=1000&&accelerated<5000);
  console.log(JSON.stringify({passed:true,baseline,ordinaryMs:ordinary,acceleratedOwnedDeadlineMs:accelerated,scope:'Actual isolated Chromium Window timers through the production monitor helper; DOM/phase controls are fixtures. No application sleep or camera proof.'}));
 }finally{win.destroy();await fs.rm(dir,{recursive:true,force:true});}
}).then(()=>app.quit()).catch(error=>{console.error(error);app.exit(1)});
