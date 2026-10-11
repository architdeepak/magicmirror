const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('src/renderer.js','utf8');
(async()=>{
 const jobs=[],images=[0,1].map(()=>({src:'',active:false,decode(){return new Promise((resolve,reject)=>jobs.push({resolve,reject}))},classList:{toggle(name,active){images.find(image=>image.classList===this).active=active}}}));
 const scope=vm.createContext({mode:'mirror',sleeping:false,desktopActive:false,galleryImages:['first','second','third'],galleryIndex:0,galleryLayer:0,galleryEpoch:0,elements:{shell:{dataset:{idleBackground:'gallery'}}},document:{hidden:false,querySelectorAll:()=>images}});
 vm.runInContext(source.slice(source.indexOf('function galleryVisible()'),source.indexOf('async function loadGallery()')),scope);
 for(const [object,key,value] of [[scope,'sleeping',true],[scope,'desktopActive',true],[scope,'mode','portal'],[scope.document,'hidden',true],[scope.elements.shell.dataset,'idleBackground','weather']]){
  const previous=object[key];object[key]=value;await scope.displayGallery();assert.equal(jobs.length,0);assert.equal(scope.galleryIndex,0);object[key]=previous;
 }
 const old=scope.displayGallery(),fresh=scope.displayGallery();jobs[1].resolve();await fresh;const layer=scope.galleryLayer;jobs[0].resolve();await old;assert.equal(scope.galleryLayer,layer);assert.equal(images.filter(image=>image.active).length,1);
 const hidden=scope.displayGallery();scope.document.hidden=true;jobs[2].resolve();await hidden;assert.equal(scope.galleryLayer,layer);scope.document.hidden=false;
 const retired=scope.displayGallery();scope.galleryEpoch++;jobs[3].resolve();await retired;assert.equal(scope.galleryLayer,layer);
 const failed=scope.displayGallery();jobs[4].reject(Error('Broken image'));await failed;assert.equal(scope.galleryLayer,layer);
 const visible=scope.displayGallery();jobs[5].resolve();await visible;assert.notEqual(scope.galleryLayer,layer);
 const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
 function fixture(){
  const startup=deferred(),imported=deferred(),button={disabled:false},notices=[];let calls=0;
  const context=vm.createContext({galleryRevision:0,galleryEpoch:0,galleryImportBusy:false,galleryImages:[],galleryIndex:0,window:{mirrorBridge:{idleGallery:()=>startup.promise,importIdleGallery:()=>{calls++;return imported.promise}}},document:{querySelector:()=>button},idleBackgroundSelect:{dispatchEvent(){}},Event:class{},displayGallery(){},showGesture:message=>notices.push(message),showOracle:message=>notices.push(message)});
  vm.runInContext(source.slice(source.indexOf('async function loadGallery()'),source.indexOf('void loadGallery();')),context);
  vm.runInContext(source.slice(source.indexOf('async function importGallery()'),source.indexOf("document.querySelector('#idle-gallery-import').addEventListener")),context);
  return{context,startup,imported,button,notices,get calls(){return calls}};
 }
 const latest=fixture(),loading=latest.context.loadGallery(),importing=latest.context.importGallery();
 assert(latest.button.disabled);await latest.context.importGallery();assert.equal(latest.calls,1);
 latest.imported.resolve({images:['new']});await importing;assert(!latest.button.disabled);
 latest.startup.resolve({images:['old']});await loading;assert.equal(latest.context.galleryImages[0],'new');
 const cancelled=fixture(),original=cancelled.context.loadGallery(),cancel=cancelled.context.importGallery();cancelled.imported.resolve({cancelled:true});await cancel;cancelled.startup.resolve({images:['original']});await original;assert.equal(cancelled.context.galleryImages[0],'original');assert.equal(cancelled.notices.length,0);
 const closed=fixture(),pendingImport=closed.context.importGallery();closed.context.galleryRevision++;closed.imported.reject(Error('Late failure'));await pendingImport;assert.equal(closed.notices.length,0);assert(!closed.button.disabled);
 const failure=fixture(),failedImport=failure.context.importGallery();failure.imported.reject(Error('Could not import'));await failedImport;assert.equal(failure.notices[0],'Could not import');assert(!failure.button.disabled);
 console.log('Gallery lifecycle: no inactive/hidden/sleep/desktop decode, latest request ownership, retired completion and decode failure preserve current layer passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
