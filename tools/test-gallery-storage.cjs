const assert=require('assert/strict'),fs=require('fs/promises'),path=require('path'),os=require('os');
const {IdleGallery}=require('../src/idleGallery.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mirror-gallery-test-'));
 try{
  const directory=path.join(root,'gallery'),a=path.join(root,'a.png'),b=path.join(root,'b.png');
  await fs.writeFile(a,'a');await fs.writeFile(b,'b');
  const nativeImage={createFromPath:file=>({isEmpty:()=>false,getSize:()=>({width:4000,height:2000}),resize:options=>{assert.equal(options.width,1920);return{toJPEG:()=>Buffer.from(path.basename(file))}}})};
  const gallery=new IdleGallery(directory,nativeImage);assert.deepEqual(await gallery.list(),{images:[]});
  const original=await gallery.import([a]);assert.deepEqual(await gallery.list(),original);
  const originalManifest=await fs.readFile(path.join(directory,'gallery.json'),'utf8');
  for(const failCommit of [false,true]){
   let writes=0;const faulty={...fs,writeFile:async(file,...args)=>{if(!failCommit&&++writes===2)throw Error('Disk full');return fs.writeFile(file,...args)},rename:async(...args)=>{if(failCommit)throw Error('Commit blocked');return fs.rename(...args)}};
   const importer=new IdleGallery(directory,nativeImage,{fileSystem:faulty});await assert.rejects(importer.import([a,b]),/Disk full|Commit blocked/);
   assert.equal(await fs.readFile(path.join(directory,'gallery.json'),'utf8'),originalManifest);assert.deepEqual(await gallery.list(),original);assert(!importer.busy);
   assert.equal((await fs.readdir(directory)).length,2,'Failed import left staging files');
  }
  let release,started;const gate=new Promise(resolve=>release=resolve),writing=new Promise(resolve=>started=resolve);
  const blocked=new IdleGallery(directory,nativeImage,{fileSystem:{...fs,writeFile:async(...args)=>{started();await gate;return fs.writeFile(...args)}}});
  const importing=blocked.import([b]);await writing;const reading=blocked.list();await assert.rejects(blocked.import([a]),/already/);release();const replacement=await importing;assert.deepEqual(await reading,replacement);
  assert.deepEqual(await gallery.list(),replacement);assert.equal((await fs.readdir(directory)).length,2,'Committed import retained obsolete photos');
  await assert.rejects(gallery.import([]),/at least one/);
  await fs.writeFile(path.join(directory,'photo0.jpg'),'legacy');await fs.writeFile(path.join(directory,'gallery.json'),JSON.stringify(['photo9.jpg','photo0.jpg','../a.png']));
  assert.deepEqual((await gallery.list()).images,['data:image/jpeg;base64,'+Buffer.from('legacy').toString('base64')]);
  console.log('Gallery storage: failed writes/commit preserve original, staging cleanup, serialized reads, import guard, obsolete cleanup and legacy/missing/path filtering passed.');
 }finally{
  assert(path.dirname(root)===os.tmpdir()&&path.basename(root).startsWith('mirror-gallery-test-'));await fs.rm(root,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1});
