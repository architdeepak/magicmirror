const assert = require('assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a;reject=b; }); return {promise,resolve,reject}; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const read = name => fs.readFileSync(path.join(__dirname,'../src',name),'utf8');
function moduleClass(name, className, globals) {
  const context = vm.createContext({ console, setTimeout, clearTimeout, setInterval, clearInterval, performance, ...globals });
  if(name==='geminiLiveAdapter.js')vm.runInContext(read('audioTurnDetector.js').replace(/export class /g,'class '),context);
  vm.runInContext(read(name).replace(/^import .*;\n/gm,'').replace(/export class /g,'class ') + `\nglobalThis.Subject=${className};`,context);
  return { Subject: context.Subject, context };
}
async function playbackStateLifecycle() {
  const states=[];let ended=0,enabled=true,audioStops=0;
  const avatar={endAudioTurn(){ended++},getPlaybackStatus:()=>({enabled}),interrupt(){},stopAudioStream(){audioStops++}};
  const {Subject:Live}=moduleClass('geminiLiveAdapter.js','GeminiLiveAdapter',{document:{createElement:()=>({})}});
  const live=new Live({avatar,config:{},onState:value=>states.push(value)});live.connected=true;live.listening=true;
  avatar.onPlaybackState(true);assert.equal(states.at(-1),'speaking');
  await live._handleMessage(JSON.stringify({serverContent:{turnComplete:true}}));assert.equal(ended,1);assert.equal(states.at(-1),'speaking','Server completion labeled queued output Listening');
  enabled=false;avatar.onPlaybackState(false);assert.equal(states.at(-1),'listening');
  await live._handleMessage(JSON.stringify({serverContent:{turnComplete:true}}));assert.equal(states.at(-1),'listening');
  live.playbackSuppressed=true;const count=states.length;avatar.onPlaybackState(true);avatar.onPlaybackState(false);assert.equal(states.length,count,'Late playback event revived stopped state');
  live.playbackSuppressed=false;live.intentionalDisconnect=true;avatar.onPlaybackState(true);assert.equal(states.length,count);
  live.stopPlayback();assert.equal(audioStops,1,'Session Stop retained the avatar audio worklet');
  console.log('Playback UI: server end waits for queued audio, actual completion returns Listening and stopped callbacks cannot revive state');
}
async function wakeLifecycle() {
  const requests=[]; const contexts=[];
  class Audio {
    constructor() { this.closing=deferred();contexts.push(this);this.destination={}; }
    resume() { return Promise.resolve(); } close() { return this.closing.promise; }
    createMediaStreamSource() { return {connect(){},disconnect(){}}; }
    createScriptProcessor() { return {connect(){},disconnect(){}}; }
    createGain() { return {gain:{value:1},connect(){},disconnect(){}}; }
  }
  const recognizers=[];let acceptedFrames=0;
  const model={KaldiRecognizer:class {constructor(rate,grammar){assert.equal(rate,16000);if(grammar)assert(JSON.parse(grammar).includes('[unk]'));this.events={};recognizers.push(this);}on(event,handler){this.events[event]=handler;}acceptWaveform(){acceptedFrames++;}remove(){}},terminate(){this.terminated=true;}};
  const {Subject:Wake}=moduleClass('wakeWord.js','WakeWordListener',{
    window:{Vosk:{createModel:async()=>model}},AudioContext:Audio,
    navigator:{mediaDevices:{getUserMedia:()=>{const request=deferred();requests.push(request);return request.promise;}}}
  });
  const stream=()=>({stopped:false,getTracks(){return [{stop:()=>{this.stopped=true;}}];}});
  let stopped=0,woken=0;
  const wake=new Wake({onStop:()=>stopped++,onWake:()=>woken++});
  const first=wake.start();await tick();
  await wake.pause();const second=wake.start();await tick();
  const current=stream();requests[1].resolve(current);await second;
  const late=stream();requests[0].resolve(late);await first;
  assert(late.stopped && !current.stopped && wake.processor,'Late permission result replaced the live microphone');
  const oldProcessor=wake.processor;
  wake.setAssistantActive(true);wake._check('mirror stop');
  assert.equal(stopped,1,'Stop waited for AudioContext.close');
  assert(current.stopped && !wake.processor && !wake.audioContext);
  const restart=wake.start();await tick();const newer=stream();requests[2].resolve(newer);await restart;
  contexts[0].closing.resolve();await tick();
  assert.equal(wake.audioContext,contexts[1],'Old pause cleared the new AudioContext');
  oldProcessor.onaudioprocess({inputBuffer:{}});assert.equal(acceptedFrames,0,'Old audio frames reached the restarted decoder');
  wake.setAssistantActive(false);
  recognizers[0].events.partialresult({result:{partial:'mirror mirror'}});assert.equal(woken,0,'Old recognizer woke the restarted session');
  wake._check('miracle miracle');wake._check('near mirror');assert.equal(woken,0);
  wake._check('mirror mirror');assert.equal(woken,1);contexts[1].closing.resolve();
  const reconnect=wake.start();await tick();const listeners=new Set();let lossStopped=false;
  const lossTrack={readyState:'live',stop(){lossStopped=true;this.readyState='ended'},addEventListener:(_name,listener)=>listeners.add(listener),removeEventListener:(_name,listener)=>listeners.delete(listener)};
  let lossStatus='';wake.onStatus=status=>lossStatus=status;requests[3].resolve({getTracks:()=>[lossTrack]});await reconnect;
  for(const listener of [...listeners])listener();assert(lossStopped&&!wake.enabled&&!wake.processor&&!wake.stream);assert.equal(listeners.size,0);assert.equal(lossStatus,'disconnected');contexts.at(-1).closing.resolve();
  const initializing=deferred();let removed=false;
  const {Subject:DestroyWake}=moduleClass('wakeWord.js','WakeWordListener',{window:{Vosk:{createModel:()=>initializing.promise}}});
  const destroyed=new DestroyWake({});const starting=destroyed.start();await destroyed.destroy();
  initializing.resolve({terminate(){removed=true;}});await starting;
  assert(removed && !destroyed.model && !destroyed.recognizer,'Destroyed listener resurrected after model download');
}
async function localCaptionLifecycle() {
  const recognizers=[],captions=[];let stopped=0;
  const model={KaldiRecognizer:class {
    constructor(rate,grammar){this.grammar=grammar;this.events={};this.frames=[];recognizers.push(this);}
    on(event,handler){this.events[event]=handler;}
    remove(){this.removed=true;}
    acceptWaveformFloat(samples,rate){this.frames.push({samples,rate});}
  }};
  const {Subject:Wake}=moduleClass('wakeWord.js','WakeWordListener',{});
  const wake=new Wake({onTranscript:(text,meta)=>captions.push({text,...meta}),onStop:()=>stopped++});
  wake.model=model;wake.enabled=true;wake.setAssistantActive(true);
  const control=wake.recognizer;
  wake.captionPrefix=[{samples:new Float32Array([.1,.2]),sampleRate:16000}];
  const epoch=wake.startCaptionTurn();const first=wake.captionRecognizer;
  assert.equal(first.grammar,undefined);assert.equal(first.frames.length,1,'Speech onset prefix was lost');
  first.events.partialresult({result:{partial:'tell me'}});
  first.events.partialresult({result:{partial:'tell me a story'}});
  first.events.result({result:{text:'tell me a story'}});
  first.events.partialresult({result:{partial:'about a dragon'}});
  assert.equal(captions.at(-1).text,'tell me a story about a dragon');assert.equal(captions[0].epoch,epoch);
  const nextEpoch=wake.startCaptionTurn();assert(nextEpoch>epoch&&first.removed);
  const count=captions.length;first.events.result({result:{text:'late old words'}});assert.equal(captions.length,count);
  const current=wake.captionRecognizer;current.events.partialresult({result:{partial:'new turn'}});assert.equal(captions.at(-1).epoch,nextEpoch);
  control.events.partialresult({result:{partial:'mirror stop'}});assert.equal(stopped,1,'Caption decoder displaced stop detection');
  const stoppedCount=captions.length;current.events.partialresult({result:{partial:'late after stop'}});assert.equal(captions.length,stoppedCount);
  assert.equal(wake.startCaptionTurn(),0,'Paused listener created a caption decoder');
  const {context}=moduleClass('wakeWord.js','WakeWordListener',{});
  Object.assign(context,{hardMuted:false,gemini:{listening:true},localCaptionsAllowed:false,userCaptionFromLocal:false,captionUserTurnActive:true,localCaptionEpoch:0,
    wake:{startCaptionTurn:()=>10,stopCaptionTurn(){}},appendCaption:(...args)=>context.rows.push(args),rows:[],captionState:{user:'',assistant:''},assistantTranscript:'',showOracle(){},stopAssistant(){}});
  const renderer=read('renderer.js');vm.runInContext(renderer.slice(renderer.indexOf('function beginHeardCaption()'),renderer.indexOf('async function toggleVoice()')),context);
  context.beginHeardCaption();context.handleLocalTranscript('tell me a tail',{epoch:10});
  context.handleTranscript('user','Tell me a tale.');assert.equal(context.rows.at(-1)[2].replace,true,'Server transcription duplicated local interim words');
  const correctedCount=context.rows.length;context.handleLocalTranscript('old interim',{epoch:10});assert.equal(context.rows.length,correctedCount);
  context.beginHeardCaption();context.handleLocalTranscript('stale turn',{epoch:9});assert.equal(context.rows.length,correctedCount);
  context.hardMuted=true;context.handleLocalTranscript('muted',{epoch:10});assert.equal(context.rows.length,correctedCount);
}
async function failedModelDownload() {
  const statuses=[];
  const {Subject:Wake}=moduleClass('wakeWord.js','WakeWordListener',{window:{Vosk:{createModel:async()=>{throw undefined;}}}});
  const wake=new Wake({onStatus:status=>statuses.push(status)});await wake.start();
  assert(statuses.includes('unavailable')&&!wake.enabled,'Rejected model download left the wake listener armed');
}
async function modelLoadFailures() {
  const models=[],statuses=[];let expire;
  class Model {constructor(){this.events={};this.worker={terminate:()=>this.terminated=true};models.push(this);}on(name,callback){this.events[name]=callback;}}
  const {Subject:Wake}=moduleClass('wakeWord.js','WakeWordListener',{window:{Vosk:{Model}},setTimeout:(callback,delay)=>{assert.equal(delay,45000);expire=callback;return 1;},clearTimeout(){}});
  const wake=new Wake({onStatus:status=>statuses.push(status)});
  const failed=wake.start();await tick();models[0].events.error({error:'broken bundled model'});await failed;
  assert(models[0].terminated&&!wake.model&&!wake.starting);assert.equal(statuses.at(-1),'unavailable');
  const stalled=wake.start();await tick();expire();await stalled;
  assert(models[1].terminated&&!wake.model&&!wake.initializing&&!wake.starting);assert.equal(statuses.at(-1),'unavailable');
  models[1].events.load({result:true});await tick();assert.equal(wake.model,null,'Timed-out loading resurrected the speech model');
}
async function liveLifecycle() {
  const tokens=[],sockets=[],transcripts=[],errors=[];
  class Socket {
    static OPEN=1;
    constructor(){this.readyState=0;this.sent=[];sockets.push(this);}
    send(value){this.sent.push(JSON.parse(value));}close(){this.closed=true;this.readyState=3;this.onclose?.({code:1000});}
    open(){this.readyState=1;this.onopen();}
  }
  const avatar={startAudioStream:async()=>{},interrupt(){},endAudioTurn(){}};
  const {Subject:Live}=moduleClass('geminiLiveAdapter.js','GeminiLiveAdapter',{
    window:{mirrorBridge:{createGeminiToken:()=>{const token=deferred();tokens.push(token);return token.promise;}}},
    document:{createElement:()=>({})},WebSocket:Socket
  });
  const live=new Live({avatar,config:{hasGeminiKey:true,geminiModel:'fixture'},onTranscript:(...args)=>transcripts.push(args),onError:error=>errors.push(error)});
  const abandoned=live.connect();const rejection=assert.rejects(abandoned,/cancelled/);live.disconnect();
  const fresh=live.connect();tokens[1].resolve({token:'fixture'});await tick();sockets[0].open();await tick();
  await live._handleMessage(JSON.stringify({setupComplete:{}}));await fresh;
  tokens[0].resolve({token:'stale'});await rejection;
  assert.equal(sockets.length,1);assert(live.connected && !sockets[0].closed && errors.length===0,'Cancelled connection damaged the current socket');
  const old=sockets[0];live.disconnect();const again=live.connect();tokens[2].resolve({token:'new'});await tick();sockets[1].open();await tick();
  await live._handleMessage(JSON.stringify({setupComplete:{}}));await again;
  old.onclose({code:1006});assert(live.connected && !sockets[1].closed,'Old socket close stopped the new session');
  const blob=deferred();const message=live._handleMessage({text:()=>blob.promise});live.disconnect();
  blob.resolve(JSON.stringify({serverContent:{outputTranscription:{text:'stale'}}}));await message;assert.equal(transcripts.length,0);
  live.intentionalDisconnect=false;
  await live._handleMessage(JSON.stringify({serverContent:{inputTranscription:{text:' Hel'},outputTranscription:{text:'lo '}}}));
  assert.equal(transcripts[0][1],' Hel');assert.equal(transcripts[1][1],'lo ');assert(transcripts.every(t=>t[2].delta===true),'Live transcript lost raw delta metadata');transcripts.length=0;
  // Stop can fire from the first transcription inside a mixed server packet.
  live.intentionalDisconnect=false;live.onTranscript=(role,text)=>{transcripts.push([role,text]);if(role==='user')live.disconnect();};
  await live._handleMessage(JSON.stringify({serverContent:{inputTranscription:{text:'mirror stop'},outputTranscription:{text:'keep speaking'}}}));
  assert.equal(transcripts.length,1);
  let stopped=0;live.outputSources.add({stop(){stopped++;},disconnect(){}});live.outputCursor=10;
  live._interruptPlayback();assert.equal(stopped,1);assert.equal(live.outputCursor,0);
  live.connected=true;live.outputSources.add({stop(){stopped++;},disconnect(){}});
  await live.askText('synthetic new turn');assert.equal(stopped,2,'A new typed turn did not stop queued fallback audio');
  live.connected=false;
  live.intentionalDisconnect=false;live.playbackSuppressed=false;
  let executions=0;let modes=0;const wait=deferred();
  live.onComputerAction=async()=>{executions++;await wait.promise;return {result:'input delivered'};};
  live.onCaptureScreen=async()=>{throw new Error('fixture capture blocked');};
  live.onModeChange=async()=>{modes++;};
  const action={functionCalls:[{id:'one',name:'computer_action',args:{action:'key',key:'enter'}}]};
  const actionPending=live._queueToolCall(action);const queued=live._queueToolCall({functionCalls:[{id:'two',name:'set_display_mode',args:{mode:'watch'}}]});
  await tick();assert.equal(executions,1);assert.equal(modes,0,'Tools ran concurrently');
  live.disconnect();wait.resolve();await Promise.all([actionPending,queued]);assert.equal(modes,0,'Queued tool ran after stop');
  live.intentionalDisconnect=false;live.playbackSuppressed=false;live.onComputerAction=async()=>{executions++;return {result:'input delivered'};};
  await live._queueToolCall(action);await live._queueToolCall(action);assert.equal(executions,2,'A duplicated mutation call ran twice');
  // Images belong to the function response, never its JSON metadata or retry cache.
  const screenMessages=[];const originalSend=live._send;
  live._send=message=>screenMessages.push(message);
  live.onCaptureScreen=async()=>({dataUrl:'data:image/jpeg;base64,fixture-image',width:1280,height:2276,snapshotId:'fresh-screen',documentId:'page-1'});
  await live._queueToolCall({functionCalls:[{id:'screen',name:'see_screen',args:{}}]});
  const observed=screenMessages.at(-1).toolResponse.functionResponses[0];
  assert.equal(observed.parts[0].inlineData.data,'fixture-image');
  assert.equal(observed.response.observation.imagePart,undefined);
  assert(!screenMessages.some(message=>message.realtimeInput),'Screenshot was sent independently of its tool result');
  const verifiedAction={functionCalls:[{id:'verified-action',name:'computer_action',args:{action:'click',x:500,y:500,snapshotId:'fresh-screen'}}]};
  let deliveredCoordinates;live.onComputerAction=async args=>{executions++;deliveredCoordinates=args;return {result:'clicked'};};
  await live._queueToolCall(verifiedAction);
  assert.equal(deliveredCoordinates.x,640);assert.equal(deliveredCoordinates.y,1138);
  const delivered=screenMessages.at(-1).toolResponse.functionResponses[0];
  assert.equal(delivered.parts[0].inlineData.mimeType,'image/jpeg');
  assert.match(delivered.response.result,/does not prove/);
  const previousExecutions=executions;await live._queueToolCall(verifiedAction);
  const replayed=screenMessages.at(-1).toolResponse.functionResponses[0];
  assert.equal(executions,previousExecutions);assert.equal(replayed.parts,undefined);assert.equal(replayed.response.observation,undefined);
  assert(replayed.response.replayed);
  await live._queueToolCall({functionCalls:[{id:'fresh-id-repeat',name:'computer_action',args:{action:'click',x:503,y:501,snapshotId:'fresh-screen'}}]});
  assert.equal(executions,previousExecutions,'Nearby duplicate activation with a different ID was delivered');
  assert.match(screenMessages.at(-1).toolResponse.functionResponses[0].response.error,/already delivered/);

  for (const invalid of [{x:1001,y:500,snapshotId:'fresh-screen'},{x:500,y:500,snapshotId:'old-screen'}]) {
    await live._queueToolCall({functionCalls:[{id:JSON.stringify(invalid),name:'computer_action',args:{action:'click',...invalid}}]});
    assert.equal(executions,previousExecutions);assert(screenMessages.at(-1).toolResponse.functionResponses[0].response.error);
  }
  await live._queueToolCall({functionCalls:[{id:'scroll-between',name:'computer_action',args:{action:'scroll',x:500,y:500,deltaY:100,snapshotId:'fresh-screen'}}]});
  await live._queueToolCall({functionCalls:[{id:'click-after-scroll',name:'computer_action',args:{action:'click',x:500,y:500,snapshotId:'fresh-screen'}}]});
  assert.equal(executions,previousExecutions+2,'Successful scrolling did not permit clicking in the new view');
  await live._queueToolCall({functionCalls:[{id:'intentional-double',name:'computer_action',args:{action:'double_click',x:750,y:500,snapshotId:'fresh-screen'}}]});
  assert.equal(deliveredCoordinates.action,'double_click');assert.equal(deliveredCoordinates.x,960);
  const beforeDoubleRepeat=executions;
  await live._queueToolCall({functionCalls:[{id:'double-again',name:'computer_action',args:{action:'double_click',x:750,y:500,snapshotId:'fresh-screen'}}]});
  assert.equal(executions,beforeDoubleRepeat,'Repeated double-click escaped the activation guard');
  live.onCaptureScreen=async()=>({dataUrl:'data:image/jpeg;base64,fixture-image',width:1280,height:2276,snapshotId:'page-two-shot',documentId:'page-2'});
  await live._queueToolCall({functionCalls:[{id:'observe-page-two',name:'see_screen',args:{}}]});
  await live._queueToolCall({functionCalls:[{id:'page-two-click',name:'computer_action',args:{action:'double_click',x:750,y:500,snapshotId:'page-two-shot'}}]});
  assert.equal(executions,beforeDoubleRepeat+1,'New observed document blocked legitimate same-position input');
  await live._queueToolCall({functionCalls:[{id:'page-two-repeat',name:'computer_action',args:{action:'click',x:750,y:500,snapshotId:'page-two-shot'}}]});
  assert.equal(executions,beforeDoubleRepeat+1,'Same new document bypassed duplicate guard');
  live.onCaptureScreen=async()=>({dataUrl:'data:image/jpeg;base64,fixture-image',width:1280,height:2276,snapshotId:'unknown-document'});
  await live._queueToolCall({functionCalls:[{id:'observe-unknown',name:'see_screen',args:{}}]});
  await live._queueToolCall({functionCalls:[{id:'unknown-repeat',name:'computer_action',args:{action:'click',x:750,y:500,snapshotId:'unknown-document'}}]});
  assert.equal(executions,beforeDoubleRepeat+1,'Missing identity relaxed duplicate guard');
  live._send=originalSend;
  let endedSessions=0;live.onSessionEnd=()=>endedSessions++;
  for(const failure of ['close','error']) {
    live.disconnect();const opening=live.connect();tokens.at(-1).resolve({token:'fixture'});await tick();const socket=sockets.at(-1);socket.open();await tick();await live._handleMessage(JSON.stringify({setupComplete:{}}));await opening;
    let stoppedTrack=false,stoppedOutput=false;live.listening=true;live.micStream={getTracks:()=>[{stop(){stoppedTrack=true}}]};live.processor={disconnect(){}};live.outputSources.add({stop(){stoppedOutput=true},disconnect(){}});
    const unfinished=deferred();live.onComputerAction=()=>unfinished.promise;const pendingTool=live._queueToolCall({functionCalls:[{id:failure,name:'computer_action',args:{action:'key',key:'enter'}}]});await tick();
    const queuedMode=live._queueToolCall({functionCalls:[{id:failure+'-next',name:'set_display_mode',args:{mode:'watch'}}]});const previousModes=modes;
    if(failure==='close')socket.onclose({code:1000});else socket.onerror();
    assert(stoppedTrack&&stoppedOutput&&!live.listening&&!live.connected&&!live.micStream);assert.equal(live.ws,null);assert(live.playbackSuppressed);unfinished.resolve({result:'old result'});await Promise.all([pendingTool,queuedMode]);assert.equal(modes,previousModes,'Connection loss ran a queued mode change');
  }
  assert.equal(endedSessions,2,'Unexpected connection loss did not notify the mirror exactly once');
}
async function microphoneTurns() {
  const streams=[];
  class Audio {
    constructor(){this.sampleRate=16000;this.destination={};}
    resume(){return Promise.resolve()}close(){return Promise.resolve()}
    createMediaStreamSource(){return{connect(){}}}createGain(){return{gain:{value:1},connect(){}}}
    createScriptProcessor(){return{connect(){},disconnect(){}}}
  }
  const {Subject:Live}=moduleClass('geminiLiveAdapter.js','GeminiLiveAdapter',{
    AudioContext:Audio,WebSocket:{OPEN:1},document:{createElement:()=>({})},window:{mirrorBridge:{}},btoa:value=>Buffer.from(value,'binary').toString('base64'),
    navigator:{mediaDevices:{getUserMedia:async()=>{const listeners=new Set();const track={stopped:false,readyState:'live',stop(){this.stopped=true;this.readyState='ended'},addEventListener:(_type,listener)=>listeners.add(listener),removeEventListener:(_type,listener)=>listeners.delete(listener),end(){this.readyState='ended';for(const listener of [...listeners])listener()},listeners};streams.push(track);return{getTracks:()=>[track]}}}}
  });
  const sent=[];const live=new Live({avatar:{interrupt(){}},config:{geminiVoice:'Gacrux',geminiModel:'fixture'}});
  live.setVisionEnabled(false);live.connected=true;live.ws={readyState:1,send:message=>sent.push(JSON.parse(message)),close(){}};
  live._sendSetup();assert.equal(sent[0].setup.realtimeInputConfig.automaticActivityDetection.disabled,true);sent.length=0;
  await live.startMicrophone();const old=live.processor;
  const event=amplitude=>({inputBuffer:{getChannelData:()=>new Float32Array(1600).fill(amplitude)}});
  old.onaudioprocess(event(0));assert.equal(sent.length,0,'Idle microphone silence was uploaded');
  old.onaudioprocess(event(.08));old.onaudioprocess(event(.08));
  assert(sent[0].realtimeInput.activityStart);assert.equal(sent.filter(message=>message.realtimeInput.audio).length,3,'Activity start did not replay buffered onset');
  for(let i=0;i<7;i++)old.onaudioprocess(event(0));assert.equal(sent.filter(message=>message.realtimeInput.activityEnd).length,1);
  live.stopMicrophone();assert(streams[0].stopped);await live.startMicrophone();const count=sent.length;
  old.onaudioprocess(event(.2));assert.equal(sent.length,count,'Old processor fed the resumed microphone session');
  live.processor.onaudioprocess(event(.08));live.processor.onaudioprocess(event(.08));live.stopMicrophone();
  assert.equal(sent.filter(message=>message.realtimeInput.activityEnd).length,2,'Stopping speech failed to close its activity');assert(streams[1].stopped);
  assert(!sent.some(message=>message.realtimeInput.audioStreamEnd),'Manual turns mixed incompatible automatic-VAD markers');
  let failures=[];live.onError=message=>failures.push(message);await live.startMicrophone();const staleEnd=[...streams[2].listeners][0];
  live.outputSources.add({stop(){this.stopped=true},disconnect(){}});streams[2].end();assert.equal(live.listening,false);assert.equal(live.micStream,null);assert.equal(live.connected,false);assert.equal(live.ws,null);assert.equal(live.outputSources.size,0);assert(live.playbackSuppressed);assert.match(failures[0],/Microphone disconnected/);assert.equal(streams[2].listeners.size,0);
  await live.startMicrophone();staleEnd();assert(live.listening,'Old microphone ended event stopped a new session');live.stopMicrophone();
}
async function cameraFrames() {
  let draws=0;const sent=[];
  const {Subject:Live}=moduleClass('geminiLiveAdapter.js','GeminiLiveAdapter',{WebSocket:{OPEN:1},document:{createElement:()=>({getContext:()=>({drawImage(){draws++}}),toDataURL:()=> 'data:image/jpeg;base64,fixture'})}});
  const live=new Live({avatar:{},config:{}});live.ws={readyState:1,send:value=>sent.push(JSON.parse(value))};
  const video={srcObject:null,readyState:4,videoWidth:640,videoHeight:480};live.setVideoSource(video);
  assert.equal(await live._sendVideoFrame(),false,'Camera-off shared a stale decoded frame');
  video.srcObject={active:false};assert.equal(await live._sendVideoFrame(),false,'Ended stream shared a stale frame');
  video.srcObject={active:true};assert.equal(await live._sendVideoFrame(),true);assert.equal(sent.length,1);assert.equal(draws,1);
  live.setVisionEnabled(false);assert.equal(await live._sendVideoFrame(),false,'Disabled vision still sent frames');
  live.avatar.interrupt=()=>{};live.connected=true;live.setVisionEnabled(true);
  const query=live.askText('Inspect this preview');await tick();
  assert.equal(live.visionWaits.size,1,'Visual question did not wait for the image');
  assert(!sent.some(message=>message.realtimeInput?.text),'Question overtook its video frame');
  live.stopMicrophone();await query;
  assert.equal(live.visionWaits.size,0);assert(!sent.some(message=>message.realtimeInput?.text),'Stopped visual question was sent after cleanup');
}
async function awakeningCancellation() {
  const source=read('renderer.js');const timers=[];let opened=0;
  const active=new Set();const context=vm.createContext({magic:{play(){},cancel(){}},
    agentRunId:null,hardMuted:false,voiceStartGeneration:0,wake:{pause(){},setAssistantActive(){},resume(){}},wakeFromSleep:async()=>{},
    elements:{wakeToggle:{checked:true},awakening:{classList:{add:x=>active.add(x),remove:x=>active.delete(x)}}},
    config:{hasGeminiKey:false},setState(next){this.state=next;},appendCaption(){},showAssistant(){},showOracle(){},avatar:{persona:'velora'},
    speech:{setPersona(){},speak:async()=>{}},toggleVoice:async()=>opened++,setTimeout:callback=>timers.push(callback)
  });
  vm.runInContext(source.slice(source.indexOf('async function handleWakeWord('),source.indexOf('function updateWakeStatus(')),context);
  const waking=context.handleWakeWord('');await tick();assert(active.has('active'));
  context.voiceStartGeneration++;active.clear();timers.shift()();await waking;assert.equal(opened,0,'Stop during reveal reopened listening');
  const muted=context.handleWakeWord('');await tick();context.hardMuted=true;context.voiceStartGeneration++;context.hardMuted=false;active.clear();timers.shift()();await muted;
  assert.equal(opened,0,'Mute then unmute revived an old wake sequence');
  let stops=0;active.add('active');
  context.voiceStarting=false;context.browserRecognition=null;context.gemini={listening:false};context.speech.isSpeaking=false;
  context.elements.awakening.classList.contains=x=>active.has(x);
  context.stopAssistant=()=>{stops++;active.clear();context.voiceStartGeneration++;};
  vm.runInContext(source.slice(source.indexOf('async function toggleVoice('),source.indexOf('function appendCaption(')),context);
  await context.toggleVoice();assert.equal(stops,1,'Listen button started a session during reveal instead of stopping');
  context.speech.isSpeaking=true;await context.toggleVoice();assert.equal(stops,2,'Button did not stop the fallback greeting');
  context.watchAvatarLayout={schedule(){}};
  context.watchAudioDucking={setActive(value){this.active=value}};
  context.youtubePlayer={setDucking(value){this.active=value}};
  context.mode='mirror';context.elements.stateLabel={};context.elements.stateDot={};context.elements.micLabel={};
  context.elements.mic={classList:{toggle(){}},setAttribute(){}};context.returnToRequestedMode=()=>{};
  vm.runInContext(source.slice(source.indexOf('function setState('),source.indexOf('function showOracle(')),context);
  context.speech.isSpeaking=false;active.add('active');context.setState('starting');
  assert.equal(context.elements.micLabel.textContent,'STOP','Reveal had no visible Stop control');
  active.clear();context.setState('ready');assert.equal(context.elements.micLabel.textContent,'LISTEN');assert.equal(context.watchAudioDucking.active,false);
  context.agentRunId='running';context.setState('thinking');assert.equal(context.watchAudioDucking.active,true);assert.equal(context.elements.micLabel.textContent,'STOP');await context.toggleVoice();assert.equal(stops,3,'Button did not stop a delegated agent task');
}
(async()=>{await playbackStateLifecycle();await wakeLifecycle();await localCaptionLifecycle();await failedModelDownload();await modelLoadFailures();await liveLifecycle();await microphoneTurns();await cameraFrames();await awakeningCancellation();console.log('Voice lifecycle passed: immediate stop, permission/close races, cancelled wake, stale sockets/transcripts, audio interruption, explicit microphone boundaries, local interim captions with server correction and stale-turn rejection, serialized and deduplicated tools.');})().catch(error=>{console.error(error);process.exitCode=1;});
