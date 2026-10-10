// Captures the production entrance CSS without microphones or service calls.
const {app,BrowserWindow}=require('electron');
const fs=require('fs/promises');const path=require('path');const assert=require('assert/strict');
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
  const root=path.resolve(__dirname,'..'),directory=path.join(root,'artifacts/wake-preview');
  await fs.mkdir(directory,{recursive:true});
  const source=await fs.readFile(path.join(root,'src/index.html'),'utf8');
  const css=source.match(/<style>([\s\S]*?)<\/style>/)[1];
  const entrance=source.slice(source.indexOf('    <div class="awakening"'),source.indexOf('    <div class="loader"'));
  const fixture=path.join(directory,'fixture.html');
  await fs.writeFile(fixture,`<!doctype html><style>${css}</style><main id="app-shell">${entrance}</main>`);
  const window=new BrowserWindow({width:1080,height:1920,show:false,webPreferences:{offscreen:true,nodeIntegration:false,contextIsolation:true}});
  try{
    await window.loadFile(fixture);
    await window.webContents.executeJavaScript(`document.querySelector('#awakening').classList.add('active')`);
    await new Promise(resolve=>setTimeout(resolve,100));
    for(const time of [550,1150,1850]){
      await window.webContents.executeJavaScript(`document.getAnimations().forEach(a=>{a.pause();a.currentTime=${time}})`);
      await new Promise(resolve=>setTimeout(resolve,60));
      await fs.writeFile(path.join(directory,`reveal-${time}.png`),(await window.webContents.capturePage()).toPNG());
    }
    await window.webContents.debugger.attach('1.3');
    await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    const reduced=await window.webContents.executeJavaScript(`(()=>{const portal=document.querySelector('.awakening-portal');return{motion:matchMedia('(prefers-reduced-motion: reduce)').matches,animation:getComputedStyle(portal).animationName,title:getComputedStyle(document.querySelector('.awakening-title')).opacity}})()`);
    assert(reduced.motion&&reduced.animation==='none'&&reduced.title==='1','Reduced motion did not retain a static entrance');
    await fs.writeFile(path.join(directory,'reduced-motion.png'),(await window.webContents.capturePage()).toPNG());
    console.log('Production wake CSS captures and reduced-motion check passed:',directory);
  }finally{window.destroy();app.quit()}
}).catch(error=>{console.error(error);app.exit(1)});
