const assert=require('assert/strict');
const fs=require('fs');const vm=require('vm');const path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../src/gestureNavigation.js'),'utf8').replace(/^import .*;\n/,'').replace('export class ','class ').replaceAll('import.meta.url',JSON.stringify(require('url').pathToFileURL(path.join(__dirname,'../src/gestureNavigation.js')).href));
const context=vm.createContext({console,URL,HandTracking:class {constructor(){}async init(){return true}setEnabled(){}update(){}destroy(){}}});
vm.runInContext(source+'\nglobalThis.Subject=GestureNavigation;',context);
function hand({x=0,y=0,pinch=false,neutral=false}={}) {
  const points=Array.from({length:21},()=>({x:.5,y:.65}));points[0]={x:.5,y:.78};
  for(const [mcp,px] of [[5,.42],[9,.48],[13,.54],[17,.6]]) {
    points[mcp]={x:px,y:.57};points[mcp+1]={x:px,y:.47};points[mcp+2]={x:px,y:.37};points[mcp+3]={x:px,y:neutral?.62:.27};
  }
  points[4]=pinch?{...points[8]}:{x:.3,y:.5};
  return points.map(point=>({x:point.x+x,y:point.y+y}));
}
(async()=>{
  const events=[];const gesture=new context.Subject({videoWidth:640,videoHeight:480},type=>events.push(type));
  await gesture.init();
  for(let now=1000;now<=4000;now+=100)gesture._interpret(hand(),now);
  assert.deepEqual(events,['palm'],'Held palm fired repeatedly');
  gesture._interpret(hand({neutral:true}),4100);
  for(let now=4200;now<=5000;now+=100)gesture._interpret(hand(),now);
  assert.deepEqual(events,['palm','palm'],'Relaxing hand did not rearm palm');
  gesture._interpret(hand({neutral:true}),5100);
  gesture._interpret(hand(),6000);gesture._interpret(hand({x:.2}),6100);
  assert.equal(events.at(-1),'swipe-left','Direction did not match mirrored preview');
  gesture._interpret(hand({neutral:true}),6200);
  gesture._interpret(hand(),7000);gesture._interpret(hand({y:-.2}),7100);
  assert.equal(events.at(-1),'swipe-up');
  gesture._interpret(hand({neutral:true}),7200);
  gesture._interpret(hand({pinch:true}),8000);gesture._interpret(hand({pinch:true}),8100);
  assert.notEqual(events.at(-1),'pinch','Pinch fired before intentional hold');
  gesture._interpret(hand({pinch:true}),8300);gesture._interpret(hand({pinch:true}),10000);
  assert.equal(events.filter(type=>type==='pinch').length,1,'Held pinch fired repeatedly');
  const lifecycleEvents=[];const video={srcObject:{id:1},readyState:2,videoWidth:640,videoHeight:480};
  const lifecycle=new context.Subject(video,type=>lifecycleEvents.push(type));lifecycle.setEnabled(true);lifecycle.update(1000);lifecycle._consume(hand(),1000);lifecycle._consume(hand(),1300);
  video.srcObject={id:2};lifecycle._consume(hand({x:.3}),1400);assert.equal(lifecycleEvents.length,0,'Late camera result emitted a gesture');
  lifecycle.update(1400);lifecycle._consume(hand(),1500);lifecycle._consume(hand(),1900);assert.equal(lifecycleEvents.length,0,'Camera switch carried an old hold');
  lifecycle._consume(hand(),2500);assert.equal(lifecycleEvents.length,0,'Long inference gap completed a stale hold');
  video.srcObject.active=false;lifecycle.update(2550);lifecycle._consume(hand(),2560);assert.equal(lifecycleEvents.length,0,'Ended camera emitted a gesture');assert.equal(lifecycle.status,'camera-off');
  video.srcObject=null;lifecycle.update(2600);lifecycle._consume(hand(),2800);assert.equal(lifecycleEvents.length,0,'Camera-off emitted a gesture');assert.equal(lifecycle.status,'camera-off','Camera-off retained a tracking status');
  console.log('Gesture classifier passed: worker integration, held pose suppression, release rearming, mirrored swipes, vertical swipe, and deliberate pinch. Synthetic landmarks; real camera gestures remain unverified.');
})().catch(error=>{console.error(error);process.exitCode=1;});
