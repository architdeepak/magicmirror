const assert = require('assert/strict');
const fs = require('fs/promises');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { createNativeDesktop, nativeAction, sameForeground, NATIVE_KEYS } = require('../src/nativeDesktop.cjs');
const { managedKeyEvents, MANAGED_KEYS } = require('../src/managedBrowserKeys.cjs');
const { DesktopNavigation } = require('../src/desktopNavigation.cjs');


async function testNavigation(source){
 const instances=[];let notifications=0,mainShows=0,invalidations=0;
 class Browser {
  constructor(){this.visible=false;this.destroyed=false;this.loads=[];this.handlers={};this.webHandlers={};this.shows=0;this.stops=0;this.webContents={setWindowOpenHandler(){},on:(name,fn)=>this.webHandlers[name]=fn,stop:()=>this.stops++};instances.push(this);}
  on(name,fn){this.handlers[name]=fn;}isDestroyed(){return this.destroyed;}isVisible(){return this.visible;}
  loadURL(url){return new Promise((resolve,reject)=>this.loads.push({url,resolve,reject}));}
  show(){this.visible=true;this.shows++;}focus(){}close(){if(this.asyncClose){this.closing=true;return;}this.destroyed=true;this.handlers.closed?.();}
 }
 const owner=new DesktopNavigation({onRetire:browser=>{if(context.desktopWindow===browser)context.desktopWindow=null;}}),context=vm.createContext({BrowserWindow:Browser,desktopWindow:null,desktopNavigation:owner,mainWindow:{isDestroyed:()=>false,show(){mainShows++}},useKiosk:false,nativeCompanion:{exit(){}},normalizeExternalWebUrl:value=>{const u=new URL(value);if(!['http:','https:'].includes(u.protocol))throw Error('Invalid URL');return u.href},layoutDesktopWindow(){},notifyDesktopPresentation(){notifications++},desktopActionAbort:null,invalidateDesktopObservation(){invalidations++}});
 vm.runInContext(source.slice(source.indexOf('async function openDesktopWebpage('),source.indexOf('async function closeDesktopWindow(')),context);
 vm.runInContext(source.slice(source.indexOf('async function closeDesktopWindow('),source.indexOf('function resizeForAssistant(')),context);
 const cancelled=context.openDesktopWebpage('https://example.org/slow');const first=instances.at(-1);owner.cancel();first.loads[0].resolve();await assert.rejects(cancelled,/cancelled/);assert(first.destroyed);assert.equal(first.shows,0);
 const old=context.openDesktopWebpage('https://example.org/older'),older=instances.at(-1);const newest=context.openDesktopWebpage('https://example.org/current'),current=instances.at(-1);older.loads[0].reject(Error('Old network failure'));await assert.rejects(old,/superseded/);assert(!current.destroyed,'Old load closed new window');current.loads[0].resolve();await newest;assert.equal(current.shows,1);
 const beforeNavigation=invalidations;let actionAborts=0;context.desktopActionAbort={abort(){actionAborts++}};
 assert.equal(typeof current.webHandlers['did-start-navigation'],'function','Main-frame navigation does not invalidate old observations');
 current.webHandlers['did-start-navigation']({isMainFrame:false});assert.equal(invalidations,beforeNavigation,'Subframe navigation invalidated the main document');
 current.webHandlers['did-start-navigation']({isMainFrame:true,isSameDocument:false});assert.equal(invalidations,beforeNavigation+1);assert.equal(actionAborts,1);
 current.webHandlers['did-navigate']({},'https://example.org/current');assert.equal(invalidations,beforeNavigation+2,'Same-URL commit kept a loading observation');
 current.webHandlers['did-navigate-in-page']({},'https://example.org/current',false);assert.equal(invalidations,beforeNavigation+2);
 current.webHandlers['did-navigate-in-page']({},'https://example.org/current',true);assert.equal(invalidations,beforeNavigation+3,'Same-document commit kept an old observation');
 const beforeRetired=invalidations;older.webHandlers['did-start-navigation']({isMainFrame:true});assert.equal(invalidations,beforeRetired,'Retired page invalidated the successor');context.desktopActionAbort=null;
 const reload=context.openDesktopWebpage('https://example.org/reload');owner.cancel();current.loads[1].resolve();await assert.rejects(reload,/cancelled/);assert(!current.destroyed);assert(current.visible);assert.equal(current.shows,1,'Cancelled reload refocused visible window');
 const valid=context.openDesktopWebpage('https://example.org/valid');const generation=owner.generation;await assert.rejects(context.openDesktopWebpage('file:///private'),/Invalid/);assert.equal(owner.generation,generation);current.loads[2].resolve();await valid;
 const failure=context.openDesktopWebpage('https://example.org/failure');current.loads[3].reject(Error('Offline'));await assert.rejects(failure,/could not open/);assert(current.destroyed);assert.equal(owner.pending,null);
 const retiring=context.openDesktopWebpage('https://example.org/retiring'),closing=instances.at(-1);closing.asyncClose=true;
 const successor=context.openDesktopWebpage('https://example.org/successor'),fresh=instances.at(-1);assert(closing.closing&&!closing.destroyed);assert.notEqual(fresh,closing,'Reused asynchronously closing browser');closing.loads[0].reject(Error('Closing'));await assert.rejects(retiring,/superseded/);fresh.loads[0].resolve();await successor;assert.equal(fresh.shows,1);const noticesBefore=notifications,showsBefore=mainShows;closing.destroyed=true;closing.handlers.closed();assert.equal(notifications,noticesBefore);assert.equal(mainShows,showsBefore,'Retired close refocused the mirror over its successor');
 fresh.asyncClose=true;await context.closeDesktopWindow();assert.equal(context.desktopWindow,null);assert(fresh.closing);const afterReturn=context.openDesktopWebpage('https://example.org/after-return'),returned=instances.at(-1);assert.notEqual(returned,fresh);returned.loads[0].resolve();await afterReturn;
 const broken=new Browser();broken.webContents.stop=()=>{throw Error('Gone')};const token=owner.begin();owner.attach(token,broken);owner.cancel();assert(broken.destroyed);assert.equal(owner.pending,null);
 console.log('Managed navigation: late success after Stop, superseded failure, visible browser preservation, invalid URL ownership, failure cleanup and crashed stop passed.');
}

