const assert = require('assert/strict');
const { NativeCompanion } = require('../src/nativeCompanion.cjs');
let bounds = { x: -1080, y: 0, width: 540, height: 960 };
let fullscreen = true, kiosk = true, top = false, maximized = false, shape;
let changes = 0, invalidations = 0;
const win = { isDestroyed:()=>false, getBounds:()=>({...bounds}), getContentBounds:()=>({...bounds,x:bounds.x+8,y:bounds.y+30,width:bounds.width-16,height:bounds.height-38}),
  isFullScreen:()=>fullscreen,isKiosk:()=>kiosk,isAlwaysOnTop:()=>top,isMaximized:()=>maximized,
  setFullScreen:value=>fullscreen=value,setKiosk:value=>kiosk=value,setAlwaysOnTop:value=>top=value,
  setBounds:value=>bounds={...value},setShape:value=>shape=value,unmaximize:()=>maximized=false,maximize:()=>maximized=true,
  showInactive:()=>{},show:()=>{},focus:()=>{} };
const original={...bounds};
const companion=new NativeCompanion({getWindow:()=>win,platform:'win32',screen:{getDisplayMatching:()=>({bounds:{x:-1080,y:0,width:1080,height:1920}})},onChange:()=>changes++,onInvalidate:()=>invalidations++});
assert(companion.enter('Desktop app'));assert(companion.active&&top&&!fullscreen&&!kiosk);
const exposed=companion.exposedBounds();assert(exposed.height>1200&&exposed.height<1350);assert(exposed.x>=bounds.x&&exposed.x+exposed.width<=bounds.x+bounds.width);
assert.equal(shape.length,1);assert(shape[0].y>1200&&shape[0].height>500);
assert(shape[0].x>=8&&shape[0].x+shape[0].width<=bounds.width-7,'Companion shape ignored window borders');
const saved=companion.saved;companion.enter('Second app');assert.equal(companion.saved,saved,'Repeated launch replaced mirror restoration bounds');
bounds={x:0,y:0,width:540,height:960};companion.layout();assert(shape[0].y>600&&shape[0].height>200);
companion.exit();assert.deepEqual(shape,[]);assert.deepEqual(bounds,original);assert(fullscreen&&kiosk&&!top);assert(!companion.active&&changes===3&&invalidations>=3);
assert(!new NativeCompanion({getWindow:()=>win,platform:'darwin',screen:{}}).enter());
assert(!new NativeCompanion({getWindow:()=>win,platform:'linux',sessionType:'wayland',screen:{}}).enter());
console.log('Native companion lifecycle passed: TV region, border coordinates, repeated launches, layout changes, and restored kiosk/fullscreen state. Actual composition is checked separately.');
