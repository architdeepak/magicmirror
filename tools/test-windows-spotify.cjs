const assert=require('assert/strict');
const {EventEmitter}=require('events');
const {PassThrough}=require('stream');
const {createWindowsSpotify}=require('../src/windowsSpotify.cjs');
(async()=>{
  const processes=[];let opens=0;
  const launch=(file,args,options)=>{
    assert.equal(file,'powershell.exe');assert(options.windowsHide);assert(args.includes('-EncodedCommand'));opens++;
    const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.kill=()=>child.emit('exit');processes.push(child);return child;
  };
  const bridge=createWindowsSpotify({platform:'win32',launch,read:async()=> 'fixed trusted script',timeoutMs:100});
  const answer=(child,request,result)=>child.stdout.write(JSON.stringify({id:request.id,result})+'\n');
  const tick=()=>new Promise(r=>setImmediate(r));
  let requests=[];
  const first=bridge.status();const second=bridge.status();await tick();
  const child=processes[0];requests=child.stdin.read().toString().trim().split('\n').map(JSON.parse);assert.equal(opens,1);
  answer(child,requests[1],{connected:true,item:{name:'second'}});answer(child,requests[0],{connected:true,item:{name:'café 👑'}});
  assert.equal((await first).item.name,'café 👑');assert.equal((await second).item.name,'second');
  const control=bridge.control('pause');await tick();const observation=JSON.parse(child.stdin.read().toString());answer(child,observation,{sessionId:'Spotify.exe'});await tick();const command=JSON.parse(child.stdin.read().toString());assert.equal(command.action,'pause');assert.equal(command.sessionId,'Spotify.exe');answer(child,command,{ok:true,confirmed:false});assert.equal((await control).confirmed,false);
  await assert.rejects(bridge.control('unknown'),/Unsupported local Spotify/);
  // Unsupported control is rejected before querying/starting a process.
  const waiting=bridge.status();const rejected=assert.rejects(waiting,/bridge stopped/);await rejected;
  assert.equal(processes.length,1);const retry=bridge.status();await tick();assert.equal(opens,2);const next=processes[1];const request=JSON.parse(next.stdin.read().toString());answer(next,request,{item:null});await retry;
  const changed=bridge.control('next',()=>{throw new Error('Connection changed')});const changedRejection=assert.rejects(changed,/Connection changed/);await tick();const checking=JSON.parse(next.stdin.read().toString());answer(next,checking,{sessionId:'Spotify.exe'});await changedRejection;assert.equal(next.stdin.read(),null,'Changed connection sent a local playback command');
  const cancelled=bridge.control('pause');const cancelRejection=assert.rejects(cancelled,/stopped/);await tick();assert.equal(JSON.parse(next.stdin.read().toString()).action,'status');bridge.cancelPending();await cancelRejection;
  const closed=bridge.status();const closedRejection=assert.rejects(closed,/stopped|closed/);await tick();bridge.close();await closedRejection;await assert.rejects(bridge.status(),/closed/);
  await assert.rejects(createWindowsSpotify({platform:'linux'}).status(),/require Windows/);
  console.log('Windows Spotify bridge fixture passed: persistent helper, response correlation, local session-bound controls, timeout cleanup/restart and shutdown. Real Windows WinRT/Spotify execution is unverified.');
})().catch(error=>{console.error(error);process.exitCode=1});
