// Runs the built executable, not electron . or a reconstructed renderer fixture.
const assert = require('assert/strict');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const { listPackage, extractFile } = require('@electron/asar');
const root = path.resolve(__dirname,'..');
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
const binary = path.resolve(process.argv[2] || path.join(root,`dist/linux-${process.arch}-unpacked/magic-mirror-portal`));
const {connect}=require('./cdp-client.cjs');

(async()=>{
  await fs.access(binary);
  const archive=path.join(path.dirname(binary),'resources/app.asar');
  const files=listPackage(archive);
  const metadata=JSON.parse(extractFile(archive,'package.json').toString());
  for(const model of JSON.parse(extractFile(archive,'src/assets/models/mediapipe-models.json')).models) {
    const bytes=extractFile(archive,'src/assets/models/'+model.file);
    assert.equal(bytes.length,model.bytes);
    assert.equal(require('crypto').createHash('sha256').update(bytes).digest('hex'),model.sha256);
  }
  for (const file of ['/src/liveTryOn.js', '/src/liveTryOnTokens.cjs', '/src/vendor/decart-sdk.js', '/src/vendor/frame-metadata-worker.js']) assert(files.includes(file), 'Package missing ' + file);
  assert.equal(metadata.mirrorAppId,require('../package.json').build.appId,'Runtime application ID did not survive packaging');
  for(const file of ['/src/main.js','/src/preload.js','/src/poseTrackingWorker.js','/src/garmentOcclusion.js','/src/nativeDesktop.ps1','/src/youtube-player.html','/node_modules/three/build/three.module.js','/node_modules/three/examples/jsm/loaders/GLTFLoader.js','/node_modules/three/examples/jsm/loaders/FBXLoader.js','/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs','/node_modules/vosk-browser/dist/vosk.js'])assert(files.includes(file),'Package missing '+file);
  assert(!files.includes('/.env'),'Development credentials were packaged');
  assert(!files.some(file=>file.startsWith('/tools/')||file.startsWith('/.tools/')),'Development tools were packaged');
  const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'mirror-package-check-'));
  const profile=path.join(temporary,'profile');await fs.mkdir(profile);
  const directory=path.join(root,'artifacts/packaged');await fs.mkdir(directory,{recursive:true});
  const fixturePng='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGZkAAAAASUVORK5CYII=';
  const providerRequests=[];
  const page=http.createServer(async(request,response)=>{
    if(request.url==='/tryon'&&request.method==='POST'){
      let body='';for await(const bytes of request)body+=bytes;
      if(request.headers.authorization!=='Bearer synthetic-renderer-token'){response.writeHead(401);response.end();return}
      providerRequests.push(JSON.parse(body));response.setHeader('Content-Type','application/json');response.end(JSON.stringify({imageBase64:fixturePng,mimeType:'image/png'}));return;
    }
    response.setHeader('Content-Type','text/html');response.end('<!doctype html><title>Packaged browser fixture</title><style>body{height:5000px;background:#10283b;color:white;font:30px system-ui}input{font:24px system-ui;width:80%}</style><h1>Packaged mirror browser</h1><input id="edit" aria-label="Text entry"><p>Local scroll fixture</p>');
  });
  await new Promise(resolve=>page.listen(0,'127.0.0.1',resolve));
  let stderr='',exit=null,client,browserClient;
  const child=spawn(binary,['--no-sandbox','--disable-gpu',`--user-data-dir=${profile}`,'--remote-debugging-address=127.0.0.1','--remote-debugging-port=0'],{
    cwd:temporary,env:{...process.env,DECART_API_KEY:'',GEMINI_API_KEY:'',MIRROR_SPOTIFY_CLIENT_ID:'',MIRROR_TRYON_ENDPOINT:'',MIRROR_TRYON_API_KEY:'',MIRROR_VERTEX_PROJECT:'',MIRROR_KIOSK:'false'},stdio:['ignore','pipe','pipe']
  });
  child.stdout.on('data',bytes=>{stderr=(stderr+bytes.toString()).slice(-16000)});
  child.stderr.on('data',bytes=>{stderr=(stderr+bytes.toString()).slice(-16000)});child.on('exit',(code,signal)=>exit={code,signal});child.on('error',error=>exit={error:error.message});
  const until=async(predicate,timeout,label)=>{const started=Date.now();while(true){if(exit)throw new Error('Packaged app exited: '+JSON.stringify(exit)+'; '+stderr.slice(-9000));const value=await predicate();if(value)return value;if(Date.now()-started>timeout)throw new Error(label+' timed out; '+stderr.slice(-9000));await delay(80)}};
  try {
    const debug=await until(()=>stderr.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/)?.[1],30000,'Debug endpoint');
    const origin=new URL(debug);const base=`http://${origin.host}`;
    const targets=()=>fetch(base+'/json/list').then(response=>response.json());
    const target=await until(async()=>(await targets()).find(target=>target.url.includes('app.asar/src/index.html')),30000,'Packaged renderer');
    client=await connect(target.webSocketDebuggerUrl);
    await until(()=>client.evaluate('Boolean(window.__mirrorDebug)&&document.querySelector("#loader").classList.contains("done")'),45000,'Actual mirror startup');
    await client.evaluate('localStorage.setItem("mirror.gestures","false")');
    await client.call('Page.reload');
    await until(()=>client.evaluate('Boolean(window.__mirrorDebug)&&document.querySelector("#loader").classList.contains("done")&&!document.querySelector("#gesture-toggle").checked'),45000,'Startup with gestures disabled');
    await until(async()=>!(await client.call('Target.getTargets')).targetInfos.some(info=>info.url.includes('handTrackingWorker.js')),5000,'Disabled gestures without a hand model worker');
    console.log('Packaged startup: passed');
    const second = spawn(binary, ['--no-sandbox', '--disable-gpu', `--user-data-dir=${profile}`], { cwd: temporary, env: { ...process.env, GEMINI_API_KEY: '', DECART_API_KEY: '', MIRROR_KIOSK: 'false' }, stdio: 'ignore' });
    const secondExit = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { second.kill('SIGKILL'); reject(new Error('Second mirror instance did not exit')); }, 10000);
      second.on('exit', (code, signal) => { clearTimeout(timer); resolve({ code, signal }); });
      second.on('error', error => { clearTimeout(timer); reject(error); });
    });
    assert.equal(secondExit.code, 0, 'Duplicate launch failed instead of handing off to the running mirror');
    assert.equal((await targets()).filter(target => target.url.includes('app.asar/src/index.html')).length, 1);
    console.log('Packaged repeat launch: passed (one mirror instance per profile)');
    const liveCapture = await client.evaluate(`(async()=>{
      const sdk = await import('./vendor/decart-sdk.js');
      const {createPortraitInput} = await import('./liveTryOn.js');
      const source = document.createElement('canvas'); source.width=1280; source.height=720;
      const paint=source.getContext('2d');paint.fillStyle='red';paint.fillRect(0,0,1280,720);
      paint.fillStyle='blue';paint.fillRect(437,0,406,720);
      const camera=source.captureStream(30), video=document.createElement('video');video.muted=true;video.srcObject=camera;
      let portrait, view;
      try {
        await video.play();
        portrait=createPortraitInput(video);view=document.createElement('video');view.muted=true;view.srcObject=portrait.stream;await view.play();
        const pixel=document.createElement('canvas');pixel.width=1;pixel.height=1;
        const context=pixel.getContext('2d');context.drawImage(view,0,0,1,1);
        const color=Array.from(context.getImageData(0,0,1,1).data);
        const settings=portrait.stream.getVideoTracks()[0].getSettings();
        portrait.dispose();
        return {dimensions:[settings.width,settings.height],color,audioTracks:portrait.stream.getAudioTracks().length,
          sourceStillLive:camera.getVideoTracks()[0].readyState==='live',sdkModel:sdk.models.realtime('lucy-vton-3.5').name,
          cloudHidden:document.querySelector('#live-tryon-video').hidden,startDisabled:document.querySelector('#live-tryon-start').disabled};
      } finally {portrait?.dispose();video.pause();video.srcObject=null;if(view){view.pause();view.srcObject=null}camera.getTracks().forEach(track=>track.stop())}
    })()`);
    assert.deepEqual(liveCapture.dimensions,[720,1280]);assert.equal(liveCapture.audioTracks,0);assert(liveCapture.sourceStillLive);
    assert(liveCapture.color[2]>200&&liveCapture.color[0]<30,'Portrait crop did not preserve the center of the source');
    assert.equal(liveCapture.sdkModel,'lucy-vton-3.5');assert(liveCapture.cloudHidden&&liveCapture.startDisabled);
    console.log('Packaged live try-on SDK and actual portrait video capture: passed (local synthetic stream; no cloud session)');
    const wakeModel=await client.evaluate('window.mirrorBridge.wakeModelUrl()');
    const rendererModel=await client.evaluate(`fetch(${JSON.stringify(wakeModel)}).then(async response=>({status:response.status,bytes:(await response.arrayBuffer()).byteLength}))`);assert.equal(rendererModel.status,200);assert(rendererModel.bytes>30000000,'Renderer CSP blocked bundled model');
    const bundledModel=await fetch(wakeModel);assert.equal(bundledModel.status,200);assert(Number(bundledModel.headers.get('content-length'))>30000000);
    const modelBytes=Buffer.from(await bundledModel.arrayBuffer());assert.equal(modelBytes.readUInt16BE(0),0x1f8b);
    console.log('Packaged bundled wake model loopback serving: passed');
    const config=await client.evaluate('window.mirrorBridge.getConfig()');
    assert.equal(config.memoryPath,path.join(profile,'data/memory.json'),'Packaged data ignored the selected writable profile');assert(!config.hasGeminiKey,'Package unexpectedly inherited a Gemini key');
    const state=await client.evaluate(`(async()=>{
      if(document.querySelector('#mute-btn').getAttribute('aria-pressed')!=='true')document.querySelector('#mute-btn').click();
      document.querySelector('#persona-list [data-persona="velora"]').click();
      await window.mirrorBridge.rememberFact({fact:'Packaged smoke fixture',category:'test'});
      return{preload:typeof window.mirrorBridge.saveConnections,scene:Boolean(window.__mirrorDebug.avatar),captions:document.querySelectorAll('.caption-line').length,memory:await window.mirrorBridge.readMemory()};
    })()`);
    assert.equal(state.preload,'function');assert(state.scene);assert.equal(state.captions,2);assert.equal(state.memory.facts[0].fact,'Packaged smoke fixture');
    assert.equal(JSON.parse(await fs.readFile(config.memoryPath,'utf8')).facts[0].fact,'Packaged smoke fixture');
    await client.evaluate(`(async()=>{
      document.querySelector('#gemini-key').value='synthetic-package-fixture';document.querySelector('#remember-connections').checked=false;
      document.querySelector('#connection-form').requestSubmit();
      const started=performance.now();while(!(await window.mirrorBridge.getConfig()).hasGeminiKey){if(performance.now()-started>5000)throw new Error('Packaged Settings did not save');await new Promise(resolve=>setTimeout(resolve,40))}
      document.querySelector('#disable-gemini').click();
      while((await window.mirrorBridge.getConfig()).hasGeminiKey){if(performance.now()-started>8000)throw new Error('Packaged Settings did not disable');await new Promise(resolve=>setTimeout(resolve,40))}
    })()`);
    console.log('Packaged writable memory and Settings: passed');
    const deviceUi = await client.evaluate(`(async()=>{
      const picker=__mirrorDebug.spotifyDevicePicker;
      const originalBridge=picker.bridge, originalTransfer=picker.onTransfer;const calls=[];
      try{
        picker.bridge={spotifyDevices:async()=>[{id:'phone',name:'Phone',active:true},{id:'tv',name:'TV fixture'},{id:'locked',name:'Restricted fixture',restricted:true}],spotifyControl:async action=>{calls.push(action);return{confirmed:false}}};
        picker.onTransfer=()=>{};await picker.refresh();
        const select=document.querySelector('#spotify-device-select');select.value='tv';select.dispatchEvent(new Event('change'));
        document.querySelector('#spotify-device-use').click();await new Promise(resolve=>setTimeout(resolve,50));
        return{calls,options:select.options.length,restricted:select.options[2].disabled,status:document.querySelector('#spotify-device-status').textContent};
      }finally{picker.bridge=originalBridge;picker.onTransfer=originalTransfer;picker.clear()}
    })()`);
    assert.equal(deviceUi.options,3);assert(deviceUi.restricted);assert.deepEqual(deviceUi.calls,[{action:'transfer',deviceId:'tv'}]);assert.match(deviceUi.status,/Switch requested/);
    console.log('Packaged Spotify device controls: passed (local bridge fixture; no Spotify playback)');
    const musicSource=await fs.readFile(path.join(__dirname,'../src/renderer.js'),'utf8');
    const musicFunctions=musicSource.slice(musicSource.indexOf('function clearSpotifyControls('),musicSource.indexOf("document.querySelector('#spotify-open-app').addEventListener"));
    const localMusic=await client.evaluate(`(async()=>{
      const ids={spotifyConnect:'spotify-connect',spotifyDisconnect:'spotify-disconnect',spotifyDeviceRefresh:'spotify-device-refresh',spotifyPlay:'spotify-play',spotifyTitle:'spotify-title',spotifyArtist:'spotify-artist',spotifyAlbum:'spotify-album',spotifyDevice:'spotify-device',spotifyCover:'spotify-cover',spotifyTrackLink:'spotify-track-link',spotifyProgress:'spotify-progress',spotifyStatus:'spotify-status'};
      const elements=Object.fromEntries(Object.entries(ids).map(([key,id])=>[key,document.getElementById(id)]));
      const fixture={mirrorBridge:{spotifyStatus:async()=>({connected:true,configured:true,local:true,accountConfigured:false}),spotifyCurrent:async()=>({connected:true,source:'windows-native',isPlaying:true,canControl:true,canPause:true,canNext:false,canPrevious:true,device:'This Windows PC',progressMs:1200,durationMs:10000,item:{name:'Local track fixture',artists:['Local artist'],album:'Local album',imageUrl:'data:image/png;base64,${fixturePng}'}})}};
      await new Function('window','elements','spotifyDevicePicker', 'let spotifySnapshot=null,spotifyRefreshBusy=false,spotifyLastFetchedAt=0;function renderSpotifyStatus(message){elements.spotifyStatus.textContent=message;}'+${JSON.stringify(musicFunctions)}+';return refreshSpotify();')(fixture,elements,__mirrorDebug.spotifyDevicePicker);
      await elements.spotifyCover.decode();
      return {title:elements.spotifyTitle.textContent,art:!elements.spotifyCover.hidden,connectHidden:elements.spotifyConnect.hidden,disconnectHidden:elements.spotifyDisconnect.hidden,playEnabled:!elements.spotifyPlay.disabled,nextDisabled:document.querySelector('[data-spotify-action="next"]').disabled,devicesDisabled:elements.spotifyDeviceRefresh.disabled,status:elements.spotifyStatus.textContent};
    })()`);
    assert.equal(localMusic.title,'Local track fixture');assert(localMusic.art&&localMusic.connectHidden&&localMusic.disconnectHidden&&localMusic.playEnabled&&localMusic.nextDisabled&&localMusic.devicesDisabled);assert.match(localMusic.status,/this PC/);
    const views=await client.evaluate(`(()=>{const button=document.querySelector('#spotify-views'),card=document.querySelector('#spotify-card');button.click();const first=card.dataset.view;button.click();return {first,second:card.dataset.view,title:document.querySelector('#spotify-title').textContent};})()`);
    assert.equal(views.first,'pocket');assert.equal(views.second,'classic');assert.equal(views.title,'Local track fixture');
    console.log('Packaged local Windows music UI: passed with a local media-session fixture; no actual Windows/Spotify playback.');
    const endpoint=`http://127.0.0.1:${page.address().port}/tryon`;
    const assetPath=path.join(profile,'data/closet/fixture/front.png');await fs.mkdir(path.dirname(assetPath),{recursive:true});await fs.writeFile(assetPath,Buffer.from(fixturePng,'base64'));
    await fs.writeFile(path.join(profile,'data/closet.json'),JSON.stringify({version:1,garments:[{id:'package-shirt',name:'Packaged shirt fixture',category:'top',assetPath}]}));
    const beforeProvider=await client.evaluate('window.mirrorBridge.getConfig()');
    await client.evaluate(`(()=>{
      document.querySelector('#tryon-consent').checked=true;
      const provider=document.querySelector('#tryon-provider');provider.value='custom';provider.dispatchEvent(new Event('change'));
      document.querySelector('#tryon-endpoint').value=${JSON.stringify(endpoint)};document.querySelector('#tryon-token').value='synthetic-renderer-token';
      document.querySelector('#remember-connections').checked=false;document.querySelector('#connection-form').requestSubmit();
    })()`);
    const providerConfig=await until(async()=>{const cfg=await client.evaluate('window.mirrorBridge.getConfig()');return cfg.tryOnProvider==='custom'&&cfg.hasTryOnToken&&cfg},10000,'Packaged renderer Settings');
    assert(!JSON.stringify(providerConfig).includes('synthetic-renderer-token'),'Renderer token leaked through public config');
    await until(()=>client.evaluate('!document.querySelector("#tryon-consent").checked&&document.querySelector("#tryon-token").value===""'),10000,'Updated provider consent boundary');
    assert(await client.evaluate(`document.querySelector('#tryon-consent-copy').textContent.includes(${JSON.stringify(new URL(endpoint).host)})`),'Consent named the wrong provider');
    const stale=await client.evaluate(`window.mirrorBridge.queueTryOn({requestId:'stale-provider',destinationId:${JSON.stringify(beforeProvider.tryOnDestinationId)},garmentId:'package-shirt',consent:true,frameDataUrl:'data:image/png;base64,${fixturePng}'}).then(()=>false,error=>error.message.includes('connection changed'))`);
    assert(stale&&providerRequests.length===0,'Stale consent reached the new provider');
    const rendered=await client.evaluate(`window.mirrorBridge.queueTryOn({requestId:'package-provider',destinationId:${JSON.stringify(providerConfig.tryOnDestinationId)},garmentId:'package-shirt',consent:true,frameDataUrl:'data:image/png;base64,${fixturePng}'})`);
    assert.equal(rendered.status,'rendered');assert.equal(providerRequests.length,1);assert.equal(providerRequests[0].schema,'magicmirror.tryon.v1');assert.equal((await fs.readFile(new URL(rendered.resultUrl))).toString('base64'),fixturePng);
    await client.evaluate(`(()=>{const provider=document.querySelector('#tryon-provider');provider.value='off';provider.dispatchEvent(new Event('change'));document.querySelector('#connection-form').requestSubmit()})()`);
    await until(async()=>!(await client.evaluate('window.mirrorBridge.getConfig()')).hasTryOnProvider,10000,'Packaged renderer Off');
    await until(()=>client.evaluate('document.querySelector("#tryon-run").textContent==="Save local try-on sample"'),10000,'Local try-on label restored');
    console.log('Packaged try-on Settings and provider handshake: passed (synthetic image, local HTTP fixture)');

    await delay(700);
    const portrait=await client.call('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,'startup.png'),Buffer.from(portrait.data,'base64'));
    const playerUrl=await client.evaluate('window.mirrorBridge.youtubePlayerUrl()');const html=await fetch(playerUrl).then(response=>{assert(response.ok);return response.text()});
    const scriptPath=html.match(/src="(\/frame.js\?access=[^"]+)"/)?.[1];assert(scriptPath,'Packaged player bridge did not load');assert((await fetch(new URL(scriptPath,playerUrl))).ok);
    const fixture=`http://127.0.0.1:${page.address().port}/`;
    await client.evaluate(`window.mirrorBridge.openWebpage(${JSON.stringify(fixture)})`);
    const browserTarget=await until(async()=>(await targets()).find(target=>target.url===fixture),10000,'Managed browser');browserClient=await connect(browserTarget.webSocketDebuggerUrl);
    const screenAction=async action=>{
      const shot=await client.evaluate('window.mirrorBridge.captureScreen()');
      assert(shot.supportedKeys.includes('ctrl+a'),'Screen observation omitted supported shortcuts');
      return client.evaluate(`window.mirrorBridge.desktopAction(${JSON.stringify({...action,snapshotId:shot.snapshotId})})`);
    };
    const inputPoint=await browserClient.evaluate(`(()=>{const r=document.querySelector('#edit').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,width:innerWidth,height:innerHeight}})()`);
    const shot=await client.evaluate('window.mirrorBridge.captureScreen()');
    const screenBytes=Buffer.from(shot.dataUrl.split(',')[1],'base64');
    assert.equal(screenBytes.subarray(0,2).toString('hex'),'ffd8','Capture is not JPEG bytes');
    await fs.writeFile(path.join(directory,'desktop-screen.jpg'),screenBytes);
    const click={action:'click',snapshotId:shot.snapshotId,x:Math.round(shot.browserRect.x+inputPoint.x*shot.browserRect.width/inputPoint.width),y:Math.round(shot.browserRect.y+inputPoint.y*shot.browserRect.height/inputPoint.height)};
    await client.evaluate(`window.mirrorBridge.desktopAction(${JSON.stringify(click)})`);
    await until(()=>browserClient.evaluate('document.activeElement.id === "edit"'),3000,'Browser input focus');
    await screenAction({action:'type_text',text:'old search'});
    assert.equal(await browserClient.evaluate('document.querySelector("#edit").value'),'old search','Text action returned before insertion');
    await screenAction({action:'press_key',key:'ctrl+a'});
    await screenAction({action:'type_text',text:'magic mirror 👑'});
    assert.equal(await browserClient.evaluate('document.querySelector("#edit").value'),'magic mirror 👑','Select-all did not replace input text');
    await client.evaluate('window.mirrorBridge.scrollDesktopGesture("down")');
    await until(()=>browserClient.evaluate('scrollY > 0'),3000,'Packaged browser gesture scrolling');
    await client.evaluate('window.mirrorBridge.closeDesktop()');browserClient.close();browserClient=null;
    console.log('Packaged player files and browser click, awaited typing, select-all replacement, and scrolling: passed');
    const photo=await fetch('https://storage.googleapis.com/mediapipe-assets/pose.jpg');assert(photo.ok);const imageUrl='data:image/jpeg;base64,'+Buffer.from(await photo.arrayBuffer()).toString('base64');
    const tracking=await client.evaluate(`(async()=>{
      const {BodyTracking}=await import(new URL('./bodyTracking.js',location.href).href);
      const image=new Image();image.src=${JSON.stringify(imageUrl)};await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);
      const video=document.createElement('video');video.muted=true;video.srcObject=canvas.captureStream(20);await video.play();
      const notices=[];const tracker=new BodyTracking(video,(_state,message)=>notices.push(message));tracker.setEnabled(true);
      try{const started=performance.now();while(!tracker.getSegmentation()){
        if(notices.at(-1)?.includes('unavailable')||notices.at(-1)?.includes('stalled'))throw new Error(notices.at(-1));
        if(performance.now()-started>80000)throw new Error('Packaged body worker did not return a fresh mask: '+notices.at(-1));
        context.drawImage(image,0,0);tracker.update();await new Promise(resolve=>setTimeout(resolve,55));
      }return{landmarks:tracker.getPose().length,maskPixels:tracker.getSegmentation().classes.length,inferenceMs:tracker.inferenceMs};}
      finally{tracker.destroy();video.srcObject.getTracks().forEach(track=>track.stop())}
    })()`,100000);
    assert.equal(tracking.landmarks,33);assert(tracking.maskPixels>0);
    const handPhoto=await fetch('https://storage.googleapis.com/mediapipe-assets/right_hands.jpg');assert(handPhoto.ok);const handImage='data:image/jpeg;base64,'+Buffer.from(await handPhoto.arrayBuffer()).toString('base64');
    const hands=await client.evaluate(`(async()=>{
      const {HandTracking}=await import(new URL('./handTracking.js',location.href).href);
      const image=new Image();image.src=${JSON.stringify(handImage)};await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
      const video=document.createElement('video');video.muted=true;const stream=canvas.captureStream(15);video.srcObject=stream;await video.play();
      let accepted=null;const tracker=new HandTracking(video,(hand,timestamp)=>{if(hand?.length===21)accepted={landmarks:21,ageMs:performance.now()-timestamp}});
      try{if(!await tracker.init())throw new Error('Packaged hand worker initialization failed');tracker.setEnabled(true);const started=performance.now();
        while(!accepted){if(performance.now()-started>30000)throw new Error('Packaged hand worker returned no fresh landmarks');ctx.drawImage(image,0,0);tracker.update();await new Promise(resolve=>setTimeout(resolve,50));}
        return{...accepted,delegate:tracker.delegate,inferenceMs:tracker.inferenceMs};
      }finally{tracker.destroy();stream.getTracks().forEach(track=>track.stop());video.srcObject=null;}
    })()`,100000);
    assert.equal(hands.landmarks,21);assert(hands.ageMs<=350);
    const portraitPhoto=await fetch('https://storage.googleapis.com/mediapipe-assets/portrait.jpg');assert(portraitPhoto.ok);const portraitImage='data:image/jpeg;base64,'+Buffer.from(await portraitPhoto.arrayBuffer()).toString('base64');
    const face=await client.evaluate(`(async()=>{
      const {FaceTracking}=await import(new URL('./faceTracking.js',location.href).href);
      const image=new Image();image.src=${JSON.stringify(portraitImage)};await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
      const video=document.createElement('video');video.muted=true;const stream=canvas.captureStream(30);video.srcObject=stream;await video.play();let result=null;
      const tracker=new FaceTracking(video,(landmarks,timestamp,data)=>{if(landmarks)result={landmarks:landmarks.length,matrixValues:data.matrix?.length,blendshapes:data.blendshapes?.length,ageMs:performance.now()-timestamp}});
      try{if(!await tracker.init())throw new Error('Packaged face worker initialization failed');tracker.setEnabled(true);const started=performance.now();
        while(!result){if(performance.now()-started>30000)throw new Error('Packaged face worker returned no fresh result');ctx.drawImage(image,0,0);tracker.update();await new Promise(resolve=>setTimeout(resolve,25));}
        return{...result,delegate:tracker.delegate,inferenceMs:tracker.inferenceMs};
      }finally{tracker.destroy();stream.getTracks().forEach(track=>track.stop());video.srcObject=null;}
    })()`,100000);
    assert(face.landmarks>=468);assert.equal(face.matrixValues,16);assert(face.blendshapes>=50&&face.ageMs<=300);
    const evidence={platform:process.platform,architecture:process.arch,archive:'passed',startup:'passed',profileStorage:'passed',settings:'passed',tryOnSettings:'passed',tryOnProvider:'local fixture passed; generated realism unverified',playerFiles:'passed',managedBrowserScroll:'passed',localWindowsMusicUI:'passed with local media-session fixture; Windows/Spotify playback unverified',packagedBodyWorker:tracking,packagedHandWorker:hands,packagedFaceWorker:face};
    await fs.writeFile(path.join(directory,'result.json'),JSON.stringify(evidence,null,2)+'\n');console.log('Actual packaged app passed:',JSON.stringify(evidence));
  } catch(error) {
    if(client&&!exit) {
      console.error('Packaged failure state:',await client.evaluate('JSON.stringify({ready:document.readyState,debug:Boolean(window.__mirrorDebug),loader:document.querySelector("#loader-text")?.textContent,body:document.body?.innerText.slice(0,400)})').catch(()=> 'unavailable'));
      const shot=await client.call('Page.captureScreenshot',{format:'png'}).catch(()=>null);if(shot)await fs.writeFile(path.join(directory,'failure.png'),Buffer.from(shot.data,'base64'));
    }
    throw error;
  } finally {
    if(client&&!exit)await client.call('Browser.close').catch(()=>{});
    client?.close();browserClient?.close();if(!exit)child.kill('SIGTERM');
    const deadline=Date.now()+5000;while(!exit&&Date.now()<deadline)await delay(50);if(!exit){child.kill('SIGKILL');await delay(100)}
    page.closeAllConnections();await new Promise(resolve=>page.close(resolve));await fs.rm(temporary,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1});
