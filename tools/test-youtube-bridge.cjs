const assert = require('assert/strict');
const fs = require('fs');const vm = require('vm');const path = require('path');const crypto = require('crypto');
const { createYouTubePlayerServer } = require('../src/youtubePlayerServer.cjs');
(async()=>{
  const server=await createYouTubePlayerServer();
  try {
    const base=new URL(server.url);
    const html=await fetch(server.url);assert.equal(html.status,200);
    const text=await html.text();assert(text.includes('https://www.youtube.com/iframe_api'));
    assert(!text.includes('preload.js')&&!text.includes('mirrorBridge'));
    const scriptUrl=new URL(text.match(/src="([^\"]*frame\.js[^\"]*)"/)[1],base);
    assert.equal((await fetch(scriptUrl)).status,200);
    assert.equal((await fetch(new URL('/player',base))).status,403);
    const invalid=new URL(base);invalid.pathname='/../../.env';assert.equal((await fetch(invalid)).status,404);
    assert.equal((await fetch(base,{method:'POST'})).status,403);
    const listeners=new Set(),sent=[];
    const frame={src:'',classList:{add(){},remove(){}},removeAttribute(){this.src='';},contentWindow:{postMessage:(message,origin)=>sent.push({message,origin})}};
    const context=vm.createContext({URL,crypto,setTimeout,clearTimeout,console,window:{addEventListener:(_type,listener)=>listeners.add(listener),removeEventListener:(_type,listener)=>listeners.delete(listener),mirrorBridge:{youtubePlayerUrl:async()=>server.url}}});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/youtubeWatchPlayer.js'),'utf8').replace('export class ','class ')+'\nglobalThis.Subject=YouTubeWatchPlayer;',context);
    const player=new context.Subject(frame);await player.load('M7lc1UVf-VE');
    assert.equal(new URL(frame.src).origin,base.origin);
    const message={channel:'mirror-youtube',token:player.token,type:'state',state:{ready:true,state:2,position:5,duration:30,error:''}};
    const receive=(value,source=frame.contentWindow,origin=base.origin)=>player.receive({data:value,source,origin});
    receive(message,{});assert.equal(player.state.ready,false);
    receive(message,frame.contentWindow,'https://unrelated.example');assert.equal(player.state.ready,false);
    receive({...message,token:'stale'});assert.equal(player.state.ready,false);
    receive(message);assert.equal(player.state.ready,true);assert.equal(player.snapshot().playing,false);
    const play=player.command('play');const input=sent.at(-1);
    assert.equal(input.origin,base.origin);assert.equal(input.message.action,'play');
    receive({...message,type:'result',id:input.message.id});
    const response=await play;assert.equal(response.playing,false,'Command acknowledgement falsely claimed actual playback');
    receive({...message,state:{...message.state,state:1}});assert.equal(player.snapshot().playing,true);
    const old=player.command('pause');const rejection=assert.rejects(old,/source changed/);player.detach();await rejection;
    receive(message);assert.equal(player.state.ready,false);
    player.destroy();assert.equal(listeners.size,0);
    console.log('YouTube bridge passed: real loopback serving, access/path restrictions, separate origin, source/token checks, acknowledgements versus playback events, and source-change cancellation. Actual YouTube playback is checked separately by check:youtube:live.');
  } finally { server.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
