// Interactive screenshot/input exploration of the actual packaged app.
const fs=require('fs/promises'),path=require('path'),os=require('os'),readline=require('readline');
const {spawn}=require('child_process');const {connect}=require('./cdp-client.cjs');
const root=path.resolve(__dirname,'..');const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'mirror-explore-'));const directory=path.join(root,'artifacts/exploration');await fs.mkdir(directory,{recursive:true});
  const manager=spawn(path.join(root,'.tools/native-companion-wm/root/usr/bin/openbox'),[],{stdio:'ignore',env:{...process.env,LD_LIBRARY_PATH:path.join(root,'.tools/native-companion-wm/root/usr/lib/aarch64-linux-gnu'),XDG_DATA_DIRS:path.join(root,'.tools/native-companion-wm/root/usr/share')+':/usr/share'}});
  const child=spawn(path.join(root,`dist/linux-${process.arch}-unpacked/magic-mirror-portal`),['--kiosk','--no-sandbox','--disable-gpu',`--user-data-dir=${temp}`,'--remote-debugging-address=127.0.0.1','--remote-debugging-port=0'],{cwd:temp,env:{...process.env,GEMINI_API_KEY:'',DECART_API_KEY:'',MIRROR_SPOTIFY_CLIENT_ID:'',MIRROR_KIOSK:'true'},stdio:['ignore','pipe','pipe']});
  let logs='',client,number=0;const events=[];for(const pipe of[child.stdout,child.stderr])pipe.on('data',b=>logs=(logs+b).slice(-12000));
  const until=async fn=>{for(let i=0;i<600;i++){const result=await fn();if(result)return result;await delay(100)}throw new Error('App startup timed out')};
  try{
    const endpoint=await until(()=>logs.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/)?.[1]);
    const target=await until(async()=>(await fetch(`http://${new URL(endpoint).host}/json/list`).then(r=>r.json())).find(t=>t.url.includes('app.asar/src/index.html')));
    client=await connect(target.webSocketDebuggerUrl);await client.call('Page.enable');await client.call('Runtime.enable');
    client.onEvent(event=>{if(event.method==='Runtime.exceptionThrown')events.push(event.params.exceptionDetails.text)});
    await until(()=>client.evaluate('!!window.__mirrorDebug&&document.querySelector("#loader").classList.contains("done")'));
    console.log('READY: actual packaged portrait app; JSON commands click, text, key, shot, inspect, quit.');
    const input=readline.createInterface({input:process.stdin});
    for await(const line of input){let command;try{command=JSON.parse(line)}catch{continue}
      try{
        if(command.action==='quit')break;
        if(command.action==='click'){await client.call('Input.dispatchMouseEvent',{type:'mousePressed',x:command.x,y:command.y,button:'left',clickCount:1});await client.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:command.x,y:command.y,button:'left',clickCount:1});await delay(500)}
        if(command.action==='text')await client.call('Input.insertText',{text:command.text});
        if(command.action==='key'){await client.call('Input.dispatchKeyEvent',{type:'keyDown',key:command.key,windowsVirtualKeyCode:command.code||13});await client.call('Input.dispatchKeyEvent',{type:'keyUp',key:command.key,windowsVirtualKeyCode:command.code||13})}
        if(command.action==='inspect')console.log(JSON.stringify({state:await client.evaluate('__mirrorDebug.getMirrorState()'),errors:events}));
        if(command.action==='shot'){await delay(400);const shot=await client.call('Page.captureScreenshot',{format:'png'});const filename=path.join(directory,`${String(++number).padStart(2,'0')}.png`);await fs.writeFile(filename,Buffer.from(shot.data,'base64'));console.log(filename)}
        console.log('OK '+command.action);
      }catch(error){console.log('ERROR '+error.message)}
    }
    input.close();
  }finally{client?.close();child.kill('SIGTERM');await delay(200);child.kill('SIGKILL');manager.kill('SIGTERM');await fs.rm(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e.message);process.exitCode=1});
