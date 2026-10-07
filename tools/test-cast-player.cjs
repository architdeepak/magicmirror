const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('assert/strict');
const fs = require('fs/promises');
const path = require('path');
const http = require('http');
const { pathToFileURL } = require('url');
const { createWakeModelServer } = require('../src/wakeModelServer.cjs');
const { createCastReceiver, TYPES } = require('../src/castReceiver.cjs');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const wakeServer=await createWakeModelServer();
  const root = path.resolve(__dirname, '..');
  const directory = path.join(root, 'artifacts/casting'); await fs.mkdir(directory, { recursive: true });
  const preload = path.join(root, 'src/preload.js');
  const fixture = path.join(directory, 'player.html');
  await fs.writeFile(fixture, `<!doctype html><style>body{background:#071014;color:#b5ffd4;font:18px system-ui;padding:24px}video{width:480px;display:block}iframe{display:none}</style><h1>Reflect casting test</h1><video controls playsinline></video><iframe></iframe><p id="placeholder">Waiting for a phone</p><input><script type="module">import {WatchCastPlayer} from ${JSON.stringify(pathToFileURL(path.join(root, 'src/watchCastPlayer.js')).href)};window.castPlayer=new WatchCastPlayer({video:document.querySelector('video'),frame:document.querySelector('iframe'),placeholder:document.querySelector('p'),urlInput:document.querySelector('input'),openWatch:()=>document.body.dataset.mode='watch',onState:window.mirrorBridge.reportCastState,onNotice:(message)=>window.castError=message});</script>`);
  const win = new BrowserWindow({ width: 620, height: 480, show: false, webPreferences: { preload, partition: `cast-player-test-${process.pid}`, offscreen: true, contextIsolation: true, nodeIntegration: false, autoplayPolicy: 'no-user-gesture-required' } });
  let clip, receiver;
  let deliverCommand = (command) => win.webContents.executeJavaScript(`window.castPlayer.command(${JSON.stringify(command)})`);
  const pending = new Map();
  let savedConnections;
  ipcMain.handle('mirror:save-connections', (_event, input) => {
    savedConnections = input;
    return { hasGeminiKey: !input.clearGemini, spotifyClientId: input.spotifyClientId, secureStorageAvailable: false, rememberConnections: false, remembered: false };
  });
  ipcMain.handle('mirror:spotify-status', () => ({ configured: Boolean(savedConnections?.spotifyClientId), connected: false }));
  ipcMain.handle('mirror:get-config', () => ({ hasGeminiKey: false, geminiVoice: 'Aoede', city: 'San Francisco', units: 'imperial' }));
  ipcMain.handle('mirror:read-memory', () => ({ version: 1, facts: [] }));
  ipcMain.handle('mirror:list-closet', () => ({ version: 1, garments: [] }));
  ipcMain.handle('mirror:wake-model-url',()=>wakeServer.url);
  ipcMain.handle('mirror:cancel-live-tryon-token',()=>true);
  ipcMain.handle('mirror:desktop-cancel', () => true);
  ipcMain.handle('mirror:desktop-presentation', () => ({ active: false }));
  ipcMain.handle('mirror:start-casting', () => receiver.details());
  ipcMain.handle('mirror:stop-casting', async () => { await receiver.stop(); return true; });
  ipcMain.handle('mirror:cast-state', (_event, state) => receiver?.update(state));
  ipcMain.handle('mirror:cast-result', (_event, result) => {
    const entry = pending.get(result.id); if (!entry) return;
    clearTimeout(entry.timeout); pending.delete(result.id);
    if (result.error) entry.reject(new Error(result.error)); else entry.resolve();
  });
  const media = http.createServer((request, response) => {
    if (!clip) { response.writeHead(503); response.end(); return; }
    const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = range ? Number(range[1]) : 0; const end = range?.[2] ? Math.min(Number(range[2]), clip.length - 1) : clip.length - 1;
    if (start >= clip.length) { response.writeHead(416, { 'Content-Range': `bytes */${clip.length}` }); response.end(); return; }
    response.writeHead(range ? 206 : 200, { 'Content-Type': 'video/webm', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, ...(range ? { 'Content-Range': `bytes ${start}-${end}/${clip.length}` } : {}) });
    response.end(clip.subarray(start, end + 1));
  });
  try {
    await win.loadFile(fixture);
    clip = Buffer.from(await win.webContents.executeJavaScript(`(async()=>{
      const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;const ctx=canvas.getContext('2d');
      const stream=canvas.captureStream(12);const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});const chunks=[];
      recorder.ondataavailable=({data})=>chunks.push(data);const done=new Promise(resolve=>recorder.onstop=resolve);recorder.start();
      let tick=0;const paint=setInterval(()=>{ctx.fillStyle='#17495e';ctx.fillRect(0,0,160,90);ctx.fillStyle='#b5ffd4';ctx.fillRect(tick++%130,25,30,40)},80);
      await new Promise(resolve=>setTimeout(resolve,8000));recorder.stop();await done;clearInterval(paint);stream.getTracks().forEach(track=>track.stop());
      const blob=new Blob(chunks,{type:'video/webm'});return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob)});
    })()`), 'base64');
    assert(clip.length > 1000);
    await new Promise((resolve) => media.listen(0, '127.0.0.1', resolve));
    receiver = createCastReceiver({ host: '127.0.0.1', discoveryPort: 0, multicast: false, onCommand: (command) => deliverCommand(command) });
    const { url } = await receiver.start(); const base = new URL(url).origin;
    const soap = async (action, args) => {
      const body = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><u:${action} xmlns:u="${TYPES.AVTransport}"><InstanceID>0</InstanceID>${Object.entries(args).map(([name, value]) => `<${name}>${value}</${name}>`).join('')}</u:${action}></s:Body></s:Envelope>`;
      const response = await fetch(`${base}/AVTransport/control`, { method: 'POST', headers: { 'Content-Type': 'text/xml', SOAPAction: `"${TYPES.AVTransport}#${action}"` }, body });
      const text = await response.text(); assert.equal(response.status, 200, text); return text;
    };
    await win.webContents.executeJavaScript('window.castPlayer.command({action:"volume",volume:45})');
    assert.equal(await win.webContents.executeJavaScript('document.querySelector("video").volume'), .45);
    await soap('SetAVTransportURI', { CurrentURI: `http://127.0.0.1:${media.address().port}/clip.webm`, CurrentURIMetaData: '' });
    await soap('Play', { Speed: 1 });
    const started = Date.now();
    while (!await win.webContents.executeJavaScript('document.querySelector("video").currentTime > .15')) {
      if (Date.now() - started > 7000) throw new Error('Real cast video did not play: ' + await win.webContents.executeJavaScript('window.castError || "no media event"'));
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    assert((await soap('GetTransportInfo', {})).includes('PLAYING'));
    await soap('Pause', {}); assert(await win.webContents.executeJavaScript('document.querySelector("video").paused'));
    await soap('Seek', { Unit: 'REL_TIME', Target: '00:00:01' });
    assert(await win.webContents.executeJavaScript('document.querySelector("video").currentTime >= .9'));
    await soap('Stop', {}); assert((await soap('GetTransportInfo', {})).includes('STOPPED'));
    assert.equal(await win.webContents.executeJavaScript('document.querySelector("video").videoWidth'), 160);
    assert.equal(await win.webContents.executeJavaScript('document.body.dataset.mode'), 'watch');
    await fs.writeFile(path.join(directory, 'cast-player.png'), (await win.webContents.capturePage()).toPNG());
    console.log('Real cast player passed: SOAP load/play/pause/seek/stop reached a decoded WebM video and reported actual TV state.');

    const production = path.join(directory, 'mirror.html');
    const bootstrap = `<base href="${pathToFileURL(path.join(root, 'src/')).href}"><script>
      window.testErrors=[];window.addEventListener('error',event=>window.testErrors.push(event.message));
      localStorage.setItem('mirror.wake','false');localStorage.setItem('mirror.vision','false');localStorage.setItem('mirror.hard-muted','true');
      window.SpeechRecognition=class{start(){window.testRecognition=this;this.onstart?.()}abort(){this.onend?.()}};
    </script>`;
    await fs.writeFile(production, (await fs.readFile(path.join(root, 'src/index.html'), 'utf8')).replace('<head>', `<head>${bootstrap}`));
    win.setContentSize(1080, 1920);
    await win.loadFile(production);
    await win.webContents.executeJavaScript(`(async()=>{
      const started=performance.now();while(!document.querySelector('#loader').classList.contains('done')){
        if(performance.now()-started>25000)throw new Error('Mirror startup timed out: '+window.testErrors.join(','));
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      document.querySelector('.mode-btn[data-mode="watch"]').click();
      document.querySelector('#casting-toggle').click();
      while(document.querySelector('#casting-toggle').getAttribute('aria-pressed')!=='true')await new Promise(resolve=>setTimeout(resolve,20));
    })()`);
    deliverCommand = (command) => new Promise((resolve, reject) => {
      const id = require('crypto').randomUUID();
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error('Production cast command timed out')); }, 5000);
      pending.set(id, { resolve, reject, timeout });
      win.webContents.send('mirror:cast-command', { ...command, id });
    });
    await soap('SetAVTransportURI', { CurrentURI: `http://127.0.0.1:${media.address().port}/clip.webm`, CurrentURIMetaData: '' });
    await soap('Play', { Speed: 1 });
    const actualUi = await win.webContents.executeJavaScript(`(async()=>{
      const assert=(condition,message)=>{if(!condition)throw new Error(message)};
      const video=document.querySelector('#watch-video');const started=performance.now();
      while(video.currentTime<.15){if(performance.now()-started>7000)throw new Error('Mirror cast did not play');await new Promise(resolve=>setTimeout(resolve,40))}
      assert(document.querySelector('#watch-panel').dataset.casting==='true','Cast did not select the media layout');
      assert(getComputedStyle(document.querySelector('.watch-controls')).display==='none','URL controls covered the active cast');
      document.querySelector('#persona-list [data-persona="velora"]').click();
      document.querySelector('[data-depth="cube"]').click();
      assert(window.__mirrorDebug.depthScene.root.getObjectByName('cube-avatar').visible,'3D Converse face did not appear');
      document.querySelector('[data-depth="flat"]').click();
      assert(!window.__mirrorDebug.depthScene.root.getObjectByName('cube-avatar').visible,'2D left a duplicate 3D face');
      document.querySelector('.mode-btn[data-mode="watch"]').click();
      document.querySelector('[data-depth="cube"]').click();
      await video.play();
      document.querySelector('#mute-btn').click();await new Promise(resolve=>setTimeout(resolve,50));
      document.querySelector('#mic-btn').click();await new Promise(resolve=>setTimeout(resolve,100));
      assert(document.querySelector('#app-shell').dataset.mode==='watch'&&!video.paused,'Talking interrupted Watch playback');
      const host=document.querySelector('#avatar-engine');
      const fadeStarted=performance.now();
      while(getComputedStyle(host).visibility!=='visible'&&performance.now()-fadeStarted<1500)await new Promise(resolve=>setTimeout(resolve,25));
      assert(getComputedStyle(host).visibility==='visible'&&host.getBoundingClientRect().width<450,'Talking host did not move into the Watch corner: '+JSON.stringify({visibility:getComputedStyle(host).visibility,width:host.getBoundingClientRect().width,style:host.getAttribute('style'),hostMode:host.dataset.mode,state:document.querySelector('#state-label').textContent,micDisabled:document.querySelector('#mic-btn').disabled,micLabel:document.querySelector('#mic-label').textContent,errors:window.testErrors}));
      assert(Number(getComputedStyle(host.querySelector('.face-host-canvas')).opacity)>.9,'3D mode hid the Watch corner face');
      assert(!window.__mirrorDebug.depthScene.root.getObjectByName('cube-avatar').visible,'Watch left a second face behind the video');
      const recognition=window.testRecognition;
      const result=(text,isFinal=false)=>{const row=[{transcript:text}];row.isFinal=isFinal;recognition.onresult({resultIndex:0,results:[row]})};
      result('tell me about a red dress');result('tell me about a red jacket');
      const userCaption=document.querySelector('#caption-user span');
      assert(userCaption.textContent==='tell me about a red jacket','Interim correction duplicated captions');
      result('latest words '.repeat(120)+'TAIL_SENTINEL');
      assert(userCaption.scrollLeft>0&&userCaption.scrollLeft+userCaption.clientWidth>=userCaption.scrollWidth-2&&userCaption.textContent.endsWith('TAIL_SENTINEL'),'Long captions did not follow latest words');
      result('tell me about a red jacket',true);
      await new Promise(resolve=>setTimeout(resolve,50));
      assert(document.querySelectorAll('.caption-line.visible').length===2,'Latest user and assistant caption rows missing');
      assert(getComputedStyle(document.querySelector('#caption-user')).color!==getComputedStyle(document.querySelector('#caption-assistant')).color,'Caption speaker colors match');
      document.querySelector('#mic-btn').click();await new Promise(resolve=>setTimeout(resolve,150));
      assert(!video.paused,'Stopping the assistant stopped the cast');
      assert(document.querySelector('#oracle-card').classList.contains('empty'),'Stopped assistant still claimed to be listening');
      assert(!window.testErrors.length,'Renderer errors: '+window.testErrors.join(','));
      return {productionPreload:'passed',mediaLayout:'passed',voiceDuringWatch:'passed',rendererErrors:window.testErrors};
    })()`);
    console.log('Mirror casting integration:', JSON.stringify(actualUi));
    await fs.writeFile(path.join(directory, 'mirror-casting.png'), (await win.webContents.capturePage()).toPNG());
    const connectionUi = await win.webContents.executeJavaScript(`(async()=>{
      const assert=(condition,message)=>{if(!condition)throw new Error(message)};
      const key=document.querySelector('#gemini-key');const remember=document.querySelector('#remember-connections');
      assert(remember.disabled&&!remember.checked,'Unavailable encrypted storage allowed remembering secrets');
      const mode=document.querySelector('#app-shell').dataset.mode;
      key.value='synthetic-ui-key';key.dispatchEvent(new KeyboardEvent('keydown',{key:'1',bubbles:true}));
      assert(document.querySelector('#app-shell').dataset.mode===mode,'Typing a connection key changed modes');
      document.querySelector('#spotify-client-id').value='synthetic-public-client';
      document.querySelector('#connection-form').requestSubmit();
      const started=performance.now();
      while(!document.querySelector('#connection-status').textContent.includes('updated for this session')) {
        if(performance.now()-started>4000)throw new Error('Settings save did not finish: '+document.querySelector('#connection-status').textContent);
        await new Promise(resolve=>setTimeout(resolve,20));
      }
      assert(key.value==='','Saved key remained visible in the form');
      assert(document.querySelector('#api-badge').textContent==='GEMINI CONFIGURED','Saved settings did not update voice configuration');
      assert(!document.querySelector('#watch-video').paused,'Saving settings interrupted cast playback');
      return {formSave:'passed',sessionOnly:'passed',keyCleared:'passed',typingShortcuts:'passed'};
    })()`);
    assert.equal(savedConnections.geminiApiKey,'synthetic-ui-key');
    assert.equal(savedConnections.spotifyClientId,'synthetic-public-client');
    assert.equal(savedConnections.remember,false);
    console.log('Connection settings UI:', JSON.stringify(connectionUi));
    win.webContents.send('mirror:desktop-presentation', { active: true });
    await new Promise((resolve) => setTimeout(resolve, 180));
    for (const [width,height] of [[540,960],[1080,1920],[2160,3840]]) {
      win.setContentSize(width,height);
      const resizeStarted=Date.now();
      while (!await win.webContents.executeJavaScript(`innerWidth===${width}&&innerHeight===${height}`)) {
        if(Date.now()-resizeStarted>8000) throw new Error('Offscreen resize did not reach '+width+'x'+height+'; native bounds='+JSON.stringify(win.getContentBounds())+' viewport='+await win.webContents.executeJavaScript('JSON.stringify([innerWidth,innerHeight])'));
        await new Promise((resolve)=>setTimeout(resolve,100));
      }
      const companion = await win.webContents.executeJavaScript(`(()=>{try {
        if(innerWidth!==${width}||innerHeight!==${height})throw new Error('Requested ${width}x${height}, but renderer stayed '+innerWidth+'x'+innerHeight);
        const assert=(value,message)=>{if(!value)throw new Error(message)};
        const shell=document.querySelector('#app-shell').getBoundingClientRect();
        const host=document.querySelector('#avatar-engine');const face=host.getBoundingClientRect();
        const captions=document.querySelector('#live-captions').getBoundingClientRect();
        const dock=document.querySelector('#prompt-form').getBoundingClientRect();
        assert(face.top>=shell.top+shell.height*.68,'Host overlaps managed browser');
        assert(captions.bottom<=dock.top,'Captions overlap Listen/Mute at '+shell.width+'px');
        assert(getComputedStyle(host).visibility==='visible','Companion vanished while desktop is open');
        assert(Number(getComputedStyle(host.querySelector('.face-host-canvas')).opacity)>.9,'3D hid desktop companion');
        assert(getComputedStyle(document.querySelector('#desktop-return')).display!=='none','Return button is hidden');
        return {width:shell.width,height:shell.height,host:'below browser',captions:'above controls'};
        } catch(error) { return {error:error.message,viewport:[innerWidth,innerHeight]}; }
      })()`);
      assert(!companion.error,JSON.stringify(companion));
      console.log('Desktop companion layout:', JSON.stringify(companion));
    }
    win.webContents.send('mirror:desktop-presentation', { active: false });
    await new Promise((resolve) => setTimeout(resolve, 80));
    await win.webContents.executeJavaScript("document.querySelector('#casting-toggle').click()");
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert(await win.webContents.executeJavaScript("document.querySelector('#casting-toggle').getAttribute('aria-pressed')==='false'&&document.querySelector('#watch-video').paused"));
  } finally { wakeServer.close();
    await receiver?.stop(); media.closeAllConnections(); if (media.listening) await new Promise((resolve) => media.close(resolve)); win.destroy(); app.quit();
  }
}).catch((error) => { console.error(error); app.exit(1); });
