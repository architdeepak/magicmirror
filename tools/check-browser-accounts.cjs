// Actual Electron browser DOM and isolated-world inspection, with synthetic
// sign-in and map pages. No Apple ID, account credentials or provider API.
const {app,BrowserWindow}=require('electron');
const assert=require('assert/strict'),http=require('http'),fs=require('fs/promises'),path=require('path'),os=require('os');
const {assertBrowserAccountReady}=require('../src/browserAccountBoundary.cjs');
app.disableHardwareAcceleration();
const auditProfile = path.join(os.tmpdir(), 'mirror-account-check-' + process.pid);
app.setPath('userData', auditProfile);
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'mirror-account-check-'));let win;
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');const kind=new URL(req.url,'http://fixture').searchParams.get('kind');
  if(kind==='password')res.end('<form><h1>Sign in to Apple Account</h1><input name="email" value="synthetic@example.invalid"><input type="password" value="synthetic secret"></form>');
  else if(kind==='otp')res.end('<h1>Verify</h1><input autocomplete="one-time-code" value="123456">');
  else if(kind==='iframe')res.end('<iframe src="https://idmsa.apple.com/appleauth/auth/signin" style="width:300px;height:200px"></iframe>');
  else if(kind==='hidden')res.end('<input type="password" hidden><h1>Signed-in map fixture</h1>');
  else if(kind==='email')res.end('<form><h1>Sign in</h1><input type="email"></form>');
  else if(kind==='signin-path')res.end('<h1>Account loading</h1>');
  else res.end('<h1>Signed-in map fixture</h1><p>Device seen 5 minutes ago; accuracy 100m. Synthetic data.</p><script>document.cookie="mirror_fixture_session=present;path=/;max-age=3600";window.getComputedStyle=()=>({display:"none"})</script>');
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;const checks=[];
 try{
  win=new BrowserWindow({show:true,width:540,height:650,webPreferences:{partition:'persist:account-boundary-audit',sandbox:true,contextIsolation:true,nodeIntegration:false}});
  globalThis.accountAuditWindow = win;
  win.webContents.session.webRequest.onBeforeRequest({urls:['https://idmsa.apple.com/*']}, (_details,callback)=>callback({cancel:true}));
  for(const kind of['password','otp','iframe','email','signin-path','hidden','map']){
   console.log('Account boundary fixture: '+kind);
   await Promise.race([win.loadURL(`${base}${kind==='signin-path'?'/signin':'/'}?kind=${kind}`), new Promise((_,reject)=>setTimeout(()=>reject(new Error('Fixture load timed out: '+kind)),15000))]);
   for(let retry=0;retry<50&&win.webContents.isLoadingMainFrame();retry++) await new Promise(resolve=>setTimeout(resolve,100));
   console.log('Loaded boundary fixture: '+kind);
   if(['hidden','map'].includes(kind)){await assertBrowserAccountReady(win);checks.push({kind,expected:'capture permitted'});}
   else {await assert.rejects(assertBrowserAccountReady(win),/Sign in directly/);checks.push({kind,expected:'capture/input paused'});}
  }
  const cookies=await win.webContents.session.cookies.get({url:base});assert(cookies.some(c=>c.name==='mirror_fixture_session'));
  const session=win.webContents.session;await session.flushStorageData();win.destroy();
  win=new BrowserWindow({show:true,width:540,height:650,webPreferences:{partition:'persist:account-boundary-audit',sandbox:true,contextIsolation:true,nodeIntegration:false}});globalThis.accountAuditWindow=win;await win.loadURL(base+'/?kind=hidden');await new Promise(resolve=>setTimeout(resolve,200));assert((await win.webContents.session.cookies.get({url:base})).some(c=>c.name==='mirror_fixture_session'));await assertBrowserAccountReady(win);checks.push({kind:'window recreation',expected:'persistent synthetic session retained'});
  const report={checkedAt:new Date().toISOString(),passed:true,scope:'Electron browser and fixed isolated-world credential inspection. Synthetic sign-in/map/session only, not actual Apple login or friends data.',checks};await fs.mkdir(path.join(__dirname,'../artifacts/browser-accounts'),{recursive:true});await fs.writeFile(path.join(__dirname,'../artifacts/browser-accounts/result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }finally{win?.destroy();await new Promise(r=>server.close(r));await fs.rm(profile,{recursive:true,force:true});await fs.rm(auditProfile,{recursive:true,force:true});}
 app.quit();
}).catch(error=>{console.error(error);app.exit(1)});
