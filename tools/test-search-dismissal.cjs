const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('src/renderer.js','utf8'),timers=new Map();
let serial=0,now=0,focused=false,hovered=false,dismissed=0;
const root={hidden:false,contains:()=>focused,matches:()=>hovered};
const pool={root,timer:0};
const scope=vm.createContext({searchPool:pool,performance:{now:()=>now},document:{activeElement:{}},setTimeout:(fn,delay)=>{const id=++serial;timers.set(id,{fn,at:now+delay});return id},clearTimeout:id=>timers.delete(id),hideSearchResult:()=>{timers.delete(pool.timer);pool.timer=0;dismissed++;root.hidden=true}});
vm.runInContext(source.slice(source.indexOf('function scheduleSearchDismissal('),source.indexOf('function cancelPendingSearch()')),scope);
const fire=()=>{const [id,job]=timers.entries().next().value;now=job.at;timers.delete(id);job.fn();return job.fn};
scope.scheduleSearchDismissal();focused=true;fire();assert.equal(dismissed,0);assert.equal(timers.size,1);
focused=false;hovered=true;fire();assert.equal(dismissed,0);assert.equal(timers.size,1);
hovered=false;const before=serial,oldDeadline=timers.values().next().value.at;
for(let i=0;i<10000;i++){now+=1;scope.scheduleSearchDismissal()}
assert.equal(serial,before,'Scroll activity allocated timers');assert.equal(timers.size,1);
const stale=fire();assert.equal(now,oldDeadline);assert.equal(dismissed,0,'Old deadline dismissed active reader');
assert.equal(timers.values().next().value.at,oldDeadline+10000,'Renewed deadline drifted');
stale();assert.equal(dismissed,0,'Retired callback dismissed replacement');assert.equal(timers.size,1);
fire();assert.equal(dismissed,1);scope.scheduleSearchDismissal();assert.equal(timers.size,0,'Hidden card scheduled expiry');
console.log('Search dismissal: focus/hover retention, 10,000 allocation-free renewals, exact idle deadline, stale callback isolation and hidden expiry passed.');
