const {app,BrowserWindow}=require('electron');const fs=require('fs/promises');const path=require('path');const {pathToFileURL}=require('url');const assert=require('assert/strict');
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
  const root=path.resolve(__dirname,'..'),directory=path.join(root,'artifacts/microphone-loss');await fs.mkdir(directory,{recursive:true});
  const fixture=path.join(directory,'fixture.html');await fs.writeFile(fixture,'<!doctype html><title>Microphone loss check</title>');
  const win=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false}});
  try{
    await win.loadFile(fixture);
    const result=await win.webContents.executeJavaScript(`(async()=>{
      const {GeminiLiveAdapter}=await import(${JSON.stringify(pathToFileURL(path.join(root,'src/geminiLiveAdapter.js')).href)});
      const context=new AudioContext();await context.resume();const destination=context.createMediaStreamDestination();
      const stream=destination.stream;const errors=[];let interruptions=0;
      navigator.mediaDevices.getUserMedia=async()=>stream;
      const adapter=new GeminiLiveAdapter({avatar:{interrupt(){interruptions++}},config:{},onError:error=>errors.push(error)});
      adapter.setVisionEnabled(false);
      try{
        await adapter.startMicrophone();const input=adapter.inputContext;
        adapter._playFallbackPcm(new Int16Array(24000),24000);
        if(!adapter.listening||adapter.outputSources.size!==1)throw new Error('Synthetic microphone/playback did not start');
        stream.getAudioTracks()[0].dispatchEvent(new Event('ended'));
        await new Promise(resolve=>setTimeout(resolve,100));
        return{listening:adapter.listening,streamReleased:adapter.micStream===null,liveTracks:stream.getTracks().filter(track=>track.readyState==='live').length,inputState:input.state,queuedPlayback:adapter.outputSources.size,suppressed:adapter.playbackSuppressed,errors,interruptions,input:'synthetic MediaStream ended event',serviceCalls:0};
      }finally{adapter.stopPlayback();adapter.disconnect();stream.getTracks().forEach(track=>track.stop());await context.close()}
    })()`);
    assert.equal(result.listening,false);assert(result.streamReleased&&result.suppressed);assert.equal(result.liveTracks,0);assert.equal(result.inputState,'closed');assert.equal(result.queuedPlayback,0);assert.match(result.errors[0],/Microphone disconnected/);
    await fs.writeFile(path.join(directory,'result.json'),JSON.stringify(result,null,2)+'\n');console.log('Actual microphone loss cleanup passed:',JSON.stringify(result));
  }finally{win.destroy()}
}).then(()=>app.quit()).catch(error=>{console.error(error);app.exit(1)});
