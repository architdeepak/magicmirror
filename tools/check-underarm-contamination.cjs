// Diagnostic magenta marks detached sleeve pixels in the source, never product art.
const {app,BrowserWindow}=require('electron'),fs=require('fs/promises'),path=require('path'),{pathToFileURL}=require('url'),{execFileSync}=require('child_process'),assert=require('assert/strict');
app.disableHardwareAcceleration();const root=path.resolve(__dirname,'..'),baselineRevision='692b453';
app.whenReady().then(async()=>{
 const out=path.join(root,'artifacts/underarm-contamination');await fs.mkdir(out,{recursive:true});
 const oldLong=path.join(out,'baseline-long.mjs');await fs.writeFile(oldLong,execFileSync('git',['show',baselineRevision+':src/longPhotoSleeves.js'],{cwd:root}));
 const oldPhoto=path.join(out,'baseline-photo.mjs');await fs.writeFile(oldPhoto,execFileSync('git',['show',baselineRevision+':src/photoSleeves.js'],{cwd:root,encoding:'utf8'}).replaceAll("'./longPhotoSleeves.js'",JSON.stringify(pathToFileURL(oldLong).href)).replaceAll("'./sleeveNormals.js'",JSON.stringify(pathToFileURL(path.join(root,'src/sleeveNormals.js')).href)));
 const fixture=path.join(out,'fixture.html');await fs.writeFile(fixture,'<canvas></canvas>');const input=path.join(root,'.tools/rtv/assets/garment_images'),names=(await fs.readdir(input)).filter(n=>n.endsWith('.jpg')).sort();
 const win=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false}});
 try{await win.loadFile(fixture);const results=await win.webContents.executeJavaScript(`(async()=>{
  const {prepareTexture}=await import(${JSON.stringify(pathToFileURL(path.join(root,'src/garmentOverlay.js')).href)}),{inferPhotoSleeves:oldInfer,buildPhotoSleeves:oldBuild}=await import(${JSON.stringify(pathToFileURL(oldPhoto).href)}),{buildPhotoSleeves:build}=await import(${JSON.stringify(pathToFileURL(path.join(root,'src/photoSleeves.js')).href)}),{drawTexturedTriangle}=await import(${JSON.stringify(pathToFileURL(path.join(root,'src/garmentGeometry.js')).href)});
  const rows=[];for(const [name,url] of ${JSON.stringify(names.map(name=>[name,pathToFileURL(path.join(input,name)).href]))}){
   const image=new Image();image.src=url;await image.decode();let texture;try{texture=prepareTexture(image,{mirror:true});}catch(error){rows.push({name,kind:'needs cutout'});continue;}
   const beforePattern=oldInfer(texture.getContext('2d').getImageData(0,0,texture.width,texture.height)),pattern=texture.photoPattern;
   if(beforePattern?.kind!==pattern?.kind)throw Error('Classification changed '+name);
   if(pattern?.kind!=='photo-long-sleeve'){rows.push({name,kind:pattern?.kind||'torso-only'});continue;}
   const diagnostic=document.createElement('canvas');diagnostic.width=texture.width;diagnostic.height=texture.height;const dc=diagnostic.getContext('2d'),source=texture.getContext('2d').getImageData(0,0,texture.width,texture.height),pixels=dc.createImageData(texture.width,texture.height),middle=Math.floor(texture.width/2);
   for(let y=Math.ceil(pattern.underarm*texture.height);y<texture.height;y++){
    const at=x=>source.data[(y*texture.width+x)*4+3]>32;if(!at(middle))continue;let left=middle,right=middle;while(left>0&&at(left-1))left--;while(right<texture.width-1&&at(right+1))right++;
    const runs=[];let start=-1;for(let x=0;x<=texture.width;x++){if(x<texture.width&&at(x)&&start<0)start=x;if((x===texture.width||!at(x))&&start>=0){if(x-start>=Math.max(3,Math.round(texture.width*.008)))runs.push({left:start,right:x-1});start=-1;}}
    const detached=runs.filter(run=>run.right<left-texture.width*.015||run.left>right+texture.width*.015);
    for(const run of detached)for(let x=run.left;x<=run.right;x++){const i=(y*texture.width+x)*4;pixels.data[i]=255;pixels.data[i+2]=255;pixels.data[i+3]=255;}
   }
   dc.putImageData(pixels,0,0);
   const pose=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:0}));for(const [i,x,y]of[[11,.7,.3],[12,.3,.3],[23,.64,.62],[24,.36,.62]])Object.assign(pose[i],{x,y,visibility:1});
   const counts=[];for(const [fn,p]of[[oldBuild,beforePattern],[build,pattern]]){const canvas=document.createElement('canvas');canvas.width=540;canvas.height=960;const c=canvas.getContext('2d'),mesh=fn(pose,{width:540,height:960},{width:540,height:960},{photoPattern:p});for(const tri of mesh)drawTexturedTriangle(c,diagnostic,tri);const data=c.getImageData(0,0,540,960).data;let count=0;for(let i=3;i<data.length;i+=4)if(data[i]>32)count++;counts.push(count);}
   rows.push({name,kind:pattern.kind,beforePixels:counts[0],afterPixels:counts[1]});
  }return rows;
 })()`);
 const report={baselineRevision,results,scope:'36 real garment textures; opaque runs separated from the central body by the inference gap/width thresholds below the source underarm are recolored magenta, then only torso triangles are rasterized on explicit synthetic landmarks. Counts expose unintended sleeve sampling, not physical drape/fit/segmentation accuracy.'};console.log(JSON.stringify(results.filter(r=>r.beforePixels!==undefined)));assert(results.some(r=>r.beforePixels>0),'No baseline contamination reproduced');assert.equal(results.find(r=>r.name==='lab_08_white_bg.jpg').afterPixels,0,'Plaid torso still samples detached sleeves');for(const row of results)if(row.afterPixels!==undefined)assert(row.afterPixels<=row.beforePixels,'Worse detached-sleeve sampling: '+row.name);report.passed=true;await fs.writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2));
 }finally{win.destroy();}
}).then(()=>app.quit()).catch(e=>{console.error(e);app.exit(1)});
