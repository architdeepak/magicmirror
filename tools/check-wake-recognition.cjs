// Exercise the actual Vosk WASM model and production phrase handling with WAV
// fixtures. This does not measure a physical microphone, room noise, or echo.
const {app,BrowserWindow}=require('electron');const {createWakeModelServer}=require('../src/wakeModelServer.cjs');const fs=require('fs/promises');const path=require('path');const {pathToFileURL}=require('url');
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
  const server=await createWakeModelServer();
  const directory=path.join(__dirname,'../artifacts/wake-word');await fs.mkdir(directory,{recursive:true});
  const cases=[['wake',false,1,0],['stop',true,0,1],['mute',true,0,1],['near',false,0,0],['miracle',false,0,0],['weather',false,0,0],['weather',true,0,0]];
  const fixtures=[];for(const [name,active,wakes,stops]of cases)fixtures.push({name,active,wakes,stops,audio:(await fs.readFile(path.join(directory,name+'.wav'))).toString('base64')});
  const fixture=path.join(directory,'recognition.html');
  await fs.writeFile(fixture,`<!doctype html><p>Local wake recognition check</p><script src="${pathToFileURL(path.join(__dirname,'../node_modules/vosk-browser/dist/vosk.js')).href}"></script><script type="module">
    import {WakeWordListener} from ${JSON.stringify(pathToFileURL(path.join(__dirname,'../src/wakeWord.js')).href)};
    window.mirrorBridge={wakeModelUrl:async()=>${JSON.stringify(server.url)}};
    window.report={complete:false,results:[],error:null,status:'starting'};
    window.run=async()=>{
      let model;
      try{
        const original=Vosk.createModel.bind(Vosk);
        const probe=new WakeWordListener({onStatus:status=>report.status=status});await probe._initialize();
        model=probe.model;probe.recognizer.remove();Vosk.Model=undefined;Vosk.createModel=async()=>model;
        for(const input of ${JSON.stringify(fixtures)}){
          const result={name:input.name,active:input.active,wakes:0,stops:0,partials:[],texts:[]};
          const wake=new WakeWordListener({onWake:()=>result.wakes++,onStop:()=>result.stops++});
          await wake._initialize();wake.enabled=true;wake.setAssistantActive(input.active);
          wake.recognizer.on('partialresult',message=>{if(message.result?.partial)result.partials.push(message.result.partial)});
          wake.recognizer.on('result',message=>{if(message.result?.text)result.texts.push(message.result.text)});
          let responses=0,expected=Infinity,finish;
          const final=new Promise(resolve=>finish=resolve);
          const acknowledge=()=>{responses++;if(responses===expected)finish();};
          wake.recognizer.on('partialresult',acknowledge);wake.recognizer.on('result',acknowledge);
          const data=Uint8Array.from(atob(input.audio),character=>character.charCodeAt(0));
          const context=new OfflineAudioContext(1,128,16000);const decoded=await context.decodeAudioData(data.buffer);
          const samples=decoded.getChannelData(0);
          expected=Math.ceil(samples.length/3200)+1;
          for(let offset=0;offset<samples.length;offset+=3200)wake.recognizer.acceptWaveformFloat(samples.slice(offset,offset+3200),decoded.sampleRate);
          wake.recognizer.retrieveFinalResult();
          await Promise.race([final,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Recognition timed out')),12000))]);
          wake.recognizer.remove();report.results.push(result);
          if(result.wakes!==input.wakes||result.stops!==input.stops)throw new Error('Wrong activation for '+input.name+': '+JSON.stringify(result));
        }
        report.complete=true;
      }catch(error){report.error=error?.message||'The local speech model failed to load';report.complete=true;}
      finally{model?.terminate();}
    };void run();
  </script>`);
  const win=new BrowserWindow({width:360,height:480,show:false,webPreferences:{offscreen:true,contextIsolation:true,nodeIntegration:false,partition:'wake-recognition-check'}});
  const messages=[];win.webContents.on('console-message',(_event,level,message)=>{if(level>=2)messages.push(message.slice(0,300));});
  try{
    await win.loadFile(fixture);const started=Date.now();let report;
    while(true){
      report=await win.webContents.executeJavaScript('JSON.parse(JSON.stringify(window.report))');
      if(report.complete)break;
      if(Date.now()-started>90000)throw new Error('Local speech model check timed out; status='+report.status);
      await new Promise(resolve=>setTimeout(resolve,150));
    }
    await fs.writeFile(path.join(directory,'result.json'),JSON.stringify(report,null,2));
    if(report.error)throw new Error(report.error);
    console.log('Real local wake recognition passed:',JSON.stringify(report.results));
  }catch(error){console.error('Wake recognition failed:',error.message);console.error('Renderer diagnostics:',JSON.stringify(messages));throw error;}
  finally{win.destroy();server.close();app.quit();}
}).catch(error=>{console.error(error.message);app.exit(1)});
