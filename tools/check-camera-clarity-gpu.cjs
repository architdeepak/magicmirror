const {app,BrowserWindow}=require('electron'),fs=require('fs/promises'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..');
app.whenReady().then(async()=>{
 const out=path.join(root,'artifacts/camera-clarity-gpu');await fs.mkdir(out,{recursive:true});const file=path.join(out,'fixture.html');await fs.writeFile(file,'<body style="margin:0"><canvas id="source" width="256" height="128"></canvas>');
 const win=new BrowserWindow({show:false,webPreferences:{offscreen:true,backgroundThrottling:false,contextIsolation:true,nodeIntegration:false}});
 try{await win.loadFile(file);const result=await win.webContents.executeJavaScript(`(async()=>{
  const {CameraClarity,enhanceCameraPixels}=await import(${JSON.stringify(pathToFileURL(path.join(root,'src/cameraClarity.js')).href)});
  const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),pixels=ctx.createImageData(256,128);
  for(let y=0;y<128;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4;pixels.data[i]=x;pixels.data[i+1]=y*2;pixels.data[i+2]=(x%4<2)?40:200;pixels.data[i+3]=255;}ctx.putImageData(pixels,0,0);
  const clarity=new CameraClarity(document),cases=[];let uploads=0,renderer;
  for(const mode of ['natural','bright'])for(const bitmap of [false,true]){
   clarity.setMode(mode);const source=bitmap?await createImageBitmap(canvas):canvas,out=clarity.process(source);if(clarity.backend!=='gpu')throw Error('Native GPU enhancement unavailable');renderer=clarity.gpu.renderer;
   if(!clarity.gpu.__wrapped){const process=clarity.gpu.process.bind(clarity.gpu);clarity.gpu.process=(...args)=>{uploads++;return process(...args)};clarity.gpu.__wrapped=true;}
   const beforeUploads=uploads,repeated=clarity.process(source);if(repeated!==out||uploads!==beforeUploads)throw Error('Frame cache uploaded twice');
   const read=document.createElement('canvas');read.width=256;read.height=128;const rc=read.getContext('2d');rc.drawImage(out,0,0);const actual=rc.getImageData(0,0,256,128).data,expected=enhanceCameraPixels(pixels.data.slice(),256,128,mode);let maxError=0;
   for(let i=0;i<actual.length;i++){maxError=Math.max(maxError,Math.abs(actual[i]-expected[i]));if(i%4===3&&actual[i]!==255)throw Error('Camera alpha changed');}
   cases.push({mode,bitmap,maxError,resolution:[out.width,out.height]});uploads=0;if(bitmap)source.close();
  }
  const full=document.createElement('canvas');full.width=1280;full.height=720;full.getContext('2d').drawImage(canvas,0,0,1280,720);clarity.setMode('natural');const fullOutput=clarity.process(full);if(fullOutput.width!==1280||fullOutput.height!==720)throw Error('Captured detail was downsampled');
  const png=fullOutput.toDataURL('image/png');clarity.gpu.gl.getExtension('WEBGL_lose_context').loseContext();await new Promise(r=>setTimeout(r,50));const fallback=clarity.process(full);if(fallback!==full)throw Error('Context loss downsampled the source');clarity.release();if(clarity.gpu)throw Error('GPU resources retained');return{cases,renderer,fullResolution:[1280,720],lostContextOriginal:fallback===full,released:!clarity.gpu,png};
 })()`);
 for(const row of result.cases)assert(row.maxError<=2,'GPU differs from bounded CPU color/detail operator');assert(/NVIDIA/.test(result.renderer));await fs.writeFile(path.join(out,'native-detail.png'),Buffer.from(result.png.split(',')[1],'base64'));delete result.png;await fs.writeFile(path.join(out,'result.json'),JSON.stringify({passed:true,...result,scope:'Actual NVIDIA WebGL shader, synthetic original-resolution canvas and ImageBitmap inputs; per-channel CPU reference, orientation, alpha, cache, context loss and release. Not physical camera or Windows efficiency proof.'},null,2));console.log(JSON.stringify({passed:true,...result}));
 }finally{win.destroy();}
}).then(()=>app.quit()).catch(error=>{console.error(error);app.exit(1)});
