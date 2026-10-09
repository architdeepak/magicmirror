// Actual queued PCM playback/mouth audit. No microphone or paid provider.
const fs=require('fs/promises'),path=require('path'),os=require('os'),assert=require('assert/strict');
const {createHash}=require('crypto');
const {spawn}=require('child_process'),{connect}=require('./cdp-client.cjs');
const root=path.resolve(__dirname,'..'),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'mirror-rig-v2-')),out=path.join(root,'artifacts',process.env.MIRROR_PLAYBACK_LABEL||'playback-sync');await fs.mkdir(out,{recursive:true});
 const build=path.join(profile,'app');await fs.cp(path.join(root,`dist/linux-${process.arch}-unpacked`),build,{recursive:true});const archiveSha256=createHash('sha256').update(await fs.readFile(path.join(build,'resources/app.asar'))).digest('hex');
 const app=spawn(path.join(build,'magic-mirror-portal'),['--no-sandbox',...(process.env.MIRROR_PLAYBACK_GRAPHICS==='vulkan'?['--use-gl=angle','--use-angle=vulkan','--use-cmd-decoder=passthrough']:process.env.MIRROR_PLAYBACK_GRAPHICS==='swiftshader-composited'?['--use-gl=angle','--use-angle=swiftshader','--use-cmd-decoder=passthrough']:['--disable-gpu']),`--user-data-dir=${profile}`,'--remote-debugging-address=127.0.0.1','--remote-debugging-port=0'],{cwd:profile,env:{...process.env,GEMINI_API_KEY:'',DECART_API_KEY:'',MIRROR_KIOSK:'false'},stdio:['ignore','pipe','pipe']});
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
  await client.evaluate(`document.querySelector('#mute-btn').click()`);await delay(300);
  await client.evaluate(`document.querySelector('#avatar-render-style').value='rig';document.querySelector('#avatar-render-style').dispatchEvent(new Event('change'))`);
  await until(()=>client.evaluate('__mirrorDebug.avatar.rigHost?.ready&&__mirrorDebug.avatar.renderStyle==="rig"'));
  if(process.env.MIRROR_PLAYBACK_WARM_ALL==='true')await client.evaluate(`(()=>{const r=__mirrorDebug.avatar.rigHost;const blend=Object.fromEntries(Object.keys(r.face.morphTargetDictionary).map(name=>[name,.01]));r.update(blend,{},{},1/30,{});r.renderer.getContext().finish();r.update({},{},{},1/30,{});r.renderer.getContext().finish()})()`);
  if(process.env.MIRROR_PLAYBACK_TRACE==='true'){
   await client.call('Profiler.enable');await client.call('Profiler.start');
   if(process.env.MIRROR_PLAYBACK_CHROMIUM_TRACE==='true')await client.call('Tracing.start',{categories:'devtools.timeline,blink,cc,gpu,viz',transferMode:'ReturnAsStream'});
   await client.evaluate(`(()=>{window.__playbackTrace=[];const a=__mirrorDebug.avatar,r=a.rigHost;const wrap=(owner,name,label)=>{const fn=owner[name].bind(owner);owner[name]=(...args)=>{const at=performance.now();try{return fn(...args)}finally{if(__playbackTrace.length<10000)__playbackTrace.push({name:label,at,ms:performance.now()-at})}}};wrap(a,'update','avatar.update');wrap(a.head,'animate','hidden-head.animate');wrap(r,'update','rig.update');wrap(r.renderer,'render','rig.renderer.render');if(r.composer)wrap(r.composer,'render','rig.composer.render')})()`);
  }
  const results=[];
  for(const route of Array.from({length:Number(process.env.MIRROR_PLAYBACK_REPEATS||1)},()=>['stream','fallback']).flat()){
   const result=await client.evaluate(`(async()=>{
    const a=__mirrorDebug.avatar,g=__mirrorDebug.gemini;g.stopPlayback();g.connected=true;g.listening=true;g.intentionalDisconnect=false;g.playbackSuppressed=false;
    if(${process.env.MIRROR_QUIET_MOUTH==='true'}){a.setFacePuppetEnabled(true);if(!a.__quietMouthRestore){const original=a.setFaceBlendshapes;a.__quietMouthRestore=original;a.setFaceBlendshapes=function(){original.call(this,{jawOpen:.95,mouthSmileLeft:.8,eyeBlinkLeft:.2,browInnerUp:.3})};}a.setFaceBlendshapes();}
    if('${route}'==='stream'){a.streaming=false;await a.startAudioStream();}else a.streaming=false;
    const rate=24000,pcm=new Int16Array(rate*1.6);for(let i=0;i<pcm.length;i++){const t=i/rate;if((t>=.45&&t<.85)||(t>=1.2&&t<1.6))pcm[i]=Math.round(.2*32767*Math.sin(2*Math.PI*220*t));}
    const rows=[];const at=performance.now();const timer=setInterval(()=>rows.push({ms:performance.now()-at,...a.getPlaybackStatus(),jaw:a.expressionMixer.values.jawOpen||0,eyeBlink:a.expressionMixer.values.eyeBlinkLeft||0,brow:a.expressionMixer.values.browInnerUp||0,mouth:Math.max(0,...Object.entries(a.expressionMixer.values).filter(([k])=>k.startsWith('mouth')||k.startsWith('jaw')).map(([,v])=>v))}),16);
    let binary='';for(const value of new Uint8Array(pcm.buffer))binary+=String.fromCharCode(value);
    await g._handleMessage(JSON.stringify({serverContent:{modelTurn:{parts:[{inlineData:{mimeType:'audio/pcm;rate=24000',data:btoa(binary)}}]},turnComplete:true}}));
    const queuedState=document.querySelector('#state-label').textContent;
    await new Promise(r=>setTimeout(r,2100));clearInterval(timer);const completedState=document.querySelector('#state-label').textContent,completedJaw=a.expressionMixer.values.jawOpen||0;
    const active=rows.filter(r=>r.level>.1),first=active[0]?.ms,last=active.at(-1)?.ms;
    const queuedSilence=rows.filter(r=>r.ms<350),gap=rows.filter(r=>r.ms>980&&r.ms<1120),tail=rows.filter(r=>r.ms>1300&&r.ms<1500);
    // Interrupt during a long tone; stale analyser history must not reopen it.
    const outputNode=a.playbackMeter.node,observer=outputNode.context.createAnalyser();observer.fftSize=512;outputNode.connect(observer);const measured=new Float32Array(512);const outputRms=()=>{if(outputNode.context.state!=='running')return null;observer.getFloatTimeDomainData(measured);return Math.sqrt(measured.reduce((sum,v)=>sum+v*v,0)/measured.length)};
    const tone=new Int16Array(rate*2);for(let i=0;i<tone.length;i++)tone[i]=Math.round(.2*32767*Math.sin(2*Math.PI*220*i/rate));
    if('${route}'==='stream')a.pushPcm(tone);else g._playFallbackPcm(tone,rate);
    await new Promise(r=>setTimeout(r,150));const beforeStop=a.getPlaybackStatus(),outputRmsBefore=outputRms();__mirrorDebug.stopAssistant();const immediate=a.getPlaybackStatus();await new Promise(r=>setTimeout(r,150));const stopped=a.getPlaybackStatus(),outputRmsAfter=outputRms(),outputContextAfter=outputNode.context.state;try{outputNode.disconnect(observer)}catch{}observer.disconnect();
    g.stopPlayback();a.streaming=!!a.head?.isStreaming;
    return{route:'${route}',queuedState,completedState,completedJaw,trackedQuietMouth:${process.env.MIRROR_QUIET_MOUTH==='true'},gapEyeMin:Math.min(...gap.map(r=>r.eyeBlink)),gapBrowMin:Math.min(...gap.map(r=>r.brow)),stoppedLabel:document.querySelector('#mic-label').textContent,rows,firstMs:first,lastMs:last,queuedSilenceMax:Math.max(...queuedSilence.map(r=>r.level)),gapMax:Math.max(...gap.map(r=>r.level)),tailMin:Math.min(...tail.map(r=>r.level)),tailJawMin:Math.min(...tail.map(r=>r.jaw)),tailMouthMin:Math.min(...tail.map(r=>r.mouth)),gapJawMax:Math.max(...gap.map(r=>r.jaw)),outputRmsBefore,outputRmsAfter,outputContextAfter,beforeStop,immediate,stopped};
   })()`);
   await fs.writeFile(path.join(out,route+'-audit.json'),JSON.stringify(result,null,2));
   if(process.env.MIRROR_QUIET_MOUTH==='true'){assert(result.completedJaw>.8,'Completed utterance did not restore tracked jaw on '+route);assert(result.gapEyeMin>.18&&result.gapBrowMin>.28,'Quiet speech erased upper-face tracking on '+route);}
   if(process.env.MIRROR_REQUIRE_VISEMES==='true'){assert(result.rows.some(r=>r.visemeModel==='ready'),'Local model never became ready');assert.equal(result.immediate.visemeModel,'idle');assert.equal(result.stopped.visemeModel,'idle');}
   assert.equal(result.queuedState,'Speaking');assert.equal(result.completedState,'Listening');assert.equal(result.stoppedLabel,'LISTEN');assert(result.firstMs>350&&result.firstMs<650,'Mouth onset did not follow output on '+route);assert(result.lastMs>1500,'Queued audible tail erased on '+route);assert.equal(result.queuedSilenceMax,0);assert.equal(result.gapMax,0);assert(result.tailMin>.1,'Audible tail did not animate on '+route);assert(result.tailMouthMin>.1,'Visible speech shapes did not move on '+route);assert(result.gapJawMax<.1,'Visible jaw stayed open through silence on '+route);assert(result.beforeStop.level>.1);assert(result.outputRmsBefore>.01);if(route==='stream')assert(result.outputContextAfter==='suspended'||(result.outputContextAfter==='running'&&Number.isFinite(result.outputRmsAfter)&&result.outputRmsAfter<.002));else assert.equal(result.outputContextAfter,'closed');assert.equal(result.immediate.level,0);assert.equal(result.stopped.level,0);assert(!result.stopped.enabled);results.push(result);
  }
  if(process.env.MIRROR_QUIET_MOUTH==='true')await client.evaluate('(()=>{const a=__mirrorDebug.avatar;if(a.__quietMouthRestore){a.setFaceBlendshapes=a.__quietMouthRestore;delete a.__quietMouthRestore;}a.setFacePuppetEnabled(false)})()');
  let detectorFailure=null;
  if(process.env.MIRROR_REQUIRE_VISEMES==='true'){
   detectorFailure=await client.evaluate(`(async()=>{const a=__mirrorDebug.avatar,g=__mirrorDebug.gemini,Original=window.AudioWorkletNode;g.stopPlayback();a.streaming=false;try{window.AudioWorkletNode=class extends Original{constructor(context,name,options){if(name==='mirror-speech-visemes')throw Error('Injected local detector failure');super(context,name,options)}};const rate=24000,tone=new Int16Array(rate);for(let i=0;i<tone.length;i++)tone[i]=Math.round(.2*32767*Math.sin(2*Math.PI*220*i/rate));g._playFallbackPcm(tone,rate);await new Promise(r=>setTimeout(r,300));const active=a.getPlaybackStatus();__mirrorDebug.stopAssistant();await new Promise(r=>setTimeout(r,150));return{active,stopped:a.getPlaybackStatus()}}finally{window.AudioWorkletNode=Original;g.stopPlayback()}})()`);
   assert.equal(detectorFailure.active.visemeModel,'unavailable');assert(detectorFailure.active.level>.1,'Detector failure silenced fallback animation');assert.equal(detectorFailure.stopped.visemeModel,'idle');assert.equal(detectorFailure.stopped.level,0);
  }
  let visemeStress=null;
  if(process.env.MIRROR_VISEME_STRESS==='true'){
   visemeStress=await client.evaluate(`(async()=>{
    const a=__mirrorDebug.avatar,g=__mirrorDebug.gemini,Original=window.AudioWorkletNode,records=[],rate=24000,tone=new Int16Array(rate*3);
    for(let i=0;i<tone.length;i++)tone[i]=Math.round(.2*32767*Math.sin(2*Math.PI*220*i/rate));
    const wait=ms=>new Promise(r=>setTimeout(r,ms)),ready=async(freshAfter=-1)=>{for(let i=0;i<100;i++){if(a.getPlaybackStatus().visemeModel==='ready'&&a.playbackMeter.detected?.at>freshAfter)return;await wait(10)}throw Error('Stress detector not ready')};let proto,originalAdd;
    window.AudioWorkletNode=class extends Original{constructor(context,name,options){super(context,name,options);if(name!=='mirror-speech-visemes')return;const record={closed:0,disconnected:0,messages:[]};records.push(record);const port=this.port,close=port.close.bind(port),disconnect=this.disconnect.bind(this);port.close=()=>{record.closed++;return close()};this.disconnect=(...args)=>{record.disconnected++;return disconnect(...args)};let owner=port,descriptor;while(owner){descriptor=Object.getOwnPropertyDescriptor(owner,'onmessage');if(descriptor?.set)break;owner=Object.getPrototypeOf(owner)}Object.defineProperty(port,'onmessage',{get(){return descriptor.get.call(port)},set(callback){descriptor.set.call(port,callback?event=>{record.messages.push({at:performance.now(),age:context.currentTime-event.data.audioTime});callback(event)}:null)}})}};
    try{
     g.stopPlayback();a.streaming=false;g._playFallbackPcm(tone,rate);await ready();proto=Object.getPrototypeOf(a.playbackMeter.node.context.audioWorklet);originalAdd=proto.addModule;
     const before=a.getPlaybackStatus(),beforeAt=a.playbackMeter.detected.at,start=performance.now();while(performance.now()-start<600){}const resumedAt=performance.now();a._updatePlaybackSpeech(resumedAt/1000);const afterBlock=a.getPlaybackStatus(),predictionAge=resumedAt-beforeAt;
     await wait(30);const burst=records[0].messages.filter(m=>m.at>=resumedAt&&m.at<resumedAt+30).length;await ready(resumedAt);const freshPredictionAge=performance.now()-a.playbackMeter.detected.at;const afterResume=a.getPlaybackStatus();__mirrorDebug.stopAssistant();const stopped=a.getPlaybackStatus();
     const restarts=[];for(let i=0;i<6;i++){g._playFallbackPcm(tone,rate);await ready();restarts.push(a.getPlaybackStatus());__mirrorDebug.stopAssistant();}
     const beforeLate=records.length;let release;proto.addModule=function(url,...args){if(String(url).includes('speechVisemeWorklet'))return new Promise((resolve,reject)=>{release=()=>originalAdd.call(this,url,...args).then(resolve,reject)});return originalAdd.call(this,url,...args)};
     g._playFallbackPcm(tone,rate);await wait(50);const pending=a.getPlaybackStatus();__mirrorDebug.stopAssistant();release();await wait(150);const late=a.getPlaybackStatus(),lateNodes=records.length-beforeLate;
     return{before,afterBlock,predictionAge,burst,freshPredictionAge,afterResume,stopped,restarts,pending,late,lateNodes,records:records.map(r=>({closed:r.closed,disconnected:r.disconnected,messages:r.messages.length,stale:r.messages.filter(m=>m.age>=.15).length}))};
    }finally{if(proto&&originalAdd)proto.addModule=originalAdd;window.AudioWorkletNode=Original;g.stopPlayback()}
   })()`);
   assert(visemeStress.predictionAge>=600);assert.equal(visemeStress.afterBlock.viseme,'O','Expired model prediction survived renderer stall');assert(visemeStress.burst<=6,'Prediction backlog burst after renderer stall');assert.equal(visemeStress.afterResume.visemeModel,'ready');assert(visemeStress.freshPredictionAge<150,'Fresh predictions did not resume');assert(visemeStress.records[0].stale>=1,'Stall test did not deliver a stale prediction');assert.equal(visemeStress.stopped.level,0);assert.equal(visemeStress.stopped.visemeModel,'idle');assert.equal(visemeStress.restarts.length,6);assert(visemeStress.restarts.every(r=>r.visemeModel==='ready'));assert.equal(visemeStress.pending.visemeModel,'loading');assert.equal(visemeStress.late.level,0);assert.equal(visemeStress.late.visemeModel,'idle');assert.equal(visemeStress.lateNodes,0,'Cancelled worklet setup created a late node');assert(visemeStress.records.every(r=>r.closed===1&&r.disconnected===1),'Detector port/graph retirement was not exactly once');
  }
  let processorRetirement=null;
  if(process.env.MIRROR_VISEME_STRESS==='true'){
   processorRetirement=await client.evaluate(`(async()=>{
    const {createOutputVisemeDetector}=await import(new URL('./speechVisemeDetector.mjs',location.href)),text=await fetch(new URL('./speechVisemeWorklet.mjs',location.href)).then(r=>r.text());
    const base='import {HeadWorklet} from '+JSON.stringify(new URL('./vendor/headaudio/headworklet.mjs',location.href).href)+';'+String.fromCharCode(10)+text.split(String.fromCharCode(10)).filter(line=>!line.startsWith('import ')&&!line.startsWith('registerProcessor(')).join(String.fromCharCode(10));
    const audit=base+\`\nclass RetirementProbe extends MirrorVisemeWorklet{constructor(options){super(options);const receive=this.port.onmessage;this.calls=0;this.port.onmessage=e=>{if(e.data?.event==='probe-port'){this.probe=e.data.port;this.probe.onmessage=m=>this.probe.postMessage({seq:m.data.seq,calls:this.calls,retired:this.retired===true,returnedFalse:this.returnedFalse===true});this.probe.postMessage({seq:0});}else receive(e);}}process(...args){this.calls++;const result=super.process(...args);if(!result)this.returnedFalse=true;return result;}}registerProcessor('mirror-retirement-probe',RetirementProbe);\`;
    const url=URL.createObjectURL(new Blob([audit],{type:'text/javascript'})),context=new AudioContext(),source=context.createOscillator(),channel=new MessageChannel(),pending=new Map();let node,detector;
    channel.port1.onmessage=e=>{pending.get(e.data.seq)?.(e.data);pending.delete(e.data.seq)};
    const query=seq=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(seq);reject(Error('Retirement probe response timed out'))},1000);pending.set(seq,value=>{clearTimeout(timer);resolve(value)});if(seq)channel.port1.postMessage({seq})});
    try{await context.resume();source.frequency.value=220;source.start();detector=await createOutputVisemeDetector(source,{register:()=>context.audioWorklet.addModule(url),makeNode:()=>node=new AudioWorkletNode(context,'mirror-retirement-probe',{numberOfInputs:1,numberOfOutputs:0,channelCount:1,channelCountMode:'explicit',channelInterpretation:'speakers',outputChannelCount:[],parameterData:{silMode:0}})});
     const ready=query(0);node.port.postMessage({event:'probe-port',port:channel.port2},[channel.port2]);await ready;await new Promise(r=>setTimeout(r,200));const before=await query(1);detector.retire();await new Promise(r=>setTimeout(r,100));const after=await query(2);await new Promise(r=>setTimeout(r,150));const settled=await query(3);return{before,after,settled,contextState:context.state,scope:'Production processor class body with a separate diagnostic port/counter; production detector retirement closes its actual primary port while context remains running.'};
    }finally{detector?.retire();source.stop();source.disconnect();channel.port1.close();channel.port2.close();await context.close();URL.revokeObjectURL(url)}
   })()`);
   assert(processorRetirement.before.calls>5,'Retirement probe never processed real audio');assert.equal(processorRetirement.after.retired,true,'Retire message lost when primary port closed');assert.equal(processorRetirement.after.returnedFalse,true,'Processor did not terminate');assert.equal(processorRetirement.after.calls,processorRetirement.settled.calls,'Retired processor kept executing');assert.equal(processorRetirement.contextState,'running');
  }
  let liveContextLateSetup=null;
  if(process.env.MIRROR_VISEME_STRESS==='true'){
   liveContextLateSetup=await client.evaluate(`(async()=>{
    const a=__mirrorDebug.avatar,context=new AudioContext(),source=context.createOscillator(),gain=context.createGain(),sink=context.createGain(),Original=window.AudioWorkletNode;source.connect(gain);sink.gain.value=0;gain.connect(sink);sink.connect(context.destination);let release,finished,created=0;
    const loaded=new Promise(r=>finished=r),add=context.audioWorklet.addModule.bind(context.audioWorklet);context.audioWorklet.addModule=(...args)=>new Promise((resolve,reject)=>{release=()=>add(...args).then(value=>{resolve(value);finished()},reject)});
    window.AudioWorkletNode=class extends Original{constructor(ctx,name,options){super(ctx,name,options);if(name==='mirror-speech-visemes')created++}};
    try{await context.resume();source.start();a.attachPlaybackNode(gain);a.beginPlayback();const pending=a.getPlaybackStatus();a.interrupt();release();await loaded;await new Promise(r=>setTimeout(r,50));return{pending,after:a.getPlaybackStatus(),created,contextState:context.state};}
    finally{window.AudioWorkletNode=Original;a.attachPlaybackNode(null);source.stop();source.disconnect();gain.disconnect();sink.disconnect();await context.close()}
   })()`);
   assert.equal(liveContextLateSetup.pending.visemeModel,'loading');assert.equal(liveContextLateSetup.after.visemeModel,'idle');assert.equal(liveContextLateSetup.after.level,0);assert.equal(liveContextLateSetup.created,0,'Successful late registration created a cancelled detector');assert.equal(liveContextLateSetup.contextState,'running');
  }
  let speechReplay=null;
  if(process.env.MIRROR_CAPTURE_GREETING==='true'){
   const fixture=await fs.readFile(path.join(root,'artifacts/gemini-live/greeting.wav'));
   const capture=await client.evaluate(`(async()=>{
    const a=__mirrorDebug.avatar,g=__mirrorDebug.gemini;g.stopPlayback();a.streaming=false;await a.startAudioStream();
    const bytes=Uint8Array.from(atob(${JSON.stringify(fixture.toString('base64'))}),c=>c.charCodeAt(0));const audio=await a.head.audioCtx.decodeAudioData(bytes.buffer);
    const pcm=Int16Array.from(audio.getChannelData(0),v=>Math.round(Math.max(-1,Math.min(1,v))*32767));
    const output=a.head.audioCtx.createMediaStreamDestination();a.head.audioStreamGainNode.connect(output);
    const canvas=a.rigHost.canvas,visual=canvas.captureStream(30),stream=new MediaStream([...visual.getVideoTracks(),...output.stream.getAudioTracks()]);
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9,opus',videoBitsPerSecond:4000000});const chunks=[],rows=[],begun=performance.now(),sampling=setInterval(()=>rows.push({ms:performance.now()-begun,...a.getPlaybackStatus()}),16);recorder.ondataavailable=e=>chunks.push(e.data);
    const ended=new Promise(r=>recorder.onstop=r);recorder.start();await new Promise(r=>setTimeout(r,200));a.pushPcm(pcm);a.endAudioTurn();
    await new Promise(r=>setTimeout(r,700));const still=canvas.toDataURL('image/png');await new Promise(r=>setTimeout(r,audio.duration*1000-200));recorder.stop();await ended;
    const encoded=await new Blob(chunks,{type:recorder.mimeType}).arrayBuffer();let binary='';for(const value of new Uint8Array(encoded))binary+=String.fromCharCode(value);
    clearInterval(sampling);a.head.audioStreamGainNode.disconnect(output);stream.getTracks().forEach(t=>t.stop());g.stopPlayback();return{video:btoa(binary),still:still.split(',')[1],rows,durationSec:audio.duration,sampleRate:audio.sampleRate,pcmFrames:pcm.length,resolution:[canvas.width,canvas.height],mimeType:recorder.mimeType};
   })()`);
   await fs.writeFile(path.join(out,'queen-speech-replay.webm'),Buffer.from(capture.video,'base64'));await fs.writeFile(path.join(out,'queen-speech-still.png'),Buffer.from(capture.still,'base64'));
   if(process.env.MIRROR_REQUIRE_VISEMES==='true'){assert(capture.rows.some(r=>r.visemeModel==='ready'&&r.predictedViseme!==null),'Greeting had no local predictions');assert(new Set(capture.rows.filter(r=>r.level>.09).map(r=>r.viseme)).size>=3,'Greeting still uses only broad waveform shapes');}
   const {video,still,...metadata}=capture;speechReplay={...metadata,sourceSha256:createHash('sha256').update(fixture).digest('hex'),scope:'Existing recorded Gemini greeting replayed locally through actual worklet; browser MediaRecorder captures rig canvas plus same PCM bus. 30fps capture request, not physical display/performance or accurate consonant proof.'};
  }
  const result={archiveSha256,rigSnapshot:await client.evaluate('__mirrorDebug.avatar.rigHost.snapshot()'),diagnosticWarmAll:process.env.MIRROR_PLAYBACK_WARM_ALL==='true',graphicsRequest:process.env.MIRROR_PLAYBACK_GRAPHICS||'software',graphics:await client.evaluate('__mirrorDebug.avatar.rigHost.snapshot().graphics'),passed:true,checkedAt:new Date().toISOString(),results,speechReplay,detectorFailure,visemeStress,processorRetirement,liveContextLateSetup,scope:'Actual packaged Linux Electron, real TalkingHead worklet and Web Audio fallback. Deterministic synthetic PCM with queued silence/tone/gap/tail; real output waveform drives visible rig. No cloud provider, phoneme accuracy, physical speakers or acoustic/display latency proof.'};await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,archiveSha256,routes:results.map(({route,firstMs,lastMs,queuedSilenceMax,gapMax,tailMin})=>({route,firstMs,lastMs,queuedSilenceMax,gapMax,tailMin}))}));
 }finally{if(client&&process.env.MIRROR_PLAYBACK_TRACE==='true'){try{if(process.env.MIRROR_PLAYBACK_CHROMIUM_TRACE==='true'){
 const finished=new Promise(resolve=>{client.onEvent(event=>{if(event.method==='Tracing.tracingComplete')resolve(event.params.stream)})});
 await client.call('Tracing.end');const stream=await finished;let done=false;const file=path.join(out,'chromium-trace.json');await fs.writeFile(file,'');
 while(!done){const chunk=await client.call('IO.read',{handle:stream,size:131072});await fs.appendFile(file,chunk.base64Encoded?Buffer.from(chunk.data,'base64'):chunk.data);done=chunk.eof;}await client.call('IO.close',{handle:stream});
}const profile=await client.call('Profiler.stop');await fs.writeFile(path.join(out,'renderer.cpuprofile'),JSON.stringify(profile.profile));const trace=await client.evaluate('window.__playbackTrace');await fs.writeFile(path.join(out,'timing-trace.json'),JSON.stringify({archiveSha256,trace},null,2));}catch(error){process.exitCode=1;console.error('Trace save failed:',error.message)}}client?.close();app.kill('SIGTERM');await delay(200);if(!exited)app.kill('SIGKILL');await fs.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
})().catch(error=>{console.error(error);process.exitCode=1});
