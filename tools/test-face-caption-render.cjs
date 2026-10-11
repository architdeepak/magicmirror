// Real Chromium layout and canvas checks, with no camera or account access.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 540, height: 960, webPreferences: { backgroundThrottling: false } });
  try {
    await win.loadURL('about:blank');
    const read = name => fs.readFileSync(path.join(__dirname, '../src', name), 'utf8');
    const renderer = read('renderer.js');
    const decorateStart=renderer.indexOf('function decorateCaptionWords(');
    const decorate = renderer.slice(decorateStart, renderer.indexOf("window.addEventListener('resize'",decorateStart));
    const result = await win.webContents.executeJavaScript(`(async () => {
      const check = (ok, message) => { if (!ok) throw Error(message); };
      const style = document.createElement('style');
      style.textContent = ${JSON.stringify([...read('index.html').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n') + '\n' + read('experience.css'))}; document.head.appendChild(style);
      document.body.innerHTML = '<div id="app-shell" data-quality="eco"><div class="live-captions visible"><div id="caption-assistant" class="caption-line visible"><span></span></div></div></div>';
      ${decorate}
      const node = document.querySelector('#caption-assistant span');
      decorateCaptionWords(node, 'Hello, traveler.');
      const words = node.querySelectorAll('i');
      check(Math.abs(words[0].getBoundingClientRect().top - words[1].getBoundingClientRect().top) < 2, 'Words stacked vertically');
      const first = words[0]; decorateCaptionWords(node, 'Hello, traveler. Welcome home.');
      check(node.firstChild === first, 'Stable streamed word was rebuilt');
      check(node.textContent === 'Hello, traveler. Welcome home.', 'Whitespace lost');
      decorateCaptionWords(node, 'Hel'); const growing = node.firstChild;
      decorateCaptionWords(node, 'Hello'); check(node.firstChild === growing, 'Partial word animation restarted');
      decorateCaptionWords(node, 'Hello there'); check(node.firstChild === growing, 'Completed word animation restarted');
      decorateCaptionWords(node, 'Hello there'); check(node.firstChild === growing, 'Duplicate update replaced words');
      check(node.querySelectorAll('i.latest').length === 1 && node.lastElementChild.classList.contains('latest'), 'Latest highlight did not move');
      decorateCaptionWords(node, 'Hello');
      check(node.querySelectorAll('i.latest').length === 1 && node.firstChild.classList.contains('latest'), 'Correction retained a detached highlight');
      node.textContent = ''; decorateCaptionWords(node, 'Hello there');
      check(node.textContent === 'Hello there' && node.querySelectorAll('i').length === 2, 'New turn retained stale nodes');
      check(!node.firstChild.classList.contains('settled'), 'New turn lost its word reveal');
      decorateCaptionWords(node, 'Hello, <img src=x onerror=alert(1)>');
      check(!node.querySelector('img'), 'Transcript parsed as HTML');
      decorateCaptionWords(node, Array(60).fill('enchanted').join(' '));
      node.scrollTop = node.scrollHeight;
      check(node.scrollHeight > node.clientHeight && node.scrollTop > 0, 'Newest wrapped lines cannot scroll into view');
      const latest = node.querySelector('i.latest').getBoundingClientRect(), box = node.getBoundingClientRect();
      check(latest.top >= box.top - 1 && latest.bottom <= box.bottom + 1, 'Newest word is clipped');
      check(getComputedStyle(node).maskImage === 'none', 'Short captions still dimmed');
      check(getComputedStyle(node.querySelector('i')).animationName === 'none', 'Efficient captions animate');
      const shell = document.querySelector('#app-shell');
      const userRow=document.createElement('div');userRow.id='caption-user';userRow.className='caption-line visible';userRow.innerHTML='<span></span>';node.parentElement.before(userRow);
      const userText=userRow.querySelector('span');
      for (const width of [320, 540, 1080, 2160]) {
        shell.style.width = width + 'px';
        for (const text of ['Welcome home.', 'W'.repeat(180), '你好世界'.repeat(80), Array(100).fill('enchanted').join(' ')]) {
          decorateCaptionWords(node, text); node.scrollTop = node.scrollHeight;
          decorateCaptionWords(userText,text);userText.scrollTop=userText.scrollHeight;
          for(const caption of [node,userText]){
            const computed=getComputedStyle(caption);
            check(Math.abs(parseFloat(computed.maxHeight)-2*parseFloat(computed.lineHeight))<.1,'Caption cap does not follow its own line spacing');
            const last=caption.lastElementChild.getBoundingClientRect(),bounds=caption.getBoundingClientRect();
            check(last.bottom<=bounds.bottom+1,'Interleaved caption newest word clipped');
          }
          const word = node.lastElementChild.getBoundingClientRect(), bounds = node.getBoundingClientRect();
          check(node.scrollWidth <= node.clientWidth + 1, 'Caption overflows at width ' + width);
          check(word.bottom <= bounds.bottom + 1, 'Newest text clipped at width ' + width);
        }
      }
      shell.style.width = ''; shell.dataset.quality = 'auto';
      userRow.remove();
      const toast=document.createElement('div');toast.className='gesture-toast show';shell.append(toast);
      const clockBlock=document.createElement('div');clockBlock.className='mirror-clock';clockBlock.innerHTML='<div id="clock-time">09:18</div><div class="clock-date">Saturday, October 10</div>';shell.append(clockBlock);
      const weatherBlock=document.createElement('div');weatherBlock.className='mirror-weather';weatherBlock.innerHTML='<div><strong>55°</strong><span>CLEAR</span><small>MOUNTAIN VIEW</small></div>';shell.append(weatherBlock);
      for(const width of [320,540,1080,2160]){
        shell.style.width=width+'px';
        for(const message of ['Saved','Camera unavailable. Open Settings and choose another camera, then try again.','W'.repeat(180)]){
          toast.textContent=message;
          const bounds=toast.getBoundingClientRect(),surface=shell.getBoundingClientRect();
          check(bounds.left>=surface.left-1&&bounds.right<=surface.right+1,'Toast escapes mirror at width '+width);
          check(toast.scrollWidth<=toast.clientWidth+1,'Toast text overflows at width '+width);
          check(parseFloat(getComputedStyle(toast).fontSize)>=12,'Toast text is too small');
          check(bounds.top>=Math.max(clockBlock.getBoundingClientRect().bottom,weatherBlock.getBoundingClientRect().bottom)+8,'Toast overlaps clock/weather at width '+width);
        }
      }
      toast.remove();clockBlock.remove();weatherBlock.remove();shell.style.width='';
      const timers=document.createElement('div');timers.className='timer-chip';shell.append(timers);
      for(const width of [320,540,1080,2160]){
        shell.style.width=width+'px';timers.replaceChildren();
        for(const label of ['Tea · 1:30','Getting ready for the evening · 12:34','W'.repeat(180)+' · 0:59','你好'.repeat(60)+' · 2:00']){
          const chip=document.createElement('span');chip.textContent=label;timers.append(chip);
        }
        const surface=shell.getBoundingClientRect();
        for(const chip of timers.children){
          const bounds=chip.getBoundingClientRect();
          check(bounds.left>=surface.left-1&&bounds.right<=surface.right+1,'Timer escapes mirror at width '+width);
          check(chip.scrollWidth<=chip.clientWidth+1,'Timer label overflows at width '+width);
        }
      }
      timers.remove();shell.style.width='';
      const answerCard=document.createElement('div');answerCard.className='search-pool';answerCard.innerHTML='<button class="search-pool-close">×</button><div class="search-pool-eyebrow">The mirror found</div><h2></h2><p></p><div class="search-pool-sources"><button></button></div>';shell.append(answerCard);
      for(const width of [320,540,1080,2160]){
        shell.style.width=width+'px';
        answerCard.querySelector('h2').textContent='A'.repeat(100);
        answerCard.querySelector('p').textContent='https://example.test/'+ 'long-path'.repeat(60);
        answerCard.querySelector('.search-pool-sources button').textContent='source-name'.repeat(30);
        const bounds=answerCard.getBoundingClientRect(),surface=shell.getBoundingClientRect();
        check(bounds.left>=surface.left-1&&bounds.right<=surface.right+1,'Answer card escapes mirror at width '+width);
        check(answerCard.scrollWidth<=answerCard.clientWidth+1,'Answer card scrolls horizontally at width '+width);
        answerCard.scrollTop=answerCard.scrollHeight;
        check(answerCard.scrollTop>0,'Long answer cannot scroll vertically at width '+width);
        const closeBounds=answerCard.querySelector('.search-pool-close').getBoundingClientRect();
        check(closeBounds.top>=bounds.top-1&&closeBounds.bottom<=bounds.bottom+1,'Scrolled answer hides close control at width '+width);
        if(width<=540)check(document.elementFromPoint(closeBounds.left+closeBounds.width/2,closeBounds.top+closeBounds.height/2)===answerCard.querySelector('.search-pool-close'),'Scrolled close control cannot receive pointer input');
      }
      answerCard.remove();shell.style.width='';
      const artwork=document.createElement('img');artwork.className='spotify-cover';shell.append(artwork);
      artwork.hidden=true;check(getComputedStyle(artwork).display==='none','Hidden Spotify artwork remained painted');
      artwork.hidden=false;check(getComputedStyle(artwork).display==='block','Available Spotify artwork did not display');
      artwork.remove();
      const player=document.createElement('div');player.className='spotify-card';player.innerHTML='<p class="spotify-artist"></p><div class="spotify-meta"><span></span></div><div class="spotify-tools"><button>Open Spotify app</button><button>Connect Spotify</button><button>Disconnect</button><button>Switch player view</button></div>';shell.append(player);
      player.querySelector('.spotify-artist').textContent='Artist'.repeat(60);player.querySelector('.spotify-meta span').textContent='Album'.repeat(60);
      for(const id of ['spotify-status','spotify-device-status']){const status=document.createElement('small');status.id=id;status.textContent='ServiceError'.repeat(70);player.append(status)}
      for(const width of [320,540,1080,2160]){shell.style.width=width+'px';check(player.scrollWidth<=player.clientWidth+1,'Spotify metadata/tools overflow at width '+width)}
      player.remove();shell.style.width='';
      for(const className of ['spotify-link','config-note','tryon-run','gesture-hold','local-timer-badge']){
        const control=document.createElement('button');control.className=className;control.hidden=true;shell.append(control);
        check(getComputedStyle(control).display==='none','Hidden control remains displayed: '+className);
        control.focus();check(document.activeElement!==control,'Hidden control received keyboard focus: '+className);control.remove();
      }
      const privacy=document.createElement('div');privacy.className='privacy-chip';privacy.innerHTML='<span><i></i><b></b></span><span><i></i><b>Camera on · stays on device</b></span>';shell.append(privacy);
      for(const width of [320,540,1080,2160]){
        shell.style.width=width+'px';
        for(const message of ['Mic off','Microphone requested','Mic · wake word, on this device','Mic · browser speech recognition','Mic · live, sent to Gemini']){
          privacy.querySelector('b').textContent=message;
          const bounds=privacy.getBoundingClientRect(),surface=shell.getBoundingClientRect();
          check(bounds.left>=surface.left-1&&bounds.right<=surface.right+1,'Privacy chip escapes mirror at width '+width);
          check(privacy.scrollWidth<=privacy.clientWidth+1,'Privacy text overflows at width '+width);
        }
      }
      privacy.remove();shell.style.width='';
      decorateCaptionWords(node, 'Welcome home.');
      check(getComputedStyle(node.firstChild).animationName === 'word-in', 'Balanced word reveal missing');
      shell.dataset.adaptiveMotion='calm';check(getComputedStyle(node.firstChild).animationName==='none','Overloaded captions still animate');
      const pool=document.createElement('div');pool.className='search-pool';shell.append(pool);check(getComputedStyle(pool,'::before').display==='none','Overloaded card bloom still paints');pool.remove();delete shell.dataset.adaptiveMotion;
      ${read('faceFeatures.js').replace('export class FaceFeatures', 'class FaceFeatures')}
      const image = document.createElement('canvas'); image.width = 1024; image.height = 1024;
      const paint = image.getContext('2d'); paint.fillStyle = '#dcb'; paint.fillRect(0, 0, 1024, 1024);
      const face = new FaceFeatures(image, {}), output = document.createElement('canvas'); output.width = 1024; output.height = 1024;
      const ctx = output.getContext('2d'), eye = face.eyes[0];
      face.warp(ctx, eye, 1024, { blink: .5, dx: .02 });
      check(face.stats.strips === 13, 'Blink/gaze exceeds strip budget');
      const strips = face.stats.strips;
      face.warp(ctx, eye, 1024, { blink: .501, dx: .0201 });
      check(face.stats.cached === 1 && face.stats.strips === strips, 'Subpixel changes missed cache');
      face.detail = .5; face.warp(ctx, eye, 1024, { blink: .5, dx: .02 });
      check(face.stats.strips > strips && face.stats.cached === 1, 'Detail change failed to invalidate');
      for (const blink of [0, .5, 1]) face.warp(ctx, eye, 1024, { blink });
      const alpha = eye.output.getContext('2d').getImageData(eye.output.width / 2, eye.output.height / 2, 1, 1).data[3];
      check(alpha > 0, 'Fully closed blink leaves a transparent seam');
      const eyePaint = eye.source.getContext('2d');
      eyePaint.fillStyle = '#fff'; eyePaint.fillRect(0, 0, eye.source.width, eye.source.height);
      eyePaint.fillStyle = '#f00'; eyePaint.fillRect(0, eye.source.height * .28, eye.source.width, eye.source.height * .44);
      eye.key = ''; face.warp(ctx, eye, 1024, { blink: 1 });
      const closed = eye.output.getContext('2d').getImageData(0, 0, eye.output.width, eye.output.height).data;
      face.warp(ctx, eye, 1024, { blink: 1, wide: 1 });
      const surprisedBlink = eye.output.getContext('2d').getImageData(0, 0, eye.output.width, eye.output.height).data;
      check(closed.every((value, index) => value === surprisedBlink[index]), 'Wide-eye expression defeats a full blink');
      ${read('displayQuality.js').replace(/export /g,'')}
      ${read('faceHost.js').replace(/^import .*;$/mg, '').replace('export class FaceHost', 'class FaceHost')}
      const portrait = new Image(); portrait.src = image.toDataURL(); await portrait.decode();
      const hostNode = document.createElement('div'), host = Object.create(FaceHost.prototype);
      let styleWrites = 0;
      const setProperty = hostNode.style.setProperty.bind(hostNode.style);
      hostNode.style.setProperty = (...args) => { styleWrites++; setProperty(...args); };
      Object.assign(host, { host: hostNode, ctx, canvas: output, width: 540, height: 960, ready: true, persona: 'velora', image: portrait, speech: .7, blendshapes: {}, gaze: {x:0,y:0,confidence:1}, viewer: {}, performance: {turn:0,nod:0,lean:0}, performanceSmooth: {turn:0,nod:0,lean:0}, poseBlend: {AA:0,O:0}, viseme: 'AA', drawCount: 0, features: face });
      for (let frame = 0; frame < 60; frame++) host.draw(frame / 30);
      check(host.drawCount === 60 && styleWrites === 3, 'Speech repaint invalidates glow styles');
      const speechGlowWrites=styleWrites;
      host.setViseme('rest'); host.setFace({}, host.gaze, 0, {});
      for (let frame = 60; frame < 260; frame++) host.draw(frame / 30);
      const restingDraws = host.drawCount;
      for (let frame = 260; frame < 320; frame++) { host.setFace({noseSneerLeft:frame/320,tongueOut:frame/320},host.gaze,0,{});host.draw(frame/30); }
      check(host.drawCount === restingDraws, 'Unused channels repaint real canvas');
      host.setFace({eyeBlinkLeft:.8},host.gaze,0,{});host.draw(11);
      check(host.drawCount > restingDraws, 'Real blink does not repaint');
      hostNode.style.width='500px';hostNode.style.height='800px';document.body.append(hostNode);
      Object.defineProperty(window,'devicePixelRatio',{value:1,configurable:true});
      host.setQuality('hd');const fullWidth=host.canvas.width,fullHeight=host.canvas.height;
      host.setRenderScale(.8);
      check(host.canvas.width===Math.floor(fullWidth*.8)&&host.canvas.height===Math.floor(fullHeight*.8),'Adaptive scale fails on a DPR 1 screen');
      check(face.detail<displayProfile('hd').featureDetail&&face.detail>=1,'Feature cost did not adapt');
      host.draw(12);check(ctx.getImageData(host.canvas.width/2,host.canvas.height/2,1,1).data[3]>0,'Resized portrait not repainted');
      host.setRenderScale(1);check(host.canvas.width===fullWidth&&host.canvas.height===fullHeight,'Full detail did not recover');
      const solid=color=>{const c=document.createElement('canvas');c.width=c.height=32;const p=c.getContext('2d');p.fillStyle=color;p.fillRect(0,0,32,32);return c};
      const neutral=new Image();neutral.src=solid('#00ff00').toDataURL();await neutral.decode();
      Object.assign(host,{image:neutral,features:null,blendshapes:{},speech:1,viseme:'AA',speakingReady:true,roundedReady:true,speakingPatch:solid('#ff0000'),roundedPatch:solid('#0000ff'),poseBlend:{AA:.4,O:.6},lastElapsed:13});
      host.draw(13);
      const mouthPixel=()=>ctx.getImageData(250,518,1,1).data;
      const blended=mouthPixel();
      check(blended[1]<=2,'Neutral mouth ghosts beneath a complete AA/O crossfade');
      check(Math.abs(blended[0]-host.poseBlend.AA*255)<=2,'AA pose loses weight behind O');
      const mixContext=host.mouthBlendCanvas.getContext('2d'),originalDraw=mixContext.drawImage;
      mixContext.drawImage=()=>{throw Error('Unchanged mouth blend repainted')};
      host.blendMouth(host.poseBlend.AA,Math.min(1-host.poseBlend.AA,host.poseBlend.O));mixContext.drawImage=originalDraw;
      host.roundedPatch=null;host.roundedReady=false;host.poseBlend={AA:.4,O:.6};host.lastElapsed=14;host.draw(14);
      const missing=mouthPixel();check(Math.abs(missing[1]-(1-host.poseBlend.AA)*255)<=2,'Missing rounded asset overstates the AA mouth');
      host.speakingPatch=solid('rgba(255,0,0,.5)');host.roundedPatch=solid('rgba(0,0,255,.5)');host.roundedReady=true;host.poseBlend={AA:.4,O:.6};host.lastElapsed=15;host.draw(15);
      const feathered=mouthPixel();check(Math.abs(feathered[1]-127.5)<=2,'Feathered edge loses its neutral background weight');check(Math.abs(feathered[0]-host.poseBlend.AA*127.5)<=2,'Feathered AA weight is wrong');
      const retiredBlend=host.mouthBlendCanvas,RealImage=window.Image;window.Image=class{};
      try{host.setPersona('rowan');check(retiredBlend.width===0&&retiredBlend.height===0&&!host.mouthBlendCanvas&&!host.mouthBlendAA&&!host.mouthBlendO,'Persona switch retained mouth blend resources')}finally{window.Image=RealImage}
      return { captionLayout: true, timerLayout: true, toastLayout: true, safeText: true, efficientMotion: true, newestLineVisible: true, streamingIdentity: true, portraitWidths: [320, 540, 1080, 2160], faceCache: true, blinkOwnership: true, stripBudget: 13, speechGlowWrites, unusedChannelRepaints: 0, adaptiveSurface: true, fullDetailRecovery: true, mouthBlendWeights: true };
    })()`);
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    result.reducedMotion = await win.webContents.executeJavaScript(`getComputedStyle(document.querySelector('#caption-assistant i')).animationName === 'none' && getComputedStyle(document.querySelector('.live-captions')).transitionDuration.split(',').every(value => parseFloat(value) === 0)`);
    assert.equal(result.reducedMotion, true, 'Reduced motion still animates captions');
    win.webContents.debugger.detach();
    assert.equal(result.captionLayout, true);
    const output = path.join(__dirname, '../artifacts/face-caption-render');
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ ...result, checkedAt: new Date().toISOString(), scope: 'Hidden Chromium fixture using production CSS and face warp; no physical camera, microphone, mirror glass or PC stick.' }, null, 2));
    console.log('Chromium face/caption render:', JSON.stringify(result));
  } finally { win.destroy(); }
}).then(() => app.quit()).catch(error => { console.error(error); app.exit(1); });
