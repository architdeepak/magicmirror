const {app,BrowserWindow}=require('electron');const fs=require('fs/promises'),path=require('path'),assert=require('assert/strict');const {pathToFileURL}=require('url');
app.disableHardwareAcceleration();const root=path.resolve(__dirname,'..');
app.whenReady().then(async()=>{
 const dir=path.join(root,'artifacts/sleeves');await fs.mkdir(dir,{recursive:true});const fixture=path.join(dir,'fixture.html');await fs.writeFile(fixture,'<style>body{margin:0;background:#13232d}canvas{display:block}</style><canvas width="540" height="960"></canvas>');
 const win=new BrowserWindow({width:540,height:960,show:false,webPreferences:{offscreen:true,nodeIntegration:false,contextIsolation:true}});
 try{
  await win.loadFile(fixture);
  const result=await win.webContents.executeJavaScript(`(async()=>{
   const {buildGarmentMesh,drawTexturedTriangle}=await import(${JSON.stringify(pathToFileURL(path.join(root,'src/garmentGeometry.js')).href)});
   const {prepareTexture}=await import(${JSON.stringify(pathToFileURL(path.join(root,'src/garmentOverlay.js')).href)});
   const image=new Image();image.src=${JSON.stringify(pathToFileURL(path.join(root,'src/assets/wardrobe/long-sleeve-blue.svg')).href)};await image.decode();const texture=prepareTexture(image,{vector:true});
   if(texture.sourceBounds.scale!==2)throw new Error('Starter SVG was not rasterized at 2x');
   const pose=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:0}));
   for(const [i,x,y] of [[11,.7,.3],[12,.3,.3],[23,.64,.62],[24,.36,.62],[13,.86,.47],[14,.14,.47],[15,.9,.66],[16,.1,.66]])Object.assign(pose[i],{x,y,visibility:1});
   const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');const frames=[];
   for(const mode of ['down','raised','crossed']){
    if(mode==='raised'){Object.assign(pose[13],{x:.86,y:.20});Object.assign(pose[15],{x:.88,y:.08});Object.assign(pose[14],{x:.14,y:.20});Object.assign(pose[16],{x:.12,y:.08});}
    if(mode==='crossed'){Object.assign(pose[13],{x:.72,y:.5,z:-.2});Object.assign(pose[15],{x:.32,y:.4,z:-.3});Object.assign(pose[14],{x:.28,y:.5,z:-.1});Object.assign(pose[16],{x:.68,y:.4,z:-.15});}
    ctx.clearRect(0,0,540,960);const mesh=buildGarmentMesh(pose,{width:540,height:960},{width:540,height:960},'top',{sleeveStyle:'long sleeve',textureBounds:texture.sourceBounds});
    if(mesh.length<=128)throw new Error('No sleeves');
    for(const tri of mesh){if(tri.some(p=>![p.x,p.y,p.z,p.u,p.v].every(Number.isFinite)))throw new Error('Invalid sleeve vertex');drawTexturedTriangle(ctx,texture,tri);}
    frames.push({mode,image:canvas.toDataURL(),triangles:mesh.length});
   }
   const {GarmentOcclusion}=await import(${JSON.stringify(pathToFileURL(path.join(root,'src/garmentOcclusion.js')).href)});
   const occlusion=new GarmentOcclusion(),mask={width:20,height:20,classes:new Uint8Array(400).fill(2)};
   for(const coverForearms of [false,true]){ctx.clearRect(0,0,540,960);ctx.fillStyle='blue';ctx.fillRect(0,0,540,960);occlusion.erase(ctx,mask,pose,{width:540,height:960},{width:540,height:960},{coverForearms});const alpha=ctx.getImageData(259,432,1,1).data[3];if(coverForearms?alpha!==255:alpha!==0)throw new Error('Incorrect covered forearm occlusion');}
   return frames;
  })()`);
  for(const r of result){await fs.writeFile(path.join(dir,r.mode+'.png'),Buffer.from(r.image.split(',')[1],'base64'));assert(r.triangles>128)}
  console.log('Sleeve canvas: finite down/raised/crossed arm meshes rasterized from the original starter texture. Visual garment fit remains subject to review.');
 }finally{win.destroy();app.quit()}
}).catch(e=>{console.error(e);app.exit(1)});
