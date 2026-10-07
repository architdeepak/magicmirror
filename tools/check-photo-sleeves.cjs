const {app,BrowserWindow}=require('electron');const fs=require('fs/promises'),path=require('path'),assert=require('assert/strict');const {pathToFileURL}=require('url');
app.disableHardwareAcceleration();const root=path.resolve(__dirname,'..');
app.whenReady().then(async()=>{
 const dir=path.join(root,'artifacts/sleeves');await fs.mkdir(dir,{recursive:true});const fixture=path.join(dir,'photo-fixture.html');await fs.writeFile(fixture,'<style>body{margin:0;background:#13232d}canvas{display:block}</style><canvas width="540" height="960"></canvas>');
 const win=new BrowserWindow({width:540,height:960,show:false,webPreferences:{offscreen:true,nodeIntegration:false,contextIsolation:true}});
 try{
  await win.loadFile(fixture);
  const result=await win.webContents.executeJavaScript(`(async()=>{
   const {buildGarmentMesh,drawTexturedTriangle}=await import(${JSON.stringify(pathToFileURL(path.join(root,'src/garmentGeometry.js')).href)});
   const {prepareTexture}=await import(${JSON.stringify(pathToFileURL(path.join(root,'src/garmentOverlay.js')).href)});
   const image=new Image();image.src=${JSON.stringify(pathToFileURL(path.join(root,'.tools/rtv/assets/garment_images/lab_06_white_bg.jpg')).href)};await image.decode();const texture=prepareTexture(image); if(!texture.photoPattern){const {inferPhotoSleeves}=await import(${JSON.stringify(pathToFileURL(path.join(root,'src/photoSleeves.js')).href)});let reason;inferPhotoSleeves(texture.getContext('2d').getImageData(0,0,texture.width,texture.height),r=>reason=r);throw new Error('No photo pattern: '+reason);}
   const longPhoto=new Image();longPhoto.src=${JSON.stringify(pathToFileURL(path.join(root,'.tools/rtv/assets/garment_images/lab_08_white_bg.jpg')).href)};await longPhoto.decode();if(prepareTexture(longPhoto).photoPattern)throw new Error('Long sleeves were incorrectly treated as short sleeves');
   const pose=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:0}));
   for(const [i,x,y] of [[11,.7,.3],[12,.3,.3],[23,.64,.62],[24,.36,.62],[13,.86,.47],[14,.14,.47],[15,.9,.66],[16,.1,.66]])Object.assign(pose[i],{x,y,visibility:1});
   const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');const frames=[];
   for(const mode of ['down','raised','crossed']){
    if(mode==='raised'){Object.assign(pose[13],{x:.86,y:.20});Object.assign(pose[15],{x:.88,y:.08});Object.assign(pose[14],{x:.14,y:.20});Object.assign(pose[16],{x:.12,y:.08});}
    if(mode==='crossed'){Object.assign(pose[13],{x:.72,y:.5,z:-.2});Object.assign(pose[15],{x:.32,y:.4,z:-.3});Object.assign(pose[14],{x:.28,y:.5,z:-.1});Object.assign(pose[16],{x:.68,y:.4,z:-.15});}
    ctx.clearRect(0,0,540,960);const mesh=buildGarmentMesh(pose,{width:540,height:960},{width:540,height:960},'top',{photoPattern:texture.photoPattern});
    if(mesh.length<=128)throw new Error('No sleeves');
    for(const tri of mesh){if(tri.some(p=>![p.x,p.y,p.z,p.u,p.v].every(Number.isFinite)))throw new Error('Invalid sleeve vertex');drawTexturedTriangle(ctx,texture,tri);}
    frames.push({mode,image:canvas.toDataURL(),triangles:mesh.length});
   }
   return {frames,pattern:texture.photoPattern,longSleeveFallback:true};
  })()`);
  for(const r of result.frames){await fs.writeFile(path.join(dir,'photo-'+r.mode+'.png'),Buffer.from(r.image.split(',')[1],'base64'));assert(r.triangles>128)}
  await fs.writeFile(path.join(dir,'photo-result.json'),JSON.stringify({scope:'Actual public garment photographs, synthetic body poses, finite canvas output and visual inspection; no fit accuracy validation.',pattern:result.pattern,longSleeveFallback:result.longSleeveFallback,frames:result.frames.map(({mode,triangles})=>({mode,triangles}))},null,2));
  console.log('Photo sleeves: finite down/raised/crossed meshes rasterized from the real garment photo. Visual garment fit remains subject to review.');
 }finally{win.destroy();app.quit()}
}).catch(e=>{console.error(e);app.exit(1)});
