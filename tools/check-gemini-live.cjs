// Real service smoke check: synthetic text and colored video, no microphone, physical camera, screen,
// local memory, or account data. Uses production token and adapter code.
const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('fs/promises');const path=require('path');const vm=require('vm');const {pathToFileURL}=require('url');
require('dotenv').config({path:path.join(__dirname,'../.env')});
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
  const directory=path.join(__dirname,'../artifacts/gemini-live');await fs.mkdir(directory,{recursive:true});
  const source=await fs.readFile(path.join(__dirname,'../src/main.js'),'utf8');
  const context=vm.createContext({process,Date,fetch,integrationSettings:{value:(_field,fallback)=>fallback}});
  vm.runInContext(source.slice(source.indexOf('async function createGeminiToken('),source.indexOf('function registerBridge(')),context);
  ipcMain.handle('mirror:create-gemini-token',()=>context.createGeminiToken());
  const model=process.env.GEMINI_LIVE_MODEL||'gemini-3.1-flash-live-preview';
  const fixture=path.join(directory,'live.html');
  const adapterUrl=pathToFileURL(path.join(__dirname,'../src/geminiLiveAdapter.js')).href;
  const visionUrl=pathToFileURL(path.join(__dirname,'../src/assistantVision.js')).href;
  await fs.writeFile(fixture,`<!doctype html><body><p>Live voice smoke check</p><script type="module">
    import {GeminiLiveAdapter} from ${JSON.stringify(adapterUrl)};
    import {selectAssistantVision} from ${JSON.stringify(visionUrl)};
    window.report={states:[],transcripts:[],samples:0,audio:[],error:null,complete:false,toolCalls:[],avatarPosition:null};
    const avatar={streaming:false,startAudioStream:async()=>{},interrupt(){},endAudioTurn(){},setSpeechLevel(){},setViseme(){},setPerformance(){}};
    window.live=new GeminiLiveAdapter({avatar,config:{hasGeminiKey:true,geminiModel:${JSON.stringify(model)},geminiVoice:'Gacrux'},
      onState:state=>report.states.push(state),onTranscript:(role,text)=>report.transcripts.push({role,text}),
      onError:error=>report.error=error,onTurnComplete:()=>report.complete=true,
      onMirrorState:()=>({display:{mode:'watch',avatarPosition:report.avatarPosition||'center'},camera:{active:false},tryOn:{closet:[]}}),
      onAvatarPosition:async position=>{report.avatarPosition=position;},
      onWatchControl:async()=>({source:'youtube',playing:false,ready:true,position:15,duration:100})});
    const tools=live._handleToolCall.bind(live);
    const send=live._send.bind(live);live._send=message=>{if(message.realtimeInput?.video)report.lastVideo=message.realtimeInput.video.data;return send(message)};
    live._handleToolCall=async input=>{report.toolCalls.push(...(input.functionCalls||[]).map(call=>call.name));return tools(input)};
    const play=live._playFallbackPcm.bind(live);
    live._playFallbackPcm=(pcm,rate)=>{report.samples+=pcm.length;report.audio.push(Array.from(pcm));play(pcm,rate)};
    live.setVisionEnabled(false);
    window.run=async()=>{try{await live.askText('Say exactly this short greeting, with warm theatrical confidence: Yes, your evil highness.');}catch(error){report.error=error.message;report.complete=true;}};
    window.colorPreview=async color=>{
      if(!window.preview){
        const canvas=document.createElement('canvas');canvas.width=360;canvas.height=640;
        const video=document.createElement('video');video.muted=true;video.playsInline=true;document.body.append(video);
        window.preview={canvas,video,color,timer:null,stream:canvas.captureStream(30)};video.srcObject=preview.stream;
        const draw=()=>{const context=canvas.getContext('2d');context.fillStyle=preview.color;context.fillRect(0,0,360,640)};
        draw();preview.timer=setInterval(draw,33);await video.play();
      }
      preview.color=color;
      await new Promise(resolve=>setTimeout(resolve,120));
      live.setVideoSource(()=>selectAssistantVision({mode:'ar',desktopActive:false,neural:preview.video,
        neuralState:{active:true,state:'streaming',frameAgeMs:0},view:'live',width:360,height:640}));
      live.setVisionEnabled(true);
    };
  </script>`);
  const win=new BrowserWindow({width:360,height:640,show:false,webPreferences:{preload:path.join(__dirname,'../src/preload.js'),partition:`gemini-smoke-${process.pid}`,contextIsolation:true,nodeIntegration:false,offscreen:true,autoplayPolicy:'no-user-gesture-required'}});
  try{
    await win.loadFile(fixture);await win.webContents.executeJavaScript('window.run()');
    const started=Date.now();let report;
    while(true){
      report=await win.webContents.executeJavaScript('JSON.parse(JSON.stringify(window.report))');
      if(report.error||report.complete)break;
      if(Date.now()-started>30000)throw new Error('Live voice response did not finish in 30 seconds');
      await new Promise(resolve=>setTimeout(resolve,150));
    }
    if(report.error)throw new Error(report.error);
    if(!report.samples||!report.transcripts.some(item=>item.role==='assistant'))throw new Error('Live session returned no audio or output transcription');
    const pcm=Buffer.alloc(report.samples*2);let offset=0;
    for(const chunk of report.audio)for(const sample of chunk){pcm.writeInt16LE(sample,offset);offset+=2;}
    let energy=0;for(let i=0;i<pcm.length;i+=2)energy+=(pcm.readInt16LE(i)/32768)**2;
    const rms=Math.sqrt(energy/report.samples);if(rms<.001)throw new Error('The generated greeting was silent');
    const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(24000,24);header.writeUInt32LE(48000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
    await fs.writeFile(path.join(directory,'greeting.wav'),Buffer.concat([header,pcm]));
    const greeting={rms,audioSeconds:report.samples/24000,transcripts:report.transcripts,states:report.states};
    await win.webContents.executeJavaScript(`report.complete=false;report.audio=[];report.samples=0;report.transcripts=[];report.states=[];live.askText('First call get_mirror_state, then call set_avatar_position with left, then call control_watch with status. After all tools return, say only: I have moved aside.')`);
    const toolStarted=Date.now();let toolReport;
    while(true){
      toolReport=await win.webContents.executeJavaScript('JSON.parse(JSON.stringify(window.report))');
      if(toolReport.error)throw new Error(toolReport.error);
      if(toolReport.complete&&toolReport.avatarPosition==='left'&&toolReport.samples)break;
      if(Date.now()-toolStarted>30000)throw new Error('Live tool turn did not finish: '+JSON.stringify({calls:toolReport.toolCalls,position:toolReport.avatarPosition,complete:toolReport.complete}));
      await new Promise(resolve=>setTimeout(resolve,150));
    }
    if(!['get_mirror_state','set_avatar_position','control_watch'].every(name=>toolReport.toolCalls.includes(name)))throw new Error('The live model did not call all requested tools');
    const vision=[];
    for(const color of ['blue','green']){
      await win.webContents.executeJavaScript(`(async()=>{await colorPreview(${JSON.stringify(color)});report.complete=false;report.audio=[];report.samples=0;report.transcripts=[];report.toolCalls=[];await live.askText('Look at the latest video frame. Name its dominant color in exactly one word. Do not call tools.');})()`);
      const started=Date.now();let colorReport;
      while(true){
        colorReport=await win.webContents.executeJavaScript('JSON.parse(JSON.stringify(window.report))');
        if(colorReport.error)throw new Error(colorReport.error);
        if(colorReport.complete)break;
        if(Date.now()-started>30000)throw new Error('Synthetic vision turn did not finish');
        await new Promise(resolve=>setTimeout(resolve,150));
      }
      const text=colorReport.transcripts.filter(item=>item.role==='assistant').map(item=>item.text).join(' ').trim();
      const captured=await win.webContents.executeJavaScript(`({source:live.getVideoSourceSnapshot(),pixel:Array.from(live.videoCanvas.getContext('2d').getImageData(Math.floor(live.videoCanvas.width/2),Math.floor(live.videoCanvas.height/2),1,1).data),width:live.videoCanvas.width,height:live.videoCanvas.height,videoTime:preview.video.currentTime})`);
      if(colorReport.lastVideo)await fs.writeFile(path.join(directory,'vision-'+color+'.jpg'),Buffer.from(colorReport.lastVideo,'base64'));
      await fs.writeFile(path.join(directory,'vision-'+color+'.json'),JSON.stringify({expected:color,response:text,captured},null,2));
      if(!new RegExp('\\b'+color+'\\b','i').test(text))throw new Error('Live model did not identify '+color+' preview: '+text+'; pixel='+JSON.stringify(captured.pixel));
      const input=await win.webContents.executeJavaScript('live.getVideoSourceSnapshot()');
      if(input.lastSentSource!=='live-ai-try-on')throw new Error('Live service did not receive the displayed try-on source');
      vision.push({expected:color,response:text,source:input.lastSentSource,audioSeconds:colorReport.samples/24000});
    }
    const result={checkedAt:new Date().toISOString(),model,voice:'Gacrux',greeting,tools:{calls:toolReport.toolCalls,avatarPosition:toolReport.avatarPosition,audioSeconds:toolReport.samples/24000,transcripts:toolReport.transcripts},vision:{synthetic:true,physicalCamera:false,generatedClothing:false,turns:vision}};
    await fs.writeFile(path.join(directory,'result.json'),JSON.stringify(result,null,2));
    console.log('Real Gemini Live passed:',JSON.stringify(result));
  }finally{await win.webContents.executeJavaScript('window.live?.stopPlayback();window.live?.disconnect();if(window.preview){clearInterval(preview.timer);preview.stream.getTracks().forEach(track=>track.stop());preview.video.srcObject=null}').catch(()=>{});win.destroy();app.quit();}
}).catch(error=>{const key=process.env.GEMINI_API_KEY;console.error(key?String(error.message).split(key).join('[redacted]'):error.message);app.exit(1)});
