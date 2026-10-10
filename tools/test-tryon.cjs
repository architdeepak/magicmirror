const assert=require('assert/strict');const fs=require('fs/promises');const path=require('path');const os=require('os');const http=require('http');const vm=require('vm');const {pathToFileURL}=require('url');
const {TryOnRequests}=require('../src/tryOnRequests.cjs');const {tryOnConnection}=require('../src/integrationSettings.cjs');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  const garmentSource=await fs.readFile(path.join(__dirname,'../src/garmentMatch.js'),'utf8');
  const matching=vm.createContext({});vm.runInContext(garmentSource.replace('export function ','function '),matching);
  const garments=[{id:'red',name:'Red dinner jacket',category:'outerwear'},{id:'blue',name:'Blue jacket',category:'outerwear'},{id:'shirt',name:'White T-shirt',category:'top'}];
  assert.equal(matching.matchGarment(garments,'red jacket').item.id,'red');
  assert.equal(matching.matchGarment(garments,'WHITE T SHIRT').item.id,'shirt');
  assert.equal(matching.matchGarment(garments,'please put on Blue jacket').item.id,'blue');
  assert.equal(matching.matchGarment(garments,'jacket').choices.length,2);
  assert.equal(matching.matchGarment(garments,'jack').item,null,'Partial word matched an unrelated garment');
  assert.equal(matching.matchGarment(garments,'green jacket').item,null,'Conflicting garment color was ignored');
  const voice=vm.createContext({liveTryOn:{session:null,snapshot:()=>({state:'idle'})},closet:{items:garments,selectedId:'',select(id){this.selectedId=id}},garmentOverlay:{texture:{},getLiveState:()=>({visible:false,status:'Turn on the camera to see your live fit.'})},garmentSelection:Promise.resolve(true),setAssistantMode(){},setTryOnView(){},config:{},elements:{}});
  vm.runInContext(garmentSource.replace('export function ','function '),voice);
  const voiceSource=await fs.readFile(path.join(__dirname,'../src/renderer.js'),'utf8');
  vm.runInContext(voiceSource.slice(voiceSource.indexOf('async function handleTryOnVoice('),voiceSource.indexOf('elements.tryOnCancel.addEventListener')),voice);
  const ambiguous=await voice.handleTryOnVoice({garmentName:'jacket'});assert.equal(ambiguous.choices.length,2);assert.equal(voice.closet.selectedId,'','Ambiguous voice request changed the garment');
  const selected=await voice.handleTryOnVoice({garmentName:'red jacket'});assert.equal(selected.liveFit.visible,false);assert.match(selected.result,/Turn on the camera/);
  assert.match(selected.userMessage,/Turn on the camera/);assert(!selected.userMessage.includes('does not simulate'));
  assert.match(ambiguous.userMessage,/Red dinner jacket/);assert.match(ambiguous.userMessage,/Blue jacket/);
  assert.match((await voice.handleTryOnVoice({garmentName:'green jacket'})).userMessage,/couldn’t find/);
  for(const [state,expected]of [[{visible:false,cameraActive:true,bodyDetected:false,trackingReady:false},/getting ready/],[{visible:true,cameraActive:true,bodyDetected:true},/is on the mirror/],[{visible:false,cameraActive:true,bodyDetected:false},/Step back/],[{visible:false,cameraActive:true,bodyDetected:true},/is selected\.$/]]){
    voice.garmentOverlay.getLiveState=()=>({...state,status:'Diagnostic detail'});
    assert.match((await voice.handleTryOnVoice({garmentName:'red jacket'})).userMessage,expected);
  }
  voice.garmentSelection=Promise.resolve(false);voice.garmentOverlay.imageMessage='Use a garment cutout';assert.equal((await voice.handleTryOnVoice({garmentName:'red jacket'})).userMessage,'Use a garment cutout');
  voice.garmentSelection=Promise.resolve(true);voice.garmentOverlay.imageMessage='';
  const unconfigured=await voice.handleTryOnVoice({garmentName:'red jacket',renderStill:true});assert.match(unconfigured.userMessage,/isn’t connected/);assert.match(unconfigured.result,/Do not claim/);
  voice.liveTryOn.session={};assert.match((await voice.handleTryOnVoice({garmentName:'red jacket'})).userMessage,/Check the camera view/);voice.liveTryOn.session=null;
  voice.config.hasTryOnProvider=true;voice.elements.tryOnConsent={checked:false,focus(){}};voice.setStudioToolsOpen=()=>{};voice.showOracle=()=>{};
  assert.match((await voice.handleTryOnVoice({garmentName:'red jacket',renderStill:true})).userMessage,/Confirm photo-sharing/);
  voice.elements.tryOnConsent.checked=true;voice.renderSelectedTryOn=async()=>({result:'Tool diagnostic',userMessage:'Preview is ready'});
  assert.equal((await voice.handleTryOnVoice({garmentName:'red jacket',renderStill:true})).userMessage,'Preview is ready');
  let finishSelection;voice.garmentSelection=new Promise(resolve=>finishSelection=resolve);
  const obsolete=voice.handleTryOnVoice({garmentName:'Blue jacket'});voice.closet.selectedId='shirt';finishSelection(true);
  assert.match((await obsolete).result,/selection changed/);
  for(const configured of [false,true]){
    const rendering=vm.createContext({tryOnRendering:false,tryOnRequestId:null,garmentRevision:0,closet:{selectedId:'red'},config:{tryOnDestinationId:'fixture'},crypto:{randomUUID:()=> 'fixture-job'},elements:{tryOnConsent:{checked:true},tryOnCancel:{},tryOnRun:{},tryOnStatus:{},shell:{clientWidth:540,clientHeight:960},video:{srcObject:{},readyState:2,videoWidth:540,videoHeight:960}},window:{mirrorBridge:{queueTryOn:async()=>({id:'empty',providerConfigured:configured})}},document:{createElement:()=>({getContext:()=>({translate(){},scale(){},drawImage(){}}),toDataURL:()=> 'data:image/jpeg;base64,fixture'})},showOracle(){},setStudioToolsOpen(){}});
    vm.runInContext(voiceSource.slice(voiceSource.indexOf('async function renderSelectedTryOn('),voiceSource.indexOf('async function handleTryOnVoice(')),rendering);
    const empty=await rendering.renderSelectedTryOn();assert.equal(empty.providerConfigured,configured);assert.match(empty.userMessage,/no rendered preview/);
    if(configured){assert.match(empty.result,/provider completed without/);assert(!empty.result.includes('not configured'));}else assert.match(empty.result,/not configured/);
  }
  const manager=new TryOnRequests({timeoutMs:20});
  await assert.rejects(manager.run('../bad',()=>{}),/valid/);
  let finish;const late=manager.run('late',()=>new Promise(resolve=>finish=resolve));
  assert(manager.cancel('late'));finish('old');await assert.rejects(late,/cancelled/);
  await assert.rejects(manager.run('timeout',signal=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason)))),/timed out/);
  const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'mirror-tryon-'));
  let server,release,received,inputs=[];
  try{
    const closetAssetDirectory=path.join(temporary,'closet');const tryOnDirectory=path.join(temporary,'jobs');await fs.mkdir(closetAssetDirectory);
    const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGZkAAAAASUVORK5CYII=','base64');
    const assetPath=path.join(closetAssetDirectory,'front.png');await fs.writeFile(assetPath,image);
    server=http.createServer(async(req,res)=>{
      let body='';for await(const bytes of req)body+=bytes;const input=JSON.parse(body);inputs.push(input);received?.();
      if(input.garment.name==='Delayed')await new Promise(resolve=>release=resolve);
      if(!res.destroyed){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({imageBase64:image.toString('base64'),mimeType:'image/png',confidence:.9}));}
    });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    let garmentName='Delayed';const requests=new TryOnRequests();
    const context=vm.createContext({fs,path,pathToFileURL,Buffer,Date,Math,URL,fetch,AbortController,setTimeout,clearTimeout,tryOnRequests:requests,closetAssetDirectory,tryOnDirectory,
      tryOnConnection,integrationSettings:{value:(_name,fallback)=>fallback},process:{env:{MIRROR_TRYON_ENDPOINT:`http://127.0.0.1:${server.address().port}/render`}},readClosetRaw:async()=>({garments:[{id:'shirt',name:garmentName,category:'top',assetPath}]})});
    const main=await fs.readFile(path.join(__dirname,'../src/main.js'),'utf8');vm.runInContext(main.slice(main.indexOf('function queueTryOn('),main.indexOf('async function readClosetRaw(')),context);
    const destinationId=tryOnConnection({value:(_name,fallback)=>fallback},{MIRROR_TRYON_ENDPOINT:`http://127.0.0.1:${server.address().port}/render`}).destinationId;
    const request={destinationId,requestId:'first',garmentId:'shirt',frameDataUrl:'data:image/png;base64,'+image.toString('base64'),consent:true};
    await assert.rejects(context.queueTryOn({...request,consent:false}),/consent/);assert.equal(inputs.length,0);
    await assert.rejects(context.queueTryOn({...request,destinationId:'old-provider'}),/connection changed/);assert.equal(inputs.length,0,'Stale consent uploaded a frame');
    const arrived=new Promise(resolve=>received=resolve);const first=context.queueTryOn(request);const rejected=assert.rejects(first,/cancelled/);await arrived;
    assert(requests.cancel('first'));await rejected;
    garmentName='Replacement';const replacement=await context.queueTryOn({...request,requestId:'second'});assert.equal(replacement.status,'rendered');assert.equal(replacement.garmentName,'Replacement');
    assert.equal(inputs[1].schema,'magicmirror.tryon.v1');assert.equal(inputs[1].garment.image,'data:image/png;base64,'+image.toString('base64'));
    assert.equal((await fs.readFile(new URL(replacement.resultUrl))).toString('base64'),image.toString('base64'));
    const manifests=await Promise.all((await fs.readdir(tryOnDirectory)).filter(name=>name.endsWith('.json')).map(async name=>JSON.parse(await fs.readFile(path.join(tryOnDirectory,name),'utf8'))));
    assert(manifests.some(job=>job.status==='cancelled')&&manifests.some(job=>job.status==='rendered'));
    release();await tick();assert.equal(requests.active.size,0);
    // Run the real renderer functions to check an ignored-abort provider's
    // late completion cannot replace the newly requested garment or busy state.
    const rows=()=>({hidden:true,disabled:false,textContent:'',classList:{add(){}},removeAttribute(){}});
    const pending=[];const cancels=[];
    const ui=vm.createContext({crypto:{randomUUID:()=>String(pending.length+1)},tryOnRequestId:null,tryOnRendering:false,garmentRevision:0,closet:{selectedId:'shirt'},config:{},window:{innerWidth:540,innerHeight:960,mirrorBridge:{queueTryOn:input=>new Promise(resolve=>pending.push({input,resolve})),cancelTryOn:async id=>cancels.push(id)}},
      document:{createElement:()=>({width:0,height:0,getContext:()=>({translate(){},scale(){},drawImage(){}}),toDataURL:()=>request.frameDataUrl})},elements:{tryOnCancel:rows(),tryOnRun:rows(),tryOnStatus:rows(),tryOnConsent:{checked:true},video:{srcObject:{},readyState:2,videoWidth:640,videoHeight:480},shell:{clientWidth:540,clientHeight:960},tryOnResult:rows(),tryOnOverlay:rows(),tryOnStill:rows()},showOracle(){},setTryOnView(){},setStudioToolsOpen(){},console});
    const renderer=await fs.readFile(path.join(__dirname,'../src/renderer.js'),'utf8');vm.runInContext(renderer.slice(renderer.indexOf('function cancelTryOnRender()'),renderer.indexOf('async function handleTryOnVoice(')),ui);
    ui.elements.video.srcObject=null;await ui.renderSelectedTryOn();assert.equal(pending.length,0,'Camera-off render captured a stale frame');ui.elements.video.srcObject={};
    const old=ui.renderSelectedTryOn();assert(ui.tryOnRendering&&!ui.elements.tryOnCancel.hidden);ui.cancelTryOnRender();const newer=ui.renderSelectedTryOn();
    pending[0].resolve({...replacement,resultUrl:'file:///old.png'});await old;assert(ui.tryOnRendering,'Old job cleared replacement busy state');assert.notEqual(ui.elements.tryOnResult.src,'file:///old.png');
    pending[1].resolve({...replacement,resultUrl:'file:///new.png'});await newer;assert.equal(ui.elements.tryOnResult.src,'file:///new.png');assert(!ui.tryOnRendering&&ui.elements.tryOnCancel.hidden);assert.deepEqual(cancels,['1']);
    console.log('Try-on lifecycle passed: real loopback provider request and saved image, consent gating, cancellation, timeout, replacement request, and stale renderer result rejection. Generated realism remains unverified.');
  }finally{release?.();server?.closeAllConnections();if(server)await new Promise(resolve=>server.close(resolve));await fs.rm(temporary,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1});
