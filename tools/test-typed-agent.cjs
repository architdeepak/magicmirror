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
 console.log('Typed agent: completed answer, provider errors, hard mute, cancellation and no fabricated demo fallback passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
