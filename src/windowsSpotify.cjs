const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
function createWindowsSpotify({ platform=process.platform, launch=spawn, read=fs.readFile, timeoutMs=15000 }={}) {
  let child=null, opening=null, buffer='', sequence=0, closed=false;
  const pending=new Map();
  const fail=error=>{for(const entry of pending.values()){clearTimeout(entry.timer);entry.reject(error)}pending.clear();};
  const stop=()=>{const old=child;child=null;buffer='';old?.kill();fail(new Error('Windows Spotify media bridge stopped.'));};
  async function start(){
    if(closed)throw new Error('Windows Spotify media bridge closed.');
    if(child)return child;
    if(opening)return opening;
    opening=(async()=>{
      const script=await read(path.join(__dirname,'windowsSpotify.ps1'),'utf8');
      if(closed)throw new Error('Windows Spotify media bridge closed.');
      const process=launch('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
      child=process;buffer='';
      process.stdout.setEncoding('utf8');
      process.stdin.on('error',()=>{if(child===process)stop()});
      process.stderr.on('data',()=>{}); // Never expose account metadata in logs.
      process.stdout.on('data',bytes=>{
        if(child!==process)return;buffer+=bytes.toString('utf8');
        if(buffer.length>3_000_000){stop();return}
        let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);let result;try{result=JSON.parse(line)}catch{stop();return}
          const entry=pending.get(result.id);if(!entry)continue;pending.delete(result.id);clearTimeout(entry.timer);result.error?entry.reject(new Error(result.error)):entry.resolve(result.result);
        }
      });
      const gone=()=>{if(child===process){child=null;buffer='';fail(new Error('Windows Spotify media bridge is unavailable.'))}};
      process.on('error',gone);process.on('exit',gone);return process;
    })();
    try{return await opening}finally{opening=null}
  }
  async function request(action,sessionId){
    if(platform!=='win32')throw new Error('Local Spotify media sessions require Windows.');
    if(!['status','play','pause','next','previous'].includes(action))throw new Error('Unsupported local Spotify action.');
    const process=await start();const id=++sequence;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{stop()},timeoutMs);pending.set(id,{resolve,reject,timer});
      process.stdin.write(JSON.stringify({id,action,...(sessionId?{sessionId}: {})})+'\n',error=>{if(error&&child===process)stop()});
    });
  }
  return {supported:platform==='win32',status:()=>request('status'),async control(action, assertCurrent=()=>{}){if(!['play','pause','next','previous'].includes(String(action||'').toLowerCase()))throw new Error('Unsupported local Spotify action.');const snapshot=await request('status');if(!snapshot.sessionId)throw new Error('Open Spotify on this PC and start a song first.');assertCurrent();const result=await request(String(action||'').toLowerCase(),snapshot.sessionId);assertCurrent();return result},cancelPending:stop,close(){closed=true;stop()}};
}
module.exports={createWindowsSpotify};
