const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const {displayFrequency}=require('../src/displayCadence.cjs');
const win={isDestroyed:()=>false,getBounds:()=>({x:100,y:200,width:500,height:800})};
const mainSource=fs.readFileSync('src/main.js','utf8');const messages=[],events=new Map(),subscriptions=new Map();let frequency=30,closed=false,contentsDestroyed=false;
const publisherWin={...win,isDestroyed:()=>closed,webContents:{isDestroyed:()=>contentsDestroyed,send:(_channel,value)=>messages.push(value),on:(event,fn)=>events.set(event,fn)},on:(event,fn)=>events.set(event,fn),once:(event,fn)=>events.set(event,fn)};
const publisherScreen={getDisplayMatching:()=>({displayFrequency:frequency}),on:(event,fn)=>subscriptions.set(event,fn),removeListener:(event,fn)=>{assert.equal(subscriptions.get(event),fn);subscriptions.delete(event)}};
const publisherStart=mainSource.indexOf('let lastDisplayFrequency;'),publisherEnd=mainSource.indexOf("for (const event of ['resize', 'move', 'enter-full-screen'",publisherStart);
vm.runInNewContext(mainSource.slice(publisherStart,publisherEnd),{win:publisherWin,screen:publisherScreen,displayFrequency});
events.get('move')();events.get('resize')();assert.deepEqual(messages,[30]);frequency=60;subscriptions.get('display-metrics-changed')();assert.deepEqual(messages,[30,60]);
events.get('did-finish-load')();assert.deepEqual(messages,[30,60,60],'Reload did not publish cadence again');contentsDestroyed=true;frequency=30;events.get('move')();assert.equal(messages.length,3);
closed=true;events.get('closed')();assert.equal(subscriptions.size,0,'Closed window retained display listeners');
for(const frequency of [24,29.97,30,59.94,60,144])assert.equal(displayFrequency({getDisplayMatching:()=>({displayFrequency:frequency})},win),frequency);
for(const frequency of [0,-1,NaN,Infinity,'30',1001])assert.equal(displayFrequency({getDisplayMatching:()=>({displayFrequency:frequency})},win),60);
assert.equal(displayFrequency({},null),60);assert.equal(displayFrequency({},win),60);assert.equal(displayFrequency({}, {isDestroyed:()=>true}),60);
(async()=>{
 const {displayMotionRate,renderFrameRate}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('src/renderBudget.js','utf8')).toString('base64'));
 for(const [input,expected]of [[29.97,30],[59.94,60],[24,24],[144,60],[NaN,60],[0,60]])assert.equal(displayMotionRate(input),expected);
 for(const mode of ['portal','watch','ar'])assert.equal(renderFrameRate({mode,avatarVisible:true,motionFps:24}),24);
 const source=fs.readFileSync('src/renderer.js','utf8');let callback,resolveQuery,updates=0,resumes=0;
 const initialLine=source.match(/^let displayMotionFps=.*$/m)[0];
 for(const bridge of [undefined,{}, {getDisplayCadence:()=>Promise.reject(Error('unavailable'))}]) {
   const fallback=await vm.runInNewContext('(async()=>{'+initialLine+';return displayMotionFps})()',{window:{mirrorBridge:bridge},displayMotionRate});assert.equal(fallback,60,'Browser preview or rejected metadata lost fallback');
 }
 const scope=vm.createContext({displayMotionFps:30,displayMotionRate,syncAdaptiveQuality:()=>updates++,resumeRendering:()=>resumes++,window:{mirrorBridge:{onDisplayCadence:fn=>{callback=fn;return()=>{}},getDisplayCadence:()=>new Promise(resolve=>{resolveQuery=resolve})}}});
 const start=source.indexOf('let displayCadenceVersion=0;'),end=source.indexOf("window.addEventListener('pointerdown', resumeRendering)",start);
 vm.runInContext(source.slice(start,end),scope);
 callback(60);resolveQuery(30);await new Promise(resolve=>setImmediate(resolve));assert.equal(scope.displayMotionFps,60,'Stale initial query overwrote newer display event');assert.equal(updates,1);assert.equal(resumes,1);
 callback(60);assert.equal(resumes,1,'Unchanged display restarted rendering');callback(29.97);assert.equal(scope.displayMotionFps,30);
 console.log('Display cadence: display matching, invalid metadata fallback, fractional/24/30/60/high refresh, event dedupe and stale query isolation passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
