// External playback check. Requires reachable YouTube; no account/key/media upload.
const {app,BrowserWindow,ipcMain,session}=require('electron');
const fs=require('fs/promises');const path=require('path');const vm=require('vm');const {pathToFileURL}=require('url');
const {createYouTubePlayerServer}=require('../src/youtubePlayerServer.cjs');
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
  const directory=path.join(__dirname,'../artifacts/youtube-live');await fs.mkdir(directory,{recursive:true});
  const server=await createYouTubePlayerServer();
  ipcMain.handle('mirror:youtube-player-url',()=>server.url);
  const win=new BrowserWindow({width:720,height:480,show:false,webPreferences:{preload:path.join(__dirname,'../src/preload.js'),offscreen:true,contextIsolation:true,nodeIntegration:false,autoplayPolicy:'no-user-gesture-required'}});
  const issues=[];win.webContents.on('console-message',(_event,level,message)=>{if(level>=2)issues.push(message.slice(0,300));});
  // Install exactly the app's production Referer hook against this window.
  const source=await fs.readFile(path.join(__dirname,'../src/main.js'),'utf8');
  vm.runInNewContext(source.slice(source.indexOf('  const playerIdentity ='),source.indexOf('  createWindow();',source.indexOf('  const playerIdentity ='))),{session,mainWindow:win,require});
  const fixture=path.join(directory,'player.html');
  const video=process.env.MIRROR_YOUTUBE_CHECK_VIDEO||'M7lc1UVf-VE';
  await fs.writeFile(fixture,`<!doctype html><style>body{margin:0;background:#000}iframe{width:720px;height:405px;border:0}</style><iframe sandbox="allow-scripts allow-same-origin allow-presentation" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe><script type="module">
    import {YouTubeWatchPlayer} from ${JSON.stringify(pathToFileURL(path.join(__dirname,'../src/youtubeWatchPlayer.js')).href)};
    import {WatchPlaybackController} from ${JSON.stringify(pathToFileURL(path.join(__dirname,'../src/watchPlaybackController.js')).href)};
    window.notices=[];window.player=new YouTubeWatchPlayer(document.querySelector('iframe'),message=>notices.push(message));
    window.controls=new WatchPlaybackController({video:document.createElement('video'),frame:document.querySelector('iframe'),youtube:player,openWatch(){}});
    window.loading=player.load(${JSON.stringify(video)});
  </script>`);
  const wait=async(predicate,message,timeout=25000)=>{
    const started=Date.now();
    while(!await win.webContents.executeJavaScript(predicate)){
      const snapshot=await win.webContents.executeJavaScript('window.player?.snapshot()');
      if(snapshot?.error)throw new Error(snapshot.error);
      if(Date.now()-started>timeout)throw new Error(message+'; state='+JSON.stringify(snapshot));
      await new Promise(resolve=>setTimeout(resolve,150));
    }
  };
  try{
    await win.loadFile(fixture);await win.webContents.executeJavaScript('window.loading');
    await wait('player.snapshot().ready','YouTube API did not become ready');
    await win.webContents.executeJavaScript("controls.command('play')");
    await wait('player.snapshot().playing&&player.snapshot().position>.3','YouTube video did not play');
    await win.webContents.executeJavaScript("controls.command('pause')");
    await wait('player.snapshot().state===2','YouTube video did not pause',5000);
    const before=await win.webContents.executeJavaScript('player.snapshot().position');
    await win.webContents.executeJavaScript("controls.command('seek',15)");
    await wait(`player.snapshot().position>${before+10}`,'YouTube did not seek',7000);
    const snapshot=await win.webContents.executeJavaScript('player.snapshot()');
    await fs.writeFile(path.join(directory,'player.png'),(await win.webContents.capturePage()).toPNG());
    await fs.writeFile(path.join(directory,'result.json'),JSON.stringify({video,...snapshot},null,2));
    console.log('Real YouTube playback passed:',JSON.stringify({video,ready:snapshot.ready,duration:snapshot.duration,position:snapshot.position,checks:['play','pause','seek']}));
  }catch(error){
    await fs.writeFile(path.join(directory,'failure.png'),(await win.webContents.capturePage()).toPNG());
    console.error('YouTube playback failed:',error.message);console.error('Renderer diagnostics:',JSON.stringify(issues));throw error;
  }finally{await win.webContents.executeJavaScript('window.player?.destroy()').catch(()=>{});win.destroy();server.close();}
  app.quit();
}).catch(error=>{console.error(error.message);app.exit(1)});