async function main() {
  const source = await fs.readFile(path.join(__dirname, '../src/main.js'), 'utf8');
  await testNavigation(source);
  // Execute the production capture/action functions with an observable native
  // backend, without starting Electron or sending input to the developer PC.
  const functions = source.slice(source.indexOf('function resizeForAssistant('), source.indexOf('function spotifyConfigured('));
  let now = 1000;
  let foreground = { id: '42', processId: 123, processName: 'notepad', title: 'Notes', bounds: { x: -1350, y: 0, width: 1350, height: 2400 } };
  let nativeInputs = [];
  let pending = null;
  const jpeg = Buffer.from([0xff,0xd8,0xff,0xd9]);
  const image = { getSize: () => ({ width: 720, height: 1280 }), isEmpty: () => false, toJPEG: () => jpeg };
  const context = vm.createContext({
    assertBrowserAccountReady: async () => {}, desktopNavigation:new DesktopNavigation(), crypto, AbortController, Date: { now: () => now },
    mainWindow: { isDestroyed: () => false, getBounds: () => ({ x: -1080, y: 0, width: 1080, height: 1920 }) },
    nativeCompanion: { active: false }, desktopWindow: null, lastScreenObservation: null, desktopObservationGeneration: 0, desktopActionAbort: null,
    closeDesktopWindow: async () => true,
    screen: {
      getDisplayMatching: () => ({ id: 7, bounds: { x: -1080, y: 0, width: 1080, height: 1920 } }),
      dipToScreenPoint: ({ x, y }) => ({ x: Math.round(x * 1.25), y: Math.round(y * 1.25) }),
      screenToDipPoint: ({ x, y }) => ({ x: x / 1.25, y: y / 1.25 })
    },
    desktopCapturer: { getSources: async ({ types }) => types[0] === 'window' ? [] : [{ display_id: '7', thumbnail: image }] },
    nativeAction, sameForeground, NATIVE_KEYS, managedKeyEvents, MANAGED_KEYS,
    nativeDesktop: {
      supported: true,
      inspect: async () => structuredClone(foreground),
      perform: async (input, signal) => {
        nativeInputs.push(input);
        if (pending) return new Promise((resolve, reject) => { signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }); pending = resolve; });
        return { result: 'sent' };
      }
    }
  });
  vm.runInContext(functions, context);
  let cancelDesktop;
  context.ipcMain = { handle: (_name, handler) => { cancelDesktop = handler; } };
  vm.runInContext(source.slice(source.indexOf("  ipcMain.handle('mirror:desktop-cancel'"), source.indexOf("  ipcMain.handle('mirror:spotify-status'")), context);
  const capture = () => context.captureCurrentScreen({ recordObservation: true });
  const click = (snapshotId) => context.performDesktopAction({ action: 'click', snapshotId, x: 360, y: 640 });
  context.nativeCompanion.active = true; context.nativeCompanion.label = 'Spotify';
  await assert.rejects(capture(), /Spotify content stays local/);
  context.nativeCompanion.active = false;
  const originalSources = context.desktopCapturer.getSources;
  let releaseCapture;
  context.desktopCapturer.getSources = () => new Promise(resolve => { releaseCapture = resolve; });
  const stoppedCapture = capture();
  while (!releaseCapture) await new Promise(resolve => setImmediate(resolve));
  assert.equal(cancelDesktop(), true);
  releaseCapture([]);
  await assert.rejects(stoppedCapture, /cancelled or superseded/);
  assert.equal(context.lastScreenObservation, null, 'Stopped capture restored authorization');
  releaseCapture = null;
  const olderCapture = capture();
  while (!releaseCapture) await new Promise(resolve => setImmediate(resolve));
  context.desktopCapturer.getSources = originalSources;
  const newerShot = await capture();
  releaseCapture([]);
  await assert.rejects(olderCapture, /cancelled or superseded/);
  assert.equal(context.lastScreenObservation.id, newerShot.snapshotId, 'Older capture replaced the newest observation');
  const aborted = new AbortController(); aborted.abort();
  await assert.rejects(context.captureCurrentScreen({ signal: aborted.signal }), /cancelled or superseded/);
  context.invalidateDesktopObservation();
  releaseCapture = null;
  context.desktopCapturer.getSources = async options => options.types[0] === 'window' ? []
    : new Promise(resolve => { releaseCapture = resolve; });
  const lateCapture = capture();
  while (!releaseCapture) await new Promise(resolve => setImmediate(resolve));
  context.invalidateDesktopObservation(); releaseCapture([{ display_id: '7', thumbnail: image }]);
  await assert.rejects(lateCapture, /cancelled or superseded/);
  assert.equal(context.lastScreenObservation, null);
  context.desktopCapturer.getSources = originalSources;
  await assert.rejects(click('missing'), /missing, expired, or already used/);
  let shot = await capture();
  assert.equal(shot.inputTarget, 'windows-desktop');
  assert.equal(shot.dataUrl, 'data:image/jpeg;base64,'+jpeg.toString('base64'));
  assert.deepEqual(Array.from(shot.supportedKeys), Array.from(NATIVE_KEYS));
  await click(shot.snapshotId);
  assert.equal(nativeInputs[0].x, -675);
  assert.equal(nativeInputs[0].y, 1200);
  assert.equal(nativeAction({action:'double_click',x:360,y:640},{foreground,displayBounds:{x:-1080,y:0,width:1080,height:1920},width:720,height:1280},point=>point).op,'double_click');
  await assert.rejects(click(shot.snapshotId), /already used/);
  shot = await capture(); now += 31_000;
  await assert.rejects(click(shot.snapshotId), /expired/);
  shot = await capture(); foreground.id = '43';
  await assert.rejects(click(shot.snapshotId), /focus changed/);
  shot = await capture(); foreground.bounds.x = 4000;
  await assert.rejects(click(shot.snapshotId), /another display/);
  foreground.bounds.x = -1350;
  shot = await capture();
  await assert.rejects(context.performDesktopAction({ action: 'click', snapshotId: shot.snapshotId, x: 9000, y: 2 }), /inside the latest/);
  assert.equal(nativeInputs.length, 1, 'Rejected observations sent native input');
  shot = await capture(); pending = true;
  const action = click(shot.snapshotId);
  while (nativeInputs.length < 2) await new Promise((resolve) => setTimeout(resolve, 0));
  await assert.rejects(click(shot.snapshotId), /still running/);
  context.desktopActionAbort.abort();
  await assert.rejects(action, /cancelled/);
  assert.equal(context.desktopActionAbort, null);
  assert.deepEqual(managedKeyEvents('CTRL+A'), [
    { type: 'keyDown', keyCode: 'A', modifiers: ['control'] },
    { type: 'keyUp', keyCode: 'A', modifiers: ['control'] }
  ]);
  assert.deepEqual(managedKeyEvents('enter').map(event=>[event.type,event.keyCode]), [['keyDown','Enter'],['char','\r'],['keyUp','Enter']]);
  assert.deepEqual(managedKeyEvents('space').map(event=>[event.type,event.keyCode]), [['keyDown','Space'],['char',' '],['keyUp','Space']]);
  for (const key of ['home', 'end', 'pageup', 'pagedown']) assert.equal(managedKeyEvents(key).length, 2);
  for (const key of ['win', 'alt+tab', 'ctrl+l', 'ctrl+f', 'unknown']) assert.throws(() => managedKeyEvents(key), /Supported managed-browser keys/);
  context.nativeDesktop.supported = false;
  let resolveInsertion, typed = '', sentEvents = [];
  context.desktopWindow = {
    isDestroyed: () => false, isVisible: () => true, focus: () => {},
    getBounds: () => ({x:-1080,y:0,width:1080,height:1200}),
    getContentBounds: () => ({x:-1080,y:0,width:1080,height:1200}), getContentSize: () => [1080,1200],
    webContents: { getURL: () => 'https://example.org', sendInputEvent: event => sentEvents.push(event),
      insertText: text => new Promise(resolve => { typed = text; resolveInsertion = resolve; }) }
  };
  shot = await capture();
  assert.deepEqual(Array.from(shot.supportedKeys), Array.from(MANAGED_KEYS));
  let insertionReturned = false;
  const insertion = context.performDesktopAction({action:'type_text',snapshotId:shot.snapshotId,text:'search 👑'}).then(value => { insertionReturned = true; return value; });
  while (!resolveInsertion) await new Promise(resolve => setImmediate(resolve));
  assert.equal(insertionReturned,false,'Text input completed before Electron insertion');
  assert.equal(typed,'search 👑');resolveInsertion();await insertion;
  shot = await capture();
  await context.performDesktopAction({action:'press_key',snapshotId:shot.snapshotId,key:'ctrl+a'});
  assert.deepEqual(sentEvents, managedKeyEvents('ctrl+a'));
  sentEvents=[];shot=await capture();
  await context.performDesktopAction({action:'double_click',snapshotId:shot.snapshotId,x:360,y:300});
  assert.deepEqual(sentEvents.map(event=>[event.type,event.clickCount]),[['mouseMove',undefined],['mouseDown',1],['mouseUp',1],['mouseDown',2],['mouseUp',2]]);
  await assert.rejects(context.performDesktopAction({action:'double_click',snapshotId:shot.snapshotId,x:360,y:300}),/already used/);


  let invocation;
  const bridge = createNativeDesktop({ platform: 'win32', run: async (...args) => { invocation = args; return { stdout: '{"result":"sent"}' }; } });
  const typedText = "quote ' ` $() Ω 👑";
  const command = nativeAction({ action: 'type_text', text: typedText }, { foreground }, () => {});
  await bridge.perform(command);
  const decoded = JSON.parse(Buffer.from(invocation[2].env.MIRROR_DESKTOP_INPUT, 'base64').toString('utf8'));
  assert.equal(decoded.text, typedText);
  assert(!Buffer.from(invocation[1].at(-1), 'base64').toString('utf16le').includes(typedText), 'User text became executable PowerShell source');
  assert.equal(invocation[0], 'powershell.exe');
  assert.equal(invocation[2].windowsHide, true);
  await assert.rejects(createNativeDesktop({ platform: 'linux' }).inspect(), /available on Windows/);
  console.log('Desktop harness passed: fresh single-use observations, superseded/stopped capture rejection, focus, DPI, display bounds, cancellation, and data-only Unicode input.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
