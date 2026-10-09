const assert = require('assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { createNativeDesktop } = require('../src/nativeDesktop.cjs');
const main = fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8');
const renderer = fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
(async()=>{
  const calls=[];let pending=false;
  const handle=Buffer.alloc(8);handle.writeBigInt64LE(82n);
  const area={x:-1080,y:20,width:1080,height:1200};
  const context=vm.createContext({AbortController,Buffer,mainWindow:{getNativeWindowHandle:()=>handle},desktopWindow:null,desktopActionAbort:null,lastScreenObservation:{id:'old'},
    screen:{dipToScreenPoint:point=>({x:Math.round(point.x*1.25),y:Math.round(point.y*1.25)})},
    nativeCompanion:{active:true,exposedBounds:()=>area},nativeDesktop:{supported:true,scrollFromGesture:async(input,signal)=>{
      calls.push(input);if(pending)return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('cancelled'))));return{result:'Native app scroll requested'};
    }}});
  vm.runInContext(main.slice(main.indexOf('async function scrollDesktopFromGesture('),main.indexOf('function spotifyClientId()')),context);
  context.desktopObservationGeneration=0;
  vm.runInContext(main.slice(main.indexOf('function invalidateDesktopObservation('),main.indexOf('async function captureCurrentScreen(')),context);
  await context.scrollDesktopFromGesture('down');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),{x:-675,y:775,deltaY:360,mirrorWindowId:'82',bounds:{left:-1350,top:25,right:0,bottom:1525}});
  assert.equal(context.lastScreenObservation,null,'Gesture left an earlier AI screenshot authorized');
  assert.equal(context.desktopObservationGeneration,1,'Gesture did not invalidate captures still in flight');
  await context.scrollDesktopFromGesture('up');assert.equal(calls[1].deltaY,-360);
  await assert.rejects(context.scrollDesktopFromGesture('left'),/up or down/);
  pending=true;const running=context.scrollDesktopFromGesture('down');
  await assert.rejects(context.scrollDesktopFromGesture('down'),/action to finish/);
  context.desktopActionAbort.abort();await assert.rejects(running,/cancelled/);assert.equal(context.desktopActionAbort,null);
  context.nativeDesktop.supported=false;await assert.rejects(context.scrollDesktopFromGesture('down'),/available on Windows/);
  context.nativeCompanion.active=false;const browserInputs=[];let focused=false;
  context.desktopWindow={isDestroyed:()=>false,isVisible:()=>true,getContentSize:()=>[500,650],focus:()=>focused=true,webContents:{sendInputEvent:input=>browserInputs.push(input)}};
  await context.scrollDesktopFromGesture('down');assert(focused);assert.equal(browserInputs[0].deltaY,-423);
  await context.scrollDesktopFromGesture('up');assert.equal(browserInputs[1].deltaY,423);

  let ipcHandler,dispatches=0;const frame={};const webContents={mainFrame:frame};
  vm.runInNewContext(main.slice(main.indexOf("  ipcMain.handle('mirror:desktop-gesture-scroll'"),main.indexOf("  ipcMain.handle('mirror:desktop-presentation'")),{
    ipcMain:{handle:(_name,handler)=>ipcHandler=handler},mainWindow:{webContents},scrollDesktopFromGesture:()=>dispatches++
  });
  assert.throws(()=>ipcHandler({sender:{},senderFrame:frame},'down'),/mirror’s gesture/);
  assert.throws(()=>ipcHandler({sender:webContents,senderFrame:{}},'down'),/mirror’s gesture/);
  ipcHandler({sender:webContents,senderFrame:frame},'down');assert.equal(dispatches,1);

  let invocation;
  await createNativeDesktop({platform:'win32',run:async(...args)=>{invocation=args;return{stdout:'{"result":"requested"}'}}}).scrollFromGesture({op:'type_text',...calls[0]});
  assert.equal(JSON.parse(Buffer.from(invocation[2].env.MIRROR_DESKTOP_INPUT,'base64').toString('utf8')).op,'gesture_scroll');

  const actions=[],notices=[];let refreshes=0,reads=0,stops=0,returns=0;
  const routing=vm.createContext({agentRunId:null,beginUserControl:()=>({current:()=>true,wait:null}),experience:{capturing:false,routineActive:false,gesture:()=>false},closet:{photo:{gesture:()=>false}},desktopActive:true,desktopKind:'native',desktopLabel:'Spotify',mode:'mirror',spotifySnapshot:{isPlaying:false},voiceStarting:false,gemini:{listening:false},browserRecognition:null,speech:{isSpeaking:false},state:'ready',
    elements:{awakening:{classList:{contains:()=>false}}},window:{mirrorBridge:{spotifyCurrent:async()=>{reads++;return{connected:true,isPlaying:true}},spotifyControl:async action=>actions.push(action),scrollDesktopGesture:async direction=>{actions.push(direction);return{result:'Scroll requested'}},closeDesktop:async()=>returns++}},
    refreshSpotify:async()=>{refreshes++;routing.spotifySnapshot={isPlaying:true}},showGesture:message=>notices.push(message),stopAssistant:()=>stops++});
  vm.runInContext(renderer.slice(renderer.indexOf('async function dispatchSpotifyGesture('),renderer.indexOf("  if (mode === 'watch'",renderer.indexOf('async function dispatchGesture(')))+'}',routing);
  await routing.dispatchGesture('pinch');assert.equal(actions.at(-1),'pause');assert.equal(refreshes,1);assert.equal(reads,1,'Native Spotify pinch skipped the fresh playback read');
  await routing.dispatchGesture('swipe-left');assert.equal(actions.at(-1),'next');
  await routing.dispatchGesture('swipe-right');assert.equal(actions.at(-1),'previous');
  await routing.dispatchGesture('swipe-up');assert.equal(actions.at(-1),'down');
  routing.agentRunId='old';routing.beginUserControl=()=>{actions.push('handoff');routing.agentRunId=null;return{current:()=>true,wait:null}};await routing.dispatchGesture('swipe-up');assert.deepEqual(actions.slice(-2),['handoff','down']);routing.beginUserControl=()=>({current:()=>true,wait:null});
  routing.voiceStarting=true;await routing.dispatchGesture('palm');assert.equal(stops,1);assert.equal(returns,0,'Palm closed the native app while stopping voice');
  routing.voiceStarting=false;await routing.dispatchGesture('palm');assert.equal(returns,1);
  const commandsBeforeFailure=actions.length;const readCurrent=routing.window.mirrorBridge.spotifyCurrent;
  routing.window.mirrorBridge.spotifyCurrent=async()=>({error:'Playback state unavailable'});
  await assert.rejects(routing.dispatchGesture('pinch'),/state unavailable/);assert.equal(actions.length,commandsBeforeFailure,'Failed playback read sent a guessed toggle');
  routing.window.mirrorBridge.spotifyCurrent=readCurrent;
  routing.desktopLabel='Spotify sign-in';const previous=actions.length;await routing.dispatchGesture('pinch');assert.equal(actions.length,previous,'Sign-in browser received playback commands');
  routing.desktopActive=false;routing.mode='spotify';await routing.dispatchGesture('pinch');assert.equal(actions.at(-1),'pause');
  console.log('Desktop gesture routing passed: native TV/DPI mapping, cancellation, trusted frame, forced scroll operation, managed-browser signs, Spotify fresh-state pinch and track swipes, and palm stop/return. Windows wheel delivery remains a separate hardware check.');
})().catch(error=>{console.error(error);process.exitCode=1});
