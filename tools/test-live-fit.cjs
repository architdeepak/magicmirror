// Exercises the canvas renderer and real pose worker without a physical camera.
// Run with: xvfb-run -a electron --no-sandbox tools/test-live-fit.cjs
const { app, BrowserWindow } = require('electron');
const assert = require('assert/strict');
const fs = require('fs/promises');
const path = require('path');
const { pathToFileURL } = require('url');

app.disableHardwareAcceleration();
const root = path.resolve(__dirname, '..');
app.whenReady().then(async () => {
  const directory = path.join(root, 'artifacts', 'live-fit');
  await fs.mkdir(directory, { recursive: true });
  const fixture = path.join(directory, 'fixture.html');
  await fs.writeFile(fixture, '<!doctype html><style>body{margin:0;background:#061014}#stage{position:relative;width:360px;height:640px}video,canvas.overlay{position:absolute;inset:0;width:100%;height:100%}video{object-fit:cover;transform:scaleX(-1)}</style><div id="stage"><video autoplay muted playsinline></video><canvas class="overlay"></canvas></div>');
  const win = new BrowserWindow({ width: 360, height: 640, show: false, webPreferences: { partition: `live-fit-test-${process.pid}`, offscreen: true, contextIsolation: true, nodeIntegration: false } });
  try {
    win.webContents.on('console-message',(_event,_level,message)=>{if(message.startsWith('Body inference:'))console.log(message)});
    await win.loadFile(fixture);
    const overlayUrl = pathToFileURL(path.join(root, 'src/garmentOverlay.js')).href;
    const result = await win.webContents.executeJavaScript(`(async () => {
      const { GarmentOverlay, prepareTexture } = await import(${JSON.stringify(overlayUrl)});
      const assert = (condition, message) => { if (!condition) throw new Error(message); };
      const {drawTexturedTriangle,buildGarmentMesh,projectCameraPoint}=await import(${JSON.stringify(pathToFileURL(path.join(root, 'src/garmentGeometry.js')).href)});
      const flat=document.createElement('canvas');flat.width=flat.height=200;flat.getContext('2d').fillRect(0,0,200,200);
      const seam=document.createElement('canvas');seam.width=seam.height=200;const seamCtx=seam.getContext('2d');
      const corners=[{x:20,y:20,u:0,v:0},{x:180,y:20,u:1,v:0},{x:180,y:180,u:1,v:1},{x:20,y:180,u:0,v:1}];
      drawTexturedTriangle(seamCtx,flat,[corners[0],corners[1],corners[2]]);drawTexturedTriangle(seamCtx,flat,[corners[0],corners[2],corners[3]]);
      const seamPixels=seamCtx.getImageData(30,30,140,140).data;
      for(let i=3;i<seamPixels.length;i+=4)assert(seamPixels[i]>=254,'Shared triangle edge left a transparent grid seam');
      const pantsTexture=document.createElement('canvas');pantsTexture.width=200;pantsTexture.height=400;
      const pantsCtx=pantsTexture.getContext('2d');pantsCtx.fillStyle='#e84050';pantsCtx.fillRect(0,0,100,400);pantsCtx.fillStyle='#4288f0';pantsCtx.fillRect(100,0,100,400);
      const pantsPose=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:0}));
      for(const [index,x,y]of [[23,.7,.3],[24,.3,.3],[25,.5,.55],[26,.2,.55],[27,.72,.85],[28,.35,.85]])Object.assign(pantsPose[index],{x,y,visibility:1});
      const pantsCanvas=document.createElement('canvas');pantsCanvas.width=540;pantsCanvas.height=960;const pantsOutput=pantsCanvas.getContext('2d');
      const drawPants=()=>{pantsOutput.clearRect(0,0,540,960);for(const triangle of buildGarmentMesh(pantsPose,{width:540,height:960},{width:540,height:960},'bottoms'))drawTexturedTriangle(pantsOutput,pantsTexture,triangle)};
      drawPants();
      const sampleJoint=index=>{const point=projectCameraPoint(pantsPose[index],{width:540,height:960},{width:540,height:960});return pantsOutput.getImageData(Math.round(point.x),Math.round(point.y),1,1).data};
      assert(sampleJoint(25)[0]>180&&sampleJoint(25)[3]>250,'Bent knee lost the left trouser texture');
      const bentPants=pantsCanvas.toDataURL();
      pantsPose[27].x=.3;pantsPose[28].x=.7;drawPants();
      assert(sampleJoint(27)[0]>180&&sampleJoint(28)[2]>180,'Crossed cuffs exchanged trouser textures');
      const intersection={x:.5-.2*(.3/.7),y:.55+.3*(.3/.7)};
      const crossing=projectCameraPoint(intersection,{width:540,height:960},{width:540,height:960});
      const overlapPixel=()=>pantsOutput.getImageData(Math.round(crossing.x),Math.round(crossing.y),1,1).data;
      for(const index of [23,25,27])pantsPose[index].z=-.4;drawPants();
      assert(overlapPixel()[0]>180,'Nearer red leg was painted behind the farther blue leg');
      for(const index of [23,25,27])pantsPose[index].z=0;
      for(const index of [24,26,28])pantsPose[index].z=-.4;drawPants();
      assert(overlapPixel()[2]>180,'Nearer blue leg was painted behind the farther red leg');
      const crossedPants=pantsCanvas.toDataURL();
      const video = document.querySelector('video');
      const camera = document.createElement('canvas'); camera.width = 640; camera.height = 360;
      const cameraCtx = camera.getContext('2d'); cameraCtx.fillStyle = '#305269'; cameraCtx.fillRect(0, 0, 640, 360);
      video.srcObject = camera.captureStream(20); await video.play();
      const image = document.createElement('canvas'); image.width = 200; image.height = 240;
      const imageCtx = image.getContext('2d');
      imageCtx.fillStyle = 'white'; imageCtx.fillRect(0, 0, 200, 240);
      imageCtx.fillStyle = '#c83053'; imageCtx.beginPath();
      imageCtx.moveTo(44, 20); imageCtx.lineTo(10, 58); imageCtx.lineTo(36, 93); imageCtx.lineTo(48, 77);
      imageCtx.lineTo(44, 227); imageCtx.lineTo(156, 227); imageCtx.lineTo(152, 77); imageCtx.lineTo(164, 93);
      imageCtx.lineTo(190, 58); imageCtx.lineTo(156, 20); imageCtx.closePath(); imageCtx.fill();
      imageCtx.fillStyle = 'white'; imageCtx.beginPath(); imageCtx.ellipse(100, 19, 23, 22, 0, 0, Math.PI * 2); imageCtx.fill();
      imageCtx.fillStyle = '#ffd99b'; imageCtx.fillRect(71, 79, 58, 6); imageCtx.fillRect(95, 69, 10, 29);
      const cutout = prepareTexture(image);
      assert(cutout.getContext('2d').getImageData(0, 0, 1, 1).data[3] === 0, 'Pale background was not removed');
      const pose = Array.from({ length: 33 }, () => ({ x: .5, y: .5, z: 0, visibility: 0 }));
      Object.assign(pose[11], { x: .57, y: .3, visibility: 1 }); Object.assign(pose[12], { x: .43, y: .3, visibility: 1 });
      Object.assign(pose[23], { x: .545, y: .64, visibility: 1 }); Object.assign(pose[24], { x: .455, y: .64, visibility: 1 });
      const overlay = new GarmentOverlay(document.querySelector('.overlay'), video);
      const firstSelection = overlay.select({ id: 'fixture-old', name: 'Old selection', category: 'top', imageUrl: image.toDataURL() });
      const selected = await overlay.select({ id: 'fixture-shirt', name: 'Fixture shirt', category: 'top', imageUrl: image.toDataURL() });
      await firstSelection;
      assert(selected && overlay.item.id === 'fixture-shirt' && overlay.texture, 'An obsolete image load replaced the current garment');
      // Deterministic body poses establish camera mirroring, motion, and loss
      // behavior; the real worker is exercised separately below.
      overlay.enabled = true; overlay.tracker.update = () => {}; overlay.tracker.getPose = () => pose;
      const bounds = () => {
        const data = overlay.ctx.getImageData(0, 0, overlay.canvas.width, overlay.canvas.height).data;
        let left = overlay.canvas.width; let right = -1; let count = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 80) { const x = (i - 3) / 4 % overlay.canvas.width; left = Math.min(left, x); right = Math.max(right, x); count += 1; }
        return { left, right, count };
      };
      let garmentDrawCalls=0,garmentClearCalls=0;
      const drawImage=overlay.ctx.drawImage.bind(overlay.ctx);overlay.ctx.drawImage=(...args)=>{garmentDrawCalls++;return drawImage(...args)};
      const clearRect=overlay.ctx.clearRect.bind(overlay.ctx);overlay.ctx.clearRect=(...args)=>{garmentClearCalls++;return clearRect(...args)};
      const firstStart=performance.now();overlay.render();const firstRenderMs=performance.now()-firstStart;const first=bounds();
      const initialDrawCalls=garmentDrawCalls,initialClearCalls=garmentClearCalls;
      const reusedStart=performance.now();for(let tick=0;tick<60;tick++)overlay.render();const reused60FramesMs=performance.now()-reusedStart;
      assert(garmentDrawCalls===initialDrawCalls&&garmentClearCalls===initialClearCalls,'Unchanged pose rebuilt or cleared the garment canvas');
      const reuseEvidence={initialDrawCalls,unchanged60FramesDrawCalls:garmentDrawCalls-initialDrawCalls,firstRenderMs,reused60FramesMs};
      assert(first.count > 10_000, 'The selected garment did not render on the body');
      for (const point of pose) point.x += .04;
      overlay.render(); const moved = bounds();
      assert(moved.left < first.left - 20 && moved.right < first.right - 20, 'Garment movement did not match the mirrored camera crop');
      overlay.setFit({ width: 1.3 }); overlay.render(); const wider = bounds();
      assert(wider.right - wider.left > moved.right - moved.left, 'Width adjustment did not change the live fit');
      assert(overlay.ctx.getImageData(134, 320, 1, 1).data[3] > 80, 'Occlusion fixture missed the garment');
      Object.assign(pose[13], { x: .61, y: .5, z: -.4, visibility: 1 });
      Object.assign(pose[15], { x: .54, y: .5, z: -.4, visibility: 1 });
      Object.assign(pose[19], { x: .52, y: .5, z: -.4, visibility: 1 });
      overlay.render();
      assert(overlay.ctx.getImageData(134, 320, 1, 1).data[3] === 0, 'Foreground hands did not reveal the camera over the garment');
      const classes = new Uint8Array(640 * 360); classes.fill(4);
      for(let y=178;y<=181;y++)for(let x=334;x<=351;x++)classes[y*640+x]=2;
      const segmentation={width:640,height:360,classes};
      overlay.tracker.getSegmentation=()=>segmentation;overlay.render();
      assert(overlay.ctx.getImageData(134,320,1,1).data[3]<30,'Skin contour did not reveal the real arm');
      assert(overlay.ctx.getImageData(134,309,1,1).data[3]>80,'Skin contour erased adjacent clothes');
      pose[15].z=0;overlay.render();
      assert(overlay.ctx.getImageData(134,320,1,1).data[3]>80,'Skin behind the torso erased the garment');
      for(let y=195;y<=201;y++)for(let x=343;x<=349;x++)classes[y*640+x]=1;
      overlay.tracker.getSegmentation=()=>({...segmentation});overlay.render();
      assert(overlay.ctx.getImageData(133,352,1,1).data[3]<80,'Hair did not remain over the garment');
      overlay.tracker.getSegmentation=()=>null;
      overlay.tracker.getPose = () => null; overlay.render();
      assert(bounds().count === 0, 'Lost body tracking left a frozen garment visible');
      overlay.tracker.getPose = () => pose; overlay.render(); overlay.setEnabled(false);
      assert(bounds().count === 0, 'Leaving live view left the garment visible');
      overlay.enabled = true; overlay.render();
      video.srcObject.getTracks().forEach((track) => track.stop()); video.srcObject = null; overlay.render();
      assert(bounds().count === 0, 'Camera-off left a frozen garment visible');
      overlay.destroy();
      return { first, moved, wider, pixelChecks: 14, reuseEvidence, bentLegPixels: 'passed', bentPants, crossedPants, garmentImage: image.toDataURL() };
    })()`);
    assert.equal(result.pixelChecks, 14);
    const { garmentImage, bentPants, crossedPants, ...pixelChecks } = result;
    for(const [name,encoded]of [['bent-trousers',bentPants],['crossed-trousers',crossedPants]])await fs.writeFile(path.join(directory,name+'.png'),Buffer.from(encoded.split(',')[1],'base64'));
    console.log('Live-fit rendering:', JSON.stringify(pixelChecks));
    await fs.writeFile(path.join(directory,'raster-reuse.json'),JSON.stringify({runtime:'Electron canvas',input:'synthetic camera and poses',...pixelChecks.reuseEvidence},null,2)+'\n');

    // Google's public MediaPipe test image gives the actual worker an image
    // containing a person rather than a fabricated landmark result.
    const response = await fetch('https://storage.googleapis.com/mediapipe-assets/pose.jpg');
    if (!response.ok) throw new Error(`Pose fixture download failed (${response.status})`);
    const photo = Buffer.from(await response.arrayBuffer());
    const dataUrl = `data:image/jpeg;base64,${photo.toString('base64')}`;
    win.webContents.session.enableNetworkEmulation({offline:true});
    const trackingUrl = pathToFileURL(path.join(root, 'src/bodyTracking.js')).href;
    const tracking = await win.webContents.executeJavaScript(`(async () => {
      const { BodyTracking } = await import(${JSON.stringify(trackingUrl)});
      const video = document.querySelector('video');
      const image = new Image(); image.src = ${JSON.stringify(dataUrl)}; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      video.srcObject = canvas.captureStream(20); await video.play();
      const statuses = [], messages = []; const tracker = new BodyTracking(video, (state, message) => { statuses.push(state); messages.push(message); });
      tracker.setEnabled(true);
      const workerEvents=[];const onWorkerMessage=tracker.worker.onmessage;
      tracker.worker.onmessage=(event)=>{if(event.data.type==='pose'&&workerEvents.length<10)console.log('Body inference: '+JSON.stringify({ms:event.data.inferenceMs,delegate:event.data.segmentationDelegate,mask:Boolean(event.data.segmentation)}));workerEvents.push({type:event.data.type,id:event.data.requestId,inferenceMs:event.data.inferenceMs,mask:Boolean(event.data.segmentation),segmentationNotice:event.data.segmentationNotice});onWorkerMessage(event);};
      const until = async (predicate, timeout) => {
        const started = performance.now();
        while (!predicate()) {
          if (statuses.includes('unavailable')) throw new Error('Real pose worker failed: ' + messages[messages.length - 1] + '; messages=' + JSON.stringify(workerEvents));
          if (performance.now() - started > timeout) throw new Error('Pose worker observation timed out: ' + statuses.join(',')+'; messages='+JSON.stringify(workerEvents.slice(-6)));
          ctx.drawImage(image, 0, 0); tracker.update();
          await new Promise((resolve) => setTimeout(resolve, 55));
        }
      };
      try {
        // Slow CPU masks are sampled between faster poses. Observe an actual
        // fresh masked frame rather than assuming every pose contains a mask.
        await until(() => Boolean(tracker.getPose() && tracker.getSegmentation()), 75_000);
        if(!tracker.getCameraFrame())throw new Error('Pose result lost its matching display frame');
        const landmarks = tracker.getPose().length;
        const segmentation=tracker.getSegmentation();
        if(!segmentation)throw new Error('Real body segmentation did not return a mask: '+tracker.segmentationNotice);
        const counts={};for(const category of segmentation.classes)counts[category]=(counts[category]||0)+1;
        if(!counts[2]||!counts[3]||!counts[4])throw new Error('Segmentation did not recognize skin, face, and clothing: '+JSON.stringify(counts));
        if (landmarks !== 33) throw new Error('The real model did not return 33 body landmarks');
        const {GarmentOverlay}=await import(${JSON.stringify(overlayUrl)});
        const preview=new GarmentOverlay(document.querySelector('.overlay'),video);
        await preview.select({id:'real-model-preview',name:'Test shirt',category:'top',imageUrl:${JSON.stringify(garmentImage)}});
        const pose=tracker.getPose();preview.enabled=true;preview.tracker.update=()=>{};
        preview.tracker.getPose=()=>pose;preview.tracker.getSegmentation=()=>segmentation;preview.render();
        const composite=document.createElement('canvas');composite.width=360;composite.height=640;
        const painter=composite.getContext('2d');const cover=Math.max(360/canvas.width,640/canvas.height);
        painter.save();painter.translate(360,0);painter.scale(-1,1);painter.drawImage(canvas,(360-canvas.width*cover)/2,(640-canvas.height*cover)/2,canvas.width*cover,canvas.height*cover);painter.restore();
        painter.drawImage(preview.canvas,0,0,360,640);const previewImage=composite.toDataURL('image/png');preview.destroy();
        tracker.setEnabled(false);
        if (tracker.getPose()) throw new Error('Disabling body tracking did not clear its pose');
        return { landmarks, previewImage, segmentation:{width:segmentation.width,height:segmentation.height,counts}, statuses: [...new Set(statuses)], frameSharing: 'local worker' };
      } finally { tracker.destroy(); video.srcObject.getTracks().forEach((track) => track.stop()); }
    })()`);
    win.webContents.session.disableNetworkEmulation();
    const {previewImage,...trackingEvidence}=tracking;
    await fs.writeFile(path.join(directory,'real-contour-fit.png'),Buffer.from(previewImage.split(',')[1],'base64'));
    console.log('Real pose worker:', JSON.stringify(trackingEvidence));

    const bootstrap = `<base href="${pathToFileURL(path.join(root, 'src/')).href}"><script>
      window.testErrors = []; window.addEventListener('error', (event) => window.testErrors.push(event.message));
      window.testRenderRequests = 0;
      localStorage.setItem('mirror.hard-muted', 'true'); localStorage.setItem('mirror.wake', 'false');
      localStorage.setItem('mirror.vision', 'false'); localStorage.setItem('mirror.closet.selected', 'app-test-shirt');
      window.mirrorBridge = {
        getConfig: async () => ({ hasGeminiKey: false, hasTryOnProvider: true, tryOnProviderHost: 'the local test renderer', city: 'San Francisco', units: 'imperial', geminiVoice: 'Aoede' }),
        readMemory: async () => ({ version: 1, facts: [] }),
        listCloset: async () => ({ version: 1, garments: [{ id: 'app-test-shirt', name: 'Test shirt', category: 'top', imageUrl: ${JSON.stringify(garmentImage)} }] }),
        queueTryOn: async (input) => {
          if (!input.consent || !input.frameDataUrl.startsWith('data:image/jpeg;base64,')) throw new Error('Invalid consented camera capture');
          window.testRenderRequests += 1;
          return { resultUrl: ${JSON.stringify(garmentImage)}, garmentName: 'Test shirt', latencyMs: 1, providerConfigured: true };
        }
      };
    </script>`;
    const fullFixture = path.join(directory, 'mirror.html');
    await fs.writeFile(fullFixture, (await fs.readFile(path.join(root, 'src/index.html'), 'utf8')).replace('<head>', `<head>${bootstrap}`));
    win.setContentSize(1080, 1920);
    await win.loadFile(fullFixture);
    const ui = await win.webContents.executeJavaScript(`(async () => {
      const started = performance.now();
      while (innerWidth!==1080||innerHeight!==1920) {
        if(performance.now()-started>8000)throw new Error('Full mirror viewport did not reach 1080x1920: '+innerWidth+'x'+innerHeight);
        await new Promise(resolve=>setTimeout(resolve,40));
      }
      while (!document.querySelector('#loader').classList.contains('done') || !window.__mirrorDebug?.garmentOverlay.texture) {
        if (performance.now() - started > 20_000) throw new Error('Full mirror startup timed out: ' + window.testErrors.join(','));
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const assert = (condition, message) => { if (!condition) throw new Error(message); };
      const overlay = window.__mirrorDebug.garmentOverlay;
      document.querySelector('[data-mode="ar"]').click();
      assert(overlay.enabled && document.querySelector('#app-shell').dataset.tryonView === 'live', 'Try On did not activate local live fit');
      assert(document.querySelector('#studio-tools').hidden, 'Garment selection left the large tools drawer over the camera');
      document.querySelector('#studio-tools-toggle').click();
      assert(!document.querySelector('#studio-tools').hidden, 'Show tools did not expose the fit controls');
      const width = document.querySelector('#garment-width'); width.value = '1.24'; width.dispatchEvent(new Event('input'));
      assert(overlay.fit.width === 1.24, 'Fit control did not update the active garment');
      assert(JSON.parse(localStorage.getItem('mirror.closet.fit.app-test-shirt')).width === 1.24, 'Fit adjustment was not saved per garment');
      document.querySelector('#garment-fit-reset').click(); assert(overlay.fit.width === 1, 'Reset fit did not restore defaults');
      assert(document.querySelector('#tryon-still').disabled, 'Rendered still was enabled before a render existed');
      assert(window.testRenderRequests === 0 && document.querySelector('#tryon-run').disabled, 'Live fit captured or rendered a frame without consent');
      const {toggleCamera}=await import(${JSON.stringify(pathToFileURL(path.join(root,'src/headTracking.js')).href)});
      await toggleCamera(false);
      const camera = document.createElement('canvas'); camera.width = 640; camera.height = 360;
      camera.getContext('2d').fillRect(0, 0, 640, 360);
      const video = document.querySelector('#camera-feed'); const captureStream = camera.captureStream(20); video.srcObject = captureStream; await video.play();
      const consent = document.querySelector('#tryon-consent'); consent.checked = true; consent.dispatchEvent(new Event('change'));
      document.querySelector('#tryon-run').click();
      const renderStarted = performance.now();
      while (document.querySelector('#app-shell').dataset.tryonView !== 'rendered') {
        if (performance.now() - renderStarted > 3000) throw new Error('Mock still did not complete: ' + document.querySelector('#tryon-status').textContent);
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      assert(window.testRenderRequests === 1 && !overlay.enabled && !overlay.tracker.enabled, 'Rendered still did not suspend local body tracking');
      assert(getComputedStyle(document.querySelector('#garment-fit')).display === 'none', 'Live fit controls remained visible over a rendered still');
      document.querySelector('#tryon-live').click(); assert(overlay.enabled && !document.querySelector('#garment-fit').hidden, 'Returning to live camera did not restore the fit controls');
      const pendingRenders = []; const cancelledRenders = [];
      window.mirrorBridge.queueTryOn = input => new Promise(resolve => pendingRenders.push({ input, resolve }));
      window.mirrorBridge.cancelTryOn = async id => cancelledRenders.push(id);
      document.querySelector('#tryon-run').click();
      assert(!document.querySelector('#tryon-cancel').hidden, 'Cancel render was not shown during a request');
      document.querySelector('#tryon-cancel').click();
      assert(!document.querySelector('#tryon-run').disabled && document.querySelector('#tryon-cancel').hidden, 'Cancel did not release render controls');
      document.querySelector('#tryon-run').click();
      pendingRenders[0].resolve({ resultUrl: 'file:///stale-render.png', garmentName: 'Old shirt', latencyMs: 1 });
      await new Promise(resolve => setTimeout(resolve, 30));
      assert(document.querySelector('#tryon-run').disabled && !document.querySelector('#tryon-cancel').hidden, 'Late old result released the current request');
      assert(document.querySelector('#app-shell').dataset.tryonView === 'live', 'Cancelled result replaced the live camera');
      pendingRenders[1].resolve({ resultUrl: ${JSON.stringify(garmentImage)}, garmentName: 'New shirt', latencyMs: 1 });
      await new Promise(resolve => setTimeout(resolve, 30));
      assert(document.querySelector('#app-shell').dataset.tryonView === 'rendered', 'Replacement render did not reach the screen');
      document.querySelector('#tryon-live').click();
      document.querySelector('#tryon-run').click();
      document.querySelector('[data-mode="mirror"]').click();
      assert(cancelledRenders.length === 2, 'Leaving Try On did not cancel its request');
      pendingRenders[2].resolve({ resultUrl: 'file:///late-mode-render.png', garmentName: 'Late shirt', latencyMs: 1 });
      await new Promise(resolve => setTimeout(resolve, 30));
      assert(document.querySelector('#app-shell').dataset.tryonView === 'live', 'Late result appeared after leaving Try On');
      captureStream.getTracks().forEach((track) => track.stop());
      if (video.srcObject === captureStream) video.srcObject = null;
      document.querySelector('[data-mode="mirror"]').click(); assert(!overlay.enabled && !overlay.tracker.enabled, 'Leaving Try On did not suspend body inference');
      document.querySelector('[data-mode="ar"]').click();
      // Validate that the newly declared voice tool is part of the actual
      // setup message sent over the wire, and that its callback is dispatched.
      const { GeminiLiveAdapter } = await import(${JSON.stringify(pathToFileURL(path.join(root, 'src/geminiLiveAdapter.js')).href)});
      let adjustment = null; const messages = [];
      const adapter = new GeminiLiveAdapter({ avatar: {}, config: { geminiModel: 'test', geminiVoice: 'Aoede' }, onTryOnAdjust: async (args) => { adjustment = args; return { result: 'adjusted' }; } });
      adapter._send = (message) => messages.push(message); adapter._sendSetup();
      const declarations = messages[0].setup.tools.flatMap((tool) => tool.functionDeclarations);
      assert(declarations.some((tool) => tool.name === 'adjust_try_on'), 'Fit tool was missing from the Gemini setup schema');
      await adapter._handleToolCall({ functionCalls: [{ name: 'adjust_try_on', id: 'fit-test', args: { width: 1.2 } }] });
      assert(adjustment?.width === 1.2 && messages.at(-1).toolResponse.functionResponses[0].response.result === 'adjusted', 'Fit voice tool did not dispatch its callback');
      let finishCapture; let actionsAfterStop = 0; const staleMessages = [];
      const stopped = new GeminiLiveAdapter({
        avatar: {}, config: {},
        onCaptureScreen: () => new Promise((resolve) => { finishCapture = resolve; }),
        onComputerAction: async () => { actionsAfterStop += 1; }
      });
      stopped._send = (message) => staleMessages.push(message);
      const pendingTool = stopped._handleToolCall({ functionCalls: [{ name: 'see_screen', id: 'old-screen' }, { name: 'computer_action', id: 'old-click', args: { action: 'click' } }] });
      stopped.disconnect();
      // A new connection must not inherit the old turn's captured image or
      // queued input, even if it resumes before the old capture resolves.
      stopped.intentionalDisconnect = false;
      finishCapture({ dataUrl: 'data:image/jpeg;base64,fixture', snapshotId: 'old' });
      await pendingTool;
      assert(actionsAfterStop === 0 && staleMessages.length === 0, 'A cancelled turn leaked a screenshot or queued input into the next session');
      await new Promise((resolve) => setTimeout(resolve, 450));
      assert(document.querySelector('.mode-btn.active')?.dataset.mode === 'ar', 'The navigation highlight disagrees with the current Try On view');
      await new Promise(resolve=>setTimeout(resolve,500));
      const hostBounds = document.querySelector('#avatar-engine').getBoundingClientRect();
      const shellBounds = document.querySelector('#app-shell').getBoundingClientRect();
      assert(hostBounds.width < shellBounds.width * .4 && hostBounds.top < shellBounds.height * .3, 'The compact Try On host covers the body preview');
      const shell=document.querySelector('#app-shell');
      for(const position of ['left','right','upper','lower']) {
        shell.dataset.avatarPosition=position;await new Promise(resolve=>setTimeout(resolve,500));
        const bounds=document.querySelector('#avatar-engine').getBoundingClientRect();
        assert(bounds.width<shellBounds.width*.4&&bounds.height<shellBounds.height*.25,'Try On position '+position+' expanded the host over the body');
      }
      shell.dataset.avatarPosition='center';await new Promise(resolve=>setTimeout(resolve,500));
      document.querySelector('#studio-tools-toggle').click();
      assert(document.querySelector('#studio-tools').hidden && !document.querySelector('#tryon-live').disabled, 'Collapsing tools hid the live/still view switch');
      await new Promise((resolve) => setTimeout(resolve, 120));
      assert(!window.testErrors.length, 'Mirror renderer errors: ' + window.testErrors.join(','));
      return { fitControls: 'passed', modeLifecycle: 'passed', consentBoundary: 'passed', stillComparison: 'passed', renderCancellation: 'passed', voiceTool: 'passed', stoppedToolTurn: 'passed', rendererErrors: window.testErrors };
    })()`);
    console.log('Full mirror integration:', JSON.stringify(ui));
    await fs.writeFile(path.join(directory, 'mirror-live-fit.png'), (await win.webContents.capturePage()).toPNG());
  } finally { win.destroy(); app.quit(); }
}).catch((error) => { console.error(error); app.exit(1); });
