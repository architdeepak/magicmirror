const assert=require('assert/strict');const fs=require('fs/promises');const os=require('os');const path=require('path');const crypto=require('crypto');
const {IntegrationSettings,tryOnConnection}=require('../src/integrationSettings.cjs');
async function checkMainIntegration(directory, vault) {
  const vm=require('vm');
  const source=await fs.readFile(path.join(__dirname,'../src/main.js'),'utf8');
  const frames={};let saves=0,cancelled=0,providerVersion=0;
  const webContents={mainFrame:frames};
  const handlerSource=source.slice(source.indexOf("  ipcMain.handle('mirror:save-connections'"),source.indexOf("  ipcMain.handle('mirror:create-gemini-token'"));
  let handler;
  vm.runInNewContext(handlerSource,{ipcMain:{handle:(_name,callback)=>handler=callback},mainWindow:{webContents},spotifyClientId:()=> 'same-client',integrationSettings:{save:async input=>{saves++;if(input.tryOnProvider)providerVersion++;return{remembered:false}}},liveTryOnTokens:{cancel(){}},safePublicConfig:()=>({hasGeminiKey:true}),tryOnConnection:()=>({version:providerVersion}),process:{env:{}},tryOnRequests:{cancelAll(){cancelled++}}});
  await assert.rejects(handler({sender:{},senderFrame:frames},{}),/only be changed/);
  await assert.rejects(handler({sender:webContents,senderFrame:{}},{}),/only be changed/);
  assert.equal(saves,0,'Untrusted frame changed connection settings');
  assert.equal((await handler({sender:webContents,senderFrame:frames},{})).hasGeminiKey,true);
  assert.equal(saves,1);
  await handler({sender:webContents,senderFrame:frames},{tryOnProvider:'off'});assert.equal(cancelled,1,'Provider change did not cancel pending jobs');

  const dataSource=source.slice(source.indexOf('const writableDataDirectory'),source.indexOf('const integrationSettings'));
  const paths=vm.runInNewContext(dataSource+';({memoryPath,closetPath,closetAssetDirectory,tryOnDirectory})',{app:{isPackaged:true,getPath:()=>directory},path,__dirname:'/read-only/app.asar/src'});
  for(const value of Object.values(paths))assert(value.startsWith(path.join(directory,'data')+path.sep),'Packaged data path points into application archive');
  await fs.mkdir(paths.tryOnDirectory,{recursive:true});await fs.writeFile(paths.memoryPath,'{}');

  const servers=[];const links=[];const tokenPath=path.join(directory,'spotify-fixture.bin');
  let exchangeResolve;
  const context=vm.createContext({path,fs,crypto,URL,URLSearchParams,Date,JSON,setTimeout:(...args)=>{const timer=setTimeout(...args);timer.unref();return timer},clearTimeout,console,safeStorage:vault,
    integrationSettings:{value:()=> 'client-fixture',secureStorageAvailable:()=>true},process:{env:{}},spotifyTokenPath:()=>tokenPath,
    nativeCompanion:{enter:()=>false,active:false},desktopWindow:null,mainWindow:{webContents:{send:()=>{}}},shell:{openExternal:async url=>links.push(url)},safeEqual:(a,b)=>a===b,
    fetch:()=>new Promise(resolve=>exchangeResolve=resolve),
    http:{createServer:callback=>{const server={callback,listening:false,once:()=>{},listen:(_port,_host,ready)=>{server.listening=true;ready()},address:()=>({port:41000+servers.length}),close:()=>server.listening=false};servers.push(server);return server;}}
  });
  const spotifySource=source.slice(source.indexOf('function spotifyClientId()'),source.indexOf('async function spotifyApi('));
  vm.runInContext('let spotifyGeneration=0,spotifyStorageQueue=Promise.resolve(),spotifyTokens=null,spotifyAuthServer=null,spotifyAuthTimeout=null,spotifyAuthState="",spotifyAuthVerifier="";'+spotifySource,context);
  await vm.runInContext('startSpotifyAuthorization()',context);
  const state=new URL(links[0]).searchParams.get('state');
  const response={writeHead:()=>{},end:()=>{}};
  const oldExchange=servers[0].callback({method:'GET',url:'/callback?state='+state+'&code=synthetic'},response);
  await vm.runInContext('startSpotifyAuthorization()',context);
  exchangeResolve({ok:true,json:async()=>({access_token:'old-access',refresh_token:'old-refresh'})});
  await oldExchange;
  assert(servers[1].listening,'Late OAuth exchange closed the new sign-in server');
  assert.equal(vm.runInContext('spotifyTokens',context),null,'Cancelled OAuth exchange restored authorization');
  vm.runInContext('spotifyAuthCleanup();spotifyTokens={clientId:"client-fixture",refreshToken:"refresh",expiresAt:0}',context);
  const staleRefresh=vm.runInContext('getSpotifyAccessToken()',context);
  vm.runInContext('spotifyGeneration++;spotifyTokens=null',context);
  exchangeResolve({ok:true,json:async()=>({access_token:'stale-access'})});
  await assert.rejects(staleRefresh,/connection changed/);
  assert.equal(vm.runInContext('spotifyTokens',context),null);

  vm.runInContext('spotifyTokens={clientId:"client-fixture",refreshToken:"fixture"}',context);
  const persist=vm.runInContext('persistSpotifyTokens()',context);
  vm.runInContext('spotifyGeneration++;spotifyTokens=null',context);
  const deletion=vm.runInContext('deleteSpotifyTokens()',context);
  await Promise.all([persist,deletion]);
  await assert.rejects(fs.access(tokenPath),error=>error.code==='ENOENT');
  vm.runInContext('integrationSettings.sessionOnly=true;spotifyTokens={clientId:"client-fixture",refreshToken:"session-only"}',context);
  await vm.runInContext('persistSpotifyTokens()',context);
  await assert.rejects(fs.access(tokenPath),error=>error.code==='ENOENT');
  vm.runInContext('integrationSettings.sessionOnly=false;spotifyTokens=null',context);
  await fs.writeFile(tokenPath,vault.encryptString(JSON.stringify({clientId:'different-client',refreshToken:'wrong-client'})));
  await vm.runInContext('loadSpotifyTokens()',context);
  assert.equal(vm.runInContext('spotifyTokens',context),null,'Authorization from another client was loaded');
}

