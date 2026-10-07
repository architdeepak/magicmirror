// Actual packaged UI + local Vosk + Gemini Live. Only prerecorded synthetic
// microphone input; camera is denied and screen sharing is not requested.
const assert=require('assert/strict');const fs=require('fs/promises');const path=require('path');const os=require('os');const {spawn}=require('child_process');
const {connect}=require('./cdp-client.cjs');
const root=path.resolve(__dirname,'..');const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  const settings=require('dotenv').parse(await fs.readFile(path.join(root,'.env')));
  const apiKey=process.env.GEMINI_API_KEY||settings.GEMINI_API_KEY;if(!apiKey)throw new Error('Configure a Gemini API key before running this optional live journey check.');
  const fixtures={};for(const name of ['wake','stop','story'])fixtures[name]=(await fs.readFile(path.join(root,'artifacts/wake-word',name+'.wav'))).toString('base64');
  const directory=path.join(root,'artifacts/voice-journey');await fs.mkdir(directory,{recursive:true});
  const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'mirror-voice-journey-'));const profile=path.join(temporary,'profile');await fs.mkdir(profile);
  const binary=path.resolve(process.argv[2]||path.join(root,`dist/linux-${process.arch}-unpacked/magic-mirror-portal`));
  let client,exit=null,logs='';const microphoneFrames=[];const endMarkers=[];let configuredVoice='',manualTurns=false;
  const child=spawn(binary,['--no-sandbox','--disable-gpu','--use-fake-device-for-media-stream',`--user-data-dir=${profile}`,'--remote-debugging-address=127.0.0.1','--remote-debugging-port=0'],{cwd:temporary,env:{...process.env,GEMINI_API_KEY:'',MIRROR_SPOTIFY_CLIENT_ID:'',MIRROR_TRYON_ENDPOINT:'',MIRROR_VERTEX_PROJECT:'',MIRROR_KIOSK:'false'},stdio:['ignore','pipe','pipe']});
  for(const pipe of [child.stdout,child.stderr])pipe.on('data',bytes=>logs=(logs+bytes.toString()).slice(-12000));child.on('exit',(code,signal)=>exit={code,signal});child.on('error',error=>exit={error:error.message});
  const until=async(predicate,timeout,label)=>{const started=Date.now();while(true){if(exit)throw new Error('Journey app exited: '+JSON.stringify(exit));const value=await predicate();if(value)return value;if(Date.now()-started>timeout)throw new Error(label+' timed out; '+logs.slice(-2500));await delay(80)}};
  try{
    const debug=await until(()=>logs.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/)?.[1],30000,'Debug endpoint');const origin=new URL(debug);
    const target=await until(async()=>(await fetch(`http://${origin.host}/json/list`).then(response=>response.json())).find(item=>item.url.includes('app.asar/src/index.html')),30000,'Mirror renderer');
    client=await connect(target.webSocketDebuggerUrl);
    await client.call('Page.enable');
    await client.call('Network.enable');
    client.onEvent(event=>{
      if(event.method!=='Network.webSocketFrameSent')return;
      let payload;try{payload=JSON.parse(event.params.response.payloadData)}catch{return}
      if(payload.setup){configuredVoice=payload.setup.generationConfig?.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName;manualTurns=payload.setup.realtimeInputConfig?.automaticActivityDetection?.disabled===true;}
      if(payload.realtimeInput?.activityEnd)endMarkers.push(Date.now());
      const audio=payload.realtimeInput?.audio;if(!audio)return;
      const bytes=Buffer.from(audio.data,'base64');let sum=0;for(let i=0;i+1<bytes.length;i+=2){const value=bytes.readInt16LE(i)/32768;sum+=value*value}
      microphoneFrames.push({at:Date.now(),rms:Math.sqrt(sum/(bytes.length/2)),bytes:bytes.length});
    });
    await client.call('Page.addScriptToEvaluateOnNewDocument',{source:`
      localStorage.setItem('mirror.hard-muted','true');localStorage.setItem('mirror.wake','true');localStorage.setItem('mirror.vision','false');localStorage.setItem('mirror.gestures','false');localStorage.setItem('mirror.face-puppet','false');
      window.__fixture={id:Number(sessionStorage.getItem('journeyGeneration')||0)+1,context:null,destination:null,tracks:[],samples:0,meters:[],events:[]};sessionStorage.setItem('journeyGeneration',String(__fixture.id));
      navigator.mediaDevices.getUserMedia=async constraints=>{
        if(constraints.video)throw new DOMException('Camera disabled in synthetic journey check','NotAllowedError');
        if(!__fixture.context){__fixture.context=new AudioContext({sampleRate:48000});__fixture.destination=__fixture.context.createMediaStreamDestination();}
        await __fixture.context.resume();const stream=__fixture.destination.stream.clone();__fixture.tracks.push(...stream.getTracks());return stream;
      };
      __fixture.play=async encoded=>{
        await __fixture.context.resume();const bytes=Uint8Array.from(atob(encoded),value=>value.charCodeAt(0));const audio=await __fixture.context.decodeAudioData(bytes.buffer);
        const source=__fixture.context.createBufferSource();source.buffer=audio;source.connect(__fixture.destination);
        const samples=audio.getChannelData(0);let last=samples.length-1;while(last>0&&Math.abs(samples[last])<.005)last--;
        __fixture.lastInput={at:performance.now(),speechEndAt:performance.now()+last/audio.sampleRate*1000,duration:audio.duration};
        source.start();return audio.duration;
      };
    `});
    await client.call('Page.reload');
    await until(()=>client.evaluate('Boolean(window.__fixture)&&Boolean(window.__mirrorDebug)&&document.querySelector("#loader").classList.contains("done")'),45000,'Journey startup');
    const initialGeneration=await client.evaluate('__fixture.id');
    // Credentials enter through the real Settings bridge and are kept session-only.
    await client.evaluate(`window.mirrorBridge.saveConnections({geminiApiKey:${JSON.stringify(apiKey)},remember:false})`);
    await client.call('Page.reload');
    await until(()=>client.evaluate('Boolean(window.__fixture)&&__fixture.id>'+initialGeneration+'&&Boolean(window.__mirrorDebug)&&document.querySelector("#loader").classList.contains("done")'),45000,'Configured journey startup');
    await client.evaluate(`(()=>{
      const avatar=window.__mirrorDebug.avatar;const push=avatar.pushPcm.bind(avatar);avatar.pushPcm=pcm=>{__fixture.samples+=pcm.length;push(pcm)};
      const start=avatar.startAudioStream.bind(avatar);avatar.startAudioStream=async()=>{
        await start();const head=avatar.head;
        if(head?.audioCtx&&head.audioReverbNode){
          const meter=head.audioCtx.createAnalyser();meter.fftSize=1024;head.audioReverbNode.connect(meter);
          const silent=head.audioCtx.createGain();silent.gain.value=0;meter.connect(silent);silent.connect(head.audioCtx.destination);
          const samples=new Float32Array(1024);__fixture.meterTimer=setInterval(()=>{meter.getFloatTimeDomainData(samples);const rms=Math.sqrt(samples.reduce((sum,value)=>sum+value*value,0)/samples.length);__fixture.meters.push({at:performance.now(),rms});if(__fixture.meters.length>3000)__fixture.meters.shift()},25);
        }
      };
      const snapshot=()=>({at:performance.now(),reveal:document.querySelector('#awakening').classList.contains('active'),state:document.querySelector('#state-label').textContent,mic:document.querySelector('#mic-label').textContent,user:document.querySelector('#caption-user span').textContent,assistant:document.querySelector('#caption-assistant span').textContent});
      __fixture.snapshot=snapshot;__fixture.observer=new MutationObserver(()=>{const event=snapshot();const last=__fixture.events.at(-1);if(!last||JSON.stringify({...event,at:0})!==JSON.stringify({...last,at:0}))__fixture.events.push(event)});__fixture.observer.observe(document.querySelector('#app-shell'),{subtree:true,attributes:true,childList:true,characterData:true});
      const BaseModel=Vosk.Model;Vosk.Model=class extends BaseModel {
        constructor(...args){super(...args);this.on('load',()=>{const model=this,Recognizer=model.KaldiRecognizer;
          Object.defineProperty(model,'KaldiRecognizer',{value:class extends Recognizer {constructor(...options){super(...options);for(const type of ['partialresult','result'])this.on(type,event=>{
            const text=event.result?.partial||event.result?.text||'';if(/mirror stop/.test(text))__fixture.localStopAt=performance.now();
          })}},configurable:true});});}
      };
      document.querySelector('#mute-btn').click();
    })()`);
    await until(()=>client.evaluate('document.querySelector("#wake-status").textContent.includes("mirror mirror")&&Boolean(__fixture.context)'),90000,'Local wake armed');
    console.log('Journey wake detector: armed with synthetic microphone');
    await client.evaluate(`__fixture.play(${JSON.stringify(fixtures.wake)})`);
    await until(()=>client.evaluate('__fixture.events.some(event=>event.reveal)'),15000,'Spoken wake reveal');
    assert(await client.evaluate('__fixture.events.some(event=>event.reveal && event.mic === "STOP")'),'Wake entrance had no visible Stop control');
    const reveal=await client.call('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,'reveal.png'),Buffer.from(reveal.data,'base64'));
    await until(()=>client.evaluate('__fixture.samples>24000&&/highness/i.test(document.querySelector("#caption-assistant span").textContent)'),30000,'Real live greeting');
    await until(()=>client.evaluate('document.querySelector("#state-label").textContent==="Listening"'),20000,'Greeting complete');
    console.log('Journey greeting: live PCM and streamed assistant captions received');
    await client.evaluate(`(()=>{const toggle=document.querySelector('#wake-toggle');toggle.checked=false;toggle.dispatchEvent(new Event('change'))})()`);
    const before=await client.evaluate('__fixture.samples');const storyInputAt=Date.now();
    await client.evaluate(`__fixture.play(${JSON.stringify(fixtures.story)})`);
    await until(()=>client.evaluate('(/story|dragon/i).test(document.querySelector("#caption-user span").textContent)&&__fixture.samples>'+before+'+12000'),30000,'Microphone conversation');
    const streamed=await client.evaluate(`(()=>{const input=__fixture.lastInput;const updates=__fixture.events.filter(event=>event.at>=input.at&&event.at<input.speechEndAt&&event.user&&event.user!=='Mirror mirror');return{...input,updates}})()`);
    assert(streamed.updates.length,'Heard captions did not appear while the user was still speaking');
    const interimTexts=[...new Set(streamed.updates.map(event=>event.user))];assert(interimTexts.length>=2,'Heard caption did not grow during speech');
    const heardCaptionLatencyMs=streamed.updates[0].at-streamed.at;
    console.log('Journey interim heard captions:',JSON.stringify({latencyMs:heardCaptionLatencyMs,updates:interimTexts}));
    console.log('Journey microphone input:',JSON.stringify({frames:microphoneFrames.filter(frame=>frame.at>=storyInputAt).length,peakRms:Math.max(...microphoneFrames.filter(frame=>frame.at>=storyInputAt).map(frame=>frame.rms))}));
    const correctedHeardCaption=await until(()=>client.evaluate(`(()=>{const text=document.querySelector('#caption-user span').textContent;return /about a dragon/i.test(text)?text:null})()`),10000,'Corrected service transcript');
    assert.equal((correctedHeardCaption.match(/tell me/gi)||[]).length,1,'Service correction duplicated local caption');
    const spokenStopAt=await client.evaluate(`(async()=>{const at=performance.now();await __fixture.play(${JSON.stringify(fixtures.stop)});return at})()`);
    await until(()=>client.evaluate('document.querySelector("#mic-label").textContent==="LISTEN"'),8000,'Spoken mirror stop');
    await delay(500);
    const stopped=await client.evaluate(`(()=>{const last=__fixture.snapshot();return{...last,localStopAt:__fixture.localStopAt,samples:__fixture.samples,tracks:__fixture.tracks.filter(track=>track.readyState==='live').length,meters:__fixture.meters.slice(-12),events:__fixture.events}})()`);
    assert(stopped.localStopAt,'Spoken stop was not recognized by local Vosk');
    assert(!stopped.reveal);assert(stopped.tracks<=1,'Spoken stop left the live-assistant microphone active');
    const stopEvent=stopped.events.find(event=>event.at>spokenStopAt&&event.mic==='LISTEN');assert(stopEvent,'No stop state recorded');
    const activeRms=await client.evaluate('Math.max(...__fixture.meters.map(sample=>sample.rms))');assert(activeRms>.005,'TalkingHead output graph remained silent');
    assert(stopped.meters.every(sample=>sample.rms<.002),'Assistant output continued after spoken stop');
    await delay(1200);assert.equal(await client.evaluate('__fixture.samples'),stopped.samples,'Stopped turn continued delivering PCM');
    const colors=await client.evaluate(`({rows:document.querySelectorAll('.caption-line').length,user:getComputedStyle(document.querySelector('#caption-user')).color,assistant:getComputedStyle(document.querySelector('#caption-assistant')).color})`);assert.equal(colors.rows,2);assert.notEqual(colors.user,colors.assistant);
    const ordinaryDuration=await client.evaluate(`__fixture.play(${JSON.stringify(fixtures.story)})`);await delay(ordinaryDuration*1000+500);
    assert.equal(await client.evaluate('document.querySelector("#mic-label").textContent'),'LISTEN','Ordinary speech restarted a stopped assistant');
    assert.equal(await client.evaluate('__fixture.samples'),stopped.samples);
    await client.evaluate(`(()=>{const toggle=document.querySelector('#wake-toggle');toggle.checked=true;toggle.dispatchEvent(new Event('change'))})()`);
    await until(()=>client.evaluate('document.querySelector("#wake-status").textContent.includes("mirror mirror")'),10000,'Standby wake rearmed');
    const resumedAt=await client.evaluate('performance.now()');await client.evaluate(`__fixture.play(${JSON.stringify(fixtures.wake)})`);
    await until(()=>client.evaluate('__fixture.events.some(event=>event.at>'+resumedAt+'&&event.reveal)'),15000,'Second spoken wake');
    await until(()=>client.evaluate('__fixture.samples>'+stopped.samples+'+24000&&__fixture.meters.slice(-8).some(sample=>sample.rms>.005)'),30000,'Resumed live speech');
    assert.equal(configuredVoice,'Gacrux');assert(manualTurns);
    await client.evaluate(`document.querySelector('#mute-btn').click()`);await delay(150);
    assert.equal(await client.evaluate('__fixture.tracks.filter(track=>track.readyState==="live").length'),0,'Hard mute retained microphone tracks');
    assert(await client.evaluate('__fixture.meters.slice(-4).every(sample=>sample.rms<.002)'),'Hard mute did not silence active playback');
    const sampleCount=await client.evaluate('__fixture.samples');await client.evaluate(`__fixture.play(${JSON.stringify(fixtures.wake)})`);await delay(4000);
    assert.equal(await client.evaluate('__fixture.samples'),sampleCount,'Wake phrase bypassed hard mute');
    assert(await client.evaluate('!document.querySelector("#awakening").classList.contains("active")'),'Wake reveal bypassed hard mute');
    await client.evaluate(`document.querySelector('#mute-btn').click();document.querySelector('#mic-btn').click()`);
    await until(()=>client.evaluate('document.querySelector("#state-label").textContent==="Listening"'),30000,'Live session before microphone loss');
    const observation=await client.evaluate('window.mirrorBridge.captureScreen()');
    await client.evaluate(`__fixture.tracks.filter(track=>track.readyState==='live').at(-1).dispatchEvent(new Event('ended'))`);
    await until(()=>client.evaluate('document.querySelector("#mic-label").textContent==="LISTEN"&&document.querySelector("#oracle-text").textContent.includes("Microphone disconnected")'),5000,'Microphone loss returned to stopped controls');
    const staleObservation=await client.evaluate(`(async()=>{try{await window.mirrorBridge.desktopAction({action:'click',snapshotId:${JSON.stringify(observation.snapshotId)},x:1,y:1});return ''}catch(error){return error.message}})()`);
    assert.match(staleObservation,/missing, expired, or already used/,'Microphone loss left desktop observation authorized');
    const evidence={runtime:'actual packaged app',input:'synthetic WAV through MediaStream',greeting:'real Gemini Live '+configuredVoice,conversation:'real microphone transcription and response',reveal:'passed',captionRows:2,speakerColors:'distinct',heardCaptionLatencyMs,interimHeardCaptions:interimTexts,correctedHeardCaption,stopWithStandbyWakeDisabled:'passed',stopLatencyMs:stopEvent.at-spokenStopAt,localStopResponseMs:stopEvent.at-stopped.localStopAt,outputPeakRms:activeRms,stoppedOutputPeakRms:Math.max(...stopped.meters.map(sample=>sample.rms)),stopGate:'ordinary speech ignored; wake phrase restored live speech',hardMute:'active playback silenced; no live microphone tracks; wake ignored',events:stopped.events};
    evidence.microphoneLoss='synthetic ended event: stopped controls and invalidated desktop observation';
    await fs.writeFile(path.join(directory,'result.json'),JSON.stringify(evidence,null,2)+'\n');console.log('Full voice journey passed:',JSON.stringify({...evidence,events:undefined}));
  }catch(error){console.error('Microphone frame evidence:',JSON.stringify({frames:microphoneFrames.length,endMarkers:endMarkers.length,peakRms:Math.max(0,...microphoneFrames.map(frame=>frame.rms)),nonSilent:microphoneFrames.filter(frame=>frame.rms>.003).length}));if(client&&!exit)console.error('Journey state:',await client.evaluate('JSON.stringify(window.__fixture?.snapshot?.()||{wake:document.querySelector("#wake-status")?.textContent})').catch(()=> 'unavailable'));throw error}
  finally{if(client&&!exit)await client.call('Browser.close').catch(()=>{});client?.close();if(!exit)child.kill('SIGTERM');const deadline=Date.now()+5000;while(!exit&&Date.now()<deadline)await delay(50);if(!exit){child.kill('SIGKILL');await delay(100)}await fs.rm(temporary,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exitCode=1});
