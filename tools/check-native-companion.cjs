const { app, BrowserWindow, ipcMain, screen, desktopCapturer } = require('electron');
const assert = require('assert/strict');
const fs = require('fs/promises');
const path = require('path');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const { NativeCompanion } = require('../src/nativeCompanion.cjs');
const { createNativeDesktop, nativeAction } = require('../src/nativeDesktop.cjs');
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
  const root=path.resolve(__dirname,'..');const directory=path.join(root,'artifacts/native-companion');await fs.mkdir(directory,{recursive:true});
  let windowManager;
  if(process.env.MIRROR_TEST_WINDOW_MANAGER) {
    const args=process.env.MIRROR_TEST_WM_CONFIG?['--config-file',process.env.MIRROR_TEST_WM_CONFIG]:[];
    windowManager=spawn(process.env.MIRROR_TEST_WINDOW_MANAGER,args,{stdio:'ignore',env:{...process.env,LD_LIBRARY_PATH:process.env.MIRROR_TEST_WM_LIBRARY_PATH||process.env.LD_LIBRARY_PATH,XDG_DATA_DIRS:process.env.MIRROR_TEST_WM_DATA_DIRS||process.env.XDG_DATA_DIRS}});
    await delay(600);
    assert(windowManager.exitCode===null,'Test window manager failed to start');
  }
  const display=screen.getPrimaryDisplay();
  const underlay=new BrowserWindow({ ...display.bounds, frame:false,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false} });
  const fixture=path.join(directory,'underlay.html');
  await fs.writeFile(fixture,'<!doctype html><style>html,body{margin:0;height:100%;background:rgb(210,30,110)}button{position:absolute;left:20px;top:200px;width:200px;height:90px;font:24px sans-serif}</style><button onclick="window.clicks=(window.clicks||0)+1">Native app fixture</button><div style="height:5000px"></div>');
  let companion;
  const win=new BrowserWindow({...display.bounds,frame:false,show:false,webPreferences:{preload:path.join(root,'src/preload.js'),contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,partition:`native-companion-check-${process.pid}`}});
  ipcMain.handle('mirror:get-config',()=>({hasGeminiKey:false,city:'San Francisco',units:'imperial'}));
  ipcMain.handle('mirror:list-closet',()=>({version:1,garments:[]}));
  ipcMain.handle('mirror:read-memory',()=>({version:1,facts:[]}));
  ipcMain.handle('mirror:desktop-presentation',()=>companion.presentation());
  ipcMain.handle('mirror:desktop-cancel',()=>true);
  ipcMain.handle('mirror:close-desktop',()=>{companion.exit();return true});
  companion=new NativeCompanion({getWindow:()=>win,screen,onChange:()=>win.webContents.send('mirror:desktop-presentation',companion.presentation())});
  const original=win.getBounds();
  try {
    assert(companion.supported(),'This desktop does not support shaped companion windows');
    await underlay.loadFile(fixture);underlay.show();
    await win.loadFile(path.join(root,'src/index.html'));win.show();
    let start=Date.now();
    while(!await win.webContents.executeJavaScript('Boolean(window.__mirrorDebug)')) {if(Date.now()-start>30000)throw new Error('Mirror renderer did not initialize');await delay(100)}
    await win.webContents.executeJavaScript("document.querySelector('#persona-list [data-persona=velora]').click()");
    companion.enter('Native fixture');await delay(1200);
    const ui=await win.webContents.executeJavaScript(`(()=>{
      const rect=element=>{const r=element.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}};
      return{desktop:document.querySelector('#app-shell').dataset.desktop,host:rect(document.querySelector('#avatar-engine')),mic:rect(document.querySelector('#mic-btn')),mute:rect(document.querySelector('#mute-btn')),captions:rect(document.querySelector('.live-captions')),back:rect(document.querySelector('#desktop-return'))};
    })()`);
    assert.equal(ui.desktop,'true');
    const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:display.bounds.width,height:display.bounds.height}});
    const image=sources.find(source=>source.display_id===String(display.id))?.thumbnail;assert(image&&!image.isEmpty(),'No display capture');
    await fs.writeFile(path.join(directory,'composed.png'),image.toPNG());
    const bitmap=image.toBitmap();const {width,height}=image.getSize();
    const pixel=(x,y)=>{const offset=(Math.floor(y)*width+Math.floor(x))*4;return{r:bitmap[offset+2],g:bitmap[offset+1],b:bitmap[offset]}};
    const upper=pixel(width*.75,height*.25);assert(upper.r>180&&upper.g<55&&upper.b>85,'Upper mirror pixels covered native app: '+JSON.stringify(upper));
    const lower=pixel(width*.5,height*.9);assert(lower.r<120,'Companion did not draw above native app: '+JSON.stringify(lower));
    for(const [name,rect] of Object.entries(ui).filter(([name])=>name!=='desktop'))assert(rect.y>=height*.68&&rect.height>0,name+' was outside companion region');
    // Actual OS mouse events, rather than dispatchEvent, prove the shape's input region.
    if(['linux','win32'].includes(process.platform)) {
      const x11Click=async(x,y)=>promisify(execFile)('python3',['-c',`import ctypes\nx=ctypes.CDLL('libX11.so.6');t=ctypes.CDLL('libXtst.so.6')\nx.XOpenDisplay.restype=ctypes.c_void_p\nd=x.XOpenDisplay(None)\nt.XTestFakeMotionEvent.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_ulong]\nt.XTestFakeButtonEvent.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_int,ctypes.c_ulong]\nx.XFlush.argtypes=[ctypes.c_void_p]\nx.XCloseDisplay.argtypes=[ctypes.c_void_p]\nt.XTestFakeMotionEvent(d,-1,${Math.round(x)},${Math.round(y)},0)\nt.XTestFakeButtonEvent(d,1,1,0);t.XTestFakeButtonEvent(d,1,0,0);x.XFlush(d);x.XCloseDisplay(d)`]);
      const native=createNativeDesktop();
      const click=async(x,y)=>{
        if(process.platform==='linux')return x11Click(x,y);
        const foreground=await native.inspect();
        assert.equal(foreground.processId,process.pid,'Focus moved outside the companion check windows');
        const observation={foreground,width:display.bounds.width,height:display.bounds.height,displayBounds:display.bounds};
        const input=nativeAction({action:'click',x:x-display.bounds.x,y:y-display.bounds.y},observation,point=>screen.dipToScreenPoint(point));
        return native.perform(input);
      };
      await click(display.bounds.x+100,display.bounds.y+240);await delay(150);
      assert.equal(await underlay.webContents.executeJavaScript('window.clicks||0'),1,'Upper click did not reach native app');
      if(process.platform==='win32') {
        win.focus();await delay(100);
        const area=companion.exposedBounds();
        const point=screen.dipToScreenPoint({x:Math.round(area.x+area.width/2),y:Math.round(area.y+area.height/2)});
        const first=screen.dipToScreenPoint({x:Math.ceil(area.x),y:Math.ceil(area.y)});
        const last=screen.dipToScreenPoint({x:Math.floor(area.x+area.width),y:Math.floor(area.y+area.height)});
        const handle=win.getNativeWindowHandle();
        const mirrorWindowId=handle.length>=8?handle.readBigInt64LE().toString():String(handle.readUInt32LE());
        const input={...point,deltaY:360,mirrorWindowId,bounds:{left:first.x,top:first.y,right:last.x,bottom:last.y}};
        await native.scrollFromGesture(input);await delay(250);
        const scrolled=await underlay.webContents.executeJavaScript('scrollY');
        assert(scrolled>0,'Native gesture wheel did not scroll the exposed app');
        assert.equal(BrowserWindow.getFocusedWindow(),win,'Native gesture stole focus from the companion');
        await native.scrollFromGesture({...input,deltaY:-360});await delay(250);
        assert((await underlay.webContents.executeJavaScript('scrollY'))<scrolled,'Reverse native gesture did not scroll upward');
        console.log('Real Windows native gesture wheel passed: exposed-app down/up and preserved companion focus.');
      }
      const mutedBefore=await win.webContents.executeJavaScript("document.querySelector('#mute-btn').getAttribute('aria-pressed')");
      await click(display.bounds.x+ui.mute.x+ui.mute.width/2,display.bounds.y+ui.mute.y+ui.mute.height/2);await delay(200);
      assert.notEqual(await win.webContents.executeJavaScript("document.querySelector('#mute-btn').getAttribute('aria-pressed')"),mutedBefore,'Companion hard mute did not receive mouse input');
      await click(display.bounds.x+ui.back.x+ui.back.width/2,display.bounds.y+ui.back.y+ui.back.height/2);await delay(200);
      assert(!companion.active,'Return to mirror did not receive mouse input');
    } else companion.exit();
    assert.deepEqual(win.getBounds(),original);assert(!win.isAlwaysOnTop());
    console.log('Actual native companion passed: composed desktop pixels, native-app click-through, interactive hard mute, Return to mirror, and restored window. Windows/TV behavior still requires its own check.');
  } finally {win.destroy();underlay.destroy();windowManager?.kill();app.quit()}
}).catch(error=>{console.error(error);app.exit(1)});
