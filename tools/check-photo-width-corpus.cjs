// Native canvas review of photographed sleeve taper across the existing corpus.
const { app, BrowserWindow } = require('electron');
const fs = require('fs/promises'), path = require('path'), assert = require('assert/strict');
const { pathToFileURL } = require('url');
app.disableHardwareAcceleration();
const root = path.resolve(__dirname, '..');
app.whenReady().then(async () => {
  const out = path.join(root, 'artifacts/photo-width-corpus');
  await fs.mkdir(out, { recursive: true });
  const directory = path.join(root, '.tools/rtv/assets/garment_images');
  const names = (await fs.readdir(directory)).filter(n => n.endsWith('.jpg')).sort();
  const fixture = path.join(out, 'fixture.html');
  await fs.writeFile(fixture, '<body style="margin:0;background:#172029"><canvas width="810" height="1040"></canvas>');
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true, backgroundThrottling: false, contextIsolation: true, nodeIntegration: false } });
  const deadline = setTimeout(() => { console.error('Photo-width corpus timed out');app.exit(1); }, 90000);
  try {
    await win.loadFile(fixture);
    const result = await win.webContents.executeJavaScript(`(async () => {
      const {prepareTexture} = await import(${JSON.stringify(pathToFileURL(path.join(root, 'src/garmentOverlay.js')).href)});
      const {buildGarmentMesh,drawTexturedTriangle} = await import(${JSON.stringify(pathToFileURL(path.join(root, 'src/garmentGeometry.js')).href)});
      const reports=[],pages=[],canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
      let row=0;
      for (const name of ${JSON.stringify(names)}) {
        const image=new Image();image.src=${JSON.stringify(pathToFileURL(directory).href + '/')}+name;await image.decode();
        let texture;try { texture=prepareTexture(image,{mirror:true}); } catch { reports.push({name,kind:'needs cutout'});continue; }
        const pattern=texture.photoPattern;
        if(pattern?.kind!=='photo-long-sleeve'){reports.push({name,kind:pattern?.kind||'torso-only'});continue;}
        const linear={...pattern,sides:pattern.sides.map(s=>({...s,samples:s.samples.map(p=>({...p,widthScale:undefined}))}))};
        if(row===0){ctx.fillStyle='#172029';ctx.fillRect(0,0,810,1040);}
        const cases=[];
        for(const [index,mode] of ['down','raised','crossed'].entries()) {
          const pose=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:0}));
          for(const [i,x,y] of [[11,.7,.3],[12,.3,.3],[23,.64,.62],[24,.36,.62],[13,.86,.47],[14,.14,.47],[15,.9,.66],[16,.1,.66]])Object.assign(pose[i],{x,y,visibility:1});
          if(mode==='raised')for(const [i,x,y]of [[13,.86,.2],[14,.14,.2],[15,.88,.08],[16,.12,.08]])Object.assign(pose[i],{x,y});
          if(mode==='crossed')for(const [i,x,y,z]of [[13,.72,.5,-.2],[14,.28,.5,-.1],[15,.32,.4,-.3],[16,.68,.4,-.15]])Object.assign(pose[i],{x,y,z});
          const sizes=[];
          for(const [variant,source] of [linear,pattern].entries()) {
            const layer=document.createElement('canvas');layer.width=540;layer.height=960;const lc=layer.getContext('2d');
            const mesh=buildGarmentMesh(pose,{width:540,height:960},{width:540,height:960},'top',{photoPattern:source});
            if(!mesh||mesh.missingSleeves!==0||mesh.coverForearms.length!==2)throw Error('Missing sleeve '+name+' '+mode);
            for(const triangle of mesh){if(triangle.some(p=>![p.x,p.y,p.z,p.u,p.v].every(Number.isFinite)))throw Error('Nonfinite '+name);drawTexturedTriangle(lc,texture,triangle);}
            const x=(index*2+variant)*135,y=row*260;ctx.drawImage(layer,x,y+20,135,240);ctx.fillStyle='#fff';ctx.font='10px sans-serif';ctx.fillText(mode+' '+(variant?'photo':'linear'),x+3,y+14);
            sizes.push(mesh.length);
          }
          if(sizes[0]!==sizes[1])throw Error('Triangle count changed '+name);
          cases.push({mode,triangles:sizes[1]});
        }
        ctx.fillStyle='#fff';ctx.font='11px sans-serif';ctx.fillText(name,3,row*260+258);
        reports.push({name,kind:pattern.kind,cases,widthScales:pattern.sides.map(s=>s.samples.map(p=>p.widthScale))});
        if(++row===4){pages.push(canvas.toDataURL());row=0;}
      }
      if(row)pages.push(canvas.toDataURL());
      return {reports,pages};
    })()`);
    for (const [index, page] of result.pages.entries()) await fs.writeFile(path.join(out, `page-${index + 1}.png`), Buffer.from(page.split(',')[1], 'base64'));
    delete result.pages;
    const accepted = result.reports.filter(r => r.kind === 'photo-long-sleeve');
    assert.equal(accepted.length, 11, 'Existing long-photo corpus classification changed');
    for (const row of accepted) for (const scales of row.widthScales) {
      assert.equal(scales[0], 1);assert.equal(scales.at(-1), 1);
      assert(scales.every(s => Number.isFinite(s) && s >= .5 && s <= 1.5));
    }
    result.scope = '36 actual garment photos; 11 accepted long photos, each rendered in three synthetic poses with identical linear/photo-profile inputs. No physical fit, sizing, cloth physics or segmentation accuracy claim.';
    await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({passed:true,photos:result.reports.length,longPhotos:accepted.length,posePairs:accepted.length*3}));
  } finally { clearTimeout(deadline);win.destroy(); }
}).then(() => app.quit()).catch(error => { console.error(error);app.exit(1); });