(async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'mirror-settings-check-'));
  const key=crypto.randomBytes(32);
  const vault={isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'fixture-encrypted',encryptString:value=>{const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const bytes=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),bytes]);},decryptString:buffer=>{const decipher=crypto.createDecipheriv('aes-256-gcm',key,buffer.subarray(0,12));decipher.setAuthTag(buffer.subarray(12,28));return Buffer.concat([decipher.update(buffer.subarray(28)),decipher.final()]).toString('utf8');}};
  try{
    const store=new IntegrationSettings(directory,vault);await store.load();assert.equal(store.value('geminiApiKey','environment-fixture'),'environment-fixture');
    await store.save({geminiApiKey:'synthetic-api-key',spotifyClientId:'public-client-id'});
    const bytes=await fs.readFile(store.filename);assert(!bytes.includes(Buffer.from('synthetic-api-key')),'API key was stored as plaintext');
    const restored=new IntegrationSettings(directory,vault);await restored.load();assert.equal(restored.value('geminiApiKey'),'synthetic-api-key');
    await restored.save({spotifyClientId:'changed-client'});assert.equal(restored.value('geminiApiKey'),'synthetic-api-key','Blank key update removed saved key');
    await restored.save({geminiApiKey:'session-key',remember:false});assert.equal(restored.value('geminiApiKey'),'session-key');
    const restart=new IntegrationSettings(directory,vault);await restart.load();assert.equal(restart.value('geminiApiKey'),'synthetic-api-key','Session-only update was persisted');
    await restart.save({clearGemini:true});const disabled=new IntegrationSettings(directory,vault);await disabled.load();assert.equal(disabled.value('geminiApiKey','environment-fixture'),'','Disabled key reverted to environment value');
    await assert.rejects(store.save({geminiApiKey:'bad key'}),/invalid characters/);
    await store.save({tryOnProvider:'custom',tryOnEndpoint:'https://renderer.example/v1',tryOnApiKey:'synthetic-renderer-token'});
    const rendererStore=new IntegrationSettings(directory,vault);await rendererStore.load();
    assert.equal(tryOnConnection(rendererStore).host,'renderer.example');assert.equal(tryOnConnection(rendererStore).apiKey,'synthetic-renderer-token');
    assert(!(await fs.readFile(store.filename)).includes(Buffer.from('synthetic-renderer-token')),'Renderer token was stored as plaintext');
    await rendererStore.save({tryOnProvider:'off'});assert.equal(tryOnConnection(rendererStore,{MIRROR_VERTEX_PROJECT:'env-project',MIRROR_TRYON_ENDPOINT:'https://env.example'}).configured,false,'Off restored an environment provider');
    await rendererStore.save({tryOnProvider:'custom',tryOnApiKey:''});assert.equal(tryOnConnection(rendererStore,{MIRROR_TRYON_API_KEY:'env-token'}).apiKey,'','Removed token restored an environment credential');
    await assert.rejects(rendererStore.save({tryOnEndpoint:'http://remote.example/render'}),/HTTPS/);
    await assert.rejects(rendererStore.save({tryOnEndpoint:'https://user:pass@renderer.example'}),/credentials/);
    await assert.rejects(rendererStore.save({tryOnProvider:'other'}),/Choose/);
    await assert.rejects(rendererStore.save({tryOnProvider:'vertex',tryOnProject:''}),/project/);
    await rendererStore.save({tryOnProvider:'vertex',tryOnProject:'cloud-project',tryOnLocation:'us-central1'});
    const cloud=tryOnConnection(rendererStore);assert.equal(cloud.host,'us-central1-aiplatform.googleapis.com');assert(cloud.configured);
    const main=await fs.readFile(path.join(__dirname,'../src/main.js'),'utf8');const vm=require('vm');
    const publicSettings={value:(name,fallback)=>name==='tryOnApiKey'?'private-renderer-token':name==='geminiApiKey'?'private-gemini-token':rendererStore.value(name,fallback),secureStorageAvailable:()=>true};
    const publicSource=main.slice(main.indexOf('function safePublicConfig()'),main.indexOf('async function createGeminiToken()'));
    const publicConfig=vm.runInNewContext(publicSource+';safePublicConfig()',{integrationSettings:publicSettings,tryOnConnection,process:{env:{},platform:'win32'},decartApiKey:()=> 'private-decart-token',liveTryOnDestinationId:'decart:lucy-vton-3.5',spotifyClientId:()=> 'client',memoryPath:'fixture',useKiosk:false});
    assert(publicConfig.hasLiveTryOnProvider);assert(!JSON.stringify(publicConfig).includes('private-decart-token'));assert(publicConfig.hasTryOnToken);assert(!JSON.stringify(publicConfig).includes('private-renderer-token'));assert(!JSON.stringify(publicConfig).includes('private-gemini-token'));


    const basic=new IntegrationSettings(path.join(directory,'basic'),{...vault,getSelectedStorageBackend:()=> 'basic_text'});
    await assert.rejects(basic.save({geminiApiKey:'another-fixture'}),/Encrypted storage/);await basic.save({geminiApiKey:'another-fixture',remember:false});
    assert.equal(basic.value('geminiApiKey'),'another-fixture');await assert.rejects(fs.access(basic.filename),error=>error.code==='ENOENT');
    await fs.writeFile(store.filename,Buffer.from('not encrypted'));const corrupt=new IntegrationSettings(directory,vault);await corrupt.load();assert(corrupt.loadError&&!corrupt.value('geminiApiKey'));
    await checkMainIntegration(directory,vault);
    console.log('Connection settings passed: trusted Settings frame, writable packaged data, Spotify sign-in/refresh cancellation and token deletion, encrypted persistence, session-only updates, disabling environment fallback, malformed/unlock failures, and rejection of basic-text secret storage. OS keychain integration remains platform-specific.');
  }finally{await fs.rm(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
