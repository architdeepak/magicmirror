const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('src/renderer.js','utf8');
(async()=>{
 const captions=[],spoken=[],notices=[];let calls=0,resolveTask;
 const context=vm.createContext({hardMuted:false,voiceStartGeneration:0,config:{hasGeminiKey:false},assistantTranscript:'',elements:{wakeToggle:{checked:false}},wake:{resume(){}},appendCaption:(role,text)=>captions.push({role,text}),runVoiceNavigation:()=>false,showAssistant(){},showOracle:(...args)=>notices.push(args),speech:{speak:text=>spoken.push(text),respond:()=>{throw new Error('Demo answer used')}},runAgentTask:async()=>{calls++;return{completed:true,summary:'Verified answer'}}});
 vm.runInContext(source.slice(source.indexOf('async function askMirror('),source.indexOf('async function handleWakeWord(')),context);
 await context.askMirror('Read the map');assert.equal(calls,1);assert.equal(spoken[0],'Verified answer');assert.equal(captions.at(-1).text,'Verified answer');
 context.runAgentTask=async()=>({error:'Sign in to Codex'});await context.askMirror('Another task');assert.equal(spoken.length,1);assert.equal(notices.at(-1)[0],'Sign in to Codex');
 context.hardMuted=true;await context.askMirror('Must not start');assert.equal(notices.at(-1)[2],'Hard muted');context.hardMuted=false;
 context.runAgentTask=()=>new Promise(resolve=>resolveTask=resolve);const pending=context.askMirror('Slow answer');context.voiceStartGeneration++;resolveTask({completed:true,summary:'Late answer'});await pending;assert.equal(spoken.length,1);assert(!captions.some(row=>row.text==='Late answer'));
 const order=[],progress={hidden:false};let resolveCancel,modeClick,serviceClick,returnClick;
 const manual=vm.createContext({agentRunId:'old',voiceStartGeneration:4,state:'thinking',gemini:{listening:false},agentTools:{cancel:()=>order.push('retire')},window:{mirrorBridge:{cancelCodex:()=>{order.push('cancel');return new Promise(r=>resolveCancel=r)},openService:async service=>order.push('service:'+service),closeDesktop:async()=>order.push('return')}},document:{querySelector:()=>progress,querySelectorAll:selector=>[{dataset:{mode:'watch',service:'maps'},textContent:'Maps',addEventListener:(_name,fn)=>{if(selector==='.mode-btn')modeClick=fn;else serviceClick=fn}}]},elements:{desktopReturn:{addEventListener:(_name,fn)=>returnClick=fn}},setState:value=>{manual.state=value;order.push(value)},setAssistantMode:value=>order.push('mode:'+value),showGesture(){},showOracle(){}});
 vm.runInContext(source.slice(source.indexOf('function cancelAgentTask()'),source.indexOf('const wake =')),manual);
 vm.runInContext(source.slice(source.indexOf("document.querySelectorAll('.mode-btn').forEach((button) => button.addEventListener"),source.indexOf('elements.settingsToggle.addEventListener')),manual);
 vm.runInContext(source.slice(source.indexOf("document.querySelectorAll('[data-service]').forEach"),source.indexOf('elements.assistantTaskForm.addEventListener')),manual);
 vm.runInContext(source.slice(source.indexOf('elements.desktopReturn.addEventListener'),source.indexOf('// Explicit fields keep credentials')),manual);
 for(const [click,expected]of [[modeClick,'mode:watch'],[serviceClick,'service:maps'],[returnClick,'return']]){
  manual.agentRunId='old';manual.state='thinking';order.length=0;const generation=manual.voiceStartGeneration;
  const pendingAction=click();assert.equal(manual.agentRunId,null);assert.equal(manual.voiceStartGeneration,generation+1);assert(progress.hidden);assert(!order.includes(expected),'User action ran before agent retirement');resolveCancel();await pendingAction;assert(order.includes(expected));assert(order.indexOf('cancel')<order.indexOf(expected));
 }
 order.length=0;manual.agentRunId=null;modeClick();assert.deepEqual(order,['mode:watch'],'Normal mode click became asynchronous');
 manual.agentRunId='old';manual.state='thinking';order.length=0;const superseded=serviceClick();await modeClick();resolveCancel();await superseded;assert(!order.includes('service:maps'),'Older launcher request overrode newer mode');assert(order.includes('mode:watch'));
 let resolveService;manual.agentRunId=null;manual.window.mirrorBridge.openService=()=>new Promise(r=>resolveService=r);order.length=0;const loadingService=serviceClick();await modeClick();assert(order.includes('return'),'New mode did not retire pending manual desktop load');resolveService();await loadingService;assert.equal(order.at(-1),'mode:watch');
 let cancelledListener;manual.window.mirrorBridge.onCodexCancelled=fn=>cancelledListener=fn;
 vm.runInContext(source.slice(source.indexOf('window.mirrorBridge?.onCodexCancelled'),source.indexOf('async function runAgentTask')),manual);
 manual.agentRunId='new-run';cancelledListener({runId:'old-run'});assert.equal(manual.agentRunId,'new-run');cancelledListener({runId:null});assert.equal(manual.agentRunId,'new-run');cancelledListener({runId:'new-run'});assert.equal(manual.agentRunId,null);
 let toolListener,rejectTool;manual.hardMuted=false;manual.showAgentProgress=value=>order.push(value);manual.window.mirrorBridge.onCodexTool=fn=>toolListener=fn;manual.window.mirrorBridge.codexToolResult=async()=>order.push('tool-result');manual.agentTools.execute=()=>new Promise((_resolve,reject)=>rejectTool=reject);
 vm.runInContext(source.slice(source.indexOf('window.mirrorBridge?.onCodexTool'),source.indexOf('window.mirrorBridge?.onCodexCancelled')),manual);
 manual.agentRunId='old-run';const lateTool=toolListener({runId:'old-run',tool:'see_screen'});manual.agentRunId='new-run';order.length=0;rejectTool(Error('Please sign in'));await lateTool;assert.deepEqual(order,[],'Old tool error changed replacement progress or result');assert.equal(manual.agentRunId,'new-run');
 let phoneListener,castListener;const acknowledgements=[];
 Object.assign(manual.elements,{watchUrl:{value:''},watchPanel:{dataset:{}},castingStatus:{}});manual.watchLoadGeneration=0;manual.youtubePlayer={detach:()=>order.push('detach')};manual.castPlayer={command:async command=>order.push('cast:'+command.action)};manual.loadWatchVideo=async()=>order.push('load:'+manual.elements.watchUrl.value);
 Object.assign(manual.window.mirrorBridge,{onPhoneMedia:fn=>phoneListener=fn,onCastCommand:fn=>castListener=fn,completeCastCommand:async input=>acknowledgements.push(input)});
 vm.runInContext(source.slice(source.indexOf('const removeCastCommandListener'),source.indexOf("document.querySelectorAll('[data-service]')")),manual);
 manual.agentRunId='old-run';order.length=0;const firstPhone=phoneListener('first.webm');const latestPhone=phoneListener('latest.webm');resolveCancel();await Promise.all([firstPhone,latestPhone]);assert.equal(manual.elements.watchUrl.value,'latest.webm');assert(!order.includes('load:first.webm'));assert(order.includes('load:latest.webm'));
 manual.agentRunId='old-run';order.length=0;const cast=castListener({id:'old-cast',action:'load',uri:'old.webm'});await phoneListener('new.webm');resolveCancel();await cast;assert(!order.includes('cast:load'));assert.match(acknowledgements.at(-1).error,/superseded/);
 manual.agentRunId='old-run';await castListener({id:'volume',action:'volume',volume:20});assert.equal(manual.agentRunId,'old-run','Volume adjustment retired conversation/agent');
 console.log('User handoff: mode/service/Return wait for agent cancellation, invalidate late answers, retire observation, hide progress, and retain immediate inactive-mode controls passed.');
 console.log('Typed agent: completed answer, provider errors, hard mute, cancellation and no fabricated demo fallback passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
