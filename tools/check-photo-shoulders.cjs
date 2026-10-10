// Real garment bitmaps on explicit synthetic landmark poses, actual Electron canvas.
const {app, BrowserWindow} = require('electron');
const fs = require('fs/promises'), path = require('path'), assert = require('assert/strict');
const {pathToFileURL} = require('url'), {execFileSync} = require('child_process');
const {createHash} = require('crypto');
app.disableHardwareAcceleration();
app.on('window-all-closed',()=>{});
const rotationDeg=Number(process.env.MIRROR_PHOTO_ROTATE_DEG||0);
assert(Number.isFinite(rotationDeg)&&Math.abs(rotationDeg)<=10);
const label=(process.env.MIRROR_PHOTO_LABEL||'photo-shoulders').replace(/[^a-zA-Z0-9_-]/g,'');
const photoNames=(process.env.MIRROR_PHOTO_FILES||'lab_06_white_bg.jpg,lab_08_white_bg.jpg').split(',');
assert(photoNames.every(name=>/^[a-zA-Z0-9_-]+\.jpg$/.test(name)));
const root = path.resolve(__dirname, '..'), baselineRevision = process.env.MIRROR_PHOTO_BASELINE || '001ff6a';
app.whenReady().then(async () => {
  const out = path.join(root, 'artifacts',label);
  await fs.mkdir(out, {recursive: true});
  const baselineSource = execFileSync('git', ['show', baselineRevision + ':src/photoSleeves.js'], {cwd: root, encoding: 'utf8'});
  const baseline = path.join(out, 'baseline.mjs');
  const baselineLong=path.join(out,'baseline-long.mjs');
  await fs.writeFile(baselineLong,execFileSync('git',['show',baselineRevision+':src/longPhotoSleeves.js'],{cwd:root,encoding:'utf8'}));
  await fs.writeFile(baseline, baselineSource.replaceAll("'./longPhotoSleeves.js'", JSON.stringify(pathToFileURL(baselineLong).href)).replaceAll("'./sleeveNormals.js'", JSON.stringify(pathToFileURL(path.join(root, 'src/sleeveNormals.js')).href)));
  const fixture = path.join(out, 'fixture.html');
  await fs.writeFile(fixture, '<canvas width="1080" height="960"></canvas>');
  const win = new BrowserWindow({width: 1080, height: 960, show: false, webPreferences: {offscreen: true, contextIsolation: true, nodeIntegration: false}});
  try {
    await win.loadFile(fixture);
    const rows = await win.webContents.executeJavaScript(`(async () => {
      const {prepareTexture}=await import(${JSON.stringify(pathToFileURL(path.join(root, 'src/garmentOverlay.js')).href)});
      const {buildPhotoSleeves:before,inferPhotoSleeves:inferBefore}=await import(${JSON.stringify(pathToFileURL(baseline).href)});
      const {buildPhotoSleeves:after}=await import(${JSON.stringify(pathToFileURL(path.join(root, 'src/photoSleeves.js')).href)});
      const {drawTexturedTriangle}=await import(${JSON.stringify(pathToFileURL(path.join(root, 'src/garmentGeometry.js')).href)});
      const cases=[],canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
      for(const [name,url] of ${JSON.stringify(photoNames.map(name => [name, pathToFileURL(path.join(root, '.tools/rtv/assets/garment_images', name)).href]))}) {
        const image=new Image();image.src=url;await image.decode();let input=image;
        if(${rotationDeg}!==0){const angle=${rotationDeg}*Math.PI/180,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle)),rotated=document.createElement('canvas');rotated.width=Math.ceil(image.width*c+image.height*s);rotated.height=Math.ceil(image.height*c+image.width*s);const rc=rotated.getContext('2d');rc.fillStyle='white';rc.fillRect(0,0,rotated.width,rotated.height);rc.translate(rotated.width/2,rotated.height/2);rc.rotate(angle);rc.drawImage(image,-image.width/2,-image.height/2);input=rotated;}
        const texture=prepareTexture(input,{mirror:true});
        if(!texture.photoPattern)throw Error('Missing pattern '+name);const beforePattern=inferBefore(texture.getContext('2d').getImageData(0,0,texture.width,texture.height));if(!beforePattern)throw Error('Missing baseline pattern');
        for(const mode of ['down','raised','crossed','lean','partial']) {
          const pose=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:0}));
          for(const [i,x,y] of [[11,.7,.3],[12,.3,.3],[23,.64,.62],[24,.36,.62],[13,.86,.47],[14,.14,.47],[15,.9,.66],[16,.1,.66]])Object.assign(pose[i],{x,y,visibility:1});
          if(mode==='raised')for(const [i,x,y] of [[13,.86,.2],[14,.14,.2],[15,.88,.08],[16,.12,.08]])Object.assign(pose[i],{x,y});
          if(mode==='crossed')for(const [i,x,y,z] of [[13,.72,.5,-.2],[14,.28,.5,-.1],[15,.32,.4,-.3],[16,.68,.4,-.15]])Object.assign(pose[i],{x,y,z});
          if(mode==='lean')for(const p of pose){const x=(p.x-.5)*540,y=(p.y-.5)*960;p.x=.5+(Math.cos(.4)*x-Math.sin(.4)*y)/540;p.y=.5+(Math.sin(.4)*x+Math.cos(.4)*y)/960;}
          if(mode==='partial'){pose[13].visibility=.1;pose[15].visibility=.1;}
          ctx.fillStyle='#15202b';ctx.fillRect(0,0,1080,960);const metrics=[];let previousXYZ;
          for(const [column,build] of [before,after].entries()) {
            const mesh=build(pose,{width:540,height:960},{width:540,height:960},{photoPattern:column===0?beforePattern:texture.photoPattern,normalHistory:{}});
            if(!mesh)throw Error('Unexpected torso loss');
            const xyz=JSON.stringify(mesh.map(tri=>tri.map(p=>[p.x,p.y,p.z])));
            if(${JSON.stringify(baselineRevision)}==='941bd00'&&column===1&&xyz!==previousXYZ)throw Error('UV correction changed geometry');previousXYZ=xyz;
            for(const p of mesh.flat())if(![p.x,p.y,p.z,p.u,p.v].every(Number.isFinite))throw Error('Nonfinite vertex');
            const byUV=new Map();for(const p of mesh.flat()){const key=p.u.toFixed(8)+':'+p.v.toFixed(8),old=byUV.get(key);if(old&&Math.hypot(old.x-p.x,old.y-p.y,old.z-p.z)>1e-6)throw Error('Split seam');byUV.set(key,p);}
            ctx.save();ctx.translate(column*540,0);for(const tri of mesh)drawTexturedTriangle(ctx,texture,tri);ctx.restore();
            const anchors=texture.photoPattern.sides.flatMap(side=>[side.outer,side.inner]);
            const sourceAnchorError=Math.max(...anchors.map(a=>Math.min(...mesh.flat().map(p=>Math.hypot(p.u-a.u,p.v-a.v)))));
            metrics.push({triangles:mesh.length,missingSleeves:mesh.missingSleeves,coveredForearms:mesh.coverForearms,sourceAnchorError,shoulderHeights:texture.photoPattern.sides.map(s=>s.outer.v)});
          }
          ctx.fillStyle='#fff';ctx.font='18px sans-serif';ctx.fillText('Before · '+mode,12,28);ctx.fillText('Current · '+texture.photoPattern.kind,552,28);
          cases.push({name,mode,metrics,png:canvas.toDataURL()});
        }
      }
      return cases;
    })()`);
    const sheet = await win.webContents.executeJavaScript(`(async()=>{
      const canvas=document.createElement('canvas');canvas.width=2160;canvas.height=${Math.ceil(rows.length/4)*480};
      const ctx=canvas.getContext('2d');ctx.fillStyle='#15202b';ctx.fillRect(0,0,canvas.width,canvas.height);
      for(const [i,url] of ${JSON.stringify(rows.map(row => row.png))}.entries()){
        const image=new Image();image.src=url;await image.decode();ctx.drawImage(image,(i%4)*540,Math.floor(i/4)*480,540,480);
      }
      return canvas.toDataURL();
    })()`);
    await fs.writeFile(path.join(out, 'sheet.png'), Buffer.from(sheet.split(',')[1], 'base64'));
    for (const row of rows) {
      assert.equal(row.metrics[0].triangles, row.metrics[1].triangles);
      assert.equal(row.metrics[0].missingSleeves, row.metrics[1].missingSleeves);
      assert.deepEqual(row.metrics[0].coveredForearms, row.metrics[1].coveredForearms);
      await fs.writeFile(path.join(out, row.name.replace('.jpg', '') + '-' + row.mode + '.png'), Buffer.from(row.png.split(',')[1], 'base64'));
      delete row.png;
    }
    const report = {passed: true, baselineRevision, rotationDeg, baselineSourceSha256: createHash('sha256').update(baselineSource).digest('hex'), cases: rows, scope: 'Actual software Electron canvas, selected public short/long garment photographs, five explicit synthetic landmark poses each; optional rotation affects both variants equally. Finite vertices, shared UV/XYZ seams, unchanged triangle counts and limb ownership. No physical camera, acoustic command, anatomical sizing or drape accuracy.'};
    await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({passed: true, cases: rows.length}));
  } finally {win.destroy();}
}).then(() => app.quit()).catch(error => {console.error(error); app.exit(1);});
